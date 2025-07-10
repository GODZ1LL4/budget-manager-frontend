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

function TopVariableCategoriesChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/top-variable-categories`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch(() => alert("Error al cargar categorías variables top"));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-md font-semibold mb-4 text-gray-700">
        Top 5 categorías variables con más gasto
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="category" />
          <Tooltip formatter={(val) => `RD$ ${val.toFixed(2)}`} />
          <Bar dataKey="total" fill="#f59e0b">
            <LabelList dataKey="total" position="right" formatter={(val) => `RD$ ${val.toFixed(0)}`} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TopVariableCategoriesChart;
