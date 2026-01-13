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
  }).format(Number(v || 0));

function CustomTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      style={{
        background: "#020617",
        padding: "10px 12px",
        border: "1px solid #4b5563",
        borderRadius: "8px",
        color: "#e5e7eb",
        fontSize: "1rem",
        boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
      }}
    >
      <p style={{ marginBottom: 6, fontWeight: 700 }}>
        Mes: {row.month} (click para detalle)
      </p>
      <p style={{ margin: 0 }}>Gasto total: {formatCurrency(row.expense_total)}</p>
      <p style={{ margin: 0, color: "#34d399" }}>
        Cubierto: {formatCurrency(row.covered)}
      </p>
      <p style={{ margin: 0, color: "#fb923c" }}>
        Exceso: {formatCurrency(row.over_budget)}
      </p>
      <p style={{ margin: 0, color: "#f87171" }}>
        Sin presupuesto: {formatCurrency(row.without_budget)}
      </p>
      <p style={{ marginTop: 6, marginBottom: 0, fontWeight: 700 }}>
        Cobertura: {Number(row.coverage_pct || 0).toFixed(2)}%
      </p>
    </div>
  );
}

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
      ...m, // ✅ incluye month: "YYYY-MM"
      name: m.month?.slice(5, 7) || "",
    }));
  }, [report]);

  const totals = report?.totals || null;
  const monthDetails = report?.month_details || {};

  const topOver = report?.top_categories_over_budget || [];
  const topWithout = report?.top_categories_without_budget || [];
  const topUncoveredMonths = report?.top_uncovered_months || [];

  // ✅ Click robusto: Bar onClick recibe barData.payload
  const handleMonthClick = (barData) => {
    const row = barData?.payload;
    if (!row?.month) return;

    setSelectedMonth(row.month);
    setOpen(true);
  };

  const detail = selectedMonth ? monthDetails[selectedMonth] : null;

  if (loading || !report || !totals) {
    return (
      <div className="rounded-2xl p-6 bg-slate-950 border border-slate-800 text-sm text-slate-400">
        Cargando cobertura real...
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            Cobertura real de presupuestos (con exceso)
          </h3>
          <p className="text-sm text-slate-300 mt-1">
            Un gasto solo cuenta como cubierto hasta el límite del presupuesto.
            El exceso y lo sin presupuesto se consideran no cubiertos.
          </p>
        </div>

        <div className="flex flex-col items-end">
          <label className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
            Año
          </label>
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            className="mt-1 bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <p className="text-xs text-slate-300 mt-2">
            Cobertura anual:{" "}
            <span className="font-semibold text-emerald-300">
              {Number(totals.coverage_pct || 0).toFixed(2)}%
            </span>
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 border border-slate-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Gasto total
          </p>
          <p className="text-xl font-extrabold mt-1 text-slate-100">
            {formatCurrency(totals.expense_total)}
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 border border-slate-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Cubierto (real)
          </p>
          <p className="text-xl font-extrabold mt-1 text-emerald-300">
            {formatCurrency(totals.covered)}
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 border border-slate-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Exceso
          </p>
          <p className="text-xl font-extrabold mt-1 text-orange-300">
            {formatCurrency(totals.over_budget)}
          </p>
        </div>
        <div className="rounded-2xl p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 border border-slate-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.65)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
            Sin presupuesto
          </p>
          <p className="text-xl font-extrabold mt-1 text-rose-300">
            {formatCurrency(totals.without_budget)}
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Chart */}
        <div className="w-full h-[380px]">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fill: "#e5e7eb", fontSize: 14 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#e5e7eb", fontSize: 14 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                formatter={(value) => (
                  <span className="text-slate-200 text-xs sm:text-sm">
                    {value}
                  </span>
                )}
              />

              {/* ✅ onClick en cada Bar (robusto) */}
              <Bar
                dataKey="covered"
                stackId="a"
                fill="#10b981"
                name="Cubierto"
                radius={[4, 4, 0, 0]}
                onClick={handleMonthClick}
              />
              <Bar
                dataKey="over_budget"
                stackId="a"
                fill="#f97316"
                name="Exceso"
                radius={[4, 4, 0, 0]}
                onClick={handleMonthClick}
              />
              <Bar
                dataKey="without_budget"
                stackId="a"
                fill="#ef4444"
                name="Sin presupuesto"
                radius={[4, 4, 0, 0]}
                onClick={handleMonthClick}
              />
            </BarChart>
          </ResponsiveContainer>

          <p className="text-xs text-slate-400 mt-2">
            Click en un mes para ver el detalle por categorías (exceso y sin presupuesto).
          </p>
        </div>

        {/* Lists */}
        <div className="space-y-4">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">
              Top categorías con exceso (año)
            </h4>
            {topOver?.length ? (
              <ul className="space-y-1">
                {topOver.map((c) => (
                  <li
                    key={c.category_id}
                    className="flex justify-between border border-slate-700 rounded px-2 py-1 bg-slate-900/50"
                  >
                    <span className="truncate text-slate-200">
                      {c.category_name}
                    </span>
                    <span className="font-semibold text-orange-300">
                      {formatCurrency(c.total_over_budget)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">No hay excesos.</p>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">
              Top categorías sin presupuesto (año)
            </h4>
            {topWithout?.length ? (
              <ul className="space-y-1">
                {topWithout.map((c) => (
                  <li
                    key={c.category_id}
                    className="flex justify-between border border-slate-700 rounded px-2 py-1 bg-slate-900/50"
                  >
                    <span className="truncate text-slate-200">
                      {c.category_name}
                    </span>
                    <span className="font-semibold text-rose-300">
                      {formatCurrency(c.total_without_budget)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">
                No hay gasto sin presupuesto.
              </p>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">
              top meses no cubierto (exceso + sin presupuesto)
            </h4>
            {topUncoveredMonths?.length ? (
              <ul className="space-y-1">
                {topUncoveredMonths.map((m) => (
                  <li
                    key={m.month}
                    className="flex justify-between border border-slate-700 rounded px-2 py-1 bg-slate-900/50"
                  >
                    <span className="text-slate-200">{m.month}</span>
                    <span className="font-semibold text-slate-100">
                      {formatCurrency(m.uncovered_total)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500 italic">Sin datos.</p>
            )}
          </div>
        </div>
      </div>

      {/* ✅ MODAL DETALLE MENSUAL */}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={`Detalle del mes: ${selectedMonth || ""}`}
        size="xl"
      >
        {!detail ? (
          <p className="text-sm text-slate-400 italic">
            No hay detalle para este mes.
          </p>
        ) : (
          <div className="space-y-4">
            {/* KPIs del mes */}
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Gasto total
                </p>
                <p className="text-lg font-bold text-slate-100">
                  {formatCurrency(detail.totals.expense_total)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Cubierto
                </p>
                <p className="text-lg font-bold text-emerald-300">
                  {formatCurrency(detail.totals.covered)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Exceso
                </p>
                <p className="text-lg font-bold text-orange-300">
                  {formatCurrency(detail.totals.over_budget)}
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                  Sin presupuesto
                </p>
                <p className="text-lg font-bold text-rose-300">
                  {formatCurrency(detail.totals.without_budget)}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300">
              Cobertura del mes:{" "}
              <span className="font-semibold text-emerald-300">
                {Number(detail.totals.coverage_pct || 0).toFixed(2)}%
              </span>
            </p>

            {/* Listas */}
            <div className="grid lg:grid-cols-2 gap-4">
              {/* Sin presupuesto */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">
                  Categorías sin presupuesto (mes)
                </h4>

                {detail.without_budget_categories?.length ? (
                  <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-950">
                        <tr className="text-slate-200">
                          <th className="text-left px-3 py-2">Categoría</th>
                          <th className="text-right px-3 py-2">Gasto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.without_budget_categories.map((r) => (
                          <tr
                            key={r.category_id}
                            className="border-t border-slate-800"
                          >
                            <td className="px-3 py-2 text-slate-200">
                              {r.category_name}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-rose-300">
                              {formatCurrency(r.spent)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No hubo gasto sin presupuesto este mes.
                  </p>
                )}
              </div>

              {/* Exceso */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">
                  Categorías con exceso (mes)
                </h4>

                {detail.over_budget_categories?.length ? (
                  <div className="max-h-[320px] overflow-auto rounded-xl border border-slate-800">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-950">
                        <tr className="text-slate-200">
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
                            className="border-t border-slate-800"
                          >
                            <td className="px-3 py-2 text-slate-200">
                              {r.category_name}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-200">
                              {formatCurrency(r.budgeted)}
                            </td>
                            <td className="px-3 py-2 text-right text-rose-300 font-semibold">
                              {formatCurrency(r.spent)}
                            </td>
                            <td className="px-3 py-2 text-right text-orange-300 font-semibold">
                              {formatCurrency(r.over_budget)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    No hubo excesos este mes.
                  </p>
                )}
              </div>
            </div>

            {/* Resumen top 15 */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-2">
                Resumen por categoría (mes) — Top 15 por gasto
              </h4>

              {detail.categories_summary?.length ? (
                <div className="max-h-[360px] overflow-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-950">
                      <tr className="text-slate-200">
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
                          (Number(r.over_budget) || 0) +
                          (Number(r.without_budget) || 0);

                        return (
                          <tr
                            key={r.category_id}
                            className="border-t border-slate-800"
                          >
                            <td className="px-3 py-2 text-slate-200">
                              {r.category_name}
                            </td>
                            <td className="px-3 py-2 text-right text-slate-200">
                              {formatCurrency(r.budgeted)}
                            </td>
                            <td className="px-3 py-2 text-right text-rose-300 font-semibold">
                              {formatCurrency(r.spent)}
                            </td>
                            <td className="px-3 py-2 text-right text-emerald-300 font-semibold">
                              {formatCurrency(r.covered)}
                            </td>
                            <td className="px-3 py-2 text-right text-orange-200 font-semibold">
                              {formatCurrency(uncovered)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">Sin datos.</p>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default BudgetCoverageRobustChart;
