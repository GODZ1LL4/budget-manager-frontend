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

function CustomTooltipMonthly({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      style={{
        background: "#020617",
        color: "#e5e7eb",
        padding: "10px 12px",
        border: "1px solid #4b5563",
        borderRadius: "8px",
        fontSize: "1rem",
        boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
      }}
    >
      <p style={{ marginBottom: 6, fontWeight: 700 }}>{label}</p>
      <p style={{ margin: 0 }}>Presupuesto: {formatMoney(row.budgeted)}</p>
      <p style={{ margin: 0 }}>Gasto: {formatMoney(row.spent)}</p>
      <p
        style={{
          marginTop: 6,
          marginBottom: 0,
          color: row.diff >= 0 ? "#ef4444" : "#16a34a",
          fontWeight: 700,
        }}
      >
        Diferencia: {formatMoney(row.diff)}
      </p>
    </div>
  );
}

function CustomTooltipCategory({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  return (
    <div
      style={{
        background: "#020617",
        color: "#e5e7eb",
        padding: "10px 12px",
        border: "1px solid #4b5563",
        borderRadius: "8px",
        fontSize: "1rem",
        boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
      }}
    >
      <p style={{ marginBottom: 6, fontWeight: 700 }}>{label}</p>
      <p style={{ margin: 0 }}>
        Presupuesto anual: {formatMoney(row.budgeted)}
      </p>
      <p style={{ margin: 0 }}>Gasto anual: {formatMoney(row.spent)}</p>
      <p
        style={{
          marginTop: 6,
          marginBottom: 0,
          color: row.diff >= 0 ? "#ef4444" : "#16a34a",
          fontWeight: 700,
        }}
      >
        Diferencia: {formatMoney(row.diff)}
      </p>
    </div>
  );
}

function BudgetVsActualSummaryChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [flipped, setFlipped] = useState(false);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const [monthly, setMonthly] = useState([]);
  const [categories, setCategories] = useState([]);

  // ✅ "Otros" breakdown
  const [othersBreakdown, setOthersBreakdown] = useState([]);
  const [othersOpen, setOthersOpen] = useState(false);

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

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
    const budgeted = (monthly || []).reduce(
      (acc, r) => acc + (Number(r.budgeted) || 0),
      0
    );
    const spent = (monthly || []).reduce(
      (acc, r) => acc + (Number(r.spent) || 0),
      0
    );
    return { budgeted, spent, diff: spent - budgeted };
  }, [monthly]);

  const totalsCategories = useMemo(() => {
    const budgeted = (categories || []).reduce(
      (acc, r) => acc + (Number(r.budgeted) || 0),
      0
    );
    const spent = (categories || []).reduce(
      (acc, r) => acc + (Number(r.spent) || 0),
      0
    );
    return { budgeted, spent, diff: spent - budgeted };
  }, [categories]);

  const monthTick = (m) => (typeof m === "string" ? m.slice(5, 7) : m);

  const othersTotals = useMemo(() => {
    const budgeted = (othersBreakdown || []).reduce(
      (acc, r) => acc + (Number(r.budgeted) || 0),
      0
    );
    const spent = (othersBreakdown || []).reduce(
      (acc, r) => acc + (Number(r.spent) || 0),
      0
    );
    return { budgeted, spent, diff: spent - budgeted, count: othersBreakdown.length };
  }, [othersBreakdown]);

  // ✅ click robusto (Recharts Bar onClick)
  const handleBarClickCategory = (barData) => {
    const row = barData?.payload;
    if (!row) return;

    const isOthers =
      row.category_id === "others" ||
      String(row.category || "").trim().toLowerCase() === "otros";

    if (isOthers) {
      setOthersOpen(true);
    }
  };

  const flipLabel = flipped ? "Ver por mes" : "Ver por categoría";

  return (
    <div
      className="
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        transition-all duration-300
        hover:-translate-y-0.5 hover:shadow-[0_20px_55px_rgba(0,0,0,0.9)]
        min-h-[520px]
      "
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-6 pb-0">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            Presupuesto vs Gasto Total (Anual)
          </h3>
          <p className="text-sm text-slate-300 mt-1">
            Alterna entre vista por mes y vista por categoría.
          </p>
        </div>

        <div className="flex items-end gap-3">
          {/* Año */}
          <div className="flex flex-col items-end">
            <label className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
              Año
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="
                mt-1 bg-slate-900 border border-slate-700 text-slate-200
                rounded-xl px-3 py-2 text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500/60
              "
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            {loading ? (
              <span className="text-xs text-slate-400 mt-1">Actualizando…</span>
            ) : null}
          </div>

          {/* ✅ Botón flip más “botón” */}
          <button
            onClick={() => setFlipped((p) => !p)}
            type="button"
            className="
              mt-[18px]
              inline-flex items-center gap-2
              rounded-xl px-4 py-2.5
              text-sm font-semibold
              text-slate-100
              border border-slate-700/80
              bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80
              shadow-[0_10px_30px_rgba(0,0,0,0.55)]
              hover:-translate-y-[1px]
              hover:shadow-[0_16px_40px_rgba(0,0,0,0.75)]
              active:translate-y-0
              transition
              whitespace-nowrap
            "
            title="Cambiar vista"
          >
            <span
              className="
                inline-flex h-6 w-6 items-center justify-center
                rounded-lg border border-slate-700 bg-slate-950/60
                text-slate-200
              "
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Vista
                </p>
                <p className="text-sm text-slate-200 font-semibold">
                  Totales por mes (12 meses)
                </p>
              </div>

              <div className="text-right text-sm">
                <div className="text-slate-300">
                  Presupuesto:{" "}
                  <span className="font-semibold text-slate-50">
                    {formatMoney(totalsMonthly.budgeted)}
                  </span>
                </div>
                <div className="text-slate-300">
                  Gasto:{" "}
                  <span className="font-semibold text-rose-300">
                    {formatMoney(totalsMonthly.spent)}
                  </span>
                </div>
              </div>
            </div>

            {monthly.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No hay datos disponibles.
              </p>
            ) : (
              <div className="w-full h-[340px]">
                <ResponsiveContainer>
                  <BarChart data={monthly}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="month"
                      tickFormatter={monthTick}
                      tick={{ fill: "#e5e7eb", fontSize: 14 }}
                      axisLine={{ stroke: "#64748b" }}
                      tickLine={{ stroke: "#64748b" }}
                    />
                    <YAxis
                      tick={{ fill: "#e5e7eb", fontSize: 14 }}
                      axisLine={{ stroke: "#64748b" }}
                      tickLine={{ stroke: "#64748b" }}
                    />
                    <Tooltip
                      content={<CustomTooltipMonthly />}
                      cursor={{ fill: "rgba(148,163,184,0.08)" }}
                    />
                    <Legend wrapperStyle={{ color: "#e5e7eb" }} />
                    <Bar
                      dataKey="budgeted"
                      name="Presupuesto Total"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                    />
                    <Bar
                      dataKey="spent"
                      name="Gasto Total"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
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
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Vista
                </p>
                <p className="text-sm text-slate-200 font-semibold">
                  Segmentado por categoría (Top + Otros)
                </p>
              </div>

              <div className="text-right text-sm">
                <div className="text-slate-300">
                  Presupuesto:{" "}
                  <span className="font-semibold text-slate-50">
                    {formatMoney(totalsCategories.budgeted)}
                  </span>
                </div>
                <div className="text-slate-300">
                  Gasto:{" "}
                  <span className="font-semibold text-rose-300">
                    {formatMoney(totalsCategories.spent)}
                  </span>
                </div>
              </div>
            </div>

            {categories.length === 0 ? (
              <p className="text-sm text-slate-500 italic">
                No hay datos disponibles.
              </p>
            ) : (
              <div className="w-full h-[340px]">
                <ResponsiveContainer>
                  <BarChart data={categories}>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
                    <XAxis
                      dataKey="category"
                      tick={{ fill: "#e5e7eb", fontSize: 12 }}
                      axisLine={{ stroke: "#64748b" }}
                      tickLine={{ stroke: "#64748b" }}
                    />
                    <YAxis
                      tick={{ fill: "#e5e7eb", fontSize: 14 }}
                      axisLine={{ stroke: "#64748b" }}
                      tickLine={{ stroke: "#64748b" }}
                    />
                    <Tooltip
                      content={<CustomTooltipCategory />}
                      cursor={{ fill: "rgba(148,163,184,0.08)" }}
                    />
                    <Legend wrapperStyle={{ color: "#e5e7eb" }} />

                    {/* ✅ click en cualquiera de estas barras sirve;
                        usamos onClick EN LA BARRA, no en BarChart */}
                    <Bar
                      dataKey="budgeted"
                      name="Presupuesto anual"
                      fill="#3b82f6"
                      radius={[4, 4, 0, 0]}
                      onClick={handleBarClickCategory}
                    />
                    <Bar
                      dataKey="spent"
                      name="Gasto anual"
                      fill="#ef4444"
                      radius={[4, 4, 0, 0]}
                      onClick={handleBarClickCategory}
                    />
                  </BarChart>
                </ResponsiveContainer>

                <p className="text-xs text-slate-400 mt-2">
                  Tip: haz click en{" "}
                  <span className="text-slate-200 font-semibold">Otros</span>{" "}
                  para ver el desglose.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal "Otros" */}
      <Modal
        isOpen={othersOpen}
        onClose={() => setOthersOpen(false)}
        title={`Desglose de "Otros" — ${year}`}
        size="lg"
      >
        {othersBreakdown.length === 0 ? (
          <p className="text-sm text-slate-400 italic">
            No hay categorías dentro de "Otros".
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <p className="text-sm text-slate-300">
                Categorías agrupadas en{" "}
                <span className="font-semibold text-slate-100">Otros</span>,
                ordenadas por gasto.
              </p>

              <div className="text-xs sm:text-sm text-slate-300">
                <span className="text-slate-200 font-medium">
                  {othersTotals.count} categorías
                </span>
                <span className="mx-2 text-slate-500">·</span>
                <span className="text-slate-200 font-medium">Total:</span>{" "}
                <span className="font-semibold text-rose-300">
                  {formatMoney(othersTotals.spent)}
                </span>
              </div>
            </div>

            <div className="max-h-[420px] overflow-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-slate-950">
                  <tr className="text-slate-200">
                    <th className="text-left px-3 py-2">Categoría</th>
                    <th className="text-right px-3 py-2">Presupuesto</th>
                    <th className="text-right px-3 py-2">Gasto</th>
                    <th className="text-right px-3 py-2">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {othersBreakdown.map((r) => (
                    <tr
                      key={r.category_id}
                      className="border-t border-slate-800 text-slate-200"
                    >
                      <td className="px-3 py-2">{r.category}</td>
                      <td className="px-3 py-2 text-right">
                        {formatMoney(r.budgeted)}
                      </td>
                      <td className="px-3 py-2 text-right text-rose-300">
                        {formatMoney(r.spent)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-semibold ${
                          r.diff >= 0 ? "text-rose-300" : "text-emerald-300"
                        }`}
                      >
                        {formatMoney(r.diff)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-xs text-slate-400">
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
