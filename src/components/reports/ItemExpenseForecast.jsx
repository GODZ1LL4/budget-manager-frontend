import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";

/* ================= Utils ================= */

function toISODate(d) {
  return new Date(d).toISOString().split("T")[0];
}

function lastDayOfMonthISO(dateISO) {
  const d = new Date(`${dateISO}T00:00:00`);
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return toISODate(last);
}

function formatMoney(v) {
  const n = Number(v) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(n);
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function formatDateShort(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
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

  const todayISO = useMemo(() => toISODate(new Date()), []);
  const defaultDateTo = useMemo(() => lastDayOfMonthISO(todayISO), [todayISO]);

  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  const [months, setMonths] = useState(6);
  const [minOccurrences, setMinOccurrences] = useState(3);
  const [limit, setLimit] = useState(15);

  const [includeNoise, setIncludeNoise] = useState(true);

  const [minIntervalDays, setMinIntervalDays] = useState(3);
  const [maxIntervalDays, setMaxIntervalDays] = useState(70);
  const [maxCoefVariation, setMaxCoefVariation] = useState(0.6);

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

  const loadData = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await axios.get(`${api}/analytics/item-expense-forecast`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          months,
          min_occurrences: minOccurrences,
          limit,
          include_noise: includeNoise,
          min_interval_days: minIntervalDays,
          max_interval_days: maxIntervalDays,
          max_coef_variation: maxCoefVariation,
        },
      });

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
  const qtyExpected = Number(summary?.quantity_expected || 0);

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
            Proyección de gasto por artículos
          </h3>

          <p className="text-sm text-[color-mix(in srgb,var(--text)_86%,transparent)] mt-1 max-w-4xl">
            Forecast basado en patrones recurrentes de compra por ítem + eventos (noise).
            Ordenado por gasto proyectado.
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
          {loading ? "Proyectando..." : "Proyectar"}
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <StatCard
          label="Gasto proyectado"
          value={formatMoney(totalExpense)}
          tone="danger"
          size="sm"
        />
        <StatCard
          label="Cantidad esperada"
          value={String(qtyExpected.toFixed(2))}
          tone="warning"
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
          <div className="lg:col-span-5">
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
              type="number"
              min={1}
              max={36}
              value={months}
              onChange={(e) => setMonths(clamp(Number(e.target.value), 1, 36))}
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Min. ocurrencias
            </label>
            <input
              type="number"
              min={2}
              max={50}
              value={minOccurrences}
              onChange={(e) =>
                setMinOccurrences(clamp(Number(e.target.value), 2, 50))
              }
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-1">
            <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
              Top
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(clamp(Number(e.target.value), 1, 50))}
              className="ff-input w-full"
            />
          </div>

          <div className="lg:col-span-2 flex flex-col gap-2">
            <label className="flex items-center gap-2 text-sm text-[var(--text)]">
              <input
                type="checkbox"
                checked={includeNoise}
                onChange={(e) => setIncludeNoise(e.target.checked)}
                className="accent-[var(--primary)]"
              />
              Incluir eventos (noise)
            </label>
          </div>
        </div>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-[var(--text)] select-none">
            Ajustes avanzados
          </summary>

          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Min intervalo (días)
              </label>
              <input
                type="number"
                min={1}
                value={minIntervalDays}
                onChange={(e) =>
                  setMinIntervalDays(clamp(Number(e.target.value), 1, 365))
                }
                className="ff-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Max intervalo (días)
              </label>
              <input
                type="number"
                min={1}
                value={maxIntervalDays}
                onChange={(e) =>
                  setMaxIntervalDays(clamp(Number(e.target.value), 1, 3650))
                }
                className="ff-input w-full"
              />
            </div>

            <div>
              <label className="text-xs text-[color-mix(in srgb,var(--text)_86%,transparent)] mb-1 block">
                Coef. variación máx
              </label>
              <input
                type="number"
                step="0.05"
                min={0.05}
                max={2}
                value={maxCoefVariation}
                onChange={(e) => setMaxCoefVariation(Number(e.target.value))}
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
            Detalle de patrones por artículo
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
                    PROY.{" "}
                    <InfoTip widthClass="w-56">
                      Monto total estimado proyectado para el período seleccionado.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[10%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    CANT.{" "}
                    <InfoTip widthClass="w-64">
                      Cantidad esperada. Si el ítem es unitario se redondea; si es por
                      peso/volumen se mantiene decimal.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[8%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    INT.{" "}
                    <InfoTip widthClass="w-52">
                      Intervalo mediano (en días) entre compras del ítem.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-right w-[12%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    MONTO{" "}
                    <InfoTip widthClass="w-52">
                      Valor típico (mediano) por evento diario del ítem.
                    </InfoTip>
                  </div>
                </th>

                <th className="text-center w-[10%]">TIPO</th>

                <th className="text-right w-[12%]">
                  <div className="inline-flex items-center gap-1 justify-end">
                    ÚLTIMA{" "}
                    <InfoTip widthClass="w-52">
                      Última fecha detectada en el historial.
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
                const isEvent = r.type === "event";
                const qty = Number(r.expected_quantity || 0);
                const qtyLabel = r.is_discrete
                  ? String(Math.round(qty))
                  : qty.toFixed(2);

                return (
                  <tr
                    key={`${r.item_id}-${idx}`}
                    className={idx % 2 === 0 ? "ff-row" : "ff-row-alt"}
                  >
                    <td className="px-2 py-2 text-[var(--text)] align-top">
                      <div className="text-[13px] font-semibold leading-snug whitespace-normal break-words">
                        {r.item_name}
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
                      {r.median_interval_days != null
                        ? `${r.median_interval_days}d`
                        : "—"}
                    </td>

                    <td className="px-2 py-2 text-right text-[var(--text)] tabular-nums align-top">
                      {formatMoney(r.median_amount || 0)}
                    </td>

                    <td className="px-2 py-2 text-center align-top">
                      <Badge tone={isEvent ? "warning" : "primary"}>
                        {isEvent ? "Evento" : "Recurrente"}
                      </Badge>
                    </td>

                    <td className="px-2 py-2 text-right tabular-nums align-top whitespace-nowrap text-[color-mix(in srgb,var(--text)_86%,transparent)]">
                      {formatDateShort(r.last_date)}
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
