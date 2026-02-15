// src/components/ItemMonthlyComparisonTable.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";

function ItemMonthlyComparisonTable({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const today = new Date();

  // Mes 2: actual
  const defaultYear2 = today.getFullYear();
  const defaultMonth2 = today.getMonth() + 1; // 1-12

  // Mes 1: anterior
  let defaultYear1 = defaultYear2;
  let defaultMonth1 = defaultMonth2 - 1;
  if (defaultMonth1 < 1) {
    defaultMonth1 = 12;
    defaultYear1 = defaultYear2 - 1;
  }

  const [rows, setRows] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  const [year1, setYear1] = useState(defaultYear1);
  const [month1, setMonth1] = useState(defaultMonth1);
  const [year2, setYear2] = useState(defaultYear2);
  const [month2, setMonth2] = useState(defaultMonth2);

  // ===== Tokenized UI =====
  const ui = useMemo(() => {
    const border = "var(--border-rgba)";
    const cardBg =
      "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 78%, transparent), var(--bg-2))";

    const headerBg = "color-mix(in srgb, var(--panel-2) 75%, var(--bg-3))";
    const surface = "color-mix(in srgb, var(--panel) 65%, transparent)";
    const surface2 = "color-mix(in srgb, var(--panel-2) 65%, transparent)";

    return {
      border,
      card: {
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${border}`,
        background: cardBg,
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
      },
      tableWrap: {
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-md)",
        background: surface,
      },
      theadBg: headerBg,
      rowHover: "color-mix(in srgb, var(--panel-2) 55%, transparent)",
      text: "var(--text)",
      muted: "var(--muted)",
      // deltas (si sube gasto/cant => rojo)
      up: "var(--danger)",
      down: "var(--success)",
      neutral: "color-mix(in srgb, var(--muted) 85%, var(--text))",
      // inputs
      input: {
        background: "var(--control-bg)",
        color: "var(--control-text)",
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-sm)",
        boxShadow: "none",
      },
      inputFocusRing: "var(--control-focus-shadow)",
      inputHoverBorder:
        "color-mix(in srgb, var(--primary) 45%, var(--border-rgba))",
      // pills/meta
      pillBg: surface2,
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${api}/analytics/item-monthly-comparison`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { year1, month1, year2, month2 },
        });
        setRows(res.data?.data || []);
        setMeta(res.data?.meta || null);
      } catch (err) {
        console.error("Error al cargar comparativo por artículo:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token, api, year1, month1, year2, month2]);

  const formatCurrency = (value) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

  const formatQty = (value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0.00";
    return n.toFixed(2);
  };

  const monthLabel = (yyyyMm) => {
    if (!yyyyMm) return "—";
    const [y, m] = String(yyyyMm).split("-");
    return `${m}/${y}`;
  };

  const handleYear1Change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) setYear1(val);
  };
  const handleMonth1Change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val) && val >= 1 && val <= 12) setMonth1(val);
  };
  const handleYear2Change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val)) setYear2(val);
  };
  const handleMonth2Change = (e) => {
    const val = parseInt(e.target.value, 10);
    if (!Number.isNaN(val) && val >= 1 && val <= 12) setMonth2(val);
  };

  const totalDiffAmount = useMemo(() => {
    const m1 = Number(meta?.month1_total_amount || 0);
    const m2 = Number(meta?.month2_total_amount || 0);
    return m2 - m1;
  }, [meta]);

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      {/* Header + filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3
            className="text-lg md:text-xl font-semibold"
            style={{ color: ui.text }}
          >
            Comparativo mensual por artículo
          </h3>
          <p className="text-sm mt-1" style={{ color: ui.muted }}>
            Compara cantidades y montos por artículo entre dos meses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2" style={{ color: ui.text }}>
            <span style={{ color: ui.muted }}>Mes 1:</span>

            <input
              type="number"
              value={year1}
              onChange={handleYear1Change}
              min="2000"
              className="w-20 px-2 py-1"
              style={ui.input}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = ui.inputFocusRing;
                e.currentTarget.style.borderColor = ui.inputHoverBorder;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = ui.border;
              }}
            />

            <input
              type="number"
              value={month1}
              onChange={handleMonth1Change}
              min="1"
              max="12"
              className="w-16 px-2 py-1"
              style={ui.input}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = ui.inputFocusRing;
                e.currentTarget.style.borderColor = ui.inputHoverBorder;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = ui.border;
              }}
            />
          </div>

          <div className="flex items-center gap-2" style={{ color: ui.text }}>
            <span style={{ color: ui.muted }}>Mes 2:</span>

            <input
              type="number"
              value={year2}
              onChange={handleYear2Change}
              min="2000"
              className="w-20 px-2 py-1"
              style={ui.input}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = ui.inputFocusRing;
                e.currentTarget.style.borderColor = ui.inputHoverBorder;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = ui.border;
              }}
            />

            <input
              type="number"
              value={month2}
              onChange={handleMonth2Change}
              min="1"
              max="12"
              className="w-16 px-2 py-1"
              style={ui.input}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = ui.inputFocusRing;
                e.currentTarget.style.borderColor = ui.inputHoverBorder;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = ui.border;
              }}
            />
          </div>
        </div>
      </div>

      {/* Meta de totales */}
      {meta ? (
        <div className="flex flex-wrap gap-3 text-xs sm:text-sm">
          <div
            className="rounded-xl px-3 py-2"
            style={{
              background: ui.pillBg,
              border: `1px solid color-mix(in srgb, ${ui.border} 75%, transparent)`,
              color: ui.muted,
            }}
          >
            <span>Mes 1:</span>{" "}
            <strong style={{ color: ui.text }}>{monthLabel(meta.month1)}</strong>{" "}
            <span>— Total gasto:</span>{" "}
            <strong style={{ color: "var(--primary)" }}>
              {formatCurrency(meta.month1_total_amount)}
            </strong>
          </div>

          <div
            className="rounded-xl px-3 py-2"
            style={{
              background: ui.pillBg,
              border: `1px solid color-mix(in srgb, ${ui.border} 75%, transparent)`,
              color: ui.muted,
            }}
          >
            <span>Mes 2:</span>{" "}
            <strong style={{ color: ui.text }}>{monthLabel(meta.month2)}</strong>{" "}
            <span>— Total gasto:</span>{" "}
            <strong style={{ color: "var(--primary)" }}>
              {formatCurrency(meta.month2_total_amount)}
            </strong>
          </div>

          <div
            className="rounded-xl px-3 py-2"
            style={{
              background: ui.pillBg,
              border: `1px solid color-mix(in srgb, ${ui.border} 75%, transparent)`,
              color: ui.muted,
            }}
          >
            <span>Diferencia total:</span>{" "}
            <strong
              style={{
                color:
                  totalDiffAmount > 0
                    ? ui.up
                    : totalDiffAmount < 0
                    ? ui.down
                    : ui.neutral,
              }}
            >
              {formatCurrency(totalDiffAmount)}
            </strong>
          </div>
        </div>
      ) : null}

      {/* Tabla / estados */}
      {loading ? (
        <p className="text-sm" style={{ color: ui.muted }}>
          Cargando comparativo...
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm" style={{ color: ui.muted }}>
          No hay datos de gastos para los meses seleccionados.
        </p>
      ) : (
        <div
          className="overflow-x-auto max-h-96 overflow-y-auto"
          style={ui.tableWrap}
        >
          <table className="min-w-full text-sm">
            <thead>
              <tr style={{ background: ui.theadBg, color: ui.muted }}>
                <th className="px-3 py-2 text-left font-medium">Artículo</th>

                <th className="px-3 py-2 text-right font-medium">
                  Cant. Mes 1 ({monthLabel(meta?.month1)})
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Monto Mes 1 ({monthLabel(meta?.month1)})
                </th>

                <th className="px-3 py-2 text-right font-medium">
                  Cant. Mes 2 ({monthLabel(meta?.month2)})
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Monto Mes 2 ({monthLabel(meta?.month2)})
                </th>

                <th className="px-3 py-2 text-right font-medium">
                  Dif. monto (Mes 2 − Mes 1)
                </th>
                <th className="px-3 py-2 text-right font-medium">
                  Dif. cantidad (Mes 2 − Mes 1)
                </th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, idx) => {
                const diffAmount = Number(row.diff_amount || 0);
                const diffQty = Number(row.diff_qty || 0);

                const amountColor =
                  diffAmount > 0 ? ui.up : diffAmount < 0 ? ui.down : ui.neutral;

                const qtyColor =
                  diffQty > 0 ? ui.up : diffQty < 0 ? ui.down : ui.neutral;

                const baseBg =
                  idx % 2 === 0
                    ? "transparent"
                    : "color-mix(in srgb, var(--panel) 35%, transparent)";

                return (
                  <tr
                    key={row.item_id}
                    style={{
                      borderBottom: `1px solid color-mix(in srgb, ${ui.border} 60%, transparent)`,
                      background: baseBg,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = ui.rowHover;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = baseBg;
                    }}
                  >
                    <td className="px-3 py-2 whitespace-nowrap" style={{ color: ui.text }}>
                      {row.item_name}
                    </td>

                    <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                      {formatQty(row.month1_qty)}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                      {formatCurrency(row.month1_amount)}
                    </td>

                    <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                      {formatQty(row.month2_qty)}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                      {formatCurrency(row.month2_amount)}
                    </td>

                    <td className="px-3 py-2 text-right" style={{ color: amountColor }}>
                      {formatCurrency(diffAmount)}
                    </td>
                    <td className="px-3 py-2 text-right" style={{ color: qtyColor }}>
                      {formatQty(diffQty)}
                    </td>
                  </tr>
                );
              })}

              {/* Totales */}
              {meta ? (
                <tr style={{ background: ui.theadBg, fontWeight: 700 }}>
                  <td className="px-3 py-2 text-left" style={{ color: ui.text }}>
                    TOTAL
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: ui.muted }}>
                    —
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                    {formatCurrency(meta.month1_total_amount)}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: ui.muted }}>
                    —
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                    {formatCurrency(meta.month2_total_amount)}
                  </td>
                  <td
                    className="px-3 py-2 text-right"
                    style={{
                      color:
                        totalDiffAmount > 0
                          ? ui.up
                          : totalDiffAmount < 0
                          ? ui.down
                          : ui.neutral,
                    }}
                  >
                    {formatCurrency(totalDiffAmount)}
                  </td>
                  <td className="px-3 py-2 text-right" style={{ color: ui.muted }}>
                    —
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs mt-1" style={{ color: ui.muted }}>
        La diferencia de monto y de cantidad se calculan como Mes 2 − Mes 1.
      </p>
    </div>
  );
}

export default ItemMonthlyComparisonTable;
