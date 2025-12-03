import { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

const formatMoney = (v) => `RD$ ${v.toFixed(2)}`;

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0].payload;

  return (
    <div
      style={{
        background: "white",
        padding: "10px",
        border: "1px solid #ddd",
        borderRadius: "6px",
      }}
    >
      <p><strong>{label}</strong></p>
      <p>Presupuesto: {formatMoney(row.budgeted)}</p>
      <p>Gasto: {formatMoney(row.spent)}</p>
      <p style={{ color: row.diff >= 0 ? "#ef4444" : "#16a34a" }}>
        Diferencia: {formatMoney(row.diff)}
      </p>
    </div>
  );
}

function BudgetVsActualSummaryChart({ token }) {
  const [data, setData] = useState([]);

  useEffect(() => {
    axios
      .get(
        `${import.meta.env.VITE_API_URL}/analytics/budget-vs-actual-summary-yearly`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Error al cargar datos:", err));
  }, [token]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip content={<CustomTooltip />} />
        <Legend />

        <Bar
          dataKey="budgeted"
          name="Presupuesto Total"
          fill="#3b82f6"
          radius={[4, 4, 0, 0]}
        />

        <Bar
          dataKey="spent"
          name="Gasto Total"
          fill="#ef4444"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export default BudgetVsActualSummaryChart;
