import axios from "axios";
import { getActiveLocalUserId, getJson, setJson } from "../storage/kvStore";
import {
  addPendingAccountOp,
  getCachedAccounts,
  getCachedBalances,
  getPendingAccountOps,
  setCachedAccounts,
  setCachedBalances,
  setPendingAccountOps,
} from "../storage/accountsLocalStore";
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
import { reconcileGoalReservationsForAccount } from "./goalsRepository";

const api = import.meta.env.VITE_API_URL;
const TRANSACTIONS_CACHE_KEY = "transactions_cache_v2";
let accountsSyncPromise = null;
const TRANSACTIONS_PENDING_KEY = "transactions_pending_v2";

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function toBalancesMap(items) {
  const map = {};
  for (const a of items || []) {
    map[a.id] = {
      current: Number(a.current_balance ?? a.current ?? 0),
      reserved: Number(a.reserved_total ?? a.reserved ?? 0),
      available: Number(a.available_balance ?? a.available ?? 0),
    };
  }
  return map;
}

function normalizeBalanceEntry(balance = {}) {
  return {
    current: Number(balance.current ?? 0),
    reserved: Number(balance.reserved ?? 0),
    available: Number(balance.available ?? 0),
  };
}

function mergeSyncedAccount(items, localId, remoteAccount) {
  const filtered = (items || []).filter(
    (account) =>
      String(account.id) !== String(localId) &&
      String(account.id) !== String(remoteAccount.id)
  );

  return [{ ...remoteAccount }, ...filtered];
}

function moveBalanceEntry(balances, localId, remoteId) {
  const next = { ...(balances || {}) };
  const localBalance = normalizeBalanceEntry(next[String(localId)]);
  const remoteBalance = normalizeBalanceEntry(next[String(remoteId)]);

  next[String(remoteId)] = {
    current: remoteBalance.current || localBalance.current,
    reserved: remoteBalance.reserved || localBalance.reserved,
    available: remoteBalance.available || localBalance.available,
  };

  delete next[String(localId)];
  return next;
}

async function saveAccountsToSql(accounts, balances = {}) {
  const activeUserId = await getActiveLocalUserId();

  for (const account of accounts) {
    const bal = balances[account.id] || {};
    await runStatement(
      `INSERT OR REPLACE INTO accounts
        (id, user_id, name, current, reserved, available, sync_status, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(account.id),
        activeUserId || null,
        account.name || "Cuenta",
        Number(bal.current ?? account.current ?? 0),
        Number(bal.reserved ?? account.reserved ?? 0),
        Number(bal.available ?? account.available ?? 0),
        account.sync_status || null,
        JSON.stringify(account),
        new Date().toISOString(),
      ]
    );
  }
}

async function listAccountsFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT id, name, current, reserved, available, sync_status, payload_json
     FROM accounts
     WHERE user_id = ?
     ORDER BY updated_at DESC, name ASC`,
    [activeUserId || null]
  );

  return rows.map((row) => {
    try {
      return {
        ...JSON.parse(row.payload_json),
        id: row.id,
        name: row.name,
        sync_status: row.sync_status,
      };
    } catch {
      return {
        id: row.id,
        name: row.name,
        sync_status: row.sync_status,
      };
    }
  });
}

async function listBalancesFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT id, current, reserved, available
     FROM accounts
     WHERE user_id = ?
     ORDER BY name ASC`,
    [activeUserId || null]
  );

  const map = {};
  for (const row of rows) {
    map[row.id] = {
      current: Number(row.current ?? 0),
      reserved: Number(row.reserved ?? 0),
      available: Number(row.available ?? 0),
    };
  }
  return map;
}

async function deleteAccountFromSql(accountId) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(`DELETE FROM accounts WHERE id = ? AND user_id = ?`, [
    String(accountId),
    activeUserId || null,
  ]);
}

async function applyTransferToCachedBalances(fromAccountId, toAccountId, amount) {
  const balances = await getCachedBalances();
  const fromKey = String(fromAccountId);
  const toKey = String(toAccountId);
  const fromBalance = normalizeBalanceEntry(balances[fromKey]);
  const toBalance = normalizeBalanceEntry(balances[toKey]);

  await setCachedBalances({
    ...balances,
    [fromKey]: {
      ...fromBalance,
      current: fromBalance.current - amount,
      available: fromBalance.available - amount,
    },
    [toKey]: {
      ...toBalance,
      current: toBalance.current + amount,
      available: toBalance.available + amount,
    },
  });
}

async function applyTransferToSqlBalances(fromAccountId, toAccountId, amount) {
  await runStatement(
    `UPDATE accounts
     SET current = COALESCE(current, 0) - ?,
         available = COALESCE(available, 0) - ?
     WHERE id = ?`,
    [amount, amount, String(fromAccountId)]
  );

  await runStatement(
    `UPDATE accounts
     SET current = COALESCE(current, 0) + ?,
         available = COALESCE(available, 0) + ?
     WHERE id = ?`,
    [amount, amount, String(toAccountId)]
  );
}

function remapTransactionAccountReference(transaction, localId, remoteAccount) {
  const next = { ...transaction };
  const remoteRef = {
    id: remoteAccount.id,
    name: remoteAccount.name,
  };

  if (String(next.account_id) === String(localId)) {
    next.account_id = remoteAccount.id;
    next.account_name = remoteAccount.name;
  }

  if (String(next.account_from_id) === String(localId)) {
    next.account_from_id = remoteAccount.id;
    next.account_from = remoteRef;
  }

  if (String(next.from_account_id) === String(localId)) {
    next.from_account_id = remoteAccount.id;
    next.account_from = remoteRef;
  }

  if (String(next.account_to_id) === String(localId)) {
    next.account_to_id = remoteAccount.id;
    next.account_to = remoteRef;
  }

  if (String(next.to_account_id) === String(localId)) {
    next.to_account_id = remoteAccount.id;
    next.account_to = remoteRef;
  }

  if (next.account?.id && String(next.account.id) === String(localId)) {
    next.account = remoteRef;
  }

  return next;
}

async function remapTransactionsForSyncedAccount(localId, remoteAccount) {
  const cachedTransactions = await getJson(TRANSACTIONS_CACHE_KEY, []);

  if (Array.isArray(cachedTransactions)) {
    await setJson(
      TRANSACTIONS_CACHE_KEY,
      cachedTransactions.map((transaction) =>
        remapTransactionAccountReference(transaction, localId, remoteAccount)
      )
    );
  }

  if (!(await isSqliteReady())) {
    return;
  }

  try {
    const rows = await queryRows(
      `SELECT id, payload_json
       FROM transactions
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [await getActiveLocalUserId()]
    );

    for (const row of rows) {
      const parsed = row.payload_json ? JSON.parse(row.payload_json) : {};
      const nextTransaction = remapTransactionAccountReference(
        parsed,
        localId,
        remoteAccount
      );
      const accountId =
        nextTransaction.account_id ?? nextTransaction.account_from_id ?? null;

      await runStatement(
        `UPDATE transactions
         SET account_id = ?, payload_json = ?, updated_at = ?
         WHERE id = ?`,
        [
          accountId ? String(accountId) : null,
          JSON.stringify(nextTransaction),
          new Date().toISOString(),
          String(row.id),
        ]
      );
    }
  } catch {
    // ignore
  }
}

function remapPendingTransactionOp(op, localId, remoteAccount) {
  if (!op || !op.payload) {
    return op;
  }

  const next = {
    ...op,
    payload: { ...op.payload },
  };

  if (String(next.payload.account_id) === String(localId)) {
    next.payload.account_id = remoteAccount.id;
  }

  if (String(next.payload.account_from_id) === String(localId)) {
    next.payload.account_from_id = remoteAccount.id;
  }

  if (String(next.payload.from_account_id) === String(localId)) {
    next.payload.from_account_id = remoteAccount.id;
  }

  if (String(next.payload.account_to_id) === String(localId)) {
    next.payload.account_to_id = remoteAccount.id;
  }

  if (String(next.payload.to_account_id) === String(localId)) {
    next.payload.to_account_id = remoteAccount.id;
  }

  return next;
}

async function remapPendingTransactionsForSyncedAccount(localId, remoteAccount) {
  const pendingTransactions = await getJson(TRANSACTIONS_PENDING_KEY, []);

  if (!Array.isArray(pendingTransactions)) {
    return;
  }

  await setJson(
    TRANSACTIONS_PENDING_KEY,
    pendingTransactions.map((op) =>
      remapPendingTransactionOp(op, localId, remoteAccount)
    )
  );
}

async function reconcileSyncedCreatedAccount(localId, remoteAccount) {
  const cachedAccounts = await getCachedAccounts();
  const cachedBalances = await getCachedBalances();

  await setCachedAccounts(mergeSyncedAccount(cachedAccounts, localId, remoteAccount));
  await setCachedBalances(
    moveBalanceEntry(cachedBalances, localId, remoteAccount.id)
  );

  await remapTransactionsForSyncedAccount(localId, remoteAccount);
  await remapPendingTransactionsForSyncedAccount(localId, remoteAccount);

  if (!(await isSqliteReady())) {
    return;
  }

  const sqlAccounts = await listAccountsFromSql();
  const sqlBalances = await listBalancesFromSql();
  const nextAccounts = mergeSyncedAccount(sqlAccounts, localId, remoteAccount);
  const nextBalances = moveBalanceEntry(sqlBalances, localId, remoteAccount.id);

  await deleteAccountFromSql(localId);
  await saveAccountsToSql(nextAccounts, nextBalances);
}

async function findRemoteAccountByName(token, name) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return null;

  const res = await axios.get(`${api}/accounts`, {
    headers: authHeaders(token),
  });

  const items = res.data.data || [];
  return (
    items.find(
      (account) => String(account.name || "").trim().toLowerCase() === target
    ) || null
  );
}

async function appendOfflineTransferTransaction(transferPayload) {
  const accountSources = (await isSqliteReady())
    ? await listAccountsFromSql()
    : await getCachedAccounts();

  const fromAccount = accountSources.find(
    (account) =>
      String(account.id) === String(transferPayload.from_account_id)
  );
  const toAccount = accountSources.find(
    (account) => String(account.id) === String(transferPayload.to_account_id)
  );

  const transferTransaction = {
    id: `local-transfer-${crypto.randomUUID()}`,
    type: "transfer",
    amount: Number(transferPayload.amount ?? 0),
    description: transferPayload.description || "",
    date: transferPayload.date,
    account_id: transferPayload.from_account_id,
    account_from_id: transferPayload.from_account_id,
    account_to_id: transferPayload.to_account_id,
    account_from: fromAccount
      ? { id: fromAccount.id, name: fromAccount.name }
      : null,
    account_to: toAccount ? { id: toAccount.id, name: toAccount.name } : null,
    sync_status: "pending_transfer",
  };

  const cachedTransactions = await getJson(TRANSACTIONS_CACHE_KEY, []);
  const nextTransactions = [
    transferTransaction,
    ...(Array.isArray(cachedTransactions) ? cachedTransactions : []),
  ];
  await setJson(TRANSACTIONS_CACHE_KEY, nextTransactions);

  if (await isSqliteReady()) {
    await runStatement(
      `INSERT OR REPLACE INTO transactions
        (id, date, type, amount, account_id, category_id, sync_status, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(transferTransaction.id),
        transferTransaction.date || null,
        transferTransaction.type,
        transferTransaction.amount,
        transferTransaction.account_id
          ? String(transferTransaction.account_id)
          : null,
        null,
        transferTransaction.sync_status,
        JSON.stringify(transferTransaction),
        new Date().toISOString(),
      ]
    );
  }
}

async function getPendingAccountsFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT * FROM pending_ops
     WHERE entity_type = ?
       AND user_id = ?
     ORDER BY created_at ASC`,
    ["account", activeUserId || null]
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.op_type,
    accountId: row.entity_id,
    localId: row.local_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    created_at: row.created_at,
  }));
}

async function setPendingAccountsInSql(items) {
  const activeUserId = await getActiveLocalUserId();

  await runStatement(`DELETE FROM pending_ops WHERE entity_type = ? AND user_id = ?`, [
    "account",
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
        "account",
        item.type,
        item.accountId ? String(item.accountId) : null,
        item.localId ? String(item.localId) : null,
        JSON.stringify(item.payload ?? null),
        item.created_at || new Date().toISOString(),
      ]
    );
  }
}

export async function listAccounts({ token, subscriptionMode }) {
  if (await isSqliteReady()) {
    const cached = await listAccountsFromSql();

    if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
      return { data: cached, source: "cache" };
    }

    try {
      const res = await axios.get(`${api}/accounts`, {
        headers: authHeaders(token),
      });

      const items = res.data.data || [];
      await saveAccountsToSql(items);
      await setCachedAccounts(items);

      return { data: items, source: "remote" };
    } catch {
      return { data: cached, source: "cache" };
    }
  }

  const cached = await getCachedAccounts();

  if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/accounts`, {
      headers: authHeaders(token),
    });

    const items = res.data.data || [];
    await setCachedAccounts(items);

    return { data: items, source: "remote" };
  } catch {
    return { data: cached, source: "cache" };
  }
}

export async function listAccountBalances({ token, subscriptionMode }) {
  if (await isSqliteReady()) {
    const cached = await listBalancesFromSql();

    if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
      return { data: cached, source: "cache" };
    }

    try {
      const res = await axios.get(`${api}/accounts/balances`, {
        headers: authHeaders(token),
      });

      const remoteItems = res.data.data || [];
      const map = toBalancesMap(remoteItems);
      const accounts = await listAccountsFromSql();
      await saveAccountsToSql(accounts, map);
      await setCachedBalances(map);

      return { data: map, source: "remote" };
    } catch {
      return { data: cached, source: "cache" };
    }
  }

  const cached = await getCachedBalances();

  if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/accounts/balances`, {
      headers: authHeaders(token),
    });

    const map = toBalancesMap(res.data.data || []);
    await setCachedBalances(map);

    return { data: map, source: "remote" };
  } catch {
    return { data: cached, source: "cache" };
  }
}

export async function createAccount({ token, name, subscriptionMode }) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      const res = await axios.post(
        `${api}/accounts`,
        { name },
        { headers: authHeaders(token) }
      );

      return { offline: false, data: res.data };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  const localItem = {
    id: `local-${crypto.randomUUID()}`,
    name,
    sync_status: "pending_create",
  };

  if (await isSqliteReady()) {
    await saveAccountsToSql([localItem], {
      [localItem.id]: { current: 0, reserved: 0, available: 0 },
    });
    const pending = await getPendingAccountsFromSql();
    pending.push({
      id: crypto.randomUUID(),
      type: "create",
      localId: localItem.id,
      payload: { name },
      created_at: new Date().toISOString(),
    });
    await setPendingAccountsInSql(pending);
  } else {
    await setCachedAccounts([...(await getCachedAccounts()), localItem]);
    await setCachedBalances({
      ...(await getCachedBalances()),
      [localItem.id]: { current: 0, reserved: 0, available: 0 },
    });
    await addPendingAccountOp({
      type: "create",
      localId: localItem.id,
      payload: { name },
    });
  }

  return { offline: true, data: localItem };
}

export async function updateAccount({ token, id, name, subscriptionMode }) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      await axios.put(
        `${api}/accounts/${id}`,
        { name },
        { headers: authHeaders(token) }
      );

      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  if (await isSqliteReady()) {
    const currentAccounts = await listAccountsFromSql();
    const updated = currentAccounts.map((account) =>
      String(account.id) === String(id)
        ? { ...account, name, sync_status: "pending_update" }
        : account
    );
    const balances = await listBalancesFromSql();
    await saveAccountsToSql(updated, balances);

    if (!String(id).startsWith("local-")) {
      const pending = await getPendingAccountsFromSql();
      pending.push({
        id: crypto.randomUUID(),
        type: "update",
        accountId: id,
        payload: { name },
        created_at: new Date().toISOString(),
      });
      await setPendingAccountsInSql(pending);
    } else {
      const pending = (await getPendingAccountsFromSql()).map((op) =>
        op.type === "create" && String(op.localId) === String(id)
          ? { ...op, payload: { name } }
          : op
      );
      await setPendingAccountsInSql(pending);
    }
  } else {
    const updatedAccounts = (await getCachedAccounts()).map((account) =>
      String(account.id) === String(id)
        ? { ...account, name, sync_status: "pending_update" }
        : account
    );
    await setCachedAccounts(updatedAccounts);

    if (!String(id).startsWith("local-")) {
      await addPendingAccountOp({
        type: "update",
        accountId: id,
        payload: { name },
      });
    } else {
      const pending = (await getPendingAccountOps()).map((op) =>
        op.type === "create" && String(op.localId) === String(id)
          ? { ...op, payload: { name } }
          : op
      );
      await setPendingAccountOps(pending);
    }
  }

  return { offline: true };
}

export async function deleteAccount({ token, account, subscriptionMode }) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      await axios.delete(`${api}/accounts/${account.id}`, {
        headers: authHeaders(token),
      });

      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  if (await isSqliteReady()) {
    await deleteAccountFromSql(account.id);
    if (!String(account.id).startsWith("local-")) {
      const pending = await getPendingAccountsFromSql();
      pending.push({
        id: crypto.randomUUID(),
        type: "delete",
        accountId: account.id,
        created_at: new Date().toISOString(),
      });
      await setPendingAccountsInSql(pending);
    } else {
      await setPendingAccountsInSql(
        (await getPendingAccountsFromSql()).filter(
          (op) =>
            !(op.type === "create" && String(op.localId) === String(account.id))
        )
      );
    }
  } else {
    await setCachedAccounts(
      (await getCachedAccounts()).filter(
        (item) => String(item.id) !== String(account.id)
      )
    );

    const nextBalances = { ...(await getCachedBalances()) };
    delete nextBalances[account.id];
    await setCachedBalances(nextBalances);

    if (!String(account.id).startsWith("local-")) {
      await addPendingAccountOp({
        type: "delete",
        accountId: account.id,
      });
    } else {
      await setPendingAccountOps(
        (await getPendingAccountOps()).filter(
          (op) =>
            !(op.type === "create" && String(op.localId) === String(account.id))
        )
      );
    }
  }

  return { offline: true };
}

export async function createTransfer({ token, payload, subscriptionMode }) {
  if (canUsePremiumBackend(subscriptionMode)) {
    try {
      const res = await axios.post(`${api}/accounts/transfer`, payload, {
        headers: authHeaders(token),
      });

      return { offline: false, data: res.data };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  const amount = Number(payload?.amount ?? 0);
  if (!payload?.from_account_id || !payload?.to_account_id || amount <= 0) {
    const offlineError = new Error("Datos invalidos para la transferencia.");
    offlineError.code = "OFFLINE_TRANSFER_INVALID";
    throw offlineError;
  }

  if (await isSqliteReady()) {
    await applyTransferToCachedBalances(
      payload.from_account_id,
      payload.to_account_id,
      amount
    );
    await applyTransferToSqlBalances(
      payload.from_account_id,
      payload.to_account_id,
      amount
    );

    const pending = await getPendingAccountsFromSql();
    pending.push({
      id: crypto.randomUUID(),
      type: "transfer",
      payload: {
        from_account_id: payload.from_account_id,
        to_account_id: payload.to_account_id,
        amount,
        date: payload.date,
        description: payload.description ?? null,
      },
      created_at: new Date().toISOString(),
    });
    await setPendingAccountsInSql(pending);
  } else {
    await applyTransferToCachedBalances(
      payload.from_account_id,
      payload.to_account_id,
      amount
    );

    await addPendingAccountOp({
      type: "transfer",
      payload: {
        from_account_id: payload.from_account_id,
        to_account_id: payload.to_account_id,
        amount,
        date: payload.date,
        description: payload.description ?? null,
      },
    });
  }

  await reconcileGoalReservationsForAccount(payload.from_account_id);

  await appendOfflineTransferTransaction({
    from_account_id: payload.from_account_id,
    to_account_id: payload.to_account_id,
    amount,
    date: payload.date,
    description: payload.description ?? null,
  });

  return {
    offline: true,
    data: {
      ...payload,
      amount,
      sync_status: "pending_transfer",
    },
  };
}

export async function syncPendingAccounts({ token, subscriptionMode }) {
  if (!isOnline()) return { synced: 0 };
  if (!canSyncRemote(subscriptionMode)) {
    return { synced: 0, skipped: true };
  }
  if (accountsSyncPromise) return accountsSyncPromise;

  accountsSyncPromise = (async () => {
    const pending = (await isSqliteReady())
      ? await getPendingAccountsFromSql()
      : await getPendingAccountOps();

    if (!pending.length) return { synced: 0 };

    const remaining = [];

    for (const op of pending) {
      try {
        if (op.type === "create") {
          let remoteAccount = null;

          try {
            remoteAccount = await findRemoteAccountByName(token, op.payload?.name);
          } catch {
            remoteAccount = null;
          }

          if (!remoteAccount) {
            const res = await axios.post(`${api}/accounts`, op.payload, {
              headers: authHeaders(token),
            });
            remoteAccount = res.data?.data || res.data;
          }

          if (op.localId && remoteAccount?.id) {
            await reconcileSyncedCreatedAccount(op.localId, remoteAccount);
          }
        }

        if (op.type === "update") {
          await axios.put(`${api}/accounts/${op.accountId}`, op.payload, {
            headers: authHeaders(token),
          });
        }

        if (op.type === "delete") {
          await axios.delete(`${api}/accounts/${op.accountId}`, {
            headers: authHeaders(token),
          });
        }

        if (op.type === "transfer") {
          await axios.post(`${api}/accounts/transfer`, op.payload, {
            headers: authHeaders(token),
          });
        }
      } catch {
        remaining.push(op);
      }
    }

    if (await isSqliteReady()) {
      await setPendingAccountsInSql(remaining);
    } else {
      await setPendingAccountOps(remaining);
    }

    return { synced: pending.length - remaining.length };
  })();

  try {
    return await accountsSyncPromise;
  } finally {
    accountsSyncPromise = null;
  }
}
