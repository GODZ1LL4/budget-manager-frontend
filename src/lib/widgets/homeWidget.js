import { Capacitor, registerPlugin } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const HOME_WIDGET_SNAPSHOT_KEY = "bm_home_widget_snapshot_v1";
const HomeWidget = registerPlugin("HomeWidget");

function isNativePlatform() {
  const platform = Capacitor.getPlatform();
  return platform === "android" || platform === "ios";
}

export function buildHomeWidgetSnapshot(dashboardData, formatCurrency) {
  const snapshot = dashboardData || {};
  const accountSnapshot = snapshot.accountSnapshot || {};
  const monthSummary = snapshot.monthSummary || {};
  const topAccounts = Array.isArray(snapshot.topAccounts) ? snapshot.topAccounts : [];

  return {
    title: "FinanceFlow",
    subtitle: "Resumen rapido",
    balanceLabel: "Balance actual",
    balanceValue: formatCurrency(accountSnapshot.current || 0),
    expenseLabel: "Gasto del mes",
    expenseValue: formatCurrency(monthSummary.expense || 0),
    incomeLabel: "Ingreso del mes",
    incomeValue: formatCurrency(monthSummary.income || 0),
    accountSectionLabel: "Cuentas",
    accounts: topAccounts.map((account) => ({
      id: String(account.id || ""),
      name: account.name || "Cuenta",
      typeLabel: account.type || "Cuenta",
      balanceLabel: "Balance actual",
      currentLabel: formatCurrency(account.current || 0),
      footerLabel: `Disponible ${formatCurrency(
        account.available || 0
      )} | Reservado ${formatCurrency(
        account.reserved || 0
      )}`,
    })),
    updatedLabel: snapshot.today
      ? `Actualizado ${snapshot.today}`
      : "Abre la app para cargar datos",
    empty: false,
  };
}

export function buildEmptyHomeWidgetSnapshot() {
  return {
    title: "FinanceFlow",
    subtitle: "Resumen rapido",
    balanceLabel: "Balance actual",
    balanceValue: "--",
    expenseLabel: "Gasto del mes",
    expenseValue: "--",
    incomeLabel: "Ingreso del mes",
    incomeValue: "--",
    accountSectionLabel: "Cuentas",
    accounts: [],
    updatedLabel: "Sin datos recientes",
    empty: true,
  };
}

export async function saveHomeWidgetSnapshot(snapshot) {
  if (!isNativePlatform()) {
    return;
  }

  await Preferences.set({
    key: HOME_WIDGET_SNAPSHOT_KEY,
    value: JSON.stringify(snapshot),
  });
}

export async function clearHomeWidgetSnapshot() {
  if (!isNativePlatform()) {
    return;
  }

  await Preferences.remove({ key: HOME_WIDGET_SNAPSHOT_KEY });
  await refreshHomeWidget();
}

export async function refreshHomeWidget() {
  if (Capacitor.getPlatform() !== "android") {
    return;
  }

  await HomeWidget.refresh();
}

export async function syncHomeWidgetSnapshot({
  dashboardData,
  formatCurrency,
}) {
  if (!isNativePlatform()) {
    return;
  }

  const snapshot = dashboardData
    ? buildHomeWidgetSnapshot(dashboardData, formatCurrency)
    : buildEmptyHomeWidgetSnapshot();

  await saveHomeWidgetSnapshot(snapshot);
  await refreshHomeWidget();
}
