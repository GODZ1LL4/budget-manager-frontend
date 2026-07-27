import axios from "axios";
import { getJson } from "../storage/kvStore";
import { getActiveLocalUserId } from "../storage/kvStore";
import {
  addPendingBudgetOp,
  getCachedBudgets,
  getCachedCategories,
  getPendingBudgetOps,
  setCachedBudgets,
  setCachedCategories,
  setPendingBudgetOps,
} from "../storage/budgetsLocalStore";
import {
  isSqliteReady,
  queryRows,
  runStatement,
} from "../storage/offlineSqlRepository";
import { isOfflineLikeError } from "./networkFallback";
import {
  canSyncRemote,
  canUsePremiumBackend,
} from "../subscription/subscriptionAccess";

const api = import.meta.env.VITE_API_URL;
const TRANSACTIONS_CACHE_KEY = "transactions_cache_v2";

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function matchesFilter(item, filterType, filterValue) {
  if (filterType === "month") return item.month === filterValue;
  if (filterType === "year") {
    return String(item.month || "").startsWith(`${filterValue}-`);
  }
  return true;
}

function getBudgetLimitValue(budget) {
  return Number(budget.limit ?? budget.limit_amount ?? 0);
}

function normalizeBudgetLimitValue(limitAmount) {
  const numericLimit = Number(limitAmount);
  if (!Number.isFinite(numericLimit) || numericLimit < 0) {
    throw new Error("Invalid budget limit");
  }
  return numericLimit;
}

function buildBudgetUpdatePayload(budget, limitAmount) {
  return {
    limit_amount: limitAmount,
    category_id: budget?.category_id || null,
    month: budget?.month || null,
  };
}

function isRecoverableBudgetUpdateError(error) {
  if (isOfflineLikeError(error)) {
    return true;
  }

  const status = Number(error?.response?.status || 0);

  // Render can briefly serve an older backend without this endpoint after deploys.
  // Keep the user's edit locally so it can sync once the route is available.
  return status === 404 || status === 405;
}

function shouldCountForBudget(tx) {
  return tx?.type === "expense" && tx?.category_id && tx?.date;
}

function getBudgetMonthFromDate(date) {
  return String(date || "").slice(0, 7);
}

function decorateBudgetWithCategory(budget, categories) {
  const matchedCategory = (categories || []).find(
    (category) => String(category.id) === String(budget.category_id)
  );

  return {
    ...budget,
    limit: getBudgetLimitValue(budget),
    category_name:
      matchedCategory?.name || budget.category_name || "Categoría",
  };
}

function normalizeTransaction(tx) {
  return {
    ...tx,
    amount: Number(tx?.amount ?? 0),
  };
}

function getMonthsForBudgetPayload(payload) {
  const baseMonth = String(payload.month || "");
  if (!payload.repeat) {
    return [baseMonth];
  }

  const [yearRaw, monthRaw] = baseMonth.split("-");
  const year = Number(yearRaw);
  const startMonth = Number(monthRaw);

  if (!year || !startMonth) {
    return [baseMonth];
  }

  const months = [];
  for (let month = startMonth; month <= 12; month += 1) {
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

async function getAvailableTransactionsSnapshot() {
  if (await isSqliteReady()) {
    const activeUserId = await getActiveLocalUserId();
    const rows = await queryRows(
      `SELECT payload_json
       FROM transactions
       WHERE user_id = ?
       ORDER BY date DESC, updated_at DESC`,
      [activeUserId || null]
    );

    return rows
      .map((row) => {
        try {
          return normalizeTransaction(JSON.parse(row.payload_json));
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  const cached = await getJson(TRANSACTIONS_CACHE_KEY, []);
  return Array.isArray(cached) ? cached.map(normalizeTransaction) : [];
}

function calculateBudgetSpent(categoryId, month, transactions) {
  return (transactions || []).reduce((total, tx) => {
    if (!shouldCountForBudget(tx)) return total;
    if (String(tx.category_id) !== String(categoryId)) return total;
    if (String(getBudgetMonthFromDate(tx.date)) !== String(month)) return total;
    return total + Number(tx.amount ?? 0);
  }, 0);
}

async function recalculateStoredBudgetSpends() {
  const transactions = await getAvailableTransactionsSnapshot();

  if (await isSqliteReady()) {
    const activeUserId = await getActiveLocalUserId();
    const rows = await queryRows(
      `SELECT id, category_id, month, payload_json
       FROM budgets
       WHERE user_id = ?`,
      [activeUserId || null]
    );

    for (const row of rows) {
      const spent = calculateBudgetSpent(row.category_id, row.month, transactions);
      let payload = null;

      try {
        payload = row.payload_json ? JSON.parse(row.payload_json) : null;
      } catch {
        payload = null;
      }

      const nextPayload = payload
        ? {
            ...payload,
            spent,
            limit: getBudgetLimitValue(payload),
          }
        : null;

      await runStatement(
        `UPDATE budgets
         SET spent = ?, payload_json = ?, updated_at = ?
         WHERE id = ?`,
        [
          spent,
          nextPayload ? JSON.stringify(nextPayload) : row.payload_json,
          new Date().toISOString(),
          String(row.id),
        ]
      );
    }

    return;
  }

  const budgets = await getCachedBudgets();
  await setCachedBudgets(
    budgets.map((budget) => ({
      ...budget,
      spent: calculateBudgetSpent(budget.category_id, budget.month, transactions),
      limit: getBudgetLimitValue(budget),
    }))
  );
}

async function listCategoriesFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT payload_json, id, name, type
     FROM categories
     WHERE user_id = ?
     ORDER BY updated_at DESC, name ASC`,
    [activeUserId || null]
  );

  return rows.map((row) => {
    try {
      return JSON.parse(row.payload_json);
    } catch {
      return {
        id: row.id,
        name: row.name,
        type: row.type,
      };
    }
  });
}

async function getAvailableCategoriesSnapshot() {
  if (await isSqliteReady()) {
    return listCategoriesFromSql();
  }

  return getCachedCategories();
}

async function saveBudgetsToSql(items) {
  const activeUserId = await getActiveLocalUserId();
  for (const budget of items) {
    await runStatement(
      `INSERT OR REPLACE INTO budgets
        (id, user_id, category_id, category_name, month, limit_amount, spent, repeat_flag, sync_status, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(budget.id),
        activeUserId || null,
        budget.category_id ? String(budget.category_id) : null,
        budget.category_name || null,
        budget.month || null,
        getBudgetLimitValue(budget),
        Number(budget.spent ?? 0),
        budget.repeat ? 1 : 0,
        budget.sync_status || null,
        JSON.stringify({
          ...budget,
          limit: getBudgetLimitValue(budget),
        }),
        new Date().toISOString(),
      ]
    );
  }
}

async function listBudgetsFromSql(filterType, filterValue) {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT payload_json
     FROM budgets
     WHERE user_id = ?
     ORDER BY month DESC, updated_at DESC`,
    [activeUserId || null]
  );

  return rows
    .map((row) => {
      try {
        return JSON.parse(row.payload_json);
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .filter((item) => matchesFilter(item, filterType, filterValue));
}

async function deleteBudgetFromSql(budgetId) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(`DELETE FROM budgets WHERE id = ? AND user_id = ?`, [
    String(budgetId),
    activeUserId || null,
  ]);
}

async function updateBudgetLimitInSql(budget, limitAmount, syncStatus) {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT payload_json
     FROM budgets
     WHERE id = ? AND user_id = ?`,
    [String(budget.id), activeUserId || null]
  );

  let payload = { ...budget };
  if (rows[0]?.payload_json) {
    try {
      payload = {
        ...payload,
        ...JSON.parse(rows[0].payload_json),
      };
    } catch {
      // Keep the budget object as the source of truth.
    }
  }

  const nextPayload = {
    ...payload,
    limit: limitAmount,
    limit_amount: limitAmount,
    sync_status: syncStatus || null,
  };

  await runStatement(
    `UPDATE budgets
     SET limit_amount = ?, sync_status = ?, payload_json = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      limitAmount,
      syncStatus || null,
      JSON.stringify(nextPayload),
      new Date().toISOString(),
      String(budget.id),
      activeUserId || null,
    ]
  );
}

async function updateBudgetLimitInFallback(budget, limitAmount, syncStatus) {
  const current = await getCachedBudgets();
  const next = current.map((item) =>
    String(item.id) === String(budget.id)
      ? {
          ...item,
          limit: limitAmount,
          limit_amount: limitAmount,
          sync_status: syncStatus || null,
        }
      : item
  );

  await setCachedBudgets(next);
}

async function updateStoredBudgetLimit(budget, limitAmount, syncStatus) {
  if (await isSqliteReady()) {
    await updateBudgetLimitInSql(budget, limitAmount, syncStatus);
  }

  await updateBudgetLimitInFallback(budget, limitAmount, syncStatus);
}

function mergeBudgetUpdateOperation(pending, budget, limitAmount) {
  const updatePayload = buildBudgetUpdatePayload(budget, limitAmount);

  if (String(budget.id).startsWith("local-")) {
    let merged = false;
    const nextPending = pending.map((op) => {
      if (op.type === "create" && String(op.localId) === String(budget.id)) {
        merged = true;
        return {
          ...op,
          payload: {
            ...op.payload,
            limit_amount: limitAmount,
          },
        };
      }

      return op;
    });

    if (merged) return nextPending;

    return [
      ...nextPending,
      {
        id: crypto.randomUUID(),
        type: "create",
        localId: budget.id,
        payload: {
          category_id: budget.category_id,
          month: budget.month,
          limit_amount: limitAmount,
          repeat: false,
        },
        created_at: new Date().toISOString(),
      },
    ];
  }

  const updateIndex = pending.findIndex(
    (op) => op.type === "update" && String(op.budgetId) === String(budget.id)
  );

  if (updateIndex >= 0) {
    return pending.map((op, index) =>
      index === updateIndex
        ? {
            ...op,
            payload: {
              ...op.payload,
              ...updatePayload,
            },
          }
        : op
    );
  }

  return [
    ...pending,
    {
      id: crypto.randomUUID(),
      type: "update",
      budgetId: budget.id,
      payload: updatePayload,
      created_at: new Date().toISOString(),
    },
  ];
}

async function setPendingBudgetUpdate(budget, limitAmount) {
  if (await isSqliteReady()) {
    const pending = await getPendingBudgetsFromSql();
    await setPendingBudgetsInSql(
      mergeBudgetUpdateOperation(pending, budget, limitAmount)
    );
    return;
  }

  const pending = await getPendingBudgetOps();
  await setPendingBudgetOps(
    mergeBudgetUpdateOperation(pending, budget, limitAmount)
  );
}

async function clearPendingBudgetUpdate(budgetId) {
  if (await isSqliteReady()) {
    const pending = await getPendingBudgetsFromSql();
    await setPendingBudgetsInSql(
      pending.filter(
        (op) =>
          !(op.type === "update" && String(op.budgetId) === String(budgetId))
      )
    );
    return;
  }

  const pending = await getPendingBudgetOps();
  await setPendingBudgetOps(
    pending.filter(
      (op) =>
        !(op.type === "update" && String(op.budgetId) === String(budgetId))
    )
  );
}

async function saveCategoriesToSql(items) {
  const activeUserId = await getActiveLocalUserId();
  for (const category of items) {
    await runStatement(
      `INSERT OR REPLACE INTO categories
        (id, user_id, name, type, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(category.id),
        activeUserId || null,
        category.name || "Categoria",
        category.type || null,
        JSON.stringify(category),
        new Date().toISOString(),
      ]
    );
  }
}

async function getPendingBudgetsFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT * FROM pending_ops
     WHERE entity_type = ?
       AND user_id = ?
     ORDER BY created_at ASC`,
    ["budget", activeUserId || null]
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.op_type,
    budgetId: row.entity_id,
    localId: row.local_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    created_at: row.created_at,
  }));
}

async function setPendingBudgetsInSql(items) {
  const activeUserId = await getActiveLocalUserId();

  await runStatement(`DELETE FROM pending_ops WHERE entity_type = ? AND user_id = ?`, [
    "budget",
    activeUserId || null,
  ]);

  for (const item of items) {
    await runStatement(
      `INSERT OR REPLACE INTO pending_ops
        (id, user_id, entity_type, op_type, entity_id, local_id, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(item.id || crypto.randomUUID()),
        activeUserId || null,
        "budget",
        item.type,
        item.budgetId ? String(item.budgetId) : null,
        item.localId ? String(item.localId) : null,
        JSON.stringify(item.payload ?? null),
        item.created_at || new Date().toISOString(),
      ]
    );
  }
}

async function updateBudgetSpentInSql(categoryId, month, delta) {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT * FROM budgets WHERE user_id = ? AND category_id = ? AND month = ?`,
    [activeUserId || null, String(categoryId), String(month)]
  );

  for (const row of rows) {
    let payload = null;
    try {
      payload = row.payload_json ? JSON.parse(row.payload_json) : null;
    } catch {
      payload = null;
    }

    const nextSpent = Number(row.spent ?? 0) + Number(delta ?? 0);
    const nextPayload = payload
      ? {
          ...payload,
          spent: nextSpent,
          limit: getBudgetLimitValue(payload),
        }
      : null;

    await runStatement(
      `UPDATE budgets
        SET spent = ?, payload_json = ?, updated_at = ?
        WHERE id = ?`,
      [
        nextSpent,
        nextPayload ? JSON.stringify(nextPayload) : row.payload_json,
        new Date().toISOString(),
        String(row.id),
      ]
    );
  }
}

async function updateBudgetSpentInFallback(categoryId, month, delta) {
  const budgets = await getCachedBudgets();
  const next = budgets.map((budget) => {
    if (
      String(budget.category_id) !== String(categoryId) ||
      String(budget.month) !== String(month)
    ) {
      return budget;
    }

    return {
      ...budget,
      spent: Number(budget.spent ?? 0) + Number(delta ?? 0),
      limit: getBudgetLimitValue(budget),
    };
  });

  await setCachedBudgets(next);
}

export async function applyBudgetEffectFromTransaction(tx, multiplier = 1) {
  if (!shouldCountForBudget(tx)) return;

  const month = getBudgetMonthFromDate(tx.date);
  const delta = Number(tx.amount ?? 0) * multiplier;

  if (await isSqliteReady()) {
    await updateBudgetSpentInSql(tx.category_id, month, delta);
    return;
  }

  await updateBudgetSpentInFallback(tx.category_id, month, delta);
}

export async function listBudgets({
  token,
  filterType,
  filterValue,
  subscriptionMode,
}) {
  await recalculateStoredBudgetSpends();
  const categories = await getAvailableCategoriesSnapshot();

  if (await isSqliteReady()) {
    const cached = await listBudgetsFromSql(filterType, filterValue);
    const decoratedCached = cached.map((item) =>
      decorateBudgetWithCategory(item, categories)
    );

    if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
      return { data: decoratedCached, source: "cache" };
    }

    try {
      const params = new URLSearchParams();
      if (filterType === "month") params.append("month", filterValue);
      else params.append("year", filterValue);

      const res = await axios.get(`${api}/budgets?${params.toString()}`, {
        headers: authHeaders(token),
      });

      const remoteData = (res.data.data || []).map((item) =>
        decorateBudgetWithCategory(item, categories)
      );
      await saveBudgetsToSql(remoteData);
      await setCachedBudgets(remoteData);

      return { data: remoteData, source: "remote" };
    } catch {
      return { data: decoratedCached, source: "cache" };
    }
  }

  const cachedBudgets = await getCachedBudgets();
  const cached = cachedBudgets
    .filter((item) => matchesFilter(item, filterType, filterValue))
    .map((item) => decorateBudgetWithCategory(item, categories));

  if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
    return { data: cached, source: "cache" };
  }

  try {
    const params = new URLSearchParams();
    if (filterType === "month") params.append("month", filterValue);
    else params.append("year", filterValue);

    const res = await axios.get(`${api}/budgets?${params.toString()}`, {
      headers: authHeaders(token),
    });

    const remoteData = (res.data.data || []).map((item) =>
      decorateBudgetWithCategory(item, categories)
    );
    await setCachedBudgets(remoteData);

    return { data: remoteData, source: "remote" };
  } catch {
    return { data: cached, source: "cache" };
  }
}

export async function listExpenseCategories({ token, subscriptionMode }) {
  const cached = await getCachedCategories();

  if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
    return {
      data: cached.filter((cat) => cat.type === "expense"),
      source: "cache",
    };
  }

  try {
    const res = await axios.get(`${api}/categories`, {
      headers: authHeaders(token),
    });

    const items = (res.data.data || []).filter((cat) => cat.type === "expense");
    await setCachedCategories(items);

    if (await isSqliteReady()) {
      await saveCategoriesToSql(items);
    }

    return { data: items, source: "remote" };
  } catch {
    return {
      data: cached.filter((cat) => cat.type === "expense"),
      source: "cache",
    };
  }
}

export async function createBudget({ token, payload, subscriptionMode }) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      const res = await axios.post(
        `${api}/budgets`,
        {
          category_id: payload.category_id,
          month: payload.month,
          limit_amount: payload.limit_amount,
          repeat: payload.repeat,
        },
        {
          headers: authHeaders(token),
        }
      );

      return { offline: false, data: res.data };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  {
    const categories = await getAvailableCategoriesSnapshot();
    const transactions = await getAvailableTransactionsSnapshot();
    const targetMonths = getMonthsForBudgetPayload(payload);
    const baseLimit = Number(payload.limit_amount ?? 0);
    const matchedCategory = categories.find(
      (category) => String(category.id) === String(payload.category_id)
    );
    const currentBudgets = await getCachedBudgets();
    const existingPairs = new Set(
      currentBudgets.map(
        (budget) => `${String(budget.category_id)}::${String(budget.month)}`
      )
    );

    const localItems = targetMonths
      .filter(
        (month) =>
          !existingPairs.has(`${String(payload.category_id)}::${String(month)}`)
      )
      .map((month) => ({
        id: `local-${crypto.randomUUID()}`,
        category_id: payload.category_id,
        category_name:
          matchedCategory?.name || payload.category_name || "Categoría",
        month,
        limit: baseLimit,
        spent: calculateBudgetSpent(payload.category_id, month, transactions),
        repeat: payload.repeat,
        sync_status: "pending_create",
      }));

    if (!localItems.length) {
      return { offline: true, data: null };
    }

    if (await isSqliteReady()) {
      await saveBudgetsToSql(localItems);
      const pending = await getPendingBudgetsFromSql();
      for (const localItem of localItems) {
        pending.push({
          id: crypto.randomUUID(),
          type: "create",
          localId: localItem.id,
          payload: {
            category_id: payload.category_id,
            month: localItem.month,
            limit_amount: payload.limit_amount,
            repeat: false,
          },
          created_at: new Date().toISOString(),
        });
      }
      await setPendingBudgetsInSql(pending);
    } else {
      await setCachedBudgets([...currentBudgets, ...localItems]);
      for (const localItem of localItems) {
        await addPendingBudgetOp({
          type: "create",
          localId: localItem.id,
          payload: {
            category_id: payload.category_id,
            month: localItem.month,
            limit_amount: payload.limit_amount,
            repeat: false,
          },
        });
      }
    }

    return {
      offline: true,
      data: payload.repeat ? localItems : localItems[0],
    };
  }
}

export async function deleteBudgetRecord({ token, budget, subscriptionMode }) {
  if (
    !String(budget.id).startsWith("local-") &&
    isOnline() &&
    canUsePremiumBackend(subscriptionMode)
  ) {
    try {
      await axios.delete(`${api}/budgets/${budget.id}`, {
        headers: authHeaders(token),
      });

      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  {
    if (await isSqliteReady()) {
      await deleteBudgetFromSql(budget.id);
      if (!String(budget.id).startsWith("local-")) {
        const pending = await getPendingBudgetsFromSql();
        pending.push({
          id: crypto.randomUUID(),
          type: "delete",
          budgetId: budget.id,
          created_at: new Date().toISOString(),
        });
        await setPendingBudgetsInSql(pending);
      } else {
        await setPendingBudgetsInSql(
          (await getPendingBudgetsFromSql()).filter(
            (op) =>
              !(op.type === "create" && String(op.localId) === String(budget.id))
          )
        );
      }
    } else {
      const current = (await getCachedBudgets()).filter(
        (item) => item.id !== budget.id
      );
      await setCachedBudgets(current);

      if (!String(budget.id).startsWith("local-")) {
        await addPendingBudgetOp({
          type: "delete",
          budgetId: budget.id,
        });
      }
    }

    return { offline: true };
  }
}

export async function updateBudgetRecord({
  token,
  budget,
  limitAmount,
  subscriptionMode,
}) {
  const numericLimit = normalizeBudgetLimitValue(limitAmount);
  const updatePayload = buildBudgetUpdatePayload(budget, numericLimit);

  if (
    !String(budget.id).startsWith("local-") &&
    isOnline() &&
    canUsePremiumBackend(subscriptionMode)
  ) {
    try {
      await axios.put(
        `${api}/budgets/${budget.id}`,
        updatePayload,
        { headers: authHeaders(token) }
      );

      await updateStoredBudgetLimit(budget, numericLimit, null);
      await clearPendingBudgetUpdate(budget.id);

      return { offline: false };
    } catch (error) {
      if (!isRecoverableBudgetUpdateError(error)) {
        throw error;
      }
    }
  }

  {
    const syncStatus = String(budget.id).startsWith("local-")
      ? "pending_create"
      : "pending_update";

    await updateStoredBudgetLimit(budget, numericLimit, syncStatus);
    await setPendingBudgetUpdate(budget, numericLimit);

    return { offline: true };
  }
}

export async function syncPendingBudgets({
  token,
  filterType,
  filterValue,
  subscriptionMode,
}) {
  if (!isOnline()) return { synced: 0 };
  if (!canSyncRemote(subscriptionMode)) {
    return { synced: 0, skipped: true };
  }

  const pending = (await isSqliteReady())
    ? await getPendingBudgetsFromSql()
    : await getPendingBudgetOps();

  if (!pending.length) return { synced: 0 };

  const remaining = [];

  for (const op of pending) {
    try {
      if (op.type === "create") {
        await axios.post(`${api}/budgets`, op.payload, {
          headers: authHeaders(token),
        });
      }

      if (op.type === "delete") {
        await axios.delete(`${api}/budgets/${op.budgetId}`, {
          headers: authHeaders(token),
        });
      }

      if (op.type === "update") {
        await axios.put(`${api}/budgets/${op.budgetId}`, op.payload, {
          headers: authHeaders(token),
        });
      }
    } catch {
      remaining.push(op);
    }
  }

  if (await isSqliteReady()) {
    await setPendingBudgetsInSql(remaining);
  } else {
    await setPendingBudgetOps(remaining);
  }

  const synced = pending.length - remaining.length;

  if (synced > 0 && filterType && filterValue) {
    await listBudgets({ token, filterType, filterValue, subscriptionMode });
  }

  return { synced };
}
