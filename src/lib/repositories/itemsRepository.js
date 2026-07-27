import axios from "axios";
import { getActiveLocalUserId } from "../storage/kvStore";
import {
  getCachedItems,
  setCachedItems,
} from "../storage/transactionsLocalStore";
import {
  addPendingItemOp,
  getCachedPriceHistory,
  getCachedTaxes,
  getPendingItemOps,
  setCachedPriceHistory,
  setCachedTaxes,
  setPendingItemOps,
} from "../storage/itemsLocalStore";
import {
  isSqliteReady,
  queryRows,
  runStatement,
} from "../storage/offlineSqlRepository";
import { isOfflineLikeError } from "./networkFallback";
import { canSyncRemote } from "../subscription/subscriptionAccess";

const api = import.meta.env.VITE_API_URL;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function normalizeItem(item) {
  return {
    ...item,
    latest_price:
      item.latest_price == null ? null : Number(item.latest_price),
    tax_rate: item.tax_rate == null ? null : Number(item.tax_rate),
  };
}

async function saveItemsToSql(items) {
  const activeUserId = await getActiveLocalUserId();

  for (const item of items) {
    await runStatement(
      `INSERT OR REPLACE INTO items
        (id, user_id, name, description, category, tax_id, latest_price, tax_name, tax_rate, is_exempt, sync_status, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(item.id),
        activeUserId || null,
        item.name || "Articulo",
        item.description || null,
        item.category || null,
        item.tax_id ? String(item.tax_id) : null,
        item.latest_price == null ? null : Number(item.latest_price),
        item.tax_name || null,
        item.tax_rate == null ? null : Number(item.tax_rate),
        item.is_exempt ? 1 : 0,
        item.sync_status || null,
        JSON.stringify(normalizeItem(item)),
        new Date().toISOString(),
      ]
    );
  }
}

async function listItemsFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT payload_json
     FROM items
     WHERE user_id = ?
     ORDER BY updated_at DESC, name ASC`,
    [activeUserId || null]
  );
  return rows
    .map((row) => {
      try {
        return normalizeItem(JSON.parse(row.payload_json));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function deleteItemFromSql(itemId) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(`DELETE FROM items WHERE id = ? AND user_id = ?`, [
    String(itemId),
    activeUserId || null,
  ]);
  await runStatement(`DELETE FROM item_prices WHERE item_id = ? AND user_id = ?`, [
    String(itemId),
    activeUserId || null,
  ]);
}

async function saveTaxesToSql(items) {
  const activeUserId = await getActiveLocalUserId();

  for (const tax of items) {
    await runStatement(
      `INSERT OR REPLACE INTO taxes
        (id, user_id, name, rate, is_exempt, sync_status, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(tax.id),
        activeUserId || null,
        tax.name || "Impuesto",
        tax.rate == null ? 0 : Number(tax.rate),
        tax.is_exempt ? 1 : 0,
        tax.sync_status || null,
        JSON.stringify(tax),
        new Date().toISOString(),
      ]
    );
  }
}

async function listTaxesFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT payload_json
     FROM taxes
     WHERE user_id = ?
     ORDER BY updated_at DESC, name ASC`,
    [activeUserId || null]
  );
  return rows
    .map((row) => {
      try {
        return JSON.parse(row.payload_json);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function deleteTaxFromSql(taxId) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(`DELETE FROM taxes WHERE id = ? AND user_id = ?`, [
    String(taxId),
    activeUserId || null,
  ]);
}

async function savePriceHistoryToSql(itemId, prices) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(`DELETE FROM item_prices WHERE item_id = ? AND user_id = ?`, [
    String(itemId),
    activeUserId || null,
  ]);

  for (const price of prices) {
    await runStatement(
      `INSERT OR REPLACE INTO item_prices
        (id, user_id, item_id, price, date, sync_status, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(price.id),
        activeUserId || null,
        String(itemId),
        Number(price.price ?? 0),
        price.date || null,
        price.sync_status || null,
        JSON.stringify(price),
        new Date().toISOString(),
      ]
    );
  }
}

async function listPriceHistoryFromSql(itemId) {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT payload_json
     FROM item_prices
     WHERE item_id = ?
       AND user_id = ?
     ORDER BY date DESC, updated_at DESC`,
    [String(itemId), activeUserId || null]
  );
  return rows
    .map((row) => {
      try {
        return JSON.parse(row.payload_json);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

async function upsertPriceToSql(priceRecord) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(
    `INSERT OR REPLACE INTO item_prices
      (id, user_id, item_id, price, date, sync_status, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      String(priceRecord.id),
      activeUserId || null,
      String(priceRecord.item_id),
      Number(priceRecord.price ?? 0),
      priceRecord.date || null,
      priceRecord.sync_status || null,
      JSON.stringify(priceRecord),
      new Date().toISOString(),
    ]
  );
}

async function deletePriceFromSql(priceId) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(`DELETE FROM item_prices WHERE id = ? AND user_id = ?`, [
    String(priceId),
    activeUserId || null,
  ]);
}

async function getPendingItemsFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT * FROM pending_ops
     WHERE entity_type IN (?, ?, ?)
       AND user_id = ?
     ORDER BY created_at ASC`,
    ["item", "tax", "item_price", activeUserId || null]
  );

  return rows.map((row) => ({
    id: row.id,
    entity_type: row.entity_type,
    type: row.op_type,
    entity_id: row.entity_id,
    local_id: row.local_id,
    payload: row.payload_json ? JSON.parse(row.payload_json) : null,
    created_at: row.created_at,
  }));
}

async function setPendingItemsInSql(items) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(
    `DELETE FROM pending_ops WHERE entity_type IN (?, ?, ?) AND user_id = ?`,
    ["item", "tax", "item_price", activeUserId || null]
  );

  for (const item of items) {
    await runStatement(
      `INSERT OR REPLACE INTO pending_ops
        (id, user_id, entity_type, op_type, entity_id, local_id, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(item.id || crypto.randomUUID()),
        activeUserId || null,
        item.entity_type,
        item.type,
        item.entity_id ? String(item.entity_id) : null,
        item.local_id ? String(item.local_id) : null,
        JSON.stringify(item.payload ?? null),
        item.created_at || new Date().toISOString(),
      ]
    );
  }
}

function updateLatestPrice(items, itemId, price) {
  return items.map((item) =>
    String(item.id) === String(itemId)
      ? { ...item, latest_price: Number(price) }
      : item
  );
}

export async function listItems({ token }) {
  if (await isSqliteReady()) {
    const cached = await listItemsFromSql();

    if (!isOnline()) {
      return { data: cached, source: "cache" };
    }

    try {
      const res = await axios.get(`${api}/items-with-price`, {
        headers: authHeaders(token),
      });
      const items = (res.data.data || []).map(normalizeItem);
      await saveItemsToSql(items);
      await setCachedItems(items);
      return { data: items, source: "remote" };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
      return { data: cached, source: "cache" };
    }
  }

  const cached = await getCachedItems();

  if (!isOnline()) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/items-with-price`, {
      headers: authHeaders(token),
    });
    const items = (res.data.data || []).map(normalizeItem);
    await setCachedItems(items);
    return { data: items, source: "remote" };
  } catch (error) {
    if (!isOfflineLikeError(error)) throw error;
    return { data: cached, source: "cache" };
  }
}

export async function listTaxes({ token }) {
  if (await isSqliteReady()) {
    const cached = await listTaxesFromSql();

    if (!isOnline()) {
      return { data: cached, source: "cache" };
    }

    try {
      const res = await axios.get(`${api}/taxes`, {
        headers: authHeaders(token),
      });
      const taxes = res.data.data || [];
      await saveTaxesToSql(taxes);
      await setCachedTaxes(taxes);
      return { data: taxes, source: "remote" };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
      return { data: cached, source: "cache" };
    }
  }

  const cached = await getCachedTaxes();

  if (!isOnline()) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/taxes`, {
      headers: authHeaders(token),
    });
    const taxes = res.data.data || [];
    await setCachedTaxes(taxes);
    return { data: taxes, source: "remote" };
  } catch (error) {
    if (!isOfflineLikeError(error)) throw error;
    return { data: cached, source: "cache" };
  }
}

export async function listItemPrices({ token, itemId }) {
  if (await isSqliteReady()) {
    const cached = await listPriceHistoryFromSql(itemId);

    if (!isOnline()) {
      return { data: cached, source: "cache" };
    }

    try {
      const res = await axios.get(`${api}/item-prices/${itemId}`, {
        headers: authHeaders(token),
      });
      const prices = res.data.data || [];
      await savePriceHistoryToSql(itemId, prices);

      const history = await getCachedPriceHistory();
      await setCachedPriceHistory({ ...history, [itemId]: prices });

      return { data: prices, source: "remote" };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
      return { data: cached, source: "cache" };
    }
  }

  const history = await getCachedPriceHistory();
  const cached = history[itemId] || [];

  if (!isOnline()) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/item-prices/${itemId}`, {
      headers: authHeaders(token),
    });
    const prices = res.data.data || [];
    await setCachedPriceHistory({ ...history, [itemId]: prices });
    return { data: prices, source: "remote" };
  } catch (error) {
    if (!isOfflineLikeError(error)) throw error;
    return { data: cached, source: "cache" };
  }
}

export async function createItem({ token, payload }) {
  if (isOnline()) {
    try {
      const res = await axios.post(`${api}/items`, payload, {
        headers: authHeaders(token),
      });
      return { offline: false, data: res.data };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const localItem = normalizeItem({
    id: `local-${crypto.randomUUID()}`,
    ...payload,
    tax_name: null,
    tax_rate: null,
    is_exempt: false,
    latest_price: null,
    sync_status: "pending_create",
  });

  if (await isSqliteReady()) {
    await saveItemsToSql([localItem]);
    const pending = await getPendingItemsFromSql();
    pending.push({
      entity_type: "item",
      type: "create",
      local_id: localItem.id,
      payload,
    });
    await setPendingItemsInSql(pending);
  } else {
    await setCachedItems([...(await getCachedItems()), localItem]);
    await addPendingItemOp({
      entity_type: "item",
      type: "create",
      local_id: localItem.id,
      payload,
    });
  }

  return { offline: true, data: localItem };
}

export async function updateItem({ token, item }) {
  const payload = {
    id: item.id,
    name: item.name,
    description: item.description,
    category: item.category,
    tax_id: item.tax_id || null,
  };

  if (isOnline()) {
    try {
      await axios.post(`${api}/items`, payload, {
        headers: authHeaders(token),
      });
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const nextItem = { ...item, sync_status: "pending_update" };

  if (await isSqliteReady()) {
    const current = await listItemsFromSql();
    await saveItemsToSql(
      current.map((entry) =>
        String(entry.id) === String(item.id) ? nextItem : entry
      )
    );

    const pending = await getPendingItemsFromSql();
    if (!String(item.id).startsWith("local-")) {
      pending.push({
        entity_type: "item",
        type: "update",
        entity_id: item.id,
        payload,
      });
    } else {
      for (const op of pending) {
        if (op.entity_type === "item" && op.type === "create" && String(op.local_id) === String(item.id)) {
          op.payload = { ...op.payload, ...payload };
        }
      }
    }
    await setPendingItemsInSql(pending);
  } else {
    await setCachedItems(
      (await getCachedItems()).map((entry) =>
        String(entry.id) === String(item.id) ? nextItem : entry
      )
    );

    if (!String(item.id).startsWith("local-")) {
      await addPendingItemOp({
        entity_type: "item",
        type: "update",
        entity_id: item.id,
        payload,
      });
    } else {
      const pending = await getPendingItemOps();
      for (const op of pending) {
        if (op.entity_type === "item" && op.type === "create" && String(op.local_id) === String(item.id)) {
          op.payload = { ...op.payload, ...payload };
        }
      }
      await setPendingItemOps(pending);
    }
  }

  return { offline: true };
}

export async function createItemPrice({ token, payload }) {
  if (isOnline()) {
    try {
      const res = await axios.post(`${api}/item-prices`, payload, {
        headers: authHeaders(token),
      });
      return { offline: false, data: res.data };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const localPrice = {
    id: `local-price-${crypto.randomUUID()}`,
    ...payload,
    sync_status: "pending_create",
  };

  if (await isSqliteReady()) {
    await upsertPriceToSql(localPrice);
    const pending = await getPendingItemsFromSql();
    pending.push({
      entity_type: "item_price",
      type: "create",
      local_id: localPrice.id,
      payload,
    });
    await setPendingItemsInSql(pending);
  } else {
    const history = await getCachedPriceHistory();
    const currentPrices = history[payload.item_id] || [];
    await setCachedPriceHistory({
      ...history,
      [payload.item_id]: [localPrice, ...currentPrices],
    });
    await addPendingItemOp({
      entity_type: "item_price",
      type: "create",
      local_id: localPrice.id,
      payload,
    });
  }

  const currentItems = await getCachedItems();
  await setCachedItems(updateLatestPrice(currentItems, payload.item_id, payload.price));

  if (await isSqliteReady()) {
    const sqlItems = await listItemsFromSql();
    await saveItemsToSql(updateLatestPrice(sqlItems, payload.item_id, payload.price));
  }

  return { offline: true, data: localPrice };
}

export async function deleteItemRecord({ token, item }) {
  if (isOnline()) {
    try {
      await axios.delete(`${api}/items/${item.id}`, {
        headers: authHeaders(token),
      });
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  if (await isSqliteReady()) {
    await deleteItemFromSql(item.id);
    const pending = await getPendingItemsFromSql();
    if (!String(item.id).startsWith("local-")) {
      pending.push({
        entity_type: "item",
        type: "delete",
        entity_id: item.id,
      });
    }
    await setPendingItemsInSql(
      pending.filter(
        (op) =>
          !(op.entity_type === "item" &&
            op.type === "create" &&
            String(op.local_id) === String(item.id))
      )
    );
  } else {
    await setCachedItems(
      (await getCachedItems()).filter((entry) => String(entry.id) !== String(item.id))
    );

    if (!String(item.id).startsWith("local-")) {
      await addPendingItemOp({
        entity_type: "item",
        type: "delete",
        entity_id: item.id,
      });
    }
  }

  return { offline: true };
}

export async function deleteItemPriceRecord({ token, itemId, priceRecord }) {
  if (isOnline()) {
    try {
      await axios.delete(`${api}/item-prices/${priceRecord.id}`, {
        headers: authHeaders(token),
      });
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  if (await isSqliteReady()) {
    await deletePriceFromSql(priceRecord.id);
    const pending = await getPendingItemsFromSql();
    if (!String(priceRecord.id).startsWith("local-")) {
      pending.push({
        entity_type: "item_price",
        type: "delete",
        entity_id: priceRecord.id,
      });
    }
    await setPendingItemsInSql(
      pending.filter(
        (op) =>
          !(op.entity_type === "item_price" &&
            op.type === "create" &&
            String(op.local_id) === String(priceRecord.id))
      )
    );
  } else {
    const history = await getCachedPriceHistory();
    const currentPrices = history[itemId] || [];
    await setCachedPriceHistory({
      ...history,
      [itemId]: currentPrices.filter(
        (entry) => String(entry.id) !== String(priceRecord.id)
      ),
    });

    if (!String(priceRecord.id).startsWith("local-")) {
      await addPendingItemOp({
        entity_type: "item_price",
        type: "delete",
        entity_id: priceRecord.id,
      });
    }
  }

  return { offline: true };
}

export async function createTax({ token, payload }) {
  if (isOnline()) {
    try {
      const res = await axios.post(`${api}/taxes`, payload, {
        headers: authHeaders(token),
      });
      return { offline: false, data: res.data };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const localTax = {
    id: `local-tax-${crypto.randomUUID()}`,
    ...payload,
    sync_status: "pending_create",
  };

  if (await isSqliteReady()) {
    await saveTaxesToSql([localTax]);
    const pending = await getPendingItemsFromSql();
    pending.push({
      entity_type: "tax",
      type: "create",
      local_id: localTax.id,
      payload,
    });
    await setPendingItemsInSql(pending);
  } else {
    await setCachedTaxes([...(await getCachedTaxes()), localTax]);
    await addPendingItemOp({
      entity_type: "tax",
      type: "create",
      local_id: localTax.id,
      payload,
    });
  }

  return { offline: true, data: localTax };
}

export async function deleteTaxRecord({ token, tax }) {
  if (isOnline()) {
    try {
      await axios.delete(`${api}/taxes/${tax.id}`, {
        headers: authHeaders(token),
      });
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  if (await isSqliteReady()) {
    await deleteTaxFromSql(tax.id);
    const pending = await getPendingItemsFromSql();
    if (!String(tax.id).startsWith("local-")) {
      pending.push({
        entity_type: "tax",
        type: "delete",
        entity_id: tax.id,
      });
    }
    await setPendingItemsInSql(
      pending.filter(
        (op) =>
          !(op.entity_type === "tax" &&
            op.type === "create" &&
            String(op.local_id) === String(tax.id))
      )
    );
  } else {
    await setCachedTaxes(
      (await getCachedTaxes()).filter((entry) => String(entry.id) !== String(tax.id))
    );
    if (!String(tax.id).startsWith("local-")) {
      await addPendingItemOp({
        entity_type: "tax",
        type: "delete",
        entity_id: tax.id,
      });
    }
  }

  return { offline: true };
}

export async function syncPendingItems({ token, subscriptionMode } = {}) {
  if (!isOnline()) return { synced: 0 };
  if (!canSyncRemote(subscriptionMode)) {
    return { synced: 0, skipped: true };
  }

  const pending = (await isSqliteReady())
    ? await getPendingItemsFromSql()
    : await getPendingItemOps();

  if (!pending.length) return { synced: 0 };

  const remaining = [];

  for (const op of pending) {
    try {
      if (op.entity_type === "item" && op.type === "create") {
        await axios.post(`${api}/items`, op.payload, {
          headers: authHeaders(token),
        });
      }

      if (op.entity_type === "item" && op.type === "update") {
        await axios.post(`${api}/items`, op.payload, {
          headers: authHeaders(token),
        });
      }

      if (op.entity_type === "item" && op.type === "delete") {
        await axios.delete(`${api}/items/${op.entity_id}`, {
          headers: authHeaders(token),
        });
      }

      if (op.entity_type === "item_price" && op.type === "create") {
        await axios.post(`${api}/item-prices`, op.payload, {
          headers: authHeaders(token),
        });
      }

      if (op.entity_type === "item_price" && op.type === "delete") {
        await axios.delete(`${api}/item-prices/${op.entity_id}`, {
          headers: authHeaders(token),
        });
      }

      if (op.entity_type === "tax" && op.type === "create") {
        await axios.post(`${api}/taxes`, op.payload, {
          headers: authHeaders(token),
        });
      }

      if (op.entity_type === "tax" && op.type === "delete") {
        await axios.delete(`${api}/taxes/${op.entity_id}`, {
          headers: authHeaders(token),
        });
      }
    } catch {
      remaining.push(op);
    }
  }

  if (await isSqliteReady()) {
    await setPendingItemsInSql(remaining);
  } else {
    await setPendingItemOps(remaining);
  }

  return { synced: pending.length - remaining.length };
}
