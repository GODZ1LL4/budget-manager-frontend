import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

const colorMap = {
  fixed: "#10b981",     // verde
  variable: "#6366f1",  // azul
};

function ProjectedExpenseByCategoryChart({ token }) {
  const [data, setData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [filter, setFilter] = useState("all");
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/projected-expense-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const incoming = res?.data?.data || [];
        setData(incoming);
        setFilteredData(incoming);
      })
      .catch((err) =>
        console.error("❌ Error al cargar gastos proyectados:", err)
      );
  }, [token, api]);

  useEffect(() => {
    if (filter === "all") {
      setFilteredData(data);
    } else {
      setFilteredData(
        data.filter((item) => item.stability_type === filter)
      );
    }
  }, [filter, data]);

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
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <div>
          <h3 className="text-lg md:text-xl font-semibold text-slate-100">
            Gastos proyectados por categoría
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Proyección mensual de gasto por categoría, diferenciando gastos
            fijos y variables.
          </p>
        </div>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="
            text-sm rounded-lg px-3 py-1.5
            bg-slate-900 border border-slate-700
            text-slate-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
          "
        >
          <option value="all">Todos</option>
          <option value="fixed">Fijos</option>
          <option value="variable">Variables</option>
        </select>
      </div>

      {filteredData.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos de gastos proyectados para los filtros seleccionados.
        </p>
      ) : (
        <div className="w-full h-[350px]">
          <ResponsiveContainer>
            <BarChart
              data={filteredData}
              layout="vertical"
              margin={{ top: 10, right: 30, left: 80, bottom: 20 }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                type="number"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={140}
                tick={{ fill: "#e5e7eb", fontSize: 12 }}
              />
              <Tooltip
                formatter={(val) =>
                  `RD$ ${Number(val || 0).toFixed(2)}`
                }
                labelFormatter={(label) => `Categoría: ${label}`}
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
              <Bar
                dataKey="projected_monthly"
                name="Proyección mensual"
                isAnimationActive={false}
                radius={[4, 4, 4, 4]}
              >
                {filteredData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colorMap[entry.stability_type] || "#d1d5db"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ProjectedExpenseByCategoryChart;
