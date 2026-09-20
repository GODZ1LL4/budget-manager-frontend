import { getJson, setJson } from "./kvStore";

const PROJECTS_KEY = "bm_projects_cache_v1";
const PENDING_KEY = "bm_projects_pending_v1";

export async function getCachedProjects() {
  return getJson(PROJECTS_KEY, []);
}

export async function setCachedProjects(items) {
  await setJson(PROJECTS_KEY, items);
}

export async function getPendingProjectOps() {
  return getJson(PENDING_KEY, []);
}

export async function setPendingProjectOps(items) {
  await setJson(PENDING_KEY, items);
}

export async function addPendingProjectOp(op) {
  const current = await getPendingProjectOps();
  current.push({
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
    ...op,
  });
  await setPendingProjectOps(current);
}
