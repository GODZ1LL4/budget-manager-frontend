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

  return (
    <div className="p-4 space-y-6">
      <h2
        className="text-2xl font-bold text-slate-200

 tracking-tight"
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
              <span className="text-slate-300">Ingresos</span>
              <span
                className={`font-extrabold ${
                  (data.previousMonthComparison.incomeDiffAbs || 0) >= 0
                    ? "text-emerald-300"
                    : "text-rose-300"
                }`}
              >
                {formatSignedCurrency(
                  data.previousMonthComparison.incomeDiffAbs
                )}
              </span>
            </li>

            <li className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Gastos</span>
              {/* ✅ Gastos: subir es malo => rojo; bajar es bueno => verde */}
              <span
                className={`font-extrabold ${
                  (data.previousMonthComparison.expenseDiffAbs || 0) >= 0
                    ? "text-rose-300"
                    : "text-emerald-300"
                }`}
              >
                {formatSignedCurrency(
                  data.previousMonthComparison.expenseDiffAbs
                )}
              </span>
            </li>

            <li className="flex items-center justify-between gap-3 border-t border-slate-700 pt-2 mt-2">
              <span className="text-slate-200 font-medium">Ahorro</span>
              <span
                className={`font-extrabold ${
                  (data.previousMonthComparison.savingDiffAbs || 0) >= 0
                    ? "text-emerald-300"
                    : "text-rose-300"
                }`}
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
          <p className="text-sm text-slate-300 mt-1">
            Comparando{" "}
            <span className="text-slate-100 font-semibold">
              {data.categoryVariationMeta?.currentMonthKey || "mes actual"}
            </span>{" "}
            vs{" "}
            <span className="text-slate-100 font-semibold">
              {data.categoryVariationMeta?.previousMonthKey || "mes anterior"}
            </span>{" "}
            <span className="text-slate-400">
              (solo gastos fijos/variables)
            </span>
          </p>

          {data.mostIncreasedCategoryAbs ? (
            <div className="mt-3">
              <p className="text-base text-slate-100">
                Mayor aumento de gasto:{" "}
                <span className="font-extrabold">
                  {data.categoryNameMap?.[
                    data.mostIncreasedCategoryAbs.category_id
                  ] ||
                    (data.mostIncreasedCategoryAbs.category_id ===
                    "__uncategorized__"
                      ? "Sin categoría"
                      : `Categoría ${data.mostIncreasedCategoryAbs.category_id}`)}
                </span>
              </p>

              <p className="mt-1 text-sm text-slate-200">
                <span className="text-slate-400">(</span>
                <span className="font-medium text-slate-200">
                  {formatCurrencyDOP(
                    data.mostIncreasedCategoryAbs.previous || 0
                  )}
                </span>{" "}
                <span className="text-slate-500">→</span>{" "}
                <span className="font-medium text-slate-200">
                  {formatCurrencyDOP(
                    data.mostIncreasedCategoryAbs.current || 0
                  )}
                </span>
                <span className="text-slate-400">)</span>{" "}
                {/* ✅ Aumento = ROJO */}
                <span className="ml-2 text-rose-300 font-extrabold text-base">
                  {formatSignedCurrency(
                    data.mostIncreasedCategoryAbs.diff || 0
                  )}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-400">
              No se detectaron aumentos en gastos fijos/variables.
            </p>
          )}

          {data.mostDecreasedCategoryAbs ? (
            <div className="mt-4">
              <p className="text-base text-slate-100">
                Mayor disminución de gasto:{" "}
                <span className="font-extrabold">
                  {data.categoryNameMap?.[
                    data.mostDecreasedCategoryAbs.category_id
                  ] ||
                    (data.mostDecreasedCategoryAbs.category_id ===
                    "__uncategorized__"
                      ? "Sin categoría"
                      : `Categoría ${data.mostDecreasedCategoryAbs.category_id}`)}
                </span>
              </p>

              <p className="mt-1 text-sm text-slate-200">
                <span className="text-slate-400">(</span>
                <span className="font-medium text-slate-200">
                  {formatCurrencyDOP(
                    data.mostDecreasedCategoryAbs.previous || 0
                  )}
                </span>{" "}
                <span className="text-slate-500">→</span>{" "}
                <span className="font-medium text-slate-200">
                  {formatCurrencyDOP(
                    data.mostDecreasedCategoryAbs.current || 0
                  )}
                </span>
                <span className="text-slate-400">)</span>{" "}
                {/* ✅ Disminución = VERDE */}
                <span className="ml-2 text-emerald-300 font-extrabold text-base">
                  {formatSignedCurrency(
                    data.mostDecreasedCategoryAbs.diff || 0
                  )}
                </span>
              </p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-400">
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

      <CollapseSection title="10.1- Calidad de presupuestos (cobertura extendida)">
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
      <CollapseSection title="20- Top categorías variables con más gasto">
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
  color = "gray",
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

  // Acentos según tipo
  const accentValueClass =
    color === "green"
      ? "text-emerald-300"
      : color === "red"
      ? "text-rose-300"
      : "text-slate-100";

  const accentSideClass =
    color === "green"
      ? "from-emerald-500 to-emerald-300"
      : color === "red"
      ? "from-rose-500 to-rose-300"
      : "from-slate-500 to-slate-300";

  return (
    <div
      className="
        relative overflow-hidden rounded-2xl p-4
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800
        border border-slate-700/80
        shadow-[0_10px_30px_rgba(0,0,0,0.65)]
        transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.9)]
      "
    >
      {/* Barra lateral cromada de acento */}
      <div
        className={`
          absolute inset-y-0 left-0 w-[3px]
          bg-gradient-to-b ${accentSideClass}
        `}
      />

      {/* Borde interior sutil (efecto panel metálico */}
      <div
        className="
          pointer-events-none absolute inset-[1px] rounded-2xl
          border border-white/5
        "
      />

      {/* Brillo superior sutil */}
      <div
        className="
          pointer-events-none absolute inset-x-0 top-0 h-8
          bg-gradient-to-b from-white/10 via-white/5 to-transparent
          opacity-40
        "
      />

      {/* Contenido */}
      <div className="relative z-10 flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
          {title}
        </p>

        <p
          className={`
            text-xl font-extrabold mt-0.5 leading-tight
            ${accentValueClass}
          `}
        >
          {displayValue}
        </p>

        {subtitle && (
          <p className="text-xs mt-1 text-slate-300 truncate">{subtitle}</p>
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
  const accentClass =
    accent === "green"
      ? "from-emerald-500 to-emerald-300"
      : accent === "red"
      ? "from-rose-500 to-rose-300"
      : accent === "amber"
      ? "from-amber-500 to-amber-300"
      : accent === "dual"
      ? "from-rose-500 via-amber-300 to-emerald-400"
      : "from-slate-500 to-slate-300";

  return (
    <div
      className="
        relative overflow-hidden rounded-2xl p-4
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800
        border border-slate-700/80
        shadow-[0_10px_30px_rgba(0,0,0,0.65)]
        transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.9)]
      "
    >
      {/* ✅ Barra lateral con color configurable */}
      <div
        className={`
          absolute inset-y-0 left-0 w-[3px]
          bg-gradient-to-b ${accentClass}
        `}
      />

      {/* Borde interior sutil */}
      <div className="pointer-events-none absolute inset-[1px] rounded-2xl border border-white/5" />

      {/* Brillo superior */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/10 via-white/5 to-transparent opacity-40" />

      <div className="relative z-10">
        <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-200 mb-2">
          {title}
        </h3>
        <div className="text-sm text-slate-200 space-y-2 leading-snug">
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
        className="
          relative overflow-hidden rounded-2xl p-4
          bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800
          border border-slate-700/80
          shadow-[0_10px_30px_rgba(0,0,0,0.65)]
          flex items-center justify-center
          text-sm text-slate-300
        "
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
      className="
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800
        border border-slate-700/80
        shadow-[0_10px_30px_rgba(0,0,0,0.65)]
        transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(0,0,0,0.9)]
        h-full min-h-[150px]
        cursor-pointer
      "
      onClick={() => setFlipped((prev) => !prev)}
    >
      {/* Barra lateral de acento */}
      <div
        className="
          absolute inset-y-0 left-0 w-[3px]
          bg-gradient-to-b from-emerald-500 to-emerald-300
        "
      />

      {/* Borde interior */}
      <div
        className="
          pointer-events-none absolute inset-[1px] rounded-2xl
          border border-white/5
        "
      />

      {/* Brillo superior */}
      <div
        className="
          pointer-events-none absolute inset-x-0 top-0 h-8
          bg-gradient-to-b from-white/10 via-white/5 to-transparent
          opacity-40
        "
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
        <div
          className="
    absolute inset-0 p-4
    [backface-visibility:hidden]
    flex flex-col
  "
        >
          <div>
            <p className="text-sm font-bold text-slate-200 uppercase tracking-[0.18em]">
              Resumen anual {year}
            </p>
            <p className="text-xs font-semibold text-slate-300 mt-1">
              Click para ver por estabilidad
            </p>
          </div>

          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-300">Ingreso total</span>
              <span className="font-extrabold text-emerald-300 text-base">
                {formatCurrencyDOP(total?.income)}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-slate-300">Gasto total</span>
              <span className="font-extrabold text-rose-300 text-base">
                {formatCurrencyDOP(total?.expense)}
              </span>
            </div>

            <div className="flex justify-between items-center border-t border-slate-700 pt-3 mt-3">
              <span className="text-slate-200 font-semibold">Ahorro neto</span>
              <span
                className={`text-base font-extrabold ${
                  ahorroNeto >= 0 ? "text-emerald-300" : "text-rose-300"
                }`}
              >
                {formatCurrencyDOP(ahorroNeto)}
              </span>
            </div>
          </div>
        </div>

        {/* BACK */}
        <div
          className="
            absolute inset-0 p-4
            [backface-visibility:hidden]
            [transform:rotateY(180deg)]
            flex flex-col
          "
        >
          <div className="mb-2">
            <p className="text-sm font-bold text-slate-200 uppercase tracking-[0.18em]">
              Detalle por estabilidad
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              (Click para volver)
            </p>
          </div>

          <div className="mt-1 space-y-2 text-sm overflow-y-auto">
            {Object.entries(byStability || {}).map(([key, value]) => (
              <div
                key={key}
                className="border border-slate-600 rounded px-2 py-1.5 bg-slate-900/60"
              >
                <div className="mb-1">
                  <span className="font-semibold text-slate-100">
                    {stabilityLabels[key] || key}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Ingresos</span>
                  <span className="font-medium text-emerald-300">
                    {formatCurrencyDOP(value.income)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-300">Gastos</span>
                  <span className="font-medium text-rose-300">
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
