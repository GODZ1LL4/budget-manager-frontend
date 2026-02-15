import { useEffect, useMemo, useState } from "react";
import axios from "axios";
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
import Modal from "../Modal";

const formatCurrency = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

function BudgetCoverageRobustChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  // Modal
  const [open, setOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(null);

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

  // ===== Tokenized UI =====
  const ui = useMemo(() => {
    const axis = "color-mix(in srgb, var(--muted) 80%, transparent)";
    const grid = "color-mix(in srgb, var(--border-rgba) 65%, transparent)";
    const panelBg =
      "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 78%, transparent), var(--bg-2))";

    return {
      // semantic colors
      covered: "var(--success)",
      over: "var(--warning)",
      without: "var(--danger)",

      text: "var(--text)",
      muted: "var(--muted)",
      heading: "var(--heading)",
      border: "var(--border-rgba)",
      axis,
      grid,

      // containers
      card: {
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-rgba)",
        background: panelBg,
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
        color: "var(--text)",
      },
      metricCard: {
        borderRadius: "var(--radius-lg)",
        border: "1px solid color-mix(in srgb, var(--border-rgba) 100%, transparent)",
        background:
          "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 70%, transparent), var(--bg-2))",
        boxShadow: "0 10px 30px rgba(0,0,0,0.65)",
      },
      softPanel: {
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-rgba)",
        backgroundColor: "color-mix(in srgb, var(--panel) 60%, transparent)",
      },

      // controls
      select: {
        marginTop: 6,
        backgroundColor: "var(--control-bg)",
        color: "var(--control-text)",
        border: "1px solid var(--control-border)",
        borderRadius: "var(--radius-md)",
        padding: "10px 12px",
        fontSize: 14,
        outline: "none",
        boxShadow: "none",
      },

      // chart tooltip
      tooltip: {
        backgroundColor: "var(--bg-3)",
        padding: "10px 12px",
        border: "1px solid var(--border-rgba)",
        borderRadius: "12px",
        color: "var(--text)",
        fontSize: "0.95rem",
        boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
        minWidth: 240,
      },

      // tables
      tableWrap: {
        border: "1px solid var(--border-rgba)",
        borderRadius: "var(--radius-lg)",
        backgroundColor: "color-mix(in srgb, var(--panel) 55%, transparent)",
        overflow: "hidden",
      },
      thead: {
        backgroundColor: "color-mix(in srgb, var(--bg-3) 92%, transparent)",
        borderBottom: "1px solid var(--border-rgba)",
      },
      rowDivider: "1px solid color-mix(in srgb, var(--border-rgba) 60%, transparent)",
      rowHover: "color-mix(in srgb, var(--panel) 72%, transparent)",
    };
  }, []);

  function CustomTooltip({ active, payload }) {
    if (!active || !payload || payload.length === 0) return null;
    const row = payload[0]?.payload;
    if (!row) return null;

    return (
      <div style={ui.tooltip}>
        <p style={{ marginBottom: 6, fontWeight: 800, color: ui.text }}>
          Mes: {row.month} (click para detalle)
        </p>

        <p style={{ margin: 0, color: ui.text }}>
          Gasto total: {formatCurrency(row.expense_total)}
        </p>

        <p style={{ margin: 0, color: ui.covered, fontWeight: 700 }}>
          Cubierto: {formatCurrency(row.covered)}
        </p>

        <p style={{ margin: 0, color: ui.over, fontWeight: 700 }}>
          Exceso: {formatCurrency(row.over_budget)}
        </p>

        <p style={{ margin: 0, color: ui.without, fontWeight: 700 }}>
          Sin presupuesto: {formatCurrency(row.without_budget)}
        </p>

        <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 800, color: ui.text }}>
          Cobertura: {Number(row.coverage_pct || 0).toFixed(2)}%
        </p>
      </div>
    );
  }

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/budget-coverage-robust`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year },
      })
      .then((res) => setReport(res?.data?.data || null))
      .catch((err) => console.error("Error cargando cobertura robusta:", err))
      .finally(() => setLoading(false));
  }, [token, api, year]);

  const chartData = useMemo(() => {
    const months = report?.months || [];
    return months.map((m) => ({
      ...m, // incluye month: "YYYY-MM"
      name: m.month?.slice(5, 7) || "",
    }));
  }, [report]);

  const totals = report?.totals || null;
  const monthDetails = report?.month_details || {};

  const topOver = report?.top_categories_over_budget || [];
  const topWithout = report?.top_categories_without_budget || [];
  const topUncoveredMonths = report?.top_uncovered_months || [];

  const handleMonthClick = (barData) => {
    const row = barData?.payload;
    if (!row?.month) return;
    setSelectedMonth(row.month);
    setOpen(true);
  };

  const detail = selectedMonth ? monthDetails[selectedMonth] : null;

  if (loading || !report || !totals) {
    return (
      <div className="rounded-2xl p-6 text-sm" style={ui.card}>
        <span style={{ color: ui.muted }}>Cargando cobertura real...</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: ui.heading }}>
            Cobertura real de presupuestos
          </h3>
          <p className="text-sm mt-1" style={{ color: ui.muted }}>
            Un gasto solo cuenta como cubierto hasta el límite del presupuesto. El exceso
            y lo sin presupuesto se consideran no cubiertos.
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

          <p className="text-xs mt-2" style={{ color: ui.text }}>
            Cobertura anual:{" "}
            <span style={{ fontWeight: 800, color: ui.covered }}>
              {Number(totals.coverage_pct || 0).toFixed(2)}%
            </span>
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4" style={ui.metricCard}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: ui.muted }}
          >
            Gasto total
          </p>
          <p className="text-xl font-extrabold mt-1" style={{ color: ui.text }}>
            {formatCurrency(totals.expense_total)}
          </p>
        </div>

        <div className="p-4" style={ui.metricCard}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: ui.muted }}
          >
            Cubierto (real)
          </p>
          <p className="text-xl font-extrabold mt-1" style={{ color: ui.covered }}>
            {formatCurrency(totals.covered)}
          </p>
        </div>

        <div className="p-4" style={ui.metricCard}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: ui.muted }}
          >
            Exceso
          </p>
          <p className="text-xl font-extrabold mt-1" style={{ color: ui.over }}>
            {formatCurrency(totals.over_budget)}
          </p>
        </div>

        <div className="p-4" style={ui.metricCard}>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.18em]"
            style={{ color: ui.muted }}
          >
            Sin presupuesto
          </p>
          <p className="text-xl font-extrabold mt-1" style={{ color: ui.without }}>
            {formatCurrency(totals.without_budget)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Chart */}
        <div className="w-full h-[380px]">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid stroke={ui.grid} strokeDasharray="4 4" />
              <XAxis
                dataKey="name"
                stroke={ui.axis}
                tick={{ fill: ui.text, fontSize: 14 }}
              />
              <YAxis stroke={ui.axis} tick={{ fill: ui.text, fontSize: 14 }} />
              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ color: ui.text }}
                formatter={(value) => (
                  <span style={{ color: ui.text, fontSize: 13 }}>{value}</span>
                )}
              />

              <Bar
                dataKey="covered"
                stackId="a"
                fill={ui.covered}
                name="Cubierto"
                radius={[6, 0, 0, 6]}
                onClick={handleMonthClick}
                cursor="pointer"
              />
              <Bar
                dataKey="over_budget"
                stackId="a"
                fill={ui.over}
                name="Exceso"
                radius={[0, 0, 0, 0]}
                onClick={handleMonthClick}
                cursor="pointer"
              />
              <Bar
                dataKey="without_budget"
                stackId="a"
                fill={ui.without}
                name="Sin presupuesto"
                radius={[0, 6, 6, 0]}
                onClick={handleMonthClick}
                cursor="pointer"
              />
            </BarChart>
          </ResponsiveContainer>

          <p className="text-xs mt-2" style={{ color: ui.muted }}>
            Click en un mes para ver el detalle por categorías (exceso y sin presupuesto).
          </p>
        </div>

        {/* Lists */}
        <div className="space-y-4">
          {/* Top exceso */}
          <div>
            <h4
              className="text-xs font-semibold uppercase tracking-[0.14em] mb-2"
              style={{ color: ui.muted }}
            >
              Top categorías con exceso (año)
            </h4>

            {topOver?.length ? (
              <ul className="space-y-1">
                {topOver.map((c) => (
                  <li
                    key={c.category_id}
                    className="flex justify-between px-2 py-1"
                    style={ui.softPanel}
                  >
                    <span className="truncate" style={{ color: ui.text }}>
                      {c.category_name}
                    </span>
                    <span style={{ fontWeight: 800, color: ui.over }}>
                      {formatCurrency(c.total_over_budget)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic" style={{ color: ui.muted }}>
                No hay excesos.
              </p>
            )}
          </div>

          {/* Top sin presupuesto */}
          <div>
            <h4
              className="text-xs font-semibold uppercase tracking-[0.14em] mb-2"
              style={{ color: ui.muted }}
            >
              Top categorías sin presupuesto (año)
            </h4>

            {topWithout?.length ? (
              <ul className="space-y-1">
                {topWithout.map((c) => (
                  <li
                    key={c.category_id}
                    className="flex justify-between px-2 py-1"
                    style={ui.softPanel}
                  >
                    <span className="truncate" style={{ color: ui.text }}>
                      {c.category_name}
                    </span>
                    <span style={{ fontWeight: 800, color: ui.without }}>
                      {formatCurrency(c.total_without_budget)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic" style={{ color: ui.muted }}>
                No hay gasto sin presupuesto.
              </p>
            )}
          </div>

          {/* Top meses no cubierto */}
          <div>
            <h4
              className="text-xs font-semibold uppercase tracking-[0.14em] mb-2"
              style={{ color: ui.muted }}
            >
              Top meses no cubierto (exceso + sin presupuesto)
            </h4>

            {topUncoveredMonths?.length ? (
              <ul className="space-y-1">
                {topUncoveredMonths.map((m) => (
                  <li
                    key={m.month}
                    className="flex justify-between px-2 py-1"
                    style={ui.softPanel}
                  >
                    <span style={{ color: ui.text }}>{m.month}</span>
                    <span style={{ fontWeight: 800, color: ui.text }}>
                      {formatCurrency(m.uncovered_total)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs italic" style={{ color: ui.muted }}>
                Sin datos.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Modal detalle */}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Detalle del mes: ${selectedMonth || ""}`}
        size="xl"
      >
        {!detail ? (
          <p className="text-sm italic" style={{ color: ui.muted }}>
            No hay detalle para este mes.
          </p>
        ) : (
          <div className="space-y-4">
            {/* KPIs del mes */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3" style={ui.softPanel}>
                <p
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Gasto total
                </p>
                <p className="text-lg font-bold" style={{ color: ui.text }}>
                  {formatCurrency(detail.totals.expense_total)}
                </p>
              </div>

              <div className="p-3" style={ui.softPanel}>
                <p
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Cubierto
                </p>
                <p className="text-lg font-bold" style={{ color: ui.covered }}>
                  {formatCurrency(detail.totals.covered)}
                </p>
              </div>

              <div className="p-3" style={ui.softPanel}>
                <p
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Exceso
                </p>
                <p className="text-lg font-bold" style={{ color: ui.over }}>
                  {formatCurrency(detail.totals.over_budget)}
                </p>
              </div>

              <div className="p-3" style={ui.softPanel}>
                <p
                  className="text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: ui.muted }}
                >
                  Sin presupuesto
                </p>
                <p className="text-lg font-bold" style={{ color: ui.without }}>
                  {formatCurrency(detail.totals.without_budget)}
                </p>
              </div>
            </div>

            <p className="text-sm" style={{ color: ui.text }}>
              Cobertura del mes:{" "}
              <span style={{ fontWeight: 800, color: ui.covered }}>
                {Number(detail.totals.coverage_pct || 0).toFixed(2)}%
              </span>
            </p>

            <div className="grid lg:grid-cols-2 gap-4">
              {/* Sin presupuesto */}
              <div>
                <h4
                  className="text-xs font-semibold uppercase tracking-[0.14em] mb-2"
                  style={{ color: ui.muted }}
                >
                  Categorías sin presupuesto (mes)
                </h4>

                {detail.without_budget_categories?.length ? (
                  <div className="max-h-[320px] overflow-auto" style={ui.tableWrap}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0" style={ui.thead}>
                        <tr style={{ color: ui.text }}>
                          <th className="text-left px-3 py-2">Categoría</th>
                          <th className="text-right px-3 py-2">Gasto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.without_budget_categories.map((r) => (
                          <tr
                            key={r.category_id}
                            style={{ borderTop: ui.rowDivider }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = ui.rowHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <td className="px-3 py-2" style={{ color: ui.text }}>
                              {r.category_name}
                            </td>
                            <td
                              className="px-3 py-2 text-right font-semibold"
                              style={{ color: ui.without }}
                            >
                              {formatCurrency(r.spent)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs italic" style={{ color: ui.muted }}>
                    No hubo gasto sin presupuesto este mes.
                  </p>
                )}
              </div>

              {/* Exceso */}
              <div>
                <h4
                  className="text-xs font-semibold uppercase tracking-[0.14em] mb-2"
                  style={{ color: ui.muted }}
                >
                  Categorías con exceso (mes)
                </h4>

                {detail.over_budget_categories?.length ? (
                  <div className="max-h-[320px] overflow-auto" style={ui.tableWrap}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0" style={ui.thead}>
                        <tr style={{ color: ui.text }}>
                          <th className="text-left px-3 py-2">Categoría</th>
                          <th className="text-right px-3 py-2">Presupuesto</th>
                          <th className="text-right px-3 py-2">Gasto</th>
                          <th className="text-right px-3 py-2">Exceso</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.over_budget_categories.map((r) => (
                          <tr
                            key={r.category_id}
                            style={{ borderTop: ui.rowDivider }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = ui.rowHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <td className="px-3 py-2" style={{ color: ui.text }}>
                              {r.category_name}
                            </td>
                            <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                              {formatCurrency(r.budgeted)}
                            </td>
                            <td
                              className="px-3 py-2 text-right font-semibold"
                              style={{ color: ui.without }}
                            >
                              {formatCurrency(r.spent)}
                            </td>
                            <td
                              className="px-3 py-2 text-right font-semibold"
                              style={{ color: ui.over }}
                            >
                              {formatCurrency(r.over_budget)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs italic" style={{ color: ui.muted }}>
                    No hubo excesos este mes.
                  </p>
                )}
              </div>
            </div>

            {/* Resumen top 15 */}
            <div>
              <h4
                className="text-xs font-semibold uppercase tracking-[0.14em] mb-2"
                style={{ color: ui.muted }}
              >
                Resumen por categoría (mes) — Top 15 por gasto
              </h4>

              {detail.categories_summary?.length ? (
                <div className="max-h-[360px] overflow-auto" style={ui.tableWrap}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0" style={ui.thead}>
                      <tr style={{ color: ui.text }}>
                        <th className="text-left px-3 py-2">Categoría</th>
                        <th className="text-right px-3 py-2">Presupuesto</th>
                        <th className="text-right px-3 py-2">Gasto</th>
                        <th className="text-right px-3 py-2">Cubierto</th>
                        <th className="text-right px-3 py-2">No cubierto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.categories_summary.slice(0, 15).map((r) => {
                        const uncovered =
                          (Number(r.over_budget) || 0) + (Number(r.without_budget) || 0);

                        return (
                          <tr
                            key={r.category_id}
                            style={{ borderTop: ui.rowDivider }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = ui.rowHover;
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <td className="px-3 py-2" style={{ color: ui.text }}>
                              {r.category_name}
                            </td>
                            <td className="px-3 py-2 text-right" style={{ color: ui.text }}>
                              {formatCurrency(r.budgeted)}
                            </td>
                            <td
                              className="px-3 py-2 text-right font-semibold"
                              style={{ color: ui.without }}
                            >
                              {formatCurrency(r.spent)}
                            </td>
                            <td
                              className="px-3 py-2 text-right font-semibold"
                              style={{ color: ui.covered }}
                            >
                              {formatCurrency(r.covered)}
                            </td>
                            <td
                              className="px-3 py-2 text-right font-semibold"
                              style={{
                                color: uncovered > 0 ? ui.over : "color-mix(in srgb, var(--muted) 85%, transparent)",
                              }}
                            >
                              {formatCurrency(uncovered)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs italic" style={{ color: ui.muted }}>
                  Sin datos.
                </p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default BudgetCoverageRobustChart;
