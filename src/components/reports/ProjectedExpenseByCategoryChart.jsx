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
    axios
      .get(`${api}/analytics/projected-expense-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setData(res.data.data);
        setFilteredData(res.data.data);
      })
      .catch((err) =>
        console.error("❌ Error al cargar gastos proyectados:", err)
      );
  }, [token]);

  useEffect(() => {
    if (filter === "all") {
      setFilteredData(data);
    } else {
      setFilteredData(data.filter((item) => item.stability_type === filter));
    }
  }, [filter, data]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-700">
          Gastos Proyectados por Categoría
        </h3>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border border-gray-300 p-1 rounded text-sm"
        >
          <option value="all">Todos</option>
          <option value="fixed">Fijos</option>
          <option value="variable">Variables</option>
        </select>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart
          data={filteredData}
          layout="vertical"
          margin={{ top: 10, right: 30, left: 80, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis
            type="category"
            dataKey="category"
            width={120}
            tick={{ fontSize: 12 }}
          />
          <Tooltip
            formatter={(val) => `RD$ ${val.toFixed(2)}`}
            labelFormatter={(label) => `Categoría: ${label}`}
          />
          <Legend />
          <Bar
            dataKey="projected_monthly"
            name="Proyección mensual"
            isAnimationActive={false}
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
  );
}

export default ProjectedExpenseByCategoryChart;
