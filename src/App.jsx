import { useState, useEffect, useRef, useCallback } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import supabase from "./lib/supabase";
import Login from "./pages/Login";
import Categories from "./pages/Categories";
import Accounts from "./pages/Accounts";
import Transactions from "./pages/Transactions";
import Budgets from "./pages/Budgets";
import Items from "./pages/Items";
import Goals from "./pages/Goals";
import Projects from "./pages/Projects";
import Dashboard from "./pages/Dashboard";
import AppLayout from "./components/AppLayout";
import {
  AppPreferencesProvider,
  useAppPreferences,
} from "./context/AppPreferencesContext";
import Scenarios from "./pages/Scenarios";
import Theme from "./pages/Theme";
import Preferences from "./pages/Preferences";
import ModernDashboard from "./pages/ModernDashboardPro";
import MobileDashboard from "./pages/MobileDashboard";
import MobileReports from "./pages/MobileReports";
import { ToastContainer } from "react-toastify";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import useOnlineStatus from "./hooks/useOnlineStatus";
import { runBootstrapSync } from "./lib/sync/bootstrapSync";
import { initializeOfflineDatabase } from "./lib/storage/offlineDatabase";
import { ensureLocalDataOwnedByUser } from "./lib/storage/localSessionIsolation";
import {
  getMobileAccounts,
  removeMobileAccountSession,
  saveMobileAccountSession,
} from "./lib/auth/mobileAccounts";
import { syncExpenseReminder } from "./lib/notifications/localNotifications";
import {
  clearToastBacklog,
  installToastPreferenceGuard,
} from "./lib/notifications/toastGuard";
import {
  clearHomeWidgetSnapshot,
  syncHomeWidgetSnapshot,
} from "./lib/widgets/homeWidget";
import { getCachedMobileDashboardSnapshot } from "./lib/mobileDashboard/mobileDashboardCache";
import {
  listAccountBalances,
  listAccounts,
} from "./lib/repositories/accountsRepository";
import { listCategories } from "./lib/repositories/categoriesRepository";
import { listGoals } from "./lib/repositories/goalsRepository";
import { listTransactions } from "./lib/repositories/transactionsRepository";
import { listBudgets } from "./lib/repositories/budgetsRepository";
import { listProjects } from "./lib/repositories/projectsRepository";
import {
  getBackendConnectionStatus,
  probeBackend,
  subscribeBackendConnectionStatus,
} from "./lib/repositories/networkFallback";
import {
  canSyncRemote,
  canUsePremiumBackend,
  getForcedSubscriptionMode,
  getSubscriptionMode,
  setSubscriptionMode as persistSubscriptionMode,
  SUBSCRIPTION_MODES,
} from "./lib/subscription/subscriptionAccess";
import * as preferencesApi from "./lib/preferences/appPreferences";
import { syncSubscriptionAccessFromBackend } from "./lib/subscription/googlePlayBilling";
import { getAuthUrlErrorMessage } from "./lib/authMessages";
import {
  clearAuthUrlState,
  readAuthUrlState,
} from "./lib/authRedirect";

installToastPreferenceGuard();

function ToastPreferenceGate() {
  const { preferences } = useAppPreferences();
  const showToasts = preferences.showToasts !== false;

  useEffect(() => {
    if (!showToasts) {
      clearToastBacklog();
    }
  }, [showToasts]);

  if (!showToasts) {
    return null;
  }

  return (
    <ToastContainer
      position="top-right"
      autoClose={1500}
      limit={2}
      newestOnTop
    />
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [view, setView] = useState("dashboard");
  const [subscriptionMode, setSubscriptionMode] = useState(null);
  const [showConnectionBanner, setShowConnectionBanner] = useState(false);
  const [backendConnectionStatus, setBackendConnectionStatus] = useState(() =>
    getBackendConnectionStatus()
  );
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [mobileAccounts, setMobileAccounts] = useState([]);
  const [isAddingMobileAccount, setIsAddingMobileAccount] = useState(false);
  const [isSwitchingAccount, setIsSwitchingAccount] = useState(false);
  const isOnline = useOnlineStatus();
  const isNativeMobile = Capacitor.getPlatform() !== "web";
  const onlineStatusRef = useRef(null);
  const offlineInitPromiseRef = useRef(null);
  const authUrlHandledRef = useRef(false);

  const applySubscriptionMode = useCallback(async (mode) => {
    const persistedMode = await persistSubscriptionMode(mode).catch(
      () => mode
    );
    setSubscriptionMode(persistedMode || mode);
    return persistedMode || mode;
  }, []);

  const ensureOfflineStorageReady = async () => {
    if (!offlineInitPromiseRef.current) {
      offlineInitPromiseRef.current = initializeOfflineDatabase()
        .then((result) => {
          if (result?.migrated) {
            toast.success("Base local SQLite preparada para uso offline");
          }

          return result;
        })
        .catch(() => null);
    }

    return offlineInitPromiseRef.current;
  };

  const refreshMobileAccounts = useCallback(async () => {
    if (!isNativeMobile) {
      setMobileAccounts([]);
      return [];
    }

    const accounts = await getMobileAccounts().catch(() => []);
    setMobileAccounts(accounts);
    return accounts;
  }, [isNativeMobile]);

  const rememberMobileSession = useCallback(async (authSession) => {
    if (!isNativeMobile || !authSession?.user?.id) {
      return [];
    }

    const accounts = await saveMobileAccountSession(authSession).catch(() => []);
    setMobileAccounts(accounts);
    return accounts;
  }, [isNativeMobile]);

  const warmPremiumOfflineCache = useCallback(async (
    accessToken,
    modeOverride = subscriptionMode
  ) => {
    if (
      !accessToken ||
      !isOnline ||
      !canUsePremiumBackend(modeOverride)
    ) {
      return;
    }

    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(
      now.getMonth() + 1
    ).padStart(2, "0")}`;

    await Promise.allSettled([
      listAccounts({
        token: accessToken,
        subscriptionMode: modeOverride,
      }),
      listAccountBalances({
        token: accessToken,
        subscriptionMode: modeOverride,
      }),
      listCategories({
        token: accessToken,
        subscriptionMode: modeOverride,
      }),
      listTransactions({
        token: accessToken,
        subscriptionMode: modeOverride,
      }),
      listBudgets({
        token: accessToken,
        filterType: "month",
        filterValue: currentMonth,
        subscriptionMode: modeOverride,
      }),
      listGoals({
        token: accessToken,
        subscriptionMode: modeOverride,
      }),
      listProjects({
        token: accessToken,
        subscriptionMode: modeOverride,
      }),
    ]);
  }, [isOnline, subscriptionMode]);

  const finalizeLoginSession = async (authSession) => {
    if (!authSession?.user?.id) {
      setView("dashboard");
      return;
    }

    await ensureOfflineStorageReady();
    await ensureLocalDataOwnedByUser(authSession.user.id);
    await rememberMobileSession(authSession);
    const nextMode = await syncSubscriptionAccessFromBackend(
      authSession.access_token
    ).catch(() => null);
    const effectiveMode =
      nextMode ||
      (await getSubscriptionMode().catch(() => null)) ||
      SUBSCRIPTION_MODES.LOCAL_ONLY;
    await applySubscriptionMode(effectiveMode);
    await warmPremiumOfflineCache(authSession.access_token, effectiveMode);
    setIsAddingMobileAccount(false);
    setView("dashboard");
  };

  const handleAuthUrlState = useCallback((authUrlState, currentSession) => {
    if (!authUrlState?.hasAuthParams || authUrlHandledRef.current) {
      return;
    }

    authUrlHandledRef.current = true;

    if (authUrlState.error || authUrlState.errorCode) {
      toast.error(getAuthUrlErrorMessage(authUrlState));
      clearAuthUrlState();
      return;
    }

    if (authUrlState.isPasswordRecovery) {
      setIsPasswordRecovery(true);
      toast.info("Enlace verificado. Define tu nueva contrasena.");

      if (currentSession || !authUrlState.hasTokens) {
        clearAuthUrlState();
      }

      return;
    }

    if (authUrlState.isEmailConfirmation) {
      toast.success("Correo confirmado. Tu cuenta ya esta activa.");

      if (currentSession || !authUrlState.hasTokens) {
        clearAuthUrlState();
      }
    }
  }, []);

  const handleIncomingAuthUrl = useCallback(async (url) => {
    const authUrlState = readAuthUrlState(url);

    if (!authUrlState?.hasAuthParams) {
      return false;
    }

    authUrlHandledRef.current = false;

    if (authUrlState.error || authUrlState.errorCode) {
      handleAuthUrlState(authUrlState, null);
      return true;
    }

    try {
      let nextSession = null;

      if (authUrlState.hasTokens) {
        const { data, error } = await supabase.auth.setSession({
          access_token: authUrlState.accessToken,
          refresh_token: authUrlState.refreshToken,
        });

        if (error) {
          throw error;
        }

        nextSession = data?.session || null;
      } else if (authUrlState.code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(
          authUrlState.code
        );

        if (error) {
          throw error;
        }

        nextSession = data?.session || null;
      }

      handleAuthUrlState(authUrlState, nextSession);

      if (nextSession) {
        setSession(nextSession);
      }

      return true;
    } catch (error) {
      toast.error(
        getAuthUrlErrorMessage({
          ...authUrlState,
          error: error?.code,
          errorDescription: error?.message,
        })
      );
      return false;
    }
  }, [handleAuthUrlState]);

  useEffect(() => {
    ensureOfflineStorageReady();
  }, [applySubscriptionMode]);

  useEffect(() => {
    refreshMobileAccounts().catch(() => null);
  }, [refreshMobileAccounts]);

  useEffect(() => {
    if (!isNativeMobile) return;

    syncExpenseReminder().catch(() => null);
  }, [isNativeMobile]);

  useEffect(() => {
    if (!isNativeMobile) {
      return undefined;
    }

    let cancelled = false;
    let appUrlOpenListener = null;

    CapacitorApp.getLaunchUrl()
      .then((launchUrl) => {
        if (!cancelled && launchUrl?.url) {
          handleIncomingAuthUrl(launchUrl.url);
        }
      })
      .catch(() => null);

    CapacitorApp.addListener("appUrlOpen", ({ url }) => {
      if (url) {
        handleIncomingAuthUrl(url);
      }
    })
      .then((listener) => {
        if (cancelled) {
          listener.remove();
          return;
        }

        appUrlOpenListener = listener;
      })
      .catch(() => null);

    return () => {
      cancelled = true;
      appUrlOpenListener?.remove();
    };
  }, [handleIncomingAuthUrl, isNativeMobile]);

  useEffect(() => {
    if (!isNativeMobile) {
      return;
    }

    const hydrateWidget = async () => {
      const snapshot = await getCachedMobileDashboardSnapshot().catch(() => null);

      if (!snapshot) {
        return;
      }

      await syncHomeWidgetSnapshot({
        dashboardData: snapshot,
        formatCurrency: (amount) =>
          preferencesApi.formatCurrencyByPreference(
            amount,
            preferencesApi.getAppPreferences()
          ),
      });
    };

    hydrateWidget().catch(() => null);
  }, [isNativeMobile]);

  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      try {
        await ensureOfflineStorageReady();
        const storedMobileAccounts = await refreshMobileAccounts();
        const authUrlState = readAuthUrlState();

        let { data } = await supabase.auth.getSession().catch(() => ({
          data: { session: null },
        }));
        let restoredSession = data?.session || null;

        if (
          !restoredSession &&
          isNativeMobile &&
          storedMobileAccounts[0]?.session &&
          !authUrlState.hasAuthParams
        ) {
          const { data: restoredData } = await supabase.auth
            .setSession({
              access_token: storedMobileAccounts[0].session.access_token,
              refresh_token: storedMobileAccounts[0].session.refresh_token,
            })
            .catch(() => ({ data: { session: null } }));

          restoredSession = restoredData?.session || null;
          data = { session: restoredSession };
        }

        if (!cancelled) {
          handleAuthUrlState(authUrlState, restoredSession);
        }

        if (restoredSession && !cancelled) {
          const ownership = await ensureLocalDataOwnedByUser(
            restoredSession.user?.id
          );
          if (ownership?.switched) {
            toast.info(
              "Se cambio al almacenamiento local de esta cuenta."
            );
          }
          await rememberMobileSession(restoredSession);
          setSession(restoredSession);
        }
      } finally {
        if (!cancelled) {
          setIsAuthReady(true);
        }
      }
    };

    restoreSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const authUrlState = readAuthUrlState();

        if (event === "PASSWORD_RECOVERY" || authUrlState.isPasswordRecovery) {
          setIsPasswordRecovery(true);
        }

        handleAuthUrlState(authUrlState, session || null);

        if (session && authUrlState.hasAuthParams) {
          clearAuthUrlState();
        }

        if (session) {
          await ensureOfflineStorageReady();
          const ownership = await ensureLocalDataOwnedByUser(session.user?.id);
          if (ownership?.switched) {
            toast.info(
              "Se cambio al almacenamiento local de esta cuenta."
            );
          }
          await rememberMobileSession(session);
          setSession(session);
          setIsAuthReady(true);
        } else {
          if (event === "SIGNED_OUT") {
            setSession(null);
            setIsPasswordRecovery(false);
            setIsAuthReady(true);
            return;
          }

          // Keep the current session while offline or during transient auth
          // refresh issues, and only clear it when Supabase confirms sign-out.
          const { data } = await supabase.auth.getSession().catch(() => ({
            data: { session: null },
          }));

          if (data?.session) {
            setSession(data.session);
          }

          setIsAuthReady(true);
        }
      }
    );

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, [
    applySubscriptionMode,
    handleAuthUrlState,
    isNativeMobile,
    refreshMobileAccounts,
    rememberMobileSession,
  ]);

  useEffect(() => {
    const restoreSubscriptionMode = async () => {
      const forcedMode = getForcedSubscriptionMode();

      if (forcedMode) {
        await applySubscriptionMode(forcedMode);
        return;
      }

      const storedMode = await getSubscriptionMode().catch(() => null);
      setSubscriptionMode(storedMode || SUBSCRIPTION_MODES.LOCAL_ONLY);
    };

    restoreSubscriptionMode().catch(() => {
      setSubscriptionMode(SUBSCRIPTION_MODES.LOCAL_ONLY);
    });
  }, [applySubscriptionMode]);

  useEffect(() => {
    if (!session?.access_token || !isOnline) {
      return;
    }

    let cancelled = false;

    const refreshSubscriptionAccess = async () => {
      const nextMode = await syncSubscriptionAccessFromBackend(
        session.access_token
      ).catch(() => null);

      if (!cancelled && nextMode) {
        setSubscriptionMode(nextMode);
      }
    };

    refreshSubscriptionAccess().catch(() => null);

    return () => {
      cancelled = true;
    };
  }, [session?.access_token, isOnline]);

  useEffect(() => {
    if (!isNativeMobile || !session?.access_token) {
      return undefined;
    }

    let cancelled = false;
    let appStateListener = null;

    const refreshSubscriptionAccess = async () => {
      if (cancelled || !isOnline) {
        return;
      }

      const nextMode = await syncSubscriptionAccessFromBackend(
        session.access_token
      ).catch(() => null);

      if (!cancelled && nextMode) {
        setSubscriptionMode(nextMode);
      }
    };

    CapacitorApp.addListener("appStateChange", ({ isActive }) => {
      if (isActive) {
        refreshSubscriptionAccess().catch(() => null);
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
      appStateListener?.remove();
    };
  }, [isNativeMobile, isOnline, session?.access_token]);

  useEffect(() => {
    if (view === "items" && !canUsePremiumBackend(subscriptionMode)) {
      setView("dashboard");
      toast.info("Articulos esta disponible solo para Premium");
      return;
    }

    if (view === "reports" && !canUsePremiumBackend(subscriptionMode)) {
      setView("dashboard");
      toast.info("Reportes esta disponible solo para Premium");
      return;
    }

    if (view === "reports" && !isNativeMobile) {
      setView("dashboard");
      toast.info("Reportes esta disponible solo en mobile");
      return;
    }

    if (!isNativeMobile) {
      return;
    }

    if (view === "scenarios") {
      setView("dashboard");
      toast.info("Escenarios no estara disponible en mobile por ahora");
    }
  }, [isNativeMobile, subscriptionMode, view]);

  useEffect(() => {
    setBackendConnectionStatus(getBackendConnectionStatus());
    return subscribeBackendConnectionStatus(setBackendConnectionStatus);
  }, [isOnline]);

  useEffect(() => {
    if (onlineStatusRef.current === null) {
      onlineStatusRef.current = isOnline;
      return;
    }

    if (onlineStatusRef.current === isOnline) {
      return;
    }

    onlineStatusRef.current = isOnline;
    setShowConnectionBanner(true);

    const timeoutId = window.setTimeout(() => {
      setShowConnectionBanner(false);
    }, 15000);

    return () => window.clearTimeout(timeoutId);
  }, [isOnline]);

  useEffect(() => {
    if (
      !session?.access_token ||
      !isOnline ||
      !canSyncRemote(subscriptionMode)
    ) {
      return;
    }

    let cancelled = false;

    const syncPendingData = async () => {
      try {
        const result = await runBootstrapSync(
          session.access_token,
          subscriptionMode
        );

        if (cancelled) return;

        if (result.synced > 0) {
          toast.success(`Se sincronizaron ${result.synced} cambios pendientes`);
        }
      } catch {
        return null;
      }
    };

    syncPendingData();

    return () => {
      cancelled = true;
    };
  }, [session, isOnline, subscriptionMode]);

  useEffect(() => {
    if (
      !session?.access_token ||
      !isOnline ||
      !canSyncRemote(subscriptionMode)
    ) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;
    let probeInFlight = false;

    const clearProbeTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const runSyncAfterProbe = async () => {
      if (cancelled || probeInFlight) {
        return;
      }

      probeInFlight = true;
      const reachable = await probeBackend();
      probeInFlight = false;

      if (cancelled) {
        return;
      }

      if (reachable) {
        try {
          const result = await runBootstrapSync(
            session.access_token,
            subscriptionMode
          );

          if (!cancelled && result.synced > 0) {
            toast.success(
              `Se sincronizaron ${result.synced} cambios pendientes`
            );
          }
        } catch {
          // The regular network guard will keep the app in local mode.
        }
      }

      const nextStatus = getBackendConnectionStatus();
      if (!cancelled && nextStatus.state === "backend_waking") {
        scheduleProbe(nextStatus);
      }
    };

    const scheduleProbe = (status = getBackendConnectionStatus()) => {
      if (cancelled || status.state !== "backend_waking" || timeoutId) {
        return;
      }

      const retryAt = Number(status.retryAt || 0);
      const delayMs = Math.max(1000, retryAt - Date.now());
      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        runSyncAfterProbe();
      }, delayMs);
    };

    scheduleProbe(backendConnectionStatus);
    const unsubscribe = subscribeBackendConnectionStatus((status) => {
      if (status.state === "backend_waking") {
        scheduleProbe(status);
      }
    });

    return () => {
      cancelled = true;
      clearProbeTimer();
      unsubscribe();
    };
  }, [
    backendConnectionStatus,
    isOnline,
    session?.access_token,
    subscriptionMode,
  ]);

  const handleLogout = async () => {
    const currentUserId = session?.user?.id;
    await supabase.auth.signOut();
    if (isNativeMobile && currentUserId) {
      const nextAccounts = await removeMobileAccountSession(currentUserId).catch(
        () => []
      );
      setMobileAccounts(nextAccounts);
    }
    await clearHomeWidgetSnapshot().catch(() => null);
    setSession(null);
    setIsAddingMobileAccount(false);
    setIsPasswordRecovery(false);
    setView("categories");
  };

  const handlePasswordUpdated = async () => {
    const { data } = await supabase.auth.getSession().catch(() => ({
      data: { session: null },
    }));
    const nextSession = data?.session || session;

    setIsPasswordRecovery(false);

    if (nextSession) {
      setSession(nextSession);
      await finalizeLoginSession(nextSession);
    }
  };

  const handleAddMobileAccount = () => {
    setIsAddingMobileAccount(true);
    setView("dashboard");
  };

  const handleCancelAddMobileAccount = () => {
    setIsAddingMobileAccount(false);
  };

  const handleSwitchMobileAccount = async (userId) => {
    if (!isNativeMobile || !userId || isSwitchingAccount) {
      return;
    }

    const account = mobileAccounts.find(
      (item) => String(item.userId) === String(userId)
    );

    if (!account?.session?.access_token || !account?.session?.refresh_token) {
      toast.error("Esta cuenta necesita iniciar sesion otra vez.");
      return;
    }

    if (String(session?.user?.id) === String(account.userId)) {
      setIsAddingMobileAccount(false);
      return;
    }

    setIsSwitchingAccount(true);

    try {
      await ensureOfflineStorageReady();
      await ensureLocalDataOwnedByUser(account.userId);

      const { data, error } = await supabase.auth.setSession({
        access_token: account.session.access_token,
        refresh_token: account.session.refresh_token,
      });

      if (error || !data?.session) {
        throw error || new Error("No se pudo restaurar la sesion.");
      }

      await rememberMobileSession(data.session);
      setSession(data.session);
      await finalizeLoginSession(data.session);
      toast.success(`Cambiaste a ${data.session.user?.email || "otra cuenta"}.`);
    } catch (error) {
      console.error("No se pudo cambiar de cuenta", error);
      toast.error("No pudimos cambiar a esa cuenta. Inicia sesion nuevamente.");
    } finally {
      setIsSwitchingAccount(false);
      setIsAddingMobileAccount(false);
    }
  };

  useEffect(() => {
    if (
      !session?.access_token ||
      !isOnline ||
      backendConnectionStatus.state === "backend_waking" ||
      !canUsePremiumBackend(subscriptionMode)
    ) {
      return;
    }

    let cancelled = false;

    const hydratePremiumData = async () => {
      try {
        await warmPremiumOfflineCache(session.access_token);

        if (cancelled) return;
      } catch {
        return null;
      }
    };

    hydratePremiumData();

    return () => {
      cancelled = true;
    };
  }, [
    backendConnectionStatus.state,
    session,
    isOnline,
    subscriptionMode,
    warmPremiumOfflineCache,
  ]);

  const isBackendWaking =
    isOnline && backendConnectionStatus.state === "backend_waking";
  const showPersistentConnectionBanner = Boolean(
    session && (!isOnline || isBackendWaking)
  );
  const shouldShowConnectionBanner = Boolean(
    session && (showPersistentConnectionBanner || showConnectionBanner)
  );
  const connectionBannerKind = !isOnline
    ? "offline"
    : isBackendWaking
    ? "backend_waking"
    : "online";
  const connectionBannerIsPositive = connectionBannerKind === "online";
  const connectionBannerMessage =
    connectionBannerKind === "backend_waking"
      ? "Servidor despertando. Usando datos locales y sincronizando en segundo plano."
      : connectionBannerKind === "offline"
      ? "Sin conexion. La app seguira funcionando con datos locales."
      : "Conexion disponible. La app puede volver a sincronizar.";

  return (
    <AppPreferencesProvider>
      {shouldShowConnectionBanner && (
        <div
          className="mt-4 w-full border px-4 py-3 text-sm"
          style={{
            borderColor: connectionBannerIsPositive
              ? "color-mix(in srgb, var(--success) 35%, var(--border-rgba))"
              : "color-mix(in srgb, var(--warning) 42%, var(--border-rgba))",
            background:
              connectionBannerIsPositive
                ? "color-mix(in srgb, var(--success) 12%, var(--panel))"
                : "color-mix(in srgb, var(--warning) 12%, var(--panel))",
            color: "var(--text)",
          }}
        >
          <div className="text-center font-medium">
            <span>{connectionBannerMessage}</span>
          </div>
        </div>
      )}

      {!isAuthReady ? (
        <div className="app-shell app-shell--safe-top app-shell--safe-bottom flex items-center justify-center px-8 py-6 sm:p-6 bg-gradient-to-br from-[var(--bg-1)] via-[var(--bg-2)] to-[var(--bg-3)] text-[var(--text)]">
          <div className="mx-auto w-full max-w-[25rem] ff-card p-6 md:p-8 text-center">
            <p className="text-sm text-[var(--muted)]">Restaurando sesion...</p>
          </div>
        </div>
      ) : isPasswordRecovery ? (
        <Login
          initialMode="updatePassword"
          onPasswordUpdated={handlePasswordUpdated}
          onCancelPasswordUpdate={handleLogout}
        />
      ) : isAddingMobileAccount && session ? (
        <Login
          onLogin={finalizeLoginSession}
          onCancelAuth={handleCancelAddMobileAccount}
          cancelAuthLabel="Volver a mi cuenta actual"
        />
      ) : !session ? (
        <Login onLogin={finalizeLoginSession} />
      ) : (
        <AppLayout
          onLogout={handleLogout}
          currentUser={session.user}
          mobileAccounts={mobileAccounts}
          onAddMobileAccount={handleAddMobileAccount}
          onSwitchMobileAccount={handleSwitchMobileAccount}
          isSwitchingAccount={isSwitchingAccount}
          setView={setView}
          subscriptionMode={subscriptionMode}
          contentWidth={
            view === "dashboard" || view === "moderndashboard"
              ? "dashboard"
              : "default"
          }

        >
          {view === "categories" && (
            <Categories
              token={session.access_token}
              subscriptionMode={subscriptionMode}
            />
          )}
          {view === "accounts" && (
            <Accounts
              token={session.access_token}
              subscriptionMode={subscriptionMode}
            />
          )}
          {view === "transactions" && (
            <Transactions
              token={session.access_token}
              subscriptionMode={subscriptionMode}
            />
          )}
          {view === "budgets" && (
            <Budgets
              token={session.access_token}
              subscriptionMode={subscriptionMode}
            />
          )}
          {view === "items" && canUsePremiumBackend(subscriptionMode) && (
            <Items
              token={session.access_token}
              subscriptionMode={subscriptionMode}
            />
          )}
          {view === "goals" && (
            <Goals
              token={session.access_token}
              subscriptionMode={subscriptionMode}
            />
          )}
          {view === "projects" && (
            <Projects
              token={session.access_token}
              subscriptionMode={subscriptionMode}
            />
          )}
          {view === "reports" &&
            isNativeMobile &&
            canUsePremiumBackend(subscriptionMode) && (
              <MobileReports
                token={session.access_token}
                subscriptionMode={subscriptionMode}
                setView={setView}
              />
            )}
          {view === "dashboard" && (
            isNativeMobile ? (
              <MobileDashboard
                token={session.access_token}
                subscriptionMode={subscriptionMode}
                setView={setView}
              />
            ) : (
              <Dashboard token={session.access_token} setView={setView} />
            )
          )}
          {view === "scenarios" && !isNativeMobile && (
            <Scenarios token={session.access_token} />
          )}
          {view === "moderndashboard" && (
            <ModernDashboard token={session.access_token} setView={setView} />
          )}
          {view === "theme" && <Theme />}
          {view === "preferences" && (
            <Preferences
              token={session.access_token}
              subscriptionMode={subscriptionMode}
              onSubscriptionModeChange={applySubscriptionMode}
            />
          )}
        </AppLayout>
      )}

      <ToastPreferenceGate />
    </AppPreferencesProvider>
  );
}

export default App;
