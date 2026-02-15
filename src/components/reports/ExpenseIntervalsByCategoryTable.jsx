// src/components/reports/ExpenseIntervalsByCategoryTable.jsx
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

function ExpenseIntervalsByCategoryTable({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [data, setData] = useState([]);
  const [months, setMonths] = useState(6);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ UI tokenizada (sin tokens inventados)
  const ui = useMemo(() => {
    const border = "var(--border-rgba)";
    const panel = "var(--panel)";
    const bg1 = "var(--bg-1)";

    return {
      border,
      text: "var(--text)",
      muted: "var(--muted)",
      ring: "var(--ring)",
      success: "var(--success)",
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

      theadBg: panel, // ✅ sólido (no transparente)
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
      .get(`${api}/analytics/expense-intervals-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { months },
      })
      .then((res) => setData(res?.data?.data || []))
      .catch((err) => {
        console.error("Error cargando intervalos de gasto por categoría:", err);
        setError(
          err.response?.data?.error ||
            "No se pudieron cargar los intervalos de gasto."
        );
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [token, months, api]);

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: ui.text }}>
            Intervalo entre gastos por categoría
          </h3>
          <p className="text-sm mt-1" style={{ color: ui.muted }}>
            Analiza cada cuánto tiempo vuelves a gastar en cada categoría. Útil
            para identificar compras frecuentes, hábitos y posibles compras
            impulsivas.
          </p>
        </div>

        {/* Filtro de meses */}
        <div className="flex items-center gap-2 text-sm">
          <span style={{ color: ui.muted }}>Período analizado:</span>

          {/* Si tienes FFSelect.jsx, cámbialo aquí */}
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value) || 12)}
            className="
              ff-input
              px-3 py-2 text-sm
              bg-transparent
              rounded-lg
              outline-none
              focus:outline-none
              focus:ring-2
            "
            style={{
              borderColor: ui.border,
              boxShadow: "none",
            }}
          >
            <option value={6}>Últimos 6 meses</option>
            <option value={12}>Últimos 12 meses</option>
            <option value={24}>Últimos 24 meses</option>
          </select>
        </div>
      </div>

      {/* Estados */}
      {loading ? (
        <p className="text-sm italic" style={{ color: ui.muted }}>
          Calculando intervalos de gasto…
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
          No hay datos suficientes para calcular intervalos de gasto.
        </p>
      ) : (
        <div className="overflow-x-auto" style={ui.tableWrap}>
          <table className="min-w-full text-sm" style={{ color: ui.text }}>
            <thead>
              <tr style={{ background: ui.theadBg }}>
                {[
                  ["Categoría", "text-left"],
                  ["# Transacciones", "text-center"],
                  ["Intervalo promedio (días)", "text-center"],
                  ["Intervalo mediano (días)", "text-center"],
                  ["Mínimo (días)", "text-center"],
                  ["Máximo (días)", "text-center"],
                  ["Total gastado", "text-right"],
                  ["Primer registro", "text-center"],
                  ["Último registro", "text-center"],
                ].map(([label, align]) => (
                  <th
                    key={label}
                    className={`px-3 py-2 ${align} text-xs font-semibold uppercase tracking-wide`}
                    style={{
                      color: "color-mix(in srgb, var(--text) 70%, transparent)",
                      borderBottom: `var(--border-w) solid ${ui.border}`,
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {data.map((row, idx) => {
                const zebraBg = idx % 2 === 0 ? ui.zebraA : ui.zebraB;

                return (
                  <tr
                    key={`${row.category_id || "cat"}-${idx}`}
                    className="transition-colors"
                    style={{
                      background: zebraBg,
                      borderTop: `1px solid color-mix(in srgb, ${ui.border} 60%, transparent)`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = ui.hoverRow;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = zebraBg;
                    }}
                  >
                    <td className="px-3 py-2 align-top" style={{ color: ui.text }}>
                      {row.category_name || "Sin categoría"}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.transactions_count)}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.avg_interval_days)}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.median_interval_days)}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.min_interval_days)}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.text }}>
                      {safeNum(row.max_interval_days)}
                    </td>

                    <td
                      className="px-3 py-2 align-top text-right font-semibold tabular-nums whitespace-nowrap"
                      style={{
                        color: "color-mix(in srgb, var(--success) 80%, var(--text))",
                        background:
                          "linear-gradient(90deg, color-mix(in srgb, var(--success) 10%, transparent), transparent)",
                      }}
                    >
                      {formatCurrencyDOP(row.total_spent)}
                    </td>

                    <td className="px-3 py-2 align-top text-center" style={{ color: ui.muted }}>
                      {formatDate(row.first_date)}
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
              borderTop: `1px solid color-mix(in srgb, ${ui.border} 60%, transparent)`,
              background: "color-mix(in srgb, var(--panel) 72%, transparent)",
            }}
          >
            Tip: si el intervalo promedio es bajo y el total gastado es alto, esa categoría suele ser un “hábito”
            fuerte (suscripción, comida, transporte, etc.).
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseIntervalsByCategoryTable;
