import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

const formatMoney = (v) => {
  const num = typeof v === "number" ? v : Number(v ?? 0);
  if (Number.isNaN(num)) return "RD$ 0.00";
  return `RD$ ${num.toFixed(2)}`;
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const balance = Number(row.balance ?? 0) || 0;
  const balanceColor = balance >= 0 ? "#4ade80" : "#f97373";

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
      <p style={{ marginBottom: 4, fontWeight: 600 }}>Mes: {label}</p>
      <p style={{ margin: 0 }}>Ingresos: {formatMoney(row.income)}</p>
      <p style={{ margin: 0 }}>Gastos: {formatMoney(row.expense)}</p>
      <p style={{ margin: 0, marginTop: 4, color: balanceColor }}>
        Balance: {formatMoney(balance)}
      </p>
    </div>
  );
}

function MonthlyIncomeVsExpenseChart({ token }) {
  const [data, setData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const api = import.meta.env.VITE_API_URL;

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/monthly-income-expense-avg`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year },
      })
      .then((res) => setData(res?.data?.data || []))
      .catch((err) => console.error("Error al cargar datos:", err))
      .finally(() => setLoading(false));
  }, [token, api, year]);

  // KPI: Balance acumulado del año
  const yearlyBalance = data.reduce(
    (acc, row) => acc + (Number(row.balance ?? 0) || 0),
    0
  );

  const yearlyBalanceColor =
    yearlyBalance >= 0 ? "text-emerald-400" : "text-rose-400";

  const monthLabel = (m) => (typeof m === "string" ? m.slice(5, 7) : m);

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-4
      "
    >
      {/* ✅ Header ajustado */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        {/* Título */}
        <h3 className="text-lg md:text-xl font-semibold text-slate-100">
          Balance de Ingreso vs Gasto
        </h3>

        {/* Controles + KPI (derecha) */}
        <div className="flex flex-col items-end gap-1">
          {/* Selector año */}
          <div className="flex flex-col items-end">
            <label className="text-[11px] uppercase tracking-[0.18em] text-slate-300">
              Año
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="
                mt-1
                bg-slate-900 border border-slate-700
                text-slate-200
                rounded-lg px-3 py-1.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-emerald-500/60
              "
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* KPI balance acumulado */}
          <p className={`text-sm font-medium ${yearlyBalanceColor}`}>
            Balance acumulado del año:{" "}
            <span className="font-semibold">{formatMoney(yearlyBalance)}</span>
            {loading ? (
              <span className="text-slate-400 ml-2 text-xs">
                Actualizando…
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos disponibles para el período actual.
        </p>
      ) : (
        <div className="w-full h-[350px]">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ color: "#e2e8f0" }}
                formatter={(value) => (
                  <span className="text-slate-200 text-xs sm:text-sm">
                    {value}
                  </span>
                )}
              />
              <Bar
                dataKey="income"
                fill="#10b981"
                name="Ingresos"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="expense"
                fill="#ef4444"
                name="Gastos"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default MonthlyIncomeVsExpenseChart;
