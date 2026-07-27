import { useCallback, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  HiBadgeCheck,
  HiCheckCircle,
  HiExclamationCircle,
  HiFlag,
  HiLightningBolt,
  HiShieldCheck,
  HiSparkles,
} from "react-icons/hi";
import { toast } from "react-toastify";
import { listAccounts, listAccountBalances } from "../lib/repositories/accountsRepository";
import { listBudgets } from "../lib/repositories/budgetsRepository";
import { listCategories } from "../lib/repositories/categoriesRepository";
import { listGoals } from "../lib/repositories/goalsRepository";
import { listTransactions } from "../lib/repositories/transactionsRepository";
import { useAppPreferences } from "../context/AppPreferencesContext";
import {
  getCachedMobileDashboardSnapshot,
  setCachedMobileDashboardSnapshot,
} from "../lib/mobileDashboard/mobileDashboardCache";
import { buildMobileDashboardData } from "../lib/mobileDashboard/mobileDashboardSelectors";
import { syncHomeWidgetSnapshot } from "../lib/widgets/homeWidget";
import { maybeSendDashboardInsightNotifications } from "../lib/notifications/localNotifications";

function InfoDot({ label, isOpen, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border text-[10px] font-bold"
      style={{
        borderColor: "color-mix(in srgb, var(--primary) 30%, var(--border-rgba))",
        color: isOpen ? "var(--primary)" : "var(--muted)",
        background: isOpen
          ? "color-mix(in srgb, var(--primary) 12%, var(--panel))"
          : "color-mix(in srgb, var(--panel) 88%, transparent)",
      }}
      aria-label={label}
      aria-pressed={isOpen}
    >
      i
    </button>
  );
}

function MetricCard({
  infoId,
  label,
  value,
  tone = "var(--text)",
  helper,
  activeInfo,
  onInfoToggle,
  valueClassName = "text-sm",
}) {
  const isInfoOpen = activeInfo === infoId;

  return (
    <div className="min-w-0 rounded-2xl border p-3" style={{ borderColor: "var(--border-rgba)" }}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
          {label}
        </p>
        {helper ? (
          <InfoDot
            label={helper}
            isOpen={isInfoOpen}
            onToggle={() => onInfoToggle(infoId)}
          />
        ) : null}
      </div>
      <p
        className={`mt-2 min-w-0 font-semibold leading-tight [overflow-wrap:anywhere] ${valueClassName}`}
        style={{ color: tone }}
      >
        {value}
      </p>
      {helper && isInfoOpen ? (
        <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">{helper}</p>
      ) : null}
    </div>
  );
}

function getToneColor(tone) {
  if (tone === "danger") return "var(--danger)";
  if (tone === "warning") return "var(--warning)";
  if (tone === "success") return "var(--success)";
  return "var(--primary)";
}

const badgeIconMap = {
  alert: HiExclamationCircle,
  badge: HiBadgeCheck,
  bolt: HiLightningBolt,
  check: HiCheckCircle,
  flag: HiFlag,
  shield: HiShieldCheck,
  spark: HiSparkles,
};

function MotivationBadges({ badges, formatCurrency }) {
  if (!Array.isArray(badges) || badges.length === 0) {
    return null;
  }

  return (
    <section
      className="rounded-[20px] border p-4"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent), color-mix(in srgb, var(--panel) 82%, transparent))",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text)]">
            Insignias
          </h2>
        </div>
        <span
          className="rounded-full border px-2.5 py-1 text-xs font-semibold"
          style={{
            borderColor: "color-mix(in srgb, var(--primary) 32%, var(--border-rgba))",
            color: "var(--primary)",
          }}
        >
          {badges.length}
        </span>
      </div>

      <div className="mt-4 flex snap-x gap-2 overflow-x-auto pb-1">
        {badges.map((badge) => {
          const Icon = badgeIconMap[badge.icon] || HiSparkles;
          const color = getToneColor(badge.tone);
          const detail = badge.detailAmount
            ? `${formatCurrency(badge.detailAmount)} ${badge.detailSuffix || ""}`.trim()
            : badge.detail;

          return (
            <div
              key={badge.id}
              className="min-w-[9.5rem] snap-start rounded-lg border p-3"
              style={{
                borderColor: `color-mix(in srgb, ${color} 38%, var(--border-rgba))`,
                background: `color-mix(in srgb, ${color} 10%, var(--panel))`,
              }}
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg border"
                style={{
                  borderColor: `color-mix(in srgb, ${color} 34%, var(--border-rgba))`,
                  background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                  color,
                }}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-3 text-sm font-semibold leading-tight text-[var(--text)]">
                {badge.label}
              </p>
              <p className="mt-1 text-xs leading-snug text-[var(--muted)]">
                {detail}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MobileDashboard({ token, subscriptionMode, setView }) {
  const { formatCurrency } = useAppPreferences();
  const isNativeMobile = Capacitor.getPlatform() !== "web";
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [activeInfo, setActiveInfo] = useState(null);

  const loadDashboard = useCallback(
    async ({ skipLoading = false } = {}) => {
      if (!token) return;
      if (!skipLoading) {
        setLoading(true);
      }

      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

      try {
        const [
          accountsResult,
          balancesResult,
          categoriesResult,
          transactionsResult,
          budgetsResult,
          goalsResult,
        ] = await Promise.all([
          listAccounts({ token, subscriptionMode }),
          listAccountBalances({ token, subscriptionMode }),
          listCategories({ token, subscriptionMode }),
          listTransactions({ token, subscriptionMode }),
          listBudgets({
            token,
            filterType: "month",
            filterValue: currentMonth,
            subscriptionMode,
          }),
          listGoals({ token, subscriptionMode }),
        ]);

        const nextDashboardData = buildMobileDashboardData({
          accounts: accountsResult?.data || [],
          balances: balancesResult?.data || {},
          categories: categoriesResult?.data || [],
          transactions: transactionsResult?.data || [],
          budgets: budgetsResult?.data || [],
          goals: goalsResult?.data || [],
        });

        setDashboardData(nextDashboardData);
        await setCachedMobileDashboardSnapshot(nextDashboardData).catch(
          (cacheError) => {
            console.warn(
              "No se pudo guardar el snapshot del dashboard mobile:",
              cacheError
            );
          }
        );
        await syncHomeWidgetSnapshot({
          dashboardData: nextDashboardData,
          formatCurrency,
        }).catch((widgetError) => {
          console.warn(
            "No se pudo sincronizar el widget del dashboard mobile:",
            widgetError
          );
        });
        await maybeSendDashboardInsightNotifications({
          dashboardData: nextDashboardData,
          formatCurrency,
        }).catch((notificationError) => {
          console.warn(
            "No se pudieron programar alertas inteligentes:",
            notificationError
          );
        });
      } catch (error) {
        console.error("No se pudo cargar el dashboard mobile:", error);
        toast.error("No se pudo cargar el dashboard mobile");
      } finally {
        setLoading(false);
      }
    },
    [formatCurrency, subscriptionMode, token]
  );

  useEffect(() => {
    let cancelled = false;

    const hydrateDashboard = async () => {
      const cachedSnapshot = await getCachedMobileDashboardSnapshot().catch(() => null);

      if (cachedSnapshot && !cancelled) {
        setDashboardData(cachedSnapshot);
        setLoading(false);
        syncHomeWidgetSnapshot({
          dashboardData: cachedSnapshot,
          formatCurrency,
        }).catch(() => null);
      }

      await loadDashboard({ skipLoading: Boolean(cachedSnapshot) });
    };

    hydrateDashboard();

    return () => {
      cancelled = true;
    };
  }, [formatCurrency, loadDashboard]);

  const toggleInfo = useCallback((infoId) => {
    setActiveInfo((current) => (current === infoId ? null : infoId));
  }, []);

  const ui = useMemo(
    () => ({
      panel:
        "linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 84%, transparent))",
      softPanel: "color-mix(in srgb, var(--panel) 78%, transparent)",
      border: "var(--border-rgba)",
    }),
    []
  );

  if (!isNativeMobile) {
    return null;
  }

  if (loading && !dashboardData) {
    return (
      <div className="space-y-4">
        <div className="ff-card p-5">
          <p className="text-sm text-[var(--muted)]">Cargando dashboard mobile...</p>
        </div>
      </div>
    );
  }

  const data =
    dashboardData ||
    buildMobileDashboardData({
      accounts: [],
      balances: {},
      categories: [],
      transactions: [],
      budgets: [],
      goals: [],
    });

  return (
    <div className="space-y-4">
      <section
        className="overflow-hidden rounded-[26px] border p-5"
        style={{
          borderColor: ui.border,
          background:
            "radial-gradient(circle at top left, color-mix(in srgb, var(--primary) 16%, transparent), transparent 34%), linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 82%, transparent))",
          boxShadow: "0 18px 45px rgba(0,0,0,0.32)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--text)]">
              Resumen financiero
            </h1>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3">
          <div className="rounded-2xl border p-4" style={{ borderColor: ui.border, background: ui.softPanel }}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Balance neto</p>
              <InfoDot
                label="Suma del balance actual de todas tus cuentas."
                isOpen={activeInfo === "balance-neto"}
                onToggle={() => toggleInfo("balance-neto")}
              />
            </div>
            <p className="mt-2 min-w-0 text-[clamp(1.35rem,5vw,2rem)] font-extrabold leading-tight text-[var(--text)] [overflow-wrap:anywhere]">
              {formatCurrency(data.accountSnapshot.current)}
            </p>
            {activeInfo === "balance-neto" ? (
              <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
                Suma del balance actual de todas tus cuentas.
              </p>
            ) : null}
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <MetricCard
                infoId="balance-disponible"
                label="Disponible"
                value={formatCurrency(data.accountSnapshot.available)}
                helper="Monto utilizable ahora mismo en tus cuentas."
                activeInfo={activeInfo}
                onInfoToggle={toggleInfo}
                valueClassName="text-xs"
              />
              <MetricCard
                infoId="balance-reservado"
                label="Reservado"
                value={formatCurrency(data.accountSnapshot.reserved)}
                helper="Dinero apartado para metas u objetivos."
                activeInfo={activeInfo}
                onInfoToggle={toggleInfo}
                valueClassName="text-xs"
              />
            </div>
          </div>
        </div>
      </section>

      <MotivationBadges
        badges={data.achievementBadges}
        formatCurrency={formatCurrency}
      />

      <section className="rounded-[24px] border p-4" style={{ borderColor: ui.border, background: ui.panel }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Mes actual</h2>
           
          </div>
          <button type="button" onClick={() => setView("transactions")} className="text-xs font-semibold text-[var(--primary)]">
            Ver todo
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3">
          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              infoId="mes-ingresos"
              label="Ingresos"
              value={formatCurrency(data.monthSummary.income)}
              tone="var(--success)"
              helper="Total de ingresos registrados en el mes actual."
              activeInfo={activeInfo}
              onInfoToggle={toggleInfo}
            />
            <MetricCard
              infoId="mes-gastos"
              label="Gastos"
              value={formatCurrency(data.monthSummary.expense)}
              tone="var(--danger)"
              helper="Total de gastos registrados en el mes actual."
              activeInfo={activeInfo}
              onInfoToggle={toggleInfo}
            />
            <MetricCard
              infoId="mes-neto"
              label="Neto"
              value={formatCurrency(data.monthSummary.net)}
              tone={data.monthSummary.net >= 0 ? "var(--success)" : "var(--danger)"}
              helper="Ingresos menos gastos del mes actual."
              activeInfo={activeInfo}
              onInfoToggle={toggleInfo}
            />
            <MetricCard
              infoId="mes-promedio"
              label="Promedio mes"
              value={formatCurrency(data.annualSummary.averageMonthlyExpense)}
              helper={`Promedio mensual de gastos del año en curso usando ${data.annualSummary.monthsElapsed} meses transcurridos.`}
              activeInfo={activeInfo}
              onInfoToggle={toggleInfo}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              infoId="pulso-hoy"
              label="Hoy"
              value={formatCurrency(data.dailyPulse.todayExpense)}
              helper="Gasto registrado en el dia de hoy."
              activeInfo={activeInfo}
              onInfoToggle={toggleInfo}
            />
            <MetricCard
              infoId="pulso-semana"
              label="Semana"
              value={formatCurrency(data.dailyPulse.weekExpense)}
              helper="Gasto acumulado en la semana actual."
              activeInfo={activeInfo}
              onInfoToggle={toggleInfo}
            />
            <MetricCard
              infoId="pulso-promedio-dia"
              label="Promedio dia"
              value={formatCurrency(data.dailyPulse.dailyAverage)}
              helper="Promedio diario de gasto en el mes actual."
              activeInfo={activeInfo}
              onInfoToggle={toggleInfo}
            />
            <button
              type="button"
              onClick={() => setView("transactions")}
              className="min-w-0 rounded-2xl border p-3 text-left"
              style={{ borderColor: ui.border }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">Movimientos</p>
                <InfoDot
                  label="Cantidad de ingresos y gastos del mes actual, sin contar transferencias."
                  isOpen={activeInfo === "mes-movimientos"}
                  onToggle={() => toggleInfo("mes-movimientos")}
                />
              </div>
              <p className="mt-2 min-w-0 text-sm font-semibold leading-tight text-[var(--text)] [overflow-wrap:anywhere]">
                {data.monthSummary.movements}
              </p>
              {activeInfo === "mes-movimientos" ? (
                <p className="mt-2 text-[11px] leading-relaxed text-[var(--muted)]">
                  Cantidad de ingresos y gastos del mes actual, sin contar transferencias.
                </p>
              ) : null}
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border p-4" style={{ borderColor: ui.border, background: ui.panel }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Resumen anual</h2>
            
          </div>
          <button type="button" onClick={() => setView("transactions")} className="text-xs font-semibold text-[var(--primary)]">
            Movimientos
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <MetricCard
            infoId="anio-ingresos"
            label="Ingresos año"
            value={formatCurrency(data.annualSummary.income)}
            tone="var(--success)"
            helper="Total de ingresos acumulados en el año actual."
            activeInfo={activeInfo}
            onInfoToggle={toggleInfo}
          />
          <MetricCard
            infoId="anio-gastos"
            label="Gastos año"
            value={formatCurrency(data.annualSummary.expense)}
            tone="var(--danger)"
            helper="Total de gastos acumulados en el año actual."
            activeInfo={activeInfo}
            onInfoToggle={toggleInfo}
          />
          <MetricCard
            infoId="anio-neto"
            label="Neto año"
            value={formatCurrency(data.annualSummary.net)}
            tone={data.annualSummary.net >= 0 ? "var(--success)" : "var(--danger)"}
            helper="Resultado acumulado del año: ingresos menos gastos."
            activeInfo={activeInfo}
            onInfoToggle={toggleInfo}
          />
          <MetricCard
            infoId="anio-movimientos"
            label="Movimientos año"
            value={String(data.annualSummary.movements)}
            helper="Cantidad de ingresos y gastos registrados en el año, excluyendo transferencias."
            activeInfo={activeInfo}
            onInfoToggle={toggleInfo}
          />
        </div>
      </section>

      <section className="rounded-[24px] border p-4" style={{ borderColor: ui.border, background: ui.panel }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Top categorias</h2>
            
          </div>
          <button type="button" onClick={() => setView("categories")} className="text-xs font-semibold text-[var(--primary)]">
            Categorias
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {data.topCategories.length === 0 ? (
            <p className="text-sm italic text-[var(--muted)]">Todavia no hay gastos por categoria este mes.</p>
          ) : (
            data.topCategories.map((category) => (
              <div key={category.categoryId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="truncate font-medium text-[var(--text)]">{category.name}</span>
                  <span className="shrink-0 font-semibold text-[var(--text)]">
                    {formatCurrency(category.amount)}
                  </span>
                </div>
                <div
                  className="h-2.5 overflow-hidden rounded-full"
                  style={{ background: "color-mix(in srgb, var(--panel) 55%, transparent)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(category.percent, 6)}%`,
                      background: "linear-gradient(90deg, var(--primary), color-mix(in srgb, var(--success) 45%, var(--primary)))",
                    }}
                  />
                </div>
                <p className="text-[11px] text-[var(--muted)]">{category.percent.toFixed(1)}% del gasto categorizado</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[24px] border p-4" style={{ borderColor: ui.border, background: ui.panel }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Presupuestos en foco</h2>
           
          </div>
          <button type="button" onClick={() => setView("budgets")} className="text-xs font-semibold text-[var(--primary)]">
            Presupuestos
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {data.budgetAlerts.items.length === 0 ? (
            <p className="text-sm italic text-[var(--muted)]">No hay presupuestos cargados para este mes.</p>
          ) : (
            data.budgetAlerts.items.map((budget) => {
              const tone =
                budget.spent > budget.limit
                  ? "var(--danger)"
                  : budget.spentPct >= 80
                  ? "var(--warning)"
                  : "var(--success)";

              return (
                <div key={budget.id} className="rounded-2xl border p-3" style={{ borderColor: ui.border }}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[var(--text)]">{budget.category_name}</p>
                    <p className="text-xs font-semibold" style={{ color: tone }}>
                      {budget.spentPct.toFixed(0)}%
                    </p>
                  </div>
                  <div
                    className="mt-2 h-2.5 overflow-hidden rounded-full"
                    style={{ background: "color-mix(in srgb, var(--panel) 52%, transparent)" }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(Math.min(budget.spentPct, 100), 4)}%`,
                        background: tone,
                      }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                    <span>{formatCurrency(budget.spent)} gastado</span>
                    <span>
                      {budget.overAmount > 0
                        ? `Exceso ${formatCurrency(budget.overAmount)}`
                        : `Limite ${formatCurrency(budget.limit)}`}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      <section className="rounded-[24px] border p-4" style={{ borderColor: ui.border, background: ui.panel }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Metas</h2>
            
          </div>
          <button type="button" onClick={() => setView("goals")} className="text-xs font-semibold text-[var(--primary)]">
            Metas
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {data.goalsSummary.items.length === 0 ? (
            <p className="text-sm italic text-[var(--muted)]">No tienes metas activas todavia.</p>
          ) : (
            data.goalsSummary.items.map((goal) => (
              <div key={goal.id} className="rounded-2xl border p-3" style={{ borderColor: ui.border }}>
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[var(--text)]">{goal.name}</p>
                  <p className="text-xs font-semibold text-[var(--primary)]">{goal.progressPct.toFixed(0)}%</p>
                </div>
                <div
                  className="mt-2 h-2.5 overflow-hidden rounded-full"
                  style={{ background: "color-mix(in srgb, var(--panel) 52%, transparent)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(goal.progressPct, 4)}%`,
                      background: "linear-gradient(90deg, var(--success), color-mix(in srgb, var(--primary) 45%, var(--success)))",
                    }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                  <span>{formatCurrency(goal.reserved)} ahorrado</span>
                  <span>Faltan {formatCurrency(goal.missing)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[24px] border p-4" style={{ borderColor: ui.border, background: ui.panel }}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text)]">Actividad reciente</h2>
            <p className="text-sm text-[var(--muted)]">Ultimos movimientos registrados.</p>
          </div>
          <button type="button" onClick={() => setView("transactions")} className="text-xs font-semibold text-[var(--primary)]">
            Historial
          </button>
        </div>

        <div className="mt-4 space-y-3">
          {data.recentTransactions.length === 0 ? (
            <p className="text-sm italic text-[var(--muted)]">Todavia no hay transacciones registradas.</p>
          ) : (
            data.recentTransactions.map((tx) => (
              <button
                key={tx.id}
                type="button"
                onClick={() => setView("transactions")}
                className="w-full rounded-2xl border p-3 text-left"
                style={{ borderColor: ui.border, background: "color-mix(in srgb, var(--panel) 76%, transparent)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate font-medium text-[var(--text)]">
                    {tx.description || tx.categoryLabel}
                  </p>
                  <p
                    className="shrink-0 font-semibold"
                    style={{
                      color:
                        tx.type === "income"
                          ? "var(--success)"
                          : tx.type === "expense"
                          ? "var(--danger)"
                          : "var(--text)",
                    }}
                  >
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                    {formatCurrency(Math.abs(tx.amount))}
                  </p>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  {tx.accountLabel} - {tx.date}
                </p>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

export default MobileDashboard;
