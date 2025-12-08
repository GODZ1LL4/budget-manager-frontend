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
} from "recharts";

function OverBudgetChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/overbudget-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar categorías con gasto excesivo:", err);
      });
  }, [token, api]);

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
      <div>
        <h3 className="text-xl font-semibold text-slate-100">
          Categorías con gasto excesivo
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Muestra cuánto te has pasado del presupuesto en cada categoría.
        </p>
      </div>

      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No te has pasado en ninguna categoría 🟢
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="category"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <Tooltip
                formatter={(val) =>
                  `RD$ ${Number(val || 0).toFixed(2)}`
                }
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                  fontSize: "1rem",
                }}
                itemStyle={{ color: "#e5e7eb" }}
                labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
              />
              <Bar
                dataKey="over"
                fill="#dc2626"
                name="Exceso"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default OverBudgetChart;
