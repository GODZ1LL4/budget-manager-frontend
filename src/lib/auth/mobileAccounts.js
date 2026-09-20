import { getJson, setJson } from "../storage/kvStore";

export const MOBILE_ACCOUNTS_KEY = "bm_mobile_accounts_v1";

function normalizeUser(user) {
  if (!user?.id) return null;

  return {
    id: user.id,
    email: user.email || "",
    phone: user.phone || "",
    aud: user.aud || "",
    role: user.role || "",
    app_metadata: user.app_metadata || {},
    user_metadata: user.user_metadata || {},
    created_at: user.created_at || null,
    updated_at: user.updated_at || null,
  };
}

function normalizeSession(session) {
  const user = normalizeUser(session?.user);

  if (!user || !session?.access_token || !session?.refresh_token) {
    return null;
  }

  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at || null,
    expires_in: session.expires_in || null,
    token_type: session.token_type || "bearer",
    user,
  };
}

function normalizeAccount(account) {
  const session = normalizeSession(account?.session);
  const userId = account?.userId || session?.user?.id;

  if (!userId || !session) {
    return null;
  }

  return {
    userId: String(userId),
    email: account?.email || session.user.email || "",
    session,
    lastUsedAt: account?.lastUsedAt || new Date().toISOString(),
  };
}

function sortAccounts(accounts) {
  return [...accounts].sort(
    (a, b) => new Date(b.lastUsedAt || 0) - new Date(a.lastUsedAt || 0)
  );
}

export async function getMobileAccounts() {
  const rawAccounts = await getJson(MOBILE_ACCOUNTS_KEY, []);

  if (!Array.isArray(rawAccounts)) {
    return [];
  }

  return sortAccounts(rawAccounts.map(normalizeAccount).filter(Boolean));
}

export async function saveMobileAccountSession(session) {
  const normalizedSession = normalizeSession(session);

  if (!normalizedSession) {
    return getMobileAccounts();
  }

  const accounts = await getMobileAccounts();
  const userId = String(normalizedSession.user.id);
  const nextAccount = {
    userId,
    email: normalizedSession.user.email || "",
    session: normalizedSession,
    lastUsedAt: new Date().toISOString(),
  };
  const nextAccounts = [
    nextAccount,
    ...accounts.filter((account) => String(account.userId) !== userId),
  ];

  await setJson(MOBILE_ACCOUNTS_KEY, nextAccounts);
  return nextAccounts;
}

export async function removeMobileAccountSession(userId) {
  if (!userId) {
    return getMobileAccounts();
  }

  const accounts = await getMobileAccounts();
  const nextAccounts = accounts.filter(
    (account) => String(account.userId) !== String(userId)
  );

  await setJson(MOBILE_ACCOUNTS_KEY, nextAccounts);
  return nextAccounts;
}
