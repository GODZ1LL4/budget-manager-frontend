import axios from "axios";
import { getActiveLocalUserId, getJson, setJson } from "../storage/kvStore";
import {
  getCachedCategories,
  setCachedCategories,
} from "../storage/budgetsLocalStore";
import {
  addPendingCategoryOp,
  getPendingCategoryOps,
  setPendingCategoryOps,
} from "../storage/categoriesLocalStore";
import {
  isSqliteReady,
  queryRows,
  runStatement,
} from "../storage/offlineSqlRepository";
import { isOfflineLikeError } from "./networkFallback";
import {
  canSyncRemote,
  canUsePremiumBackend,
} from "../subscription/subscriptionAccess";

const api = import.meta.env.VITE_API_URL;
const TRANSACTIONS_CACHE_KEY = "transactions_cache_v2";
const TRANSACTIONS_PENDING_KEY = "transactions_pending_v2";
let categoriesSyncPromise = null;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

async function saveCategoriesToSql(items) {
  const activeUserId = await getActiveLocalUserId();
  for (const category of items) {
    await runStatement(
      `INSERT OR REPLACE INTO categories
        (id, user_id, name, type, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`,
      [
        String(category.id),
        activeUserId || null,
        category.name || "Categoria",
        category.type || null,
        JSON.stringify(category),
        new Date().toISOString(),
      ]
    );
  }
}

async function listCategoriesFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT payload_json, id, name, type
     FROM categories
     WHERE user_id = ?
     ORDER BY updated_at DESC, name ASC`,
    [activeUserId || null]
  );

  return rows.map((row) => {
    try {
      return JSON.parse(row.payload_json);
    } catch {
      return {
        id: row.id,
        name: row.name,
        type: row.type,
      };
    }
  });
}

async function deleteCategoryFromSql(categoryId) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(`DELETE FROM categories WHERE id = ? AND user_id = ?`, [
    String(categoryId),
    activeUserId || null,
  ]);
}

function mergeSyncedCategory(items, localId, remoteCategory) {
  const filtered = (items || []).filter(
    (category) =>
      String(category.id) !== String(localId) &&
      String(category.id) !== String(remoteCategory.id)
  );

  return [{ ...remoteCategory }, ...filtered];
}

function remapTransactionCategoryReference(transaction, localId, remoteCategory) {
  const next = { ...transaction };
  const remoteRef = {
    id: remoteCategory.id,
    name: remoteCategory.name,
    type: remoteCategory.type,
  };

  if (String(next.category_id) === String(localId)) {
    next.category_id = remoteCategory.id;
    next.category_name = remoteCategory.name;
  }

  if (next.category?.id && String(next.category.id) === String(localId)) {
    next.category = remoteRef;
  }

  if (next.categories?.id && String(next.categories.id) === String(localId)) {
    next.categories = remoteRef;
  }

  return next;
}

async function remapTransactionsForSyncedCategory(localId, remoteCategory) {
  const cachedTransactions = await getJson(TRANSACTIONS_CACHE_KEY, []);

  if (Array.isArray(cachedTransactions)) {
    await setJson(
      TRANSACTIONS_CACHE_KEY,
      cachedTransactions.map((transaction) =>
        remapTransactionCategoryReference(transaction, localId, remoteCategory)
      )
    );
  }

  if (!(await isSqliteReady())) {
    return;
  }

  try {
    const activeUserId = await getActiveLocalUserId();
    const rows = await queryRows(
      `SELECT id, payload_json
       FROM transactions
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [activeUserId || null]
    );

    for (const row of rows) {
      const parsed = row.payload_json ? JSON.parse(row.payload_json) : {};
      const nextTransaction = remapTransactionCategoryReference(
        parsed,
        localId,
        remoteCategory
      );

      await runStatement(
        `UPDATE transactions
         SET category_id = ?, payload_json = ?, updated_at = ?
         WHERE id = ?`,
        [
          nextTransaction.category_id ? String(nextTransaction.category_id) : null,
          JSON.stringify(nextTransaction),
          new Date().toISOString(),
          String(row.id),
        ]
      );
    }
  } catch {
    // ignore
  }
}

function remapPendingTransactionCategoryOp(op, localId, remoteCategory) {
  if (!op?.payload) {
    return op;
  }

  const next = {
    ...op,
    payload: { ...op.payload },
  };

  if (String(next.payload.category_id) === String(localId)) {
    next.payload.category_id = remoteCategory.id;
  }

  return next;
}

async function remapPendingTransactionsForSyncedCategory(localId, remoteCategory) {
  const pendingTransactions = await getJson(TRANSACTIONS_PENDING_KEY, []);

  if (!Array.isArray(pendingTransactions)) {
    return;
  }

  await setJson(
    TRANSACTIONS_PENDING_KEY,
    pendingTransactions.map((op) =>
      remapPendingTransactionCategoryOp(op, localId, remoteCategory)
    )
  );
}

async function reconcileSyncedCreatedCategory(localId, remoteCategory) {
  const cachedCategories = await getCachedCategories();
  await setCachedCategories(
    mergeSyncedCategory(cachedCategories, localId, remoteCategory)
  );

  await remapTransactionsForSyncedCategory(localId, remoteCategory);
  await remapPendingTransactionsForSyncedCategory(localId, remoteCategory);

  if (!(await isSqliteReady())) {
    return;
  }

  const sqlCategories = await listCategoriesFromSql();
  const nextCategories = mergeSyncedCategory(sqlCategories, localId, remoteCategory);

  await deleteCategoryFromSql(localId);
  await saveCategoriesToSql(nextCategories);
}

async function findRemoteCategoryByIdentity(token, payload) {
  const targetName = String(payload?.name || "").trim().toLowerCase();
  const targetType = String(payload?.type || "").trim().toLowerCase();
  if (!targetName) return null;

  const res = await axios.get(`${api}/categories`, {
    headers: authHeaders(token),
  });

  const items = res.data.data || [];
  return (
    items.find(
      (category) =>
        String(category.name || "").trim().toLowerCase() === targetName &&
        String(category.type || "").trim().toLowerCase() === targetType
    ) || null
  );
}

async function getPendingCategoriesFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT * FROM pending_ops
     WHERE entity_type = ?
       AND user_id = ?
     ORDER BY created_at ASC`,
    ["category", activeUserId || null]
  );

  return rows.map((row) => ({
    id: row.id,
    type: row.op_type,
    categoryId: row.entity_id,
    localId: row.local_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    created_at: row.created_at,
  }));
}

async function setPendingCategoriesInSql(items) {
  const activeUserId = await getActiveLocalUserId();

  await runStatement(`DELETE FROM pending_ops WHERE entity_type = ? AND user_id = ?`, [
    "category",
    activeUserId || null,
  ]);

  for (const item of items) {
    await runStatement(
      `INSERT OR REPLACE INTO pending_ops
        (id, user_id, entity_type, op_type, entity_id, local_id, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(item.id || crypto.randomUUID()),
        activeUserId || null,
        "category",
        item.type,
        item.categoryId ? String(item.categoryId) : null,
        item.localId ? String(item.localId) : null,
        JSON.stringify(item.payload ?? null),
        item.created_at || new Date().toISOString(),
      ]
    );
  }
}

export async function listCategories({ token, subscriptionMode }) {
  if (await isSqliteReady()) {
    const cached = await listCategoriesFromSql();

    if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
      return { data: cached, source: "cache" };
    }

    try {
      const res = await axios.get(`${api}/categories`, {
        headers: authHeaders(token),
      });
      const items = res.data.data || [];
      await saveCategoriesToSql(items);
      await setCachedCategories(items);
      return { data: items, source: "remote" };
    } catch {
      return { data: cached, source: "cache" };
    }
  }

  const cached = await getCachedCategories();

  if (!isOnline() || !canUsePremiumBackend(subscriptionMode)) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/categories`, {
      headers: authHeaders(token),
    });
    const items = res.data.data || [];
    await setCachedCategories(items);
    return { data: items, source: "remote" };
  } catch {
    return { data: cached, source: "cache" };
  }
}

export async function createCategory({ token, payload, subscriptionMode }) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      const res = await axios.post(`${api}/categories`, payload, {
        headers: authHeaders(token),
      });

      return { offline: false, data: res.data };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  {
    const localItem = {
      id: `local-${crypto.randomUUID()}`,
      ...payload,
      sync_status: "pending_create",
    };

    if (await isSqliteReady()) {
      await saveCategoriesToSql([localItem]);
      const pending = await getPendingCategoriesFromSql();
      pending.push({
        type: "create",
        localId: localItem.id,
        payload,
      });
      await setPendingCategoriesInSql(pending);
    } else {
      await setCachedCategories([...(await getCachedCategories()), localItem]);
      await addPendingCategoryOp({
        type: "create",
        localId: localItem.id,
        payload,
      });
    }

    return { offline: true, data: localItem };
  }
}

export async function updateCategory({
  token,
  id,
  payload,
  subscriptionMode,
}) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      await axios.put(`${api}/categories/${id}`, payload, {
        headers: authHeaders(token),
      });

      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  {
    if (await isSqliteReady()) {
      const current = await listCategoriesFromSql();
      const next = current.map((category) =>
        String(category.id) === String(id)
          ? { ...category, ...payload, sync_status: "pending_update" }
          : category
      );
      await saveCategoriesToSql(next);

      if (!String(id).startsWith("local-")) {
        const pending = await getPendingCategoriesFromSql();
        pending.push({
          type: "update",
          categoryId: id,
          payload,
        });
        await setPendingCategoriesInSql(pending);
      } else {
        const pending = (await getPendingCategoriesFromSql()).map((op) =>
          op.type === "create" && String(op.localId) === String(id)
            ? { ...op, payload: { ...op.payload, ...payload } }
            : op
        );
        await setPendingCategoriesInSql(pending);
      }
    } else {
      const next = (await getCachedCategories()).map((category) =>
        String(category.id) === String(id)
          ? { ...category, ...payload, sync_status: "pending_update" }
          : category
      );
      await setCachedCategories(next);

      if (!String(id).startsWith("local-")) {
        await addPendingCategoryOp({
          type: "update",
          categoryId: id,
          payload,
        });
      } else {
        const pending = (await getPendingCategoryOps()).map((op) =>
          op.type === "create" && String(op.localId) === String(id)
            ? { ...op, payload: { ...op.payload, ...payload } }
            : op
        );
        await setPendingCategoryOps(pending);
      }
    }

    return { offline: true };
  }
}

export async function deleteCategoryRecord({
  token,
  category,
  subscriptionMode,
}) {
  if (isOnline() && canUsePremiumBackend(subscriptionMode)) {
    try {
      await axios.delete(`${api}/categories/${category.id}`, {
        headers: authHeaders(token),
      });

      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) {
        throw error;
      }
    }
  }

  {
    if (await isSqliteReady()) {
      await deleteCategoryFromSql(category.id);
      if (!String(category.id).startsWith("local-")) {
        const pending = await getPendingCategoriesFromSql();
        pending.push({
          type: "delete",
          categoryId: category.id,
        });
        await setPendingCategoriesInSql(pending);
      } else {
        await setPendingCategoriesInSql(
          (await getPendingCategoriesFromSql()).filter(
            (op) =>
              !(op.type === "create" && String(op.localId) === String(category.id))
          )
        );
      }
    } else {
      await setCachedCategories(
        (await getCachedCategories()).filter(
          (item) => String(item.id) !== String(category.id)
        )
      );

      if (!String(category.id).startsWith("local-")) {
        await addPendingCategoryOp({
          type: "delete",
          categoryId: category.id,
        });
      }
    }

    return { offline: true };
  }
}

export async function syncPendingCategories({ token, subscriptionMode }) {
  if (!isOnline()) return { synced: 0 };
  if (!canSyncRemote(subscriptionMode)) {
    return { synced: 0, skipped: true };
  }
  if (categoriesSyncPromise) {
    return categoriesSyncPromise;
  }

  categoriesSyncPromise = (async () => {
    const pending = (await isSqliteReady())
      ? await getPendingCategoriesFromSql()
      : await getPendingCategoryOps();

    if (!pending.length) return { synced: 0 };

    const remaining = [];

    for (const op of pending) {
      try {
        if (op.type === "create") {
          let remoteCategory = null;

          try {
            remoteCategory = await findRemoteCategoryByIdentity(token, op.payload);
          } catch {
            remoteCategory = null;
          }

          if (!remoteCategory) {
            const res = await axios.post(`${api}/categories`, op.payload, {
              headers: authHeaders(token),
            });
            remoteCategory = res.data?.data || res.data;
          }

          if (op.localId && remoteCategory?.id) {
            await reconcileSyncedCreatedCategory(op.localId, remoteCategory);
          }
        }

        if (op.type === "update") {
          await axios.put(`${api}/categories/${op.categoryId}`, op.payload, {
            headers: authHeaders(token),
          });
        }

        if (op.type === "delete") {
          await axios.delete(`${api}/categories/${op.categoryId}`, {
            headers: authHeaders(token),
          });
        }
      } catch {
        remaining.push(op);
      }
    }

    if (await isSqliteReady()) {
      await setPendingCategoriesInSql(remaining);
    } else {
      await setPendingCategoryOps(remaining);
    }

    return { synced: pending.length - remaining.length };
  })();

  try {
    return await categoriesSyncPromise;
  } finally {
    categoriesSyncPromise = null;
  }
}
