import { useEffect, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";

const formatMoney = (v) => {
  const num = typeof v === "number" ? v : Number(v ?? 0);
  if (Number.isNaN(num)) return "RD$ 0.00";
  return `RD$ ${num.toFixed(2)}`;
};

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

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
      <p>Ingresos: {formatMoney(row.income)}</p>
      <p>Gastos: {formatMoney(row.expense)}</p>
      <p style={{ color: row.balance >= 0 ? "#16a34a" : "#ef4444" }}>
        Balance: {formatMoney(row.balance)}
      </p>
    </div>
  );
}

function MonthlyIncomeVsExpenseChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    axios
      .get(`${api}/analytics/monthly-income-expense-avg`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch((err) => console.error("Error al cargar datos:", err));
  }, [token, api]);

  // 🔢 KPI: Balance acumulado del año
  const yearlyBalance = data.reduce(
    (acc, row) => acc + (Number(row.balance ?? 0) || 0),
    0
  );

  const yearlyBalanceColor = yearlyBalance >= 0 ? "text-emerald-600" : "text-red-500";

  return (
    <div className="bg-white p-4 rounded shadow">
      <div className="flex items-baseline justify-between mb-4">
        <h3 className="text-lg font-semibold">
          Balance de Ingreso vs Gasto
        </h3>

        {/* KPI de balance acumulado */}
        <p className={`text-sm font-medium ${yearlyBalanceColor}`}>
          Balance acumulado del año:{" "}
          <span>{formatMoney(yearlyBalance)}</span>
        </p>
      </div>

      <ResponsiveContainer width="100%" height={350}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Bar dataKey="income" fill="#10b981" name="Ingresos" />
          <Bar dataKey="expense" fill="#ef4444" name="Gastos" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default MonthlyIncomeVsExpenseChart;
