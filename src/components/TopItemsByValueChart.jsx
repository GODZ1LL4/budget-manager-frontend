import { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";

function TopItemsByValueChart({ token }) {
  const [data, setData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/top-items-by-value?year=${year}&month=${month}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch(() => console.error("Error al cargar top items por valor"));
  }, [token, year, month]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2 text-gray-700">Top 10 artículos por gasto — {month}/{year}</h3>

      <div className="flex gap-2 mb-4">
        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="border border-gray-300 rounded p-1 w-24"
          min="2000"
        />
        <input
          type="number"
          value={month}
          onChange={(e) => setMonth(e.target.value.padStart(2, "0"))}
          className="border border-gray-300 rounded p-1 w-16"
          min="1"
          max="12"
        />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 60, right: 20 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="item" type="category" />
          <Tooltip formatter={(v) => `RD$ ${v.toFixed(2)}`} />
          <Bar dataKey="total_spent" fill="#f59e0b">
            <LabelList dataKey="total_spent" position="right" formatter={(v) => `RD$ ${v.toFixed(0)}`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TopItemsByValueChart;
