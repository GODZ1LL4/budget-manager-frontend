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
  LabelList,
} from "recharts";

function TopItemsByValueYearlyChart({ token }) {
  const [data, setData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/top-items-by-value-yearly?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar top items por gasto anual:", err);
      });
  }, [token, year, api]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2 text-gray-700">
        Top 10 artículos por gasto — Año {year}
      </h3>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
          className="border border-gray-300 rounded p-1 w-24"
          min="2000"
        />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 60, right: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="item" type="category" />
          <Tooltip
            formatter={(v) =>
              v != null ? `RD$ ${Number(v).toFixed(2)}` : "RD$ 0.00"
            }
          />
          <Bar dataKey="total_spent" fill="#f97316">
            <LabelList
              dataKey="total_spent"
              position="right"
              formatter={(v) =>
                v != null ? `RD$ ${Number(v).toFixed(0)}` : "RD$ 0"
              }
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TopItemsByValueYearlyChart;
