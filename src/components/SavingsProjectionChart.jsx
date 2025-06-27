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

function SavingsProjectionChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/savings-projection`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Proyección de Ahorro Futuro
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">No hay datos para mostrar.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(val) => `RD$ ${val.toFixed(2)}`} />
            <Line
              type="monotone"
              dataKey="saving"
              stroke="#0ea5e9"
              name="Ahorro estimado"
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default SavingsProjectionChart;
