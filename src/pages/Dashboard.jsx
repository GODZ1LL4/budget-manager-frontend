import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";

import CollapseSection from "../components/CollapseSection";
import ItemPriceTrendChart from "../components/reports/ItemPriceTrendChart";
import ExpenseDistributionByCategoryChart from "../components/reports/ExpenseDistributionByCategoryChart";
import BudgetVsActualChart from "../components/reports/BudgetVsActualChart";
import AccountBalancesChart from "../components/reports/AccountBalancesChart";
import OverBudgetChart from "../components/reports/OverBudgetChart";
import MonthlyIncomeVsExpenseChart from "../components/reports/MonthlyIncomeVsExpenseChart";
import CategoryVariationChart from "../components/reports/CategoryVariationChart";
import TransactionsCalendar from "../components/reports/TransactionsCalendar";
import BudgetVsActualSummaryChart from "../components/reports/BudgetVsActualSummaryChart";
import ExpenseByStabilityChart from "../components/reports/ExpenseByStabilityChart";
import TopVariableCategoriesChart from "../components/reports/TopVariableCategoriesChart";
import GoalsProgressChart from "../components/reports/GoalsProgressChart";
import ProjectedExpenseByCategoryChart from "../components/reports/ProjectedExpenseByCategoryChart";
import ProjectedIncomeByCategoryChart from "../components/reports/ProjectedIncomeByCategoryChart";
import ItemTrendChart from "../components/reports/ItemTrendChart";
import CategoryMonthlyComparisonTable from "../components/reports/CategoryMonthlyComparisonTable";
import ItemMonthlyComparisonTable from "../components/reports/ItemMonthlyComparisonTable";
import TopItemsByCategoryChart from "../components/reports/TopItemsByCategoryChart";
import ItemsAnnualSummaryTable from "../components/reports/ItemsAnnualSummaryTable";
import BurnRateChart from "../components/reports/BurnRateChart";

import ExpenseByWeekdayChart from "../components/reports/ExpenseByWeekdayChart";

import BudgetCoverageChart from "../components/reports/BudgetCoverageChart";
import ProjectedVsActualExpenseByCategoryChart from "../components/reports/ProjectedVsActualExpenseByCategoryChart";
import UnusualExpensesTable from "../components/reports/UnusualExpensesTable";
import CategoryMonthlyHeatmap from "../components/reports/CategoryMonthlyHeatmap";
import RecurringExpensePatternsTable from "../components/reports/RecurringExpensePatternsTable";
import ExpenseIntervalsByCategoryTable from "../components/reports/ExpenseIntervalsByCategoryTable";
import RecurringItemPatternsTable from "../components/reports/RecurringItemPatternsTable";
import ExpenseForecastChart from "../components/reports/ExpenseForecastChart";
import AdvancedBurnRateChart from "../components/reports/AdvancedBurnRateChart";
import MonthlyIncomeVsExpenseLineChart from "../components/reports/MonthlyIncomeVsExpenseLineChart";
import BudgetCoverageRobustChart from "../components/reports/BudgetCoverageRobustChart";

function Dashboard({ token }) {
  const [data, setData] = useState(null);
  const api = import.meta.env.VITE_API_URL;
  const [categories, setCategories] = useState([]);

  const [todayExpense, setTodayExpense] = useState(0);
  const [yearlyStabilitySummary, setYearlyStabilitySummary] = useState(null);

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${api}/dashboard/summary`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setData(res.data.data);
    } catch {
      alert("Error al cargar el dashboard");
    }
  };

  useEffect(() => {
    if (token) {
      axios
        .get(`${api}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => setCategories(res.data.data))
        .catch(() => console.error("Error al cargar categorías"));
    }
  }, [token]);

  useEffect(() => {
    if (token) fetchSummary();
  }, [token]);

  useEffect(() => {
    const fetchTodayExpense = async () => {
      try {
        const res = await axios.get(`${api}/dashboard/today-expense`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTodayExpense(res.data.data.totalExpenseToday || 0);
      } catch (err) {
        console.error("Error al cargar gasto de hoy:", err);
      }
    };

    if (token) fetchTodayExpense();
  }, [token]);

  useEffect(() => {
    const fetchYearlyStabilitySummary = async () => {
      try {
        const res = await axios.get(
          `${api}/analytics/yearly-income-expense-by-stability`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setYearlyStabilitySummary(res.data.data);
      } catch (err) {
        console.error(
          "Error al cargar resumen anual por tipo de estabilidad:",
          err
        );
      }
    };

    if (token) fetchYearlyStabilitySummary();
  }, [token]);

  useEffect(() => {
    const runDailyRecurring = async () => {
      const today = new Date().toISOString().split("T")[0];
      const key = `daily_job_executed_${today}`;

      if (!localStorage.getItem(key)) {
        try {
          const res = await axios.post(
            `${api}/jobs/run-daily-recurring`,
            null,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          localStorage.setItem(key, "1");

          const count = res.data.insertedCount || 0;
          if (count > 0) {
            toast.success(
              `✅ Se registraron ${count} transacciones recurrentes hoy.`
            );
          } else {
            toast.info("✅ Job ejecutado, sin nuevas transacciones hoy.");
          }
        } catch (err) {
          toast.error(
            `❌ Error al ejecutar job diario: ${
              err.response?.data?.error || err.message
            }`
          );
        }
      }
    };

    if (token) runDailyRecurring();
  }, [token]);

  if (!data) return <p className="p-4">Cargando métricas...</p>;

  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).getDate();
  const projectedExpense = data.averageDailyExpense * daysInMonth;

  const budgetUsagePct =
    data.totalMonthlyBudget > 0
      ? (data.budgetedExpenseTotal / data.totalMonthlyBudget) * 100
      : 0;

  const incomeSpentPct =
    data.totalIncome > 0 ? (data.totalExpense / data.totalIncome) * 100 : 0;

  const projectedSaving = data.totalIncome - projectedExpense;

  const formatSignedCurrency = (amount) => {
    const safe = Number.isFinite(Number(amount)) ? Number(amount) : 0;
    const sign = safe > 0 ? "+" : safe < 0 ? "-" : "";
    const abs = Math.abs(safe);

    const formatted = new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(abs);

    return `${sign}${formatted}`;
  };

  // Helpers UI tokenizados (ponlos dentro de Dashboard, antes del return)
  const ui = {
    text: "var(--text)",
    muted: "var(--muted)",

    // tonos “intermedios” para texto
    soft: "color-mix(in srgb, var(--text) 78%, transparent)",
    soft2: "color-mix(in srgb, var(--text) 70%, transparent)",
    subtle: "color-mix(in srgb, var(--muted) 85%, transparent)",

    // border
    border: "color-mix(in srgb, var(--border-rgba) 85%, transparent)",

    // semánticos
    success: "var(--success)",
    danger: "var(--danger)",
    warning: "var(--warning)",
  };

  const dividerStyle = { borderTop: `1px solid ${ui.border}` };

  const deltaStyle = (isGood) => ({
    color: isGood ? ui.success : ui.danger,
    fontWeight: 800,
  });

  const boldText = { color: ui.text, fontWeight: 700 };
  const labelMuted = { color: ui.soft };
  const labelStrong = { color: ui.text, fontWeight: 600 };
  const metaMuted = { color: ui.subtle };

  return (
    <div className="p-4 space-y-6">
      <h2
        className="ff-h1 ff-heading-accent mb-2"
        
      >
        Dashboard Financiero
      </h2>

      <div className="grid md:grid-cols-4 gap-4">
        {/* === Grupo 1 === */}
        <MetricCard
          title="Ingreso fijo promedio"
          value={data.fixedIncomeAverage}
          isCurrency
          color="green"
        />
        <MetricCard
          title="Ingresos"
          value={data.totalIncome}
          isCurrency
          color="green"
        />
        <MetricCard
          title="Gastos"
          value={data.totalExpense}
          isCurrency
          color="red"
        />
        <MetricCard
          title="Balance"
          value={data.balance}
          isCurrency
          color={data.balance >= 0 ? "green" : "red"}
        />
        {/* === Grupo 2 === */}
        <MetricCard
          title="Presupuesto del mes"
          value={data.totalMonthlyBudget}
          isCurrency
          color="gray"
        />
        <MetricCard
          title="Gastos presupuestados"
          value={data.budgetedExpenseTotal}
          isCurrency
          color="red"
        />
        <MetricCard
          title="Balance de presupuesto"
          value={data.budgetBalance}
          isCurrency
          color={data.budgetBalance >= 0 ? "green" : "red"}
        />
        <MetricCard
          title="Presupuesto usado"
          value={budgetUsagePct}
          suffix="%"
          color={budgetUsagePct > 90 ? "red" : "gray"}
        />

        {/* === Grupo 3 === */}
        <MetricCard
          title="Gasto total hoy"
          value={todayExpense}
          isCurrency
          color="red"
        />
        <MetricCard
          title="Gasto diario promedio"
          value={data.averageDailyExpense}
          isCurrency
          color="red"
        />
        <MetricCard
          title="Gasto mensual promedio"
          value={data.averageMonthlyExpense}
          isCurrency
          color="red"
        />
        <MetricCard
          title="Mayor gasto por categoría"
          value={data.topCategoryThisMonth?.amount || 0}
          isCurrency
          color="red"
          subtitle={data.topCategoryName || ""}
        />
        <MetricCard
          title="Gasto proyectado del mes"
          value={projectedExpense}
          isCurrency
          color="red"
        />

        {/* <MetricCard
          title="Transacciones por día"
          value={data.averageTransactionsPerDay}
          color="gray"
        /> */}

        <MetricCard
          title="Ahorro proyectado del mes"
          value={projectedSaving}
          isCurrency
          color={projectedSaving >= 0 ? "green" : "red"}
        />
        <MetricCard
          title="% del ingreso gastado"
          value={incomeSpentPct}
          suffix="%"
          color={incomeSpentPct > 80 ? "red" : "gray"}
        />

        <MetricCard
          title="Transacciones totales"
          value={data.totalTransactions}
          color="gray"
        />
        <MetricCard
          title="Días con bajo gasto"
          value={data.daysBelowAverage || 0}
          color="green"
        />
        <MetricCard
          title="Día con menor gasto"
          value={data.minExpenseDay?.amount || 0}
          isCurrency
          subtitle={data.minExpenseDay?.date || "—"}
          color="green"
        />
        <MetricCard
          title="Días con gasto alto"
          value={data.daysAboveAverage || 0}
          color="red"
        />
        <MetricCard
          title="Día con mayor gasto"
          value={data.maxExpenseDay?.amount || 0}
          isCurrency
          subtitle={data.maxExpenseDay?.date || "—"}
          color="red"
        />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {/* Resumen anual & Metas (flip card) */}
        <FlipMetricCard summary={yearlyStabilitySummary} />

        {/* Comparación con mes anterior (en RD$) */}
        <ChromeInfoCard
          title="Comparación con mes anterior (en RD$)"
          accent="amber"
        >
          <ul className="space-y-2">
            <li className="flex items-center justify-between gap-3">
              <span style={labelMuted}>Ingresos</span>
              <span
                style={deltaStyle(
                  (data.previousMonthComparison.incomeDiffAbs || 0) >= 0
                )}
              >
                {formatSignedCurrency(
                  data.previousMonthComparison.incomeDiffAbs
                )}
              </span>
            </li>

            <li className="flex items-center justify-between gap-3">
              <span style={labelMuted}>Gastos</span>
              {/* Gastos: subir es malo => danger; bajar es bueno => success */}
              <span
                style={deltaStyle(
                  (data.previousMonthComparison.expenseDiffAbs || 0) < 0
                )}
              >
                {formatSignedCurrency(
                  data.previousMonthComparison.expenseDiffAbs
                )}
              </span>
            </li>

            <li
              className="flex items-center justify-between gap-3 pt-2 mt-2"
              style={dividerStyle}
            >
              <span style={labelStrong}>Ahorro</span>
              <span
                style={deltaStyle(
                  (data.previousMonthComparison.savingDiffAbs || 0) >= 0
                )}
              >
                {formatSignedCurrency(
                  data.previousMonthComparison.savingDiffAbs
                )}
              </span>
            </li>
          </ul>
        </ChromeInfoCard>

        {/* Variaciones por categoría (en RD$) */}
        <ChromeInfoCard
          title="Variaciones por categoría (en RD$)"
          accent="dual"
        >
          <p className="text-sm mt-1" style={{ color: ui.soft2 }}>
            Comparando{" "}
            <span style={boldText}>
              {data.categoryVariationMeta?.currentMonthKey || "mes actual"}
            </span>{" "}
            vs{" "}
            <span style={boldText}>
              {data.categoryVariationMeta?.previousMonthKey || "mes anterior"}
            </span>{" "}
            <span style={metaMuted}>(solo gastos fijos/variables)</span>
          </p>

          {data.mostIncreasedCategoryAbs ? (
            <div className="mt-3">
              <p className="text-base" style={{ color: ui.text }}>
                Mayor aumento de gasto:{" "}
                <span style={{ fontWeight: 800, color: ui.text }}>
                  {data.categoryNameMap?.[
                    data.mostIncreasedCategoryAbs.category_id
                  ] ||
                    (data.mostIncreasedCategoryAbs.category_id ===
                    "__uncategorized__"
                      ? "Sin categoría"
                      : `Categoría ${data.mostIncreasedCategoryAbs.category_id}`)}
                </span>
              </p>

              <p className="mt-1 text-sm" style={{ color: ui.soft }}>
                <span style={metaMuted}>(</span>
                <span style={{ fontWeight: 600, color: ui.soft }}>
                  {formatCurrencyDOP(
                    data.mostIncreasedCategoryAbs.previous || 0
                  )}
                </span>{" "}
                <span style={metaMuted}>→</span>{" "}
                <span style={{ fontWeight: 600, color: ui.soft }}>
                  {formatCurrencyDOP(
                    data.mostIncreasedCategoryAbs.current || 0
                  )}
                </span>
                <span style={metaMuted}>)</span> {/* Aumento = danger */}
                <span
                  className="ml-2 text-base"
                  style={{ color: ui.danger, fontWeight: 800 }}
                >
                  {formatSignedCurrency(
                    data.mostIncreasedCategoryAbs.diff || 0
                  )}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm" style={metaMuted}>
              No se detectaron aumentos en gastos fijos/variables.
            </p>
          )}

          {data.mostDecreasedCategoryAbs ? (
            <div className="mt-4">
              <p className="text-base" style={{ color: ui.text }}>
                Mayor disminución de gasto:{" "}
                <span style={{ fontWeight: 800, color: ui.text }}>
                  {data.categoryNameMap?.[
                    data.mostDecreasedCategoryAbs.category_id
                  ] ||
                    (data.mostDecreasedCategoryAbs.category_id ===
                    "__uncategorized__"
                      ? "Sin categoría"
                      : `Categoría ${data.mostDecreasedCategoryAbs.category_id}`)}
                </span>
              </p>

              <p className="mt-1 text-sm" style={{ color: ui.soft }}>
                <span style={metaMuted}>(</span>
                <span style={{ fontWeight: 600, color: ui.soft }}>
                  {formatCurrencyDOP(
                    data.mostDecreasedCategoryAbs.previous || 0
                  )}
                </span>{" "}
                <span style={metaMuted}>→</span>{" "}
                <span style={{ fontWeight: 600, color: ui.soft }}>
                  {formatCurrencyDOP(
                    data.mostDecreasedCategoryAbs.current || 0
                  )}
                </span>
                <span style={metaMuted}>)</span> {/* Disminución = success */}
                <span
                  className="ml-2 text-base"
                  style={{ color: ui.success, fontWeight: 800 }}
                >
                  {formatSignedCurrency(
                    data.mostDecreasedCategoryAbs.diff || 0
                  )}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm" style={metaMuted}>
              No se detectaron disminuciones en gastos fijos/variables.
            </p>
          )}
        </ChromeInfoCard>
      </div>

      {/* -------------------------------------------------- */}
      {/* 🧭 ORDEN SECUENCIAL — Contexto financiero completo */}
      {/* -------------------------------------------------- */}

      {/* 🔵 BLOQUE 1 — Estado financiero actual */}
      <CollapseSection title="1- Estado financiero actual (Saldos por cuenta)">
        <AccountBalancesChart token={token} />
      </CollapseSection>

      <CollapseSection title="2- Calendario financiero (actividad reciente)">
        <TransactionsCalendar token={token} />
      </CollapseSection>

      {/* 🟣 BLOQUE 2 — ¿En qué se va mi dinero? */}
      <CollapseSection title="3- Distribución del gasto por categoría (mes actual)">
        <ExpenseDistributionByCategoryChart
          expensesByCategory={data.expensesByCategory}
          categoryNameMap={data.categoryNameMap}
          token={token}
        />
      </CollapseSection>

      <CollapseSection title="4- Hábitos de gasto por día de la semana">
        <ExpenseByWeekdayChart token={token} />
      </CollapseSection>

      <CollapseSection title="5- Gastos por tipo de estabilidad (fijo / variable / ocasional)">
        <ExpenseByStabilityChart token={token} />
      </CollapseSection>

      {/* 🟠 BLOQUE 3 — Desempeño del mes */}
      <CollapseSection title="6- Ingresos vs Gastos (mensual)">
        <MonthlyIncomeVsExpenseChart token={token} />
      </CollapseSection>

      <CollapseSection title="7- Ritmo de gasto del mes (Burn Rate)">
        <BurnRateChart token={token} />
      </CollapseSection>

      <CollapseSection title="7.1- Ritmo de gasto avanzado">
        <AdvancedBurnRateChart token={token} />
      </CollapseSection>

      {/* 🔴 BLOQUE 4 — Presupuesto y control */}
      <CollapseSection title="8- Presupuesto vs gasto por categoría (mes actual)">
        <BudgetVsActualChart token={token} />
      </CollapseSection>

      <CollapseSection title="9- Top categorías con gasto excesivo">
        <OverBudgetChart token={token} />
      </CollapseSection>

      <CollapseSection title="10- Calidad de presupuestos (cobertura)">
        <BudgetCoverageChart token={token} />
      </CollapseSection>

      <CollapseSection title="10.1- Calidad de presupuestos (cobertura detallada)">
        <BudgetCoverageRobustChart token={token} />
      </CollapseSection>

      {/* 🟡 BLOQUE 5 — Comparación y contexto histórico */}
      <CollapseSection title="11- Proyección vs realidad por categoría">
        <ProjectedVsActualExpenseByCategoryChart token={token} />
      </CollapseSection>

      <CollapseSection title="12- Heatmap de gasto por categoría y mes">
        <CategoryMonthlyHeatmap token={token} />
      </CollapseSection>

      <CollapseSection title="13- Comparativo mensual por categoría">
        <CategoryMonthlyComparisonTable token={token} />
      </CollapseSection>

      <CollapseSection title="14- Comparativo mensual por artículo">
        <ItemMonthlyComparisonTable token={token} />
      </CollapseSection>

      {/* 🟢 BLOQUE 6 — Variaciones y señales clave */}
      <CollapseSection title="15- Variaciones anuales por categoría">
        <CategoryVariationChart token={token} categories={categories} />
      </CollapseSection>

      <CollapseSection title="16- Resumen anual: Presupuesto vs Gasto total">
        <BudgetVsActualSummaryChart token={token} />
      </CollapseSection>

      <CollapseSection title="17- Gastos atípicos del mes">
        <UnusualExpensesTable token={token} />
      </CollapseSection>

      {/* 🔷 BLOQUE 7 — Patrones y recurrencias */}
      <CollapseSection title="18- Patrones de gasto recurrente no marcados">
        <RecurringExpensePatternsTable token={token} />
      </CollapseSection>

      <CollapseSection title="19- Intervalo entre gastos por categoría">
        <ExpenseIntervalsByCategoryTable token={token} />
      </CollapseSection>

      {/* 🛒 BLOQUE 8 — Detalle por categorías e ítems */}
      <CollapseSection title="20- Gastos por categoría - estabilidad">
        <TopVariableCategoriesChart token={token} />
      </CollapseSection>

      <CollapseSection title="21- Tendencia de precios por artículo">
        <ItemPriceTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="22- Tendencia de consumo mensual por artículo">
        <ItemTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="23- Patrones de compra por artículo">
        <RecurringItemPatternsTable token={token} />
      </CollapseSection>

      <CollapseSection title="24- Top ítems por categoría (anual)">
        <TopItemsByCategoryChart token={token} categories={categories} />
      </CollapseSection>

      <CollapseSection title="25- Resumen anual de artículos">
        <ItemsAnnualSummaryTable token={token} />
      </CollapseSection>

      {/* 🔮 BLOQUE 9 — Mirada al futuro */}
      <CollapseSection title="26- Proyección de flujo por período">
        <ExpenseForecastChart token={token} />
      </CollapseSection>

      <CollapseSection title="27- Proyección de gastos por categoría y estabilidad">
        <ProjectedExpenseByCategoryChart token={token} />
      </CollapseSection>

      <CollapseSection title="28- Proyección de ingresos por categoría y estabilidad">
        <ProjectedIncomeByCategoryChart token={token} />
      </CollapseSection>

      <CollapseSection title="29- Ingresos vs Gastos (visión anual)">
        <MonthlyIncomeVsExpenseLineChart token={token} />
      </CollapseSection>

      <CollapseSection title="30- Progreso de metas de ahorro">
        <GoalsProgressChart token={token} />
      </CollapseSection>
    </div>
  );
}

function MetricCard({
  title,
  value,
  suffix = "",
  color = "gray", // "green" | "red" | "gray"
  isCurrency = false,
  subtitle = "",
}) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  const displayValue = isCurrency
    ? new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        minimumFractionDigits: 2,
      }).format(safeValue)
    : `${safeValue.toFixed(2)}${suffix}`;

  // Tokens por acento
  const accentToken =
    color === "green"
      ? "var(--success)"
      : color === "red"
      ? "var(--danger)"
      : "var(--muted)";

  // Texto del número (un poquito más “vivo” que el resto)
  const valueColor =
    color === "green"
      ? "color-mix(in srgb, var(--success) 70%, var(--text))"
      : color === "red"
      ? "color-mix(in srgb, var(--danger) 70%, var(--text))"
      : "var(--text)";

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background:
          "linear-gradient(135deg, var(--panel), color-mix(in srgb, var(--panel) 70%, transparent))",
        border: "var(--border-w) solid var(--border-rgba)",
        boxShadow: "var(--glow-shadow)",
        color: "var(--text)",
      }}
    >
      {/* Barra lateral de acento */}
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: `linear-gradient(to bottom, ${accentToken}, color-mix(in srgb, ${accentToken} 35%, transparent))`,
        }}
      />

      {/* Borde interior sutil */}
      <div
        className="pointer-events-none absolute inset-[1px] rounded-2xl"
        style={{
          border: "1px solid color-mix(in srgb, var(--text) 10%, transparent)",
        }}
      />

      {/* Brillo superior sutil */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-8 opacity-40"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--text) 14%, transparent), transparent)",
        }}
      />

      {/* Contenido */}
      <div className="relative z-10 flex flex-col gap-1">
        <p
          className="text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: "var(--muted)" }}
        >
          {title}
        </p>

        <p
          className="text-xl font-extrabold mt-0.5 leading-tight"
          style={{ color: valueColor }}
        >
          {displayValue}
        </p>

        {subtitle && (
          <p
            className="text-xs mt-1 truncate"
            style={{ color: "var(--muted)" }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function ChromeInfoCard({
  title,
  children,
  accent = "neutral", // "neutral" | "green" | "red" | "amber" | "dual"
}) {
  const accentMap = {
    green: [
      "var(--success)",
      "color-mix(in srgb, var(--success) 25%, transparent)",
    ],
    red: [
      "var(--danger)",
      "color-mix(in srgb, var(--danger) 25%, transparent)",
    ],
    amber: [
      "var(--warning)",
      "color-mix(in srgb, var(--warning) 25%, transparent)",
    ],
    dual: ["var(--danger)", "var(--warning)", "var(--success)"],
    neutral: [
      "var(--muted)",
      "color-mix(in srgb, var(--muted) 25%, transparent)",
    ],
  };

  const stops = accentMap[accent] || accentMap.neutral;

  const accentGradient =
    stops.length === 3
      ? `linear-gradient(to bottom, ${stops[0]}, ${stops[1]}, ${stops[2]})`
      : `linear-gradient(to bottom, ${stops[0]}, ${stops[1]})`;

  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "color-mix(in srgb, var(--panel) 80%, transparent)",
        border: "var(--border-w) solid var(--border-rgba)",
        boxShadow: "var(--glow-shadow)",
        color: "var(--text)",
      }}
    >
      {/* Barra lateral con acento */}
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accentGradient }}
      />

      {/* Borde interior sutil */}
      <div
        className="pointer-events-none absolute inset-[1px] rounded-2xl"
        style={{
          border: "1px solid color-mix(in srgb, var(--text) 10%, transparent)",
        }}
      />

      {/* Brillo superior */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-8 opacity-40"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--text) 14%, transparent), transparent)",
        }}
      />

      <div className="relative z-10">
        <h3
          className="text-sm font-bold uppercase tracking-[0.18em] mb-2"
          style={{ color: "var(--text)" }}
        >
          {title}
        </h3>

        <div
          className="text-sm space-y-2 leading-snug"
          style={{ color: "var(--text)" }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function formatCurrencyDOP(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
}

function FlipMetricCard({ summary }) {
  const [flipped, setFlipped] = useState(false);

  if (!summary) {
    return (
      <div
        className="relative overflow-hidden rounded-2xl p-4 flex items-center justify-center text-sm"
        style={{
          background: "color-mix(in srgb, var(--panel) 80%, transparent)",
          border: "var(--border-w) solid var(--border-rgba)",
          boxShadow: "var(--glow-shadow)",
          color: "var(--muted)",
        }}
      >
        Cargando resumen anual...
      </div>
    );
  }

  const { year, total, byStability } = summary;

  const stabilityLabels = {
    fixed: "Fijo",
    variable: "Variable",
    occasional: "Ocasional",
  };

  const ahorroNeto = Number(total?.income || 0) - Number(total?.expense || 0);

  return (
    <div
      className="relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5 h-full min-h-[150px] cursor-pointer"
      style={{
        background: "color-mix(in srgb, var(--panel) 80%, transparent)",
        border: "var(--border-w) solid var(--border-rgba)",
        boxShadow: "var(--glow-shadow)",
        color: "var(--text)",
      }}
      onClick={() => setFlipped((prev) => !prev)}
    >
      {/* Barra lateral de acento */}
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background:
            "linear-gradient(to bottom, var(--success), color-mix(in srgb, var(--success) 25%, transparent))",
        }}
      />

      {/* Borde interior */}
      <div
        className="pointer-events-none absolute inset-[1px] rounded-2xl"
        style={{
          border: "1px solid color-mix(in srgb, var(--text) 10%, transparent)",
        }}
      />

      {/* Brillo superior */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-8 opacity-40"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--text) 14%, transparent), transparent)",
        }}
      />

      {/* Contenido flippeable */}
      <div
        className={`
          relative w-full h-full
          transition-transform duration-500
          [transform-style:preserve-3d]
          ${flipped ? "[transform:rotateY(180deg)]" : ""}
        `}
      >
        {/* FRONT */}
        <div className="absolute inset-0 p-4 [backface-visibility:hidden] flex flex-col">
          <div>
            <p
              className="text-sm font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Resumen anual {year}
            </p>
            <p
              className="text-xs font-semibold mt-1"
              style={{ color: "var(--muted)" }}
            >
              Click para ver por estabilidad
            </p>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span style={{ color: "var(--muted)" }}>Ingreso total</span>
              <span
                className="text-base font-extrabold"
                style={{ color: "var(--success)" }}
              >
                {formatCurrencyDOP(total?.income)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span style={{ color: "var(--muted)" }}>Gasto total</span>
              <span
                className="text-base font-extrabold"
                style={{ color: "var(--danger)" }}
              >
                {formatCurrencyDOP(total?.expense)}
              </span>
            </div>

            <div
              className="flex justify-between items-center pt-3 mt-3"
              style={{ borderTop: `1px solid var(--border-rgba)` }}
            >
              <span style={{ color: "var(--text)", fontWeight: 700 }}>
                Ahorro neto
              </span>
              <span
                className="text-base font-extrabold"
                style={{
                  color: ahorroNeto >= 0 ? "var(--success)" : "var(--danger)",
                }}
              >
                {formatCurrencyDOP(ahorroNeto)}
              </span>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div className="absolute inset-0 p-4 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col">
          <div className="mb-2">
            <p
              className="text-sm font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Detalle por estabilidad
            </p>
            <p
              className="text-[11px] font-semibold mt-0.5"
              style={{ color: "var(--muted)" }}
            >
              (Click para volver)
            </p>
          </div>

          <div className="mt-1 space-y-2 text-sm overflow-y-auto">
            {Object.entries(byStability || {}).map(([key, value]) => (
              <div
                key={key}
                className="rounded px-2 py-1.5"
                style={{
                  border: `1px solid var(--border-rgba)`,
                  background:
                    "color-mix(in srgb, var(--panel) 70%, transparent)",
                }}
              >
                <div className="mb-1">
                  <span style={{ fontWeight: 700, color: "var(--text)" }}>
                    {stabilityLabels[key] || key}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted)" }}>Ingresos</span>
                  <span style={{ fontWeight: 600, color: "var(--success)" }}>
                    {formatCurrencyDOP(value.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: "var(--muted)" }}>Gastos</span>
                  <span style={{ fontWeight: 600, color: "var(--danger)" }}>
                    {formatCurrencyDOP(value.expense)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
