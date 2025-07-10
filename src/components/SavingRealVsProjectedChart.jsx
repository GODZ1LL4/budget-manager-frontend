import { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

function SavingRealVsProjectedChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/saving-real-vs-projected`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch(() =>
        alert("Error al cargar comparación ahorro real vs proyectado")
      );
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-md font-semibold mb-4 text-gray-700">
        Ahorro mensual: Real vs Proyectado
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(val) => `RD$ ${val.toFixed(2)}`} />
          <Legend />
          <Line
            type="monotone"
            dataKey="saving"
            stroke="#10b981"
            name="Ahorro real"
          />
          <Line
            type="monotone"
            dataKey="projectedSaving"
            stroke="#6366f1"
            name="Ahorro proyectado"
            strokeDasharray="5 5"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SavingRealVsProjectedChart;
