import { useEffect, useState } from "react";
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

function ExpenseByWeekdayChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${api}/analytics/expense-by-weekday`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) =>
        console.error("Error cargando gasto por día de la semana:", err)
      );
  }, [token]);

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-100">
          Hábitos de gasto por día de la semana
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Total y promedio de gasto según el día de la semana.
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos suficientes para este análisis.
        </p>
      ) : (
        <div className="w-full h-[280px]">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <Tooltip
                formatter={(val, name) =>
                  name === "Gasto total"
                    ? `RD$ ${val.toFixed(2)}`
                    : `RD$ ${val.toFixed(2)}`
                }
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
                formatter={(value) => (
                  <span className="text-slate-200 text-sm">{value}</span>
                )}
              />
              <Bar dataKey="total" fill="#f97316" name="Gasto total" />
              <Bar dataKey="avg" fill="#6366f1" name="Promedio por transacción" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ExpenseByWeekdayChart;
