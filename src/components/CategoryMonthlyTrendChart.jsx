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

function CategoryMonthlyTrendChart({ token }) {
  const [data, setData] = useState([]);
  const [categories, setCategories] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/category-trend`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setData(res.data.data);

        // Detectar nombres de categorías de forma dinámica
        const categorySet = new Set();
        res.data.data.forEach((entry) => {
          Object.keys(entry).forEach((key) => {
            if (key !== "month") categorySet.add(key);
          });
        });

        setCategories([...categorySet]);
      });
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Evolución mensual por categoría
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">No hay datos disponibles.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(value) => `RD$ ${value.toFixed(2)}`} />
            <Legend />
            {categories.map((cat, index) => (
              <Line
                key={cat}
                type="monotone"
                dataKey={cat}
                stroke={`hsl(${(index * 60) % 360}, 70%, 50%)`}
                name={cat}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default CategoryMonthlyTrendChart;
