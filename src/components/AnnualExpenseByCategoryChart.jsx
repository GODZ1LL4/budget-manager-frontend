import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

function AnnualExpenseByCategoryChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/annual-expense-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Gasto acumulado por categoría (año en curso)
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay datos de gasto para este año.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 10, right: 20, left: 50, bottom: 10 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis dataKey="category" type="category" />
            <Tooltip formatter={(v) => `RD$ ${v.toFixed(2)}`} />
            <Bar dataKey="total" fill="#f97316" name="Total gastado" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default AnnualExpenseByCategoryChart;
