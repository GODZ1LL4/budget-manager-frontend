// src/components/reports/ExpenseDistributionByCategoryChart.jsx
import { memo, useCallback, useMemo, useState } from "react";
import axios from "axios";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import Modal from "../Modal";
import { currentMonthKey, withUserTimeZone } from "../../lib/dates/localDate";

const COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "color-mix(in srgb, var(--primary) 55%, #4f46e5)",
  "color-mix(in srgb, var(--primary) 45%, #3b82f6)",
  "color-mix(in srgb, var(--danger) 55%, #ec4899)",
  "color-mix(in srgb, var(--primary) 35%, #14b8a6)",
  "color-mix(in srgb, var(--warning) 55%, #a855f7)",
  "color-mix(in srgb, var(--success) 55%, #0ea5e9)",
  "color-mix(in srgb, var(--primary) 30%, #84cc16)",
  "color-mix(in srgb, var(--danger) 35%, #f43f5e)",
];

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => {
  const month = index + 1;
  const label = new Intl.DateTimeFormat("es-DO", { month: "long" }).format(
    new Date(2026, index, 1)
  );

  return {
    value: month,
    label: `${String(month).padStart(2, "0")} - ${
      label.charAt(0).toUpperCase() + label.slice(1)
    }`,
  };
});

const money = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

const safeNum = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0);

const getDefaultPeriod = () => {
  const monthKey = currentMonthKey();
  return {
    year: Number(monthKey.slice(0, 4)),
    month: Number(monthKey.slice(5, 7)),
  };
};

function ExpenseDistributionByCategoryChart({
  expensesByCategory = {},
  categoryNameMap = {},
  token,
  transactionType = "expense",
}) {
  const api = import.meta.env.VITE_API_URL;
  const defaultPeriod = useMemo(() => getDefaultPeriod(), []);
  const isIncomeReport = transactionType === "income";
  const reportCopy = useMemo(
    () =>
      isIncomeReport
        ? {
            distributionEndpoint: "income-by-category",
            totalsKey: "incomeByCategory",
            valueLabel: "Ingreso",
            valueColor: "var(--success)",
            emptyMessage:
              "No hay ingresos registrados para el periodo seleccionado.",
            summaryText:
              "Este grafico muestra el porcentaje del total de ingresos del periodo seleccionado, distribuidos por categoria.",
          }
        : {
            distributionEndpoint: "expenses-by-category",
            totalsKey: "expensesByCategory",
            valueLabel: "Gasto",
            valueColor: "var(--danger)",
            emptyMessage:
              "No hay gastos registrados para el periodo seleccionado.",
            summaryText:
              "Este grafico muestra el porcentaje del total de gastos del periodo seleccionado, distribuidos por categoria.",
          },
    [isIncomeReport]
  );

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [categoryTransactions, setCategoryTransactions] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [fetchedExpensesByCategory, setFetchedExpensesByCategory] =
    useState(null);
  const [fetchedCategoryNameMap, setFetchedCategoryNameMap] = useState(null);

  const [yearDraft, setYearDraft] = useState(String(defaultPeriod.year));
  const [monthDraft, setMonthDraft] = useState(defaultPeriod.month);
  const [appliedYear, setAppliedYear] = useState(defaultPeriod.year);
  const [appliedMonth, setAppliedMonth] = useState(defaultPeriod.month);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const displayExpensesByCategory =
    fetchedExpensesByCategory ?? expensesByCategory;
  const displayCategoryNameMap = fetchedCategoryNameMap ?? categoryNameMap;

  const rows = useMemo(() => {
    const list = Object.entries(displayExpensesByCategory)
      .map(([catId, value]) => ({
        categoryId: catId,
        name: displayCategoryNameMap?.[catId] || `Categoría ${catId}`,
        value: safeNum(value),
      }))
      .filter((r) => r.value > 0);

    list.sort((a, b) => b.value - a.value);

    const total = list.reduce((acc, r) => acc + r.value, 0);

    return {
      total,
      items: list.map((r) => ({
        ...r,
        pct: total > 0 ? (r.value / total) * 100 : 0,
      })),
    };
  }, [displayExpensesByCategory, displayCategoryNameMap]);

  const selectedPeriodLabel = useMemo(() => {
    const monthOption = MONTH_OPTIONS.find(
      (option) => option.value === Number(appliedMonth)
    );
    const monthLabel =
      monthOption?.label?.split(" - ")[1] || String(appliedMonth).padStart(2, "0");

    return `${monthLabel} ${appliedYear}`;
  }, [appliedMonth, appliedYear]);

  const fetchDistribution = useCallback(
    async ({ year, month }) => {
      if (!token) return;

      try {
        setLoading(true);
        setErrorMsg("");

        const res = await axios.get(
          `${api}/dashboard/${reportCopy.distributionEndpoint}`,
          withUserTimeZone({
            headers: { Authorization: `Bearer ${token}` },
            params: { year, month },
          })
        );

        const payload = res?.data?.data || {};
        const meta = res?.data?.meta || {};

        setFetchedExpensesByCategory(payload[reportCopy.totalsKey] || {});
        setFetchedCategoryNameMap(payload.categoryNameMap || {});
        setAppliedYear(Number(meta.year || year));
        setAppliedMonth(Number(meta.month || month));
      } catch (err) {
        console.error("Error al cargar distribución por categoría:", err);
        setErrorMsg("No se pudo cargar el reporte para el período seleccionado.");
      } finally {
        setLoading(false);
      }
    },
    [api, reportCopy, token]
  );

  const handleRefresh = useCallback(() => {
    const nextYear = Number(yearDraft);
    const nextMonth = Number(monthDraft);

    if (
      !Number.isInteger(nextYear) ||
      nextYear < 2000 ||
      nextYear > 2100 ||
      !Number.isInteger(nextMonth) ||
      nextMonth < 1 ||
      nextMonth > 12
    ) {
      setErrorMsg("Selecciona un año y un mes válidos.");
      return;
    }

    fetchDistribution({ year: nextYear, month: nextMonth });
  }, [fetchDistribution, monthDraft, yearDraft]);

  const onFilterKeyDown = (e) => {
    if (e.key === "Enter") handleRefresh();
  };

  const openCategory = useCallback(
    async (catId, catName) => {
      try {
        if (!catId || !token) return;

        setSelectedCategory(catName || "Categoría");
        const res = await axios.get(
          `${api}/dashboard/transactions-by-category`,
          withUserTimeZone({
            headers: { Authorization: `Bearer ${token}` },
            params: {
              category_id: catId,
              year: appliedYear,
              month: appliedMonth,
              type: transactionType,
            },
          })
        );

        setCategoryTransactions(res?.data?.data || []);
        setIsModalOpen(true);
      } catch (err) {
        console.error("Error al cargar transacciones:", err);
      }
    },
    [api, appliedMonth, appliedYear, token, transactionType]
  );

  const handleSliceClick = (_, index) => {
    const slice = rows.items[index];
    if (!slice) return;
    openCategory(slice.categoryId, slice.name);
  };

  return (
    <div className="space-y-3" style={{ color: "var(--text)" }}>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col">
          <label
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "var(--muted)" }}
          >
            Año
          </label>
          <input
            type="number"
            value={yearDraft}
            onChange={(e) => setYearDraft(e.target.value)}
            onKeyDown={onFilterKeyDown}
            min="2000"
            max="2100"
            className="ff-input text-sm px-3 py-2 rounded-lg w-28"
          />
        </div>

        <div className="flex flex-col">
          <label
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "var(--muted)" }}
          >
            Mes
          </label>
          <select
            value={monthDraft}
            onChange={(e) => setMonthDraft(Number(e.target.value))}
            onKeyDown={onFilterKeyDown}
            className="ff-input text-sm px-3 py-2 rounded-lg min-w-40"
          >
            {MONTH_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          disabled={loading || !token}
          className="px-4 py-2 rounded-lg text-sm border transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 70%, transparent)",
            color: "var(--text)",
          }}
          title="Aplicar año y mes"
        >
          {loading ? "Cargando..." : "Refrescar"}
        </button>

        <span className="text-sm" style={{ color: "var(--muted)" }}>
          Período:{" "}
          <strong style={{ color: "var(--text)", fontWeight: 700 }}>
            {selectedPeriodLabel}
          </strong>
        </span>
      </div>

      {errorMsg ? (
        <div
          className="text-xs px-3 py-2 rounded-lg border"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 35%, transparent)",
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            color: "var(--text)",
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      {!rows.items.length ? (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          {reportCopy.emptyMessage}
        </p>
      ) : (
        <>
          <div style={{ width: "100%", height: 300 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={rows.items}
                  dataKey="value"
                  nameKey="name"
                  outerRadius="80%"
                  isAnimationActive={false}
                  label={({ name, percent }) =>
                    `${name} (${(percent * 100).toFixed(1)}%)`
                  }
                  onClick={handleSliceClick}
                >
                  {rows.items.map((entry, index) => (
                    <Cell
                      key={`cell-${entry.categoryId}-${index}`}
                      fill={COLORS[index % COLORS.length]}
                      style={{ cursor: "pointer" }}
                    />
                  ))}
                </Pie>

                <Tooltip
                  formatter={(value) => [money(value), reportCopy.valueLabel]}
                  labelFormatter={(label) => `Categoría: ${label}`}
                  contentStyle={{
                    background: "color-mix(in srgb, var(--bg-3) 78%, transparent)",
                    border: "1px solid var(--border-rgba)",
                    color: "var(--text)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                    padding: "10px 12px",
                    backdropFilter: "blur(10px)",
                  }}
                  itemStyle={{ color: "var(--text)" }}
                  labelStyle={{ color: "var(--heading)", fontWeight: 700 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {rows.items.map((r, i) => (
              <button
                type="button"
                key={`${r.categoryId}-${i}`}
                className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors"
                style={{
                  borderColor: "var(--border-rgba)",
                  background: "color-mix(in srgb, var(--panel) 55%, transparent)",
                  cursor: "pointer",
                }}
                title={r.name}
                onClick={() => openCategory(r.categoryId, r.name)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--panel) 78%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--panel) 55%, transparent)";
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: COLORS[i % COLORS.length] }}
                  />
                  <span
                    className="text-sm truncate"
                    style={{ color: "var(--text)" }}
                  >
                    {r.name}
                  </span>
                  <span
                    className="text-xs shrink-0"
                    style={{ color: "var(--muted)" }}
                  >
                    {r.pct.toFixed(1)}%
                  </span>
                </div>

                <span
                  className="text-sm font-semibold shrink-0"
                  style={{ color: "var(--text)" }}
                >
                  {money(r.value)}
                </span>
              </button>
            ))}
          </div>

          <p className="text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
            {reportCopy.summaryText}{" "}
            <span style={{ color: "var(--heading-muted)" }}>
              Haz clic en una categoría (slice o card) para ver sus transacciones.
            </span>
          </p>
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedCategory(null);
          setCategoryTransactions([]);
        }}
        title={
          selectedCategory
            ? `Transacciones: ${selectedCategory} (${selectedPeriodLabel})`
            : "Transacciones por categoría"
        }
        size="lg"
      >
        <div
          className="space-y-2 max-h-96 overflow-y-auto overflow-x-hidden text-sm pr-1"
          style={{ color: "var(--text)" }}
        >
          {categoryTransactions.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              Sin transacciones registradas.
            </p>
          ) : (
            categoryTransactions.map((tx) => (
              <div
                key={tx.id}
                className="
                  flex items-center justify-between gap-3
                  py-2 border-b last:border-b-0
                  rounded-md px-2 -mx-2
                  transition-colors
                "
                style={{ borderColor: "var(--border-rgba)" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "color-mix(in srgb, var(--panel) 70%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span
                  className="w-20 shrink-0"
                  style={{ color: "var(--muted)" }}
                >
                  {tx.date}
                </span>

                <span
                  className="flex-1 truncate"
                  style={{ color: "var(--text)" }}
                >
                  {tx.description || "Sin descripción"}
                </span>

                <span
                  className="font-semibold shrink-0"
                  style={{ color: reportCopy.valueColor }}
                >
                  {money(tx.amount)}
                </span>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

export default memo(ExpenseDistributionByCategoryChart);
