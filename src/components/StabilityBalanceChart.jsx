import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";

const colors = {
  income: "#10b981",   // verde
  expense: "#ef4444",  // rojo
  balance: "#3b82f6",  // azul
};

function StabilityBalanceChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/stability-balance-summary`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch((err) =>
        console.error("❌ Error al cargar resumen de balance por estabilidad:", err)
      );
  }, [token]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        Balance mensual promedio por tipo de estabilidad
      </h3>
      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="stability_type" />
          <YAxis />
          <Tooltip formatter={(val) => `RD$ ${val.toFixed(2)}`} />
          <Legend />
          <Bar dataKey="income" name="Ingresos" fill={colors.income} />
          <Bar dataKey="expense" name="Gastos" fill={colors.expense} />
          <Bar dataKey="balance" name="Balance" fill={colors.balance} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default StabilityBalanceChart;
