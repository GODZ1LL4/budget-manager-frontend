import { toast } from "react-toastify";
import { getAppPreferences } from "../preferences/appPreferences";

const guardedMethods = [
  "success",
  "error",
  "info",
  "warn",
  "warning",
  "dark",
  "loading",
  "update",
  "done",
];

let installed = false;

function canShowToasts() {
  return getAppPreferences().showToasts !== false;
}

export function clearToastBacklog() {
  toast.dismiss();
  toast.clearWaitingQueue?.();
}

export function installToastPreferenceGuard() {
  if (installed) {
    return;
  }

  installed = true;

  guardedMethods.forEach((method) => {
    const original = toast[method];

    if (typeof original !== "function") {
      return;
    }

    toast[method] = (...args) => {
      if (!canShowToasts()) {
        return null;
      }

      return original(...args);
    };
  });

  const originalPromise = toast.promise;

  if (typeof originalPromise === "function") {
    toast.promise = (promise, ...args) => {
      if (!canShowToasts()) {
        return promise;
      }

      return originalPromise(promise, ...args);
    };
  }
}
