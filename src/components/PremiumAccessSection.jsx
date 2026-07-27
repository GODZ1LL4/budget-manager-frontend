import { useCallback, useEffect, useRef, useState } from "react";
import { App as CapacitorApp } from "@capacitor/app";
import {
  HiBadgeCheck,
  HiCreditCard,
  HiExternalLink,
  HiRefresh,
  HiSparkles,
  HiTicket,
} from "react-icons/hi";
import { toast } from "react-toastify";
import {
  acknowledgeGooglePlayPurchase,
  confirmGooglePlayPurchase,
  getGooglePlayPremiumProductType,
  hasGooglePlayPremiumConfigured,
  isGooglePlayBillingSupported,
  listGooglePlayPremiumProducts,
  openGooglePlayRedeemCode,
  purchaseGooglePlayPremium,
  restoreGooglePlayPremiumAccess,
  GOOGLE_PLAY_PRODUCT_TYPES,
} from "../lib/subscription/googlePlayBilling";
import { SUBSCRIPTION_MODES } from "../lib/subscription/subscriptionAccess";

function cleanProductTitle(title) {
  return String(title || "FinanceFlow Premium").replace(/\s*\([^)]*\)\s*$/, "");
}

function PremiumAccessSection({
  token,
  subscriptionMode,
  onSubscriptionModeChange,
}) {
  const [product, setProduct] = useState(null);
  const [products, setProducts] = useState([]);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const redeemSyncPendingRef = useRef(false);
  const redeemOpenedAtRef = useRef(0);

  const billingSupported = isGooglePlayBillingSupported();
  const billingConfigured = hasGooglePlayPremiumConfigured();
  const productType = getGooglePlayPremiumProductType();
  const isPremiumActive =
    subscriptionMode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE;
  const hasPlanOptions = products.length > 1;
  const planTitle = cleanProductTitle(product?.title);
  const priceLabel = isLoadingProduct
    ? "Cargando precio..."
    : product?.formattedPrice || "Disponible en Google Play";
  const planDescription =
    product?.description ||
    (productType === GOOGLE_PLAY_PRODUCT_TYPES.SUBS
      ? "Acceso Premium con renovacion administrada por Google Play."
      : "Acceso Premium administrado por Google Play.");

  useEffect(() => {
    if (!billingSupported || !billingConfigured) {
      return undefined;
    }

    let cancelled = false;

    const loadProducts = async () => {
      setIsLoadingProduct(true);

      try {
        const products = await listGooglePlayPremiumProducts();
        if (!cancelled) {
          setProducts(products);
          setProduct(products[0] || null);
          setSelectedProductId(products[0]?.productId || null);
        }
      } catch (error) {
        if (!cancelled) {
          setProducts([]);
          setProduct(null);
          setSelectedProductId(null);
        }

        toast.error(error?.message || "No se pudo cargar Premium");
      } finally {
        if (!cancelled) {
          setIsLoadingProduct(false);
        }
      }
    };

    loadProducts();

    return () => {
      cancelled = true;
    };
  }, [billingSupported, billingConfigured]);

  const applyMode = useCallback(async (mode) => {
    await onSubscriptionModeChange?.(mode);
  }, [onSubscriptionModeChange]);

  const restorePurchases = useCallback(async () => {
    const result = await restoreGooglePlayPremiumAccess({ token });

    if (result.purchases.length) {
      await applyMode(result.subscriptionMode);
    }

    return result;
  }, [applyMode, token]);

  const syncRedeemedPurchase = useCallback(async () => {
    if (!redeemSyncPendingRef.current || !token || isRestoring) {
      return;
    }

    const elapsedSinceOpen = Date.now() - redeemOpenedAtRef.current;
    if (elapsedSinceOpen < 1000) {
      return;
    }

    redeemSyncPendingRef.current = false;
    setIsRestoring(true);

    try {
      const result = await restorePurchases();

      if (!result.purchases.length) {
        toast.info("No se encontro una compra Premium para sincronizar");
        return;
      }

      if (result.subscriptionMode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE) {
        toast.success("Premium sincronizado correctamente");
      } else {
        toast.info("El canje fue encontrado, pero no esta activo");
      }
    } catch (error) {
      toast.error(error?.message || "No se pudo sincronizar el canje");
    } finally {
      setIsRestoring(false);
    }
  }, [isRestoring, restorePurchases, token]);

  useEffect(() => {
    if (!billingSupported || !billingConfigured) {
      return undefined;
    }

    let cancelled = false;
    let appStateListener = null;
    let syncTimeoutId = null;

    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        if (syncTimeoutId) {
          window.clearTimeout(syncTimeoutId);
        }

        syncTimeoutId = window.setTimeout(() => {
          syncRedeemedPurchase();
        }, 700);
      }
    })
      .then((listener) => {
        if (cancelled) {
          listener.remove();
          return;
        }

        appStateListener = listener;
      })
      .catch(() => null);

    return () => {
      cancelled = true;
      if (syncTimeoutId) {
        window.clearTimeout(syncTimeoutId);
      }
      appStateListener?.remove();
    };
  }, [billingConfigured, billingSupported, syncRedeemedPurchase]);

  const handlePurchase = async (targetProduct = null) => {
    if (!token) {
      toast.error("Necesitas iniciar sesion para activar Premium");
      return;
    }

    const productToBuy = targetProduct || product;

    setIsPurchasing(true);

    try {
      const purchase = await purchaseGooglePlayPremium({
        productId: productToBuy?.productId,
        offerToken: productToBuy?.offerToken,
      });

      if (!purchase) {
        throw new Error("Google Play no devolvio una compra valida");
      }

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

      await applyMode(
        confirmation?.subscriptionMode || SUBSCRIPTION_MODES.PREMIUM_ACTIVE
      );

      toast.success("Premium activado correctamente");
    } catch (error) {
      toast.error(error?.message || "No se pudo completar la compra");
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleRedeemPromoCode = async (targetProduct = null) => {
    toast.info("En Google Play, elige Canjear codigo como metodo de pago.");
    await handlePurchase(targetProduct);
  };

  const handleOpenPlayStoreRedeem = async () => {
    try {
      await openGooglePlayRedeemCode(promoCode);
      redeemSyncPendingRef.current = true;
      redeemOpenedAtRef.current = Date.now();
      toast.info("Al volver de Google Play, sincronizare tu Premium.");
    } catch (error) {
      toast.error(error?.message || "No se pudo abrir Google Play");
    }
  };

  const handleRestore = async () => {
    if (!token) {
      toast.error("Necesitas iniciar sesion para restaurar compras");
      return;
    }

    setIsRestoring(true);

    try {
      const result = await restorePurchases();

      if (!result.purchases.length) {
        toast.info("No se encontraron compras para restaurar");
        return;
      }

      if (result.subscriptionMode === SUBSCRIPTION_MODES.PREMIUM_ACTIVE) {
        toast.success("Premium restaurado correctamente");
      } else {
        toast.info("La compra fue encontrada, pero no esta activa");
      }
    } catch (error) {
      toast.error(error?.message || "No se pudo restaurar la compra");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <div className="space-y-4">
      <div
        className="rounded-lg border px-4 py-4"
        style={{
          borderColor: isPremiumActive
            ? "color-mix(in srgb, var(--success) 36%, var(--border-rgba))"
            : "color-mix(in srgb, var(--primary) 30%, var(--border-rgba))",
          background: isPremiumActive
            ? "color-mix(in srgb, var(--success) 10%, var(--panel))"
            : "color-mix(in srgb, var(--primary) 9%, var(--panel))",
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 gap-3">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
              style={{
                borderColor: isPremiumActive
                  ? "color-mix(in srgb, var(--success) 35%, var(--border-rgba))"
                  : "color-mix(in srgb, var(--primary) 35%, var(--border-rgba))",
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                color: isPremiumActive ? "var(--success)" : "var(--primary)",
              }}
            >
              {isPremiumActive ? (
                <HiBadgeCheck className="h-6 w-6" aria-hidden="true" />
              ) : (
                <HiSparkles className="h-6 w-6" aria-hidden="true" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-semibold text-[var(--text)]">
                  {planTitle}
                </h3>
                <span
                  className="rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                  style={{
                    borderColor: isPremiumActive
                      ? "color-mix(in srgb, var(--success) 42%, var(--border-rgba))"
                      : "var(--border-rgba)",
                    color: isPremiumActive ? "var(--success)" : "var(--muted)",
                  }}
                >
                  {isPremiumActive ? "Activo" : "Disponible"}
                </span>
              </div>

              <p className="mt-1 text-sm text-[var(--muted)]">
                {planDescription}
              </p>
            </div>
          </div>

          <div className="shrink-0 text-left sm:text-right">
            <div className="text-sm font-semibold text-[var(--primary)]">
              {priceLabel}
            </div>
            <div className="mt-1 text-xs text-[var(--muted)]">
              {productType === GOOGLE_PLAY_PRODUCT_TYPES.SUBS
                ? "Suscripcion"
                : "Compra unica"}
            </div>
          </div>
        </div>
      </div>

      {!billingSupported && (
        <div
          className="rounded-lg border px-4 py-3 text-sm text-[var(--muted)]"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 72%, transparent)",
          }}
        >
          Premium se compra desde la app instalada en Android.
        </div>
      )}

      {billingSupported && !billingConfigured && (
        <div
          className="rounded-lg border px-4 py-3 text-sm text-[var(--muted)]"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 72%, transparent)",
          }}
        >
          Premium no esta disponible para compra en este momento.
        </div>
      )}

      {billingSupported && billingConfigured && (
        <>
          {hasPlanOptions && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {products.map((entry) => {
                const isSelected = selectedProductId === entry.productId;

                return (
                  <button
                    key={entry.productId}
                    type="button"
                    onClick={() => {
                      setSelectedProductId(entry.productId);
                      setProduct(entry);
                    }}
                    className="rounded-lg border px-3 py-3 text-left transition-colors"
                    style={{
                      borderColor: isSelected
                        ? "color-mix(in srgb, var(--primary) 45%, var(--border-rgba))"
                        : "var(--border-rgba)",
                      background: isSelected
                        ? "color-mix(in srgb, var(--primary) 10%, var(--panel))"
                        : "color-mix(in srgb, var(--panel) 72%, transparent)",
                    }}
                  >
                    <div className="text-sm font-semibold text-[var(--text)]">
                      {cleanProductTitle(entry.title)}
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {entry.formattedPrice || "Google Play"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <div
            className="rounded-lg border p-3"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 72%, transparent)",
            }}
          >
            <label className="ff-label">Codigo promocional</label>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={promoCode}
                onChange={(event) =>
                  setPromoCode(event.target.value.trim().toUpperCase())
                }
                className="ff-input"
                placeholder="Ej. FINANCEFLOW30"
                autoCapitalize="characters"
              />
              <button
                type="button"
                onClick={handleOpenPlayStoreRedeem}
                className="ff-btn w-full sm:w-auto"
              >
                <HiExternalLink className="h-4 w-4" aria-hidden="true" />
                Canjear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => handlePurchase(product)}
              disabled={isLoadingProduct || isPurchasing || isPremiumActive}
              className="ff-btn ff-btn-primary w-full"
            >
              <HiCreditCard className="h-4 w-4" aria-hidden="true" />
              {isPurchasing
                ? "Procesando..."
                : isPremiumActive
                  ? "Premium activo"
                  : "Activar"}
            </button>

            <button
              type="button"
              onClick={() => handleRedeemPromoCode(product)}
              disabled={isLoadingProduct || isPurchasing}
              className="ff-btn w-full"
            >
              <HiTicket className="h-4 w-4" aria-hidden="true" />
              Codigo
            </button>

            <button
              type="button"
              onClick={handleRestore}
              disabled={isRestoring}
              className="ff-btn w-full"
            >
              <HiRefresh className="h-4 w-4" aria-hidden="true" />
              {isRestoring ? "Restaurando..." : "Restaurar"}
            </button>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Los codigos promocionales pueden canjearse en el flujo de compra o
            directamente en Google Play. Despues del canje, restaura el acceso.
          </p>
        </>
      )}
    </div>
  );
}

export default PremiumAccessSection;
