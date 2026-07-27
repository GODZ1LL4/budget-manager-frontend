import {
  getActiveLocalUserId,
  removeItem,
  setActiveLocalUserId,
} from "./kvStore";
import {
  claimUnownedOfflineData,
  clearOfflineDomainData,
} from "./offlineDatabase";

const LOCAL_DATA_KEYS = [
  "bm_accounts_cache_v1",
  "bm_account_balances_cache_v1",
  "bm_accounts_pending_v1",
  "bm_budgets_cache_v1",
  "bm_categories_cache_v1",
  "bm_budgets_pending_v1",
  "bm_categories_pending_v1",
  "bm_transactions_cache_v1",
  "bm_transactions_pending_v1",
  "bm_items_cache_v1",
  "bm_items_pending_v1",
  "bm_taxes_cache_v1",
  "bm_item_price_history_v1",
  "transactions_cache_v2",
  "transactions_pending_v2",
];

export async function clearLocalUserData() {
  await Promise.all(LOCAL_DATA_KEYS.map((key) => removeItem(key)));
  await clearOfflineDomainData().catch(() => null);
}

export async function ensureLocalDataOwnedByUser(userId) {
  if (!userId) return { cleared: false };

  const activeUserId = await getActiveLocalUserId();

  if (activeUserId && String(activeUserId) !== String(userId)) {
    await setActiveLocalUserId(userId);
    return { switched: true, previousUserId: activeUserId };
  }

  await setActiveLocalUserId(userId);
  if (!activeUserId) {
    await claimUnownedOfflineData(userId).catch(() => null);
  }
  return { switched: false, previousUserId: activeUserId || null };
}
