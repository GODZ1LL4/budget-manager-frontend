import { useEffect, useState } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import CollapseSection from "../components/CollapseSection";
import ItemPriceTrendChart from "../components/reports/ItemPriceTrendChart";
import CategorySpendingBarChart from "../components/reports/CategorySpendingBarChart";

import Modal from "../components/Modal";

import BudgetVsActualChart from "../components/reports/BudgetVsActualChart";
import AccountBalancesChart from "../components/reports/AccountBalancesChart";

import OverBudgetChart from "../components/reports/OverBudgetChart";

import MonthlyIncomeVsExpenseChart from "../components/reports/MonthlyIncomeVsExpenseChart";
import CategoryVariationChart from "../components/reports/CategoryVariationChart";
import TransactionsCalendar from "../components/reports/TransactionsCalendar";
import { toast } from "react-toastify";

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

function Dashboard({ token }) {
  const [data, setData] = useState(null);
  const api = import.meta.env.VITE_API_URL;
  const [categories, setCategories] = useState([]);

  const [todayExpense, setTodayExpense] = useState(0);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

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

  const pieData = Object.entries(data.expensesByCategory).map(
    ([catId, value]) => ({
      name: data.categoryNameMap?.[catId] || `Categoría ${catId}`,
      value,
    })
  );

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
        {/* Comparación con mes anterior (en RD$) */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-md font-semibold mb-2 text-gray-700">
            Comparación con mes anterior
          </h3>
          <ul className="text-sm space-y-1 text-gray-700">
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
        </div>

        {/* Variaciones por categoría (en RD$) */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-md font-semibold mb-2 text-gray-700">
            Variaciones por categoría
          </h3>

          {data.mostIncreasedCategoryAbs ? (
            <p className="text-sm text-gray-700">
              Mayor aumento:{" "}
              <strong>
                {data.categoryNameMap?.[
                  data.mostIncreasedCategoryAbs.category_id
                ] || `Categoría ${data.mostIncreasedCategoryAbs.category_id}`}
              </strong>{" "}
              ({formatSignedCurrency(data.mostIncreasedCategoryAbs.diff || 0)})
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Sin datos suficientes para aumentos.
            </p>
          )}

          {data.mostDecreasedCategoryAbs ? (
            <p className="text-sm text-gray-700">
              Mayor disminución:{" "}
              <strong>
                {data.categoryNameMap?.[
                  data.mostDecreasedCategoryAbs.category_id
                ] || `Categoría ${data.mostDecreasedCategoryAbs.category_id}`}
              </strong>{" "}
              ({formatSignedCurrency(data.mostDecreasedCategoryAbs.diff || 0)})
            </p>
          ) : (
            <p className="text-sm text-gray-400">
              Sin datos suficientes para disminuciones.
            </p>
          )}
        </div>

        {/* Metas de ahorro */}
        <div className="bg-white p-4 rounded shadow">
          <h3 className="text-md font-semibold mb-2 text-gray-700">
            Metas de ahorro
          </h3>
          <p className="text-sm text-gray-600">
            Cumplidas: <strong>{data.goalsSummary.completedGoals}</strong> /{" "}
            {data.goalsSummary.totalGoals}
          </p>
        </div>
      </div>

      <CollapseSection title="1- Calendario financiero">
        <TransactionsCalendar token={token} />
      </CollapseSection>

      <CollapseSection title="2- Distribución de gastos por categoría">
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
                onClick={async (entry, index) => {
                  const catId = Object.keys(data.expensesByCategory)[index];
                  setSelectedCategory(
                    data.categoryNameMap?.[catId] || "Sin nombre"
                  );
                  try {
                    const res = await axios.get(
                      `${api}/dashboard/transactions-by-category?category_id=${catId}`,
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );
                    setCategoryTransactions(res.data.data);
                    setIsModalOpen(true);
                  } catch (err) {
                    console.error(
                      "Error al cargar transacciones de categoría:",
                      err
                    );
                  }
                }}
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

            <Modal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title={`Transacciones: ${selectedCategory}`}
            >
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {categoryTransactions.length === 0 ? (
                  <p className="text-sm text-gray-600">
                    Sin transacciones registradas.
                  </p>
                ) : (
                  categoryTransactions.map((tx) => (
                    <div
                      key={tx.id}
                      className="border-b pb-1 text-sm flex justify-between text-gray-700"
                    >
                      <span>{tx.date}</span>
                      <span className="text-right truncate w-32">
                        {tx.description || "Sin descripción"}
                      </span>
                      <span className="text-red-600 font-medium">
                        RD$ {parseFloat(tx.amount).toFixed(2)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </Modal>
          </ResponsiveContainer>
        </div>

        <p className="text-sm text-gray-600 mt-2">
          Este gráfico muestra el porcentaje del total de gastos del mes actual,
          distribuidos por categoría.
        </p>
      </CollapseSection>

      <CollapseSection title="3- Comparativa de saldos por cuenta">
        <AccountBalancesChart token={token} />
      </CollapseSection>

      <CollapseSection title="4- Comparativo mensual por categoría">
        <CategoryMonthlyComparisonTable token={token} />
      </CollapseSection>

      <CollapseSection title="5- Comparativo mensual por artículo">
        <ItemMonthlyComparisonTable token={token} />
      </CollapseSection>

      <CollapseSection title="6- Tendencia de precios por artículo">
        <ItemPriceTrendChart token={token} />
      </CollapseSection>

      <CollapseSection title="7- Gasto total por categoría (últimos 6 meses)">
        <CategorySpendingBarChart token={token} />
      </CollapseSection>

      <CollapseSection title="8- Presupuesto vs Gasto por categoría">
        <BudgetVsActualChart token={token} />
      </CollapseSection>

      <CollapseSection title="9- Top categorías con gasto excesivo">
        <OverBudgetChart token={token} />
      </CollapseSection>

      <CollapseSection title="10- Balance de Ingreso vs Gasto">
        <MonthlyIncomeVsExpenseChart token={token} />
      </CollapseSection>

      <CollapseSection title="11- Variaciones anuales por categoría">
        <CategoryVariationChart token={token} categories={categories} />
      </CollapseSection>

      <CollapseSection title="12- Resumen Anual: Presupuesto vs Gasto Total">
        <BudgetVsActualSummaryChart token={token} />
      </CollapseSection>

      <CollapseSection title="13- Gastos por tipo de estabilidad">
        <ExpenseByStabilityChart token={token} />
      </CollapseSection>

      <CollapseSection title="14- Top categorías variables con más gasto">
        <TopVariableCategoriesChart token={token} />
      </CollapseSection>

      <CollapseSection title="15- Progreso de metas de ahorro">
        <GoalsProgressChart token={token} />
      </CollapseSection>

      <CollapseSection title="16- Proyección de Gastos por Categoría y Estabilidad">
        <ProjectedExpenseByCategoryChart token={token} />
      </CollapseSection>

      <CollapseSection title="17- Proyección de Ingresos por Categoría y Estabilidad">
        <ProjectedIncomeByCategoryChart token={token} />
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
  const colorMap = {
    gray: "text-gray-800",
    green: "text-green-600",
    red: "text-red-600",
  };

  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

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
