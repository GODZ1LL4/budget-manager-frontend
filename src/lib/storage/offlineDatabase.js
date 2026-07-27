import { Device } from "@capacitor/device";
import {
  getActiveLocalUserId,
  getNativeDb,
  getJson,
  setItem,
} from "./kvStore";

const INIT_KEY = "bm_sqlite_schema_initialized_v1";
const DEVICE_ID_KEY = "bm_device_id";

async function ensureDeviceId() {
  try {
    const info = await Device.getId();
    if (info?.identifier) {
      await setItem(DEVICE_ID_KEY, info.identifier);
      return info.identifier;
    }
  } catch {
    // Ignore and fall back to generated value.
  }

  const fallbackId = `web-${crypto.randomUUID()}`;
  await setItem(DEVICE_ID_KEY, fallbackId);
  return fallbackId;
}

async function createTables(db) {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_meta (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      current REAL DEFAULT 0,
      reserved REAL DEFAULT 0,
      available REAL DEFAULT 0,
      sync_status TEXT,
      payload_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      type TEXT,
      payload_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      category_id TEXT,
      category_name TEXT,
      month TEXT,
      limit_amount REAL DEFAULT 0,
      spent REAL DEFAULT 0,
      repeat_flag INTEGER DEFAULT 0,
      sync_status TEXT,
      payload_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      account_id TEXT,
      category_id TEXT,
      type TEXT,
      amount REAL DEFAULT 0,
      description TEXT,
      date TEXT,
      recurrence TEXT,
      recurrence_end_date TEXT,
      is_shopping_list INTEGER DEFAULT 0,
      sync_status TEXT,
      payload_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      tax_id TEXT,
      latest_price REAL,
      tax_name TEXT,
      tax_rate REAL,
      is_exempt INTEGER DEFAULT 0,
      sync_status TEXT,
      payload_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS taxes (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      name TEXT NOT NULL,
      rate REAL DEFAULT 0,
      is_exempt INTEGER DEFAULT 0,
      sync_status TEXT,
      payload_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS item_prices (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      item_id TEXT NOT NULL,
      price REAL DEFAULT 0,
      date TEXT,
      sync_status TEXT,
      payload_json TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS pending_ops (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT,
      entity_type TEXT NOT NULL,
      op_type TEXT NOT NULL,
      entity_id TEXT,
      local_id TEXT,
      payload_json TEXT,
      created_at TEXT NOT NULL
    );
  `);

  await db.execute(`
    CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts (user_id);
    CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories (user_id);
    CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets (user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions (user_id);
    CREATE INDEX IF NOT EXISTS idx_items_user_id ON items (user_id);
    CREATE INDEX IF NOT EXISTS idx_taxes_user_id ON taxes (user_id);
    CREATE INDEX IF NOT EXISTS idx_item_prices_user_id ON item_prices (user_id);
    CREATE INDEX IF NOT EXISTS idx_pending_ops_user_id ON pending_ops (user_id);
  `);
}

async function ensureUserColumns(db) {
  const tableNames = [
    "accounts",
    "categories",
    "budgets",
    "transactions",
    "items",
    "taxes",
    "item_prices",
    "pending_ops",
  ];

  for (const tableName of tableNames) {
    try {
      const columns = await db.query(`PRAGMA table_info(${tableName})`);
      const hasUserId = (columns.values || []).some(
        (column) => column.name === "user_id"
      );

      if (!hasUserId) {
        await db.execute(`ALTER TABLE ${tableName} ADD COLUMN user_id TEXT;`);
      }
    } catch {
      // ignore and keep best effort migration
    }
  }
}

async function upsertRows(db, statement, rows) {
  for (const row of rows) {
    await db.run(statement, row);
  }
}

async function migrateLegacyData(db) {
  const activeUserId = await getActiveLocalUserId();
  const [
    accounts,
    balances,
    accountOps,
    categories,
    budgets,
    budgetOps,
    transactions,
    transactionOps,
  ] = await Promise.all([
    getJson("bm_accounts_cache_v1", []),
    getJson("bm_account_balances_cache_v1", {}),
    getJson("bm_accounts_pending_v1", []),
    getJson("bm_categories_cache_v1", []),
    getJson("bm_budgets_cache_v1", []),
    getJson("bm_budgets_pending_v1", []),
    getJson("bm_transactions_cache_v1", []),
    getJson("bm_transactions_pending_v1", []),
  ]);

  await upsertRows(
    db,
    `INSERT OR REPLACE INTO accounts
      (id, user_id, name, current, reserved, available, sync_status, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    accounts.map((account) => [
      String(account.id),
      activeUserId || null,
      account.name || "Cuenta",
      Number(balances?.[account.id]?.current ?? 0),
      Number(balances?.[account.id]?.reserved ?? 0),
      Number(balances?.[account.id]?.available ?? 0),
      account.sync_status || null,
      JSON.stringify(account),
      new Date().toISOString(),
    ])
  );

  await upsertRows(
    db,
    `INSERT OR REPLACE INTO categories
      (id, user_id, name, type, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)`,
    categories.map((category) => [
      String(category.id),
      activeUserId || null,
      category.name || "Categoria",
      category.type || null,
      JSON.stringify(category),
      new Date().toISOString(),
    ])
  );

  await upsertRows(
    db,
    `INSERT OR REPLACE INTO budgets
      (id, user_id, category_id, category_name, month, limit_amount, spent, repeat_flag, sync_status, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    budgets.map((budget) => [
      String(budget.id),
      activeUserId || null,
      budget.category_id ? String(budget.category_id) : null,
      budget.category_name || null,
      budget.month || null,
      Number(budget.limit ?? budget.limit_amount ?? 0),
      Number(budget.spent ?? 0),
      budget.repeat ? 1 : 0,
      budget.sync_status || null,
      JSON.stringify(budget),
      new Date().toISOString(),
    ])
  );

  await upsertRows(
    db,
    `INSERT OR REPLACE INTO transactions
      (id, user_id, account_id, category_id, type, amount, description, date, recurrence, recurrence_end_date, is_shopping_list, sync_status, payload_json, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    transactions.map((tx) => [
      String(tx.id),
      activeUserId || null,
      tx.account_id ? String(tx.account_id) : null,
      tx.category_id ? String(tx.category_id) : null,
      tx.type || null,
      Number(tx.amount ?? 0),
      tx.description || null,
      tx.date || null,
      tx.recurrence || null,
      tx.recurrence_end_date || null,
      tx.is_shopping_list ? 1 : 0,
      tx.sync_status || null,
      JSON.stringify(tx),
      new Date().toISOString(),
    ])
  );

  const pendingRows = [
    ...accountOps.map((op) => ({
      ...op,
      entity_type: "account",
      entity_id: op.accountId || null,
      local_id: op.localId || null,
    })),
    ...budgetOps.map((op) => ({
      ...op,
      entity_type: "budget",
      entity_id: op.budgetId || null,
      local_id: op.localId || null,
    })),
    ...transactionOps.map((op) => ({
      ...op,
      entity_type: "transaction",
      entity_id: op.transactionId || null,
      local_id: op.localId || null,
    })),
  ];

  await upsertRows(
    db,
    `INSERT OR REPLACE INTO pending_ops
      (id, user_id, entity_type, op_type, entity_id, local_id, payload_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    pendingRows.map((op) => [
      String(op.id),
      activeUserId || null,
      op.entity_type,
      op.type,
      op.entity_id ? String(op.entity_id) : null,
      op.local_id ? String(op.local_id) : null,
      JSON.stringify(op.payload ?? null),
      op.created_at || new Date().toISOString(),
    ])
  );
}

export async function initializeOfflineDatabase() {
  const db = await getNativeDb();
  if (!db) {
    return { enabled: false, migrated: false };
  }

  await createTables(db);
  await ensureUserColumns(db);
  await ensureDeviceId();

  const meta = await db.query(`SELECT value FROM app_meta WHERE key = ?`, [INIT_KEY]);
  const alreadyInitialized = Boolean(meta.values?.[0]?.value);

  if (!alreadyInitialized) {
    await migrateLegacyData(db);
    await db.run(
      `INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)`,
      [INIT_KEY, new Date().toISOString()]
    );
  }

  return {
    enabled: true,
    migrated: !alreadyInitialized,
  };
}

export async function clearOfflineDomainData() {
  const db = await getNativeDb().catch(() => null);
  if (!db) {
    return { cleared: false };
  }

  const activeUserId = String(await getActiveLocalUserId() || "").replace(
    /'/g,
    "''"
  );

  await db.execute(`
    DELETE FROM pending_ops WHERE user_id = '${activeUserId || ""}';
    DELETE FROM item_prices WHERE user_id = '${activeUserId || ""}';
    DELETE FROM items WHERE user_id = '${activeUserId || ""}';
    DELETE FROM taxes WHERE user_id = '${activeUserId || ""}';
    DELETE FROM transactions WHERE user_id = '${activeUserId || ""}';
    DELETE FROM budgets WHERE user_id = '${activeUserId || ""}';
    DELETE FROM categories WHERE user_id = '${activeUserId || ""}';
    DELETE FROM accounts WHERE user_id = '${activeUserId || ""}';
  `);

  return { cleared: true };
}

export async function claimUnownedOfflineData(userId) {
  if (!userId) {
    return { claimed: false };
  }

  const db = await getNativeDb().catch(() => null);
  if (!db) {
    return { claimed: false };
  }

  const safeUserId = String(userId).replace(/'/g, "''");

  await db.execute(`
    UPDATE pending_ops SET user_id = '${safeUserId}' WHERE user_id IS NULL;
    UPDATE item_prices SET user_id = '${safeUserId}' WHERE user_id IS NULL;
    UPDATE items SET user_id = '${safeUserId}' WHERE user_id IS NULL;
    UPDATE taxes SET user_id = '${safeUserId}' WHERE user_id IS NULL;
    UPDATE transactions SET user_id = '${safeUserId}' WHERE user_id IS NULL;
    UPDATE budgets SET user_id = '${safeUserId}' WHERE user_id IS NULL;
    UPDATE categories SET user_id = '${safeUserId}' WHERE user_id IS NULL;
    UPDATE accounts SET user_id = '${safeUserId}' WHERE user_id IS NULL;
  `);

  return { claimed: true };
}
