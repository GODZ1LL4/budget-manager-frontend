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
        background: "#020617",
        color: "#e5e7eb",
        padding: "10px",
        border: "1px solid #4b5563",
        borderRadius: "6px",
        fontSize: "1rem",
      }}
    >
      <p>
        <strong>{label}</strong>
      </p>
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
        `${
          import.meta.env.VITE_API_URL
        }/analytics/budget-vs-actual-summary-yearly`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Error al cargar datos:", err));
  }, [token]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <XAxis
          dataKey="month"
          tick={{ fill: "#e5e7eb", fontSize: 14 }}
          axisLine={{ stroke: "#64748b" }}
          tickLine={{ stroke: "#64748b" }}
        />
        <YAxis
          tick={{ fill: "#e5e7eb", fontSize: 14 }}
          axisLine={{ stroke: "#64748b" }}
          tickLine={{ stroke: "#64748b" }}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(148,163,184,0.08)" }}
        />
        <Legend wrapperStyle={{ color: "#e5e7eb" }} />

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
