import axios from "axios";

const BACKEND_UNAVAILABLE_CODE = "BACKEND_UNAVAILABLE";
const BACKEND_STATUS_EVENT = "financeflow:backend-status";
const DEFAULT_TIMEOUT_MS = 4500;
const DEFAULT_COOLDOWN_MS = 18000;
const DEFAULT_PROBE_TIMEOUT_MS = 8000;
const FAST_FALLBACK_PREFIXES = [
  "/accounts",
  "/budgets",
  "/categories",
  "/goals",
  "/item-prices",
  "/items",
  "/items-with-price",
  "/me/subscription-access",
  "/taxes",
  "/transactions",
];

let guardsInstalled = false;
let backendUnavailableUntil = 0;
let backendUnavailableReason = null;
let lastEmittedState = null;

function readNumberEnv(name, fallback) {
  const value = Number(import.meta.env?.[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function getApiBaseUrl() {
  return String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
}

function getBackendHealthUrl() {
  const apiBase = getApiBaseUrl();
  if (!apiBase) return "";
  return `${apiBase}/health`;
}

function getRequestTimeoutMs() {
  return readNumberEnv("VITE_API_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
}

function getBackendCooldownMs() {
  return readNumberEnv("VITE_BACKEND_COOLDOWN_MS", DEFAULT_COOLDOWN_MS);
}

function getProbeTimeoutMs() {
  return readNumberEnv("VITE_BACKEND_PROBE_TIMEOUT_MS", DEFAULT_PROBE_TIMEOUT_MS);
}

function isAppBackendRequest(config = {}) {
  const apiBase = getApiBaseUrl();
  const url = String(config?.url || "");

  if (!apiBase || !url) {
    return false;
  }

  if (url.startsWith(apiBase)) {
    return true;
  }

  if (!config?.baseURL) {
    return false;
  }

  try {
    return new URL(url, config.baseURL).toString().startsWith(apiBase);
  } catch {
    return false;
  }
}

function getBackendRequestPath(config = {}) {
  const apiBase = getApiBaseUrl();
  const url = String(config?.url || "");
  let fullUrl = url;

  if (!apiBase || !url) {
    return "";
  }

  if (config?.baseURL) {
    try {
      fullUrl = new URL(url, config.baseURL).toString();
    } catch {
      fullUrl = url;
    }
  }

  if (!fullUrl.startsWith(apiBase)) {
    return "";
  }

  const path = fullUrl.slice(apiBase.length) || "/";
  return path.startsWith("/") ? path : `/${path}`;
}

function shouldUseFastFallback(config = {}) {
  if (config.ffFastFallback === true) {
    return true;
  }

  if (config.ffFastFallback === false || config.responseType === "blob") {
    return false;
  }

  const path = getBackendRequestPath(config);
  return FAST_FALLBACK_PREFIXES.some(
    (prefix) =>
      path === prefix || path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`)
  );
}

function createBackendUnavailableError(reason = "cooldown") {
  const error = new Error("Backend temporarily unavailable");
  error.code = BACKEND_UNAVAILABLE_CODE;
  error.reason = reason;
  error.isBackendUnavailable = true;
  return error;
}

export function isDeviceOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function isBackendCoolingDown() {
  return isDeviceOnline() && Date.now() < backendUnavailableUntil;
}

export function shouldAttemptBackendRequest() {
  return isDeviceOnline() && !isBackendCoolingDown();
}

export function getBackendConnectionStatus() {
  if (!isDeviceOnline()) {
    return {
      state: "offline",
      reason: "device_offline",
      retryAt: null,
    };
  }

  if (isBackendCoolingDown()) {
    return {
      state: "backend_waking",
      reason: backendUnavailableReason || "timeout",
      retryAt: backendUnavailableUntil,
    };
  }

  return {
    state: "online",
    reason: null,
    retryAt: null,
  };
}

function emitBackendConnectionStatus() {
  if (typeof window === "undefined") return;

  const status = getBackendConnectionStatus();
  const stateKey = `${status.state}:${status.reason || ""}:${status.retryAt || ""}`;

  if (stateKey === lastEmittedState) {
    return;
  }

  lastEmittedState = stateKey;
  window.dispatchEvent(
    new CustomEvent(BACKEND_STATUS_EVENT, {
      detail: status,
    })
  );
}

export function subscribeBackendConnectionStatus(listener) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = (event) => listener(event.detail || getBackendConnectionStatus());
  window.addEventListener(BACKEND_STATUS_EVENT, handler);
  listener(getBackendConnectionStatus());

  return () => window.removeEventListener(BACKEND_STATUS_EVENT, handler);
}

export function markBackendAvailable() {
  if (!backendUnavailableUntil && !backendUnavailableReason) {
    return;
  }

  backendUnavailableUntil = 0;
  backendUnavailableReason = null;
  emitBackendConnectionStatus();
}

export function markBackendUnavailable(error) {
  if (!isOfflineLikeError(error) || error?.code === BACKEND_UNAVAILABLE_CODE) {
    return;
  }

  backendUnavailableUntil = Date.now() + getBackendCooldownMs();
  backendUnavailableReason =
    error?.code === "ECONNABORTED" || String(error?.message || "").includes("timeout")
      ? "timeout"
      : `status_${error?.response?.status || "network"}`;

  emitBackendConnectionStatus();
}

export function isOfflineLikeError(error) {
  if (!error) return false;

  if (error.code === BACKEND_UNAVAILABLE_CODE) {
    return true;
  }

  if (error.code === "ECONNABORTED" || error.code === "ERR_NETWORK") {
    return true;
  }

  if (String(error.message || "").toLowerCase().includes("timeout")) {
    return true;
  }

  if (!error.response) {
    return true;
  }

  const status = Number(error.response?.status || 0);

  // Gateway/network style failures should fall back to local mode.
  if ([0, 502, 503, 504].includes(status)) {
    return true;
  }

  return false;
}

export function installBackendNetworkGuards() {
  if (guardsInstalled) {
    return;
  }

  guardsInstalled = true;

  axios.interceptors.request.use((config) => {
    if (!isAppBackendRequest(config)) {
      return config;
    }

    const fastFallback = shouldUseFastFallback(config);
    const nextConfig = {
      ...config,
      timeout: config.timeout || (fastFallback ? getRequestTimeoutMs() : 0),
    };

    if (
      fastFallback &&
      !nextConfig.ffBypassBackendCooldown &&
      isBackendCoolingDown()
    ) {
      return Promise.reject(createBackendUnavailableError("cooldown"));
    }

    return nextConfig;
  });

  axios.interceptors.response.use(
    (response) => {
      if (isAppBackendRequest(response.config)) {
        markBackendAvailable();
      }

      return response;
    },
    (error) => {
      if (isAppBackendRequest(error?.config)) {
        if (isOfflineLikeError(error)) {
          markBackendUnavailable(error);
        } else if (error?.response) {
          markBackendAvailable();
        }
      }

      return Promise.reject(error);
    }
  );

  if (typeof window !== "undefined") {
    window.addEventListener("online", emitBackendConnectionStatus);
    window.addEventListener("offline", emitBackendConnectionStatus);
  }
}

export async function probeBackend() {
  const healthUrl = getBackendHealthUrl();

  if (!healthUrl || !isDeviceOnline()) {
    return false;
  }

  try {
    await axios.get(healthUrl, {
      timeout: getProbeTimeoutMs(),
      ffBypassBackendCooldown: true,
      validateStatus: () => true,
    });
    markBackendAvailable();
    return true;
  } catch (error) {
    markBackendUnavailable(error);
    return false;
  }
}
