import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  HiChartBar,
  HiChartPie,
  HiRefresh,
  HiTable,
  HiTrendingUp,
} from "react-icons/hi";
import FFSelect from "../FFSelect";
import {
  addDaysToDateKey,
  currentMonthRange,
  startOfWeekDateKey,
  todayDateKey,
  withUserTimeZone,
} from "../../lib/dates/localDate";

const CHART_COLORS = [
  "var(--primary)",
  "var(--success)",
  "var(--warning)",
  "var(--danger)",
  "color-mix(in srgb, var(--primary) 45%, #14b8a6)",
  "color-mix(in srgb, var(--success) 55%, #0ea5e9)",
  "color-mix(in srgb, var(--warning) 55%, #a855f7)",
  "color-mix(in srgb, var(--danger) 45%, #ec4899)",
  "color-mix(in srgb, var(--primary) 35%, #84cc16)",
  "color-mix(in srgb, var(--text) 55%, var(--panel))",
];

const RANGE_OPTIONS = [
  { value: "this_month", label: "Mes actual" },
  { value: "last_30_days", label: "Ultimos 30 dias" },
  { value: "this_year", label: "Ano actual" },
  { value: "custom", label: "Rango manual" },
  { value: "all_time", label: "Todo" },
];

const TYPE_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "expense", label: "Gastos" },
  { value: "income", label: "Ingresos" },
];

const METRIC_OPTIONS = [
  { value: "total", label: "Monto total" },
  { value: "net", label: "Balance neto" },
  { value: "income", label: "Solo ingresos" },
  { value: "expense", label: "Solo gastos" },
  { value: "average", label: "Promedio" },
  { value: "count", label: "Cantidad" },
];

const GROUP_OPTIONS = [
  { value: "category", label: "Categoria" },
  { value: "account", label: "Cuenta" },
  { value: "type", label: "Tipo" },
  { value: "month", label: "Mes" },
  { value: "week", label: "Semana" },
  { value: "day", label: "Dia" },
  { value: "recurrence", label: "Recurrencia" },
  { value: "shopping", label: "Origen" },
  { value: "none", label: "Sin agrupacion" },
];

const SORT_OPTIONS = [
  { value: "smart", label: "Automatico" },
  { value: "value_desc", label: "Mayor valor" },
  { value: "value_asc", label: "Menor valor" },
  { value: "name", label: "A-Z" },
];

const TOP_OPTIONS = [
  { value: "5", label: "Top 5" },
  { value: "10", label: "Top 10" },
  { value: "15", label: "Top 15" },
  { value: "all", label: "Todos" },
];

const CHART_OPTIONS = [
  { value: "bar", label: "Barra", icon: HiChartBar },
  { value: "pie", label: "Pastel", icon: HiChartPie },
  { value: "line", label: "Linea", icon: HiTrendingUp },
  { value: "table", label: "Tabla", icon: HiTable },
];

const TYPE_LABELS = {
  expense: "Gasto",
  income: "Ingreso",
};

const RECURRENCE_LABELS = {
  monthly: "Mensual",
  biweekly: "Quincenal",
  weekly: "Semanal",
};

const isTemporalGroup = (groupBy) =>
  groupBy === "day" || groupBy === "week" || groupBy === "month";

const safeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : 0;
};

const formatCurrency = (value, signed = false) => {
  const numeric = safeAmount(value);
  const sign = signed && numeric > 0 ? "+" : "";

  return `${sign}${new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric)}`;
};

const formatCompact = (value) => {
  const numeric = safeAmount(value);
  return new Intl.NumberFormat("es-DO", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(numeric);
};

const formatMetricValue = (value, metric) => {
  if (metric === "count") {
    return `${safeAmount(value).toLocaleString("es-DO")} mov.`;
  }

  return formatCurrency(value, metric === "net");
};

const getDefaultRange = () => currentMonthRange();

const getRangeDates = (rangePreset, dateFrom, dateTo) => {
  const today = todayDateKey();

  if (rangePreset === "last_30_days") {
    return {
      from: addDaysToDateKey(today, -29),
      to: today,
    };
  }

  if (rangePreset === "this_year") {
    return {
      from: `${today.slice(0, 4)}-01-01`,
      to: today,
    };
  }

  if (rangePreset === "custom") {
    return {
      from: dateFrom || "",
      to: dateTo || "",
    };
  }

  if (rangePreset === "all_time") {
    return {
      from: "",
      to: "",
    };
  }

  return getDefaultRange();
};

const getCategoryName = (tx, categoryMap) => {
  const categoryId = tx?.category_id || tx?.categories?.id;
  return (
    tx?.categories?.name ||
    categoryMap.get(String(categoryId || "")) ||
    "Sin categoria"
  );
};

const getAccountName = (tx, accountMap) => {
  const accountId = tx?.account_id || tx?.account?.id;
  return (
    tx?.account?.name ||
    accountMap.get(String(accountId || "")) ||
    "Sin cuenta"
  );
};

const getGroupDescriptor = (tx, groupBy, categoryMap, accountMap) => {
  const dateKey = String(tx?.date || "").slice(0, 10);

  if (groupBy === "none") {
    return { key: "all", label: "Total filtrado", sortKey: "all" };
  }

  if (groupBy === "category") {
    const label = getCategoryName(tx, categoryMap);
    return { key: `category:${label}`, label, sortKey: label };
  }

  if (groupBy === "account") {
    const label = getAccountName(tx, accountMap);
    return { key: `account:${label}`, label, sortKey: label };
  }

  if (groupBy === "type") {
    const label = TYPE_LABELS[tx?.type] || "Otro";
    return { key: `type:${tx?.type || "other"}`, label, sortKey: label };
  }

  if (groupBy === "month") {
    const label = dateKey ? dateKey.slice(0, 7) : "Sin fecha";
    return { key: `month:${label}`, label, sortKey: label };
  }

  if (groupBy === "week") {
    const weekStart = dateKey ? startOfWeekDateKey(dateKey) : "Sin fecha";
    const label =
      weekStart === "Sin fecha" ? weekStart : `Semana ${weekStart}`;
    return { key: `week:${weekStart}`, label, sortKey: weekStart };
  }

  if (groupBy === "day") {
    const label = dateKey || "Sin fecha";
    return { key: `day:${label}`, label, sortKey: label };
  }

  if (groupBy === "recurrence") {
    const recurrence = tx?.recurrence || "";
    const label = recurrence
      ? RECURRENCE_LABELS[recurrence] || recurrence
      : "Unica";
    return { key: `recurrence:${recurrence || "one_time"}`, label, sortKey: label };
  }

  if (groupBy === "shopping") {
    const label = tx?.is_shopping_list ? "Lista de compras" : "Manual";
    return { key: `shopping:${label}`, label, sortKey: label };
  }

  return { key: "all", label: "Total filtrado", sortKey: "all" };
};

const signedAmount = (tx) => {
  const amount = Math.abs(safeAmount(tx?.amount));

  if (tx?.type === "income") return amount;
  if (tx?.type === "expense") return -amount;
  return 0;
};

const getMetricValue = (row, metric) => {
  if (metric === "count") return row.count;
  if (metric === "net") return row.net;
  if (metric === "income") return row.income;
  if (metric === "expense") return row.expense;
  if (metric === "average") return row.count > 0 ? row.total / row.count : 0;
  return row.total;
};

function getUniqueOptions(items, readId, readLabel) {
  const byId = new Map();

  for (const item of items || []) {
    const id = readId(item);
    if (!id) continue;

    byId.set(String(id), {
      value: String(id),
      label: readLabel(item) || "Sin nombre",
    });
  }

  return Array.from(byId.values()).sort((a, b) =>
    a.label.localeCompare(b.label, "es")
  );
}

function ReportTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      className="min-w-[220px] rounded-xl px-3 py-2 text-xs"
      style={{
        background: "color-mix(in srgb, var(--bg-3) 86%, transparent)",
        border: "1px solid var(--border-rgba)",
        color: "var(--text)",
        boxShadow: "0 18px 45px rgba(0,0,0,0.75)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="font-extrabold mb-2" style={{ color: "var(--heading)" }}>
        {row.label}
      </div>
      <div className="flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Valor</span>
        <span className="font-bold">{formatMetricValue(row.value, metric)}</span>
      </div>
      <div className="mt-1 flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Movimientos</span>
        <span className="font-bold">{row.count}</span>
      </div>
      <div className="mt-1 flex justify-between gap-4">
        <span style={{ color: "var(--success)" }}>Ingresos</span>
        <span className="font-bold">{formatCurrency(row.income)}</span>
      </div>
      <div className="mt-1 flex justify-between gap-4">
        <span style={{ color: "var(--danger)" }}>Gastos</span>
        <span className="font-bold">{formatCurrency(row.expense)}</span>
      </div>
      <div className="mt-1 flex justify-between gap-4">
        <span style={{ color: "var(--muted)" }}>Neto</span>
        <span
          className="font-bold"
          style={{ color: row.net >= 0 ? "var(--success)" : "var(--danger)" }}
        >
          {formatCurrency(row.net, true)}
        </span>
      </div>
    </div>
  );
}

function KpiTile({ label, value, tone = "neutral", metric = "total" }) {
  const toneColor =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
      ? "var(--warning)"
      : "var(--text)";

  return (
    <div
      className="rounded-2xl px-4 py-3"
      style={{
        background: "color-mix(in srgb, var(--panel) 72%, transparent)",
        border: "1px solid var(--border-rgba)",
      }}
    >
      <div
        className="text-[10px] font-bold uppercase tracking-[0.16em]"
        style={{ color: "var(--muted)" }}
      >
        {label}
      </div>
      <div className="mt-1 text-lg font-extrabold" style={{ color: toneColor }}>
        {metric === "count" ? value.toLocaleString("es-DO") : formatCurrency(value)}
      </div>
    </div>
  );
}

function ChartTypeButton({ option, selected, onClick }) {
  const Icon = option.icon;

  return (
    <button
      type="button"
      aria-pressed={selected}
      title={option.label}
      onClick={onClick}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold transition"
      style={{
        background: selected
          ? "color-mix(in srgb, var(--primary) 18%, var(--panel))"
          : "transparent",
        border: selected
          ? "1px solid color-mix(in srgb, var(--primary) 42%, var(--border-rgba))"
          : "1px solid transparent",
        color: selected ? "var(--text)" : "var(--muted)",
      }}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span>{option.label}</span>
    </button>
  );
}

function CustomReportBuilder({ token, categories = [], accounts = [] }) {
  const api = import.meta.env.VITE_API_URL;
  const defaultRange = useMemo(() => getDefaultRange(), []);

  const [transactions, setTransactions] = useState([]);
  const [rangePreset, setRangePreset] = useState("this_month");
  const [dateFrom, setDateFrom] = useState(defaultRange.from);
  const [dateTo, setDateTo] = useState(defaultRange.to);
  const [movementType, setMovementType] = useState("all");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [accountId, setAccountId] = useState("");
  const [metric, setMetric] = useState("total");
  const [groupBy, setGroupBy] = useState("category");
  const [chartType, setChartType] = useState("bar");
  const [sortMode, setSortMode] = useState("smart");
  const [topLimit, setTopLimit] = useState("10");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const activeRange = useMemo(
    () => getRangeDates(rangePreset, dateFrom, dateTo),
    [dateFrom, dateTo, rangePreset]
  );

  const buildRequestParams = useCallback(() => {
    const params = {};

    if (activeRange.from) params.date_from = activeRange.from;
    if (activeRange.to) params.date_to = activeRange.to;
    if (descriptionDraft.trim()) params.description = descriptionDraft.trim();
    if (movementType !== "all") params.type = movementType;
    if (categoryId) params.category_id = categoryId;
    if (accountId) params.account_id = accountId;

    return params;
  }, [accountId, activeRange, categoryId, descriptionDraft, movementType]);

  const fetchTransactions = useCallback(async (params = {}) => {
    if (!token) return;

    try {
      setLoading(true);
      setErrorMsg("");

      const res = await axios.get(
        `${api}/transactions`,
        withUserTimeZone({
          headers: { Authorization: `Bearer ${token}` },
          params,
        })
      );

      setTransactions(Array.isArray(res?.data?.data) ? res.data.data : []);
    } catch (err) {
      console.error("Error al cargar generador de reportes:", err);
      setErrorMsg("No se pudieron cargar las transacciones del reporte.");
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  useEffect(() => {
    fetchTransactions({
      date_from: defaultRange.from,
      date_to: defaultRange.to,
    });
  }, [defaultRange.from, defaultRange.to, fetchTransactions]);

  const applyCurrentFilters = useCallback(() => {
    fetchTransactions(buildRequestParams());
  }, [buildRequestParams, fetchTransactions]);

  const reportTransactions = useMemo(
    () => (transactions || []).filter((tx) => tx?.type !== "transfer"),
    [transactions]
  );

  const categoryOptions = useMemo(() => {
    const fromProps = getUniqueOptions(
      categories,
      (category) => category?.id,
      (category) => category?.name
    );
    const fromTx = getUniqueOptions(
      reportTransactions,
      (tx) => tx?.category_id || tx?.categories?.id,
      (tx) => tx?.categories?.name
    );
    const byId = new Map([...fromProps, ...fromTx].map((item) => [item.value, item]));

    return Array.from(byId.values()).sort((a, b) =>
      a.label.localeCompare(b.label, "es")
    );
  }, [categories, reportTransactions]);

  const accountOptions = useMemo(() => {
    const options = [];

    for (const account of accounts || []) {
      options.push({
        id: account?.id,
        name: account?.name || account?.accountName || account?.bankName,
      });
    }

    for (const tx of reportTransactions || []) {
      options.push(tx?.account);
    }

    return getUniqueOptions(
      options,
      (account) => account?.id,
      (account) => account?.name
    );
  }, [accounts, reportTransactions]);

  const categoryMap = useMemo(
    () => new Map(categoryOptions.map((option) => [option.value, option.label])),
    [categoryOptions]
  );

  const accountMap = useMemo(
    () => new Map(accountOptions.map((option) => [option.value, option.label])),
    [accountOptions]
  );

  const summary = useMemo(() => {
    return (reportTransactions || []).reduce(
      (acc, tx) => {
        const amount = Math.abs(safeAmount(tx?.amount));
        acc.count += 1;
        acc.total += amount;

        if (tx?.type === "income") acc.income += amount;
        if (tx?.type === "expense") acc.expense += amount;

        acc.net += signedAmount(tx);
        return acc;
      },
      {
        count: 0,
        total: 0,
        income: 0,
        expense: 0,
        net: 0,
      }
    );
  }, [reportTransactions]);

  const rows = useMemo(() => {
    const groups = new Map();

    for (const tx of reportTransactions || []) {
      const descriptor = getGroupDescriptor(tx, groupBy, categoryMap, accountMap);
      const amount = Math.abs(safeAmount(tx?.amount));

      if (!groups.has(descriptor.key)) {
        groups.set(descriptor.key, {
          key: descriptor.key,
          label: descriptor.label,
          sortKey: descriptor.sortKey,
          total: 0,
          income: 0,
          expense: 0,
          net: 0,
          count: 0,
        });
      }

      const row = groups.get(descriptor.key);
      row.total += amount;
      row.net += signedAmount(tx);
      row.count += 1;

      if (tx?.type === "income") row.income += amount;
      if (tx?.type === "expense") row.expense += amount;
    }

    return Array.from(groups.values()).map((row) => ({
      ...row,
      value: getMetricValue(row, metric),
    }));
  }, [accountMap, categoryMap, groupBy, metric, reportTransactions]);

  const chartRows = useMemo(() => {
    const next = [...rows];
    const mode =
      sortMode === "smart"
        ? isTemporalGroup(groupBy)
          ? "timeline"
          : "value_desc"
        : sortMode;

    next.sort((a, b) => {
      if (mode === "timeline") return String(a.sortKey).localeCompare(String(b.sortKey));
      if (mode === "name") return a.label.localeCompare(b.label, "es");
      if (mode === "value_asc") return a.value - b.value;
      return b.value - a.value;
    });

    if (topLimit === "all") return next;
    return next.slice(0, Number(topLimit) || 10);
  }, [groupBy, rows, sortMode, topLimit]);

  const pieRows = useMemo(
    () =>
      chartRows
        .map((row) => ({
          ...row,
          pieValue: Math.abs(row.value),
        }))
        .filter((row) => row.pieValue > 0),
    [chartRows]
  );

  const selectedMetric = METRIC_OPTIONS.find((item) => item.value === metric);
  const selectedGroup = GROUP_OPTIONS.find((item) => item.value === groupBy);
  const hasRows = chartRows.length > 0;
  const yAxisWidth = chartRows.some((row) => row.label.length > 22) ? 170 : 125;

  return (
    <div
      className="rounded-2xl p-4 sm:p-6 space-y-5"
      style={{
        background:
          "linear-gradient(135deg, var(--panel), color-mix(in srgb, var(--panel) 72%, transparent))",
        border: "var(--border-w) solid var(--border-rgba)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.65)",
        color: "var(--text)",
      }}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold" style={{ color: "var(--heading)" }}>
            Generador de reportes
          </h3>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] font-bold uppercase tracking-[0.12em]">
            <span
              className="rounded-full px-2.5 py-1"
              style={{
                background: "color-mix(in srgb, var(--primary) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--primary) 28%, var(--border-rgba))",
                color: "var(--text)",
              }}
            >
              {selectedMetric?.label || "Metrica"}
            </span>
            <span
              className="rounded-full px-2.5 py-1"
              style={{
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
                border: "1px solid var(--border-rgba)",
                color: "var(--muted)",
              }}
            >
              Por {selectedGroup?.label || "grupo"}
            </span>
          </div>
        </div>

        <div
          className="inline-flex flex-wrap items-center gap-1 rounded-2xl p-1"
          style={{
            background: "color-mix(in srgb, var(--panel) 68%, transparent)",
            border: "1px solid var(--border-rgba)",
          }}
        >
          {CHART_OPTIONS.map((option) => (
            <ChartTypeButton
              key={option.value}
              option={option}
              selected={chartType === option.value}
              onClick={() => setChartType(option.value)}
            />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <KpiTile label="Movimientos" value={summary.count} metric="count" />
        <KpiTile label="Ingresos" value={summary.income} tone="success" />
        <KpiTile label="Gastos" value={summary.expense} tone="danger" />
        <KpiTile
          label="Balance"
          value={summary.net}
          tone={summary.net >= 0 ? "success" : "danger"}
        />
      </div>

      <div
        className="rounded-2xl p-4"
        style={{
          background: "color-mix(in srgb, var(--panel) 62%, transparent)",
          border: "1px solid var(--border-rgba)",
        }}
      >
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="ff-label">Periodo</label>
            <FFSelect
              value={rangePreset}
              onChange={(value) => setRangePreset(String(value))}
              options={RANGE_OPTIONS}
              searchable={false}
              clearable={false}
              className="mt-1"
            />
          </div>

          <div>
            <label className="ff-label">Tipo</label>
            <FFSelect
              value={movementType}
              onChange={(value) => setMovementType(String(value))}
              options={TYPE_OPTIONS}
              searchable={false}
              clearable={false}
              className="mt-1"
            />
          </div>

          <div>
            <label className="ff-label">Descripcion</label>
            <input
              type="text"
              value={descriptionDraft}
              onChange={(event) => setDescriptionDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  applyCurrentFilters();
                }
              }}
              placeholder="Buscar por descripcion"
              className="ff-input mt-1"
            />
          </div>

          <div>
            <label className="ff-label">Categoria</label>
            <FFSelect
              value={categoryId}
              onChange={(value) => setCategoryId(String(value || ""))}
              options={categoryOptions}
              placeholder="Todas"
              className="mt-1"
            />
          </div>

          <div>
            <label className="ff-label">Cuenta</label>
            <FFSelect
              value={accountId}
              onChange={(value) => setAccountId(String(value || ""))}
              options={accountOptions}
              placeholder="Todas"
              className="mt-1"
            />
          </div>

          {rangePreset === "custom" ? (
            <>
              <div>
                <label className="ff-label">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(event) => setDateFrom(event.target.value)}
                  className="ff-input mt-1"
                />
              </div>

              <div>
                <label className="ff-label">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="ff-input mt-1"
                />
              </div>
            </>
          ) : null}

          <div>
            <label className="ff-label">Metrica</label>
            <FFSelect
              value={metric}
              onChange={(value) => setMetric(String(value))}
              options={METRIC_OPTIONS}
              searchable={false}
              clearable={false}
              className="mt-1"
            />
          </div>

          <div>
            <label className="ff-label">Agrupar por</label>
            <FFSelect
              value={groupBy}
              onChange={(value) => setGroupBy(String(value))}
              options={GROUP_OPTIONS}
              searchable={false}
              clearable={false}
              className="mt-1"
            />
          </div>

          <div>
            <label className="ff-label">Orden</label>
            <FFSelect
              value={sortMode}
              onChange={(value) => setSortMode(String(value))}
              options={SORT_OPTIONS}
              searchable={false}
              clearable={false}
              className="mt-1"
            />
          </div>

          <div>
            <label className="ff-label">Limite</label>
            <FFSelect
              value={topLimit}
              onChange={(value) => setTopLimit(String(value))}
              options={TOP_OPTIONS}
              searchable={false}
              clearable={false}
              className="mt-1"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs" style={{ color: "var(--muted)" }}>
            {activeRange.from || activeRange.to ? (
              <span>
                {activeRange.from || "Inicio"} a {activeRange.to || "hoy"}
              </span>
            ) : (
              <span>Historico completo</span>
            )}
            {loading ? <span className="ml-2">Actualizando...</span> : null}
          </div>

          <button
            type="button"
            onClick={applyCurrentFilters}
            disabled={loading || !token}
            className="ff-btn ff-btn-outline ff-btn-sm"
          >
            <HiRefresh className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            Actualizar
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div
          className="rounded-xl px-3 py-2 text-sm"
          style={{
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--danger) 35%, var(--border-rgba))",
            color: "var(--text)",
          }}
        >
          {errorMsg}
        </div>
      ) : null}

      {!loading && !hasRows ? (
        <div
          className="rounded-2xl px-4 py-8 text-center text-sm"
          style={{
            background: "color-mix(in srgb, var(--panel) 60%, transparent)",
            border: "1px dashed var(--border-rgba)",
            color: "var(--muted)",
          }}
        >
          No hay datos para los parametros seleccionados.
        </div>
      ) : null}

      {hasRows && chartType !== "table" ? (
        <div className="w-full h-[380px]">
          <ResponsiveContainer>
            {chartType === "bar" ? (
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 12, right: 18, left: 8, bottom: 12 }}
              >
                <CartesianGrid
                  stroke="color-mix(in srgb, var(--border-rgba) 65%, transparent)"
                  strokeDasharray="4 4"
                />
                <XAxis
                  type="number"
                  stroke="var(--muted)"
                  tick={{ fill: "var(--text)", fontSize: 12 }}
                  tickFormatter={(value) =>
                    metric === "count" ? formatCompact(value) : formatCompact(value)
                  }
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={yAxisWidth}
                  stroke="var(--muted)"
                  tick={{ fill: "var(--text)", fontSize: 12 }}
                />
                <ReferenceLine x={0} stroke="var(--border-rgba)" strokeDasharray="6 6" />
                <Tooltip content={<ReportTooltip metric={metric} />} />
                <Legend
                  formatter={() => (
                    <span style={{ color: "var(--text)" }}>
                      {selectedMetric?.label || "Valor"}
                    </span>
                  )}
                />
                <Bar dataKey="value" name={selectedMetric?.label || "Valor"} radius={[0, 7, 7, 0]}>
                  {chartRows.map((row, index) => (
                    <Cell
                      key={row.key}
                      fill={
                        row.value < 0
                          ? "var(--danger)"
                          : CHART_COLORS[index % CHART_COLORS.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            ) : chartType === "pie" ? (
              <PieChart>
                <Pie
                  data={pieRows}
                  dataKey="pieValue"
                  nameKey="label"
                  innerRadius="42%"
                  outerRadius="78%"
                  paddingAngle={2}
                  isAnimationActive={false}
                >
                  {pieRows.map((row, index) => (
                    <Cell
                      key={row.key}
                      fill={CHART_COLORS[index % CHART_COLORS.length]}
                    />
                  ))}
                </Pie>
                <Tooltip content={<ReportTooltip metric={metric} />} />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: "var(--text)" }}>{value}</span>
                  )}
                />
              </PieChart>
            ) : (
              <LineChart data={chartRows} margin={{ top: 12, right: 18, left: 0, bottom: 12 }}>
                <CartesianGrid
                  stroke="color-mix(in srgb, var(--border-rgba) 65%, transparent)"
                  strokeDasharray="4 4"
                />
                <XAxis
                  dataKey="label"
                  stroke="var(--muted)"
                  tick={{ fill: "var(--text)", fontSize: 12 }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  stroke="var(--muted)"
                  tick={{ fill: "var(--text)", fontSize: 12 }}
                  tickFormatter={formatCompact}
                />
                <ReferenceLine y={0} stroke="var(--border-rgba)" strokeDasharray="6 6" />
                <Tooltip content={<ReportTooltip metric={metric} />} />
                <Legend
                  formatter={() => (
                    <span style={{ color: "var(--text)" }}>
                      {selectedMetric?.label || "Valor"}
                    </span>
                  )}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={selectedMetric?.label || "Valor"}
                  stroke="var(--primary)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "var(--primary)", stroke: "var(--panel)" }}
                  activeDot={{ r: 5 }}
                  isAnimationActive={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      ) : null}

      {hasRows ? (
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            border: "1px solid var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 58%, transparent)",
          }}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr
                  style={{
                    background: "color-mix(in srgb, var(--panel) 78%, transparent)",
                    color: "var(--muted)",
                    borderBottom: "1px solid var(--border-rgba)",
                  }}
                >
                  <th className="px-4 py-3 text-left text-[11px] uppercase tracking-[0.14em]">
                    Grupo
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.14em]">
                    Valor
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.14em]">
                    Mov.
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.14em]">
                    Ingresos
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.14em]">
                    Gastos
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] uppercase tracking-[0.14em]">
                    Neto
                  </th>
                </tr>
              </thead>
              <tbody>
                {chartRows.map((row, index) => (
                  <tr
                    key={row.key}
                    style={{
                      borderBottom:
                        index === chartRows.length - 1
                          ? "0"
                          : "1px solid color-mix(in srgb, var(--border-rgba) 58%, transparent)",
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{
                            background: CHART_COLORS[index % CHART_COLORS.length],
                          }}
                        />
                        <span className="font-semibold" style={{ color: "var(--text)" }}>
                          {row.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold">
                      {formatMetricValue(row.value, metric)}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--muted)" }}>
                      {row.count.toLocaleString("es-DO")}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--success)" }}>
                      {formatCurrency(row.income)}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: "var(--danger)" }}>
                      {formatCurrency(row.expense)}
                    </td>
                    <td
                      className="px-4 py-3 text-right font-bold"
                      style={{ color: row.net >= 0 ? "var(--success)" : "var(--danger)" }}
                    >
                      {formatCurrency(row.net, true)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default CustomReportBuilder;
