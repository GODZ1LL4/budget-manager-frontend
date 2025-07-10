import { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

function RealisticProjectionChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/realistic-projection`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch(() => alert("Error al cargar proyección realista"));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Proyección Realista de Ingresos, Gastos y Ahorros
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">No hay datos disponibles.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(val) => `RD$ ${val.toFixed(2)}`} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#22c55e" name="Ingresos" />
            <Line type="monotone" dataKey="expense" stroke="#ef4444" name="Gastos" />
            <Line type="monotone" dataKey="saving" stroke="#3b82f6" name="Ahorro" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default RealisticProjectionChart;
