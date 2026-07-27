const APP_PREFERENCES_KEY = "app_preferences_v1";

export const DEFAULT_APP_PREFERENCES = {
  currency: "DOP",
  locale: "es-DO",
  showToasts: true,
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function normalizePreferences(value) {
  const input = value && typeof value === "object" ? value : {};

  return {
    currency: String(input.currency || DEFAULT_APP_PREFERENCES.currency),
    locale: String(input.locale || DEFAULT_APP_PREFERENCES.locale),
    showToasts:
      typeof input.showToasts === "boolean"
        ? input.showToasts
        : DEFAULT_APP_PREFERENCES.showToasts,
  };
}

export function getAppPreferences() {
  if (!canUseStorage()) {
    return { ...DEFAULT_APP_PREFERENCES };
  }

  try {
    const raw = window.localStorage.getItem(APP_PREFERENCES_KEY);
    if (!raw) {
      return { ...DEFAULT_APP_PREFERENCES };
    }

    return normalizePreferences(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_APP_PREFERENCES };
  }
}

export function setAppPreferences(nextPreferences) {
  const normalized = normalizePreferences(nextPreferences);

  if (canUseStorage()) {
    try {
      window.localStorage.setItem(
        APP_PREFERENCES_KEY,
        JSON.stringify(normalized)
      );
    } catch {
      // ignore persistence errors
    }
  }

  return normalized;
}

export function updateAppPreferences(partialPreferences) {
  const current = getAppPreferences();
  return setAppPreferences({
    ...current,
    ...(partialPreferences || {}),
  });
}

export function formatCurrencyByPreference(value, preferences) {
  const normalized = normalizePreferences(preferences);

  try {
    return new Intl.NumberFormat(normalized.locale, {
      style: "currency",
      currency: normalized.currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch {
    return `${Number(value || 0).toFixed(2)} ${normalized.currency}`;
  }
}
