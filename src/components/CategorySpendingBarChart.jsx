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

function CategorySpendingBarChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/category-spending-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Gasto por categoría (últimos 6 meses)
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay gastos registrados en este período.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical" margin={{ left: 50 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="category" type="category" />
            <Tooltip formatter={(value) => `RD$ ${value.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="total" fill="#3b82f6" name="Total gastado" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default CategorySpendingBarChart;
