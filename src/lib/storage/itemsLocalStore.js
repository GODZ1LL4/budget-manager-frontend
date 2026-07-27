import { getJson, setJson } from "./kvStore";

const TAXES_KEY = "bm_taxes_cache_v1";
const PRICE_HISTORY_KEY = "bm_item_price_history_v1";
const PENDING_KEY = "bm_items_pending_v1";

export async function getCachedTaxes() {
  return getJson(TAXES_KEY, []);
}

export async function setCachedTaxes(items) {
  await setJson(TAXES_KEY, items);
}

export async function getCachedPriceHistory() {
  return getJson(PRICE_HISTORY_KEY, {});
}

export async function setCachedPriceHistory(items) {
  await setJson(PRICE_HISTORY_KEY, items);
}

export async function getPendingItemOps() {
  return getJson(PENDING_KEY, []);
}

export async function setPendingItemOps(items) {
  await setJson(PENDING_KEY, items);
}

export async function addPendingItemOp(op) {
  const current = await getPendingItemOps();
  current.push({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...op,
  });
  await setPendingItemOps(current);
}
