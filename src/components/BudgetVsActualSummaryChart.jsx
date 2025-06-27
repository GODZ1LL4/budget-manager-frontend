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
} from "recharts";

function BudgetVsActualSummaryChart({ token }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/analytics/budget-vs-actual-summary-yearly`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Error al cargar datos:", err));
  }, [token]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip formatter={(v) => `RD$ ${v.toFixed(2)}`} />
        <Legend />
        <Line type="monotone" dataKey="budgeted" name="Presupuesto Total" stroke="#3b82f6" />
        <Line type="monotone" dataKey="spent" name="Gasto Total" stroke="#ef4444" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export default BudgetVsActualSummaryChart;
