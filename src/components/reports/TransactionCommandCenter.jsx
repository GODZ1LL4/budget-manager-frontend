import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
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
import {
  HiChartBar,
  HiExclamationCircle,
  HiRefresh,
  HiShieldCheck,
  HiTrendingDown,
  HiTrendingUp,
  HiX,
} from "react-icons/hi";
import FFSelect from "../FFSelect";
import { withUserTimeZone } from "../../lib/dates/localDate";

const MAX_SELECTED = 24;

const TYPE_CONFIG = {
  expense: {
    storageKey: "report:expense-command-center:params",
    eyebrow: "Expense command center",
    title: "Centro de comando de gastos",
    subtitle:
      "Control por categoria, presupuesto, ritmo del mes y variacion contra el mes anterior.",
    activeLabel: "Gasto del mes",
    totalLabel: "Gasto historico",
    goodDeltaIsPositive: false,
    currentTone: "danger",
    hotTitle: "Gastos en alerta",
    selectionTitle: "Cartera de gastos",
    selectionSubtitle: "Categorias seleccionadas para vigilar",
    chartTitle: "Curva mensual de gastos",
    chartSubtitle: "Mostrando hasta 6 categorias seleccionadas.",
    emptyText: "No hay gastos para los filtros actuales.",
    toastText: "No se pudo cargar el centro de comando de gastos.",
    filters: [
      { id: "all", label: "Todos" },
      { id: "rising", label: "Subiendo" },
      { id: "falling", label: "Bajando" },
      { id: "attention", label: "Alerta" },
      { id: "budget", label: "Presupuesto" },
      { id: "recurring", label: "Recurrentes" },
      { id: "selected", label: "Seleccionados" },
    ],
  },
  income: {
    storageKey: "report:income-command-center:params",
    eyebrow: "Income command center",
    title: "Centro de comando de ingresos",
    subtitle:
      "Monitorea categorias de ingreso, estabilidad, caidas y variacion contra el patron tipico.",
    activeLabel: "Ingreso del mes",
    totalLabel: "Ingreso historico",
    goodDeltaIsPositive: true,
    currentTone: "success",
    hotTitle: "Ingresos a vigilar",
    selectionTitle: "Cartera de ingresos",
    selectionSubtitle: "Fuentes seleccionadas para comparar",
    chartTitle: "Curva mensual de ingresos",
    chartSubtitle: "Mostrando hasta 6 categorias seleccionadas.",
    emptyText: "No hay ingresos para los filtros actuales.",
    toastText: "No se pudo cargar el centro de comando de ingresos.",
    filters: [
      { id: "all", label: "Todos" },
      { id: "rising", label: "Subiendo" },
      { id: "falling", label: "Cayendo" },
      { id: "attention", label: "Riesgo" },
      { id: "below", label: "Bajo tipico" },
      { id: "recurring", label: "Recurrentes" },
      { id: "selected", label: "Seleccionados" },
    ],
  },
};

const SORT_OPTIONS = [
  { value: "attention", label: "Atencion" },
  { value: "current", label: "Mes actual" },
  { value: "delta", label: "Variacion" },
  { value: "volatility", label: "Volatilidad" },
  { value: "name", label: "Nombre" },
];

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clampDraftNumber(value, min, max, fallback) {
  const number = Number(String(value ?? "").trim().replace(",", "."));
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function getInitialParams(type) {
  const config = TYPE_CONFIG[type] || TYPE_CONFIG.expense;
  const defaults = { months: "12", minDeltaPct: "10", sortMode: "attention" };

  if (typeof window === "undefined") return defaults;

  try {
    const raw = localStorage.getItem(config.storageKey);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);

    return {
      months: String(clampDraftNumber(parsed?.months, 2, 60, 12)),
      minDeltaPct: String(clampDraftNumber(parsed?.minDeltaPct, 0, 1000, 10)),
      sortMode: parsed?.sortMode || "attention",
    };
  } catch {
    return defaults;
  }
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(safeNumber(value));
}

function formatPercent(value, digits = 2) {
  if (value == null) return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(digits)}%`;
}

function formatDate(value) {
  if (!value) return "-";
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

function formatMonth(value) {
  if (!value) return "-";
  const [y, m] = String(value).split("-");
  if (!y || !m) return value;
  return `${m}/${y}`;
}

function stabilityLabel(value) {
  if (value === "fixed") return "Fijo";
  if (value === "variable") return "Variable";
  if (value === "occasional") return "Ocasional";
  return "Sin tipo";
}

function toneToken(tone) {
  switch (tone) {
    case "danger":
      return "var(--danger)";
    case "warning":
      return "var(--warning)";
    case "success":
      return "var(--success)";
    case "primary":
      return "var(--primary)";
    default:
      return "var(--text)";
  }
}

function getSignalMeta(type, row) {
  const signal = row?.signal;

  if (type === "expense") {
    if (signal === "sobre_presupuesto") {
      return { label: "Sobre presupuesto", tone: "danger", Icon: HiExclamationCircle };
    }
    if (signal === "ritmo_alto") {
      return { label: "Ritmo alto", tone: "warning", Icon: HiTrendingUp };
    }
    if (signal === "sobre_tipico") {
      return { label: "Sobre tipico", tone: "warning", Icon: HiChartBar };
    }
    if (signal === "subiendo") {
      return { label: "Subiendo", tone: "danger", Icon: HiTrendingUp };
    }
    if (signal === "bajando") {
      return { label: "Bajando", tone: "success", Icon: HiTrendingDown };
    }
  } else {
    if (signal === "caida") {
      return { label: "Caida", tone: "danger", Icon: HiTrendingDown };
    }
    if (signal === "por_debajo") {
      return { label: "Bajo tipico", tone: "warning", Icon: HiExclamationCircle };
    }
    if (signal === "subiendo") {
      return { label: "Subiendo", tone: "success", Icon: HiTrendingUp };
    }
    if (signal === "bajando") {
      return { label: "Bajando", tone: "warning", Icon: HiTrendingDown };
    }
    if (signal === "recurrente") {
      return { label: "Recurrente", tone: "success", Icon: HiShieldCheck };
    }
  }

  if (signal === "nuevo") {
    return { label: "Nuevo", tone: "primary", Icon: HiChartBar };
  }

  return { label: "Estable", tone: "success", Icon: HiShieldCheck };
}

function deltaColor(type, value) {
  const n = safeNumber(value);
  if (n === 0) return "var(--muted)";
  if (type === "income") return n > 0 ? "var(--success)" : "var(--danger)";
  return n > 0 ? "var(--danger)" : "var(--success)";
}

function StatCard({ title, value, detail, tone = "primary", Icon }) {
  const token = toneToken(tone);
  const DisplayIcon = Icon || HiChartBar;

  return (
    <div
      className="min-h-[112px] rounded-2xl border p-4"
      style={{
        borderColor: "color-mix(in srgb, var(--border-rgba) 82%, transparent)",
        background:
          "linear-gradient(135deg, color-mix(in srgb, var(--panel) 84%, transparent), color-mix(in srgb, var(--bg-2) 72%, transparent))",
        boxShadow: `0 18px 42px color-mix(in srgb, ${token} 10%, transparent)`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className="text-[11px] font-bold uppercase tracking-[0.14em]"
          style={{ color: "var(--muted)" }}
        >
          {title}
        </p>
        <DisplayIcon className="h-5 w-5 shrink-0" style={{ color: token }} />
      </div>

      <p
        className="mt-3 text-2xl font-extrabold leading-none tabular-nums"
        style={{ color: `color-mix(in srgb, ${token} 82%, var(--text))` }}
      >
        {value}
      </p>

      {detail ? (
        <p className="mt-2 text-xs leading-snug" style={{ color: "var(--muted)" }}>
          {detail}
        </p>
      ) : null}
    </div>
  );
}

function SignalBadge({ type, row }) {
  const meta = getSignalMeta(type, row);
  const token = toneToken(meta.tone);
  const Icon = meta.Icon;

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-bold"
      style={{
        color: `color-mix(in srgb, ${token} 88%, var(--text))`,
        borderColor: `color-mix(in srgb, ${token} 42%, var(--border-rgba))`,
        background: `color-mix(in srgb, ${token} 12%, transparent)`,
      }}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

function SegmentButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl px-3 py-2 text-xs font-bold transition"
      style={{
        border: active
          ? "1px solid color-mix(in srgb, var(--primary) 55%, var(--border-rgba))"
          : "1px solid transparent",
        background: active
          ? "color-mix(in srgb, var(--primary) 14%, transparent)"
          : "transparent",
        color: active ? "var(--text)" : "var(--muted)",
      }}
    >
      {children}
    </button>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;

  return (
    <div
      className="rounded-xl border px-3 py-2 text-xs shadow-xl"
      style={{
        background: "var(--panel)",
        borderColor: "var(--border-rgba)",
        color: "var(--text)",
      }}
    >
      <div className="mb-1 font-bold">{formatMonth(label)}</div>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.dataKey} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: entry.color }}
            />
            <span style={{ color: "var(--muted)" }}>{entry.name}</span>
            <strong>{formatMoney(entry.value)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailLine({ label, value, tone = "default" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <strong
        className="text-right tabular-nums"
        style={{ color: toneToken(tone) }}
      >
        {value}
      </strong>
    </div>
  );
}

export default function TransactionCommandCenter({ token, type = "expense" }) {
  const api = import.meta.env.VITE_API_URL;
  const reportType = type === "income" ? "income" : "expense";
  const config = TYPE_CONFIG[reportType];
  const initialParamsRef = useRef(getInitialParams(reportType));
  const autoSelectedRef = useRef(false);
  const requestParamsRef = useRef({
    months: initialParamsRef.current.months,
    minDeltaPct: initialParamsRef.current.minDeltaPct,
  });

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [months, setMonths] = useState(initialParamsRef.current.months);
  const [minDeltaPct, setMinDeltaPct] = useState(
    initialParamsRef.current.minDeltaPct
  );
  const [sortMode, setSortMode] = useState(initialParamsRef.current.sortMode);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    requestParamsRef.current = { months, minDeltaPct };
    localStorage.setItem(
      config.storageKey,
      JSON.stringify({ months, minDeltaPct, sortMode })
    );
  }, [config.storageKey, minDeltaPct, months, sortMode]);

  const runRequest = useCallback(
    async (requestParams) => {
      if (!token) return;

      const effectiveMonths = requestParams?.months ?? "12";
      const effectiveMinDeltaPct = requestParams?.minDeltaPct ?? "10";

      setLoading(true);
      setError("");

      try {
        const res = await axios.get(
          `${api}/analytics/transaction-command-center`,
          withUserTimeZone({
            headers: { Authorization: `Bearer ${token}` },
            params: {
              type: reportType,
              months: clampDraftNumber(effectiveMonths, 2, 60, 12),
              min_delta_pct: clampDraftNumber(
                effectiveMinDeltaPct,
                0,
                1000,
                10
              ),
              limit: 1000,
            },
          })
        );

        setRows(Array.isArray(res.data?.data) ? res.data.data : []);
        setSummary(res.data?.summary || null);
        setMeta(res.data?.meta || null);
      } catch (err) {
        console.error(`Error cargando command center ${reportType}:`, err);
        setRows([]);
        setSummary(null);
        setMeta(null);
        setError(config.toastText);
        toast.error(config.toastText);
      } finally {
        setLoading(false);
      }
    },
    [api, config.toastText, reportType, token]
  );

  const loadData = useCallback(() => {
    runRequest({ months, minDeltaPct });
  }, [minDeltaPct, months, runRequest]);

  useEffect(() => {
    runRequest(requestParamsRef.current);
  }, [runRequest]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedIds([]);
      setActiveId("");
      return;
    }

    const available = new Set(rows.map((row) => String(row.category_key)));

    setSelectedIds((prev) => {
      const kept = prev.filter((id) => available.has(String(id)));
      if (kept.length || autoSelectedRef.current) return kept;

      autoSelectedRef.current = true;
      return rows
        .filter((row) => safeNumber(row.current_month_amount) > 0)
        .slice(0, 5)
        .map((row) => String(row.category_key));
    });
  }, [rows]);

  const rowsById = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => map.set(String(row.category_key), row));
    return map;
  }, [rows]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedRows = useMemo(
    () => selectedIds.map((id) => rowsById.get(String(id))).filter(Boolean),
    [rowsById, selectedIds]
  );

  useEffect(() => {
    if (activeId && rowsById.has(String(activeId))) return;

    const nextId = selectedRows[0]?.category_key || rows[0]?.category_key || "";
    setActiveId(nextId ? String(nextId) : "");
  }, [activeId, rows, rowsById, selectedRows]);

  const activeRow = rowsById.get(String(activeId)) || selectedRows[0] || rows[0];

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const matchesSearch =
        !q ||
        String(row.category_name || "").toLowerCase().includes(q) ||
        String(row.last_description || "").toLowerCase().includes(q) ||
        String(stabilityLabel(row.stability_type)).toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filter === "rising") return safeNumber(row.delta_amount) > 0;
      if (filter === "falling") return safeNumber(row.delta_amount) < 0;
      if (filter === "attention") return safeNumber(row.attention_score) >= 45;
      if (filter === "recurring") {
        return safeNumber(row.active_months) >= Math.max(3, safeNumber(row.months_count) * 0.65);
      }
      if (filter === "budget") return safeNumber(row.over_budget_amount) > 0;
      if (filter === "below") return safeNumber(row.vs_typical_amount) < 0;
      if (filter === "selected") return selectedSet.has(String(row.category_key));
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "current") {
        return safeNumber(b.current_month_amount) - safeNumber(a.current_month_amount);
      }
      if (sortMode === "delta") {
        return Math.abs(safeNumber(b.delta_amount)) - Math.abs(safeNumber(a.delta_amount));
      }
      if (sortMode === "volatility") {
        return safeNumber(b.volatility_pct) - safeNumber(a.volatility_pct);
      }
      if (sortMode === "name") {
        return String(a.category_name || "").localeCompare(String(b.category_name || ""));
      }
      return safeNumber(b.attention_score) - safeNumber(a.attention_score);
    });
  }, [filter, rows, search, selectedSet, sortMode]);

  const selection = useMemo(() => {
    const current = selectedRows.reduce(
      (sum, row) => sum + safeNumber(row.current_month_amount),
      0
    );
    const previous = selectedRows.reduce(
      (sum, row) => sum + safeNumber(row.previous_month_amount),
      0
    );
    const typical = selectedRows.reduce(
      (sum, row) => sum + safeNumber(row.typical_monthly),
      0
    );
    const expected = selectedRows.reduce(
      (sum, row) => sum + safeNumber(row.expected_to_date),
      0
    );
    const budget = selectedRows.reduce(
      (sum, row) => sum + safeNumber(row.budget_limit),
      0
    );
    const overBudget = selectedRows.reduce(
      (sum, row) => sum + safeNumber(row.over_budget_amount),
      0
    );
    const delta = current - previous;
    const deltaPct = previous > 0 ? (delta / previous) * 100 : null;
    const vsTypical = current - typical;
    const vsTypicalPct = typical > 0 ? (vsTypical / typical) * 100 : null;

    return {
      count: selectedRows.length,
      current,
      previous,
      typical,
      expected,
      budget,
      overBudget,
      delta,
      deltaPct,
      vsTypical,
      vsTypicalPct,
    };
  }, [selectedRows]);

  const hotRows = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            safeNumber(row.attention_score) >= 45 ||
            ["sobre_presupuesto", "ritmo_alto", "caida", "por_debajo"].includes(
              row.signal
            )
        )
        .slice(0, 5),
    [rows]
  );

  const chartRows = useMemo(() => {
    const base = selectedRows.length ? selectedRows : activeRow ? [activeRow] : [];
    return base.slice(0, 6);
  }, [activeRow, selectedRows]);

  const chartData = useMemo(() => {
    const points = new Map();

    chartRows.forEach((row) => {
      (row.series || []).forEach((point) => {
        if (!points.has(point.month)) points.set(point.month, { month: point.month });
        points.get(point.month)[String(row.category_key)] = point.amount;
      });
    });

    return Array.from(points.values()).sort((a, b) =>
      String(a.month).localeCompare(String(b.month))
    );
  }, [chartRows]);

  const toggleSelected = (categoryKey) => {
    const id = String(categoryKey);
    if (!selectedSet.has(id) && selectedIds.length >= MAX_SELECTED) {
      toast.info(`Maximo ${MAX_SELECTED} categorias seleccionadas.`);
      return;
    }

    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const selectVisible = () => {
    const next = filteredRows.slice(0, MAX_SELECTED).map((row) => String(row.category_key));
    if (filteredRows.length > MAX_SELECTED) {
      toast.info(`Se seleccionaron los primeros ${MAX_SELECTED} resultados.`);
    }
    setSelectedIds(next);
  };

  const clearSelection = () => setSelectedIds([]);

  const panelStyle = {
    background:
      "linear-gradient(135deg, var(--bg-1), color-mix(in srgb, var(--panel) 58%, transparent), var(--bg-2))",
    border: "var(--border-w) solid var(--border-rgba)",
    borderRadius: "var(--radius-lg)",
    boxShadow: "0 18px 55px rgba(0,0,0,0.52)",
  };

  const tableShellStyle = {
    border: "var(--border-w) solid var(--border-rgba)",
    borderRadius: "var(--radius-lg)",
    background: "color-mix(in srgb, var(--panel) 64%, transparent)",
  };

  const thStyle = {
    background: "var(--panel)",
    color: "color-mix(in srgb, var(--text) 76%, transparent)",
    borderBottom: "1px solid var(--border-rgba)",
  };

  const gridStroke = "color-mix(in srgb, var(--border-rgba) 58%, transparent)";
  const axisStroke = "color-mix(in srgb, var(--text) 58%, transparent)";
  const tickFill = "color-mix(in srgb, var(--text) 78%, transparent)";
  const summaryDelta = safeNumber(summary?.delta_amount);
  const summaryPace = safeNumber(summary?.pace_pct);
  const attentionLabel =
    reportType === "expense"
      ? `${summary?.over_budget_categories ?? 0} sobre presupuesto`
      : `${summary?.falling_categories ?? 0} categorias cayendo`;

  return (
    <div className="space-y-5 rounded-2xl p-5 md:p-6" style={panelStyle}>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div
            className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em]"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              color: "var(--muted)",
            }}
          >
            <HiChartBar className="h-4 w-4" aria-hidden="true" />
            {config.eyebrow}
          </div>

          <h3 className="mt-3 text-2xl font-extrabold" style={{ color: "var(--text)" }}>
            {config.title}
          </h3>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
            {config.subtitle}
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-[150px_150px_160px_auto] xl:w-auto">
          <div>
            <label className="ff-label mb-1 block">Historial (meses)</label>
            <input
              value={months}
              onChange={(event) => setMonths(event.target.value)}
              inputMode="numeric"
              className="ff-input"
              placeholder="12"
            />
          </div>

          <div>
            <label className="ff-label mb-1 block">Umbral variacion %</label>
            <input
              value={minDeltaPct}
              onChange={(event) => setMinDeltaPct(event.target.value)}
              inputMode="decimal"
              className="ff-input"
              placeholder="10"
            />
          </div>

          <div>
            <label className="ff-label mb-1 block">Orden</label>
            <FFSelect
              value={sortMode}
              onChange={(value) => setSortMode(String(value))}
              options={SORT_OPTIONS}
              searchable={false}
              clearable={false}
              getOptionLabel={(option) => option.label}
              getOptionValue={(option) => option.value}
            />
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="ff-btn ff-btn-primary self-end"
          >
            <HiRefresh
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            {loading ? "Cargando" : "Actualizar"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-5">
        <StatCard
          title="Categorias analizadas"
          value={summary?.categories_analyzed ?? rows.length}
          detail={
            meta
              ? `${formatDate(meta.date_from)} - ${formatDate(meta.date_to)}`
              : "Historial cargado"
          }
          tone="primary"
          Icon={HiChartBar}
        />
        <StatCard
          title={config.activeLabel}
          value={formatMoney(summary?.current_month_amount)}
          detail={meta?.active_month ? `Mes ${formatMonth(meta.active_month)}` : "Mes actual"}
          tone={config.currentTone}
          Icon={reportType === "income" ? HiTrendingUp : HiTrendingDown}
        />
        <StatCard
          title="Vs mes anterior"
          value={formatMoney(summaryDelta)}
          detail={formatPercent(summary?.delta_pct)}
          tone={summaryDelta === 0 ? "primary" : summaryDelta > 0 === config.goodDeltaIsPositive ? "success" : "danger"}
          Icon={summaryDelta >= 0 ? HiTrendingUp : HiTrendingDown}
        />
        <StatCard
          title="Ritmo vs tipico"
          value={formatPercent(summary?.pace_pct, 0)}
          detail={`Tipico: ${formatMoney(summary?.typical_monthly)}`}
          tone={summaryPace > 115 ? "warning" : "success"}
          Icon={summaryPace > 115 ? HiExclamationCircle : HiShieldCheck}
        />
        <StatCard
          title={reportType === "expense" ? "Presupuesto" : "Atencion"}
          value={
            reportType === "expense"
              ? formatMoney(summary?.over_budget_total)
              : summary?.high_attention_categories ?? 0
          }
          detail={attentionLabel}
          tone={
            reportType === "expense"
              ? safeNumber(summary?.over_budget_total) > 0
                ? "danger"
                : "success"
              : safeNumber(summary?.high_attention_categories) > 0
              ? "warning"
              : "success"
          }
          Icon={HiExclamationCircle}
        />
      </div>

      {error ? (
        <div
          className="rounded-xl border px-4 py-3 text-sm"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 36%, var(--border-rgba))",
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            color: "var(--text)",
          }}
        >
          {error}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <label className="ff-label mb-1 block">Buscar</label>
              <div className="relative">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="ff-input pr-10"
                  placeholder="Categoria, descripcion o tipo..."
                />
                {search.trim() ? (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1"
                    style={{ color: "var(--muted)" }}
                    title="Limpiar"
                  >
                    <HiX className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {config.filters.map((item) => (
                <SegmentButton
                  key={item.id}
                  active={filter === item.id}
                  onClick={() => setFilter(item.id)}
                >
                  {item.label}
                </SegmentButton>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              {filteredRows.length} resultado(s). Seleccionados:{" "}
              <strong style={{ color: "var(--text)" }}>
                {selectedRows.length}/{MAX_SELECTED}
              </strong>
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectVisible}
                disabled={filteredRows.length === 0}
                className="ff-btn ff-btn-outline ff-btn-sm"
              >
                Seleccionar vista
              </button>
              <button
                type="button"
                onClick={clearSelection}
                disabled={selectedRows.length === 0}
                className="ff-btn ff-btn-ghost ff-btn-sm"
              >
                Limpiar seleccion
              </button>
            </div>
          </div>

          <div className="max-h-[620px] overflow-auto" style={tableShellStyle}>
            <table className="min-w-[1320px] w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky top-0 z-20 w-12 px-3 py-3 text-left" style={thStyle}>
                    Sel.
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-left" style={thStyle}>
                    Categoria
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Mes actual
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Mes ant.
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Delta
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Tipico
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Ritmo
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    {reportType === "expense" ? "Presupuesto" : "Estabilidad"}
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-center" style={thStyle}>
                    Movs
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>
                      Cargando senales...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>
                      {config.emptyText}
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => {
                    const id = String(row.category_key);
                    const selected = selectedSet.has(id);
                    const active = String(activeId) === id;
                    const delta = safeNumber(row.delta_amount);
                    const rowBorder =
                      "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)";

                    return (
                      <tr
                        key={id}
                        onClick={() => setActiveId(id)}
                        className="transition"
                        style={{
                          background: active
                            ? "color-mix(in srgb, var(--primary) 12%, transparent)"
                            : index % 2
                            ? "color-mix(in srgb, var(--panel) 40%, transparent)"
                            : "transparent",
                          cursor: "pointer",
                        }}
                      >
                        <td
                          className="px-3 py-3"
                          style={{ borderBottom: rowBorder }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(id)}
                            className="h-4 w-4 accent-[var(--primary)]"
                            aria-label={`Seleccionar ${row.category_name}`}
                          />
                        </td>
                        <td className="px-3 py-3" style={{ borderBottom: rowBorder }}>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold" style={{ color: "var(--text)" }}>
                                {row.category_name}
                              </span>
                              <SignalBadge type={reportType} row={row} />
                            </div>
                            <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                              {formatDate(row.last_date)} - {stabilityLabel(row.stability_type)}
                              {row.last_account_name ? ` - ${row.last_account_name}` : ""}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--text)", borderBottom: rowBorder }}>
                          {formatMoney(row.current_month_amount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--muted)", borderBottom: rowBorder }}>
                          {formatMoney(row.previous_month_amount)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: deltaColor(reportType, delta), borderBottom: rowBorder }}>
                          <div>{formatMoney(delta)}</div>
                          <div className="text-[11px]">{formatPercent(row.delta_pct)}</div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--text)", borderBottom: rowBorder }}>
                          <div>{formatMoney(row.typical_monthly)}</div>
                          <div className="text-[11px]" style={{ color: deltaColor(reportType, row.vs_typical_amount) }}>
                            {formatPercent(row.vs_typical_pct)}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--muted)", borderBottom: rowBorder }}>
                          <div>{formatPercent(row.pace_pct, 0)}</div>
                          <div className="text-[11px]">{formatMoney(row.expected_to_date)} esp.</div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--text)", borderBottom: rowBorder }}>
                          {reportType === "expense" ? (
                            row.budget_limit == null ? (
                              <span style={{ color: "var(--muted)" }}>Sin presupuesto</span>
                            ) : (
                              <>
                                <div>{formatPercent(row.budget_used_pct, 0)}</div>
                                <div
                                  className="text-[11px]"
                                  style={{
                                    color: safeNumber(row.over_budget_amount) > 0
                                      ? "var(--danger)"
                                      : "var(--muted)",
                                  }}
                                >
                                  {formatMoney(row.budget_remaining)}
                                </div>
                              </>
                            )
                          ) : (
                            <>
                              <div>{stabilityLabel(row.stability_type)}</div>
                              <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                                {row.active_months}/{row.months_count} meses
                              </div>
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums" style={{ color: "var(--text)", borderBottom: rowBorder }}>
                          {row.transaction_count}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: "var(--text)", borderBottom: rowBorder }}>
                          {safeNumber(row.attention_score).toFixed(1)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-4">
          <section
            className="rounded-2xl border p-4"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 72%, transparent)",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
                  {config.selectionTitle}
                </h4>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {config.selectionSubtitle}
                </p>
              </div>
              <SignalBadge
                type={reportType}
                row={{ signal: selection.delta > 0 ? "subiendo" : "estable" }}
              />
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <DetailLine label="Mes actual" value={formatMoney(selection.current)} tone={config.currentTone} />
              <DetailLine label="Mes anterior" value={formatMoney(selection.previous)} />
              <DetailLine
                label="Diferencia"
                value={`${formatMoney(selection.delta)} (${formatPercent(selection.deltaPct)})`}
                tone={selection.delta === 0 ? "default" : selection.delta > 0 === config.goodDeltaIsPositive ? "success" : "danger"}
              />
              <DetailLine label="Tipico mensual" value={formatMoney(selection.typical)} />
              <DetailLine
                label="Vs tipico"
                value={`${formatMoney(selection.vsTypical)} (${formatPercent(selection.vsTypicalPct)})`}
                tone={selection.vsTypical === 0 ? "default" : selection.vsTypical > 0 === config.goodDeltaIsPositive ? "success" : "warning"}
              />
              {reportType === "expense" ? (
                <>
                  <DetailLine label="Presupuesto" value={formatMoney(selection.budget)} />
                  <DetailLine
                    label="Exceso"
                    value={formatMoney(selection.overBudget)}
                    tone={selection.overBudget > 0 ? "danger" : "success"}
                  />
                </>
              ) : null}
            </div>

            <p className="mt-3 text-xs leading-snug" style={{ color: "var(--muted)" }}>
              Categorias: {selection.count}. Esperado a la fecha:{" "}
              {formatMoney(selection.expected)}.
            </p>
          </section>

          <section
            className="rounded-2xl border p-4"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 72%, transparent)",
            }}
          >
            <h4 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
              {config.hotTitle}
            </h4>
            <div className="mt-3 space-y-2">
              {hotRows.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Sin senales fuertes en el periodo.
                </p>
              ) : (
                hotRows.map((row) => (
                  <button
                    key={row.category_key}
                    type="button"
                    onClick={() => setActiveId(String(row.category_key))}
                    className="w-full rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5"
                    style={{
                      borderColor: "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--panel) 62%, transparent)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold" style={{ color: "var(--text)" }}>
                        {row.category_name}
                      </span>
                      <span className="shrink-0 text-xs font-bold" style={{ color: deltaColor(reportType, row.delta_amount) }}>
                        {formatPercent(row.delta_pct)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs" style={{ color: "var(--muted)" }}>
                      <span>{formatMoney(row.current_month_amount)}</span>
                      <span>Score {safeNumber(row.attention_score).toFixed(1)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section
            className="rounded-2xl border p-4"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 72%, transparent)",
            }}
          >
            <h4 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
              Ficha activa
            </h4>
            {activeRow ? (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong style={{ color: "var(--text)" }}>{activeRow.category_name}</strong>
                    <SignalBadge type={reportType} row={activeRow} />
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    {activeRow.active_months}/{activeRow.months_count} meses activos -{" "}
                    {activeRow.transaction_count} movimientos
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Prom. mov.</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--text)" }}>
                      {formatMoney(activeRow.avg_transaction)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Volatilidad</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--warning)" }}>
                      {formatPercent(activeRow.volatility_pct)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Maximo mes</span>
                    <div className="font-bold tabular-nums" style={{ color: toneToken(config.currentTone) }}>
                      {formatMoney(activeRow.high_month_amount)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Peso hist.</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--primary)" }}>
                      {formatPercent(activeRow.share_pct)}
                    </div>
                  </div>
                </div>
                {activeRow.last_description ? (
                  <p className="rounded-xl border px-3 py-2 text-xs" style={{ color: "var(--muted)", borderColor: "var(--border-rgba)" }}>
                    {activeRow.last_description}
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
                Selecciona una categoria para ver detalle.
              </p>
            )}
          </section>
        </aside>
      </div>

      <section
        className="rounded-2xl border p-4"
        style={{
          borderColor: "var(--border-rgba)",
          background: "color-mix(in srgb, var(--panel) 70%, transparent)",
        }}
      >
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h4 className="text-base font-extrabold" style={{ color: "var(--text)" }}>
              {config.chartTitle}
            </h4>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              {config.chartSubtitle}
            </p>
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Series: {chartRows.length}
          </span>
        </div>

        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
            Selecciona categorias con historial para ver la curva.
          </p>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />
                <XAxis
                  dataKey="month"
                  stroke={axisStroke}
                  tick={{ fill: tickFill, fontSize: 12 }}
                  tickFormatter={formatMonth}
                />
                <YAxis
                  stroke={axisStroke}
                  tick={{ fill: tickFill, fontSize: 12 }}
                  tickFormatter={(value) => formatMoney(value)}
                />
                <Tooltip content={<ChartTooltip />} />
                <Legend
                  wrapperStyle={{ color: tickFill }}
                  formatter={(value) => (
                    <span className="text-xs" style={{ color: tickFill }}>
                      {value}
                    </span>
                  )}
                />
                {chartRows.map((row, index) => {
                  const color =
                    index === 0
                      ? toneToken(config.currentTone)
                      : index === 1
                      ? "var(--warning)"
                      : index === 2
                      ? "var(--primary)"
                      : index === 3
                      ? "var(--success)"
                      : `hsl(${(index * 58) % 360} 72% 58%)`;

                  return (
                    <Line
                      key={row.category_key}
                      dataKey={String(row.category_key)}
                      name={row.category_name}
                      type="monotone"
                      stroke={color}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 3, fill: color, stroke: "var(--bg-1)" }}
                      activeDot={{ r: 6, stroke: "var(--text)", strokeWidth: 2 }}
                      isAnimationActive={false}
                    />
                  );
                })}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
