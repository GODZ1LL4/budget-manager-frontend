import { getJson, setJson } from "../storage/kvStore";

export const SUBSCRIPTION_MODE_KEY = "subscription_mode_v1";

export const SUBSCRIPTION_MODES = {
  LOCAL_ONLY: "local_only",
  PREMIUM_ACTIVE: "premium_active",
  PREMIUM_INACTIVE: "premium_inactive",
};

export async function getSubscriptionMode() {
  const mode = await getJson(SUBSCRIPTION_MODE_KEY, null);

  return Object.values(SUBSCRIPTION_MODES).includes(mode)
    ? mode
    : null;
}

export async function setSubscriptionMode(mode) {
  const safeMode = Object.values(SUBSCRIPTION_MODES).includes(mode)
    ? mode
    : SUBSCRIPTION_MODES.LOCAL_ONLY;

  await setJson(SUBSCRIPTION_MODE_KEY, safeMode);
  return safeMode;
}

export function getForcedSubscriptionMode() {
  const forcedMode = (import.meta.env.VITE_FORCE_SUBSCRIPTION_MODE || "").trim();

  return Object.values(SUBSCRIPTION_MODES).includes(forcedMode)
    ? forcedMode
    : null;
}

export function canUsePremiumBackend(mode) {
  if (!mode) return true;
  return mode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE;
}

export function canSyncRemote(mode) {
  if (!mode) return true;
  return mode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE;
}

export function isLocalOnlyMode(mode) {
  if (!mode) return false;
  return (
    mode === SUBSCRIPTION_MODES.LOCAL_ONLY ||
    mode === SUBSCRIPTION_MODES.PREMIUM_INACTIVE
  );
}
