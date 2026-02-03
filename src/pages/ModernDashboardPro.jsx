// src/pages/ReportesDashboard.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import ReactECharts from "echarts-for-react";

import ExpenseDistributionRingsByCategoryChart from "../components/reports/ExpenseDistributionRingsByCategoryChart";

// ---------------- helpers ----------------
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

const money = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

const pct = (v) => `${(Number.isFinite(Number(v)) ? Number(v) : 0).toFixed(1)}%`;

const isCanceled = (err) =>
  err?.name === "CanceledError" ||
  err?.code === "ERR_CANCELED" ||
  String(err?.message || "").toLowerCase().includes("canceled");

// ✅ Paleta Mark III (manteniendo vibe anterior)
const THEME = {
  bg0: "#2A0507",
  bg1: "#3A070A",
  panel: "rgba(90, 10, 14, 0.55)",
  border: "rgba(255, 215, 128, 0.18)",
  borderStrong: "rgba(255, 215, 128, 0.30)",
  gold: "#D6A43A",
  gold2: "#FFD37A",
  cyan: "#22D3EE",
  rose: "#FB7185",
  text: "rgba(255,255,255,0.92)",
  muted: "rgba(255,255,255,0.70)", // ⬆️ menos opaco
  grid: "rgba(255,255,255,0.12)",  // ⬆️ más visible
};

const panelBase =
  "relative rounded-2xl overflow-hidden border backdrop-blur-xl shadow-[0_20px_70px_rgba(0,0,0,0.55)]";

const panelStyle = {
  background: `linear-gradient(180deg, rgba(90,10,14,0.62) 0%, rgba(35,5,7,0.55) 100%)`,
  borderColor: THEME.border,
};

const subtleGridStyle = {
  backgroundImage:
    "radial-gradient(circle at 1px 1px, rgba(255,215,128,0.12) 1px, transparent 0)",
  backgroundSize: "22px 22px",
  opacity: 0.25,
};

// ✅ Tooltips: por encima de todo, sin recorte
const baseTooltip = () => ({
  trigger: "axis",
  appendToBody: true,
  confine: false,
  renderMode: "html",
  extraCssText:
    "z-index:2147483647; box-shadow:0 18px 45px rgba(0,0,0,0.90); border-radius:12px; border:1px solid rgba(255,215,128,0.20);",
});

function ChipGold({ children }) {
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold"
      style={{
        color: "rgba(255,230,175,0.95)",
        background: "rgba(214,164,58,0.12)",
        borderColor: "rgba(255,215,128,0.22)",
      }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ title, subtitle, right }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold" style={{ color: THEME.text }}>
          {title}
        </div>
        {subtitle ? (
          <div className="mt-0.5 text-xs" style={{ color: THEME.muted }}>
            {subtitle}
          </div>
        ) : null}
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </div>
  );
}

function StatCard({ label, value, hint, loading, right }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 240, damping: 18 }}
      className={`${panelBase} p-4`}
      style={panelStyle}
    >
      <div className="pointer-events-none absolute inset-0" style={subtleGridStyle} />

      <div className="flex items-start justify-between gap-3">
        {/* ✅ overflow safe */}
        <div className="min-w-0">
          <div
            className="text-[11px] tracking-[0.25em] uppercase"
            style={{ color: "rgba(255,255,255,0.80)" }}
          >
            {label}
          </div>

          <div className="mt-1 text-xl font-semibold truncate" style={{ color: THEME.text }}>
            {loading ? "…" : value}
          </div>

          {hint ? (
            <div
              className="mt-1 text-xs break-words"
              style={{ color: "rgba(255,255,255,0.74)" }}
            >
              {loading ? " " : hint}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          {right}
        </div>
      </div>
    </motion.div>
  );
}

// ✅ Card rotativa de cuenta (cada 10s) usando /accounts/balances
function RotatingAccountCard({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [accounts, setAccounts] = useState([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();

    setLoading(true);
    axios
      .get(`${api}/accounts/balances`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      .then((res) => setAccounts(res?.data?.data || []))
      .catch((e) => {
        if (!isCanceled(e)) console.error("Error cargando balances de cuentas:", e);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [token, api]);

  useEffect(() => {
    if (!accounts.length) return;
    setIdx(0);
    const t = setInterval(() => {
      setIdx((p) => (p + 1) % accounts.length);
    }, 10_000);
    return () => clearInterval(t);
  }, [accounts]);

  const current = accounts[idx] || null;

  const total = Number(current?.current_balance ?? 0);
  const reserved = Number(current?.reserved_total ?? 0);
  const available = Number(current?.available_balance ?? total);

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 240, damping: 18 }}
      className={`${panelBase} p-4`}
      style={panelStyle}
    >
      <div className="pointer-events-none absolute inset-0" style={subtleGridStyle} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.80)" }}>
            Cuenta destacada
          </div>

          {/* ✅ nombre más pequeño */}
          <div className="mt-1 text-base font-semibold truncate" style={{ color: THEME.text }}>
            {loading ? "…" : current ? current.name : "Sin cuentas"}
          </div>

          {/* ✅ montos más grandes */}
          {current ? (
            <div className="mt-2 space-y-1">
              <div className="text-lg font-extrabold" style={{ color: THEME.text }}>
                Total: {money(total)}
              </div>
              <div className="text-base font-semibold" style={{ color: "rgba(255,255,255,0.86)" }}>
                Disponible: {money(available)}
              </div>
              {/* opcional, por si quieres mostrarlo */}
              {reserved > 0 ? (
                <div className="text-xs" style={{ color: THEME.muted }}>
                  Reservado en metas: {money(reserved)}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-2 text-xs" style={{ color: THEME.muted }}>
              Registra cuentas para ver rotación automática.
            </div>
          )}
        </div>

        <div className="shrink-0 flex items-center gap-2">
          <ChipGold>
            {accounts.length ? `${idx + 1}/${accounts.length}` : "—"}
          </ChipGold>
        </div>
      </div>
    </motion.div>
  );
}

export default function ReportesDashboard({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [summary, setSummary] = useState(null);
  const [monthly, setMonthly] = useState([]);
  const [coverage, setCoverage] = useState(null);
  const [burn, setBurn] = useState(null);

  const [year, setYear] = useState(new Date().getFullYear());
  const [useAdvancedBurn, setUseAdvancedBurn] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const controller = new AbortController();
    const headers = { Authorization: `Bearer ${token}` };
    const req = (url, params) =>
      axios.get(url, { headers, params, signal: controller.signal });

    setLoading(true);

    (async () => {
      const results = await Promise.allSettled([
        req(`${api}/dashboard/summary`),
        req(`${api}/analytics/monthly-income-expense-avg`, { year }),
        req(`${api}/analytics/budget-coverage-robust`, { year }),
        req(
          `${api}/analytics/${
            useAdvancedBurn
              ? "advanced-burn-rate-current-month"
              : "spending-burn-rate-current-month"
          }`
        ),
      ]);

      const pick = (i) =>
        results[i].status === "fulfilled" ? results[i].value?.data?.data : null;

      results
        .filter((r) => r.status === "rejected" && !isCanceled(r.reason))
        .forEach((r) => console.error(r.reason));

      setSummary(pick(0));
      setMonthly(pick(1) || []);
      setCoverage(pick(2));
      setBurn(pick(3));

      setLoading(false);
    })().catch((e) => {
      if (!isCanceled(e)) console.error(e);
      setLoading(false);
    });

    return () => controller.abort();
  }, [token, api, year, useAdvancedBurn]);

  // KPIs mes actual
  const kpis = useMemo(() => {
    const totalIncome = Number(summary?.totalIncome || 0);
    const totalExpense = Number(summary?.totalExpense || 0);
    const balance = Number(summary?.balance || 0);
    const cashflow = totalIncome - totalExpense;

    const budget = Number(summary?.totalMonthlyBudget || 0);
    const budgetBalance = Number(summary?.budgetBalance || 0);

    const avgDaily = Number(summary?.averageDailyExpense || 0);
    const txCount = Number(summary?.totalTransactions || 0);

    return { totalIncome, totalExpense, balance, cashflow, budget, budgetBalance, avgDaily, txCount };
  }, [summary]);

  // Totales del año (para Ingresos vs Gastos)
  const yearTotals = useMemo(() => {
    const yIncome = (monthly || []).reduce((a, r) => a + Number(r.income || 0), 0);
    const yExpense = (monthly || []).reduce((a, r) => a + Number(r.expense || 0), 0);
    const net = yIncome - yExpense;

    const expenseRatio = yIncome > 0 ? (yExpense / yIncome) * 100 : 0; // puede ser > 100 si gastaste más
    return { yIncome, yExpense, net, expenseRatio };
  }, [monthly]);

  // ---- Charts ECharts ----
  const optCoverage = useMemo(() => {
    const months = coverage?.months || [];
    const x = months.map((m) => m.month);
    const covered = months.map((m) => Number(m.covered || 0));
    const over = months.map((m) => Number(m.over_budget_total || 0));
    const without = months.map((m) => Number(m.without_budget_total || 0));
    const pctLine = months.map((m) => Number(m.coverage_pct || 0));

    return {
      backgroundColor: "transparent",
      animationDuration: 900,
      tooltip: { ...baseTooltip(), valueFormatter: (v) => money(v) },
      legend: { top: 0, textStyle: { color: "rgba(255,255,255,0.90)" } },
      grid: { left: 44, right: 36, top: 34, bottom: 28 },
      xAxis: {
        type: "category",
        data: x,
        axisLabel: { color: "rgba(255,255,255,0.78)" },
        axisLine: { lineStyle: { color: THEME.grid } },
      },
      yAxis: [
        {
          type: "value",
          axisLabel: { color: "rgba(255,255,255,0.78)" },
          splitLine: { lineStyle: { color: THEME.grid } },
        },
        {
          type: "value",
          min: 0,
          max: 100,
          axisLabel: { formatter: "{value}%", color: "rgba(255,255,255,0.74)" },
          splitLine: { show: false },
        },
      ],
      series: [
        { name: "Cubierto", type: "bar", stack: "cov", data: covered, barWidth: 12, itemStyle: { color: THEME.gold2, opacity: 0.85 } },
        { name: "Sobre presupuesto", type: "bar", stack: "cov", data: over, itemStyle: { color: THEME.rose, opacity: 0.78 } },
        { name: "Sin presupuesto", type: "bar", stack: "cov", data: without, itemStyle: { color: "rgba(34,211,238,0.60)", opacity: 0.72 } },
        { name: "Cobertura %", type: "line", yAxisIndex: 1, data: pctLine, smooth: true, showSymbol: false, lineStyle: { width: 2.5, color: THEME.cyan } },
      ],
    };
  }, [coverage]);

  const optPerformance = useMemo(() => {
    const x = (monthly || []).map((r) => r.month);
    const inc = (monthly || []).map((r) => Number(r.income || 0));
    const exp = (monthly || []).map((r) => Number(r.expense || 0));
    const bal = (monthly || []).map((r) => Number(r.balance || 0));

    return {
      backgroundColor: "transparent",
      animationDuration: 900,
      tooltip: { ...baseTooltip(), valueFormatter: (v) => money(v) },
      legend: { top: 0, textStyle: { color: "rgba(255,255,255,0.90)" } },
      grid: { left: 44, right: 24, top: 34, bottom: 28 },
      xAxis: { type: "category", data: x, axisLabel: { color: "rgba(255,255,255,0.78)" }, axisLine: { lineStyle: { color: THEME.grid } } },
      yAxis: { type: "value", axisLabel: { color: "rgba(255,255,255,0.78)" }, splitLine: { lineStyle: { color: THEME.grid } } },
      series: [
        { name: "Ingresos", type: "bar", data: inc, barWidth: 12, itemStyle: { color: "rgba(34,211,238,0.75)" } },
        { name: "Gastos", type: "bar", data: exp, barWidth: 12, itemStyle: { color: THEME.rose, opacity: 0.78 } },
        { name: "Balance", type: "line", data: bal, smooth: true, showSymbol: false, lineStyle: { width: 2.5, color: THEME.gold2 } },
      ],
    };
  }, [monthly]);

  // ✅ Donut: Ingresos vs Gastos (foco principal)
  const optIncomeVsExpense = useMemo(() => {
    const income = Math.max(0, yearTotals.yIncome);
    const expense = Math.max(0, yearTotals.yExpense);
    const net = yearTotals.net;

    // base: “sobre ingresos”
    const coveredExpense = Math.min(expense, income);
    const remaining = Math.max(0, income - expense);
    const overspend = Math.max(0, expense - income);

    const ratio = income > 0 ? (expense / income) * 100 : 0;

    return {
      backgroundColor: "transparent",
      animationDuration: 900,
      tooltip: {
        trigger: "item",
        appendToBody: true,
        confine: false,
        renderMode: "html",
        extraCssText:
          "z-index:2147483647; box-shadow:0 18px 45px rgba(0,0,0,0.90); border-radius:12px; border:1px solid rgba(255,215,128,0.20);",
        formatter: (p) => `${p.name}: ${money(p.value)}`,
      },
      series: [
        {
          type: "pie",
          radius: ["62%", "82%"],
          center: ["50%", "55%"],
          label: { show: false },
          data: [
            { value: coveredExpense, name: "Gastos", itemStyle: { color: THEME.rose, shadowBlur: 16, shadowColor: "rgba(251,113,133,0.22)" } },
            { value: remaining, name: "Disponible", itemStyle: { color: THEME.cyan, shadowBlur: 16, shadowColor: "rgba(34,211,238,0.18)" } },
            ...(overspend > 0
              ? [
                  {
                    value: overspend,
                    name: "Exceso (sobre ingresos)",
                    itemStyle: { color: THEME.gold2, shadowBlur: 16, shadowColor: "rgba(255,215,128,0.20)" },
                  },
                ]
              : []),
          ],
        },
      ],
      graphic: [
        { type: "text", left: "center", top: "39%", style: { text: "Ingresos vs gastos", fill: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: 700 } },
        { type: "text", left: "center", top: "47%", style: { text: `${ratio.toFixed(1)}%`, fill: THEME.text, fontSize: 28, fontWeight: 900 } },
        { type: "text", left: "center", top: "58%", style: { text: "Gastos como % de ingresos", fill: "rgba(255,255,255,0.66)", fontSize: 11, fontWeight: 600 } },
        { type: "text", left: "center", top: "66%", style: { text: `Balance: ${money(net)}`, fill: net >= 0 ? THEME.cyan : THEME.rose, fontSize: 11, fontWeight: 800 } },
      ],
    };
  }, [yearTotals]);

  const optBurn = useMemo(() => {
    const series = burn?.series || [];
    const x = series.map((s) => s.date);
    const actual = series.map((s) => Number(s.actual_cumulative ?? 0));
    const expected = series.map((s) => Number(s.expected_cumulative ?? s.ideal_cumulative ?? 0));

    return {
      backgroundColor: "transparent",
      animationDuration: 900,
      tooltip: { ...baseTooltip(), valueFormatter: (v) => money(v) },
      legend: { top: 0, textStyle: { color: "rgba(255,255,255,0.90)" } },
      grid: { left: 44, right: 24, top: 34, bottom: 28 },
      xAxis: { type: "category", data: x, axisLabel: { color: "rgba(255,255,255,0.78)", formatter: (v) => String(v).slice(-2) }, axisLine: { lineStyle: { color: THEME.grid } } },
      yAxis: { type: "value", axisLabel: { color: "rgba(255,255,255,0.78)" }, splitLine: { lineStyle: { color: THEME.grid } } },
      series: [
        { name: "Esperado", type: "line", data: expected, smooth: true, showSymbol: false, lineStyle: { width: 2.5, color: THEME.gold2 } },
        { name: "Real", type: "line", data: actual, smooth: true, showSymbol: false, lineStyle: { width: 2.5, color: THEME.cyan }, areaStyle: { opacity: 0.10 } },
      ],
    };
  }, [burn]);

  // Top drivers
  const drivers = useMemo(() => {
    const topOver = (coverage?.top_categories_over_budget || []).slice(0, 5);
    const topWithout = (coverage?.top_categories_without_budget || []).slice(0, 5);
    const topMonths = (coverage?.top_uncovered_months || []).slice(0, 5);
    return { topOver, topWithout, topMonths };
  }, [coverage]);

  return (
    <div
      className="relative min-h-screen overflow-hidden"
      style={{
        background: `radial-gradient(1200px 600px at 20% 0%, rgba(255,215,128,0.10) 0%, transparent 60%),
                     radial-gradient(900px 500px at 80% 20%, rgba(34,211,238,0.10) 0%, transparent 60%),
                     linear-gradient(180deg, ${THEME.bg1} 0%, ${THEME.bg0} 70%)`,
        color: THEME.text,
      }}
    >
      <div className="relative mx-auto max-w-7xl px-4 py-10">
        {/* Header + controles */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
        >
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.35em] uppercase" style={{ color: "rgba(255,215,128,0.92)" }}>
              Reportes
            </div>
            <h1 className="mt-1 text-2xl md:text-4xl font-semibold">Panel analítico</h1>
            <div className="mt-2 text-sm" style={{ color: THEME.muted }}>
              Ingresos vs gastos, cobertura y burn rate.
            </div>
          </div>

          <div className={`${panelBase} px-4 py-3 flex flex-wrap items-center gap-3`} style={{ ...panelStyle, borderColor: THEME.borderStrong }}>
            <div className="text-[11px] tracking-[0.25em] uppercase" style={{ color: "rgba(255,255,255,0.80)" }}>
              Año
            </div>
            <input
              type="number"
              value={year}
              min="2000"
              onChange={(e) => setYear(Number(e.target.value || year))}
              className="w-28 rounded-lg border px-3 py-1.5 outline-none"
              style={{ background: "rgba(0,0,0,0.20)", borderColor: "rgba(255,215,128,0.20)", color: THEME.text }}
            />

            <label className="flex items-center gap-2 text-xs select-none" style={{ color: "rgba(255,255,255,0.84)" }}>
              <input checked={useAdvancedBurn} onChange={(e) => setUseAdvancedBurn(e.target.checked)} type="checkbox" />
              Burn rate avanzado
            </label>
          </div>
        </motion.div>

        {/* KPI row (5 cards) */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.06 }}
          className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4"
        >
          <StatCard
            label="Ingresos (mes)"
            value={money(kpis.totalIncome)}
            hint={`Flujo neto: ${money(kpis.cashflow)}`}
            loading={loading}
            right={<ChipGold>Mes actual</ChipGold>}
          />
          <StatCard
            label="Gastos (mes)"
            value={money(kpis.totalExpense)}
            hint={`Promedio diario: ${money(kpis.avgDaily)}`}
            loading={loading}
            right={<ChipGold>Salida</ChipGold>}
          />
          <StatCard
            label="Balance (mes)"
            value={money(kpis.balance)}
            hint={`Transacciones: ${kpis.txCount || 0}`}
            loading={loading}
            right={<ChipGold>Estado</ChipGold>}
          />
          <StatCard
            label="Balance de presupuesto (mes)"
            value={money(kpis.budgetBalance)}
            hint={`Presupuesto: ${money(kpis.budget)}`}
            loading={loading}
            right={<ChipGold>En control</ChipGold>}
          />

          <RotatingAccountCard token={token} />
        </motion.div>

        {/* Grid principal */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Cobertura */}
          <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.10 }}
            className={`${panelBase} p-4 lg:col-span-5`}
            style={panelStyle}
          >
            <SectionTitle
              title="Cobertura de presupuesto"
              subtitle={
                coverage?.totals
                  ? `Cobertura anual: ${pct(coverage.totals.coverage_pct)} · No cubierto: ${money(coverage.totals.uncovered_total)}`
                  : loading ? "Cargando…" : "—"
              }
              right={<ChipGold>{year}</ChipGold>}
            />
            <div className="mt-3 h-[280px]">
              <ReactECharts option={optCoverage} style={{ height: "100%" }} />
            </div>
          </motion.div>

          {/* ✅ Ingresos vs Gastos (foco) */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.12 }}
            className={`${panelBase} p-4 lg:col-span-3`}
            style={panelStyle}
          >
            <SectionTitle
              title="Ingresos vs gastos (año)"
              subtitle={`Gastos como % de ingresos · ${year}`}
              right={<ChipGold>{year}</ChipGold>}
            />
            <div className="mt-3 h-[280px]">
              <ReactECharts option={optIncomeVsExpense} style={{ height: "100%" }} />
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs" style={{ color: THEME.muted }}>
              <span>Ingresos: <span style={{ color: "rgba(255,255,255,0.90)" }}>{money(yearTotals.yIncome)}</span></span>
              <span className="opacity-50">·</span>
              <span>Gastos: <span style={{ color: "rgba(255,255,255,0.90)" }}>{money(yearTotals.yExpense)}</span></span>
            </div>
          </motion.div>

          {/* Performance */}
          <motion.div
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.14 }}
            className={`${panelBase} p-4 lg:col-span-4`}
            style={panelStyle}
          >
            <SectionTitle
              title="Rendimiento financiero"
              subtitle="Ingresos vs gastos + balance"
              right={<ChipGold>{year}</ChipGold>}
            />
            <div className="mt-3 h-[280px]">
              <ReactECharts option={optPerformance} style={{ height: "100%" }} />
            </div>
          </motion.div>

          {/* Burn rate */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
            className={`${panelBase} p-4 lg:col-span-8`}
            style={panelStyle}
          >
            <SectionTitle
              title="Control de burn rate"
              subtitle={burn ? `${burn.month || "Mes actual"} · esperado vs real` : loading ? "Cargando…" : "—"}
              right={<ChipGold>Burn rate</ChipGold>}
            />
            <div className="mt-3 h-[280px]">
              <ReactECharts option={optBurn} style={{ height: "100%" }} />
            </div>
          </motion.div>

          {/* Top drivers */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.20 }}
            className={`${panelBase} p-4 lg:col-span-4`}
            style={panelStyle}
          >
            <SectionTitle
              title="Top drivers"
              subtitle="Lo que más empuja el desorden del presupuesto"
              right={<ChipGold>Drivers</ChipGold>}
            />

            <div className="mt-4 grid grid-cols-1 gap-3">
              <div className="rounded-xl border p-3" style={{ borderColor: "rgba(255,215,128,0.16)", background: "rgba(0,0,0,0.16)" }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold" style={{ color: THEME.text }}>
                    Sobre presupuesto
                  </div>
                  <ChipGold>Top</ChipGold>
                </div>
                <div className="mt-2 space-y-1">
                  {drivers.topOver.length ? (
                    drivers.topOver.map((r) => (
                      <div key={r.category_id} className="flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0 truncate" style={{ color: "rgba(255,255,255,0.84)" }}>
                          {r.category_name}
                        </div>
                        <div className="shrink-0" style={{ color: "rgba(255,255,255,0.90)" }}>
                          {money(r.total_over_budget)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs" style={{ color: THEME.muted }}>
                      {loading ? "Cargando…" : "Sin datos"}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border p-3" style={{ borderColor: "rgba(255,215,128,0.16)", background: "rgba(0,0,0,0.16)" }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold" style={{ color: THEME.text }}>
                    Sin presupuesto
                  </div>
                  <ChipGold>Top</ChipGold>
                </div>
                <div className="mt-2 space-y-1">
                  {drivers.topWithout.length ? (
                    drivers.topWithout.map((r) => (
                      <div key={r.category_id} className="flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0 truncate" style={{ color: "rgba(255,255,255,0.84)" }}>
                          {r.category_name}
                        </div>
                        <div className="shrink-0" style={{ color: "rgba(255,255,255,0.90)" }}>
                          {money(r.total_without_budget)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs" style={{ color: THEME.muted }}>
                      {loading ? "Cargando…" : "Sin datos"}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-xl border p-3" style={{ borderColor: "rgba(255,215,128,0.16)", background: "rgba(0,0,0,0.14)" }}>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold" style={{ color: THEME.text }}>
                    Meses con más “no cubierto”
                  </div>
                  <ChipGold>Top</ChipGold>
                </div>
                <div className="mt-2 space-y-1">
                  {drivers.topMonths.length ? (
                    drivers.topMonths.map((m) => (
                      <div key={m.month} className="flex items-center justify-between text-xs gap-3">
                        <div className="min-w-0 truncate" style={{ color: "rgba(255,255,255,0.84)" }}>
                          {m.month}
                        </div>
                        <div className="shrink-0" style={{ color: "rgba(255,255,255,0.90)" }}>
                          {money(m.uncovered_total)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs" style={{ color: THEME.muted }}>
                      {loading ? "Cargando…" : "Sin datos"}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* ✅ Distribución por categoría (universo completo) */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.10 }}
            className={`${panelBase} p-4 lg:col-span-12`}
            style={panelStyle}
          >
            <SectionTitle
              title="Distribución de gastos por categoría"
              subtitle="Universo completo · anillos tipo metas deportivas · clic para ver transacciones"
              right={<ChipGold>Categorías</ChipGold>}
            />
            <div className="mt-3">
              <ExpenseDistributionRingsByCategoryChart
                expensesByCategory={summary?.expensesByCategory || {}}
                categoryNameMap={summary?.categoryNameMap || {}}
                token={token}
              />
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
