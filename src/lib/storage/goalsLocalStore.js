import { getJson, setJson } from "./kvStore";

const GOALS_KEY = "bm_goals_cache_v1";
const PENDING_KEY = "bm_goals_pending_v1";

export async function getCachedGoals() {
  return getJson(GOALS_KEY, []);
}

export async function setCachedGoals(items) {
  await setJson(GOALS_KEY, items);
}

export async function getPendingGoalOps() {
  return getJson(PENDING_KEY, []);
}

export async function setPendingGoalOps(items) {
  await setJson(PENDING_KEY, items);
}

export async function addPendingGoalOp(op) {
  const current = await getPendingGoalOps();
  current.push({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...op,
  });
  await setPendingGoalOps(current);
}
