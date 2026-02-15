import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";
import Modal from "../Modal";

const formatMoney = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

/** Utils tokenizados */
const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function BudgetVsActualSummaryChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [flipped, setFlipped] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const [monthly, setMonthly] = useState([]);
  const [categories, setCategories] = useState([]);

  // "Otros" breakdown
  const [othersBreakdown, setOthersBreakdown] = useState([]);
  const [othersOpen, setOthersOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

  // ===== Tokenized UI =====
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
    const surface2 = `color-mix(in srgb, ${panel2} 65%, transparent)`;

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

      // Controls
      input: {
        background: "var(--control-bg)",
        color: "var(--control-text)",
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-md)",
      },
      inputFocusRing: "var(--control-focus-shadow)",
      inputHoverBorder:
        "color-mix(in srgb, var(--primary) 45%, var(--border-rgba))",

      // Button
      btn: {
        background: "var(--btn-bg)",
        color: "var(--btn-text)",
        border: `1px solid var(--btn-border)`,
        borderRadius: "var(--btn-radius)",
        boxShadow: "var(--btn-glow-shadow)",
      },
      btnHoverBg: "var(--btn-hover-bg)",
      btnHoverBorder: "var(--btn-hover-border)",

      // Recharts
      grid: `color-mix(in srgb, ${border} 55%, transparent)`,
      axis: `color-mix(in srgb, ${border} 85%, transparent)`,
      tick: "var(--text)",
      tickMuted: `color-mix(in srgb, var(--muted) 92%, var(--text))`,
      cursorFill: "color-mix(in srgb, var(--border-rgba) 25%, transparent)",

      // Tooltip
      tooltipBg: `color-mix(in srgb, ${bg1} 88%, #000)`,
      tooltipBorder: `color-mix(in srgb, ${border} 85%, transparent)`,

      // Legend pill
      legendPillBg: surface2,
      headerBg,
      surface,
      surface2,

      // Semantic series colors (IMPORTANT)
      seriesBudget: "var(--primary)", // presupuesto
      seriesSpent: "var(--danger)", // gasto
      diffUp: "var(--danger)",
      diffDown: "var(--success)",
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    const fetchBoth = async () => {
      setLoading(true);
      try {
        const [mRes, cRes] = await Promise.all([
          axios.get(`${api}/analytics/budget-vs-actual-summary-yearly`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { year, view: "monthly" },
          }),
          axios.get(`${api}/analytics/budget-vs-actual-summary-yearly`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { year, view: "categories" },
          }),
        ]);

        setMonthly(mRes?.data?.data || []);
        setCategories(cRes?.data?.data || []);
        setOthersBreakdown(cRes?.data?.meta?.others_breakdown || []);
      } catch (err) {
        console.error("Error al cargar resumen anual presupuesto vs gasto:", err);
        setMonthly([]);
        setCategories([]);
        setOthersBreakdown([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBoth();
  }, [token, api, year]);

  const totalsMonthly = useMemo(() => {
    const budgeted = (monthly || []).reduce((acc, r) => acc + safeNum(r.budgeted), 0);
    const spent = (monthly || []).reduce((acc, r) => acc + safeNum(r.spent), 0);
    return { budgeted, spent, diff: spent - budgeted };
  }, [monthly]);

  const totalsCategories = useMemo(() => {
    const budgeted = (categories || []).reduce((acc, r) => acc + safeNum(r.budgeted), 0);
    const spent = (categories || []).reduce((acc, r) => acc + safeNum(r.spent), 0);
    return { budgeted, spent, diff: spent - budgeted };
  }, [categories]);

  const monthTick = (m) => (typeof m === "string" ? m.slice(5, 7) : m);

  const othersTotals = useMemo(() => {
    const budgeted = (othersBreakdown || []).reduce((acc, r) => acc + safeNum(r.budgeted), 0);
    const spent = (othersBreakdown || []).reduce((acc, r) => acc + safeNum(r.spent), 0);
    return { budgeted, spent, diff: spent - budgeted, count: othersBreakdown.length };
  }, [othersBreakdown]);

  // click robusto (Recharts Bar onClick)
  const handleBarClickCategory = (barData) => {
    const row = barData?.payload;
    if (!row) return;

    const isOthers =
      row.category_id === "others" ||
      String(row.category || "").trim().toLowerCase() === "otros";

    if (isOthers) setOthersOpen(true);
  };

  const flipLabel = flipped ? "Ver por mes" : "Ver por categoría";

  // ===== Tooltips tokenizados =====
  function CustomTooltipMonthly({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload;
    if (!row) return null;

    const diff = safeNum(row.diff);
    const diffColor = diff >= 0 ? ui.diffUp : ui.diffDown;

    return (
      <div
        style={{
          background: ui.tooltipBg,
          color: ui.text,
          padding: "10px 12px",
          border: `1px solid ${ui.tooltipBorder}`,
          borderRadius: "12px",
          fontSize: "0.95rem",
          boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
        }}
      >
        <p style={{ marginBottom: 6, fontWeight: 800, color: ui.text }}>{label}</p>
        <p style={{ margin: 0, color: ui.muted }}>
          Presupuesto: <span style={{ color: ui.text, fontWeight: 800 }}>{formatMoney(row.budgeted)}</span>
        </p>
        <p style={{ margin: 0, color: ui.muted }}>
          Gasto: <span style={{ color: ui.text, fontWeight: 800 }}>{formatMoney(row.spent)}</span>
        </p>
        <p style={{ marginTop: 6, marginBottom: 0, color: diffColor, fontWeight: 900 }}>
          Diferencia: {formatMoney(diff)}
        </p>
      </div>
    );
  }

  function CustomTooltipCategory({ active, payload, label }) {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload;
    if (!row) return null;

    const diff = safeNum(row.diff);
    const diffColor = diff >= 0 ? ui.diffUp : ui.diffDown;

    return (
      <div
        style={{
          background: ui.tooltipBg,
          color: ui.text,
          padding: "10px 12px",
          border: `1px solid ${ui.tooltipBorder}`,
          borderRadius: "12px",
          fontSize: "0.95rem",
          boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
        }}
      >
        <p style={{ marginBottom: 6, fontWeight: 800, color: ui.text }}>{label}</p>
        <p style={{ margin: 0, color: ui.muted }}>
          Presupuesto anual:{" "}
          <span style={{ color: ui.text, fontWeight: 800 }}>{formatMoney(row.budgeted)}</span>
        </p>
        <p style={{ margin: 0, color: ui.muted }}>
          Gasto anual:{" "}
          <span style={{ color: ui.text, fontWeight: 800 }}>{formatMoney(row.spent)}</span>
        </p>
        <p style={{ marginTop: 6, marginBottom: 0, color: diffColor, fontWeight: 900 }}>
          Diferencia: {formatMoney(diff)}
        </p>
      </div>
    );
  }

  return (
    <div
      className="relative overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-0.5 min-h-[520px]"
      style={ui.card}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-6 pb-0">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: ui.text }}>
            Presupuesto vs Gasto Total (Anual)
          </h3>
          <p className="text-sm mt-1" style={{ color: ui.muted }}>
            Alterna entre vista por mes y vista por categoría.
          </p>
        </div>

        <div className="flex items-end gap-3">
          {/* Año */}
          <div className="flex flex-col items-end">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: ui.muted }}
            >
              Año
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="mt-1 px-3 py-2 text-sm"
              style={ui.input}
              onFocus={(e) => {
                e.currentTarget.style.boxShadow = ui.inputFocusRing;
                e.currentTarget.style.borderColor = ui.inputHoverBorder;
              }}
              onBlur={(e) => {
                e.currentTarget.style.boxShadow = "none";
                e.currentTarget.style.borderColor = ui.border;
              }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {loading ? (
              <span className="text-xs mt-1" style={{ color: ui.muted }}>
                Actualizando…
              </span>
            ) : null}
          </div>

          {/* Botón flip tokenizado */}
          <button
            onClick={() => setFlipped((p) => !p)}
            type="button"
            className="mt-[18px] inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition"
            style={ui.btn}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = ui.btnHoverBg;
              e.currentTarget.style.borderColor = ui.btnHoverBorder;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = ui.btn.background;
              e.currentTarget.style.borderColor = "var(--btn-border)";
            }}
            title="Cambiar vista"
          >
            <span
              className="inline-flex h-6 w-6 items-center justify-center"
              style={{
                borderRadius: "10px",
                border: `1px solid ${ui.border}`,
                background: "color-mix(in srgb, var(--panel) 55%, transparent)",
                color: ui.text,
              }}
            >
              ↔
            </span>
            {flipLabel}
          </button>
        </div>
      </div>

      {/* Body flip */}
      <div className="px-6 pb-6 pt-4">
        <div
          className={`
            relative w-full
            transition-transform duration-500
            [transform-style:preserve-3d]
            ${flipped ? "[transform:rotateY(180deg)]" : ""}
          `}
          style={{ minHeight: 420 }}
        >
          {/* FRONT: mensual */}
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Vista
                </p>
                <p className="text-sm font-semibold" style={{ color: ui.text }}>
                  Totales por mes (12 meses)
                </p>
              </div>

              <div className="text-right text-sm">
                <div style={{ color: ui.muted }}>
                  Presupuesto:{" "}
                  <span style={{ color: ui.text, fontWeight: 800 }}>
                    {formatMoney(totalsMonthly.budgeted)}
                  </span>
                </div>
                <div style={{ color: ui.muted }}>
                  Gasto:{" "}
                  <span style={{ color: ui.danger, fontWeight: 800 }}>
                    {formatMoney(totalsMonthly.spent)}
                  </span>
                </div>
              </div>
            </div>

            {monthly.length === 0 ? (
              <p className="text-sm italic" style={{ color: ui.muted }}>
                No hay datos disponibles.
              </p>
            ) : (
              <div className="w-full h-[340px]">
                <ResponsiveContainer>
                  <BarChart data={monthly}>
                    <CartesianGrid stroke={ui.grid} strokeDasharray="4 4" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={monthTick}
                      tick={{ fill: ui.tick, fontSize: 14 }}
                      axisLine={{ stroke: ui.axis }}
                      tickLine={{ stroke: ui.axis }}
                    />
                    <YAxis
                      tick={{ fill: ui.tick, fontSize: 14 }}
                      axisLine={{ stroke: ui.axis }}
                      tickLine={{ stroke: ui.axis }}
                    />
                    <Tooltip
                      content={<CustomTooltipMonthly />}
                      cursor={{ fill: ui.cursorFill }}
                    />
                    <Legend
                      wrapperStyle={{ color: ui.text }}
                      formatter={(value) => (
                        <span
                          style={{
                            color: ui.text,
                            background: ui.legendPillBg,
                            border: `1px solid color-mix(in srgb, ${ui.border} 70%, transparent)`,
                            padding: "2px 8px",
                            borderRadius: 999,
                          }}
                        >
                          {value}
                        </span>
                      )}
                    />
                    {/* Presupuesto = primary */}
                    <Bar
                      dataKey="budgeted"
                      name="Presupuesto Total"
                      fill={ui.seriesBudget}
                      radius={[6, 6, 0, 0]}
                    />
                    {/* Gasto = danger */}
                    <Bar
                      dataKey="spent"
                      name="Gasto Total"
                      fill={ui.seriesSpent}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* BACK: categorías */}
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Vista
                </p>
                <p className="text-sm font-semibold" style={{ color: ui.text }}>
                  Segmentado por categoría (Top + Otros)
                </p>
              </div>

              <div className="text-right text-sm">
                <div style={{ color: ui.muted }}>
                  Presupuesto:{" "}
                  <span style={{ color: ui.text, fontWeight: 800 }}>
                    {formatMoney(totalsCategories.budgeted)}
                  </span>
                </div>
                <div style={{ color: ui.muted }}>
                  Gasto:{" "}
                  <span style={{ color: ui.danger, fontWeight: 800 }}>
                    {formatMoney(totalsCategories.spent)}
                  </span>
                </div>
              </div>
            </div>

            {categories.length === 0 ? (
              <p className="text-sm italic" style={{ color: ui.muted }}>
                No hay datos disponibles.
              </p>
            ) : (
              <div className="w-full h-[340px]">
                <ResponsiveContainer>
                  <BarChart data={categories}>
                    <CartesianGrid stroke={ui.grid} strokeDasharray="4 4" />
                    <XAxis
                      dataKey="category"
                      tick={{ fill: ui.tick, fontSize: 12 }}
                      axisLine={{ stroke: ui.axis }}
                      tickLine={{ stroke: ui.axis }}
                    />
                    <YAxis
                      tick={{ fill: ui.tick, fontSize: 14 }}
                      axisLine={{ stroke: ui.axis }}
                      tickLine={{ stroke: ui.axis }}
                    />
                    <Tooltip
                      content={<CustomTooltipCategory />}
                      cursor={{ fill: ui.cursorFill }}
                    />
                    <Legend
                      wrapperStyle={{ color: ui.text }}
                      formatter={(value) => (
                        <span
                          style={{
                            color: ui.text,
                            background: ui.legendPillBg,
                            border: `1px solid color-mix(in srgb, ${ui.border} 70%, transparent)`,
                            padding: "2px 8px",
                            borderRadius: 999,
                          }}
                        >
                          {value}
                        </span>
                      )}
                    />

                    {/* Click en barras abre “Otros” */}
                    <Bar
                      dataKey="budgeted"
                      name="Presupuesto anual"
                      fill={ui.seriesBudget}
                      radius={[6, 6, 0, 0]}
                      onClick={handleBarClickCategory}
                    />
                    <Bar
                      dataKey="spent"
                      name="Gasto anual"
                      fill={ui.seriesSpent}
                      radius={[6, 6, 0, 0]}
                      onClick={handleBarClickCategory}
                    />
                  </BarChart>
                </ResponsiveContainer>

                <p className="text-xs mt-2" style={{ color: ui.muted }}>
                  Tip: haz click en{" "}
                  <span style={{ color: ui.text, fontWeight: 800 }}>Otros</span>{" "}
                  para ver el desglose.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal "Otros" (tu Modal ya está tokenizado) */}
      <Modal
        isOpen={othersOpen}
        onClose={() => setOthersOpen(false)}
        title={`Desglose de "Otros" — ${year}`}
        size="lg"
      >
        {othersBreakdown.length === 0 ? (
          <p className="text-sm italic" style={{ color: ui.muted }}>
            No hay categorías dentro de "Otros".
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm" style={{ color: ui.muted }}>
                Categorías agrupadas en{" "}
                <span style={{ color: ui.text, fontWeight: 800 }}>Otros</span>,
                ordenadas por gasto.
              </p>

              <div className="text-xs sm:text-sm" style={{ color: ui.muted }}>
                <span style={{ color: ui.text, fontWeight: 700 }}>
                  {othersTotals.count} categorías
                </span>
                <span className="mx-2" style={{ color: ui.muted }}>
                  ·
                </span>
                <span style={{ color: ui.text, fontWeight: 700 }}>Total:</span>{" "}
                <span style={{ color: ui.danger, fontWeight: 800 }}>
                  {formatMoney(othersTotals.spent)}
                </span>
              </div>
            </div>

            <div
              className="max-h-[420px] overflow-auto"
              style={{
                borderRadius: "var(--radius-md)",
                border: `1px solid ${ui.border}`,
                background: ui.surface,
              }}
            >
              <table className="w-full text-sm">
                <thead
                  className="sticky top-0"
                  style={{
                    background: ui.headerBg,
                    borderBottom: `1px solid ${ui.border}`,
                  }}
                >
                  <tr style={{ color: ui.text }}>
                    <th className="text-left px-3 py-2">Categoría</th>
                    <th className="text-right px-3 py-2">Presupuesto</th>
                    <th className="text-right px-3 py-2">Gasto</th>
                    <th className="text-right px-3 py-2">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {othersBreakdown.map((r, idx) => {
                    const diff = safeNum(r.diff);
                    const diffColor = diff >= 0 ? ui.diffUp : ui.diffDown;

                    const baseBg =
                      idx % 2 === 0
                        ? "transparent"
                        : "color-mix(in srgb, var(--panel) 35%, transparent)";

                    return (
                      <tr
                        key={r.category_id}
                        style={{
                          borderTop: `1px solid color-mix(in srgb, ${ui.border} 60%, transparent)`,
                          background: baseBg,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background =
                            "color-mix(in srgb, var(--panel-2) 55%, transparent)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = baseBg;
                        }}
                      >
                        <td className="px-3 py-2" style={{ color: ui.text }}>
                          {r.category}
                        </td>
                        <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                          {formatMoney(r.budgeted)}
                        </td>
                        <td
                          className="px-3 py-2 text-right"
                          style={{ color: ui.danger, fontWeight: 700 }}
                        >
                          {formatMoney(r.spent)}
                        </td>
                        <td
                          className="px-3 py-2 text-right"
                          style={{ color: diffColor, fontWeight: 800 }}
                        >
                          {formatMoney(diff)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <p className="text-xs" style={{ color: ui.muted }}>
              Nota: si quieres ver TODAS las categorías sin agrupar, podemos
              agregar un modo “sin Otros”.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default BudgetVsActualSummaryChart;
