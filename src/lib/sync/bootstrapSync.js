import { syncPendingBudgets } from "../repositories/budgetsRepository";
import { syncPendingAccounts } from "../repositories/accountsRepository";
import { syncPendingCategories } from "../repositories/categoriesRepository";
import { syncPendingGoals } from "../repositories/goalsRepository";
import { syncPendingItems } from "../repositories/itemsRepository";
import { syncPendingTransactions } from "../repositories/transactionsRepository";

export async function runBootstrapSync(token, subscriptionMode) {
  if (!token) return { synced: 0 };

  const steps = [
    () => syncPendingAccounts({ token, subscriptionMode }),
    () => syncPendingCategories({ token, subscriptionMode }),
    () => syncPendingBudgets({ token, subscriptionMode }),
    () => syncPendingItems({ token, subscriptionMode }),
    () => syncPendingTransactions({ token, subscriptionMode }),
    () => syncPendingGoals({ token, subscriptionMode }),
  ];

  let synced = 0;

  for (const step of steps) {
    try {
      const result = await step();
      synced += result?.synced || 0;
    } catch {
      // Let the remaining sync stages try to continue with whatever is available.
    }
  }

  return { synced };
}
