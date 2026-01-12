// src/components/reports/RecurringItemPatternsTable.jsx
import { useEffect, useState } from "react";
import axios from "axios";

function formatCurrencyDOP(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return dateStr;
  return `${d}/${m}/${y}`;
}

const FREQUENCY_LABELS = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  bimestral: "Bimestral",
  irregular: "Irregular",
};

function prettifyKey(s) {
  if (!s) return "—";
  const clean = String(s).trim();
  if (!clean) return "—";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function RecurringItemPatternsTable({ token }) {
  const [data, setData] = useState([]);
  const [months, setMonths] = useState(6);
  const [minOccurrences, setMinOccurrences] = useState(3);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    axios
      .get(`${api}/analytics/recurring-item-patterns`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { months, min_occurrences: minOccurrences },
      })
      .then((res) => setData(res.data?.data || []))
      .catch((err) => {
        console.error("Error cargando patrones recurrentes por ítem:", err);
        setError(
          err.response?.data?.error ||
            "No se pudieron cargar los patrones de compra por artículo."
        );
      })
      .finally(() => setLoading(false));
  }, [token, months, minOccurrences, api]);

  // ✅ Scroll vertical desde 15 filas (aprox. 15 filas + header)
  const enableYScroll = data.length >= 15;
  const HEADER_H = 44;
  const ROW_H = 44;
  const maxTableHeightPx = HEADER_H + ROW_H * 15;

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-4
      "
    >
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            Patrones de compra por artículo
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Detecta artículos que compras con una frecuencia similar (semanal,
            mensual, etc.), aunque no estén configurados como transacciones
            recurrentes.
          </p>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 text-sm items-center">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Período:</span>
            <select
              value={months}
              onChange={(e) => setMonths(Number(e.target.value) || 6)}
              className="
                bg-slate-900 border border-slate-700 rounded-lg
                px-2 py-1 text-sm text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70
              "
            >
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Mín. ocurrencias:</span>
            <select
              value={minOccurrences}
              onChange={(e) => setMinOccurrences(Number(e.target.value) || 3)}
              className="
                bg-slate-900 border border-slate-700 rounded-lg
                px-2 py-1 text-sm text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70
              "
            >
              <option value={2}>2+</option>
              <option value={3}>3+</option>
              <option value={4}>4+</option>
              <option value={5}>5+</option>
            </select>
          </div>
        </div>
      </div>

      {/* Estados */}
      {loading && (
        <p className="text-sm text-slate-400 italic">
          Buscando patrones de compra por artículo…
        </p>
      )}
      {error && <p className="text-sm text-rose-400">{error}</p>}
      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-slate-500 italic">
          No se encontraron patrones de compra para el período y filtros
          seleccionados.
        </p>
      )}

{/* Tabla */}
{!loading && !error && data.length > 0 && (
  <div
    className={`
      rounded-xl border border-slate-800 bg-slate-950/60
      overflow-x-auto
      ${enableYScroll ? "overflow-y-auto" : ""}
    `}
    style={enableYScroll ? { maxHeight: `${maxTableHeightPx}px` } : undefined}
  >
    <table className="min-w-full w-full text-[12px] text-slate-100 table-fixed">
      <thead className="bg-slate-900/80 border-b border-slate-800 sticky top-0 z-10">
        <tr>
          <th className="px-1.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[160px]">
            Artículo
          </th>
          <th className="px-1.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[90px]">
            Categoría
          </th>
          <th className="px-1.5 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[120px]">
            Variante
            <span className="block">/ Concepto</span>
          </th>
          <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[80px]">
            Frec.
          </th>
          <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[70px]">
            Ocurr.
          </th>
          <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[75px]">
            Med.
            <span className="block">(d)</span>
          </th>
          <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[75px]">
            Media
            <span className="block">(d)</span>
          </th>
          <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[75px]">
            Desv.
            <span className="block">(d)</span>
          </th>
          <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[75px]">
            Cant.
            <span className="block">prom.</span>
          </th>
          <th className="px-1.5 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[95px]">
            Monto
            <span className="block">prom.</span>
          </th>
          <th className="px-1.5 py-1.5 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400 w-[90px]">
            Última
            <span className="block">compra</span>
          </th>
        </tr>
      </thead>

      <tbody>
        {data.map((row, idx) => (
          <tr
            key={`${row.item_id || "item"}-${row.description_key || "desc"}-${idx}`}
            className={
              idx % 2 === 0
                ? "bg-slate-950/60"
                : "bg-slate-900/70 border-t border-slate-800/60"
            }
          >
            {/* Artículo */}
            <td className="px-1.5 py-1.5 align-top">
              <div className="w-[160px] break-words leading-snug font-semibold">
                {row.item_name || "Sin nombre"}
              </div>
            </td>

            {/* Categoría (truncate) */}
            <td className="px-1.5 py-1.5 align-top text-slate-300">
              <div
                className="w-[90px] truncate"
                title={row.category_name || ""}
              >
                {row.category_name || "—"}
              </div>
            </td>

            {/* Variante / Concepto (truncate) */}
            <td className="px-1.5 py-1.5 align-top text-slate-200">
              <div
                className="w-[120px] truncate"
                title={prettifyKey(row.description_key)}
              >
                {prettifyKey(row.description_key)}
              </div>
            </td>

            {/* Frecuencia */}
            <td className="px-1.5 py-1.5 align-top text-center">
              <span
                className="
                  inline-flex items-center px-1.5 py-0.5 rounded-full
                  bg-slate-800/80 text-[10px] text-slate-100
                  border border-slate-600/80 whitespace-nowrap
                "
              >
                {FREQUENCY_LABELS[row.frequency_label] ||
                  row.frequency_label ||
                  "—"}
              </span>
            </td>

            <td className="px-1.5 py-1.5 align-top text-center tabular-nums">
              {row.occurrences}
            </td>
            <td className="px-1.5 py-1.5 align-top text-center tabular-nums">
              {row.median_interval_days}
            </td>
            <td className="px-1.5 py-1.5 align-top text-center tabular-nums">
              {row.mean_interval_days}
            </td>
            <td className="px-1.5 py-1.5 align-top text-center tabular-nums">
              {row.std_dev_interval_days}
            </td>
            <td className="px-1.5 py-1.5 align-top text-center tabular-nums">
              {Number(row.avg_quantity || 0).toFixed(2)}
            </td>

            <td className="px-1.5 py-1.5 align-top text-right font-semibold text-emerald-300 tabular-nums whitespace-nowrap">
              {formatCurrencyDOP(row.avg_amount)}
            </td>

            <td className="px-1.5 py-1.5 align-top text-center text-slate-300 tabular-nums">
              <div className="flex flex-col items-center gap-0.5">
                <span className="whitespace-nowrap">
                  {formatDate(row.last_date)}
                </span>
                {row.last_amount != null && (
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {formatCurrencyDOP(row.last_amount)}
                  </span>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
)}

    </div>
  );
}

export default RecurringItemPatternsTable;
