import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

function CategoryVariationChart({ token, categories }) {
  const [data, setData] = useState({});
  const [selected, setSelected] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/yearly-category-variations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  const allMonths = Array.from(
    { length: 12 },
    (_, i) => `${new Date().getFullYear()}-${String(i + 1).padStart(2, "0")}`
  );

  const formatted = allMonths.map((month) => {
    const row = { month };
    selected.forEach((catId) => {
      const entries = data[catId] || [];
      const found = entries.find((e) => e.month === month);
      row[catId] = found ? found.amount : 0;
    });
    return row;
  });

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Variación de gastos por categoría
      </h3>

      <select
        multiple
        value={selected}
        onChange={(e) =>
          setSelected(Array.from(e.target.selectedOptions).map((o) => o.value))
        }
        className="border border-gray-300 p-2 rounded mb-4 w-full h-32"
      >
        {categories.map((cat) => (
          <option key={cat.id} value={cat.id}>
            {cat.name}
          </option>
        ))}
      </select>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={formatted}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(v) => `RD$ ${v.toFixed(2)}`} />
          <Legend />
          {selected.map((catId, idx) => {
            const cat = categories.find((c) => c.id === catId);
            return (
              <Line
                key={catId}
                dataKey={catId}
                name={cat?.name || catId}
                stroke={`hsl(${(idx * 40) % 360}, 70%, 50%)`}
              />
            );
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default CategoryVariationChart;
