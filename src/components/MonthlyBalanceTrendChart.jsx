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
} from "recharts";

function MonthlyBalanceTrendChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/monthly-balance`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Evolución del Balance Mensual
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
            <Line
              type="monotone"
              dataKey="balance"
              stroke="#6366f1"
              name="Balance"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default MonthlyBalanceTrendChart;
