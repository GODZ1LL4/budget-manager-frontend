import { getJson, setJson } from "./kvStore";

const ACCOUNTS_KEY = "bm_accounts_cache_v1";
const BALANCES_KEY = "bm_account_balances_cache_v1";
const PENDING_KEY = "bm_accounts_pending_v1";

export async function getCachedAccounts() {
  return getJson(ACCOUNTS_KEY, []);
}

export async function setCachedAccounts(items) {
  await setJson(ACCOUNTS_KEY, items);
}

export async function getCachedBalances() {
  return getJson(BALANCES_KEY, {});
}

export async function setCachedBalances(items) {
  await setJson(BALANCES_KEY, items);
}

export async function getPendingAccountOps() {
  return getJson(PENDING_KEY, []);
}

export async function setPendingAccountOps(items) {
  await setJson(PENDING_KEY, items);
}

export async function addPendingAccountOp(op) {
  const current = await getPendingAccountOps();
  current.push({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...op,
  });
  await setPendingAccountOps(current);
}
