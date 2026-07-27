import axios from "axios";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  getForcedSubscriptionMode,
  getSubscriptionMode,
  setSubscriptionMode,
  SUBSCRIPTION_MODES,
} from "./subscriptionAccess";

const GooglePlayBilling = registerPlugin("GooglePlayBilling");
const api = import.meta.env.VITE_API_URL;

export const GOOGLE_PLAY_PRODUCT_TYPES = {
  INAPP: "inapp",
  SUBS: "subs",
};

export function getGooglePlayPremiumProductIds() {
  const multiValue = (import.meta.env.VITE_GOOGLE_PLAY_PREMIUM_PRODUCT_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (multiValue.length) {
    return multiValue;
  }

  const singleValue = (import.meta.env.VITE_GOOGLE_PLAY_PREMIUM_PRODUCT_ID || "")
    .trim();

  return singleValue ? [singleValue] : [];
}

export function getGooglePlayPremiumProductId() {
  return getGooglePlayPremiumProductIds()[0] || "";
}

export function getGooglePlayPremiumProductType() {
  const rawType = (import.meta.env.VITE_GOOGLE_PLAY_BILLING_PRODUCT_TYPE || "")
    .trim()
    .toLowerCase();

  return rawType === GOOGLE_PLAY_PRODUCT_TYPES.INAPP
    ? GOOGLE_PLAY_PRODUCT_TYPES.INAPP
    : GOOGLE_PLAY_PRODUCT_TYPES.SUBS;
}

export function isGooglePlayBillingSupported() {
  return Capacitor.getPlatform() === "android";
}

export function hasGooglePlayPremiumConfigured() {
  return getGooglePlayPremiumProductIds().length > 0;
}

function buildBackendBillingError(error) {
  const responseData = error?.response?.data;

  if (!responseData) {
    return error;
  }

  const stage = responseData.stage ? `${responseData.stage}: ` : "";
  const message =
    responseData.error ||
    responseData.message ||
    error?.message ||
    "No se pudo validar la suscripcion";
  const nextError = new Error(`${stage}${message}`);
  nextError.response = error.response;
  nextError.details = responseData.details || null;
  nextError.stage = responseData.stage || null;

  return nextError;
}

export async function listGooglePlayPremiumProducts() {
  const productIds = getGooglePlayPremiumProductIds();
  const productType = getGooglePlayPremiumProductType();

  if (!productIds.length) {
    return [];
  }

  const response = await GooglePlayBilling.getProducts({
    productIds,
    productType,
  });

  return response?.products || [];
}

export async function purchaseGooglePlayPremium({ productId, offerToken } = {}) {
  const safeProductId = productId || getGooglePlayPremiumProductId();
  const productType = getGooglePlayPremiumProductType();

  if (!safeProductId) {
    throw new Error("No hay un productId de Google Play configurado");
  }

  const response = await GooglePlayBilling.purchase({
    productId: safeProductId,
    productType,
    offerToken,
  });

  return response?.purchase || null;
}

export async function openGooglePlayRedeemCode(code = "") {
  return GooglePlayBilling.openRedeemCode({
    code: String(code || "").trim(),
  });
}

export async function getGooglePlayPurchases() {
  const response = await GooglePlayBilling.getPurchases({
    productType: getGooglePlayPremiumProductType(),
  });

  const purchases = response?.purchases || [];
  const premiumProductIds = new Set(getGooglePlayPremiumProductIds());

  return purchases.filter((purchase) =>
    Array.isArray(purchase?.products)
      ? purchase.products.some((productId) => premiumProductIds.has(productId))
      : false
  );
}

export async function acknowledgeGooglePlayPurchase(purchaseToken) {
  if (!purchaseToken) {
    return null;
  }

  return GooglePlayBilling.acknowledgePurchase({ purchaseToken });
}

export async function restoreGooglePlayPremiumAccess({ token }) {
  if (!token) {
    throw new Error("Necesitas iniciar sesion para restaurar compras");
  }

  const purchases = await getGooglePlayPurchases();
  let lastMode = SUBSCRIPTION_MODES.PREMIUM_INACTIVE;
  const confirmations = [];

  for (const purchase of purchases) {
    const confirmation = await confirmGooglePlayPurchase({
      token,
      purchase,
    });

    if (
      purchase.purchaseState === "purchased" &&
      !purchase.acknowledged &&
      purchase.purchaseToken
    ) {
      await acknowledgeGooglePlayPurchase(purchase.purchaseToken).catch(
        () => null
      );
    }

    confirmations.push(confirmation);

    if (confirmation?.subscriptionMode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE) {
      lastMode = SUBSCRIPTION_MODES.PREMIUM_ACTIVE;
    } else if (
      lastMode !== SUBSCRIPTION_MODES.PREMIUM_ACTIVE &&
      confirmation?.subscriptionMode
    ) {
      lastMode = confirmation.subscriptionMode;
    }
  }

  return {
    purchases,
    confirmations,
    subscriptionMode: lastMode,
  };
}

async function restoreGooglePlayPremiumAccessIfAvailable(token) {
  if (
    !token ||
    !isGooglePlayBillingSupported() ||
    !hasGooglePlayPremiumConfigured()
  ) {
    return null;
  }

  try {
    const result = await restoreGooglePlayPremiumAccess({ token });

    return result?.purchases?.length ? result : null;
  } catch {
    return null;
  }
}

export async function confirmGooglePlayPurchase({ token, purchase }) {
  if (!token) {
    throw new Error("Se necesita sesion para confirmar la compra");
  }

  if (!purchase?.purchaseToken) {
    throw new Error("La compra no contiene purchaseToken");
  }

  const productId = Array.isArray(purchase.products)
    ? purchase.products[0]
    : null;

  if (!productId) {
    throw new Error("La compra no contiene productId");
  }

  const status =
    purchase.purchaseState === "purchased" ? "active" : "pending";

  let response;

  try {
    response = await axios.post(
      `${api}/billing/google-play/confirm`,
      {
        productId,
        purchaseToken: purchase.purchaseToken,
        productType: getGooglePlayPremiumProductType(),
        orderId: purchase.orderId || null,
        status,
        expiresAt: null,
        autoRenewing: Boolean(purchase.autoRenewing),
        rawPayload: {
          ...purchase,
          productType: getGooglePlayPremiumProductType(),
        },
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );
  } catch (error) {
    throw buildBackendBillingError(error);
  }

  const mode =
    response?.data?.data?.subscriptionMode ||
    SUBSCRIPTION_MODES.PREMIUM_INACTIVE;

  await setSubscriptionMode(mode);
  return response?.data?.data || null;
}

export async function syncSubscriptionAccessFromBackend(token) {
  const forcedMode = getForcedSubscriptionMode();
  if (forcedMode) {
    await setSubscriptionMode(forcedMode);
    return forcedMode;
  }

  if (!token) {
    return SUBSCRIPTION_MODES.LOCAL_ONLY;
  }

  const restoredGooglePlayAccess =
    await restoreGooglePlayPremiumAccessIfAvailable(token);
  const restoredMode = restoredGooglePlayAccess?.subscriptionMode || null;

  try {
    const response = await axios.get(`${api}/me/subscription-access`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const mode =
      response?.data?.data?.mode || SUBSCRIPTION_MODES.PREMIUM_INACTIVE;
    const nextMode =
      restoredMode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE
        ? restoredMode
        : mode;

    await setSubscriptionMode(nextMode);
    return nextMode;
  } catch {
    if (restoredMode) {
      await setSubscriptionMode(restoredMode);
      return restoredMode;
    }

    return (
      (await getSubscriptionMode().catch(() => null)) ||
      SUBSCRIPTION_MODES.LOCAL_ONLY
    );
  }
}
