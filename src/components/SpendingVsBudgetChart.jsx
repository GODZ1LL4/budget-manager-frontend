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
} from "recharts";

function SpendingVsBudgetChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/spending-vs-budget`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Gasto vs Presupuesto por Categoría
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay presupuestos definidos para este mes.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip formatter={(val) => `RD$ ${val.toFixed(2)}`} />
            <Legend />
            <Bar dataKey="limit" fill="#c084fc" name="Presupuesto" />
            <Bar dataKey="spent" fill="#f97316" name="Gastado" />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default SpendingVsBudgetChart;
