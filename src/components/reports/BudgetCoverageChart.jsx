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
  Legend,
} from "recharts";

function BudgetCoverageChart({ token }) {
  const [data, setData] = useState(null);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/budget-coverage`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data))
      .catch((err) =>
        console.error("Error cargando cobertura de presupuestos:", err)
      );
  }, [token]);

  if (!data) {
    return (
      <div className="rounded-2xl p-6 bg-slate-950 border border-slate-800 text-sm text-slate-400">
        Cargando cobertura de presupuestos...
      </div>
    );
  }

  const chartData = [
    {
      name: "Gasto",
      con_presupuesto: data.expense_with_budget,
      sin_presupuesto: data.expense_without_budget,
    },
  ];

  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(v || 0);

  const topExpenseOnly = data.categories_with_expense_only.slice(0, 5);
  const topBudgetOnly = data.categories_with_budget_only.slice(0, 5);

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-100">
          Calidad de presupuestos
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Qué parte de tu gasto anual está cubierta por presupuestos.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Gráfico principal */}
        <div className="w-full h-[260px]">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="name"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <Tooltip
                formatter={(val, name) => [
                  formatCurrency(val),
                  name === "con_presupuesto"
                    ? "Con presupuesto"
                    : "Sin presupuesto",
                ]}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                }}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-slate-200 text-sm">
                    {value === "con_presupuesto"
                      ? "Con presupuesto"
                      : "Sin presupuesto"}
                  </span>
                )}
              />
              <Bar
                dataKey="con_presupuesto"
                fill="#10b981"
                name="Con presupuesto"
              />
              <Bar
                dataKey="sin_presupuesto"
                fill="#f97316"
                name="Sin presupuesto"
              />
            </BarChart>
          </ResponsiveContainer>

          <p className="text-xs text-slate-300 mt-2">
            Cobertura:{" "}
            <span className="font-semibold text-emerald-300">
              {data.coverage_pct.toFixed(2)}%
            </span>{" "}
            del gasto está en categorías con presupuesto.
          </p>
        </div>

        {/* Listas de huecos */}
        <div className="space-y-3 text-sm text-slate-200">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">
              Categorías con gasto pero sin presupuesto
            </h4>
            {topExpenseOnly.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No hay categorías con gasto sin presupuesto.
              </p>
            ) : (
              <ul className="space-y-1">
                {topExpenseOnly.map((c) => (
                  <li
                    key={c.category_id}
                    className="flex justify-between border border-slate-700 rounded px-2 py-1 bg-slate-900/50"
                  >
                    <span className="truncate">{c.category_name}</span>
                    <span className="font-semibold text-rose-300">
                      {formatCurrency(c.total_expense)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 mb-1">
              Categorías con presupuesto pero sin gasto
            </h4>
            {topBudgetOnly.length === 0 ? (
              <p className="text-xs text-slate-500 italic">
                No hay categorías con presupuesto sin uso.
              </p>
            ) : (
              <ul className="space-y-1">
                {topBudgetOnly.map((c) => (
                  <li
                    key={c.category_id}
                    className="flex justify-between border border-slate-700 rounded px-2 py-1 bg-slate-900/50"
                  >
                    <span className="truncate">{c.category_name}</span>
                    <span className="font-semibold text-slate-200">
                      {formatCurrency(c.total_budget)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default BudgetCoverageChart;
