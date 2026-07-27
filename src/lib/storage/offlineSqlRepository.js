import { getNativeDb } from "./kvStore";

function normalizeValues(values) {
  return values?.values || [];
}

export async function isSqliteReady() {
  return Boolean(await getNativeDb().catch(() => null));
}

export async function queryRows(statement, params = []) {
  const db = await getNativeDb();
  if (!db) return [];

  const result = await db.query(statement, params);
  return normalizeValues(result);
}

export async function runStatement(statement, params = []) {
  const db = await getNativeDb();
  if (!db) return null;

  return db.run(statement, params);
}
