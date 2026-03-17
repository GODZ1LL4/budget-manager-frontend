
import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { AnimatePresence, motion } from "framer-motion";

import MonthlyIncomeVsExpenseLineChart from "../components/reports/MonthlyIncomeVsExpenseLineChart";
import ExpenseDistributionByCategoryChart from "../components/reports/ExpenseDistributionByCategoryChart";
import AdvancedBurnRateChart from "../components/reports/AdvancedBurnRateChart";
import BudgetCoverageRobustChart from "../components/reports/BudgetCoverageRobustChart";
import UnusualExpensesTable from "../components/reports/UnusualExpensesTable";
import TopVariableCategoriesChart from "../components/reports/TopVariableCategoriesChart";
import AntExpensesReport from "../components/reports/AntExpensesReport";

const ADV_BURN_RATE_STORAGE_KEY = "report:advanced-burn-rate:params";

function formatMoney(value) {
  const n = Number(value) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(n);
}

function formatPct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${n.toFixed(1)}%`;
}

function accentColor(tone) {
  if (tone === "success") return "var(--success)";
  if (tone === "danger") return "var(--danger)";
  if (tone === "warning") return "var(--warning)";
  return "var(--primary)";
}

function clamp(n, min, max) {
  const num = Number(n);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function getStoredAdvancedBurnRateParams() {
  const defaults = {
    months: 6,
    minOccurrences: 3,
    includeOccasional: false,
    includeNoise: true,
    minIntervalDays: 3,
    maxIntervalDays: 70,
    maxCoefVariation: 0.6,
  };

  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(ADV_BURN_RATE_STORAGE_KEY);
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);

    return {
      months: clamp(parsed?.months, 1, 36),
      minOccurrences: clamp(parsed?.minOccurrences, 2, 50),
      includeOccasional:
        typeof parsed?.includeOccasional === "boolean"
          ? parsed.includeOccasional
          : defaults.includeOccasional,
      includeNoise:
        typeof parsed?.includeNoise === "boolean"
          ? parsed.includeNoise
          : defaults.includeNoise,
      minIntervalDays: clamp(parsed?.minIntervalDays, 1, 365),
      maxIntervalDays: clamp(parsed?.maxIntervalDays, 1, 3650),
      maxCoefVariation: Number.isFinite(Number(parsed?.maxCoefVariation))
        ? Number(parsed.maxCoefVariation)
        : defaults.maxCoefVariation,
    };
  } catch {
    return defaults;
  }
}

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

const pageTransition = {
  initial: { opacity: 0, y: 18 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  },
  exit: {
    opacity: 0,
    y: -12,
    transition: { duration: 0.22, ease: "easeOut" },
  },
};

function useCountUp(value, duration = 900) {
  const [display, setDisplay] = useState(Number(value) || 0);

  useEffect(() => {
    const target = Number(value) || 0;
    const from = display;
    const start = performance.now();
    let frameId = 0;

    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(from + (target - from) * eased);
      if (progress < 1) frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return display;
}

function TerminalShell({ children }) {
  return (
    <div className="space-y-5 md:space-y-6 min-w-0">
      <style>{`
        .terminal-grid {
          background-image:
            linear-gradient(to right, color-mix(in srgb, var(--border-rgba) 22%, transparent) 1px, transparent 1px),
            linear-gradient(to bottom, color-mix(in srgb, var(--border-rgba) 16%, transparent) 1px, transparent 1px);
          background-size: 24px 24px;
          background-position: center;
        }

        .terminal-panel {
          position: relative;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--border-rgba) 88%, transparent);
          background:
            linear-gradient(180deg,
              color-mix(in srgb, var(--bg-2) 80%, var(--panel)) 0%,
              color-mix(in srgb, var(--panel) 82%, transparent) 100%);
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, var(--text) 6%, transparent),
            0 20px 60px rgba(0,0,0,0.28);
        }

        .terminal-panel::before {
          content: "";
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg,
              color-mix(in srgb, var(--text) 7%, transparent) 0%,
              transparent 16%);
          opacity: .7;
        }

        .terminal-scan {
          position: absolute;
          inset: 0;
          pointer-events: none;
          opacity: .08;
          background:
            repeating-linear-gradient(
              180deg,
              rgba(255,255,255,.16) 0px,
              rgba(255,255,255,.16) 1px,
              transparent 2px,
              transparent 6px
            );
          mix-blend-mode: soft-light;
        }

        @keyframes terminalDrift {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(-10px, 12px, 0); }
        }

        @keyframes pulseLine {
          0%, 100% { opacity: .45; transform: scaleX(.92); }
          50% { opacity: 1; transform: scaleX(1); }
        }

        @keyframes spinLite {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
      {children}
    </div>
  );
}

function RefreshButton({ onClick, loading }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.98 }}
      className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em]"
      style={{
        background: "color-mix(in srgb, var(--bg-2) 80%, var(--panel))",
        border: "1px solid var(--border-rgba)",
        color: "var(--text)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          animation: loading ? "spinLite 1s linear infinite" : "none",
        }}
      >
        ↻
      </span>
      {loading ? "Actualizando" : "Actualizar"}
    </motion.button>
  );
}

function ModeTabs({ mode, setMode }) {
  const tabs = [
    { id: "overview", label: "Overview" },
    { id: "risk", label: "Risk" },
    { id: "cash", label: "Cash" },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const active = mode === tab.id;
        return (
          <motion.button
            key={tab.id}
            type="button"
            onClick={() => setMode(tab.id)}
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.98 }}
            className="rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em]"
            style={{
              background: active
                ? "color-mix(in srgb, var(--text) 10%, var(--panel))"
                : "transparent",
              border: active
                ? "1px solid color-mix(in srgb, var(--text) 18%, var(--border-rgba))"
                : "1px solid transparent",
              color: active ? "var(--text)" : "var(--muted)",
              boxShadow: active ? "0 0 18px rgba(255,255,255,0.06)" : "none",
            }}
          >
            {tab.label}
          </motion.button>
        );
      })}
    </div>
  );
}

function Panel({ title, subtitle, accent = "primary", children, className = "" }) {
  const color = accentColor(accent);

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      animate="show"
      whileHover={{ y: -3 }}
      className={`terminal-panel rounded-[22px] p-4 md:p-5 min-w-0 ${className}`}
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          animation: "pulseLine 3.6s ease-in-out infinite",
        }}
      />

      <div className="terminal-scan" />

      <motion.div
        className="absolute -top-16 -right-10 h-40 w-40 rounded-full blur-3xl opacity-[0.12]"
        style={{
          background: `color-mix(in srgb, ${color} 35%, transparent)`,
          animation: "terminalDrift 9s ease-in-out infinite",
        }}
      />

      <div className="relative z-10 min-w-0">
        <div className="mb-4 pb-3 border-b border-[color-mix(in_srgb,var(--border-rgba)_70%,transparent)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p
                className="text-[10px] uppercase tracking-[0.22em] font-bold"
                style={{ color: "var(--muted)" }}
              >
                {title}
              </p>
              {subtitle ? (
                <p
                  className="mt-2 text-sm leading-relaxed"
                  style={{ color: "color-mix(in srgb, var(--text) 78%, transparent)" }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>
            <motion.div
              className="h-2.5 w-2.5 rounded-full shrink-0 mt-1"
              style={{
                background: color,
                boxShadow: `0 0 18px ${color}`,
              }}
              animate={{ opacity: [0.5, 1, 0.5], scale: [1, 1.15, 1] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>
        </div>

        <div className="min-w-0">{children}</div>
      </div>
    </motion.section>
  );
}

function KpiCell({ label, value, tone = "default", kind = "money", note = "" }) {
  const color = accentColor(tone);
  const animated = useCountUp(value, 1000);
  const display =
    kind === "percent" ? formatPct(animated) : formatMoney(animated);

  return (
    <motion.div
      variants={fadeUp}
      whileHover={{ y: -2, scale: 1.01 }}
      className="rounded-[18px] px-4 py-3"
      style={{
        background: "color-mix(in srgb, var(--bg-2) 65%, var(--panel))",
        border: "1px solid color-mix(in srgb, var(--border-rgba) 82%, transparent)",
      }}
    >
      <p
        className="text-[10px] uppercase tracking-[0.2em] font-bold"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </p>

      <AnimatePresence mode="wait">
        <motion.p
          key={`${label}-${Math.round(Number(value) || 0)}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.24 }}
          className="mt-2 text-[clamp(16px,1.2vw,22px)] font-extrabold leading-none truncate"
          style={{ color: `color-mix(in srgb, ${color} 82%, var(--text))` }}
        >
          {display}
        </motion.p>
      </AnimatePresence>

      {note ? (
        <p
          className="mt-2 text-[11px] truncate"
          style={{ color: "var(--muted)" }}
          title={note}
        >
          {note}
        </p>
      ) : null}
    </motion.div>
  );
}

function AccountsTerminal({ accounts }) {
  if (!accounts?.length) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No hay balances de cuentas disponibles.
      </p>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3"
    >
      {accounts.slice(0, 8).map((acc) => (
        <motion.div
          key={acc.name}
          variants={fadeUp}
          whileHover={{ y: -3, scale: 1.01 }}
          className="rounded-[18px] p-4"
          style={{
            background: "color-mix(in srgb, var(--bg-2) 70%, var(--panel))",
            border: "1px solid color-mix(in srgb, var(--border-rgba) 84%, transparent)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <p
              className="text-[10px] uppercase tracking-[0.2em] font-bold truncate"
              style={{ color: "var(--muted)" }}
            >
              {acc.name}
            </p>
            <motion.div
              className="h-2 w-2 rounded-full shrink-0"
              style={{
                background:
                  Number(acc.balance) >= 0 ? "var(--success)" : "var(--danger)",
              }}
              animate={{ opacity: [0.55, 1, 0.55] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            />
          </div>

          <p
            className="mt-3 text-[clamp(18px,1.35vw,24px)] font-extrabold leading-none"
            style={{
              color:
                Number(acc.balance) >= 0 ? "var(--success)" : "var(--danger)",
            }}
          >
            {formatMoney(acc.balance)}
          </p>
        </motion.div>
      ))}
    </motion.div>
  );
}

function SignalList({ items }) {
  if (!items?.length) {
    return (
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        No hay señales relevantes.
      </p>
    );
  }

  return (
    <motion.div
      variants={stagger}
      initial="hidden"
      animate="show"
      className="space-y-3"
    >
      <AnimatePresence mode="popLayout">
        {items.map((item) => (
          <motion.div
            key={item.key}
            layout
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            whileHover={{ x: 2 }}
            className="rounded-[18px] p-4"
            style={{
              background: "color-mix(in srgb, var(--bg-2) 70%, var(--panel))",
              border: "1px solid color-mix(in srgb, var(--border-rgba) 84%, transparent)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className="text-sm font-bold leading-snug"
                  style={{ color: "var(--text)" }}
                >
                  {item.title}
                </p>
                {item.body ? (
                  <p
                    className="mt-1 text-sm leading-relaxed"
                    style={{ color: "var(--muted)" }}
                  >
                    {item.body}
                  </p>
                ) : null}
              </div>
              {item.value ? (
                <div
                  className="text-sm font-extrabold shrink-0"
                  style={{ color: item.color || "var(--text)" }}
                >
                  {item.value}
                </div>
              ) : null}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ModernDashboardPro({ token, setView }) {
  const api = import.meta.env.VITE_API_URL;

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [advancedBurn, setAdvancedBurn] = useState(null);
  const [coverage, setCoverage] = useState(null);
  const [unusual, setUnusual] = useState([]);
  const [overbudget, setOverbudget] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mode, setMode] = useState("overview");

  const load = useCallback(async () => {
    if (!token) return;

    const headers = { Authorization: `Bearer ${token}` };
    const burnParams = getStoredAdvancedBurnRateParams();

    const safe = async (promise) => {
      try {
        const res = await promise;
        return res.data;
      } catch (err) {
        console.error("Modern dashboard block failed:", err);
        return null;
      }
    };

    setLoading(true);

    const [
      summaryData,
      burnData,
      coverageData,
      unusualData,
      overbudgetData,
      accountsData,
    ] = await Promise.all([
      safe(axios.get(`${api}/dashboard/summary`, { headers })),
      safe(
        axios.get(`${api}/analytics/advanced-burn-rate-current-month`, {
          headers,
          params: {
            months: burnParams.months,
            min_occurrences: burnParams.minOccurrences,
            include_occasional: burnParams.includeOccasional,
            include_noise: burnParams.includeNoise,
            min_interval_days: burnParams.minIntervalDays,
            max_interval_days: burnParams.maxIntervalDays,
            max_coef_variation: burnParams.maxCoefVariation,
          },
        })
      ),
      safe(axios.get(`${api}/analytics/budget-coverage-robust`, { headers })),
      safe(axios.get(`${api}/analytics/unusual-expenses`, { headers })),
      safe(axios.get(`${api}/analytics/overbudget-categories`, { headers })),
      safe(axios.get(`${api}/analytics/account-balances`, { headers })),
    ]);

    setSummary(summaryData?.data || null);
    setAdvancedBurn(burnData?.data || null);
    setCoverage(coverageData?.data || null);
    setUnusual(unusualData?.data || []);
    setOverbudget(overbudgetData?.data || []);
    setAccounts(accountsData?.data || []);
    setLastUpdated(new Date());
    setLoading(false);
  }, [token, api]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = useMemo(() => {
    return {
      balance: Number(summary?.balance || 0),
      topCategoryName: summary?.topCategoryName || "—",
      topCategoryAmount: Number(summary?.topCategoryThisMonth?.amount || 0),
      coveragePct: Number(coverage?.totals?.coverage_pct || 0),
      burnDelta: Number(advancedBurn?.variance_to_expected || 0),
    };
  }, [summary, coverage, advancedBurn]);

  const signals = useMemo(() => {
    const items = [];

    if (overbudget?.length) {
      items.push({
        key: `over-${overbudget[0].category}-${Math.round(overbudget[0].over || 0)}`,
        title: `Sobrepresupuesto: ${overbudget[0].category}`,
        body: `Exceso actual de ${formatMoney(overbudget[0].over)} frente al límite mensual.`,
        value: formatMoney(overbudget[0].over),
        color: "var(--danger)",
      });
    }

    if (unusual?.length) {
      items.push({
        key: `unusual-${unusual[0].id}`,
        title: `Atípico en ${unusual[0].category}`,
        body: unusual[0].description || "Movimiento fuera del patrón histórico.",
        value: formatMoney(unusual[0].amount),
        color: "var(--warning)",
      });
    }

    if (advancedBurn) {
      const delta = Number(advancedBurn.variance_to_expected || 0);
      items.push({
        key: `burn-alert-${Math.round(delta)}`,
        title: delta > 0 ? "Burn rate acelerado" : "Burn rate controlado",
        body:
          delta > 0
            ? "El gasto acumulado está por encima de la trayectoria esperada."
            : "El gasto acumulado se mantiene dentro del rango esperado.",
        value: formatMoney(delta),
        color: delta > 0 ? "var(--danger)" : "var(--success)",
      });
    }

    return items.slice(0, 3);
  }, [overbudget, unusual, advancedBurn]);

  if (loading && !summary && !coverage && !advancedBurn) {
    return (
      <div
        className="rounded-[24px] border p-6"
        style={{
          background: "color-mix(in srgb, var(--panel) 82%, transparent)",
          borderColor: "var(--border-rgba)",
          color: "var(--muted)",
        }}
      >
        Cargando terminal financiera...
      </div>
    );
  }

  return (
    <TerminalShell>
      <motion.section
        variants={fadeUp}
        initial="hidden"
        animate="show"
        className="terminal-panel terminal-grid rounded-[26px] px-5 py-5 md:px-6 md:py-6"
      >
        <div className="terminal-scan" />

        <div className="relative z-10 grid grid-cols-1 2xl:grid-cols-[1.15fr,0.85fr] gap-5 min-w-0">
          <div className="min-w-0">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div
                  className="inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em]"
                  style={{
                    background: "color-mix(in srgb, var(--bg-2) 80%, var(--panel))",
                    border: "1px solid var(--border-rgba)",
                    color: "var(--muted)",
                  }}
                >
                  Trading terminal clean
                </div>

                <motion.button
                  type="button"
                  onClick={() => setView("dashboard")}
                  whileHover={{ y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold uppercase tracking-[0.18em]"
                  style={{
                    background: "color-mix(in srgb, var(--bg-2) 80%, var(--panel))",
                    border: "1px solid var(--border-rgba)",
                    color: "var(--muted)",
                  }}
                >
                  ← Clásico
                </motion.button>

                <RefreshButton onClick={load} loading={loading} />

                {lastUpdated ? (
                  <span
                    className="text-[11px] ml-auto"
                    style={{ color: "var(--muted)" }}
                  >
                    Actualizado: {lastUpdated.toLocaleTimeString("es-DO")}
                  </span>
                ) : null}
              </div>

              <div
                className="inline-flex flex-wrap items-center gap-2 rounded-2xl p-1"
                style={{
                  background: "color-mix(in srgb, var(--bg-2) 72%, var(--panel))",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <ModeTabs mode={mode} setMode={setMode} />
              </div>
            </div>

            <h1
              className="mt-4 text-[clamp(30px,4vw,64px)] font-black leading-[0.92] tracking-tight"
              style={{ color: "var(--heading)" }}
            >
              Control financiero con señal clara.
            </h1>

            <p
              className="mt-3 max-w-3xl text-sm md:text-base leading-relaxed"
              style={{ color: "color-mix(in srgb, var(--text) 78%, transparent)" }}
            >
              Una terminal visual enfocada en liquidez, presión de gasto,
              cobertura y concentración del dinero.
            </p>

            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="mt-5 grid grid-cols-2 xl:grid-cols-4 gap-3"
            >
              <KpiCell
                label="Balance"
                value={metrics.balance}
                tone={metrics.balance >= 0 ? "success" : "danger"}
              />
              <KpiCell
                label="Burn rate"
                value={metrics.burnDelta}
                tone={metrics.burnDelta <= 0 ? "success" : "danger"}
              />
              <KpiCell
                label="Cobertura"
                value={metrics.coveragePct}
                tone={metrics.coveragePct >= 80 ? "success" : "warning"}
                kind="percent"
              />
              <KpiCell
                label="Top categoría"
                value={metrics.topCategoryAmount}
                tone="danger"
                note={metrics.topCategoryName}
              />
            </motion.div>
          </div>

          <div className="min-w-0">
            <div className="mb-3">
              <p
                className="text-[10px] uppercase tracking-[0.22em] font-bold"
                style={{ color: "var(--muted)" }}
              >
                Balance por cuentas
              </p>
            </div>
            <AccountsTerminal accounts={accounts} />
          </div>
        </div>
      </motion.section>

      <AnimatePresence mode="wait">
        {mode === "overview" && (
          <motion.div
            key="overview"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-5"
          >
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-5 items-start min-w-0">
              <div className="2xl:col-span-8 min-w-0">
                <Panel
                  title="MOMENTUM ANUAL"
                  subtitle="Evolución mensual de ingresos y gastos para leer desaceleración o presión estructural."
                  accent="primary"
                >
                  <MonthlyIncomeVsExpenseLineChart token={token} />
                </Panel>
              </div>

              <div className="2xl:col-span-4 min-w-0">
                <Panel
                  title="SEÑALES DE MERCADO"
                  subtitle="Alertas de ejecución que requieren atención inmediata."
                  accent="warning"
                >
                  <SignalList items={signals} />
                </Panel>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.08fr,0.92fr] gap-5 items-start min-w-0">
              <Panel
                title="BURN RATE ENGINE"
                subtitle="Comparación del gasto real frente al patrón esperado del mes."
                accent="warning"
              >
                <AdvancedBurnRateChart token={token} />
              </Panel>

              <Panel
                title="GASTO POR CONCENTRACIÓN"
                subtitle={`La categoría dominante actual es ${metrics.topCategoryName} con ${formatMoney(
                  metrics.topCategoryAmount
                )}.`}
                accent="danger"
              >
                <ExpenseDistributionByCategoryChart
                  expensesByCategory={summary?.expensesByCategory || {}}
                  categoryNameMap={summary?.categoryNameMap || {}}
                  token={token}
                />
              </Panel>
            </div>
          </motion.div>
        )}

        {mode === "risk" && (
          <motion.div
            key="risk"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-5"
          >
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-5 items-start min-w-0">
              <div className="2xl:col-span-7 min-w-0">
                <Panel
                  title="PRESIÓN POR CATEGORÍA"
                  subtitle="Lectura de categorías que están empujando el gasto del período."
                  accent="danger"
                >
                  <TopVariableCategoriesChart token={token} />
                </Panel>
              </div>

              <div className="2xl:col-span-5 min-w-0">
                <Panel
                  title="SEÑALES DE RIESGO"
                  subtitle="Eventos que alteran el patrón financiero esperado."
                  accent="warning"
                >
                  <SignalList items={signals} />
                </Panel>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.05fr,0.95fr] gap-5 items-start min-w-0">
              <Panel
                title="GASTOS HORMIGA"
                subtitle="Pequeños gastos repetitivos que erosionan el flujo sin llamar demasiado la atención."
                accent="warning"
              >
                <AntExpensesReport token={token} compact />
              </Panel>

              <Panel
                title="OUTLIERS"
                subtitle="Movimientos fuera de patrón detectados en el período actual."
                accent="warning"
              >
                <UnusualExpensesTable token={token} />
              </Panel>
            </div>
          </motion.div>
        )}

        {mode === "cash" && (
          <motion.div
            key="cash"
            variants={pageTransition}
            initial="initial"
            animate="animate"
            exit="exit"
            className="space-y-5"
          >
            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-5 items-start min-w-0">
              <div className="2xl:col-span-7 min-w-0">
                <Panel
                  title="COBERTURA PRESUPUESTARIA"
                  subtitle="Mide cuánto del gasto realmente está respaldado por presupuesto."
                  accent="success"
                >
                  <BudgetCoverageRobustChart token={token} />
                </Panel>
              </div>

              <div className="2xl:col-span-5 min-w-0">
                <Panel
                  title="GASTO POR CONCENTRACIÓN"
                  subtitle={`La categoría dominante actual es ${metrics.topCategoryName} con ${formatMoney(
                    metrics.topCategoryAmount
                  )}.`}
                  accent="danger"
                >
                  <ExpenseDistributionByCategoryChart
                    expensesByCategory={summary?.expensesByCategory || {}}
                    categoryNameMap={summary?.categoryNameMap || {}}
                    token={token}
                  />
                </Panel>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.08fr,0.92fr] gap-5 items-start min-w-0">
              <Panel
                title="MOMENTUM ANUAL"
                subtitle="Comportamiento estructural del flujo financiero."
                accent="primary"
              >
                <MonthlyIncomeVsExpenseLineChart token={token} />
              </Panel>

              <Panel
                title="BURN RATE ENGINE"
                subtitle="Estado actual del ritmo de gasto del período."
                accent="warning"
              >
                <AdvancedBurnRateChart token={token} />
              </Panel>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </TerminalShell>
  );
}
