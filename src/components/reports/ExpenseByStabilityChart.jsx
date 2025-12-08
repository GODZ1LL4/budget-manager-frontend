import { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

const COLORS = ["#0ea5e9", "#f59e0b", "#ef4444"];

function ExpenseByStabilityChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/expense-by-stability-type`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res?.data?.data || []))
      .catch((err) => {
        console.error("Error al cargar gastos por tipo:", err);
      });
  }, [token, api]);

  const labelMap = {
    fixed: "Fijo",
    variable: "Variable",
    occasional: "Ocasional",
  };

  const displayData = (data || []).map((d) => ({
    ...d,
    name: labelMap[d.type] || d.type,
  }));

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
        <h3 className="text-lg font-semibold text-slate-100">
          Distribución de gastos por tipo de estabilidad
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Muestra qué proporción de tus gastos corresponde a gastos fijos,
          variables y ocasionales.
        </p>
      </div>

      {displayData.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos de gastos por tipo de estabilidad para el período
          actual.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={displayData}
                dataKey="total"
                nameKey="name"
                outerRadius="75%"
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(1)}%)`
                }
              >
                {displayData.map((_, index) => (
                  <Cell
                    key={index}
                    fill={COLORS[index % COLORS.length]}
                    stroke="#020617"
                    strokeWidth={1}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => `RD$ ${Number(value || 0).toFixed(2)}`}
                labelFormatter={(label) => `Tipo: ${label}`}
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
              <Legend
                wrapperStyle={{ color: "#e2e8f0" }}
                formatter={(value) => (
                  <span className="text-slate-200 text-xs sm:text-sm">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ExpenseByStabilityChart;
