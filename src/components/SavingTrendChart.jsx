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

function SavingTrendChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/saving-trend`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Evolución del ahorro mensual
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip formatter={(value) => `RD$ ${value.toFixed(2)}`} />
          <Legend />
          <Line
            type="monotone"
            dataKey="income"
            stroke="#10b981"
            name="Ingresos"
          />
          <Line
            type="monotone"
            dataKey="expense"
            stroke="#ef4444"
            name="Gastos"
          />
          <Line
            type="monotone"
            dataKey="saving"
            stroke="#3b82f6"
            name="Ahorro"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default SavingTrendChart;
