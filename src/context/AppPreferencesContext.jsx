import { createContext, useContext, useEffect, useMemo, useState } from "react";
import * as preferencesApi from "../lib/preferences/appPreferences";
import { DEFAULT_LOCALE, messages } from "../lib/i18n/messages";

const AppPreferencesContext = createContext(null);

function resolveLocale(preferences) {
  const locale = preferences?.locale || DEFAULT_LOCALE;
  if (messages[locale]) return locale;

  const baseLocale = String(locale).split("-")[0].toLowerCase();
  const matchedLocale = Object.keys(messages).find(
    (key) => String(key).split("-")[0].toLowerCase() === baseLocale
  );

  return matchedLocale || DEFAULT_LOCALE;
}

function getValueByPath(source, path) {
  return String(path)
    .split(".")
    .reduce((current, key) => (current == null ? undefined : current[key]), source);
}

function interpolateMessage(template, params = {}) {
  if (typeof template !== "string") return template;

  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const value = params[key];
    return value == null ? `{${key}}` : String(value);
  });
}

export function AppPreferencesProvider({ children }) {
  const [preferences, setPreferencesState] = useState(() =>
    typeof preferencesApi.getAppPreferences === "function"
      ? preferencesApi.getAppPreferences()
      : { locale: DEFAULT_LOCALE, currency: "DOP" }
  );

  useEffect(() => {
    const syncPreferences = () => {
      if (typeof preferencesApi.getAppPreferences === "function") {
        setPreferencesState(preferencesApi.getAppPreferences());
      }
    };

    window.addEventListener("storage", syncPreferences);
    window.addEventListener("focus", syncPreferences);
    return () => {
      window.removeEventListener("storage", syncPreferences);
      window.removeEventListener("focus", syncPreferences);
    };
  }, []);

  const locale = useMemo(() => resolveLocale(preferences), [preferences]);
  const dictionary = useMemo(() => messages[locale] || messages[DEFAULT_LOCALE], [locale]);
  const isEnglish = locale.toLowerCase().startsWith("en");

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => {
    const setPreferences = (partial) => {
      const nextPreferences = {
        ...preferences,
        ...(typeof partial === "function" ? partial(preferences) : partial),
      };

      if (typeof preferencesApi.saveAppPreferences === "function") {
        preferencesApi.saveAppPreferences(nextPreferences);
      } else if (typeof preferencesApi.setAppPreferences === "function") {
        preferencesApi.setAppPreferences(nextPreferences);
      }

      setPreferencesState(nextPreferences);
    };

    const t = (path, params) => {
      const message =
        getValueByPath(dictionary, path) ??
        getValueByPath(messages[DEFAULT_LOCALE], path) ??
        path;

      if (typeof message === "function") {
        return message(params);
      }

      return interpolateMessage(message, params);
    };

    const formatCurrency = (amount) => {
      if (typeof preferencesApi.formatCurrencyByPreference === "function") {
        return preferencesApi.formatCurrencyByPreference(amount, preferences);
      }
      return String(amount ?? 0);
    };

    const formatMonthLabel = (monthValue) => {
      if (!monthValue) return t("budgets.noMonth");

      const [year, month] = String(monthValue).split("-");
      const date = new Date(Number(year), Number(month) - 1, 1);
      if (Number.isNaN(date.getTime())) return monthValue;

      return date.toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      });
    };

    return {
      preferences,
      locale,
      isEnglish,
      setPreferences,
      t,
      formatCurrency,
      formatMonthLabel,
    };
  }, [dictionary, isEnglish, locale, preferences]);

  return (
    <AppPreferencesContext.Provider value={value}>
      {children}
    </AppPreferencesContext.Provider>
  );
}

export function useAppPreferences() {
  const context = useContext(AppPreferencesContext);
  if (!context) {
    throw new Error("useAppPreferences must be used within AppPreferencesProvider");
  }
  return context;
}
