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

const formatCurrency = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

function ExpenseByWeekdayChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [data, setData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  // total | avg_txn | avg_day
  const [mode, setMode] = useState("total");

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/expense-by-weekday`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) =>
        console.error("Error cargando gasto por día de la semana:", err)
      )
      .finally(() => setLoading(false));
  }, [token, api, year]);

  const modeLabel =
    mode === "total"
      ? "Gasto total"
      : mode === "avg_txn"
      ? "Promedio por transacción"
      : "Promedio por día";

  const dataKey = mode; // total | avg_txn | avg_day

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            Hábitos de gasto por día de la semana
          </h3>
          <p className="text-sm text-slate-300 mt-1">
            Analiza tu gasto según el día y cambia la métrica para obtener
            distintas perspectivas.
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
              className="mt-1 bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/60"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Métrica */}
          <div className="flex flex-col items-end">
            <label className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
              Métrica
            </label>
            <div className="mt-1 inline-flex rounded-lg border border-slate-700 bg-slate-900/60 p-1">
              <button
                onClick={() => setMode("total")}
                className={`px-3 py-1 text-xs rounded-md transition ${
                  mode === "total"
                    ? "bg-slate-800 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Total
              </button>
              <button
                onClick={() => setMode("avg_txn")}
                className={`px-3 py-1 text-xs rounded-md transition ${
                  mode === "avg_txn"
                    ? "bg-slate-800 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Transacción
              </button>
              <button
                onClick={() => setMode("avg_day")}
                className={`px-3 py-1 text-xs rounded-md transition ${
                  mode === "avg_day"
                    ? "bg-slate-800 text-slate-50"
                    : "text-slate-300 hover:text-slate-100"
                }`}
              >
                Por día
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {loading && data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Cargando…</p>
      ) : data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos suficientes para este análisis.
        </p>
      ) : (
        <div className="w-full">
  {/* Área del gráfico */}
  <div className="h-[300px] w-full">
    <ResponsiveContainer>
      <BarChart data={data}>
        <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          stroke="#94a3b8"
          tick={{ fill: "#cbd5e1", fontSize: 12 }}
        />
        <YAxis stroke="#94a3b8" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
        <Tooltip
          formatter={(val) => formatCurrency(val)}
          labelFormatter={(label) => `Día: ${label}`}
          contentStyle={{
            backgroundColor: "#020617",
            border: "1px solid #4b5563",
            color: "#e5e7eb",
            borderRadius: "0.5rem",
            boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
          }}
        />
        <Legend
          wrapperStyle={{ color: "#e2e8f0" }}
          formatter={() => (
            <span className="text-slate-200 text-sm">{modeLabel}</span>
          )}
        />
        <Bar
          dataKey={dataKey}
          fill="#f97316"
          name={modeLabel}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  </div>

  {/* Footer (fuera del alto fijo del chart) */}
  <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/25 p-3">
    <p className="text-xs text-slate-300 leading-relaxed whitespace-normal break-words">
      <span className="text-slate-100 font-semibold">
        Promedio por transacción
      </span>{" "}
      indica cuánto gastas cada vez que realizas una compra ese día.{" "}
      <span className="text-slate-100 font-semibold">Promedio por día</span>{" "}
      muestra cuánto te cuesta ese día en promedio, incluso si no compras siempre.
    </p>
  </div>
</div>

      )}
    </div>
  );
}

export default ExpenseByWeekdayChart;
