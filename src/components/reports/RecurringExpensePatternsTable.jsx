// src/components/reports/RecurringExpensePatternsTable.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function formatCurrencyDOP(value) {
  const num = safeNum(value);
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const [y, m, d] = String(dateStr).split("-");
  if (!y || !m || !d) return String(dateStr);
  return `${d}/${m}/${y}`;
}

const FREQUENCY_LABELS = {
  semanal: "Semanal",
  quincenal: "Quincenal",
  mensual: "Mensual",
  bimestral: "Bimestral",
  irregular: "Irregular",
};

function prettifyDescriptionKey(s) {
  if (!s) return "Sin descripción";
  const clean = String(s).trim();
  if (!clean) return "Sin descripción";
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// ✅ tonos por frecuencia (tokens)
function toneForFrequency(freq) {
  switch (freq) {
    case "semanal":
      return "var(--success)";
    case "quincenal":
      return "var(--primary)";
    case "mensual":
      return "var(--warning)";
    case "bimestral":
      return "var(--danger)";
    case "irregular":
    default:
      return "var(--muted)";
  }
}

function RecurringExpensePatternsTable({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [data, setData] = useState([]);
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ UI tokenizada (solo tokens “core”)
  const ui = useMemo(() => {
    const border = "var(--border-rgba)";
    const panel = "var(--panel)";
    const bg1 = "var(--bg-1)";

    return {
      border,
      text: "var(--text)",
      muted: "var(--muted)",
      ring: "var(--ring)",
      primary: "var(--primary)",
      success: "var(--success)",
      warning: "var(--warning)",
      danger: "var(--danger)",

      card: {
        borderRadius: "var(--radius-lg)",
        border: `var(--border-w) solid ${border}`,
        background: `linear-gradient(135deg, ${bg1}, color-mix(in srgb, ${panel} 45%, transparent), ${bg1})`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
      },

      tableWrap: {
        borderRadius: "var(--radius-md)",
        border: `var(--border-w) solid ${border}`,
        background: `color-mix(in srgb, ${panel} 65%, transparent)`,
      },

      theadBg: panel,
      zebraA: `color-mix(in srgb, ${panel} 40%, transparent)`,
      zebraB: `color-mix(in srgb, ${panel} 55%, transparent)`,
      hoverRow: `color-mix(in srgb, var(--primary) 10%, transparent)`,
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError("");

    axios
      .get(`${api}/analytics/recurring-expense-patterns`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { months },
      })
      .then((res) => setData(res?.data?.data || []))
      .catch((err) => {
        console.error("Error cargando patrones recurrentes:", err);
        setError(
          err.response?.data?.error ||
            "No se pudieron cargar los patrones de gasto recurrente."
        );
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [token, months, api]);

  const thText = "color-mix(in srgb, var(--text) 70%, transparent)";

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: ui.text }}>
            Patrones de gasto recurrente (no marcados)
          </h3>
          <p className="text-sm mt-1" style={{ color: ui.muted }}>
            Detecta gastos que se repiten con frecuencia similar (semanal,
            quincenal, mensual, etc.) aunque no estén configurados como
            transacciones recurrentes.
          </p>
        </div>

        {/* Filtro meses */}
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: ui.muted }}>Últimos</span>

          {/* si tienes FFSelect.jsx, úsalo aquí */}
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 6)}
            className="ff-input bg-transparent px-3 py-2 text-sm rounded-lg outline-none focus:ring-2"
            style={{ borderColor: ui.border }}
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
          </select>
        </div>
      </div>

      {/* Estados */}
      {loading ? (
        <p className="text-sm italic" style={{ color: ui.muted }}>
          Cargando patrones…
        </p>
      ) : error ? (
        <div
          className="rounded-xl px-4 py-3 text-sm"
          style={{
            border: `var(--border-w) solid color-mix(in srgb, var(--danger) 45%, ${ui.border})`,
            background: "color-mix(in srgb, var(--danger) 14%, transparent)",
            color: "color-mix(in srgb, var(--danger) 75%, var(--text))",
          }}
        >
          {error}
        </div>
      ) : data.length === 0 ? (
        <p className="text-sm italic" style={{ color: ui.muted }}>
          No se encontraron patrones de gasto recurrente en el período
          seleccionado.
        </p>
      ) : (
        <div className="overflow-x-auto" style={ui.tableWrap}>
          <table className="min-w-full text-sm" style={{ color: ui.text }}>
            <thead>
              <tr
                style={{
                  background: ui.theadBg,
                  boxShadow:
                    "inset 0 -1px 0 color-mix(in srgb, var(--border-rgba) 92%, transparent)",
                }}
              >
                <th
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: thText }}
                >
                  Categoría
                </th>
                <th
                  className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                  style={{ color: thText }}
                >
                  Descripción / Concepto
                </th>
                <th
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide"
                  style={{ color: thText }}
                >
                  Frecuencia
                </th>
                <th
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide"
                  style={{ color: thText }}
                >
                  Ocurrencias
                </th>
                <th
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide"
                  style={{ color: thText }}
                >
                  Intervalo mediano (días)
                </th>
                <th
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide"
                  style={{ color: thText }}
                >
                  Intervalo medio (días)
                </th>
                <th
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide"
                  style={{ color: thText }}
                >
                  Desv. estándar (días)
                </th>

                {/* ✅ header resaltado para Monto promedio */}
                <th
                  className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide"
                  style={{
                    color: thText,
                    background:
                      "color-mix(in srgb, var(--success) 10%, var(--panel))",
                  }}
                >
                  Monto promedio
                </th>

                <th
                  className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide"
                  style={{ color: thText }}
                >
                  Última vez
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map((row, idx) => {
                const zebraBg = idx % 2 === 0 ? ui.zebraA : ui.zebraB;
                const tone = toneForFrequency(row.frequency_label);

                return (
                  <tr
                    key={`${row.category_id || "cat"}-${row.description_key || "desc"}-${idx}`}
                    className="transition-colors"
                    style={{
                      background: zebraBg,
                      borderTop:
                        "1px solid color-mix(in srgb, var(--border-rgba) 60%, transparent)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = ui.hoverRow;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = zebraBg;
                    }}
                  >
                    <td className="px-3 py-2 align-top">
                      <span className="font-semibold" style={{ color: ui.text }}>
                        {row.category_name || "Sin categoría"}
                      </span>
                    </td>

                    <td className="px-3 py-2 align-top" style={{ color: ui.text }}>
                      {prettifyDescriptionKey(row.description_key)}
                    </td>

                    {/* ✅ badge con tonos */}
                    <td className="px-3 py-2 align-top text-center">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                        style={{
                          color: "var(--text)",
                          border: `1px solid color-mix(in srgb, ${tone} 40%, var(--border-rgba))`,
                          background: `color-mix(in srgb, ${tone} 14%, transparent)`,
                        }}
                      >
                        {FREQUENCY_LABELS[row.frequency_label] ||
                          row.frequency_label ||
                          "—"}
                      </span>
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.occurrences) || 0}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.median_interval_days) || 0}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.mean_interval_days) || 0}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.std_dev_interval_days) || 0}
                    </td>

                    {/* ✅ monto resaltado */}
                    <td
                      className="px-3 py-2 align-top text-right font-semibold tabular-nums whitespace-nowrap"
                      style={{
                        background:
                          "linear-gradient(90deg, color-mix(in srgb, var(--success) 10%, transparent), transparent)",
                        color: "color-mix(in srgb, var(--success) 80%, var(--text))",
                      }}
                    >
                      {formatCurrencyDOP(row.avg_amount)}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.muted }}>
                      {formatDate(row.last_date)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <div
            className="px-3 py-2 text-[11px]"
            style={{
              color: "color-mix(in srgb, var(--text) 65%, transparent)",
              borderTop: `1px solid color-mix(in srgb, var(--border-rgba) 60%, transparent)`,
              background: "color-mix(in srgb, var(--panel) 72%, transparent)",
            }}
          >
            Tip: si un patrón tiene muchas ocurrencias y baja desviación, suele ser un gasto “hábito” (suscripción,
            transporte, comida, etc.).
          </div>
        </div>
      )}
    </div>
  );
}

export default RecurringExpensePatternsTable;
