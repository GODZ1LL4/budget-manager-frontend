import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Preferences } from "@capacitor/preferences";

const EXPENSE_REMINDER_ID = 2001;
const EXPENSE_REMINDER_SETTINGS_KEY = "expense-reminder-settings";
const ENGAGEMENT_NOTIFICATION_SETTINGS_KEY =
  "engagement-notification-settings";
const ENGAGEMENT_NOTIFICATION_STATE_KEY = "engagement-notification-state";
const ENGAGEMENT_NOTIFICATION_BASE_ID = 3000;
const MAX_SENT_NOTIFICATION_KEYS = 80;
const ANDROID_NOTIFICATION_SMALL_ICON = "ic_stat_financeflow";
const ANDROID_NOTIFICATION_LARGE_ICON = "ic_financeflow_large";
const ANDROID_NOTIFICATION_ICON_COLOR = "#F4C36A";

const DEFAULT_ENGAGEMENT_NOTIFICATION_SETTINGS = {
  expenseAlerts: false,
  budgetAlerts: false,
  achievementAlerts: false,
};

function getAndroidNotificationBranding() {
  if (Capacitor.getPlatform() !== "android") {
    return {};
  }

  return {
    smallIcon: ANDROID_NOTIFICATION_SMALL_ICON,
    largeIcon: ANDROID_NOTIFICATION_LARGE_ICON,
    iconColor: ANDROID_NOTIFICATION_ICON_COLOR,
  };
}

function isNativePlatform() {
  return Capacitor.getPlatform() !== "web";
}

function isAndroidPlatform() {
  return Capacitor.getPlatform() === "android";
}

function normalizeTimePart(value, fallback) {
  return Number.isInteger(value) ? value : fallback;
}

function normalizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function formatMoney(formatCurrency, amount) {
  try {
    if (typeof formatCurrency === "function") {
      return formatCurrency(amount);
    }
  } catch {
    return String(amount);
  }

  return String(amount);
}

function hashString(value) {
  const text = String(value || "");
  let hash = 0;

  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) & 0x7fffffff;
  }

  return hash;
}

function buildNotificationId(key) {
  return ENGAGEMENT_NOTIFICATION_BASE_ID + (hashString(key) % 100000);
}

function normalizeEngagementSettings(settings = {}) {
  return {
    expenseAlerts: normalizeBoolean(
      settings.expenseAlerts,
      DEFAULT_ENGAGEMENT_NOTIFICATION_SETTINGS.expenseAlerts
    ),
    budgetAlerts: normalizeBoolean(
      settings.budgetAlerts,
      DEFAULT_ENGAGEMENT_NOTIFICATION_SETTINGS.budgetAlerts
    ),
    achievementAlerts: normalizeBoolean(
      settings.achievementAlerts,
      DEFAULT_ENGAGEMENT_NOTIFICATION_SETTINGS.achievementAlerts
    ),
  };
}

function normalizeEngagementState(rawState) {
  const sentKeys =
    rawState && typeof rawState.sentKeys === "object" && rawState.sentKeys
      ? rawState.sentKeys
      : {};

  return {
    sentKeys: Object.fromEntries(
      Object.entries(sentKeys)
        .filter(([key]) => typeof key === "string" && key)
        .map(([key, value]) => [key, Number(value) || Date.now()])
    ),
  };
}

function trimSentKeys(sentKeys) {
  return Object.fromEntries(
    Object.entries(sentKeys)
      .sort((left, right) => Number(right[1]) - Number(left[1]))
      .slice(0, MAX_SENT_NOTIFICATION_KEYS)
  );
}

function getBudgetKey(budget) {
  return String(budget?.id || budget?.category_id || budget?.category_name || "");
}

function buildDashboardNotificationCandidates({
  dashboardData,
  formatCurrency,
  settings,
}) {
  if (!dashboardData) {
    return [];
  }

  const today = dashboardData.today || new Date().toISOString().slice(0, 10);
  const currentMonth = dashboardData.currentMonth || today.slice(0, 7);
  const candidates = [];
  const budgetAlerts = dashboardData.budgetAlerts || {};
  const accountSnapshot = dashboardData.accountSnapshot || {};
  const overBudget = Array.isArray(budgetAlerts.overBudget)
    ? budgetAlerts.overBudget
    : [];
  const nearLimit = Array.isArray(budgetAlerts.nearLimit)
    ? budgetAlerts.nearLimit
    : [];
  const dailyPulse = dashboardData.dailyPulse || {};
  const goalsSummary = dashboardData.goalsSummary || {};
  const unusualCategories = Array.isArray(dashboardData.unusualCategories)
    ? dashboardData.unusualCategories
    : [];

  if (settings.expenseAlerts) {
    const todayExpense = toNumber(dailyPulse.todayExpense);
    const dailyAverage = toNumber(dailyPulse.dailyAverage);
    const daysSinceLastMovement = toNumber(dailyPulse.daysSinceLastMovement);
    const unusualCategory = unusualCategories[0];

    if (todayExpense > 0 && dailyAverage > 0 && todayExpense >= dailyAverage * 1.5) {
      candidates.push({
        key: `${today}:daily-expense-high`,
        title: "Gasto alto hoy",
        body: `Hoy vas en ${formatMoney(
          formatCurrency,
          todayExpense
        )}, por encima de tu promedio diario.`,
      });
    }

    if (unusualCategory) {
      candidates.push({
        key: `${currentMonth}:category-unusual:${unusualCategory.categoryId}`,
        title: "Categoria fuera de ritmo",
        body: `${unusualCategory.name || "Una categoria"} va ${formatMoney(
          formatCurrency,
          toNumber(unusualCategory.extraAmount)
        )} por encima de su promedio mensual.`,
      });
    }

    if (daysSinceLastMovement >= 3) {
      candidates.push({
        key: `no-movement:${dailyPulse.lastMovementDate || currentMonth}`,
        title: "Sin movimientos recientes",
        body: `Llevas ${daysSinceLastMovement} dias sin registrar movimientos. Una revision rapida puede mantener el mes al dia.`,
      });
    }
  }

  if (settings.budgetAlerts) {
    const overBudgetItem = overBudget[0];
    const nearLimitItem = nearLimit[0];
    const monthProjection = budgetAlerts.monthProjection || {};
    const projectedOverAmount = toNumber(monthProjection.projectedOverAmount);
    const projectedSpentPct = toNumber(monthProjection.projectedSpentPct);
    const available = toNumber(accountSnapshot.available);
    const availableDaysLeft = toNumber(accountSnapshot.availableDaysLeft);

    if (overBudgetItem) {
      candidates.push({
        key: `${currentMonth}:budget-over:${getBudgetKey(overBudgetItem)}`,
        title: "Presupuesto superado",
        body: `${overBudgetItem.category_name || "Una categoria"} esta ${formatMoney(
          formatCurrency,
          toNumber(overBudgetItem.overAmount)
        )} sobre el limite.`,
      });
    } else if (nearLimitItem) {
      candidates.push({
        key: `${currentMonth}:budget-near:${getBudgetKey(nearLimitItem)}`,
        title: "Cerca del limite",
        body: `${nearLimitItem.category_name || "Una categoria"} va por ${Math.round(
          toNumber(nearLimitItem.spentPct)
        )}% de su presupuesto.`,
      });
    }

    if (
      projectedOverAmount > 0 &&
      projectedSpentPct >= 105 &&
      !overBudgetItem
    ) {
      candidates.push({
        key: `${currentMonth}:month-projection-over`,
        title: "Proyeccion de cierre",
        body: `A este ritmo, el mes podria cerrar ${formatMoney(
          formatCurrency,
          projectedOverAmount
        )} sobre tu presupuesto.`,
      });
    }

    if (accountSnapshot.lowAvailable) {
      candidates.push({
        key: `${currentMonth}:available-low`,
        title: "Disponible bajo",
        body:
          available < 0
            ? `Tu disponible esta en ${formatMoney(
                formatCurrency,
                available
              )}. Revisa cuentas y reservas.`
            : `Tienes ${formatMoney(
                formatCurrency,
                available
              )} disponible, cerca de ${Math.max(
                0,
                Math.floor(availableDaysLeft)
              )} dias de tu ritmo actual.`,
      });
    }
  }

  if (settings.achievementAlerts) {
    const completedGoals = toNumber(goalsSummary.completedGoals);
    const expenseStreak = toNumber(dailyPulse.expenseStreak);
    const topGoal = Array.isArray(goalsSummary.items)
      ? goalsSummary.items.find((goal) => toNumber(goal.progressPct) >= 90)
      : null;
    const hasBudgets = Boolean(budgetAlerts.hasBudgets);

    if (completedGoals > 0) {
      candidates.push({
        key: `${currentMonth}:completed-goals:${completedGoals}`,
        title: "Objetivo cumplido",
        body:
          completedGoals === 1
            ? "Tienes una meta completada. Buen avance."
            : `Tienes ${completedGoals} metas completadas. Buen avance.`,
      });
    }

    if (topGoal) {
      candidates.push({
        key: `${currentMonth}:goal-close:${topGoal.id || topGoal.name}`,
        title: "Meta casi lista",
        body: `${topGoal.name || "Una meta"} ya va por ${Math.round(
          toNumber(topGoal.progressPct)
        )}%.`,
      });
    }

    if (expenseStreak >= 3) {
      candidates.push({
        key: `${today}:expense-streak:${expenseStreak}`,
        title: "Racha activa",
        body: `${expenseStreak} dias seguidos registrando gastos.`,
      });
    }

    if (hasBudgets && overBudget.length === 0 && nearLimit.length === 0) {
      candidates.push({
        key: `${currentMonth}:budgets-under-control`,
        title: "Presupuestos bajo control",
        body: "No hay categorias en alerta este mes.",
      });
    }
  }

  return candidates.slice(0, 3);
}

export function getExactAlarmPermissionValue(status) {
  if (!status || typeof status !== "object") {
    return "prompt";
  }

  if (typeof status.exact_alarm === "string") {
    return status.exact_alarm;
  }

  if (typeof status.display === "string") {
    return status.display;
  }

  return "prompt";
}

export async function requestLocalNotificationPermissions() {
  if (!isNativePlatform()) {
    return { display: "denied", reason: "web-platform" };
  }

  const currentPermissions = await LocalNotifications.checkPermissions();

  if (currentPermissions.display === "granted") {
    return currentPermissions;
  }

  return LocalNotifications.requestPermissions();
}

export async function scheduleTestNotification() {
  const permissions = await requestLocalNotificationPermissions();

  if (permissions.display !== "granted") {
    throw new Error("No se otorgaron permisos para notificaciones locales.");
  }

  const at = new Date(Date.now() + 10 * 1000);

  await LocalNotifications.schedule({
    notifications: [
      {
        id: 1001,
        title: "FinanceFlow",
        body: "Este es un recordatorio local de prueba.",
        schedule: { at },
        ...getAndroidNotificationBranding(),
      },
    ],
  });

  return at;
}

async function scheduleImmediateNotification({ key, title, body, delayMs = 1000 }) {
  if (!isNativePlatform()) {
    return { scheduled: false, reason: "web-platform" };
  }

  const permissions = await LocalNotifications.checkPermissions();

  if (permissions.display !== "granted") {
    return { scheduled: false, reason: "permission-denied" };
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id: buildNotificationId(key),
        title,
        body,
        schedule: {
          at: new Date(Date.now() + delayMs),
        },
        ...getAndroidNotificationBranding(),
      },
    ],
  });

  return { scheduled: true };
}

export async function scheduleDailyReminder({
  id,
  title,
  body,
  hour,
  minute = 0,
}) {
  const permissions = await requestLocalNotificationPermissions();

  if (permissions.display !== "granted") {
    throw new Error("No se otorgaron permisos para notificaciones locales.");
  }

  await LocalNotifications.schedule({
    notifications: [
      {
        id,
        title,
        body,
        ...getAndroidNotificationBranding(),
        schedule: {
          allowWhileIdle: true,
          on: {
            hour,
            minute,
          },
        },
      },
    ],
  });
}

export async function getExactAlarmPermissionStatus() {
  if (!isAndroidPlatform()) {
    return { display: "granted" };
  }

  return LocalNotifications.checkExactNotificationSetting();
}

export async function openExactAlarmSettings() {
  if (!isAndroidPlatform()) {
    return { display: "granted" };
  }

  return LocalNotifications.changeExactNotificationSetting();
}

export async function cancelLocalNotification(id) {
  if (!isNativePlatform()) {
    return;
  }

  await LocalNotifications.cancel({
    notifications: [{ id }],
  });
}

export async function saveExpenseReminderSettings(settings) {
  await Preferences.set({
    key: EXPENSE_REMINDER_SETTINGS_KEY,
    value: JSON.stringify(settings),
  });
}

export async function getEngagementNotificationSettings() {
  const { value } = await Preferences.get({
    key: ENGAGEMENT_NOTIFICATION_SETTINGS_KEY,
  });

  if (!value) {
    return { ...DEFAULT_ENGAGEMENT_NOTIFICATION_SETTINGS };
  }

  try {
    return normalizeEngagementSettings(JSON.parse(value));
  } catch {
    return { ...DEFAULT_ENGAGEMENT_NOTIFICATION_SETTINGS };
  }
}

export async function saveEngagementNotificationSettings(settings) {
  const nextSettings = normalizeEngagementSettings(settings);

  await Preferences.set({
    key: ENGAGEMENT_NOTIFICATION_SETTINGS_KEY,
    value: JSON.stringify(nextSettings),
  });

  return nextSettings;
}

async function getEngagementNotificationState() {
  const { value } = await Preferences.get({
    key: ENGAGEMENT_NOTIFICATION_STATE_KEY,
  });

  if (!value) {
    return normalizeEngagementState(null);
  }

  try {
    return normalizeEngagementState(JSON.parse(value));
  } catch {
    return normalizeEngagementState(null);
  }
}

async function saveEngagementNotificationState(state) {
  await Preferences.set({
    key: ENGAGEMENT_NOTIFICATION_STATE_KEY,
    value: JSON.stringify(normalizeEngagementState(state)),
  });
}

export async function maybeSendDashboardInsightNotifications({
  dashboardData,
  formatCurrency,
}) {
  if (!isNativePlatform()) {
    return [];
  }

  const settings = await getEngagementNotificationSettings();

  if (
    !settings.expenseAlerts &&
    !settings.budgetAlerts &&
    !settings.achievementAlerts
  ) {
    return [];
  }

  const state = await getEngagementNotificationState();
  const candidates = buildDashboardNotificationCandidates({
    dashboardData,
    formatCurrency,
    settings,
  }).filter((candidate) => !state.sentKeys[candidate.key]);

  if (!candidates.length) {
    return [];
  }

  const results = [];
  const nextSentKeys = { ...state.sentKeys };

  for (const [index, candidate] of candidates.entries()) {
    const result = await scheduleImmediateNotification({
      key: candidate.key,
      title: candidate.title,
      body: candidate.body,
      delayMs: 1200 + index * 900,
    }).catch((error) => ({
      scheduled: false,
      reason: error instanceof Error ? error.message : "schedule-error",
    }));

    if (result.scheduled) {
      nextSentKeys[candidate.key] = Date.now();
    }

    results.push({
      ...candidate,
      ...result,
    });
  }

  await saveEngagementNotificationState({
    sentKeys: trimSentKeys(nextSentKeys),
  });

  return results;
}

export async function getExpenseReminderSettings() {
  const { value } = await Preferences.get({
    key: EXPENSE_REMINDER_SETTINGS_KEY,
  });

  if (!value) {
    return {
      enabled: false,
      hour: 20,
      minute: 0,
    };
  }

  try {
    const parsedSettings = JSON.parse(value);

    return {
      enabled: Boolean(parsedSettings.enabled),
      hour: normalizeTimePart(parsedSettings.hour, 20),
      minute: normalizeTimePart(parsedSettings.minute, 0),
    };
  } catch {
    return {
      enabled: false,
      hour: 20,
      minute: 0,
    };
  }
}

export async function disableExpenseReminder() {
  await cancelLocalNotification(EXPENSE_REMINDER_ID);
  const nextSettings = {
    enabled: false,
    hour: 20,
    minute: 0,
  };
  await saveExpenseReminderSettings(nextSettings);
  return nextSettings;
}

export async function enableExpenseReminder({ hour, minute }) {
  await cancelLocalNotification(EXPENSE_REMINDER_ID);

  await scheduleDailyReminder({
    id: EXPENSE_REMINDER_ID,
    title: "FinanceFlow",
    body: "Recuerda registrar tus gastos de hoy.",
    hour,
    minute,
  });

  const nextSettings = {
    enabled: true,
    hour,
    minute,
  };

  await saveExpenseReminderSettings(nextSettings);
  return nextSettings;
}

export async function syncExpenseReminder() {
  const settings = await getExpenseReminderSettings();

  if (!settings.enabled) {
    return settings;
  }

  await cancelLocalNotification(EXPENSE_REMINDER_ID);

  await scheduleDailyReminder({
    id: EXPENSE_REMINDER_ID,
    title: "FinanceFlow",
    body: "Recuerda registrar tus gastos de hoy.",
    hour: settings.hour,
    minute: settings.minute,
  });

  return settings;
}
