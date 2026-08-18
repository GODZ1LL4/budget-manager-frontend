import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import {
  lastDayOfMonthDateKey,
  todayDateKey,
  withUserTimeZone,
} from "../../lib/dates/localDate";

const STORAGE_KEY = "report:item-expense-forecast:params";

/* ================= Utils ================= */

function lastDayOfMonthISO(dateISO) {
  return lastDayOfMonthDateKey(dateISO);
}

function formatMoney(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(n);
}

function parseDraftNumber(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function clampDraftNumber(value, min, max, fallback) {
  const number = parseDraftNumber(value);
  if (number == null) return fallback;
  return Math.max(min, Math.min(max, number));
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

function formatQuantity(value, isDiscrete = false) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return "0";
  return isDiscrete ? String(Math.round(n)) : n.toFixed(2);
}

function getShoppingStatus(row) {
  switch (row?.shopping_status) {
    case "overdue":
      return { label: "Vencido", tone: "danger" };
    case "today":
      return { label: "Hoy", tone: "warning" };
    case "due_soon":
      return { label: "Pronto", tone: "primary" };
    case "scheduled":
      return { label: "Programado", tone: "success" };
    default:
      return { label: "Posible", tone: "default" };
  }
}

function getPatternLabel(row) {
  return row?.type === "recurring" ? "Recurrente" : "Posible";
}

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "not_overdue", label: "Sin vencidos" },
  { value: "overdue", label: "Vencidos" },
  { value: "due_now", label: "Vencidos / hoy" },
  { value: "due_soon", label: "Hoy / pronto" },
  { value: "scheduled", label: "Programados" },
];

function sanitizeParams(raw) {
  const minIntervalDays = clampDraftNumber(raw?.minIntervalDays, 1, 365, 3);
  const statusFilter = STATUS_FILTER_OPTIONS.some(
    (option) => option.value === raw?.statusFilter
  )
    ? raw.statusFilter
    : "all";

  return {
    months: clampDraftNumber(raw?.months, 1, 36, 6),
    minOccurrences: clampDraftNumber(raw?.minOccurrences, 2, 50, 3),
    limit: clampDraftNumber(raw?.limit, 1, 200, 50),
    statusFilter,
    includeNoise:
      typeof raw?.includeNoise === "boolean" ? raw.includeNoise : true,
    includeStale:
      typeof raw?.includeStale === "boolean" ? raw.includeStale : false,
    minIntervalDays,
    maxIntervalDays: clampDraftNumber(
      raw?.maxIntervalDays,
      minIntervalDays,
      3650,
      Math.max(180, minIntervalDays)
    ),
    maxCoefVariation: clampDraftNumber(raw?.maxCoefVariation, 0.05, 2, 1),
    dueSoonDays: clampDraftNumber(raw?.dueSoonDays, 0, 60, 7),
  };
}

function getInitialParams() {
  if (typeof window === "undefined") return sanitizeParams({});

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return sanitizeParams({});
    return sanitizeParams(JSON.parse(saved));
  } catch {
    return sanitizeParams({});
  }
}

/* ================= Token helpers ================= */

function toneToken(tone) {
  switch (tone) {
    case "danger":
    case "rose":
      return "var(--danger)";
    case "success":
    case "emerald":
      return "var(--success)";
    case "warning":
    case "amber":
      return "var(--warning)";
    case "primary":
    case "sky":
      return "var(--primary)";
    default:
      return "var(--text)";
  }
}

/* ================= UI bits ================= */

function StatCard({ label, value, tone = "default", size = "md" }) {
  const token = toneToken(tone);

  const sizeClass =
    size === "sm"
      ? "text-[clamp(24px,1.6vw,20px)]"
      : "text-[clamp(18px,2.2vw,28px)]";

  return (
    <div
      className={`
        rounded-2xl border
        px-4 py-4
        min-h-[96px]
        flex flex-col justify-between
        min-w-0
      `}
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom, color-mix(in srgb,var(--panel)_72%,transparent), color-mix(in srgb,var(--panel)_38%,transparent))",
        boxShadow: `0 14px 45px color-mix(in srgb, ${token} 10%, transparent)`,
      }}
    >
      <div className="text-sm text-[color-mix(in srgb,var(--text)_86%,transparent)]">
        {label}
      </div>

      <div
        className={`
          font-extrabold tracking-tight tabular-nums
          whitespace-nowrap
          leading-tight
          ${sizeClass}
        `}
        style={{ color: `color-mix(in srgb, ${token} 92%, var(--text))` }}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}

function Badge({ tone = "default", children }) {
  const token = toneToken(tone);

  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold border"
      style={{
        background: `color-mix(in srgb, ${token} 14%, transparent)`,
        color: `color-mix(in srgb, ${token} 85%, var(--text))`,
        borderColor: "var(--border-rgba)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Tooltip reutilizable (tokenizado)
 * Requiere primitives en index.css:
 *  - .ff-tooltip
 */
function InfoTip({ children, widthClass = "w-56" }) {
  return (
    <span className="relative inline-flex items-center group cursor-help select-none">
      <span className="opacity-85">ℹ</span>

      <span
        className={`
          pointer-events-none absolute z-20
          top-full right-0 mt-1
          ${widthClass}
          opacity-0 scale-95
          group-hover:opacity-100 group-hover:scale-100
          transition
        `}
      >
        <span className="ff-tooltip block text-xs font-medium leading-snug">
          {children}
        </span>
      </span>
    </span>
  );
}

/* ================= Component ================= */

export default function ItemExpenseForecast({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const initialParams = useMemo(() => getInitialParams(), []);

  const todayISO = useMemo(() => todayDateKey(), []);
  const defaultDateTo = useMemo(() => lastDayOfMonthISO(todayISO), [todayISO]);

  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  const [months, setMonths] = useState(String(initialParams.months));
  const [minOccurrences, setMinOccurrences] = useState(
    String(initialParams.minOccurrences)
  );
  const [limit, setLimit] = useState(String(initialParams.limit));
  const [statusFilter, setStatusFilter] = useState(initialParams.statusFilter);

  const [includeNoise, setIncludeNoise] = useState(initialParams.includeNoise);

  const [minIntervalDays, setMinIntervalDays] = useState(
    String(initialParams.minIntervalDays)
  );
  const [maxIntervalDays, setMaxIntervalDays] = useState(
    String(initialParams.maxIntervalDays)
  );
  const [maxCoefVariation, setMaxCoefVariation] = useState(
    String(initialParams.maxCoefVariation)
  );
  const [dueSoonDays, setDueSoonDays] = useState(
    String(initialParams.dueSoonDays)
  );
  const [includeStale, setIncludeStale] = useState(initialParams.includeStale);

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const didInitialLoad = useRef(false);

  useEffect(() => {
    if (!dateFrom) return;
    setDateTo(lastDayOfMonthISO(dateFrom));
  }, [dateFrom]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const paramsToSave = sanitizeParams({
      months,
      minOccurrences,
      limit,
      statusFilter,
      includeNoise,
      includeStale,
      minIntervalDays,
      maxIntervalDays,
      maxCoefVariation,
      dueSoonDays,
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(paramsToSave));
    } catch (e) {
      console.error(
        "No se pudieron guardar los parámetros de item expense forecast:",
        e
      );
    }
  }, [
    months,
    minOccurrences,
    limit,
    statusFilter,
    includeNoise,
    includeStale,
    minIntervalDays,
    maxIntervalDays,
    maxCoefVariation,
    dueSoonDays,
  ]);

  const loadData = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const minInterval = clampDraftNumber(minIntervalDays, 1, 365, 3);
      const params = {
        months: clampDraftNumber(months, 1, 36, 6),
        minOccurrences: clampDraftNumber(minOccurrences, 2, 50, 3),
        limit: clampDraftNumber(limit, 1, 200, 50),
        minIntervalDays: minInterval,
        maxIntervalDays: clampDraftNumber(
          maxIntervalDays,
          minInterval,
          3650,
          Math.max(180, minInterval)
        ),
        maxCoefVariation: clampDraftNumber(maxCoefVariation, 0.05, 2, 1),
        dueSoonDays: clampDraftNumber(dueSoonDays, 0, 60, 7),
      };

      const res = await axios.get(
        `${api}/analytics/item-expense-forecast`,
        withUserTimeZone({
          headers: { Authorization: `Bearer ${token}` },
          params: {
            date_from: dateFrom,
            date_to: dateTo,
            months: params.months,
            min_occurrences: params.minOccurrences,
            limit: params.limit,
            status_filter: statusFilter,
            include_noise: includeNoise,
            include_stale: includeStale,
            due_soon_days: params.dueSoonDays,
            min_interval_days: params.minIntervalDays,
            max_interval_days: params.maxIntervalDays,
            max_coef_variation: params.maxCoefVariation,
          },
        })
      );

      setRows(res.data?.data || []);
      setMeta(res.data?.meta || null);
      setSummary(res.data?.summary || null);
    } catch (err) {
      console.error("ItemExpenseForecast error:", err);
      setError(err.response?.data?.error || "No se pudo calcular la proyección.");
      setRows([]);
      setMeta(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || didInitialLoad.current) return;
    didInitialLoad.current = true;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Derived
  const totalExpense = Number(summary?.total_expense || 0);
  const itemsSuggested = Number(summary?.items_suggested || rows?.length || 0);
  const totalMatching = Number(meta?.filtered_candidates || itemsSuggested);
  const itemsSuggestedLabel =
    totalMatching > itemsSuggested
      ? `${itemsSuggested}/${totalMatching}`
      : String(itemsSuggested);
  const dueNow = Number(summary?.due_now || 0);
  const dueSoon = Number(summary?.due_soon || 0);

  const historyLabel =
    meta?.history_from && meta?.history_to
      ? `${formatDateShort(meta.history_from)} → ${formatDateShort(meta.history_to)}`
      : "—";

  const rangeLabel =
    meta?.date_from && meta?.date_to
      ? `${formatDateShort(meta.date_from)} → ${formatDateShort(meta.date_to)}`
      : `${formatDateShort(dateFrom)} → ${formatDateShort(dateTo)}`;

  return (
    <div
      className="rounded-2xl p-6 space-y-4 overflow-hidden border"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom, var(--bg-1), color-mix(in srgb, var(--bg-1) 70%, transparent), color-mix(in srgb, var(--panel) 40%, transparent))",
        boxShadow: "0 18px 55px rgba(0,0,0,0.45)",
      }}
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <h3 className="text-xl sm:text-2xl font-bold text-[var(--text)] tracking-tight">
            Compras sugeridas por artículos
          </h3>

          <p className="text-sm text-[color-mix(in srgb,var(--text)_86%,transparent)] mt-1 max-w-4xl">
            Identifica artículos que probablemente debes comprar según tu cadencia histórica.
            Ordenado por urgencia y confianza.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="text-xs text-[color-mix(in srgb,var(--text)_76%,transparent)] min-w-0 truncate">
              <span className="font-bold text-[color-mix(in srgb,var(--text)_90%,transparent)]">
                Historial usado:
              </span>{" "}
              {historyLabel}
            </div>

            <div className="text-xs text-[color-mix(in srgb,var(--text)_76%,transparent)] whitespace-nowrap">
              <span className="font-bold text-[color-mix(in srgb,var(--text)_90%,transparent)]">
                Rango:
              </span>{" "}
              {rangeLabel}
            </div>
          </div>
        </div>

        <button
          onClick={loadData}
          disabled={loading}
          className="ff-btn ff-btn-primary self-start lg:self-auto disabled:opacity-60"
        >
          {loading ? "Buscando..." : "Actualizar lista"}
        </button>
      </div>

      {error ? (
        <div
          className="text-sm rounded-xl p-3 border"
          style={{
            borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)",
            background: "color-mix(in srgb, var(--danger) 12%, transparent)",
            color: "color-mix(in srgb, var(--danger) 85%, var(--text))",
          }}
        >
          {error}
        </div>
      ) : null}

      {/* KPIs (sin card de rango) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Artículos sugeridos"
          value={itemsSuggestedLabel}
          tone="primary"
          size="sm"
        />
        <StatCard
          label="Vencidos / hoy"
          value={String(dueNow)}
          tone={dueNow > 0 ? "danger" : "success"}
          size="sm"
        />
        <StatCard
          label="Próximos"
          value={String(dueSoon)}
          tone="warning"
          size="sm"
        />
        <StatCard
          label="Total estimado"
          value={formatMoney(totalExpense)}
          tone="danger"
          size="sm"
        />
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl border p-4"
        style={{
          borderColor: "var(--border-rgba)",
          background: "color-mix(in srgb, var(--panel) 35%, transparent)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div className="lg:col-span-4">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Rango
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="ff-input w-full min-w-0"
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="ff-input w-full min-w-0"
              />
            </div>
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Historial (meses)
            </label>
            <input
              type="text"
              inputMode="numeric"
              min={1}
              max={36}
              value={months}
              onChange={(e) => setMonths(e.target.value)}
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Min. ocurrencias
            </label>
            <input
              type="text"
              inputMode="numeric"
              min={2}
              max={50}
              value={minOccurrences}
              onChange={(e) => setMinOccurrences(e.target.value)}
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Ver
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="ff-input w-full"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Mostrar
            </label>
            <input
              type="text"
              inputMode="numeric"
              min={1}
              max={200}
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-12 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={includeNoise}
                onChange={(e) => setIncludeNoise(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              Incluir posibles irregulares
            </label>

            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={includeStale}
                onChange={(e) => setIncludeStale(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              Incluir muy viejos
            </label>
          </div>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-[var(--text)] select-none">
            Ajustes avanzados
          </summary>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Min intervalo (días)
              </label>
              <input
                type="text"
                inputMode="numeric"
                min={1}
                value={minIntervalDays}
                onChange={(e) => setMinIntervalDays(e.target.value)}
                className="ff-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Max intervalo (días)
              </label>
              <input
                type="text"
                inputMode="numeric"
                min={1}
                value={maxIntervalDays}
                onChange={(e) => setMaxIntervalDays(e.target.value)}
                className="ff-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Coef. variación máx
              </label>
              <input
                type="text"
                inputMode="decimal"
                step="0.05"
                min={0.05}
                max={2}
                value={maxCoefVariation}
                onChange={(e) => setMaxCoefVariation(e.target.value)}
                className="ff-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Pronto (dias)
              </label>
              <input
                type="text"
                inputMode="numeric"
                min={0}
                max={60}
                value={dueSoonDays}
                onChange={(e) => setDueSoonDays(e.target.value)}
                className="ff-input w-full"
              />
            </div>
          </div>
        </details>
      </div>

      {/* Table */}
      <div
        className="relative overflow-hidden rounded-2xl border"
        style={{
          borderColor: "var(--border-rgba)",
          background:
            "linear-gradient(to bottom right, color-mix(in srgb,var(--panel)_60%,transparent), color-mix(in srgb,var(--panel)_35%,transparent), color-mix(in srgb,var(--panel)_22%,transparent))",
          boxShadow: "0 18px 55px rgba(0,0,0,0.35)",
        }}
      >
        <div
          className="pointer-events-none absolute inset-[1px] rounded-2xl"
          style={{
            border: "1px solid color-mix(in srgb, var(--text) 6%, transparent)",
          }}
        />

        <div
          className="relative px-3 py-2 border-b flex items-center justify-between"
          style={{
            borderColor:
              "color-mix(in srgb, var(--border-rgba) 75%, transparent)",
          }}
        >
          <div className="text-sm text-[var(--text)] font-extrabold">
            Lista sugerida por artículo
          </div>
          <div className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] whitespace-nowrap">
            {rangeLabel}
          </div>
        </div>

        <div className="relative overflow-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="ff-thead">
                <th className="text-left w-[38%]">ARTÍCULO</th>

                <th className="text-right w-[14%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    EST.{" "}
                    <InfoTip widthClass="w-56">
                      Total estimado para las compras sugeridas en el período.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[10%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    CANT.{" "}
                    <InfoTip widthClass="w-64">
                      Cantidad recomendada. Si el ítem es unitario se redondea; si es por
                      peso/volumen se mantiene decimal.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[8%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    FECHA{" "}
                    <InfoTip widthClass="w-52">
                      Fecha sugerida para comprar según la cadencia histórica.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[12%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    CONF.{" "}
                    <InfoTip widthClass="w-52">
                      Confianza del patrón calculada con ocurrencias, regularidad y recencia.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-center w-[10%]">ESTADO</th>

                <th className="text-right w-[12%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    CAD.{" "}
                    <InfoTip widthClass="w-52">
                      Cadencia mediana y última compra detectada.
                    </InfoTip>
                  </div>
                </th>
              </tr>
            </thead>

            <tbody
              className="divide-y"
              style={{
                borderColor:
                  "color-mix(in srgb, var(--border-rgba) 65%, transparent)",
              }}
            >
              {(rows || []).map((r, idx) => {
                const status = getShoppingStatus(r);
                const qtyLabel = formatQuantity(
                  r.recommended_quantity ?? r.expected_quantity,
                  r.is_discrete
                );
                const confidence = Number(r.confidence_score || 0);

                return (
                  <tr
                    key={`${r.item_id}-${idx}`}
                    className={idx % 2 === 0 ? "ff-row" : "ff-row-alt"}
                  >
                    <td className="px-2 py-2 text-[var(--text)] align-top">
                      <div className="text-[13px] font-semibold leading-snug whitespace-normal break-words">
                        {r.item_name}
                      </div>
                      <div className="mt-1 text-[11px] leading-snug text-[color-mix(in srgb,var(--text)_65%,transparent)]">
                        {r.category_name || "Sin categoría"} · {getPatternLabel(r)}
                      </div>
                    </td>

                    <td className="px-2 py-2 text-right align-top">
                      <span
                        className="font-semibold tabular-nums"
                        style={{
                          color:
                            "color-mix(in srgb, var(--warning) 92%, var(--text))",
                        }}
                      >
                        {formatMoney(r.projection)}
                      </span>
                    </td>

                    <td className="px-2 py-2 text-right text-[var(--text)] font-semibold tabular-nums align-top">
                      {qtyLabel}
                    </td>

                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums align-top">
                      {formatDateShort(r.suggested_purchase_date || r.due_date)}
                    </td>

                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums align-top">
                      {confidence ? `${confidence.toFixed(0)}%` : "—"}
                    </td>

                    <td className="px-2 py-2 text-center align-top">
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </td>

                    <td className="px-2 py-2 text-right tabular-nums align-top text-[color-mix(in srgb,var(--text)_86%,transparent)]">
                      <div className="whitespace-nowrap">
                        {r.median_interval_days != null
                          ? `${r.median_interval_days}d`
                          : "—"}
                      </div>
                      <div className="mt-0.5 text-[11px] whitespace-nowrap text-[color-mix(in srgb,var(--text)_60%,transparent)]">
                        Última {formatDateShort(r.last_date)}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && (!rows || rows.length === 0) ? (
                <tr>
                  <td
                    className="px-3 py-10 text-center"
                    style={{
                      color: "color-mix(in srgb,var(--text)_70%,transparent)",
                    }}
                    colSpan={7}
                  >
                    Sin resultados con estos filtros.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
