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

function IncomeExpenseProjectionChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/projection-income-expense`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data));
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Proyección de ingresos y gastos (próximos 6 meses)
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-500">No hay datos para proyectar.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip formatter={(v) => `RD$ ${v.toFixed(2)}`} />
            <Legend />
            <Line
              type="monotone"
              dataKey="projectedIncome"
              stroke="#10b981"
              name="Ingresos proyectados"
            />
            <Line
              type="monotone"
              dataKey="projectedExpense"
              stroke="#ef4444"
              name="Gastos proyectados"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default IncomeExpenseProjectionChart;
