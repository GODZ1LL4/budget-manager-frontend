import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { HiRefresh } from "react-icons/hi";
import FFSelect from "../FFSelect";

const MONTHS = [
  { value: "01", short: "Ene", long: "Enero" },
  { value: "02", short: "Feb", long: "Febrero" },
  { value: "03", short: "Mar", long: "Marzo" },
  { value: "04", short: "Abr", long: "Abril" },
  { value: "05", short: "May", long: "Mayo" },
  { value: "06", short: "Jun", long: "Junio" },
  { value: "07", short: "Jul", long: "Julio" },
  { value: "08", short: "Ago", long: "Agosto" },
  { value: "09", short: "Sep", long: "Septiembre" },
  { value: "10", short: "Oct", long: "Octubre" },
  { value: "11", short: "Nov", long: "Noviembre" },
  { value: "12", short: "Dic", long: "Diciembre" },
];

const safeNum = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const roundMoney = (value) => Number(safeNum(value).toFixed(2));

const formatMoney = (value) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(safeNum(value));

const formatSignedMoney = (value) => {
  const number = safeNum(value);
  const sign = number > 0 ? "+" : number < 0 ? "-" : "";
  return `${sign}${formatMoney(Math.abs(number))}`;
};

const formatCompactMoney = (value) =>
  new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(safeNum(value));

function getCurrentYear() {
  return new Date().getFullYear();
}

function normalizeYear(value, fallback = getCurrentYear()) {
  const number = Number(String(value ?? "").trim());
  if (!Number.isInteger(number)) return fallback;
  return Math.max(2000, Math.min(2100, number));
}

function StatCard({ label, value, tone = "neutral", helper }) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--text)";

  return (
    <div
      className="min-w-0 rounded-lg border p-4"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 68%, transparent)",
      }}
    >
      <p className="text-xs font-semibold uppercase text-[var(--muted)]">
        {label}
      </p>
      <p
        className="mt-2 min-w-0 text-xl font-extrabold leading-tight [overflow-wrap:anywhere]"
        style={{ color }}
      >
        {value}
      </p>
      {helper ? (
        <p className="mt-1 truncate text-xs text-[var(--muted)]">{helper}</p>
      ) : null}
    </div>
  );
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const netColor = row.net >= 0 ? "var(--success)" : "var(--danger)";

  return (
    <div
      className="rounded-lg border px-3 py-2 text-sm"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--bg-3) 88%, #000)",
        boxShadow: "var(--glow-shadow)",
        color: "var(--text)",
      }}
    >
      <p className="mb-1 font-bold text-[var(--text)]">
        {row.monthName} {row.year}
      </p>
      <p className="m-0 text-[var(--muted)]">
        Presupuesto:{" "}
        <span className="font-bold text-[var(--text)]">
          {formatMoney(row.budgeted)}
        </span>
      </p>
      <p className="m-0 text-[var(--muted)]">
        Gastado:{" "}
        <span className="font-bold text-[var(--danger)]">
          {formatMoney(row.spent)}
        </span>
      </p>
      <p className="m-0 mt-1 font-extrabold" style={{ color: netColor }}>
        Neto: {formatSignedMoney(row.net)}
      </p>
    </div>
  );
}

function BudgetCategoryLineReport({ token, categories = [] }) {
  const api = import.meta.env.VITE_API_URL;
  const defaultYear = useMemo(() => getCurrentYear(), []);

  const [fallbackCategories, setFallbackCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [yearDraft, setYearDraft] = useState(String(defaultYear));
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const providedCategories = useMemo(
    () => (Array.isArray(categories) ? categories : []),
    [categories]
  );

  useEffect(() => {
    if (!token || providedCategories.length > 0) return;

    let cancelled = false;
    setCategoriesLoading(true);

    axios
      .get(`${api}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        if (cancelled) return;
        setFallbackCategories(Array.isArray(res.data?.data) ? res.data.data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("Error al cargar categorias del reporte:", err);
        setFallbackCategories([]);
      })
      .finally(() => {
        if (!cancelled) setCategoriesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [api, providedCategories.length, token]);

  const categoryOptions = useMemo(() => {
    const source =
      providedCategories.length > 0 ? providedCategories : fallbackCategories;

    return source
      .filter((category) => category?.id && category?.type === "expense")
      .map((category) => ({
        value: String(category.id),
        label: category.name || "Categoria",
      }))
      .sort((a, b) =>
        a.label.localeCompare(b.label, "es", { sensitivity: "base" })
      );
  }, [fallbackCategories, providedCategories]);

  useEffect(() => {
    if (categoryId || !categoryOptions.length) return;

    const firstCategoryId = categoryOptions[0].value;
    setCategoryId(firstCategoryId);
    setAppliedFilters({
      categoryId: firstCategoryId,
      year: defaultYear,
    });
  }, [categoryId, categoryOptions, defaultYear]);

  const loadReport = useCallback(
    async ({ categoryId: nextCategoryId, year }) => {
      if (!token || !nextCategoryId) return;

      setLoading(true);
      setErrorMsg("");

      try {
        const [budgetRes, expenseRes] = await Promise.all([
          axios.get(`${api}/budgets`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { year },
          }),
          axios.get(`${api}/analytics/yearly-category-variations`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { year },
          }),
        ]);

        const budgetRows = Array.isArray(budgetRes.data?.data)
          ? budgetRes.data.data
          : [];
        const expenseMap = expenseRes.data?.data || {};
        const selectedExpenseRows =
          expenseMap[String(nextCategoryId)] || expenseMap[nextCategoryId] || [];

        const budgetByMonth = new Map();
        budgetRows.forEach((row) => {
          if (String(row.category_id) !== String(nextCategoryId)) return;

          const month = String(row.month || "");
          if (!month) return;

          budgetByMonth.set(
            month,
            safeNum(budgetByMonth.get(month)) + safeNum(row.limit ?? row.limit_amount)
          );
        });

        const expenseByMonth = new Map();
        selectedExpenseRows.forEach((row) => {
          const month = String(row.month || "");
          if (!month) return;

          expenseByMonth.set(
            month,
            safeNum(expenseByMonth.get(month)) + safeNum(row.amount)
          );
        });

        const nextRows = MONTHS.map((monthInfo) => {
          const month = `${year}-${monthInfo.value}`;
          const budgeted = roundMoney(budgetByMonth.get(month));
          const spent = roundMoney(expenseByMonth.get(month));
          const net = roundMoney(budgeted - spent);

          return {
            month,
            year,
            monthShort: monthInfo.short,
            monthName: monthInfo.long,
            budgeted,
            spent,
            net,
          };
        });

        setRows(nextRows);
      } catch (err) {
        console.error("Error al cargar linea presupuesto vs gasto:", err);
        setRows([]);
        setErrorMsg("No se pudo cargar el reporte para los parametros seleccionados.");
      } finally {
        setLoading(false);
      }
    },
    [api, token]
  );

  useEffect(() => {
    if (!appliedFilters) return;
    loadReport(appliedFilters);
  }, [appliedFilters, loadReport]);

  const totals = useMemo(() => {
    const budgeted = rows.reduce((sum, row) => sum + safeNum(row.budgeted), 0);
    const spent = rows.reduce((sum, row) => sum + safeNum(row.spent), 0);

    return {
      budgeted: roundMoney(budgeted),
      spent: roundMoney(spent),
      net: roundMoney(budgeted - spent),
    };
  }, [rows]);

  const appliedCategory = useMemo(
    () =>
      categoryOptions.find(
        (option) => String(option.value) === String(appliedFilters?.categoryId)
      ),
    [appliedFilters, categoryOptions]
  );

  const hasChartData = rows.some((row) => row.budgeted > 0 || row.spent > 0);

  const handleRefresh = useCallback(() => {
    const year = Number(String(yearDraft).trim());

    if (!categoryId) {
      setErrorMsg("Selecciona una categoria.");
      return;
    }

    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      setErrorMsg("Ingresa un ano valido entre 2000 y 2100.");
      return;
    }

    setAppliedFilters({
      categoryId: String(categoryId),
      year: normalizeYear(year, defaultYear),
    });
  }, [categoryId, defaultYear, yearDraft]);

  const onFilterKeyDown = (event) => {
    if (event.key === "Enter") handleRefresh();
  };

  const chartUi = useMemo(
    () => ({
      grid: "color-mix(in srgb, var(--border-rgba) 58%, transparent)",
      axis: "color-mix(in srgb, var(--muted) 70%, transparent)",
      tick: "color-mix(in srgb, var(--text) 84%, transparent)",
      budget: "var(--primary)",
      spent: "var(--danger)",
      cursor: "color-mix(in srgb, var(--primary) 10%, transparent)",
    }),
    []
  );

  return (
    <div
      className="rounded-lg border p-5 md:p-6"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 78%, transparent), var(--bg-2))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.72)",
        color: "var(--text)",
      }}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-[var(--text)]">
            Gasto vs presupuesto por categoria
          </h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Comparativo mensual de presupuesto, gasto real y neto.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[minmax(220px,1fr)_120px_auto] lg:w-auto">
          <label className="min-w-0">
            <span className="text-xs font-semibold uppercase text-[var(--muted)]">
              Categoria
            </span>
            <FFSelect
              value={categoryId}
              onChange={(value) => setCategoryId(String(value))}
              options={categoryOptions}
              placeholder={
                categoriesLoading ? "Cargando categorias..." : "Selecciona categoria"
              }
              searchable
              clearable={false}
              className="mt-1 w-full"
              getOptionLabel={(option) => option.label}
              getOptionValue={(option) => option.value}
              disabled={loading || categoriesLoading || categoryOptions.length === 0}
            />
          </label>

          <label>
            <span className="text-xs font-semibold uppercase text-[var(--muted)]">
              Ano
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={yearDraft}
              onChange={(event) => setYearDraft(event.target.value)}
              onKeyDown={onFilterKeyDown}
              className="ff-input mt-1 w-full rounded-lg px-3 py-2 text-sm"
              min="2000"
              max="2100"
            />
          </label>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || !token || !categoryOptions.length}
            className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg border px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--primary) 16%, var(--panel))",
              color: "var(--text)",
            }}
            title="Refrescar reporte"
          >
            <HiRefresh className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Refrescar
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div
          className="mt-4 rounded-lg border px-3 py-2 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 42%, var(--border-rgba))",
            background: "color-mix(in srgb, var(--danger) 10%, var(--panel))",
            color: "var(--text)",
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
        <StatCard label="Total presupuesto" value={formatMoney(totals.budgeted)} />
        <StatCard
          label="Total gastado"
          value={formatMoney(totals.spent)}
          tone={totals.spent > totals.budgeted && totals.budgeted > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Neto"
          value={formatSignedMoney(totals.net)}
          tone={totals.net >= 0 ? "success" : "danger"}
          helper={appliedCategory ? `${appliedCategory.label} ${appliedFilters?.year}` : ""}
        />
      </div>

      <div className="mt-5">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Cargando reporte...</p>
        ) : !categoryOptions.length ? (
          <p className="text-sm italic text-[var(--muted)]">
            No hay categorias de gasto disponibles.
          </p>
        ) : !hasChartData ? (
          <p className="text-sm italic text-[var(--muted)]">
            No hay presupuesto ni gasto para esta categoria en el ano seleccionado.
          </p>
        ) : (
          <div className="h-[360px] w-full">
            <ResponsiveContainer>
              <LineChart
                data={rows}
                margin={{ top: 16, right: 24, bottom: 8, left: 0 }}
              >
                <CartesianGrid stroke={chartUi.grid} strokeDasharray="4 4" />
                <XAxis
                  dataKey="monthShort"
                  stroke={chartUi.axis}
                  tick={{ fill: chartUi.tick, fontSize: 12 }}
                  tickLine={{ stroke: chartUi.axis }}
                />
                <YAxis
                  stroke={chartUi.axis}
                  tick={{ fill: chartUi.tick, fontSize: 12 }}
                  tickFormatter={(value) => formatCompactMoney(value)}
                  tickLine={{ stroke: chartUi.axis }}
                />
                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ stroke: chartUi.cursor, strokeWidth: 2 }}
                />
                <Legend
                  wrapperStyle={{ color: "var(--text)" }}
                  formatter={(value) => (
                    <span className="text-sm text-[var(--text)]">{value}</span>
                  )}
                />
                <Line
                  type="linear"
                  dataKey="budgeted"
                  name="Presupuesto"
                  stroke={chartUi.budget}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: chartUi.budget, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: chartUi.budget, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
                <Line
                  type="linear"
                  dataKey="spent"
                  name="Gastado"
                  stroke={chartUi.spent}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: chartUi.spent, strokeWidth: 0 }}
                  activeDot={{ r: 5, fill: chartUi.spent, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default BudgetCategoryLineReport;
