import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const DB_NAME = "budget_manager_offline";
const STORE_TABLE = "kv_store";
export const ACTIVE_LOCAL_USER_KEY = "bm_active_local_user_v1";

const GLOBAL_KEYS = new Set([
  ACTIVE_LOCAL_USER_KEY,
  "subscription_mode_v1",
  "bm_sqlite_schema_initialized_v1",
  "bm_device_id",
]);

let sqliteDbPromise = null;

function isNativePlatform() {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios";
}

async function createNativeConnection() {
  const sqliteModule = await import("@capacitor-community/sqlite");
  const sqlite = sqliteModule.CapacitorSQLite;

  const consistency = await sqlite.checkConnectionsConsistency();
  const isConn = (await sqlite.isConnection(DB_NAME, false)).result;

  let db;
  if (consistency.result && isConn) {
    db = await sqlite.retrieveConnection(DB_NAME, false);
  } else {
    db = await sqlite.createConnection(
      DB_NAME,
      false,
      "no-encryption",
      1,
      false
    );
  }

  await db.open();
  await db.execute(`
    CREATE TABLE IF NOT EXISTS ${STORE_TABLE} (
      key TEXT PRIMARY KEY NOT NULL,
      value TEXT
    );
  `);

  return db;
}

async function getSqliteDb() {
  if (!isNativePlatform()) {
    return null;
  }

  if (!sqliteDbPromise) {
    sqliteDbPromise = createNativeConnection().catch((error) => {
      sqliteDbPromise = null;
      throw error;
    });
  }

  return sqliteDbPromise;
}

export async function getNativeDb() {
  return getSqliteDb();
}

export async function isNativeSqliteEnabled() {
  return Boolean(await getSqliteDb().catch(() => null));
}

async function readFromPreferences(key) {
  const { value } = await Preferences.get({ key });
  return value;
}

async function writeToPreferences(key, value) {
  await Preferences.set({ key, value });
}

async function removeFromPreferences(key) {
  await Preferences.remove({ key });
}

function shouldNamespaceKey(key) {
  if (!key) return false;
  if (isSupabaseAuthKey(key)) return false;
  if (GLOBAL_KEYS.has(key)) return false;
  return true;
}

function isSupabaseAuthKey(key) {
  return typeof key === "string" && key.startsWith("sb-");
}

function buildScopedKey(key, userId) {
  if (!shouldNamespaceKey(key) || !userId) {
    return key;
  }

  return `${key}::${userId}`;
}

async function readRawItem(key) {
  try {
    const db = await getSqliteDb();
    if (db) {
      const result = await db.query(`SELECT value FROM ${STORE_TABLE} WHERE key = ?`, [
        key,
      ]);
      return result.values?.[0]?.value ?? null;
    }
  } catch (error) {
    console.warn("SQLite getItem fallback to Preferences", error);
  }

  return readFromPreferences(key);
}

async function writeRawItem(key, value) {
  try {
    const db = await getSqliteDb();
    if (db) {
      await db.run(
        `INSERT OR REPLACE INTO ${STORE_TABLE} (key, value) VALUES (?, ?)`,
        [key, value]
      );
      return;
    }
  } catch (error) {
    console.warn("SQLite setItem fallback to Preferences", error);
  }

  await writeToPreferences(key, value);
}

async function removeRawItem(key) {
  try {
    const db = await getSqliteDb();
    if (db) {
      await db.run(`DELETE FROM ${STORE_TABLE} WHERE key = ?`, [key]);
      return;
    }
  } catch (error) {
    console.warn("SQLite removeItem fallback to Preferences", error);
  }

  await removeFromPreferences(key);
}

export async function getActiveLocalUserId() {
  return readRawItem(ACTIVE_LOCAL_USER_KEY);
}

export async function setActiveLocalUserId(userId) {
  if (!userId) {
    await removeRawItem(ACTIVE_LOCAL_USER_KEY);
    return;
  }

  await writeRawItem(ACTIVE_LOCAL_USER_KEY, String(userId));
}

export async function getItem(key) {
  const userId = await getActiveLocalUserId();
  const scopedKey = buildScopedKey(key, userId);
  const value = await readRawItem(scopedKey);

  if (value != null) {
    return value;
  }

  // Migration path: older builds may have persisted Supabase session keys
  // under a user-scoped namespace. Promote them back to global keys so the
  // auth session survives app restarts even before local ownership is restored.
  if (isSupabaseAuthKey(key) && userId) {
    const legacyScopedKey = `${key}::${userId}`;
    const legacyValue = await readRawItem(legacyScopedKey);

    if (legacyValue != null) {
      await writeRawItem(key, legacyValue);
      await removeRawItem(legacyScopedKey);
      return legacyValue;
    }
  }

  return null;
}

export async function setItem(key, value) {
  const userId = await getActiveLocalUserId();
  const scopedKey = buildScopedKey(key, userId);
  await writeRawItem(scopedKey, value);
}

export async function removeItem(key) {
  const userId = await getActiveLocalUserId();
  const scopedKey = buildScopedKey(key, userId);
  await removeRawItem(scopedKey);

  if (isSupabaseAuthKey(key) && userId) {
    await removeRawItem(`${key}::${userId}`);
  }
}

export async function getJson(key, fallback) {
  const raw = await getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function setJson(key, value) {
  await setItem(key, JSON.stringify(value));
}
