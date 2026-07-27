import { getJson, setJson } from "./kvStore";

const BUDGETS_KEY = "bm_budgets_cache_v1";
const CATEGORIES_KEY = "bm_categories_cache_v1";
const PENDING_KEY = "bm_budgets_pending_v1";

export async function getCachedBudgets() {
  return getJson(BUDGETS_KEY, []);
}

export async function setCachedBudgets(items) {
  await setJson(BUDGETS_KEY, items);
}

export async function getCachedCategories() {
  return getJson(CATEGORIES_KEY, []);
}

export async function setCachedCategories(items) {
  await setJson(CATEGORIES_KEY, items);
}

export async function getPendingBudgetOps() {
  return getJson(PENDING_KEY, []);
}

export async function setPendingBudgetOps(items) {
  await setJson(PENDING_KEY, items);
}

export async function addPendingBudgetOp(op) {
  const current = await getPendingBudgetOps();
  current.push({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...op,
  });
  await setPendingBudgetOps(current);
}
