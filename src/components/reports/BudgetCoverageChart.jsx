// BudgetCoverageChart.jsx (tokenizado + click en mes -> modal detalle)
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Modal from "../Modal"; // ajusta ruta
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export default function BudgetCoverageChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [data, setData] = useState(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  // Modal states
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

  const ui = useMemo(() => {
    const styles = {
      card: {
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-rgba)",
        background:
          "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 78%, transparent), var(--bg-2))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
        color: "var(--text)",
      },
      softPanel: {
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-rgba)",
        backgroundColor: "color-mix(in srgb, var(--panel) 70%, transparent)",
      },
      badge: {
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-rgba)",
        backgroundColor: "color-mix(in srgb, var(--panel) 62%, transparent)",
        color: "var(--text)",
      },
      badgeHoverBg: "color-mix(in srgb, var(--panel) 78%, transparent)",
      warnBadge: {
        borderRadius: "var(--radius-md)",
        border:
          "1px solid color-mix(in srgb, var(--warning) 38%, var(--border-rgba))",
        backgroundColor: "color-mix(in srgb, var(--warning) 12%, transparent)",
        color: "color-mix(in srgb, var(--warning) 70%, var(--text))",
      },

      // colores semánticos
      covered: "var(--success)",
      uncovered: "var(--warning)",

      // texto
      heading: "var(--heading)",
      text: "var(--text)",
      muted: "var(--muted)",

      // chart
      axis: "color-mix(in srgb, var(--muted) 80%, transparent)",
      tick: { fill: "var(--text)", fontSize: 12 },
      grid: { stroke: "var(--border-rgba)", strokeDasharray: "4 4" },
      cursorFill: "color-mix(in srgb, var(--text) 6%, transparent)",

      tooltip: {
        backgroundColor: "var(--bg-3)",
        border: "1px solid var(--border-rgba)",
        color: "var(--text)",
        borderRadius: "12px",
        boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
        padding: "10px 12px",
        fontSize: "0.95rem",
      },

      // controls
      select: {
        marginTop: 6,
        backgroundColor: "var(--control-bg)",
        color: "var(--control-text)",
        border: "1px solid var(--control-border)",
        borderRadius: "var(--radius-md)",
        padding: "6px 10px",
        fontSize: 14,
        outline: "none",
        boxShadow: "none",
      },
      tableWrap: {
        border: "1px solid var(--border-rgba)",
        borderRadius: "var(--radius-lg)",
        backgroundColor: "color-mix(in srgb, var(--panel) 55%, transparent)",
      },
      tableHead: {
        backgroundColor: "color-mix(in srgb, var(--bg-3) 92%, transparent)",
        borderBottom: "1px solid var(--border-rgba)",
      },
      rowDivider: "1px solid color-mix(in srgb, var(--border-rgba) 60%, transparent)",
      rowHover: "color-mix(in srgb, var(--panel) 72%, transparent)",
    };
    return styles;
  }, []);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

  const formatCompact = (v) =>
    new Intl.NumberFormat("es-DO", { notation: "compact" }).format(
      Number.isFinite(Number(v)) ? Number(v) : 0
    );

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/budget-coverage`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year },
      })
      .then((res) => setData(res.data.data))
      .catch((err) =>
        console.error("Error cargando cobertura de presupuestos:", err)
      )
      .finally(() => setLoading(false));
  }, [token, year, api]);

  const openMonthDetail = async (month) => {
    if (!month || !token) return;
    setSelectedMonth(month);
    setIsDetailOpen(true);
    setDetail(null);
    setDetailLoading(true);

    try {
      const res = await axios.get(`${api}/analytics/budget-coverage/details`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year, month, limit: 80 },
      });
      setDetail(res.data.data);
    } catch (err) {
      console.error("Error cargando detalle del mes:", err);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeMonthDetail = () => {
    setIsDetailOpen(false);
    setSelectedMonth(null);
    setDetail(null);
    setDetailLoading(false);
  };

  if (loading && !data) {
    return (
      <div className="rounded-2xl p-6 text-sm" style={ui.card}>
        <span style={{ color: ui.muted }}>Cargando cobertura de presupuestos...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl p-6 text-sm" style={ui.card}>
        <span style={{ color: ui.muted }}>No hay datos para mostrar.</span>
      </div>
    );
  }

  const monthly = Array.isArray(data.monthly) ? data.monthly : [];
  const topCats = Array.isArray(data.top_unbudgeted_categories)
    ? data.top_unbudgeted_categories.slice(0, 5)
    : [];
  const topMonths = Array.isArray(data.top_unbudgeted_months)
    ? data.top_unbudgeted_months.slice(0, 5)
    : [];

  const totals = data.totals || {
    total_expense: 0,
    covered: 0,
    uncovered: 0,
    coverage_pct: 0,
  };

  const criticalMonth = Array.isArray(data.top_unbudgeted_months)
    ? data.top_unbudgeted_months[0]
    : null;

  const monthLabel = (m) => {
    if (!m || typeof m !== "string") return m;
    return m.slice(5, 7);
  };

  const hasUncategorized = topCats.some(
    (c) => c.category_id === "__uncategorized__"
  );

  const handleBarClick = (barData) => {
    const month = barData?.payload?.month;
    if (!month) return;
    openMonthDetail(month);
  };

  const detailTotals = detail?.totals || null;
  const detailTopCats = Array.isArray(detail?.top_unbudgeted_categories)
    ? detail.top_unbudgeted_categories
    : [];
  const detailTx = Array.isArray(detail?.uncovered_transactions)
    ? detail.uncovered_transactions
    : [];

  return (
    <>
      <div className="rounded-2xl p-6 space-y-5" style={ui.card}>
        {/* Header + Año */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold" style={{ color: ui.heading }}>
              Calidad de presupuestos
            </h3>
            <p className="text-sm mt-1" style={{ color: ui.muted }}>
              Cobertura mensual real: un gasto cuenta como cubierto solo si existe
              presupuesto para esa categoría en ese mismo mes.
            </p>
          </div>

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
              style={ui.select}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--control-border-focus)";
                e.currentTarget.style.boxShadow = "var(--control-focus-shadow)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "var(--control-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <p className="text-xs mt-2 text-right" style={{ color: ui.text }}>
              Cobertura anual:{" "}
              <span style={{ fontWeight: 800, color: ui.covered }}>
                {Number.isFinite(Number(totals.coverage_pct))
                  ? Number(totals.coverage_pct).toFixed(2)
                  : "0.00"}
                %
              </span>
            </p>

            {loading ? (
              <span className="text-[11px] mt-1" style={{ color: ui.muted }}>
                Actualizando…
              </span>
            ) : null}
          </div>
        </div>

        {/* Badge mes crítico + alerta sin categoría */}
        <div className="flex flex-wrap items-center gap-2">
          {criticalMonth?.month ? (
            <button
              onClick={() => openMonthDetail(criticalMonth.month)}
              className="text-left px-3 py-2 text-xs transition"
              style={ui.badge}
              title="Abrir detalle del mes"
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = ui.badgeHoverBg;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = ui.badge.backgroundColor;
              }}
            >
              <span style={{ color: ui.muted }}>Mes crítico:</span>{" "}
              <span style={{ fontWeight: 800, color: ui.text }}>
                {criticalMonth.month}
              </span>{" "}
              <span style={{ color: ui.muted }}>—</span>{" "}
              <span style={{ fontWeight: 800, color: ui.uncovered }}>
                {formatCurrency(criticalMonth.uncovered_total)}
              </span>{" "}
              <span style={{ color: ui.muted }}>sin presupuesto</span>
              <span className="ml-2" style={{ color: ui.muted }}>
                ↗
              </span>
            </button>
          ) : (
            <div className="px-3 py-2 text-xs" style={ui.badge}>
              <span style={{ color: ui.muted }}>
                No se detectan meses críticos sin presupuesto.
              </span>
            </div>
          )}

          {hasUncategorized ? (
            <div className="px-3 py-2 text-xs" style={ui.warnBadge}>
              ⚠️ Hay gastos <span style={{ fontWeight: 800 }}>sin categoría</span>.
              Eso siempre contará como{" "}
              <span style={{ fontWeight: 800 }}>sin presupuesto</span>.
            </div>
          ) : null}
        </div>

        {/* Totales */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="p-4" style={ui.softPanel}>
            <div
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: ui.muted }}
            >
              Gasto total
            </div>
            <div className="text-xl font-extrabold mt-1" style={{ color: ui.text }}>
              {formatCurrency(totals.total_expense)}
            </div>
          </div>

          <div className="p-4" style={ui.softPanel}>
            <div
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: ui.muted }}
            >
              Cubierto
            </div>
            <div
              className="text-xl font-extrabold mt-1"
              style={{ color: ui.covered }}
            >
              {formatCurrency(totals.covered)}
            </div>
          </div>

          <div className="p-4" style={ui.softPanel}>
            <div
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: ui.muted }}
            >
              Sin presupuesto
            </div>
            <div
              className="text-xl font-extrabold mt-1"
              style={{ color: ui.uncovered }}
            >
              {formatCurrency(totals.uncovered)}
            </div>
          </div>
        </div>

        {/* Chart + Listas */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Gráfico mensual apilado */}
          <div className="w-full h-[360px] md:h-[460px]">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid {...ui.grid} />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  stroke={ui.axis}
                  tick={ui.tick}
                />
                <YAxis
                  stroke={ui.axis}
                  tick={ui.tick}
                  tickFormatter={formatCompact}
                />

                <Tooltip
                  formatter={(val, name) => [
                    formatCurrency(val),
                    name === "covered" ? "Cubierto" : "Sin presupuesto",
                  ]}
                  labelFormatter={(label) => `Mes: ${label} (click para detalle)`}
                  contentStyle={ui.tooltip}
                  itemStyle={{ color: ui.text }}
                  labelStyle={{ color: ui.text, fontWeight: 800 }}
                  cursor={{ fill: ui.cursorFill }}
                />

                <Legend
                  wrapperStyle={{ color: ui.text }}
                  formatter={(value) => (
                    <span style={{ color: ui.text, fontSize: 14 }}>
                      {value === "covered" ? "Cubierto" : "Sin presupuesto"}
                    </span>
                  )}
                />

                <Bar
                  dataKey="covered"
                  stackId="a"
                  fill={ui.covered}
                  cursor="pointer"
                  onClick={handleBarClick}
                  radius={[6, 0, 0, 6]}
                />
                <Bar
                  dataKey="uncovered"
                  stackId="a"
                  fill={ui.uncovered}
                  cursor="pointer"
                  onClick={handleBarClick}
                  radius={[0, 6, 6, 0]}
                />
              </BarChart>
            </ResponsiveContainer>

            <p className="text-xs mt-2" style={{ color: ui.muted }}>
              Click en un mes para ver detalle.
            </p>
          </div>

          {/* Listas */}
          <div className="space-y-4 text-sm" style={{ color: ui.text }}>
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: ui.muted }}
              >
                Top categorías con gasto sin presupuesto (año)
              </h4>

              {topCats.length === 0 ? (
                <p className="text-xs italic" style={{ color: ui.muted }}>
                  No hay gasto sin presupuesto para este año.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topCats.map((c) => {
                    const isUncat = c.category_id === "__uncategorized__";
                    return (
                      <li
                        key={c.category_id}
                        className="flex justify-between gap-2 px-3 py-2"
                        style={ui.softPanel}
                      >
                        <span className="truncate flex items-center gap-2">
                          {isUncat ? (
                            <span style={{ color: "var(--warning)", fontSize: 12 }}>
                              ⚠️
                            </span>
                          ) : null}
                          <span
                            style={{
                              color: isUncat
                                ? "color-mix(in srgb, var(--warning) 70%, var(--text))"
                                : ui.text,
                            }}
                          >
                            {c.category_name}
                          </span>
                        </span>

                        <span
                          className="font-semibold whitespace-nowrap"
                          style={{ color: ui.uncovered }}
                        >
                          {formatCurrency(c.uncovered_total)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: ui.muted }}
              >
                Meses con más gasto sin presupuesto
              </h4>

              {topMonths.length === 0 ? (
                <p className="text-xs italic" style={{ color: ui.muted }}>
                  No hay meses con gasto sin presupuesto.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topMonths.map((m) => (
                    <button
                      key={m.month}
                      onClick={() => openMonthDetail(m.month)}
                      className="w-full text-left flex justify-between gap-2 px-3 py-2 transition"
                      style={ui.softPanel}
                      title="Abrir detalle del mes"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = ui.badgeHoverBg;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          ui.softPanel.backgroundColor;
                      }}
                    >
                      <span className="truncate" style={{ color: ui.text }}>
                        {m.month}
                      </span>
                      <span
                        className="font-semibold whitespace-nowrap"
                        style={{ color: ui.uncovered }}
                      >
                        {formatCurrency(m.uncovered_total)}
                      </span>
                    </button>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MODAL DETALLE */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeMonthDetail}
        title={
          selectedMonth
            ? `Detalle de gasto sin presupuesto — ${selectedMonth}`
            : "Detalle del mes"
        }
        size="lg"
      >
        {detailLoading ? (
          <div className="text-sm" style={{ color: ui.muted }}>
            Cargando detalle del mes…
          </div>
        ) : !detail ? (
          <div className="text-sm" style={{ color: ui.muted }}>
            No se pudo cargar el detalle.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Totales del mes */}
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="p-3" style={ui.softPanel}>
                <div
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Total mes
                </div>
                <div className="text-base font-semibold mt-1" style={{ color: ui.text }}>
                  {formatCurrency(detailTotals?.total)}
                </div>
              </div>

              <div className="p-3" style={ui.softPanel}>
                <div
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Cubierto
                </div>
                <div className="text-base font-semibold mt-1" style={{ color: ui.covered }}>
                  {formatCurrency(detailTotals?.covered)}
                </div>
              </div>

              <div className="p-3" style={ui.softPanel}>
                <div
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Sin presupuesto
                </div>
                <div className="text-base font-semibold mt-1" style={{ color: ui.uncovered }}>
                  {formatCurrency(detailTotals?.uncovered)}
                </div>
              </div>

              <div className="p-3" style={ui.softPanel}>
                <div
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Cobertura
                </div>
                <div className="text-base font-semibold mt-1" style={{ color: ui.text }}>
                  {Number.isFinite(Number(detailTotals?.coverage_pct))
                    ? `${Number(detailTotals.coverage_pct).toFixed(2)}%`
                    : "0.00%"}
                </div>
              </div>
            </div>

            {/* Top categorías sin presupuesto en el mes */}
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: ui.muted }}
              >
                Categorías con gasto sin presupuesto (mes)
              </h4>

              {detailTopCats.length === 0 ? (
                <div className="text-sm italic" style={{ color: ui.muted }}>
                  No hay gasto sin presupuesto en este mes.
                </div>
              ) : (
                <div className="max-h-[240px] overflow-auto" style={ui.tableWrap}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={ui.tableHead}>
                      <tr
                        className="text-xs uppercase"
                        style={{ letterSpacing: "0.14em", color: ui.muted }}
                      >
                        <th className="text-left p-3">Categoría</th>
                        <th className="text-right p-3">Sin presupuesto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailTopCats.map((c) => (
                        <tr
                          key={c.category_id}
                          style={{ borderBottom: ui.rowDivider }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = ui.rowHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <td className="p-3" style={{ color: ui.text }}>
                            {c.category_name}
                          </td>
                          <td className="p-3 text-right font-semibold" style={{ color: ui.uncovered }}>
                            {formatCurrency(c.uncovered_total)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Transacciones sin presupuesto */}
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-[0.18em] mb-2"
                style={{ color: ui.muted }}
              >
                Transacciones sin presupuesto (mes)
              </h4>

              {detailTx.length === 0 ? (
                <div className="text-sm italic" style={{ color: ui.muted }}>
                  No hay transacciones sin presupuesto en este mes.
                </div>
              ) : (
                <div className="max-h-[280px] overflow-auto" style={ui.tableWrap}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={ui.tableHead}>
                      <tr
                        className="text-xs uppercase"
                        style={{ letterSpacing: "0.14em", color: ui.muted }}
                      >
                        <th className="text-left p-3">Fecha</th>
                        <th className="text-left p-3">Descripción</th>
                        <th className="text-left p-3">Categoría</th>
                        <th className="text-right p-3">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailTx.map((tx) => (
                        <tr
                          key={tx.id}
                          style={{ borderBottom: ui.rowDivider }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = ui.rowHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = "transparent";
                          }}
                        >
                          <td className="p-3 whitespace-nowrap" style={{ color: ui.text }}>
                            {tx.date}
                          </td>
                          <td className="p-3" style={{ color: ui.text }}>
                            {tx.description || (
                              <span style={{ color: ui.muted, fontStyle: "italic" }}>
                                —
                              </span>
                            )}
                          </td>
                          <td className="p-3" style={{ color: ui.text }}>
                            {tx.category_name}
                          </td>
                          <td
                            className="p-3 text-right font-semibold whitespace-nowrap"
                            style={{ color: ui.uncovered }}
                          >
                            {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="text-[11px] mt-2" style={{ color: ui.muted }}>
                Consejo: usa este detalle para crear presupuestos mínimos por categoría
                en ese mes, o detectar gastos “sin categoría” y corregir el flujo de
                captura.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
