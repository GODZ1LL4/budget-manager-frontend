import { getJson, setJson } from "./kvStore";

const TRANSACTIONS_KEY = "bm_transactions_cache_v1";
const ITEMS_KEY = "bm_items_cache_v1";
const PENDING_KEY = "bm_transactions_pending_v1";

export async function getCachedTransactions() {
  return getJson(TRANSACTIONS_KEY, []);
}

export async function setCachedTransactions(items) {
  await setJson(TRANSACTIONS_KEY, items);
}

export async function getCachedItems() {
  return getJson(ITEMS_KEY, []);
}

export async function setCachedItems(items) {
  await setJson(ITEMS_KEY, items);
}

export async function getPendingTransactionOps() {
  return getJson(PENDING_KEY, []);
}

export async function setPendingTransactionOps(items) {
  await setJson(PENDING_KEY, items);
}

export async function addPendingTransactionOp(op) {
  const current = await getPendingTransactionOps();
  current.push({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...op,
  });
  await setPendingTransactionOps(current);
}
