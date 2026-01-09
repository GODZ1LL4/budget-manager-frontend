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

/* ================= Component ================= */

export default function ExpenseForecastChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  /* ===== Defaults ===== */
  const todayISO = useMemo(() => toISODate(new Date()), []);
  const defaultDateTo = useMemo(() => lastDayOfMonthISO(todayISO), [todayISO]);

  /* ===== State ===== */
  const [dateFrom, setDateFrom] = useState(todayISO);
  const [dateTo, setDateTo] = useState(defaultDateTo);

  const [months, setMonths] = useState(3);
  const [minOccurrences, setMinOccurrences] = useState(3);
  const [limit, setLimit] = useState(15);

  const [includeOccasional, setIncludeOccasional] = useState(false);
  const [includeNoise, setIncludeNoise] = useState(true);

  /* Advanced */
  const [minIntervalDays, setMinIntervalDays] = useState(3);
  const [maxIntervalDays, setMaxIntervalDays] = useState(70);
  const [maxCoefVariation, setMaxCoefVariation] = useState(0.6);

  /* Data */
  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const didInitialLoad = useRef(false);

  /* ===== Fix fecha fin de mes (BUG RESUELTO) ===== */
  useEffect(() => {
    if (!dateFrom) return;
    setDateTo(lastDayOfMonthISO(dateFrom));
  }, [dateFrom]);

  /* ===== API ===== */
  const loadData = async () => {
    if (!token) return;

    setLoading(true);
    setError("");

    try {
      const res = await axios.get(`${api}/analytics/expense-forecast`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          months,
          min_occurrences: minOccurrences,
          limit,
          include_occasional: includeOccasional,
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
      console.error("Expense forecast error:", err);
      setError(
        err.response?.data?.error || "No se pudo calcular la proyección."
      );
      setRows([]);
      setMeta(null);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  /* ===== 1 carga inicial ===== */
  useEffect(() => {
    if (!token || didInitialLoad.current) return;
    didInitialLoad.current = true;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  /* ================= Render ================= */

  return (
    <div className="rounded-2xl p-6 bg-slate-950 border border-slate-800 space-y-4">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-100">
          Proyección de gasto por período
        </h3>
        <p className="text-sm text-slate-400">
          Basado en patrones recurrentes + estimación de gastos ruidosos.
        </p>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-6 border border-slate-800 rounded-xl p-4 bg-slate-900/40">
        <div>
          <div className="text-xs text-slate-400">Total proyectado</div>
          <div className="text-2xl font-bold text-amber-400">
            {formatMoney(summary?.total_projected || 0)}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Transacciones esperadas</div>
          <div className="text-2xl font-bold text-slate-100">
            {summary?.transactions_expected ?? 0}
          </div>
        </div>

        <div>
          <div className="text-xs text-slate-400">Historial usado</div>
          <div className="text-sm text-slate-100">
            {meta?.history_from || "—"} → {meta?.history_to || "—"}
          </div>
        </div>
      </div>

      {/* ===== Parámetros ===== */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Rango */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Rango</label>
          <div className="flex gap-2">
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="input"
            />
            <span className="text-slate-500 self-center">–</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Historial */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Historial (meses)
          </label>
          <input
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="input w-24"
          />
        </div>

        {/* Min ocurrencias */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Min. ocurrencias
          </label>
          <input
            type="number"
            min={2}
            value={minOccurrences}
            onChange={(e) => setMinOccurrences(Number(e.target.value))}
            className="input w-24"
          />
        </div>

        {/* Top */}
        <div>
          <label className="text-xs text-slate-400 mb-1 block">Top</label>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="input w-20"
          />
        </div>

        {/* Checkboxes */}
        <div className="flex items-center gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={includeOccasional}
              onChange={(e) => setIncludeOccasional(e.target.checked)}
            />
            Incluir ocasionales
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={includeNoise}
              onChange={(e) => setIncludeNoise(e.target.checked)}
            />
            Incluir gastos eventuales
          </label>
        </div>

        {/* Botón */}
        <button
          onClick={loadData}
          disabled={loading}
          className="
      ml-auto px-4 py-2 rounded-lg
      bg-amber-500 hover:bg-amber-400
      text-slate-900 font-semibold
      disabled:opacity-50
    "
        >
          {loading ? "Proyectando..." : "Proyectar"}
        </button>
      </div>

      {/* ===== Ajustes avanzados ===== */}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-slate-300">
          Ajustes avanzados
        </summary>

        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Min intervalo (días)
            </label>
            <input
              type="number"
              min={1}
              value={minIntervalDays}
              onChange={(e) => setMinIntervalDays(Number(e.target.value))}
              className="input w-28"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Max intervalo (días)
            </label>
            <input
              type="number"
              min={1}
              value={maxIntervalDays}
              onChange={(e) => setMaxIntervalDays(Number(e.target.value))}
              className="input w-28"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Coef. variación máx
            </label>
            <input
              type="number"
              step="0.05"
              min={0.05}
              max={2}
              value={maxCoefVariation}
              onChange={(e) => setMaxCoefVariation(Number(e.target.value))}
              className="input w-28"
            />
          </div>
        </div>
      </details>

      {/* Error */}
      {error && (
        <div className="text-sm text-red-300 border border-red-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Tabla (Chrome) */}
      <div
        className="
    relative overflow-hidden rounded-2xl
    border border-slate-700/70
    bg-gradient-to-br from-slate-950/60 via-slate-950/35 to-slate-900/25
    shadow-[0_18px_55px_rgba(0,0,0,0.55)]
  "
      >
        {/* Borde interior tipo “panel” */}
        <div className="pointer-events-none absolute inset-[1px] rounded-2xl border border-white/5" />

        {/* Brillo superior */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/10 via-white/5 to-transparent opacity-50" />

        {/* Header */}
        <div className="relative px-4 py-3 border-b border-slate-700/60 flex items-center justify-between">
          <div className="text-sm text-slate-100 font-semibold tracking-wide">
            Detalle de patrones
          </div>
          <div className="text-xs text-slate-300">
            {meta?.date_from || "—"} → {meta?.date_to || "—"}
          </div>
        </div>

        <div className="relative overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr
                className="
            bg-slate-900/55
            [box-shadow:inset_0_-1px_0_rgba(255,255,255,0.06)]
            [&>th]:px-4 [&>th]:py-3
            [&>th]:text-xs [&>th]:font-semibold
            [&>th]:uppercase [&>th]:tracking-wider
            [&>th]:text-slate-300
          "
              >
                <th className="text-left">Patrón</th>
                <th className="text-right">Proyección</th>
                <th className="text-right"># Esperadas</th>
                <th className="text-right">Intervalo (med)</th>
                <th className="text-right">Monto (med)</th>
                <th className="text-center">Tipo</th>
                <th className="text-right">Última</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-800/60">
              {(rows || []).map((r, idx) => {
                const isEvent = r.type === "event";

                const formatDate = (dateStr) => {
                  if (!dateStr) return "—";
                  const [y, m, d] = String(dateStr).split("-");
                  if (!y || !m || !d) return dateStr;
                  return `${d}/${m}/${y}`;
                };

                return (
                  <tr
                    key={`${r.pattern}-${idx}`}
                    className={`
                ${idx % 2 === 0 ? "bg-slate-950/18" : "bg-slate-900/20"}
                hover:bg-slate-800/35 transition-colors
              `}
                  >
                    <td className="px-4 py-3 text-slate-100">
                      <div className="leading-snug text-[13px] text-slate-100/95">
                        {r.pattern}
                      </div>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <span className="text-amber-300 font-semibold">
                        {formatMoney(r.projection)}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right text-slate-100">
                      {r.expected_count ?? "—"}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-200">
                      {r.median_interval_days != null ? (
                        <span className="text-slate-100">
                          {r.median_interval_days}{" "}
                          <span className="text-slate-100">d</span>
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-100">
                      {formatMoney(r.median_amount || 0)}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {isEvent ? (
                        /* ===== BADGE EVENTO ===== */
                        <div className="relative group inline-flex">
                          <span
                            className="
          inline-flex items-center
          rounded-full px-2 py-0.5
          text-xs font-semibold
          bg-rose-400/10
          text-rose-300
          border border-rose-300/25
          cursor-help
        "
                          >
                            evento
                          </span>

                          <div
                            className="
          pointer-events-none
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          w-64
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          z-20
        "
                          >
                            <div
                              className="
            rounded-lg px-3 py-2 text-xs
            bg-slate-950/95
            border border-slate-700
            text-slate-200
            shadow-lg
          "
                            >
                              Gasto sin periodicidad fija. Se estima a partir
                              del comportamiento histórico y puede variar entre
                              periodos.
                            </div>

                            <div
                              className="
            mx-auto w-2 h-2
            bg-slate-950/95
            border-l border-b border-slate-700
            rotate-45 -mt-1
          "
                            />
                          </div>
                        </div>
                      ) : (
                        /* ===== BADGE RECURRENTE ===== */
                        <div className="relative group inline-flex">
                          <span
                            className="
          inline-flex items-center
          rounded-full px-2 py-0.5
          text-xs font-semibold
          bg-emerald-400/10
          text-emerald-300
          border border-emerald-300/25
          cursor-help
        "
                          >
                            recurrente
                          </span>

                          <div
                            className="
          pointer-events-none
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          w-64
          opacity-0 group-hover:opacity-100
          transition-opacity duration-150
          z-20
        "
                          >
                            <div
                              className="
            rounded-lg px-3 py-2 text-xs
            bg-slate-950/95
            border border-slate-700
            text-slate-200
            shadow-lg
          "
                            >
                              Gasto con patrón repetitivo detectado. Presenta un
                              intervalo y un monto relativamente estables en el
                              tiempo.
                            </div>

                            <div
                              className="
            mx-auto w-2 h-2
            bg-slate-950/95
            border-l border-b border-slate-700
            rotate-45 -mt-1
          "
                            />
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-300">
                      {formatDate(r.last_date)}
                    </td>
                  </tr>
                );
              })}

              {!loading && (!rows || rows.length === 0) ? (
                <tr>
                  <td
                    className="px-4 py-10 text-slate-400 text-center"
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
