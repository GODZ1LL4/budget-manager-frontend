// FRONTEND
// BudgetCoverageChart.jsx (con click en mes -> modal detalle)
// Requiere tu Modal.jsx en components/Modal (ajusta el path según tu proyecto)

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Modal from "../Modal"; // <-- ajusta ruta
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

function BudgetCoverageChart({ token }) {
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
      <div className="rounded-2xl p-6 bg-slate-950 border border-slate-800 text-sm text-slate-400">
        Cargando cobertura de presupuestos...
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-2xl p-6 bg-slate-950 border border-slate-800 text-sm text-slate-400">
        No hay datos para mostrar.
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

  // Click handler (Recharts Bar onClick => data.payload.month)
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
      <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-5">
        {/* Header + Año */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-100">
              Calidad de presupuestos
            </h3>
            <p className="text-sm text-slate-300 mt-1">
              Cobertura mensual real: un gasto cuenta como cubierto solo si existe
              presupuesto para esa categoría en ese mismo mes.
            </p>
          </div>

          <div className="flex flex-col items-end">
            <label className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
              Año
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="mt-1 bg-slate-900 border border-slate-700 text-slate-100 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {loading ? (
              <span className="text-[11px] text-slate-400 mt-1">
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
              className="text-left rounded-xl border border-slate-800 bg-slate-900/40 px-3 py-2 text-xs text-slate-200 hover:bg-slate-900/55 transition"
              title="Abrir detalle del mes"
            >
              <span className="text-slate-300">Mes crítico:</span>{" "}
              <span className="font-semibold text-slate-50">
                {criticalMonth.month}
              </span>{" "}
              <span className="text-slate-300">—</span>{" "}
              <span className="font-semibold text-orange-300">
                {formatCurrency(criticalMonth.uncovered_total)}
              </span>{" "}
              <span className="text-slate-400">sin presupuesto</span>
              <span className="ml-2 text-slate-400">↗</span>
            </button>
          ) : (
            <div className="rounded-xl border border-slate-800 bg-slate-900/30 px-3 py-2 text-xs text-slate-300">
              No se detectan meses críticos sin presupuesto.
            </div>
          )}

          {hasUncategorized ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              ⚠️ Hay gastos <span className="font-semibold">sin categoría</span>. Eso
              siempre contará como <span className="font-semibold">sin presupuesto</span>.
            </div>
          ) : null}
        </div>

        {/* Totales */}
        <div className="grid md:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
              Gasto total
            </div>
            <div className="text-xl font-semibold text-slate-50 mt-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.10)]">
              {formatCurrency(totals.total_expense)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
              Cubierto
            </div>
            <div className="text-xl font-semibold text-emerald-300 mt-1 drop-shadow-[0_0_10px_rgba(16,185,129,0.18)]">
              {formatCurrency(totals.covered)}
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
              Sin presupuesto
            </div>
            <div className="text-xl font-semibold text-orange-300 mt-1 drop-shadow-[0_0_10px_rgba(249,115,22,0.18)]">
              {formatCurrency(totals.uncovered)}
            </div>
          </div>
        </div>

        {/* Chart + Listas */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Gráfico mensual (apilado) - click para detalle */}
          <div className="w-full h-[360px] md:h-[460px]">
            <ResponsiveContainer>
              <BarChart data={monthly}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
                <XAxis
                  dataKey="month"
                  tickFormatter={monthLabel}
                  stroke="#94a3b8"
                  tick={{ fill: "#e2e8f0", fontSize: 12 }}
                />
                <YAxis
                  stroke="#94a3b8"
                  tick={{ fill: "#e2e8f0", fontSize: 12 }}
                  tickFormatter={formatCompact}
                />
                <Tooltip
                  formatter={(val, name) => [
                    formatCurrency(val),
                    name === "covered" ? "Cubierto" : "Sin presupuesto",
                  ]}
                  labelFormatter={(label) => `Mes: ${label} (click para detalle)`}
                  contentStyle={{
                    backgroundColor: "#020617",
                    border: "1px solid #4b5563",
                    color: "#e5e7eb",
                    borderRadius: "0.5rem",
                    boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span className="text-slate-100 text-sm">
                      {value === "covered" ? "Cubierto" : "Sin presupuesto"}
                    </span>
                  )}
                />

                <Bar
                  dataKey="covered"
                  stackId="a"
                  fill="#10b981"
                  cursor="pointer"
                  onClick={handleBarClick}
                />
                <Bar
                  dataKey="uncovered"
                  stackId="a"
                  fill="#f97316"
                  cursor="pointer"
                  onClick={handleBarClick}
                />
              </BarChart>
            </ResponsiveContainer>

            <p className="text-xs text-slate-200 mt-3">
              Cobertura anual:{" "}
              <span className="font-semibold text-emerald-300">
                {Number.isFinite(Number(totals.coverage_pct))
                  ? Number(totals.coverage_pct).toFixed(2)
                  : "0.00"}
                %
              </span>{" "}
              del gasto tuvo presupuesto en su mes.{" "}
              <span className="text-slate-400">(Click en un mes para ver detalle)</span>
            </p>
          </div>

          {/* Listas */}
          <div className="space-y-4 text-sm text-slate-200">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2">
                Top categorías con gasto sin presupuesto (año)
              </h4>
              {topCats.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No hay gasto sin presupuesto para este año.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topCats.map((c) => {
                    const isUncat = c.category_id === "__uncategorized__";
                    return (
                      <li
                        key={c.category_id}
                        className="flex justify-between gap-2 border border-slate-700 rounded-lg px-3 py-2 bg-slate-900/40"
                      >
                        <span className="truncate flex items-center gap-2">
                          {isUncat ? (
                            <span className="text-amber-200 text-xs">⚠️</span>
                          ) : null}
                          <span className={isUncat ? "text-amber-100" : ""}>
                            {c.category_name}
                          </span>
                        </span>

                        <span className="font-semibold text-rose-300 whitespace-nowrap">
                          {formatCurrency(c.uncovered_total)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2">
                Meses con más gasto sin presupuesto
              </h4>
              {topMonths.length === 0 ? (
                <p className="text-xs text-slate-400 italic">
                  No hay meses con gasto sin presupuesto.
                </p>
              ) : (
                <ul className="space-y-2">
                  {topMonths.map((m) => (
                    <button
                      key={m.month}
                      onClick={() => openMonthDetail(m.month)}
                      className="w-full text-left flex justify-between gap-2 border border-slate-700 rounded-lg px-3 py-2 bg-slate-900/40 hover:bg-slate-900/55 transition"
                      title="Abrir detalle del mes"
                    >
                      <span className="truncate text-slate-100">{m.month}</span>
                      <span className="font-semibold text-orange-300 whitespace-nowrap">
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
          <div className="text-sm text-slate-300">Cargando detalle del mes…</div>
        ) : !detail ? (
          <div className="text-sm text-slate-300">
            No se pudo cargar el detalle.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Totales del mes */}
            <div className="grid sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Total mes
                </div>
                <div className="text-base font-semibold text-slate-50 mt-1">
                  {formatCurrency(detailTotals?.total)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Cubierto
                </div>
                <div className="text-base font-semibold text-emerald-300 mt-1">
                  {formatCurrency(detailTotals?.covered)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Sin presupuesto
                </div>
                <div className="text-base font-semibold text-orange-300 mt-1">
                  {formatCurrency(detailTotals?.uncovered)}
                </div>
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <div className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
                  Cobertura
                </div>
                <div className="text-base font-semibold text-slate-50 mt-1">
                  {Number.isFinite(Number(detailTotals?.coverage_pct))
                    ? `${Number(detailTotals.coverage_pct).toFixed(2)}%`
                    : "0.00%"}
                </div>
              </div>
            </div>

            {/* Top categorías sin presupuesto en ese mes */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2">
                Categorías con gasto sin presupuesto (mes)
              </h4>

              {detailTopCats.length === 0 ? (
                <div className="text-sm text-slate-400 italic">
                  No hay gasto sin presupuesto en este mes.
                </div>
              ) : (
                <div className="max-h-[240px] overflow-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-950/95 border-b border-slate-800">
                      <tr className="text-xs uppercase tracking-[0.14em] text-slate-300">
                        <th className="text-left p-3">Categoría</th>
                        <th className="text-right p-3">Sin presupuesto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailTopCats.map((c) => (
                        <tr
                          key={c.category_id}
                          className="border-b border-slate-800/60 hover:bg-slate-900/30"
                        >
                          <td className="p-3 text-slate-100">{c.category_name}</td>
                          <td className="p-3 text-right font-semibold text-orange-300">
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
              <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300 mb-2">
                Transacciones sin presupuesto (mes)
              </h4>

              {detailTx.length === 0 ? (
                <div className="text-sm text-slate-400 italic">
                  No hay transacciones sin presupuesto en este mes.
                </div>
              ) : (
                <div className="max-h-[280px] overflow-auto rounded-xl border border-slate-800">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-950/95 border-b border-slate-800">
                      <tr className="text-xs uppercase tracking-[0.14em] text-slate-300">
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
                          className="border-b border-slate-800/60 hover:bg-slate-900/30"
                        >
                          <td className="p-3 text-slate-200 whitespace-nowrap">
                            {tx.date}
                          </td>
                          <td className="p-3 text-slate-100">
                            {tx.description || <span className="text-slate-500 italic">—</span>}
                          </td>
                          <td className="p-3 text-slate-200">{tx.category_name}</td>
                          <td className="p-3 text-right font-semibold text-orange-300 whitespace-nowrap">
                            {formatCurrency(tx.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="text-[11px] text-slate-400 mt-2">
                Consejo: usa este detalle para crear presupuestos mínimos por categoría en ese mes,
                o detectar gastos “sin categoría” y corregir el flujo de captura.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}

export default BudgetCoverageChart;
