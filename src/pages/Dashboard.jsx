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
        <ChromeInfoCard title="Comparación con mes anterior (en RD$)">
          <ul className="space-y-1">
            <li>
              Ingresos:{" "}
              <strong>
                {formatSignedCurrency(
                  data.previousMonthComparison.incomeDiffAbs
                )}
              </strong>
            </li>
            <li>
              Gastos:{" "}
              <strong>
                {formatSignedCurrency(
                  data.previousMonthComparison.expenseDiffAbs
                )}
              </strong>
            </li>
            <li>
              Ahorro:{" "}
              <strong>
                {formatSignedCurrency(
                  data.previousMonthComparison.savingDiffAbs
                )}
              </strong>
            </li>
          </ul>
        </ChromeInfoCard>

        {/* Variaciones por categoría (en RD$) */}
        <ChromeInfoCard title="Variaciones por categoría (en RD$)">
          {data.mostIncreasedCategoryAbs ? (
            <p>
              Mayor aumento:{" "}
              <strong>
                {data.categoryNameMap?.[
                  data.mostIncreasedCategoryAbs.category_id
                ] || `Categoría ${data.mostIncreasedCategoryAbs.category_id}`}
              </strong>{" "}
              ({formatSignedCurrency(data.mostIncreasedCategoryAbs.diff || 0)})
            </p>
          ) : (
            <p className="text-slate-500">
              Sin datos suficientes para aumentos.
            </p>
          )}

          {data.mostDecreasedCategoryAbs ? (
            <p className="mt-1">
              Mayor disminución:{" "}
              <strong>
                {data.categoryNameMap?.[
                  data.mostDecreasedCategoryAbs.category_id
                ] || `Categoría ${data.mostDecreasedCategoryAbs.category_id}`}
              </strong>{" "}
              ({formatSignedCurrency(data.mostDecreasedCategoryAbs.diff || 0)})
            </p>
          ) : (
            <p className="mt-1 text-slate-500">
              Sin datos suficientes para disminuciones.
            </p>
          )}
        </ChromeInfoCard>
      </div>

      <CollapseSection title="1- Calendario financiero">
        <TransactionsCalendar token={token} />
      </CollapseSection>

      <CollapseSection title="2- Distribución de gastos por categoría">
        <ExpenseDistributionByCategoryChart
          expensesByCategory={data.expensesByCategory}
          categoryNameMap={data.categoryNameMap}
          token={token}
        />
      </CollapseSection>

      <CollapseSection title="3- Comparativa de saldos por cuenta">
        <AccountBalancesChart token={token} />
      </CollapseSection>

      {/* --- BLOQUE: Visión mensual y control de presupuesto --- */}

      <CollapseSection title="4- Balance de Ingreso vs Gasto">
        <MonthlyIncomeVsExpenseChart token={token} />
      </CollapseSection>

      <CollapseSection title="5- Presupuesto vs Gasto por categoría">
        <BudgetVsActualChart token={token} />
      </CollapseSection>

      <CollapseSection title="6- Top categorías con gasto excesivo">
        <OverBudgetChart token={token} />
      </CollapseSection>

      <CollapseSection title="7- Ritmo de gasto del mes (Burn Rate)">
        <BurnRateChart token={token} />
      </CollapseSection>

      {/* --- BLOQUE: Comparativos por categoría / año --- */}

      <CollapseSection title="8- Comparativo mensual por categoría">
        <CategoryMonthlyComparisonTable token={token} />
      </CollapseSection>

      <CollapseSection title="9- Comparativo mensual por artículo">
        <ItemMonthlyComparisonTable token={token} />
      </CollapseSection>

      <CollapseSection title="10- Variaciones anuales por categoría">
        <CategoryVariationChart token={token} categories={categories} />
      </CollapseSection>

      <CollapseSection title="11- Resumen Anual: Presupuesto vs Gasto Total">
        <BudgetVsActualSummaryChart token={token} />
      </CollapseSection>

      {/* --- BLOQUE: Estabilidad + Proyecciones + Metas --- */}

      <CollapseSection title="12- Gastos por tipo de estabilidad">
        <ExpenseByStabilityChart token={token} />
      </CollapseSection>

      <CollapseSection title="13- Proyección de Gastos por Categoría y Estabilidad">
        <ProjectedExpenseByCategoryChart token={token} />
      </CollapseSection>

      <CollapseSection title="14- Proyección de Ingresos por Categoría y Estabilidad">
        <ProjectedIncomeByCategoryChart token={token} />
      </CollapseSection>

      <CollapseSection title="15- Progreso de metas de ahorro">
        <GoalsProgressChart token={token} />
      </CollapseSection>

      {/* --- BLOQUE: Análisis detallado por artículo --- */}

      <CollapseSection title="16- Top categorías variables con más gasto">
        <TopVariableCategoriesChart token={token} />
      </CollapseSection>

      <CollapseSection title="17- Tendencia de precios por artículo">
        <ItemPriceTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="18- Tendencia mensual por artículo">
        <ItemTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="19- Top ítems por categoría (anual)">
        <TopItemsByCategoryChart token={token} categories={categories} />
      </CollapseSection>

      <CollapseSection title="20- Resumen anual de artículos (mixto)">
        <ItemsAnnualSummaryTable token={token} />
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

function ChromeInfoCard({ title, children }) {
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
      {/* Barra lateral neutral */}
      <div
        className="
          absolute inset-y-0 left-0 w-[3px]
          bg-gradient-to-b from-slate-500 to-slate-300
        "
      />

      {/* Borde interior sutil */}
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

      <div className="relative z-10">
        <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2">
          {title}
        </h3>
        <div className="text-sm text-slate-200 space-y-1">{children}</div>
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
        h-full min-h-[190px]
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
            flex flex-col justify-between
          "
        >
          <div>
            <p className="text-sm font-bold text-slate-200 uppercase tracking-[0.18em]">
              Resumen anual {year}
            </p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">
              (Click para ver por estabilidad)
            </p>
          </div>

          <div className="mt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-300">Ingreso total</span>
              <span className="font-semibold text-emerald-300">
                {formatCurrencyDOP(total?.income)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-300">Gasto total</span>
              <span className="font-semibold text-rose-300">
                {formatCurrencyDOP(total?.expense)}
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-600 pt-2 mt-2">
              <span className="text-slate-200 font-medium">Ahorro neto</span>
              <span
                className={
                  ahorroNeto >= 0
                    ? "font-bold text-emerald-300"
                    : "font-bold text-rose-300"
                }
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
