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

function BudgetVsActualYearlyChart({ token }) {
  const [data, setData] = useState({});

  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/analytics/budget-vs-actual-yearly`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        const grouped = {};

        res.data.data.forEach(({ category, month, budgeted, spent }) => {
          if (!grouped[category]) grouped[category] = {};
          grouped[category][month] = { budgeted, spent };
        });

        // Convertir a formato de gráfico
        const months = Array.from({ length: 12 }, (_, i) =>
          `${new Date().getFullYear()}-${String(i + 1).padStart(2, "0")}`
        );

        const formatted = {};
        Object.entries(grouped).forEach(([category, values]) => {
          formatted[category] = months.map((month) => ({
            month,
            budgeted: values[month]?.budgeted || 0,
            spent: values[month]?.spent || 0,
          }));
        });

        setData(formatted);
      });
  }, [token]);

  return (
    <>
      {Object.entries(data).map(([category, entries]) => (
        <div key={category} className="mb-6">
          <h4 className="text-md font-semibold mb-1">{category}</h4>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={entries}>
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="budgeted"
                name="Presupuesto"
                stroke="#6366f1"
              />
              <Line
                type="monotone"
                dataKey="spent"
                name="Gasto Real"
                stroke="#ef4444"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ))}
    </>
  );
}

export default BudgetVsActualYearlyChart;
