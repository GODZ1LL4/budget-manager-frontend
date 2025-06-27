import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

function SavingProjectionChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/saving-projection`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Proyección de ahorro futuro
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay datos disponibles para proyectar.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(val) => `RD$ ${val.toFixed(2)}`} />
            <Bar
              dataKey="projectedSaving"
              fill="#3b82f6"
              name="Ahorro proyectado"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default SavingProjectionChart;
