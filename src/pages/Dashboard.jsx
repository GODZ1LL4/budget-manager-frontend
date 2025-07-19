import { useEffect, useState } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import CollapseSection from "../components/CollapseSection";
import ItemPriceTrendChart from "../components/ItemPriceTrendChart";
import CategorySpendingBarChart from "../components/CategorySpendingBarChart";
import CategoryMonthlyTrendChart from "../components/CategoryMonthlyTrendChart";

import CategoryTrendSelectorChart from "../components/CategoryTrendSelectorChart";
import BudgetVsActualChart from "../components/BudgetVsActualChart";
import AccountBalancesChart from "../components/AccountBalancesChart";
import MonthlyBalanceTrendChart from "../components/MonthlyBalanceTrendChart";

import OverBudgetChart from "../components/OverBudgetChart";
import SavingTrendChart from "../components/SavingTrendChart";

import MonthlyIncomeVsExpenseChart from "../components/MonthlyIncomeVsExpenseChart";
import CategoryVariationChart from "../components/CategoryVariationChart";
import TransactionsCalendar from "../components/TransactionsCalendar";
import { toast } from "react-toastify";
import BudgetVsActualHistoryChart from "../components/BudgetVsActualHistoryChart";
import BudgetVsActualYearlyChart from "../components/BudgetVsActualYearlyChart";
import BudgetVsActualSummaryChart from "../components/BudgetVsActualSummaryChart";
import RealisticProjectionChart from "../components/RealisticProjectionChart";
import ExpenseByStabilityChart from "../components/ExpenseByStabilityChart";
import TopVariableCategoriesChart from "../components/TopVariableCategoriesChart";
import GoalsProgressChart from "../components/GoalsProgressChart";
import SavingRealVsProjectedChart from "../components/SavingRealVsProjectedChart";
import FinancialScenarioChart from "../components/FinancialScenarioChart";
import ProjectedExpenseByCategoryChart from "../components/ProjectedExpenseByCategoryChart";
import ProjectedIncomeByCategoryChart from "../components/ProjectedIncomeByCategoryChart";
import StabilityBalanceChart from "../components/StabilityBalanceChart";
import TopItemsByQuantityChart from "../components/TopItemsByQuantityChart";
import TopItemsByValueChart from "../components/TopItemsByValueChart";
import ItemTrendChart from "../components/ItemTrendChart";

function Dashboard({ token }) {
  const [data, setData] = useState(null);
  const api = import.meta.env.VITE_API_URL;
  const [categories, setCategories] = useState([]);

  const [todayExpense, setTodayExpense] = useState(0);

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

  const pieData = Object.entries(data.expensesByCategory).map(
    ([catId, value]) => ({
      name: data.categoryNameMap?.[catId] || `Categoría ${catId}`,
      value,
    })
  );

  const formatPercent = (value) =>
    value > 0 ? `▲ ${value.toFixed(1)}%` : `▼ ${Math.abs(value).toFixed(1)}%`;
  const COLORS = [
    "#6366f1",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#3b82f6",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
    "#f43f5e",
    "#a855f7",
    "#0ea5e9",
    "#84cc16",
  ];

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold text-gray-800">Dashboard Financiero</h2>

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
          title="Gasto mensual promedio"
          value={data.averageMonthlyExpense}
          isCurrency
          color="red"
        />
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
          title="Mayor gasto por categoría"
          value={data.topCategoryThisMonth?.amount || 0}
          isCurrency
          color="red"
          subtitle={data.topCategoryName || ""}
        />

        <MetricCard
          title="Transacciones totales"
          value={data.totalTransactions}
          color="gray"
        />
        {/* <MetricCard
          title="Transacciones por día"
          value={data.averageTransactionsPerDay}
          color="gray"
        /> */}
     
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-md font-semibold mb-2 text-gray-700">
            Comparación con mes anterior
          </h3>
          <ul className="text-sm space-y-1">
            <li>
              Ingresos:{" "}
              <strong>
                {formatPercent(data.previousMonthComparison.incomeDiffPercent)}
              </strong>
            </li>
            <li>
              Gastos:{" "}
              <strong>
                {formatPercent(data.previousMonthComparison.expenseDiffPercent)}
              </strong>
            </li>
            <li>
              Ahorro:{" "}
              <strong>
                {formatPercent(data.previousMonthComparison.savingRateDiff)}
              </strong>
            </li>
          </ul>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-md font-semibold mb-2 text-gray-700">
            Metas de ahorro
          </h3>
          <p className="text-sm text-gray-600">
            Cumplidas: <strong>{data.goalsSummary.completedGoals}</strong> /{" "}
            {data.goalsSummary.totalGoals}
          </p>
        </div>

        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-md font-semibold mb-2 text-gray-700">
            Variaciones por categoría
          </h3>
          <p className="text-sm">
            Mayor aumento:{" "}
            <strong>
              {data.categoryNameMap?.[
                data.mostIncreasedCategory?.category_id
              ] || `Categoría ${data.mostIncreasedCategory?.category_id}`}
            </strong>{" "}
            ({formatPercent(data.mostIncreasedCategory?.percent || 0)})
          </p>

          <p className="text-sm">
            Mayor disminución:{" "}
            <strong>
              {data.categoryNameMap?.[
                data.mostDecreasedCategory?.category_id
              ] || `Categoría ${data.mostDecreasedCategory?.category_id}`}
            </strong>{" "}
            ({formatPercent(data.mostDecreasedCategory?.percent || 0)})
          </p>
        </div>
      </div>

      <CollapseSection title="Calendario financiero">
        <TransactionsCalendar token={token} />
      </CollapseSection>
      <CollapseSection title="Distribución de gastos por categoría">
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                outerRadius="80%"
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(1)}%)`
                }
              >
                {pieData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `RD$ ${value.toFixed(2)}`}
                labelFormatter={(label) => `Categoría: ${label}`}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          Este gráfico muestra el porcentaje del total de gastos del mes actual,
          distribuidos por categoría.
        </p>
      </CollapseSection>

      <CollapseSection title="Tendencia de precios por artículo">
        <ItemPriceTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="Gasto total por categoría (últimos 6 meses)">
        <CategorySpendingBarChart token={token} />
      </CollapseSection>
      <CollapseSection title="Evolución mensual por categoría">
        <CategoryMonthlyTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="Evolución de categorías seleccionadas">
        <CategoryTrendSelectorChart token={token} />
      </CollapseSection>
      <CollapseSection title="Presupuesto vs Gasto por categoría">
        <BudgetVsActualChart token={token} />
      </CollapseSection>
      <CollapseSection title="Comparativa de saldos por cuenta">
        <AccountBalancesChart token={token} />
      </CollapseSection>
      <CollapseSection title="Evolución del balance mensual">
        <MonthlyBalanceTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="Top categorías con gasto excesivo">
        <OverBudgetChart token={token} />
      </CollapseSection>
      <CollapseSection title="Evolución del ahorro mensual">
        <SavingTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="Promedio mensual: Ingreso vs Gasto">
        <MonthlyIncomeVsExpenseChart token={token} />
      </CollapseSection>
      <CollapseSection title="Variaciones anuales por categoría">
        <CategoryVariationChart token={token} categories={categories} />
      </CollapseSection>
      <CollapseSection title="Histórico de Presupuesto vs Gasto por Categoría">
        <BudgetVsActualHistoryChart token={token} />
      </CollapseSection>
      <CollapseSection title="Presupuesto vs Gasto Real por Categoría (Año)">
        <BudgetVsActualYearlyChart token={token} />
      </CollapseSection>
      <CollapseSection title="Resumen Anual: Presupuesto vs Gasto Total">
        <BudgetVsActualSummaryChart token={token} />
      </CollapseSection>
      <CollapseSection title="Proyección realista (solo categorías fijas y variables)">
        <RealisticProjectionChart token={token} />
      </CollapseSection>
      <CollapseSection title="Gastos por tipo de estabilidad">
        <ExpenseByStabilityChart token={token} />
      </CollapseSection>
      <CollapseSection title="Top categorías variables con más gasto">
        <TopVariableCategoriesChart token={token} />
      </CollapseSection>
      <CollapseSection title="Progreso de metas de ahorro">
        <GoalsProgressChart token={token} />
      </CollapseSection>
      <CollapseSection title="Comparativa: Ahorro Real vs Proyectado">
        <SavingRealVsProjectedChart token={token} />
      </CollapseSection>
      <CollapseSection title="Proyección por Escenario (Ahorro, Gasto, Ingreso)">
        <FinancialScenarioChart token={token} />
      </CollapseSection>
      <CollapseSection title="Proyección de Gastos por Categoría y Estabilidad">
        <ProjectedExpenseByCategoryChart token={token} />
      </CollapseSection>
      <CollapseSection title="Proyección de Ingresos por Categoría y Estabilidad">
        <ProjectedIncomeByCategoryChart token={token} />
      </CollapseSection>
      <CollapseSection title="Balance Promedio por Tipo de Estabilidad">
        <StabilityBalanceChart token={token} />
      </CollapseSection>
      <CollapseSection title="Top 10 artículos más consumidos (anual)">
        <TopItemsByQuantityChart token={token} />
      </CollapseSection>

      <CollapseSection title="Top 10 artículos por gasto mensual">
        <TopItemsByValueChart token={token} />
      </CollapseSection>

      <CollapseSection title="Tendencia mensual por artículo">
        <ItemTrendChart token={token} />
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
  const colorMap = {
    gray: "text-gray-800",
    green: "text-green-600",
    red: "text-red-600",
  };

  const safeValue = isNaN(value) ? 0 : value;

  const displayValue = isCurrency
    ? new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        minimumFractionDigits: 2,
      }).format(safeValue)
    : `${safeValue.toFixed(2)}${suffix}`;

  return (
    <div className="p-4 bg-white rounded shadow">
      <p className="text-sm text-gray-500">{title}</p>
      <p className={`text-lg font-bold ${colorMap[color]}`}>{displayValue}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 mt-1 whitespace-nowrap truncate">
          {subtitle}
        </p>
      )}
    </div>
  );
}

export default Dashboard;
