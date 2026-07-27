import axios from "axios";
import { getActiveLocalUserId, getJson, setJson } from "../storage/kvStore";
import {
  getCachedBalances,
  setCachedBalances,
} from "../storage/accountsLocalStore";
import {
  isSqliteReady,
  queryRows,
  runStatement,
} from "../storage/offlineSqlRepository";
import { applyBudgetEffectFromTransaction } from "./budgetsRepository";
import { listAccounts } from "./accountsRepository";
import { listCategories } from "./categoriesRepository";
import { listItems } from "./itemsRepository";
import { isOfflineLikeError } from "./networkFallback";
import {
  canSyncRemote,
  canUsePremiumBackend,
} from "../subscription/subscriptionAccess";
import { reconcileGoalReservationsForAccount } from "./goalsRepository";

const api = import.meta.env.VITE_API_URL;
const TRANSACTIONS_CACHE_KEY = "transactions_cache_v2";
const TRANSACTIONS_PENDING_KEY = "transactions_pending_v2";
let transactionsSyncPromise = null;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function normalizeTransaction(transaction) {
  return {
    ...transaction,
    id: transaction?.id ?? `local-${crypto.randomUUID()}`,
    amount: Number(transaction?.amount ?? 0),
    description: transaction?.description || "",
    sync_status: transaction?.sync_status || null,
  };
}

async function getCachedTransactions() {
  const items = await getJson(TRANSACTIONS_CACHE_KEY, []);
  return Array.isArray(items) ? items.map(normalizeTransaction) : [];
}

async function setCachedTransactions(items) {
  await setJson(
    TRANSACTIONS_CACHE_KEY,
    (items || []).map(normalizeTransaction)
  );
}

async function getPendingOps() {
  const items = await getJson(TRANSACTIONS_PENDING_KEY, []);
  return Array.isArray(items) ? items : [];
}

async function setPendingOps(items) {
  await setJson(TRANSACTIONS_PENDING_KEY, items || []);
}

async function readTransactionsFromSql() {
  if (!(await isSqliteReady())) {
    return [];
  }

  try {
    const activeUserId = await getActiveLocalUserId();
    const rows = await queryRows(
      `SELECT id, payload_json
       FROM transactions
       WHERE user_id = ?
       ORDER BY date DESC, updated_at DESC, id DESC`,
      [activeUserId || null]
    );

    return rows.map((row) => {
      try {
        return normalizeTransaction(JSON.parse(row.payload_json));
      } catch {
        return normalizeTransaction({ id: row.id });
      }
    });
  } catch {
    return [];
  }
}

async function readUsedCategoryIdsFromSql() {
  if (!(await isSqliteReady())) {
    return [];
  }

  try {
    const activeUserId = await getActiveLocalUserId();
    const rows = await queryRows(
      `SELECT DISTINCT category_id
       FROM transactions
       WHERE user_id = ?
         AND category_id IS NOT NULL
         AND category_id != ''`
      ,
      [activeUserId || null]
    );

    return rows
      .map((row) => row.category_id)
      .filter(Boolean)
      .map((id) => String(id));
  } catch {
    return [];
  }
}

async function writeTransactionsToSql(items) {
  if (!(await isSqliteReady())) {
    return;
  }

  const activeUserId = await getActiveLocalUserId();

  for (const item of items || []) {
    const tx = normalizeTransaction(item);
    await runStatement(
      `INSERT OR REPLACE INTO transactions
        (id, user_id, date, type, amount, account_id, category_id, sync_status, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(tx.id),
        activeUserId || null,
        tx.date || null,
        tx.type || null,
        Number(tx.amount || 0),
        tx.account_id ? String(tx.account_id) : null,
        tx.category_id ? String(tx.category_id) : null,
        tx.sync_status || null,
        JSON.stringify(tx),
        new Date().toISOString(),
      ]
    );
  }
}

async function replaceSqlTransactions(items) {
  if (!(await isSqliteReady())) {
    return;
  }

  const activeUserId = await getActiveLocalUserId();

  try {
    await runStatement(`DELETE FROM transactions WHERE user_id = ?`, [
      activeUserId || null,
    ]);
  } catch {
    return;
  }

  await writeTransactionsToSql(items);
}

async function deleteTransactionFromSql(id) {
  if (!(await isSqliteReady())) {
    return;
  }

  try {
    const activeUserId = await getActiveLocalUserId();
    await runStatement(`DELETE FROM transactions WHERE id = ? AND user_id = ?`, [
      String(id),
      activeUserId || null,
    ]);
  } catch {
    // ignore
  }
}

async function replaceLocalTransactionWithRemote(localId, remoteTransaction) {
  const current = await getCachedTransactions();
  const normalizedRemote = normalizeTransaction(remoteTransaction);
  const next = current.map((tx) =>
    String(tx.id) === String(localId) ? normalizedRemote : tx
  );

  await setCachedTransactions(next);
  await replaceSqlTransactions(next);
}

function buildTransactionPayload(transaction) {
  if (!transaction) return null;

  return {
    amount: Number(transaction.amount || 0),
    account_id: transaction.account_id || null,
    category_id: transaction.category_id || null,
    type: transaction.type || "expense",
    description: transaction.description?.trim() || "",
    date: transaction.date || null,
  };
}

function getTransactionBalanceOperations(transaction, multiplier = 1) {
  const amount = Number(transaction?.amount || 0) * multiplier;

  if (!amount) {
    return [];
  }

  if (transaction?.type === "income") {
    return transaction?.account_id
      ? [{ accountId: transaction.account_id, delta: amount }]
      : [];
  }

  if (transaction?.type === "expense") {
    return transaction?.account_id
      ? [{ accountId: transaction.account_id, delta: -amount }]
      : [];
  }

  if (transaction?.type === "transfer") {
    const fromAccountId =
      transaction?.account_from_id ?? transaction?.from_account_id ?? transaction?.account_id;
    const toAccountId =
      transaction?.account_to_id ?? transaction?.to_account_id;
    const operations = [];

    if (fromAccountId) {
      operations.push({ accountId: fromAccountId, delta: -amount });
    }

    if (toAccountId) {
      operations.push({ accountId: toAccountId, delta: amount });
    }

    return operations;
  }

  return [];
}

async function updateBalancesCache(accountId, delta) {
  if (!accountId || !delta) return;

  const balances = await getCachedBalances();
  const current = balances[String(accountId)] || {
    current: 0,
    reserved: 0,
    available: 0,
  };

  await setCachedBalances({
    ...balances,
    [String(accountId)]: {
      current: Number(current.current || 0) + delta,
      reserved: Number(current.reserved || 0),
      available: Number(current.available || 0) + delta,
    },
  });
}

async function updateBalancesSql(accountId, delta) {
  if (!accountId || !delta) return;
  if (!(await isSqliteReady())) return;

  try {
    await runStatement(
      `UPDATE accounts
       SET current = COALESCE(current, 0) + ?,
           available = COALESCE(available, 0) + ?
       WHERE id = ?`,
      [delta, delta, String(accountId)]
    );
  } catch {
    // ignore
  }
}

async function applyTransactionImpact(transaction, multiplier = 1) {
  const operations = getTransactionBalanceOperations(transaction, multiplier);

  for (const operation of operations) {
    await updateBalancesCache(operation.accountId, operation.delta);
    await updateBalancesSql(operation.accountId, operation.delta);
    if (operation.delta < 0) {
      await reconcileGoalReservationsForAccount(operation.accountId);
    }
  }
}

async function replaceTransactionImpact(previousTransaction, nextTransaction) {
  if (previousTransaction) {
    await applyTransactionImpact(previousTransaction, -1);
  }

  if (nextTransaction) {
    await applyTransactionImpact(nextTransaction, 1);
  }
}

async function applyBudgetTransactionImpact(transaction, multiplier = 1) {
  await applyBudgetEffectFromTransaction(transaction, multiplier);
}

async function replaceBudgetTransactionImpact(previousTransaction, nextTransaction) {
  if (previousTransaction) {
    await applyBudgetTransactionImpact(previousTransaction, -1);
  }

  if (nextTransaction) {
    await applyBudgetTransactionImpact(nextTransaction, 1);
  }
}

export async function listTransactions({ token, subscriptionMode }) {
  const cached = (await isSqliteReady())
    ? await readTransactionsFromSql()
    : await getCachedTransactions();

  if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/transactions`, {
      headers: authHeaders(token),
    });

    const items = (res.data.data || []).map(normalizeTransaction);
    await setCachedTransactions(items);
    await replaceSqlTransactions(items);

    return { data: items, source: "remote" };
  } catch (error) {
    if (!isOfflineLikeError(error)) {
      throw error;
    }

    return { data: cached, source: "cache" };
  }
}

export async function loadTransactionsDependencies({ token, subscriptionMode }) {
  if (!canUsePremiumBackend(subscriptionMode)) {
    const [accountsResult, categoriesResult, itemsResult] = await Promise.all([
      listAccounts({ token, subscriptionMode }),
      listCategories({ token, subscriptionMode }),
      listItems({ token, subscriptionMode }),
    ]);

    return {
      accounts: accountsResult.data || [],
      categories: categoriesResult.data || [],
      items: itemsResult.data || [],
      source: "cache",
    };
  }

  const [accountsResult, categoriesResult, itemsResult] = await Promise.all([
    listAccounts({ token, subscriptionMode }),
    listCategories({ token, subscriptionMode }),
    listItems({ token, subscriptionMode }),
  ]);

  return {
    accounts: accountsResult.data || [],
    categories: categoriesResult.data || [],
    items: itemsResult.data || [],
    source:
      accountsResult.source === "remote" ||
      categoriesResult.source === "remote" ||
      itemsResult.source === "remote"
        ? "remote"
        : "cache",
  };
}

export async function listUsedTransactionCategoryIds() {
  if (await isSqliteReady()) {
    return Array.from(new Set(await readUsedCategoryIdsFromSql()));
  }

  const cached = await getCachedTransactions();
  return Array.from(
    new Set(
      cached
        .map((tx) => tx.category_id || tx.categories?.id)
        .filter(Boolean)
        .map((id) => String(id))
    )
  );
}

export async function createTransaction({ token, payload, subscriptionMode }) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      const res = await axios.post(`${api}/transactions`, payload, {
        headers: authHeaders(token),
      });

      const created = normalizeTransaction(res.data.data || payload);
      const current = await getCachedTransactions();
      const next = [created, ...current.filter((tx) => String(tx.id) !== String(created.id))];
      await setCachedTransactions(next);
      await replaceSqlTransactions(next);
      await applyBudgetTransactionImpact(created, 1);

      return { offline: false, data: created };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  const created = normalizeTransaction({
    ...payload,
    id: `local-${crypto.randomUUID()}`,
    sync_status: "pending_create",
  });

  const current = await getCachedTransactions();
  const next = [created, ...current];
  await setCachedTransactions(next);
  await replaceSqlTransactions(next);
  await applyTransactionImpact(created, 1);
  await applyBudgetTransactionImpact(created, 1);

  const pending = await getPendingOps();
  pending.push({
    id: crypto.randomUUID(),
    type: "create",
    localId: created.id,
    payload,
    created_at: new Date().toISOString(),
  });
  await setPendingOps(pending);

  return { offline: true, data: created };
}

export async function updateTransaction({
  token,
  id,
  payload,
  subscriptionMode,
}) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      const res = await axios.put(`${api}/transactions/${id}`, payload, {
        headers: authHeaders(token),
      });

      const updated = normalizeTransaction({ ...(res.data.data || payload), id });
      const current = await getCachedTransactions();
      const previous = current.find((tx) => String(tx.id) === String(id));
      const next = current.map((tx) =>
        String(tx.id) === String(id) ? updated : tx
      );

      await setCachedTransactions(next);
      await replaceSqlTransactions(next);
      await replaceTransactionImpact(previous, updated);
      await replaceBudgetTransactionImpact(previous, updated);

      return { offline: false, data: updated };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  const current = await getCachedTransactions();
  const previous = current.find((tx) => String(tx.id) === String(id));
  const updated = normalizeTransaction({
    ...previous,
    ...payload,
    id,
    sync_status: String(id).startsWith("local-")
      ? "pending_create"
      : "pending_update",
  });

  const next = current.map((tx) => (String(tx.id) === String(id) ? updated : tx));
  await setCachedTransactions(next);
  await replaceSqlTransactions(next);
  await replaceTransactionImpact(previous, updated);
  await replaceBudgetTransactionImpact(previous, updated);

  let pending = await getPendingOps();

  if (String(id).startsWith("local-")) {
    pending = pending.map((op) =>
      op.type === "create" && String(op.localId) === String(id)
        ? { ...op, payload: { ...op.payload, ...payload } }
        : op
    );
  } else {
    pending.push({
      id: crypto.randomUUID(),
      type: "update",
      transactionId: id,
      payload,
      created_at: new Date().toISOString(),
    });
  }

  await setPendingOps(pending);

  return { offline: true, data: updated };
}

export async function deleteTransaction({
  token,
  transaction,
  subscriptionMode,
}) {
  const txId = transaction?.id;
  if (!txId) {
    throw new Error("Transaction id is required");
  }

  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      await axios.delete(`${api}/transactions/${txId}`, {
        headers: authHeaders(token),
      });

      const current = await getCachedTransactions();
      const next = current.filter((tx) => String(tx.id) !== String(txId));
      await setCachedTransactions(next);
      await replaceSqlTransactions(next);
      await applyTransactionImpact(transaction, -1);
      await applyBudgetTransactionImpact(transaction, -1);

      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  const current = await getCachedTransactions();
  const next = current.filter((tx) => String(tx.id) !== String(txId));
  await setCachedTransactions(next);
  await replaceSqlTransactions(next);
  await applyTransactionImpact(transaction, -1);
  await applyBudgetTransactionImpact(transaction, -1);

  let pending = await getPendingOps();

  if (String(txId).startsWith("local-")) {
    pending = pending.filter(
      (op) => !(op.type === "create" && String(op.localId) === String(txId))
    );
  } else {
    pending.push({
      id: crypto.randomUUID(),
      type: "delete",
      transactionId: txId,
      created_at: new Date().toISOString(),
    });
  }

  await setPendingOps(pending);
  await deleteTransactionFromSql(txId);

  return { offline: true };
}

export async function deleteTransactionRecord(args) {
  return deleteTransaction(args);
}

export async function syncPendingTransactions({ token, subscriptionMode }) {
  if (!isOnline()) {
    return { synced: 0 };
  }
  if (!canSyncRemote(subscriptionMode)) {
    return { synced: 0, skipped: true };
  }
  if (transactionsSyncPromise) {
    return transactionsSyncPromise;
  }

  transactionsSyncPromise = (async () => {
    const pending = await getPendingOps();
    if (!pending.length) {
      return { synced: 0 };
    }

    const remaining = [];

    for (const op of pending) {
      try {
        if (op.type === "create") {
          const currentTransactions = await getCachedTransactions();
          const localTransaction = op.localId
            ? currentTransactions.find(
                (tx) => String(tx.id) === String(op.localId)
              )
            : null;

          const payload = buildTransactionPayload(localTransaction) || op.payload;

          if (
            !payload?.account_id ||
            String(payload.account_id).startsWith("local-")
          ) {
            remaining.push(op);
            continue;
          }

          if (
            payload?.category_id &&
            String(payload.category_id).startsWith("local-")
          ) {
            remaining.push(op);
            continue;
          }

          const res = await axios.post(`${api}/transactions`, payload, {
            headers: authHeaders(token),
          });

          const remoteTransaction = res.data?.data || res.data;
          if (op.localId && remoteTransaction?.id) {
            await replaceLocalTransactionWithRemote(op.localId, remoteTransaction);
          }
        }

        if (op.type === "update") {
          await axios.put(`${api}/transactions/${op.transactionId}`, op.payload, {
            headers: authHeaders(token),
          });
        }

        if (op.type === "delete") {
          await axios.delete(`${api}/transactions/${op.transactionId}`, {
            headers: authHeaders(token),
          });
        }
      } catch {
        remaining.push(op);
      }
    }

    await setPendingOps(remaining);
    return { synced: pending.length - remaining.length };
  })();

  try {
    return await transactionsSyncPromise;
  } finally {
    transactionsSyncPromise = null;
  }
}
