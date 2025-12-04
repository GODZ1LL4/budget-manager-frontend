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
    axios
      .get(`${api}/analytics/expense-by-stability-type`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch(() => alert("Error al cargar gastos por tipo"));
  }, [token]);

  const labelMap = {
    fixed: "Fijo",
    variable: "Variable",
    occasional: "Ocasional",
  };

  const displayData = data.map((d) => ({
    ...d,
    name: labelMap[d.type],
  }));

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-md font-semibold mb-4 text-gray-700">
        Distribución de gastos por tipo de estabilidad
      </h3>
      <ResponsiveContainer width="100%" height={300}>
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
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value) => `RD$ ${value.toFixed(2)}`}
            labelFormatter={(label) => `Tipo: ${label}`}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ExpenseByStabilityChart;
