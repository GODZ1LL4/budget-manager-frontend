import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

function formatMonthLabel(ym) {
  if (ym == null) return "—";

  // Recharts puede pasar number o string
  const s = String(ym);

  // Esperamos "YYYY-MM"
  if (!/^\d{4}-\d{2}$/.test(s)) return s;

  const y = s.slice(0, 4);
  const m = Number(s.slice(5, 7));

  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  return `${months[m - 1] || s} ${y}`;
}

function formatCurrency(val) {
  const n = Number(val);
  return `RD$ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function MonthlyIncomeVsExpenseLineChart({ token }) {
  const [data, setData] = useState([]);
  const [months, setMonths] = useState(6);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${api}/analytics/income-vs-expense-monthly`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { months },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) =>
        console.error("Error cargando Ingreso vs Gasto mensual:", err)
      );
  }, [token, months, api]);

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold text-slate-100">
            Ingresos vs Gastos (mensual)
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Comparación histórica de ingresos y gastos por mes.
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-slate-400">Período:</span>
          <select
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="
              bg-slate-900 border border-slate-700 rounded-lg
              px-2 py-1 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70
            "
          >
            <option value={3}>3 meses</option>
            <option value={6}>6 meses</option>
            <option value={12}>12 meses</option>
            <option value={24}>24 meses</option>
          </select>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos suficientes para este período.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />

              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <Tooltip
                formatter={(val) => formatCurrency(val)}
                labelFormatter={formatMonthLabel}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                }}
              />
              <Legend />
              <Line
                type="linear"
                dataKey="income"
                name="Ingresos"
                stroke="#22c55e"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />

              <Line
                type="linear"
                dataKey="expense"
                name="Gastos"
                stroke="#f43f5e"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default MonthlyIncomeVsExpenseLineChart;
