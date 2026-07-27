import axios from "axios";
import { getCachedBalances, setCachedBalances } from "../storage/accountsLocalStore";
import {
  addPendingGoalOp,
  getCachedGoals,
  getPendingGoalOps,
  setCachedGoals,
  setPendingGoalOps,
} from "../storage/goalsLocalStore";
import {
  isSqliteReady,
  runStatement,
} from "../storage/offlineSqlRepository";
import { canUsePremiumBackend, canSyncRemote } from "../subscription/subscriptionAccess";
import { isOfflineLikeError } from "./networkFallback";

const api = import.meta.env.VITE_API_URL;

function authHeaders(token) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function normalizeGoal(goal) {
  return {
    ...goal,
    target_amount: Number(goal.target_amount ?? 0),
    reserved_amount: Number(goal.reserved_amount ?? 0),
    is_priority: Boolean(goal.is_priority),
    status: goal.status || "active",
  };
}

function toPositiveAmount(amount, errorMessage) {
  const parsed = Number(amount);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(errorMessage);
  }

  return parsed;
}

function assertGoalExists(goal) {
  if (!goal) {
    throw new Error("Meta no encontrada");
  }
}

function assertGoalIsActive(goal) {
  assertGoalExists(goal);

  if ((goal.status || "active") === "completed") {
    throw new Error("La meta ya está completada");
  }
}

function assertReservedAmount(goal, amount) {
  const reserved = Math.max(0, Number(goal?.reserved_amount ?? 0));

  if (amount > reserved) {
    throw new Error("No puedes retirar más de lo reservado");
  }
}

function assertGoalTargetAllowsDeposit(goal, amount) {
  const target = Number(goal?.target_amount ?? 0);
  const reserved = Math.max(0, Number(goal?.reserved_amount ?? 0));

  if (target <= 0) {
    return;
  }

  const remaining = Math.max(0, target - reserved);

  if (remaining <= 0) {
    throw new Error("La meta ya alcanzó su monto objetivo");
  }

  if (amount > remaining) {
    throw new Error("El aporte excede el monto objetivo de la meta");
  }
}

async function getGoalById(goalId) {
  const goals = await getCachedGoals();
  return (
    goals.find((goal) => String(goal.id) === String(goalId)) || null
  );
}

function sortGoals(items) {
  return [...items].sort((left, right) => {
    if (Boolean(right.is_priority) !== Boolean(left.is_priority)) {
      return Number(Boolean(right.is_priority)) - Number(Boolean(left.is_priority));
    }

    if ((left.status || "active") !== (right.status || "active")) {
      return String(left.status || "active").localeCompare(
        String(right.status || "active")
      );
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

function sortGoalsForReconciliation(items) {
  return [...items].sort((left, right) => {
    if (Boolean(left.is_priority) !== Boolean(right.is_priority)) {
      return Number(Boolean(left.is_priority)) - Number(Boolean(right.is_priority));
    }

    const leftDue = left.due_date ? new Date(left.due_date).getTime() : Number.POSITIVE_INFINITY;
    const rightDue = right.due_date
      ? new Date(right.due_date).getTime()
      : Number.POSITIVE_INFINITY;

    if (leftDue !== rightDue) {
      return rightDue - leftDue;
    }

    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

async function updateGoalCache(updater) {
  const current = await getCachedGoals();
  const next = sortGoals(typeof updater === "function" ? updater(current) : updater);
  await setCachedGoals(next);
  return next;
}

async function mutateAccountBalance(accountId, changes) {
  if (!accountId) return;

  const balances = await getCachedBalances();
  const current = balances?.[accountId] || {
    current: 0,
    reserved: 0,
    available: 0,
  };

  const nextEntry = {
    ...current,
    current: Number(current.current ?? 0) + Number(changes.current ?? 0),
    reserved: Number(current.reserved ?? 0) + Number(changes.reserved ?? 0),
    available: Number(current.available ?? 0) + Number(changes.available ?? 0),
  };

  await setCachedBalances({
    ...balances,
    [accountId]: nextEntry,
  });

  if (await isSqliteReady()) {
    await runStatement(
      `UPDATE accounts
       SET reserved = COALESCE(reserved, 0) + ?,
           available = COALESCE(available, 0) + ?,
           current = COALESCE(current, 0) + ?
       WHERE id = ?`,
      [
        Number(changes.reserved ?? 0),
        Number(changes.available ?? 0),
        Number(changes.current ?? 0),
        String(accountId),
      ]
    );
  }
}

function appendPendingOp(existing, op) {
  return [
    ...existing,
    {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...op,
    },
  ];
}

async function savePendingOp(op) {
  await addPendingGoalOp(op);
}

export async function reconcileGoalReservationsForAccount(accountId) {
  if (!accountId) {
    return { released: 0, affectedGoals: [] };
  }

  const balances = await getCachedBalances();
  const currentBalance = balances?.[String(accountId)];
  const available = Number(currentBalance?.available ?? 0);

  if (available >= 0) {
    return { released: 0, affectedGoals: [] };
  }

  const currentGoals = await getCachedGoals();
  const releasableGoals = sortGoalsForReconciliation(
    currentGoals.filter(
      (goal) =>
        String(goal.account_id || "") === String(accountId) &&
        Number(goal.reserved_amount ?? 0) > 0 &&
        goal.status !== "completed"
    )
  );

  if (!releasableGoals.length) {
    return { released: 0, affectedGoals: [] };
  }

  let missingAmount = Math.abs(available);
  let releasedTotal = 0;
  const releases = [];

  for (const goal of releasableGoals) {
    if (missingAmount <= 0) break;

    const reservedAmount = Number(goal.reserved_amount ?? 0);
    if (reservedAmount <= 0) continue;

    const releaseAmount = Math.min(reservedAmount, missingAmount);
    if (releaseAmount <= 0) continue;

    releases.push({
      goalId: goal.id,
      amount: releaseAmount,
    });

    missingAmount -= releaseAmount;
    releasedTotal += releaseAmount;
  }

  if (releasedTotal <= 0) {
    return { released: 0, affectedGoals: [] };
  }

  await updateGoalCache((items) =>
    items.map((goal) => {
      const release = releases.find(
        (entry) => String(entry.goalId) === String(goal.id)
      );

      if (!release) return goal;

      return {
        ...goal,
        reserved_amount: Math.max(
          0,
          Number(goal.reserved_amount ?? 0) - Number(release.amount)
        ),
        sync_status: String(goal.id).startsWith("local-goal-")
          ? "pending_create"
          : "pending_update",
      };
    })
  );

  await mutateAccountBalance(accountId, {
    reserved: -releasedTotal,
    available: releasedTotal,
  });

  const pending = await getPendingGoalOps();
  await setPendingGoalOps([
    ...pending,
    ...releases.map((release) => ({
      id: crypto.randomUUID(),
      entity_type: "goal",
      type: "withdraw",
      entity_id: String(release.goalId).startsWith("local-goal-")
        ? null
        : release.goalId,
      local_id: String(release.goalId).startsWith("local-goal-")
        ? release.goalId
        : null,
      payload: { amount: Number(release.amount) },
      created_at: new Date().toISOString(),
    })),
  ]);

  return {
    released: releasedTotal,
    affectedGoals: releases.map((release) => release.goalId),
  };
}

async function updatePendingForLocalGoal(localId, mutate) {
  const pending = await getPendingGoalOps();
  const next = mutate([...pending]);
  await setPendingGoalOps(next);
}

export async function listGoals({ token, subscriptionMode }) {
  const cached = await getCachedGoals();

  if (!canUsePremiumBackend(subscriptionMode) || !isOnline()) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/goals`, authHeaders(token));
    const goals = sortGoals((res.data.data || []).map(normalizeGoal));
    await setCachedGoals(goals);
    return { data: goals, source: "remote" };
  } catch (error) {
    if (!isOfflineLikeError(error)) throw error;
    return { data: cached, source: "cache" };
  }
}

export async function createGoal({ token, payload, subscriptionMode }) {
  const normalizedPayload = {
    ...payload,
    target_amount: toPositiveAmount(
      payload?.target_amount,
      "El monto objetivo debe ser mayor que cero"
    ),
  };

  if (canUsePremiumBackend(subscriptionMode) && isOnline()) {
    try {
      const res = await axios.post(
        `${api}/goals`,
        normalizedPayload,
        authHeaders(token)
      );
      return { offline: false, data: normalizeGoal(res.data.data) };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const localGoal = normalizeGoal({
    id: `local-goal-${crypto.randomUUID()}`,
    name: normalizedPayload.name,
    target_amount: normalizedPayload.target_amount,
    due_date: normalizedPayload.due_date || null,
    account_id: normalizedPayload.account_id || null,
    is_priority: Boolean(normalizedPayload.is_priority),
    reserved_amount: 0,
    status: "active",
    sync_status: "pending_create",
  });

  await updateGoalCache((current) => [...current, localGoal]);
  await savePendingOp({
    entity_type: "goal",
    type: "create",
    local_id: localGoal.id,
    payload: normalizedPayload,
  });

  return { offline: true, data: localGoal };
}

export async function updateGoalRecord({ token, goalId, payload, subscriptionMode }) {
  const currentGoal = await getGoalById(goalId);
  assertGoalExists(currentGoal);

  const normalizedPayload = {
    ...payload,
  };

  if (Object.prototype.hasOwnProperty.call(normalizedPayload, "target_amount")) {
    normalizedPayload.target_amount = toPositiveAmount(
      normalizedPayload.target_amount,
      "El monto objetivo debe ser mayor que cero"
    );

    if (normalizedPayload.target_amount < Number(currentGoal.reserved_amount ?? 0)) {
      throw new Error(
        "El monto objetivo no puede ser menor que lo ya reservado en la meta"
      );
    }
  }

  if (canUsePremiumBackend(subscriptionMode) && isOnline()) {
    try {
      await axios.put(
        `${api}/goals/${goalId}`,
        normalizedPayload,
        authHeaders(token)
      );
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateGoalCache((current) =>
    current.map((goal) =>
      String(goal.id) === String(goalId)
        ? {
            ...goal,
            ...normalizedPayload,
            sync_status: String(goal.id).startsWith("local-goal-")
              ? "pending_create"
              : "pending_update",
          }
        : goal
    )
  );

  if (String(goalId).startsWith("local-goal-")) {
    await updatePendingForLocalGoal(goalId, (pending) =>
      pending.map((op) =>
        op.entity_type === "goal" &&
        op.type === "create" &&
        String(op.local_id) === String(goalId)
          ? { ...op, payload: { ...op.payload, ...normalizedPayload } }
          : op
      )
    );
  } else {
    const pending = await getPendingGoalOps();
    await setPendingGoalOps(
      appendPendingOp(pending, {
        entity_type: "goal",
        type: "update",
        entity_id: goalId,
        payload: normalizedPayload,
      })
    );
  }

  return { offline: true };
}

export async function depositToGoal({ token, goal, amount, subscriptionMode }) {
  assertGoalIsActive(goal);

  const depositAmount = toPositiveAmount(
    amount,
    "El monto a aportar debe ser mayor que cero"
  );

  assertGoalTargetAllowsDeposit(goal, depositAmount);

  if (goal.account_id) {
    const balances = await getCachedBalances();
    const available = Number(
      balances?.[String(goal.account_id)]?.available ?? 0
    );

    if (depositAmount > available) {
      throw new Error("Saldo insuficiente en la cuenta asociada");
    }
  }

  if (canUsePremiumBackend(subscriptionMode) && isOnline()) {
    try {
      await axios.post(
        `${api}/goals/${goal.id}/deposit`,
        { amount: depositAmount },
        authHeaders(token)
      );
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateGoalCache((current) =>
    current.map((item) =>
      String(item.id) === String(goal.id)
        ? {
            ...item,
            reserved_amount:
              Number(item.reserved_amount ?? 0) + Number(depositAmount),
            sync_status: String(item.id).startsWith("local-goal-")
              ? "pending_create"
              : "pending_update",
          }
        : item
    )
  );

  if (goal.account_id) {
    await mutateAccountBalance(goal.account_id, {
      reserved: Number(depositAmount),
      available: -Number(depositAmount),
    });
  }

  const pending = await getPendingGoalOps();
  await setPendingGoalOps(
    appendPendingOp(pending, {
      entity_type: "goal",
      type: "deposit",
      entity_id: String(goal.id).startsWith("local-goal-") ? null : goal.id,
      local_id: String(goal.id).startsWith("local-goal-") ? goal.id : null,
      payload: { amount: Number(depositAmount) },
    })
  );

  return { offline: true };
}

export async function withdrawFromGoal({
  token,
  goal,
  amount,
  subscriptionMode,
}) {
  assertGoalIsActive(goal);

  const withdrawAmount = toPositiveAmount(
    amount,
    "El monto a retirar debe ser mayor que cero"
  );

  assertReservedAmount(goal, withdrawAmount);

  if (canUsePremiumBackend(subscriptionMode) && isOnline()) {
    try {
      await axios.post(
        `${api}/goals/${goal.id}/withdraw`,
        { amount: withdrawAmount },
        authHeaders(token)
      );
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateGoalCache((current) =>
    current.map((item) =>
      String(item.id) === String(goal.id)
        ? {
            ...item,
            reserved_amount: Math.max(
              0,
              Number(item.reserved_amount ?? 0) - Number(withdrawAmount)
            ),
            sync_status: String(item.id).startsWith("local-goal-")
              ? "pending_create"
              : "pending_update",
          }
        : item
    )
  );

  if (goal.account_id) {
    await mutateAccountBalance(goal.account_id, {
      reserved: -Number(withdrawAmount),
      available: Number(withdrawAmount),
    });
  }

  const pending = await getPendingGoalOps();
  await setPendingGoalOps(
    appendPendingOp(pending, {
      entity_type: "goal",
      type: "withdraw",
      entity_id: String(goal.id).startsWith("local-goal-") ? null : goal.id,
      local_id: String(goal.id).startsWith("local-goal-") ? goal.id : null,
      payload: { amount: Number(withdrawAmount) },
    })
  );

  return { offline: true };
}

export async function completeGoalRecord({ token, goal, subscriptionMode }) {
  assertGoalIsActive(goal);

  if (canUsePremiumBackend(subscriptionMode) && isOnline()) {
    try {
      const res = await axios.post(
        `${api}/goals/${goal.id}/complete`,
        {},
        authHeaders(token)
      );
      return {
        offline: false,
        data: {
          released_amount: Number(res?.data?.data?.released_amount || 0),
        },
      };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const releasedAmount = Number(goal.reserved_amount ?? 0);

  await updateGoalCache((current) =>
    current.map((item) =>
      String(item.id) === String(goal.id)
        ? {
            ...item,
            reserved_amount: 0,
            status: "completed",
            sync_status: String(item.id).startsWith("local-goal-")
              ? "pending_create"
              : "pending_update",
          }
        : item
    )
  );

  if (goal.account_id && releasedAmount > 0) {
    await mutateAccountBalance(goal.account_id, {
      reserved: -releasedAmount,
      available: releasedAmount,
    });
  }

  const pending = await getPendingGoalOps();
  await setPendingGoalOps(
    appendPendingOp(pending, {
      entity_type: "goal",
      type: "complete",
      entity_id: String(goal.id).startsWith("local-goal-") ? null : goal.id,
      local_id: String(goal.id).startsWith("local-goal-") ? goal.id : null,
      payload: {},
    })
  );

  return {
    offline: true,
    data: { released_amount: releasedAmount },
  };
}

export async function deleteGoalRecord({ token, goal, subscriptionMode }) {
  assertGoalExists(goal);

  if (Number(goal.reserved_amount ?? 0) > 0) {
    throw new Error("No puedes eliminar una meta con monto reservado");
  }

  if (canUsePremiumBackend(subscriptionMode) && isOnline()) {
    try {
      await axios.delete(`${api}/goals/${goal.id}`, authHeaders(token));
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateGoalCache((current) =>
    current.filter((item) => String(item.id) !== String(goal.id))
  );

  const pending = await getPendingGoalOps();
  if (String(goal.id).startsWith("local-goal-")) {
    await setPendingGoalOps(
      pending.filter(
        (op) => String(op.local_id || op.entity_id) !== String(goal.id)
      )
    );
  } else {
    await setPendingGoalOps(
      appendPendingOp(
        pending.filter(
          (op) =>
            !(
              op.entity_type === "goal" &&
              String(op.entity_id) === String(goal.id) &&
              op.type !== "create"
            )
        ),
        {
          entity_type: "goal",
          type: "delete",
          entity_id: goal.id,
        }
      )
    );
  }

  return { offline: true };
}

export async function syncPendingGoals({ token, subscriptionMode }) {
  if (!canSyncRemote(subscriptionMode) || !isOnline()) {
    return { synced: 0 };
  }

  const pending = await getPendingGoalOps();
  if (!pending.length) {
    return { synced: 0 };
  }

  const remaining = [];
  const localIdMap = new Map();
  let synced = 0;

  for (const op of pending) {
    const resolvedGoalId =
      op.entity_id || (op.local_id ? localIdMap.get(op.local_id) : null);

    try {
      if (op.entity_type !== "goal") {
        remaining.push(op);
        continue;
      }

      if (op.type === "create") {
        const res = await axios.post(`${api}/goals`, op.payload, authHeaders(token));
        const remoteGoal = normalizeGoal(res.data.data);
        if (op.local_id) {
          localIdMap.set(op.local_id, remoteGoal.id);
        }
        synced += 1;
        continue;
      }

      if (!resolvedGoalId) {
        remaining.push(op);
        continue;
      }

      if (op.type === "update") {
        await axios.put(
          `${api}/goals/${resolvedGoalId}`,
          op.payload,
          authHeaders(token)
        );
      } else if (op.type === "deposit") {
        await axios.post(
          `${api}/goals/${resolvedGoalId}/deposit`,
          op.payload,
          authHeaders(token)
        );
      } else if (op.type === "withdraw") {
        await axios.post(
          `${api}/goals/${resolvedGoalId}/withdraw`,
          op.payload,
          authHeaders(token)
        );
      } else if (op.type === "complete") {
        await axios.post(
          `${api}/goals/${resolvedGoalId}/complete`,
          {},
          authHeaders(token)
        );
      } else if (op.type === "delete") {
        await axios.delete(`${api}/goals/${resolvedGoalId}`, authHeaders(token));
      }

      synced += 1;
    } catch {
      remaining.push(
        resolvedGoalId && !op.entity_id
          ? {
              ...op,
              entity_id: resolvedGoalId,
              local_id: null,
            }
          : op
      );
    }
  }

  await setPendingGoalOps(remaining);
  return { synced };
}
