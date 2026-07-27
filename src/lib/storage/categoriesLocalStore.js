import { getJson, setJson } from "./kvStore";

const PENDING_KEY = "bm_categories_pending_v1";

export async function getPendingCategoryOps() {
  return getJson(PENDING_KEY, []);
}

export async function setPendingCategoryOps(items) {
  await setJson(PENDING_KEY, items);
}

export async function addPendingCategoryOp(op) {
  const current = await getPendingCategoryOps();
  current.push({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...op,
  });
  await setPendingCategoryOps(current);
}
