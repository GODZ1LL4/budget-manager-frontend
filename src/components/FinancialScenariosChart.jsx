// components/FinancialScenarioChart.jsx
import { useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

function FinancialScenarioChart({ token }) {
  const [incomeDelta, setIncomeDelta] = useState(0);
  const [expenseReduction, setExpenseReduction] = useState(0);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const api = import.meta.env.VITE_API_URL;

  const handleSimulate = async () => {
    setLoading(true);
    try {
      const res = await axios.post(
        `${api}/analytics/simulated-scenario`,
        {
          income_adjustment: {
            type: "fixed",
            amount: Number(incomeDelta),
          },
          expense_adjustment: {
            type: "variable",
            percent_reduction: Number(expenseReduction),
          },
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setResult(res.data);
    } catch (err) {
      console.error("Error al simular escenario:", err);
    } finally {
      setLoading(false);
    }
  };

  const chartData = result
    ? [
        {
          name: "Ingresos",
          Actual: result.current.avg_income,
          Simulado: result.scenario.avg_income,
        },
        {
          name: "Gastos",
          Actual: result.current.avg_expense,
          Simulado: result.scenario.avg_expense,
        },
        {
          name: "Ahorro",
          Actual: result.current.avg_saving,
          Simulado: result.scenario.avg_saving,
        },
      ]
    : [];

  return (
    <div className="bg-white p-4 rounded shadow space-y-4">
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Aumento de ingresos fijos (RD$):
        </label>
        <input
          type="number"
          className="w-full border rounded px-3 py-1"
          value={incomeDelta}
          onChange={(e) => setIncomeDelta(e.target.value)}
        />

        <label className="block text-sm font-medium text-gray-700">
          Reducción % de gastos variables:
        </label>
        <input
          type="number"
          className="w-full border rounded px-3 py-1"
          value={expenseReduction}
          onChange={(e) => setExpenseReduction(e.target.value)}
        />

        <button
          onClick={handleSimulate}
          className="mt-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {loading ? "Simulando..." : "Simular Escenario"}
        </button>
      </div>

      {result && (
        <div style={{ width: "100%", height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(val) => `RD$ ${val.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Actual" fill="#6366f1" />
              <Bar dataKey="Simulado" fill="#10b981" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default FinancialScenarioChart;
