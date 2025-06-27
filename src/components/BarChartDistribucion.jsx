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

function BarChartDistribucion({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(
          `${api}/analytics/income-expense-by-month`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setData(res.data.data);
      } catch {
        alert("Error al cargar datos de ingresos/gastos por mes");
      }
    };
    fetchData();
  }, [token]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(value) => `RD$ ${value.toFixed(2)}`} />
        <Legend />
        <Bar dataKey="income" fill="#16a34a" name="Ingresos" />
        <Bar dataKey="expense" fill="#dc2626" name="Gastos" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default BarChartDistribucion;
