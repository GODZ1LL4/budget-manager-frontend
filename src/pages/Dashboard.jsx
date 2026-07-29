import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  todayDateKey,
  withUserTimeZone,
} from "../lib/dates/localDate";

import ReportsNavRail from "../components/ReportsNavRail";

// Charts / Reports
import ItemPriceTrendChart from "../components/reports/ItemPriceTrendChart";
import ItemPriceCommandCenter from "../components/reports/ItemPriceCommandCenter";
import TransactionCommandCenter from "../components/reports/TransactionCommandCenter";
import ExpenseDistributionByCategoryChart from "../components/reports/ExpenseDistributionByCategoryChart";
import IncomeDistributionByCategoryChart from "../components/reports/IncomeDistributionByCategoryChart";
import BudgetVsActualChart from "../components/reports/BudgetVsActualChart";
import BudgetCategoryLineReport from "../components/reports/BudgetCategoryLineReport";
import AccountBalancesChart from "../components/reports/AccountBalancesChart";
import AccountFlowTraceReport from "../components/reports/AccountFlowTraceReport";
import CustomReportBuilder from "../components/reports/CustomReportBuilder";
import OverBudgetChart from "../components/reports/OverBudgetChart";
import MonthlyIncomeVsExpenseChart from "../components/reports/MonthlyIncomeVsExpenseChart";
import CategoryVariationChart from "../components/reports/CategoryVariationChart";
import TransactionsCalendar from "../components/reports/TransactionsCalendar";
import BudgetVsActualSummaryChart from "../components/reports/BudgetVsActualSummaryChart";
import ExpenseByStabilityChart from "../components/reports/ExpenseByStabilityChart";
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
import RecurringIncomePatternsTable from "../components/reports/RecurringIncomePatternsTable";
import ExpenseIntervalsByCategoryTable from "../components/reports/ExpenseIntervalsByCategoryTable";
import RecurringItemPatternsTable from "../components/reports/RecurringItemPatternsTable";
import ExpenseForecastChart from "../components/reports/ExpenseForecastChart";
import AdvancedBurnRateChart from "../components/reports/AdvancedBurnRateChart";
import MonthlyIncomeVsExpenseLineChart from "../components/reports/MonthlyIncomeVsExpenseLineChart";
import BudgetCoverageRobustChart from "../components/reports/BudgetCoverageRobustChart";
import ItemExpenseForecast from "../components/reports/ItemExpenseForecast";
import AntExpensesReport from "../components/reports/AntExpensesReport";
import ItemPurchaseHistoryReport from "../components/reports/ItemPurchaseHistoryReport";
import TopVariableCategoriesChart from "../components/reports/TopVariableCategoriesChart";
import DailyExpenseLineChart from "../components/reports/DailyExpenseLineChart";

function Dashboard({ token, setView }) {

  const api = import.meta.env.VITE_API_URL;

  const [data, setData] = useState(null);
  const [categories, setCategories] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [accountsError, setAccountsError] = useState("");
  const [todayExpense, setTodayExpense] = useState(0);
  const [yearlyStabilitySummary, setYearlyStabilitySummary] = useState(null);
  const [activeAccountIndex, setActiveAccountIndex] = useState(0);

  const searchInputRef = useRef(null);

  const fetchSummary = async () => {
    try {
      const res = await axios.get(`${api}/dashboard/summary`, {
        ...withUserTimeZone({
          headers: { Authorization: `Bearer ${token}` },
        }),
      });
      setData(res.data.data);
    } catch {
      alert("Error al cargar el dashboard");
    }
  };

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setCategories(res.data.data))
      .catch(() => console.error("Error al cargar categorías"));
  }, [token, api]);

  useEffect(() => {
    if (!token) return;

    setAccountsLoading(true);
    setAccountsError("");

    axios
      .get(`${api}/accounts/balances`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setAccounts(Array.isArray(res.data.data) ? res.data.data : []))
      .catch((err) => {
        setAccountsError("No se pudieron cargar las cuentas");
        console.error("Error al cargar cuentas:", err);
      })
      .finally(() => setAccountsLoading(false));
  }, [token, api]);

  useEffect(() => {
    if (token) fetchSummary();
  }, [token]);

  useEffect(() => {
    const fetchTodayExpense = async () => {
      try {
        const today = todayDateKey();
        const res = await axios.get(`${api}/dashboard/today-expense`, {
          ...withUserTimeZone({
            headers: { Authorization: `Bearer ${token}` },
            params: { date: today },
          }),
        });
        setTodayExpense(res.data.data.totalExpenseToday || 0);
      } catch (err) {
        console.error("Error al cargar gasto de hoy:", err);
      }
    };

    if (token) fetchTodayExpense();
  }, [token, api]);

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
  }, [token, api]);

  useEffect(() => {
    const runDailyRecurring = async () => {
      const today = todayDateKey();
      const key = `daily_job_executed_${today}`;

      if (!localStorage.getItem(key)) {
        try {
          const res = await axios.post(
            `${api}/jobs/run-daily-recurring`,
            null,
            withUserTimeZone({
              headers: { Authorization: `Bearer ${token}` },
              params: { date: today },
            })
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
  }, [token, api]);

  useEffect(() => {
    const onKeyDown = (e) => {
      const tag = (e.target?.tagName || "").toLowerCase();
      const typing =
        tag === "input" || tag === "textarea" || e.target?.isContentEditable;

      if (typing) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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

  const ui = {
    text: "var(--text)",
    muted: "var(--muted)",
    soft: "color-mix(in srgb, var(--text) 78%, transparent)",
    soft2: "color-mix(in srgb, var(--text) 70%, transparent)",
    subtle: "color-mix(in srgb, var(--muted) 85%, transparent)",
    border: "color-mix(in srgb, var(--border-rgba) 85%, transparent)",
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

  const sections = useMemo(() => {
    const loading = (msg = "Cargando…") => (
      <div className="text-sm" style={{ color: "var(--muted)" }}>
        {msg}
      </div>
    );

    return [
      {
        groupId: "estado",
        groupTitle: "🧭 Estado actual",
        items: [
          {
            id: "balances",
            title: "Balance disponible por cuenta y saldo total",
            keywords: "saldo cuentas banco",
            short: "Saldos por cuenta",
            panelHint: "Resumen de balances por cuenta.",
            render: () => <AccountBalancesChart token={token} />,
          },
          {
            id: "account-flow-trace",
            title: "Trazabilidad de dinero entre cuentas",
            keywords: "cuentas trazabilidad transferencias ingresos gastos flujo",
            short: "Flujo entre cuentas",
            panelHint:
              "Sigue ingresos, gastos y transferencias internas por cuenta.",
            render: () => <AccountFlowTraceReport token={token} />,
          },
          {
            id: "custom-report-builder",
            title: "Generador flexible de reportes",
            keywords:
              "power bi reporte generador parametros agrupacion barra pastel linea tabla",
            short: "Generador BI",
            panelHint:
              "Arma reportes con filtros, agrupaciones, metricas y visualizaciones.",
            render: () => (
              <CustomReportBuilder
                token={token}
                categories={categories}
                accounts={accounts}
              />
            ),
          },
          {
            id: "calendar",
            title: "Calendario de transacciones recientes por día",
            keywords: "calendario transacciones",
            short: "Calendario de transacciones",
            panelHint: "Actividad reciente organizada por fecha.",
            render: () => <TransactionsCalendar token={token} />,
          },
          {
            id: "burn-rate",
            title: "Ritmo de gasto acumulado del mes",
            keywords: "ritmo gasto burn rate",
            short: "Velocidad gasto",
            panelHint: "Qué tan rápido estás gastando este mes.",
            render: () => <BurnRateChart token={token} />,
          },
          {
            id: "burn-rate-advanced",
            title: "Burn rate avanzado contra patrón esperado",
            keywords: "burn rate avanzado",
            short: "Gasto vs esperado",
            badge: "Pro",
            panelHint: "Detalle avanzado del ritmo de gasto.",
            render: () => <AdvancedBurnRateChart token={token} />,
          },
        ],
      },
      {
        groupId: "ingresos",
        groupTitle: "💰 Ingresos",
        items: [
          {
            id: "income-expense-month",
            title: "Comparativo mensual de ingresos, gastos y balance",
            keywords: "ingresos gastos mensual",
            short: "Ingreso/gasto mes",
            panelHint: "Comparación mensual de ingresos y gastos.",
            render: () => <MonthlyIncomeVsExpenseChart token={token} />,
          },
          {
            id: "income-command",
            title: "Centro de comando para fuentes de ingreso",
            keywords: "ingresos command centro comando fuentes caidas estabilidad",
            short: "Radar ingresos",
            badge: "Pro",
            panelHint:
              "Vigila fuentes de ingreso, caidas, recurrencia y variacion mensual.",
            render: () => (
              <TransactionCommandCenter
                key="income-command-center"
                token={token}
                type="income"
              />
            ),
          },
          {
            id: "income-dist-category",
            title: "Distribución mensual de ingresos por categoría",
            keywords: "ingresos distribucion categoria fuentes",
            short: "Fuentes ingreso",
            panelHint: "De donde vienen los ingresos del periodo.",
            render: () => {
              if (!data) return loading("Cargando data del dashboard...");
              return (
                <IncomeDistributionByCategoryChart
                  incomeByCategory={data.incomeByCategory || {}}
                  categoryNameMap={data.categoryNameMap || {}}
                  token={token}
                />
              );
            },
          },
          {
            id: "income-heatmap",
            title: "Mapa anual de ingresos por categoria y mes",
            keywords: "ingresos heatmap categoria mes anual",
            short: "Mapa ingresos",
            panelHint: "Concentracion mensual de ingresos por categoria.",
            render: () => <CategoryMonthlyHeatmap token={token} type="income" />,
          },
          {
            id: "rec-inc",
            title: "Ingresos recurrentes detectados sin marcar",
            keywords: "ingresos recurrente recurrencias patrones fuentes",
            short: "Ingresos recurrentes",
            panelHint:
              "Detecta fuentes de ingreso que se repiten sin estar marcadas como recurrentes.",
            render: () => <RecurringIncomePatternsTable token={token} />,
          },
          {
            id: "proj-inc",
            title: "Proyección de ingresos por categoría y estabilidad",
            keywords: "proyeccion ingresos",
            short: "Ingreso proyectado",
            render: () => <ProjectedIncomeByCategoryChart token={token} />,
          },
          {
            id: "annual-line",
            title: "Tendencia anual de ingresos, gastos y ahorro",
            keywords: "ingresos gastos anual linea",
            short: "Flujo anual",
            render: () => <MonthlyIncomeVsExpenseLineChart token={token} />,
          },
        ],
      },
      {
        groupId: "analisis",
        groupTitle: "📊 Análisis del mes",
        items: [
          {
            id: "dist-category",
            title: "Distribución mensual del gasto por categoría",
            keywords: "distribucion categoria",
            short: "Gasto por rubro",
            panelHint: "¿En qué categorías se va el dinero?",
            render: () => {
              if (!data) return loading("Cargando data del dashboard…");
              return (
                <ExpenseDistributionByCategoryChart
                  expensesByCategory={data.expensesByCategory}
                  categoryNameMap={data.categoryNameMap}
                  token={token}
                />
              );
            },
          },
          {
            id: "weekday",
            title: "Días de la semana con mayor gasto",
            keywords: "weekday semana",
            short: "Días caros",
            render: () => <ExpenseByWeekdayChart token={token} />,
          },
          {
            id: "daily-expense-line",
            title: "Evolución diaria del gasto del mes",
            keywords: "gasto diario mes linea",
            short: "Gasto día a día",
            render: () => <DailyExpenseLineChart token={token} />,
          },
          {
            id: "expense-command",
            title: "Centro de comando para categorías de gasto",
            keywords: "gastos command centro comando presupuesto ritmo alerta categoria",
            short: "Radar gastos",
            badge: "Pro",
            panelHint:
              "Monitorea categorias de gasto, presupuesto, ritmo y variacion mensual.",
            render: () => (
              <TransactionCommandCenter
                key="expense-command-center"
                token={token}
                type="expense"
              />
            ),
          },
          {
            id: "stability",
            title:
              "Gasto fijo, variable y ocasional por estabilidad",
            keywords: "estabilidad fijo variable ocasional",
            short: "Fijo/variable",
            render: () => <ExpenseByStabilityChart token={token} />,
          },
          {
            id: "ants",
            title: "Gastos hormiga repetitivos y acumulados",
            keywords: "hormiga pequenos",
            short: "Hormiga acumulado",
            render: () => <AntExpensesReport token={token} />,
          },
        ],
      },
      {
        groupId: "presupuesto",
        groupTitle: "🎯 Control presupuestario",
        items: [
          {
            id: "bva",
            title: "Presupuesto vs gasto real por categoría",
            keywords: "budget actual categoria",
            short: "Presupuesto mensual",
            render: () => <BudgetVsActualChart token={token} />,
          },
          {
            id: "budget-category-line",
            title: "Gasto vs presupuesto por categoria anual",
            keywords: "linea presupuesto gasto categoria anual neto",
            short: "Presupuesto anual",
            panelHint:
              "Comparativo anual por categoria con presupuesto, gasto y neto mensual.",
            render: () => (
              <BudgetCategoryLineReport token={token} categories={categories} />
            ),
          },
          {
            id: "over",
            title: "Categorías con exceso sobre presupuesto",
            keywords: "exceso overbudget",
            short: "Excesos por rubro",
            render: () => <OverBudgetChart token={token} />,
          },
          {
            id: "coverage",
            title: "Cobertura de presupuestos sobre tus gastos",
            keywords: "cobertura presupuesto",
            short: "Cobertura de gastos",
            render: () => <BudgetCoverageChart token={token} />,
          },
          {
            id: "coverage2",
            title: "Cobertura presupuestaria detallada y brechas",
            keywords: "cobertura detallada",
            short: "Cobertura XTRA",
            badge: "Pro",
            render: () => <BudgetCoverageRobustChart token={token} />,
          },
          {
            id: "proj-vs-actual",
            title: "Proyección vs gasto real por categoría",
            keywords: "proyeccion realidad",
            short: "Proyección vs real",
            render: () => (
              <ProjectedVsActualExpenseByCategoryChart token={token} />
            ),
          },
        ],
      },
      {
        groupId: "alertas",
        groupTitle: "🔍 Alertas",
        items: [
          {
            id: "unusual",
            title: "Movimientos atípicos que rompen tu patrón",
            keywords: "atipicos unusual",
            short: "Alertas atípicas",
            render: () => <UnusualExpensesTable token={token} />,
          },
          {
            id: "variation-year",
            title: "Categorías con mayores variaciones anuales",
            keywords: "variacion anual",
            short: "Cambios anuales",
            render: () => (
              <CategoryVariationChart token={token} categories={categories} />
            ),
          },
          {
            id: "year-summary",
            title: "Resumen anual de presupuesto, gasto y desvío",
            keywords: "resumen anual",
            short: "Cierre anual",
            render: () => <BudgetVsActualSummaryChart token={token} />,
          },
          {
            id: "top-variable",
            title: "Categorías variables con mayor peso de gasto",
            keywords: "resumen anual",
            short: "Variables críticas",
            render: () => <TopVariableCategoriesChart token={token} />,
          },
        ],
      },
      {
        groupId: "historico",
        groupTitle: "📈 Histórico y comparativos",
        items: [
          {
            id: "heatmap",
            title: "Mapa anual de gasto por categoría y mes",
            keywords: "heatmap",
            short: "Mapa gasto anual",
            render: () => <CategoryMonthlyHeatmap token={token} />,
          },
          {
            id: "cmp-cat",
            title: "Comparativo mensual de categorías de gasto",
            keywords: "comparativo categoria",
            short: "Categorías por mes",
            render: () => <CategoryMonthlyComparisonTable token={token} />,
          },
          {
            id: "cmp-item",
            title: "Comparativo mensual por artículo comprado",
            keywords: "comparativo articulo item",
            short: "Artículos por mes",
            render: () => <ItemMonthlyComparisonTable token={token} />,
          },
          {
            id: "history-item",
            title: "Historial de compras por artículo específico",
            keywords: "historico compras",
            short: "Compras por artículo",
            render: () => <ItemPurchaseHistoryReport token={token} />,
          },
        ],
      },
      {
        groupId: "items",
        groupTitle: "🛒 Análisis por artículos",
        items: [
          {
            id: "item-price",
            title: "Tendencia histórica de precios por artículo",
            keywords: "precio tendencia",
            short: "Precios históricos",
            render: () => <ItemPriceTrendChart token={token} />,
          },
          {
            id: "item-price-command",
            title: "Centro de comando de inflación por artículos",
            keywords: "precio articulos bolsa racha inflacion comparativo lista",
            short: "Subidas de precio",
            badge: "Pro",
            panelHint:
              "Detecta articulos con subidas consecutivas y compara una cesta contra el precio anterior.",
            render: () => <ItemPriceCommandCenter token={token} />,
          },
          {
            id: "item-trend",
            title: "Consumo mensual por artículo comprado",
            keywords: "consumo tendencia",
            short: "Consumo por artículo",
            render: () => <ItemTrendChart token={token} />,
          },
          {
            id: "item-patterns",
            title: "Patrones recurrentes de compra por artículo",
            keywords: "patrones item",
            short: "Compras recurrentes",
            render: () => <RecurringItemPatternsTable token={token} />,
          },
          {
            id: "top-items",
            title: "Artículos con mayor gasto por categoría",
            keywords: "top items",
            short: "Artículos top",
            render: () => (
              <TopItemsByCategoryChart token={token} categories={categories} />
            ),
          },
          {
            id: "items-annual",
            title: "Resumen anual de consumo y gasto por artículos",
            keywords: "resumen anual items",
            short: "Año por artículos",
            render: () => <ItemsAnnualSummaryTable token={token} />,
          },
        ],
      },
      {
        groupId: "patrones",
        groupTitle: "🔷 Patrones y recurrencias",
        items: [
          {
            id: "rec-exp",
            title: "Gastos recurrentes detectados sin marcar",
            keywords: "recurrente no marcado",
            short: "Gastos recurrentes",
            render: () => <RecurringExpensePatternsTable token={token} />,
          },
          {
            id: "intervals",
            title: "Intervalos promedio entre gastos por categoría",
            keywords: "intervalo",
            short: "Frecuencia de gasto",
            render: () => <ExpenseIntervalsByCategoryTable token={token} />,
          },
        ],
      },
      {
        groupId: "futuro",
        groupTitle: "🔮 Proyecciones",
        items: [
          {
            id: "forecast",
            title: "Forecast de flujo futuro por período",
            keywords: "forecast flujo",
            short: "Flujo futuro",
            badge: "Pro",
            render: () => <ExpenseForecastChart token={token} />,
          },
          {
            id: "forecast-items",
            title: "Forecast de gastos futuros por artículos",
            keywords: "forecast items",
            short: "Gasto futuro ítems",
            badge: "Pro",
            render: () => <ItemExpenseForecast token={token} />,
          },
          {
            id: "proj-exp",
            title: "Proyección de gasto por categoría y estabilidad",
            keywords: "proyeccion gastos",
            short: "Gasto proyectado",
            render: () => <ProjectedExpenseByCategoryChart token={token} />,
          },
          {
            id: "goals",
            title: "Avance de metas de ahorro y reservas",
            keywords: "metas ahorro goals",
            short: "Ahorro y reservas",
            render: () => <GoalsProgressChart token={token} />,
          },
        ],
      },
    ];
  }, [token, data, categories, accounts]);

  const accountBalances = useMemo(() => {
    const rawAccounts =
      accounts.length > 0
        ? accounts
        : data?.accountBalances ||
          data?.accountsWithBalances ||
          data?.accounts ||
          data?.balancesByAccount ||
          [];

    if (!Array.isArray(rawAccounts)) return [];

    return rawAccounts
      .map((account, index) => {
        const balanceCandidates = [
          account?.current_balance,
          account?.currentBalance,
          account?.balance,
          account?.availableBalance,
          account?.available_balance,
          account?.opening_balance,
          account?.openingBalance,
          account?.amount,
          account?.total,
        ];
        const reservedCandidates = [
          account?.reserved,
          account?.reserved_total,
          account?.reserved_amount,
          account?.reservedAmount,
          account?.goal_reserved,
          account?.goalReserved,
          account?.goal_reserved_total,
          account?.goalReservedTotal,
        ];
        const availableCandidates = [
          account?.available,
          account?.available_balance,
          account?.available_balance,
          account?.availableBalance,
          account?.spendable_balance,
          account?.spendableBalance,
          account?.free_balance,
          account?.freeBalance,
        ];

        const resolvedBalance =
          balanceCandidates.find((value) => Number.isFinite(Number(value))) ?? 0;
        const resolvedReserved =
          reservedCandidates.find((value) => Number.isFinite(Number(value))) ?? 0;
        const resolvedAvailableCandidate = availableCandidates.find((value) =>
          Number.isFinite(Number(value))
        );
        const resolvedAvailable =
          resolvedAvailableCandidate ?? Number(resolvedBalance) - Number(resolvedReserved);

        return {
          id: account?.id || account?._id || account?.accountId || index,
          name:
            account?.name ||
            account?.accountName ||
            account?.nombre ||
            account?.bankName ||
            `Cuenta ${index + 1}`,
          type:
            account?.type ||
            account?.accountType ||
            account?.account_type ||
            account?.kind ||
            "",
          institution:
            account?.institution ||
            account?.bank ||
            account?.bankName ||
            account?.entity ||
            "",
          balance: Number(resolvedBalance) || 0,
          reserved: Number(resolvedReserved) || 0,
          available: Number(resolvedAvailable) || 0,
        };
      })
      .filter((account) => account.name);
  }, [accounts, data]);

  useEffect(() => {
    if (!accountBalances.length) {
      setActiveAccountIndex(0);
      return;
    }

    setActiveAccountIndex((prev) => prev % accountBalances.length);
  }, [accountBalances]);

  useEffect(() => {
    if (accountBalances.length <= 1) return undefined;

    const intervalId = window.setInterval(() => {
      setActiveAccountIndex((prev) => (prev + 1) % accountBalances.length);
    }, 4500);

    return () => window.clearInterval(intervalId);
  }, [accountBalances]);

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
  const totalAccountsBalance = accountBalances.reduce(
    (sum, account) => sum + (Number(account.balance) || 0),
    0
  );
  const totalReservedBalance = accountBalances.reduce(
    (sum, account) => sum + (Number(account.reserved) || 0),
    0
  );
  const totalAvailableBalance = accountBalances.reduce(
    (sum, account) => sum + (Number(account.available) || 0),
    0
  );

  return (
    <div className="space-y-8">
      

      <section className="space-y-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h2 className="ff-h1 ff-heading-accent mt-3">Dashboard Financiero</h2>
            <h3
              className="text-sm font-bold uppercase tracking-[0.18em]"
              style={{ color: "var(--text)" }}
            >
              Indicadores principales
            </h3>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              Resumen compacto del desempeño actual.
            </p>
          </div>

          <div
            className="inline-flex items-center gap-2 rounded-2xl p-1 self-start"
            style={{
              background: "color-mix(in srgb, var(--panel) 72%, transparent)",
              border: "1px solid var(--border-rgba)",
            }}
          >
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-bold"
              style={{
                background: "color-mix(in srgb, var(--text) 10%, var(--panel))",
                border:
                  "1px solid color-mix(in srgb, var(--text) 16%, var(--border-rgba))",
                color: "var(--text)",
              }}
            >
              Clásico
            </button>
            <button
              type="button"
              onClick={() => setView("moderndashboard")}
              className="px-4 py-2 rounded-xl text-sm font-bold transition"
              style={{
                background: "transparent",
                border: "1px solid transparent",
                color: "var(--muted)",
              }}
            >
              Terminal Pro
            </button>
          </div>
        </div>

        <RotatingAccountBalanceCard
          accounts={accountBalances}
          activeIndex={activeAccountIndex}
          isLoading={accountsLoading}
          error={accountsError}
          onSelect={setActiveAccountIndex}
          onPrevious={() =>
            setActiveAccountIndex(
              (prev) =>
                (prev - 1 + Math.max(accountBalances.length, 1)) %
                Math.max(accountBalances.length, 1)
            )
          }
          onNext={() =>
            setActiveAccountIndex(
              (prev) => (prev + 1) % Math.max(accountBalances.length, 1)
            )
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5 gap-4">

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
          <RotatingBalanceSummaryCard
            totalBalance={totalAccountsBalance}
            availableBalance={totalAvailableBalance}
            reservedBalance={totalReservedBalance}
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
          <MetricCard
            title="Presupuesto usado"
            value={budgetUsagePct}
            suffix="%"
            color={budgetUsagePct > 90 ? "red" : "gray"}
          />
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
      </section>

      <section className="space-y-4">
        <div>
          <h3
            className="text-sm font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--text)" }}
          >
            Lectura rápida
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Contexto anual y variaciones relevantes.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <FlipMetricCard summary={yearlyStabilitySummary} />

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
                  <span style={metaMuted}>)</span>
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
                  <span style={metaMuted}>)</span>
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
      </section>

      <section className="space-y-4">
        <div>
          <h3
            className="text-sm font-bold uppercase tracking-[0.18em]"
            style={{ color: "var(--text)" }}
          >
            Centro de reportes
          </h3>
          <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
            Navegación lateral con acceso rápido a análisis detallados.
          </p>
        </div>

        <ReportsNavRail
          sections={sections}
          defaultSectionId="balances"
          storageKey="dashboard_active_report"
          preloadNext
          searchInputRef={searchInputRef}
        />
      </section>
    </div>
  );
}

function HeroStat({ label, value, tone = "gray", isCurrency = false }) {
  const numericValue = Number(value);
  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;

  const displayValue = isCurrency
    ? new Intl.NumberFormat("es-DO", {
        style: "currency",
        currency: "DOP",
        minimumFractionDigits: 2,
      }).format(safeValue)
    : safeValue.toFixed(2);

  const accentToken =
    tone === "green"
      ? "var(--success)"
      : tone === "red"
      ? "var(--danger)"
      : "var(--primary)";

  return (
    <div
      className="relative overflow-hidden rounded-2xl px-4 py-4"
      style={{
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--panel) 84%, transparent), color-mix(in srgb, var(--panel) 62%, transparent))",
        border: "1px solid color-mix(in srgb, var(--border-rgba) 92%, transparent)",
        boxShadow: `0 18px 50px color-mix(in srgb, ${accentToken} 18%, transparent)`,
      }}
    >
      <div
        className="absolute inset-x-0 top-0 h-[2px]"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentToken}, transparent)`,
        }}
      />
      <p
        className="text-[11px] font-bold uppercase tracking-[0.18em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </p>
      <p
        className="mt-2 text-[clamp(24px,2.4vw,34px)] font-extrabold leading-none tracking-tight"
        style={{ color: `color-mix(in srgb, ${accentToken} 82%, var(--text))` }}
      >
        {displayValue}
      </p>
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

  const accentToken =
    color === "green"
      ? "var(--success)"
      : color === "red"
      ? "var(--danger)"
      : "var(--muted)";

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
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background: `linear-gradient(to bottom, ${accentToken}, color-mix(in srgb, ${accentToken} 35%, transparent))`,
        }}
      />

      <div
        className="pointer-events-none absolute inset-[1px] rounded-2xl"
        style={{
          border: "1px solid color-mix(in srgb, var(--text) 10%, transparent)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-8 opacity-40"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--text) 14%, transparent), transparent)",
        }}
      />

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

function RotatingBalanceSummaryCard({
  totalBalance,
  availableBalance,
  reservedBalance,
}) {
  const [showAvailable, setShowAvailable] = useState(false);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setShowAvailable((prev) => !prev);
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, []);

  const activeValue = showAvailable ? availableBalance : totalBalance;
  const activeTitle = showAvailable
    ? "Disponible tras reservado"
    : "Balance total en cuentas";
  const activeSubtitle = showAvailable
    ? `Reservado: ${formatCurrencyDOP(reservedBalance)}`
    : "Total acumulado entre tus cuentas";

  return (
    <MetricCard
      title={activeTitle}
      value={activeValue}
      isCurrency
      color={activeValue >= 0 ? "green" : "red"}
      subtitle={activeSubtitle}
    />
  );
}

function RotatingAccountBalanceCard({
  accounts,
  activeIndex,
  isLoading = false,
  error = "",
  onSelect,
  onPrevious,
  onNext,
}) {
  const activeAccount = accounts[activeIndex];
  const hasAccounts = accounts.length > 0 && activeAccount;

  if (!hasAccounts) {
    return (
      <div
        className="relative overflow-hidden rounded-[28px] p-5 md:p-6"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--primary) 10%, var(--panel)), color-mix(in srgb, var(--panel) 82%, transparent))",
          border: "1px solid color-mix(in srgb, var(--border-rgba) 88%, transparent)",
          boxShadow: "0 24px 60px color-mix(in srgb, var(--primary) 10%, transparent)",
        }}
      >
        <div
          className="absolute inset-y-0 left-0 w-[4px]"
          style={{
            background:
              "linear-gradient(to bottom, var(--primary), color-mix(in srgb, var(--primary) 30%, transparent))",
          }}
        />

        <div className="relative z-10">
          <p
            className="text-[11px] font-bold uppercase tracking-[0.2em]"
            style={{ color: "var(--muted)" }}
          >
            Balance por cuenta
          </p>
          <h3
            className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight"
            style={{ color: "var(--text)" }}
          >
            {isLoading
              ? "Cargando cuentas..."
              : error
              ? "No se pudieron cargar"
              : "Sin cuentas disponibles"}
          </h3>
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            {isLoading
              ? "Preparando el balance rotatorio."
              : error || "Agrega una cuenta o revisa el endpoint de cuentas para mostrar esta card."}
          </p>
        </div>
      </div>
    );
  }

  const isPositive = activeAccount.balance >= 0;
  const accentColor = isPositive ? "var(--success)" : "var(--danger)";
  const availableTone =
    activeAccount.available >= 0 ? "var(--success)" : "var(--danger)";

  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-5 md:p-6"
      style={{
        background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 16%, var(--panel)), color-mix(in srgb, var(--panel) 82%, transparent))`,
        border: "1px solid color-mix(in srgb, var(--border-rgba) 88%, transparent)",
        boxShadow: `0 24px 60px color-mix(in srgb, ${accentColor} 12%, transparent)`,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at top right, color-mix(in srgb, var(--text) 12%, transparent), transparent 45%)",
        }}
      />

      <div
        className="absolute inset-y-0 left-0 w-[4px]"
        style={{
          background: `linear-gradient(to bottom, ${accentColor}, color-mix(in srgb, ${accentColor} 30%, transparent))`,
        }}
      />

      <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
          <div>
            <p
              className="text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--muted)" }}
            >
              Balance por cuenta
            </p>
            <h3
              className="mt-2 text-2xl md:text-3xl font-extrabold tracking-tight"
              style={{ color: "var(--text)" }}
            >
              {activeAccount.name}
            </h3>
            <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
              {[activeAccount.type, activeAccount.institution]
                .filter(Boolean)
                .join(" • ") || "Cuenta registrada"}
            </p>
          </div>

          <div>
            <p
              className="text-[12px] font-semibold uppercase tracking-[0.18em]"
              style={{ color: "var(--muted)" }}
            >
              Balance actual
            </p>
            <p
              className="mt-2 text-[clamp(32px,4vw,48px)] font-extrabold leading-none"
              style={{ color: accentColor }}
            >
              {formatCurrencyDOP(activeAccount.balance)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div
              className="rounded-2xl px-3 py-3"
              style={{
                border: "1px solid var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 72%, transparent)",
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--muted)" }}
              >
                Disponible
              </p>
              <p
                className="mt-1 text-lg font-extrabold"
                style={{ color: availableTone }}
              >
                {formatCurrencyDOP(activeAccount.available)}
              </p>
            </div>

            <div
              className="rounded-2xl px-3 py-3"
              style={{
                border: "1px solid var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 72%, transparent)",
              }}
            >
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: "var(--muted)" }}
              >
                Reservado
              </p>
              <p
                className="mt-1 text-lg font-extrabold"
                style={{ color: "var(--warning)" }}
              >
                {formatCurrencyDOP(activeAccount.reserved)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:items-end">
          <div className="flex items-center gap-2 self-start lg:self-auto">
            <button
              type="button"
              onClick={onPrevious}
              className="h-10 w-10 rounded-full text-lg font-bold transition hover:-translate-y-0.5"
              style={{
                border: "1px solid var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                color: "var(--text)",
              }}
              aria-label="Cuenta anterior"
            >
              ‹
            </button>

            <button
              type="button"
              onClick={onNext}
              className="h-10 w-10 rounded-full text-lg font-bold transition hover:-translate-y-0.5"
              style={{
                border: "1px solid var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                color: "var(--text)",
              }}
              aria-label="Siguiente cuenta"
            >
              ›
            </button>
          </div>

          <div className="flex items-center gap-2">
            {accounts.map((account, index) => (
              <button
                key={account.id}
                type="button"
                onClick={() => onSelect(index)}
                className="h-2.5 rounded-full transition-all"
                style={{
                  width: index === activeIndex ? 32 : 10,
                  background:
                    index === activeIndex
                      ? accentColor
                      : "color-mix(in srgb, var(--muted) 45%, transparent)",
                }}
                aria-label={`Ver ${account.name}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ChromeInfoCard({ title, children, accent = "neutral" }) {
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
      className="relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5"
      style={{
        background: "color-mix(in srgb, var(--panel) 80%, transparent)",
        border: "var(--border-w) solid var(--border-rgba)",
        boxShadow: "var(--glow-shadow)",
        color: "var(--text)",
      }}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{ background: accentGradient }}
      />

      <div
        className="pointer-events-none absolute inset-[1px] rounded-2xl"
        style={{
          border: "1px solid color-mix(in srgb, var(--text) 10%, transparent)",
        }}
      />

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
        className="relative overflow-hidden rounded-2xl p-5 flex items-center justify-center text-sm"
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
      className="relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5 h-full min-h-[170px] cursor-pointer"
      style={{
        background: "color-mix(in srgb, var(--panel) 80%, transparent)",
        border: "var(--border-w) solid var(--border-rgba)",
        boxShadow: "var(--glow-shadow)",
        color: "var(--text)",
      }}
      onClick={() => setFlipped((prev) => !prev)}
    >
      <div
        className="absolute inset-y-0 left-0 w-[3px]"
        style={{
          background:
            "linear-gradient(to bottom, var(--success), color-mix(in srgb, var(--success) 25%, transparent))",
        }}
      />

      <div
        className="pointer-events-none absolute inset-[1px] rounded-2xl"
        style={{
          border: "1px solid color-mix(in srgb, var(--text) 10%, transparent)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-8 opacity-40"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in srgb, var(--text) 14%, transparent), transparent)",
        }}
      />

      <div
        className={`
          relative w-full h-full
          transition-transform duration-500
          [transform-style:preserve-3d]
          ${flipped ? "[transform:rotateY(180deg)]" : ""}
        `}
      >
        <div className="absolute inset-0 p-5 [backface-visibility:hidden] flex flex-col">
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

        <div className="absolute inset-0 p-5 [backface-visibility:hidden] [transform:rotateY(180deg)] flex flex-col">
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
