import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function UnusualExpensesTable({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // ✅ Tokenized UI (igual patrón que venimos usando)
  const ui = useMemo(() => {
    const border = "var(--border-rgba)";
    const panel = "var(--panel)";
    const panel2 = "var(--panel-2)";
    const bg1 = "var(--bg-1)";
    const bg2 = "var(--bg-2)";
    const bg3 = "var(--bg-3)";

    const cardBg = `linear-gradient(135deg, ${bg3}, color-mix(in srgb, ${panel} 78%, transparent), ${bg2})`;
    const headerBg = `color-mix(in srgb, ${panel2} 75%, ${bg3})`;
    const surface = `color-mix(in srgb, ${panel} 65%, transparent)`;
    const surfaceAlt = `color-mix(in srgb, ${panel2} 55%, transparent)`;

    return {
      border,
      text: "var(--text)",
      muted: "var(--muted)",
      primary: "var(--primary)",
      success: "var(--success)",
      danger: "var(--danger)",
      warning: "var(--warning)",
      ring: "var(--ring)",

      card: {
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${border}`,
        background: cardBg,
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
      },

      // Table
      tableWrap: {
        borderRadius: "var(--radius-md)",
        border: `1px solid ${border}`,
        background: surface,
      },
      thead: {
        background: headerBg,
        borderBottom: `1px solid ${border}`,
      },
      rowEvenBg: "transparent",
      rowOddBg: surfaceAlt,
      rowHoverBg: "color-mix(in srgb, var(--panel-2) 65%, transparent)",

      // Numbers
      amountColor: "var(--danger)",
      zHigh: "var(--danger)",
      zMid: "var(--warning)",
      zLow: "var(--text)",
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/unusual-expenses`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res?.data?.data || []))
      .catch((err) => console.error("Error cargando gastos atípicos:", err))
      .finally(() => setLoading(false));
  }, [token, api]);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(safeNum(v));

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      <div>
        <h3 className="text-xl font-semibold" style={{ color: ui.text }}>
          Gastos atípicos (outliers)
        </h3>
        <p className="text-sm mt-1" style={{ color: ui.muted }}>
          Transacciones del mes actual muy por encima de su comportamiento
          histórico por categoría.
        </p>
      </div>

      {loading && data.length === 0 ? (
        <p className="text-sm italic" style={{ color: ui.muted }}>
          Cargando gastos atípicos…
        </p>
      ) : data.length === 0 ? (
        <p className="text-sm italic" style={{ color: ui.muted }}>
          No se detectaron gastos atípicos este mes (o no hay suficiente
          histórico).
        </p>
      ) : (
        <div className="max-h-80 overflow-auto" style={ui.tableWrap}>
          <table className="w-full text-sm" style={{ color: ui.text }}>
            <thead className="sticky top-0" style={ui.thead}>
              <tr>
                <th
                  className="px-3 py-2 text-left text-xs uppercase tracking-wide"
                  style={{ color: ui.muted }}
                >
                  Fecha
                </th>
                <th
                  className="px-3 py-2 text-left text-xs uppercase tracking-wide"
                  style={{ color: ui.muted }}
                >
                  Categoría
                </th>
                <th
                  className="px-3 py-2 text-left text-xs uppercase tracking-wide"
                  style={{ color: ui.muted }}
                >
                  Descripción
                </th>
                <th
                  className="px-3 py-2 text-right text-xs uppercase tracking-wide"
                  style={{ color: ui.muted }}
                >
                  Monto
                </th>
                <th
                  className="px-3 py-2 text-right text-xs uppercase tracking-wide"
                  style={{ color: ui.muted }}
                >
                  z-score
                </th>
              </tr>
            </thead>

            <tbody>
              {data.map((tx, idx) => {
                const z = safeNum(tx.z_score);
                const zColor = z >= 3 ? ui.zHigh : z >= 2.5 ? ui.zMid : ui.zLow;

                const baseBg = idx % 2 === 0 ? ui.rowEvenBg : ui.rowOddBg;

                return (
                  <tr
                    key={tx.id ?? `${tx.date}-${idx}`}
                    style={{
                      background: baseBg,
                      borderTop: `1px solid color-mix(in srgb, ${ui.border} 60%, transparent)`,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = ui.rowHoverBg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = baseBg;
                    }}
                  >
                    <td className="px-3 py-1.5 text-xs" style={{ color: ui.muted }}>
                      {tx.date}
                    </td>

                    <td className="px-3 py-1.5 text-xs" style={{ color: ui.text }}>
                      {tx.category}
                    </td>

                    <td className="px-3 py-1.5 text-xs max-w-[240px] truncate" style={{ color: ui.muted }}>
                      {tx.description || <span style={{ fontStyle: "italic" }}>—</span>}
                    </td>

                    <td
                      className="px-3 py-1.5 text-xs text-right font-semibold"
                      style={{ color: ui.amountColor }}
                    >
                      {formatCurrency(tx.amount)}
                    </td>

                    <td
                      className="px-3 py-1.5 text-xs text-right font-semibold"
                      style={{ color: zColor }}
                      title={
                        Number.isFinite(z)
                          ? z >= 3
                            ? "Muy atípico (≥ 3)"
                            : z >= 2.5
                            ? "Atípico (≥ 2.5)"
                            : "Leve"
                          : ""
                      }
                    >
                      {Number.isFinite(z) ? z.toFixed(2) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[11px]" style={{ color: ui.muted }}>
        Nota: el <span style={{ color: ui.text, fontWeight: 700 }}>z-score</span>{" "}
        mide cuán lejos está el gasto de su media histórica por categoría.
        Mientras más alto, más “raro”.
      </p>
    </div>
  );
}

export default UnusualExpensesTable;
