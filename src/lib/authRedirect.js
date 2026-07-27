import { Capacitor } from "@capacitor/core";

export const AUTH_ACTION_PARAM = "auth_action";
export const DEFAULT_MOBILE_AUTH_REDIRECT_URL = "financeflow://auth-callback";

export const AUTH_ACTIONS = {
  confirmEmail: "confirm_email",
  resetPassword: "reset_password",
};

const AUTH_QUERY_KEYS = [
  AUTH_ACTION_PARAM,
  "error",
  "error_code",
  "error_description",
  "type",
];

const isNativeRuntime = () =>
  typeof Capacitor?.getPlatform === "function" &&
  Capacitor.getPlatform() !== "web";

const getRuntimeBaseUrl = (urlLike) => {
  if (urlLike) {
    return urlLike;
  }

  if (typeof window === "undefined") {
    return "/";
  }

  const basePath = import.meta.env.BASE_URL || "/";
  return new URL(basePath, window.location.origin).toString();
};

const normalizeBaseUrl = (value) => {
  const explicitUrl = String(value || "").trim();

  if (!explicitUrl) {
    return getRuntimeBaseUrl();
  }

  if (typeof window === "undefined") {
    return explicitUrl;
  }

  return new URL(explicitUrl, window.location.origin).toString();
};

const getAuthRedirectBaseUrl = () => {
  if (isNativeRuntime()) {
    return normalizeBaseUrl(
      import.meta.env.VITE_MOBILE_AUTH_REDIRECT_URL ||
        DEFAULT_MOBILE_AUTH_REDIRECT_URL
    );
  }

  return normalizeBaseUrl(import.meta.env.VITE_AUTH_REDIRECT_URL);
};

export function getAuthRedirectUrl(action) {
  const url = new URL(getAuthRedirectBaseUrl());
  url.searchParams.set(AUTH_ACTION_PARAM, action);
  return url.toString();
}

const getUrlParts = (urlLike) => {
  if (urlLike) {
    const parsedUrl = new URL(getRuntimeBaseUrl(urlLike));
    return {
      searchParams: parsedUrl.searchParams,
      hash: parsedUrl.hash,
    };
  }

  if (typeof window === "undefined") {
    return {
      searchParams: new URLSearchParams(),
      hash: "",
    };
  }

  return {
    searchParams: new URLSearchParams(window.location.search),
    hash: window.location.hash,
  };
};

const readHashParams = (hash) => {
  if (!hash) {
    return new URLSearchParams();
  }

  return new URLSearchParams(hash.replace(/^#/, ""));
};

export function readAuthUrlState(urlLike) {
  if (typeof window === "undefined" && !urlLike) {
    return {};
  }

  const { searchParams, hash } = getUrlParts(urlLike);
  const hashParams = readHashParams(hash);
  const read = (key) => searchParams.get(key) || hashParams.get(key);
  const action = read(AUTH_ACTION_PARAM);
  const type = read("type");
  const error = read("error");
  const errorCode = read("error_code");
  const errorDescription = read("error_description");
  const accessToken = read("access_token");
  const refreshToken = read("refresh_token");
  const code = read("code");
  const hasTokens = Boolean(accessToken && refreshToken);
  const hasAuthParams = Boolean(
    action ||
      type ||
      error ||
      errorCode ||
      errorDescription ||
      hasTokens ||
      code
  );

  return {
    accessToken,
    action,
    code,
    type,
    error,
    errorCode,
    errorDescription,
    hasAuthParams,
    hasTokens,
    refreshToken,
    isEmailConfirmation:
      action === AUTH_ACTIONS.confirmEmail || type === "signup",
    isPasswordRecovery:
      action === AUTH_ACTIONS.resetPassword || type === "recovery",
  };
}

export function clearAuthUrlState() {
  if (typeof window === "undefined" || !window.history?.replaceState) {
    return;
  }

  const url = new URL(window.location.href);
  AUTH_QUERY_KEYS.forEach((key) => url.searchParams.delete(key));
  url.hash = "";
  window.history.replaceState(
    {},
    document.title,
    `${url.pathname}${url.search}`
  );
}
