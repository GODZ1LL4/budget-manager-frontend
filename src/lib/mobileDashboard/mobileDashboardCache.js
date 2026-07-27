import { getJson, setJson } from "../storage/kvStore";

const MOBILE_DASHBOARD_CACHE_KEY = "bm_mobile_dashboard_snapshot_v1";

export async function getCachedMobileDashboardSnapshot() {
  return getJson(MOBILE_DASHBOARD_CACHE_KEY, null);
}

export async function setCachedMobileDashboardSnapshot(snapshot) {
  await setJson(MOBILE_DASHBOARD_CACHE_KEY, snapshot);
}
