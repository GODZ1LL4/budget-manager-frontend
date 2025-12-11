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

function ProjectedVsActualExpenseByCategoryChart({ token }) {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/projected-vs-actual-expense-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setData(res.data.data || []);
        setMeta(res.data.meta || null);
      })
      .catch((err) =>
        console.error("Error cargando proyección vs realidad:", err)
      );
  }, [token]);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(v || 0);

  const chartData = data.map((row) => ({
    ...row,
    label: `${row.category} (${row.stability_type})`,
  }));

  return (
    <div className="rounded-2xl p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border border-slate-800 shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-slate-100">
          Proyección vs realidad por categoría
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Compara lo proyectado (mediana histórica) con el gasto real del mes{" "}
          {meta?.month || ""}.
        </p>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos suficientes para este análisis.
        </p>
      ) : (
        <div className="w-full h-[320px]">
          <ResponsiveContainer>
            <BarChart data={chartData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="label"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 10 }}
                angle={-30}
                textAnchor="end"
                height={80}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                }}
                formatter={(val, name, props) => {
                  if (
                    name === "projected_monthly" ||
                    name === "actual_month_to_date"
                  ) {
                    return [formatCurrency(val), name === "projected_monthly"
                      ? "Proyectado"
                      : "Real MTD"];
                  }
                  return val;
                }}
              />
              <Legend
                formatter={(value) => (
                  <span className="text-slate-200 text-sm">
                    {value === "projected_monthly"
                      ? "Proyectado"
                      : "Real (mes a la fecha)"}
                  </span>
                )}
              />

              <Bar
                dataKey="projected_monthly"
                fill="#6366f1"
                name="Proyectado"
              />
              <Bar
                dataKey="actual_month_to_date"
                fill="#f97316"
                name="Real (MTD)"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ProjectedVsActualExpenseByCategoryChart;
