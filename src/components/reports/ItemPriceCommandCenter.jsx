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
  HiShoppingCart,
  HiTrendingDown,
  HiTrendingUp,
  HiX,
} from "react-icons/hi";
import FFSelect from "../FFSelect";
import { withUserTimeZone } from "../../lib/dates/localDate";

const STORAGE_KEY = "report:item-price-command-center:params";
const MAX_SELECTED = 40;

const SORT_OPTIONS = [
  { value: "risk", label: "Riesgo" },
  { value: "delta", label: "Subida reciente" },
  { value: "streak", label: "Racha" },
  { value: "name", label: "Nombre" },
];

const FILTERS = [
  { id: "all", label: "Todos" },
  { id: "rising", label: "Subiendo" },
  { id: "streak", label: "Racha 2+" },
  { id: "spike", label: "Spike" },
  { id: "discount", label: "Con desc." },
  { id: "falling", label: "Bajando" },
  { id: "selected", label: "Seleccionados" },
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

function getInitialParams() {
  if (typeof window === "undefined") {
    return { months: "18", minIncreasePct: "0", sortMode: "risk" };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { months: "18", minIncreasePct: "0", sortMode: "risk" };
    const parsed = JSON.parse(raw);

    return {
      months: String(clampDraftNumber(parsed?.months, 1, 60, 18)),
      minIncreasePct: String(
        clampDraftNumber(parsed?.minIncreasePct, 0, 1000, 0)
      ),
      sortMode: parsed?.sortMode || "risk",
    };
  } catch {
    return { months: "18", minIncreasePct: "0", sortMode: "risk" };
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

function formatPercent(value) {
  if (value == null) return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return "-";
  const sign = number > 0 ? "+" : "";
  return `${sign}${number.toFixed(2)}%`;
}

function formatQty(value) {
  const number = safeNumber(value);
  return number.toFixed(number % 1 === 0 ? 0 : 2);
}

function formatDate(value) {
  if (!value) return "-";
  const [y, m, d] = String(value).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
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

function getSignalMeta(row) {
  switch (row?.signal) {
    case "racha_alcista":
      return {
        label: `Racha ${row.consecutive_increase_streak || 0}x`,
        tone: "danger",
        Icon: HiTrendingUp,
      };
    case "salto_reciente":
      return { label: "Spike", tone: "warning", Icon: HiExclamationCircle };
    case "subiendo":
      return { label: "Subiendo", tone: "warning", Icon: HiTrendingUp };
    case "cediendo":
      return { label: "Bajando", tone: "success", Icon: HiTrendingDown };
    case "sin_comparativo":
      return { label: "Nuevo", tone: "primary", Icon: HiChartBar };
    default:
      return { label: "Estable", tone: "success", Icon: HiShieldCheck };
  }
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

function SignalBadge({ row }) {
  const meta = getSignalMeta(row);
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
      <div className="mb-1 font-bold">{formatDate(label)}</div>
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

export default function ItemPriceCommandCenter({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const initialParamsRef = useRef(getInitialParams());
  const autoSelectedRef = useRef(false);
  const requestParamsRef = useRef({
    months: initialParamsRef.current.months,
    minIncreasePct: initialParamsRef.current.minIncreasePct,
  });

  const [rows, setRows] = useState([]);
  const [shoppingLists, setShoppingLists] = useState([]);
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [months, setMonths] = useState(initialParamsRef.current.months);
  const [minIncreasePct, setMinIncreasePct] = useState(
    initialParamsRef.current.minIncreasePct
  );
  const [sortMode, setSortMode] = useState(initialParamsRef.current.sortMode);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeItemId, setActiveItemId] = useState("");
  const [selectedShoppingListId, setSelectedShoppingListId] = useState("");

  useEffect(() => {
    requestParamsRef.current = { months, minIncreasePct };
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ months, minIncreasePct, sortMode })
    );
  }, [months, minIncreasePct, sortMode]);

  const runRequest = useCallback(async (requestParams) => {
    if (!token) return;

    const effectiveMonths = requestParams?.months ?? "18";
    const effectiveMinIncreasePct = requestParams?.minIncreasePct ?? "0";

    setLoading(true);
    setError("");

    try {
      const res = await axios.get(
        `${api}/analytics/item-price-command-center`,
        withUserTimeZone({
          headers: { Authorization: `Bearer ${token}` },
          params: {
            months: clampDraftNumber(effectiveMonths, 1, 60, 18),
            min_increase_pct: clampDraftNumber(
              effectiveMinIncreasePct,
              0,
              1000,
              0
            ),
            limit: 1000,
          },
        })
      );

      setRows(Array.isArray(res.data?.data) ? res.data.data : []);
      setShoppingLists(
        Array.isArray(res.data?.shopping_lists) ? res.data.shopping_lists : []
      );
      setSummary(res.data?.summary || null);
      setMeta(res.data?.meta || null);
    } catch (err) {
      console.error("Error cargando centro de comando de articulos:", err);
      setRows([]);
      setShoppingLists([]);
      setSummary(null);
      setMeta(null);
      setError("No se pudo cargar el centro de comando de precios.");
      toast.error("No se pudo cargar el reporte de articulos.");
    } finally {
      setLoading(false);
    }
  }, [api, token]);

  const loadData = useCallback(() => {
    runRequest({ months, minIncreasePct });
  }, [minIncreasePct, months, runRequest]);

  useEffect(() => {
    runRequest(requestParamsRef.current);
  }, [runRequest]);

  useEffect(() => {
    if (!rows.length) {
      setSelectedIds([]);
      setActiveItemId("");
      setSelectedShoppingListId("");
      return;
    }

    const available = new Set(rows.map((row) => String(row.item_id)));

    setSelectedIds((prev) => {
      const kept = prev.filter((id) => available.has(String(id)));
      if (kept.length || autoSelectedRef.current) return kept;

      autoSelectedRef.current = true;
      return rows
        .filter((row) => row.previous_unit_price != null)
        .slice(0, 5)
        .map((row) => String(row.item_id));
    });
  }, [rows]);

  useEffect(() => {
    if (!selectedShoppingListId) return;
    const exists = shoppingLists.some(
      (shoppingList) => String(shoppingList.id) === String(selectedShoppingListId)
    );
    if (!exists) setSelectedShoppingListId("");
  }, [selectedShoppingListId, shoppingLists]);

  const rowsById = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => map.set(String(row.item_id), row));
    return map;
  }, [rows]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const selectedRows = useMemo(
    () => selectedIds.map((id) => rowsById.get(String(id))).filter(Boolean),
    [rowsById, selectedIds]
  );

  const shoppingListOptions = useMemo(
    () =>
      shoppingLists.map((shoppingList) => ({
        ...shoppingList,
        label: `${formatDate(shoppingList.date)} - ${
          shoppingList.description || "Lista de compra"
        }`,
        subLabel: `${shoppingList.item_count || 0} articulo(s) - ${formatMoney(
          shoppingList.amount
        )}`,
      })),
    [shoppingLists]
  );

  const selectedShoppingList = useMemo(
    () =>
      shoppingLists.find(
        (shoppingList) =>
          String(shoppingList.id) === String(selectedShoppingListId)
      ) || null,
    [selectedShoppingListId, shoppingLists]
  );

  const selectedShoppingListLinesById = useMemo(() => {
    const map = new Map();
    (selectedShoppingList?.lines || []).forEach((line) => {
      if (line?.item_id) map.set(String(line.item_id), line);
    });
    return map;
  }, [selectedShoppingList]);

  useEffect(() => {
    if (activeItemId && rowsById.has(String(activeItemId))) return;

    const nextId = selectedRows[0]?.item_id || rows[0]?.item_id || "";
    setActiveItemId(nextId ? String(nextId) : "");
  }, [activeItemId, rows, rowsById, selectedRows]);

  const activeItem = rowsById.get(String(activeItemId)) || selectedRows[0] || rows[0];

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    const filtered = rows.filter((row) => {
      const matchesSearch =
        !q ||
        String(row.item_name || "").toLowerCase().includes(q) ||
        String(row.last_category_name || "").toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (filter === "rising") return safeNumber(row.latest_delta_amount) > 0;
      if (filter === "streak") {
        return safeNumber(row.consecutive_increase_streak) >= 2;
      }
      if (filter === "spike") {
        return safeNumber(row.latest_delta_pct) >= 10 || row.latest_is_high;
      }
      if (filter === "discount") return safeNumber(row.latest_discount_amount) > 0;
      if (filter === "falling") return safeNumber(row.latest_delta_amount) < 0;
      if (filter === "selected") return selectedSet.has(String(row.item_id));
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "delta") {
        return safeNumber(b.latest_delta_pct, -9999) - safeNumber(a.latest_delta_pct, -9999);
      }
      if (sortMode === "streak") {
        return (
          safeNumber(b.consecutive_increase_streak) -
          safeNumber(a.consecutive_increase_streak)
        );
      }
      if (sortMode === "name") {
        return String(a.item_name || "").localeCompare(String(b.item_name || ""));
      }
      return safeNumber(b.risk_score) - safeNumber(a.risk_score);
    });
  }, [filter, rows, search, selectedSet, sortMode]);

  const basket = useMemo(() => {
    const hasShoppingListContext = !!selectedShoppingList;
    const lines = selectedRows.map((row) => {
      const shoppingLine = hasShoppingListContext
        ? selectedShoppingListLinesById.get(String(row.item_id))
        : null;
      const quantity = shoppingLine
        ? safeNumber(shoppingLine.quantity)
        : safeNumber(row.latest_quantity);
      const selectedBaseCost = shoppingLine
        ? safeNumber(shoppingLine.base_amount)
        : safeNumber(row.latest_base_cost, row.latest_cost);
      const selectedPaidCost = shoppingLine
        ? safeNumber(shoppingLine.paid_amount)
        : safeNumber(row.latest_cost);
      const selectedDiscount = shoppingLine
        ? safeNumber(shoppingLine.discount_amount)
        : safeNumber(row.latest_discount_amount);
      const latestBaseCost = safeNumber(row.latest_unit_price) * quantity;
      const latestPaidCost =
        safeNumber(row.latest_paid_unit_price ?? row.latest_unit_price) *
        quantity;
      const previousBaseCost =
        row.previous_unit_price == null
          ? null
          : safeNumber(row.previous_unit_price) * quantity;

      return {
        row,
        quantity,
        selectedBaseCost,
        selectedPaidCost,
        selectedDiscount,
        latestBaseCost,
        latestPaidCost,
        previousBaseCost,
      };
    });

    const comparable = lines.filter((line) => line.previousBaseCost != null);
    const totalPaidLatest = lines.reduce(
      (sum, line) => sum + line.latestPaidCost,
      0
    );
    const totalBaseLatest = lines.reduce(
      (sum, line) => sum + line.latestBaseCost,
      0
    );
    const totalDiscount = lines.reduce(
      (sum, line) => sum + line.selectedDiscount,
      0
    );
    const selectedPaidTotal = lines.reduce(
      (sum, line) => sum + line.selectedPaidCost,
      0
    );
    const selectedBaseTotal = lines.reduce(
      (sum, line) => sum + line.selectedBaseCost,
      0
    );
    const paidComparable = comparable.reduce(
      (sum, line) => sum + line.latestPaidCost,
      0
    );
    const baseComparable = comparable.reduce(
      (sum, line) => sum + line.latestBaseCost,
      0
    );
    const previousComparable = comparable.reduce(
      (sum, line) => sum + safeNumber(line.previousBaseCost),
      0
    );
    const selectedPaidComparable = comparable.reduce(
      (sum, line) => sum + line.selectedPaidCost,
      0
    );
    const selectedBaseComparable = comparable.reduce(
      (sum, line) => sum + line.selectedBaseCost,
      0
    );
    const delta = hasShoppingListContext
      ? totalBaseLatest - selectedBaseTotal
      : baseComparable - previousComparable;
    const paidDelta = hasShoppingListContext
      ? totalPaidLatest - selectedPaidTotal
      : paidComparable - previousComparable;
    const previousDelta = selectedBaseComparable - previousComparable;
    const previousPaidDelta = selectedPaidComparable - previousComparable;
    const deltaBase = hasShoppingListContext
      ? selectedBaseTotal
      : previousComparable;
    const paidDeltaBase = hasShoppingListContext
      ? selectedPaidTotal
      : previousComparable;
    const previousDeltaPct =
      previousComparable > 0 ? (previousDelta / previousComparable) * 100 : null;
    const previousPaidDeltaPct =
      previousComparable > 0
        ? (previousPaidDelta / previousComparable) * 100
        : null;
    const deltaPct = deltaBase > 0 ? (delta / deltaBase) * 100 : null;
    const paidDeltaPct =
      paidDeltaBase > 0 ? (paidDelta / paidDeltaBase) * 100 : null;
    const discountPct =
      selectedBaseTotal > 0 ? (totalDiscount / selectedBaseTotal) * 100 : null;

    return {
      hasShoppingListContext,
      count: selectedRows.length,
      comparableCount: comparable.length,
      missingCount: selectedRows.length - comparable.length,
      totalPaidLatest,
      totalBaseLatest,
      totalDiscount,
      selectedPaidTotal,
      selectedBaseTotal,
      paidComparable,
      baseComparable,
      previousComparable,
      delta,
      deltaPct,
      paidDelta,
      paidDeltaPct,
      previousDelta,
      previousDeltaPct,
      previousPaidDelta,
      previousPaidDeltaPct,
      discountPct,
    };
  }, [selectedRows, selectedShoppingList, selectedShoppingListLinesById]);

  const hottestRows = useMemo(
    () =>
      rows
        .filter(
          (row) =>
            safeNumber(row.consecutive_increase_streak) >= 2 ||
            safeNumber(row.latest_delta_amount) > 0
        )
        .slice(0, 5),
    [rows]
  );

  const chartItems = useMemo(() => {
    const base = selectedRows.length ? selectedRows : activeItem ? [activeItem] : [];
    return base.slice(0, 6);
  }, [activeItem, selectedRows]);

  const chartData = useMemo(() => {
    const points = new Map();

    chartItems.forEach((row) => {
      (row.series || []).forEach((point) => {
        if (!points.has(point.date)) points.set(point.date, { date: point.date });
        points.get(point.date)[String(row.item_id)] = point.unit_price;
      });
    });

    return Array.from(points.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date))
    );
  }, [chartItems]);

  const toggleSelected = (itemId) => {
    const id = String(itemId);
    if (!selectedSet.has(id) && selectedIds.length >= MAX_SELECTED) {
      toast.info(`Maximo ${MAX_SELECTED} articulos seleccionados.`);
      return;
    }

    setSelectedShoppingListId("");
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  };

  const selectShoppingList = (value, option) => {
    const shoppingList =
      option ||
      shoppingLists.find((list) => String(list.id) === String(value || ""));

    setSelectedShoppingListId(value ? String(value) : "");

    if (!shoppingList) return;

    const itemIds = Array.from(
      new Set((shoppingList.item_ids || []).map((itemId) => String(itemId)))
    );
    const availableIds = itemIds.filter((itemId) => rowsById.has(itemId));

    if (availableIds.length === 0) {
      toast.info("Los articulos de esa lista no estan en la tabla actual.");
      return;
    }

    const nextIds = availableIds.slice(0, MAX_SELECTED);
    setSelectedIds(nextIds);
    setActiveItemId(nextIds[0] || "");
    setSearch("");
    setFilter("selected");

    if (availableIds.length > MAX_SELECTED) {
      toast.info(`Se seleccionaron los primeros ${MAX_SELECTED} articulos.`);
    } else if (availableIds.length < itemIds.length) {
      toast.info(
        `${itemIds.length - availableIds.length} articulo(s) no estan en la tabla actual.`
      );
    }
  };

  const selectVisible = () => {
    const next = filteredRows.slice(0, MAX_SELECTED).map((row) => String(row.item_id));
    if (filteredRows.length > MAX_SELECTED) {
      toast.info(`Se seleccionaron los primeros ${MAX_SELECTED} resultados.`);
    }
    setSelectedShoppingListId("");
    setSelectedIds(next);
  };

  const clearSelection = () => {
    setSelectedShoppingListId("");
    setSelectedIds([]);
  };

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
            Price command center
          </div>

          <h3 className="mt-3 text-2xl font-extrabold" style={{ color: "var(--text)" }}>
            Centro de comando de articulos
          </h3>
          <p className="mt-1 max-w-3xl text-sm" style={{ color: "var(--muted)" }}>
            Monitor de precios, rachas alcistas y costo comparativo por articulo.
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
              placeholder="18"
            />
          </div>

          <div>
            <label className="ff-label mb-1 block">Umbral subida %</label>
            <input
              value={minIncreasePct}
              onChange={(event) => setMinIncreasePct(event.target.value)}
              inputMode="decimal"
              className="ff-input"
              placeholder="0"
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
          title="Articulos analizados"
          value={summary?.items_analyzed ?? rows.length}
          detail={
            meta
              ? `${formatDate(meta.date_from)} - ${formatDate(meta.date_to)}`
              : "Historial cargado"
          }
          tone="primary"
          Icon={HiChartBar}
        />
        <StatCard
          title="Subiendo ahora"
          value={summary?.rising_items ?? 0}
          detail={`${formatPercent(summary?.market_heat_pct)} de articulos comparables`}
          tone="warning"
          Icon={HiTrendingUp}
        />
        <StatCard
          title="Rachas 2+"
          value={summary?.consecutive_risers ?? 0}
          detail="Articulos con mas de una subida seguida"
          tone={(summary?.consecutive_risers ?? 0) > 0 ? "danger" : "success"}
          Icon={HiExclamationCircle}
        />
        <StatCard
          title="Presion base vs anterior"
          value={formatMoney(summary?.extra_cost_vs_previous_total)}
          detail="Subida real sin esconder descuentos"
          tone={safeNumber(summary?.extra_cost_vs_previous_total) > 0 ? "danger" : "success"}
          Icon={safeNumber(summary?.extra_cost_vs_previous_total) > 0 ? HiTrendingUp : HiTrendingDown}
        />
        <StatCard
          title="Descuento detectado"
          value={formatMoney(summary?.latest_discount_total)}
          detail={`${summary?.discounted_items ?? 0} articulo(s) con descuento en la ultima compra`}
          tone={safeNumber(summary?.latest_discount_total) > 0 ? "success" : "primary"}
          Icon={HiShieldCheck}
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
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(280px,430px)]">
              <div className="min-w-0">
                <label className="ff-label mb-1 block">Buscar</label>
                <div className="relative">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    className="ff-input pr-10"
                    placeholder="Articulo o categoria..."
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

              <div className="min-w-0">
                <label className="ff-label mb-1 flex items-center gap-1">
                  <HiShoppingCart className="h-4 w-4" aria-hidden="true" />
                  Lista de compra
                </label>
                <FFSelect
                  value={selectedShoppingListId}
                  onChange={selectShoppingList}
                  options={shoppingListOptions}
                  placeholder={
                    shoppingListOptions.length
                      ? "Elige una lista..."
                      : "Sin listas en el rango"
                  }
                  disabled={loading || shoppingListOptions.length === 0}
                  clearable
                  maxVisible={60}
                  getOptionLabel={(option) => option.label}
                  getOptionValue={(option) => option.id}
                  renderOption={(option) => (
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-bold">{option.label}</span>
                      <span
                        className="mt-0.5 truncate text-[11px]"
                        style={{ color: "var(--select-muted)" }}
                      >
                        {option.subLabel}
                      </span>
                    </div>
                  )}
                />
                <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                  {selectedShoppingList
                    ? `${selectedShoppingList.item_count || 0} articulo(s), ${
                        selectedShoppingList.line_count || 0
                      } linea(s)`
                    : `${shoppingListOptions.length} lista(s) en el rango`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 lg:justify-end">
              {FILTERS.map((item) => (
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
            <table
              className={`${
                basket.hasShoppingListContext ? "min-w-[1560px]" : "min-w-[1420px]"
              } w-full border-separate border-spacing-0 text-sm`}
            >
              <thead>
                <tr>
                  <th className="sticky top-0 z-20 w-12 px-3 py-3 text-left" style={thStyle}>
                    Sel.
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-left" style={thStyle}>
                    Articulo
                  </th>
                  {basket.hasShoppingListContext ? (
                    <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                      En lista
                    </th>
                  ) : null}
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Base
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Pagado
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Desc.
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Anterior
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Delta
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-center" style={thStyle}>
                    Racha
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Costo ult.
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Con precio ant.
                  </th>
                  <th className="sticky top-0 z-20 px-3 py-3 text-right" style={thStyle}>
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading && rows.length === 0 ? (
                  <tr>
                    <td colSpan={basket.hasShoppingListContext ? 12 : 11} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>
                      Cargando senales de precios...
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={basket.hasShoppingListContext ? 12 : 11} className="px-4 py-8 text-center" style={{ color: "var(--muted)" }}>
                      No hay articulos para los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row, index) => {
                    const id = String(row.item_id);
                    const selected = selectedSet.has(id);
                    const active = String(activeItemId) === id;
                    const delta = safeNumber(row.latest_delta_amount);
                    const discount = safeNumber(row.latest_discount_amount);
                    const shoppingLine = basket.hasShoppingListContext
                      ? selectedShoppingListLinesById.get(id)
                      : null;
                    const deltaTone =
                      delta > 0 ? "var(--danger)" : delta < 0 ? "var(--success)" : "var(--muted)";

                    return (
                      <tr
                        key={id}
                        onClick={() => setActiveItemId(id)}
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
                          style={{
                            borderBottom:
                              "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)",
                          }}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelected(id)}
                            className="h-4 w-4 accent-[var(--primary)]"
                            aria-label={`Seleccionar ${row.item_name}`}
                          />
                        </td>
                        <td
                          className="px-3 py-3"
                          style={{
                            borderBottom:
                              "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)",
                          }}
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold" style={{ color: "var(--text)" }}>
                                {row.item_name}
                              </span>
                              <SignalBadge row={row} />
                            </div>
                            <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                              {formatDate(row.last_date)} - qty {formatQty(row.latest_quantity)}
                              {row.last_category_name ? ` - ${row.last_category_name}` : ""}
                            </div>
                          </div>
                        </td>
                        {basket.hasShoppingListContext ? (
                          <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--text)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                            {shoppingLine ? (
                              <>
                                <div>{formatMoney(shoppingLine.paid_amount)}</div>
                                <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                                  Qty {formatQty(shoppingLine.quantity)} - Base{" "}
                                  {formatMoney(shoppingLine.base_amount)}
                                </div>
                              </>
                            ) : (
                              "-"
                            )}
                          </td>
                        ) : null}
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--text)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          {formatMoney(row.latest_unit_price)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: discount > 0 ? "var(--success)" : "var(--muted)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          {formatMoney(row.latest_paid_unit_price ?? row.latest_unit_price)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: discount > 0 ? "var(--success)" : "var(--muted)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          <div>{discount > 0 ? formatMoney(discount) : "-"}</div>
                          {discount > 0 ? (
                            <div className="text-[11px]">
                              {formatPercent(-safeNumber(row.latest_discount_pct))}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--muted)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          {row.previous_unit_price == null ? "-" : formatMoney(row.previous_unit_price)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: deltaTone, borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          <div>{row.latest_delta_amount == null ? "-" : formatMoney(row.latest_delta_amount)}</div>
                          <div className="text-[11px]">{formatPercent(row.latest_delta_pct)}</div>
                        </td>
                        <td className="px-3 py-3 text-center tabular-nums" style={{ color: "var(--text)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          {row.consecutive_increase_streak || 0} / {row.max_consecutive_increase_streak || 0}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--text)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          <div>{formatMoney(row.latest_cost)}</div>
                          <div className="text-[11px]" style={{ color: "var(--muted)" }}>
                            Base {formatMoney(row.latest_base_cost ?? row.latest_cost)}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums" style={{ color: "var(--muted)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          {row.previous_cost_for_latest_qty == null
                            ? "-"
                            : formatMoney(row.previous_cost_for_latest_qty)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-bold" style={{ color: "var(--text)", borderBottom: "1px solid color-mix(in srgb, var(--border-rgba) 56%, transparent)" }}>
                          {safeNumber(row.risk_score).toFixed(1)}
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
                  {basket.hasShoppingListContext
                    ? "Comparativo de lista"
                    : "Cesta seleccionada"}
                </h4>
                <p className="text-xs" style={{ color: "var(--muted)" }}>
                  {basket.hasShoppingListContext
                    ? `${formatDate(selectedShoppingList?.date)} - ${
                        selectedShoppingList?.description || "Lista de compra"
                      }`
                    : "Ultima cantidad comprada por articulo"}
                </p>
              </div>
              <SignalBadge row={{ signal: basket.delta > 0 ? "subiendo" : "estable" }} />
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--muted)" }}>
                  {basket.hasShoppingListContext ? "Base lista" : "Base ultima vez"}
                </span>
                <strong className="tabular-nums" style={{ color: "var(--text)" }}>
                  {formatMoney(
                    basket.hasShoppingListContext
                      ? basket.selectedBaseTotal
                      : basket.totalBaseLatest
                  )}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--muted)" }}>
                  {basket.hasShoppingListContext ? "Pagado lista" : "Pagado ultima vez"}
                </span>
                <strong className="tabular-nums" style={{ color: "var(--text)" }}>
                  {formatMoney(
                    basket.hasShoppingListContext
                      ? basket.selectedPaidTotal
                      : basket.totalPaidLatest
                  )}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--muted)" }}>
                  {basket.hasShoppingListContext ? "Descuento lista" : "Descuento aplicado"}
                </span>
                <strong className="tabular-nums" style={{ color: "var(--success)" }}>
                  {formatMoney(basket.totalDiscount)} (
                  {basket.discountPct == null ? "-" : formatPercent(-basket.discountPct)}
                  )
                </strong>
              </div>
              {basket.hasShoppingListContext ? (
                <>
                  <div
                    className="border-t pt-3"
                    style={{ borderColor: "var(--border-rgba)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span style={{ color: "var(--muted)" }}>A precio ultimo base</span>
                      <strong className="tabular-nums" style={{ color: "var(--text)" }}>
                        {formatMoney(basket.totalBaseLatest)}
                      </strong>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                      <span style={{ color: "var(--muted)" }}>A precio ultimo pagado</span>
                      <strong className="tabular-nums" style={{ color: "var(--text)" }}>
                        {formatMoney(basket.totalPaidLatest)}
                      </strong>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span style={{ color: "var(--muted)" }}>Ultimo base vs lista</span>
                    <strong
                      className="tabular-nums"
                      style={{
                        color: basket.delta > 0 ? "var(--danger)" : "var(--success)",
                      }}
                    >
                      {formatMoney(basket.delta)} ({formatPercent(basket.deltaPct)})
                    </strong>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span style={{ color: "var(--muted)" }}>Ultimo pagado vs lista</span>
                    <strong
                      className="tabular-nums"
                      style={{
                        color: basket.paidDelta > 0 ? "var(--danger)" : "var(--success)",
                      }}
                    >
                      {formatMoney(basket.paidDelta)} ({formatPercent(basket.paidDeltaPct)})
                    </strong>
                  </div>
                </>
              ) : null}
              <div className="flex items-center justify-between gap-3">
                <span style={{ color: "var(--muted)" }}>
                  {basket.hasShoppingListContext ? "A precio anterior" : "Con precio anterior"}
                </span>
                <strong className="tabular-nums" style={{ color: "var(--text)" }}>
                  {formatMoney(basket.previousComparable)}
                </strong>
              </div>
              <div
                className="flex items-center justify-between gap-3 border-t pt-3"
                style={{ borderColor: "var(--border-rgba)" }}
              >
                <span style={{ color: "var(--muted)" }}>
                  {basket.hasShoppingListContext
                    ? "Lista base vs anterior"
                    : "Presion base"}
                </span>
                <strong
                  className="tabular-nums"
                  style={{
                    color: (basket.hasShoppingListContext
                      ? basket.previousDelta
                      : basket.delta) > 0 ? "var(--danger)" : "var(--success)",
                  }}
                >
                  {basket.hasShoppingListContext
                    ? `${formatMoney(basket.previousDelta)} (${formatPercent(
                        basket.previousDeltaPct
                      )})`
                    : `${formatMoney(basket.delta)} (${formatPercent(
                        basket.deltaPct
                      )})`}
                </strong>
              </div>
              <div className="flex items-center justify-between gap-3 text-xs">
                <span style={{ color: "var(--muted)" }}>
                  {basket.hasShoppingListContext
                    ? "Lista pagada vs anterior"
                    : "Diferencia pagada"}
                </span>
                <strong
                  className="tabular-nums"
                  style={{
                    color: (basket.hasShoppingListContext
                      ? basket.previousPaidDelta
                      : basket.paidDelta) > 0 ? "var(--danger)" : "var(--success)",
                  }}
                >
                  {basket.hasShoppingListContext
                    ? `${formatMoney(basket.previousPaidDelta)} (${formatPercent(
                        basket.previousPaidDeltaPct
                      )})`
                    : `${formatMoney(basket.paidDelta)} (${formatPercent(
                        basket.paidDeltaPct
                      )})`}
                </strong>
              </div>
            </div>

            <p className="mt-3 text-xs leading-snug" style={{ color: "var(--muted)" }}>
              Comparables: {basket.comparableCount}/{basket.count}
              {basket.missingCount ? ` - sin precio anterior: ${basket.missingCount}` : ""}
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
              Senales calientes
            </h4>
            <div className="mt-3 space-y-2">
              {hottestRows.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--muted)" }}>
                  Sin subidas relevantes en el periodo.
                </p>
              ) : (
                hottestRows.map((row) => (
                  <button
                    key={row.item_id}
                    type="button"
                    onClick={() => setActiveItemId(String(row.item_id))}
                    className="w-full rounded-xl border px-3 py-2 text-left transition hover:-translate-y-0.5"
                    style={{
                      borderColor: "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--panel) 62%, transparent)",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-bold" style={{ color: "var(--text)" }}>
                        {row.item_name}
                      </span>
                      <span className="shrink-0 text-xs font-bold" style={{ color: "var(--danger)" }}>
                        {formatPercent(row.latest_delta_pct)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs" style={{ color: "var(--muted)" }}>
                      <span>Racha {row.consecutive_increase_streak || 0}x</span>
                      <span>Base {formatMoney(row.latest_unit_price)}</span>
                    </div>
                    {safeNumber(row.latest_discount_amount) > 0 ? (
                      <div className="mt-1 text-xs" style={{ color: "var(--success)" }}>
                        Pagado {formatMoney(row.latest_paid_unit_price)} - desc.{" "}
                        {formatMoney(row.latest_discount_amount)}
                      </div>
                    ) : null}
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
            {activeItem ? (
              <div className="mt-3 space-y-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <strong style={{ color: "var(--text)" }}>{activeItem.item_name}</strong>
                    <SignalBadge row={activeItem} />
                  </div>
                  <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                    {activeItem.purchase_days} dias de compra - {activeItem.transaction_count} lineas
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Prom. base</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--text)" }}>
                      {formatMoney(activeItem.avg_unit_price)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Pagado ult.</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--success)" }}>
                      {formatMoney(activeItem.latest_paid_unit_price)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Desc. ult.</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--success)" }}>
                      {formatMoney(activeItem.latest_discount_amount)} (
                      {safeNumber(activeItem.latest_discount_amount) > 0
                        ? formatPercent(-safeNumber(activeItem.latest_discount_pct))
                        : "-"}
                      )
                    </div>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Maximo</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--danger)" }}>
                      {formatMoney(activeItem.high_price)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Minimo</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--success)" }}>
                      {formatMoney(activeItem.low_price)}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs" style={{ color: "var(--muted)" }}>Volatilidad</span>
                    <div className="font-bold tabular-nums" style={{ color: "var(--warning)" }}>
                      {formatPercent(activeItem.volatility_pct)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm" style={{ color: "var(--muted)" }}>
                Selecciona un articulo para ver detalle.
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
              Curva de precio base seleccionada
            </h4>
            <p className="text-xs" style={{ color: "var(--muted)" }}>
              Mostrando hasta 6 articulos seleccionados. El descuento se mide aparte.
            </p>
          </div>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Series: {chartItems.length}
          </span>
        </div>

        {chartData.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: "var(--muted)" }}>
            Selecciona articulos con historial para ver la curva.
          </p>
        ) : (
          <div className="h-[320px] w-full">
            <ResponsiveContainer>
              <LineChart data={chartData}>
                <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />
                <XAxis
                  dataKey="date"
                  stroke={axisStroke}
                  tick={{ fill: tickFill, fontSize: 12 }}
                  tickFormatter={formatDate}
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
                {chartItems.map((row, index) => {
                  const color =
                    index === 0
                      ? "var(--danger)"
                      : index === 1
                      ? "var(--warning)"
                      : index === 2
                      ? "var(--primary)"
                      : index === 3
                      ? "var(--success)"
                      : `hsl(${(index * 58) % 360} 72% 58%)`;

                  return (
                    <Line
                      key={row.item_id}
                      dataKey={String(row.item_id)}
                      name={row.item_name}
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
