import { useEffect, useMemo, useState } from "react";
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

const money = (v) => `RD$ ${Number(v || 0).toFixed(2)}`;

function BudgetVsActualChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/budget-vs-actual`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar presupuesto vs real:", err);
      });
  }, [token, api]);

  // ====== Tokenized UI (solo vars) ======
  const ui = useMemo(() => {
    const card = {
      background:
        "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 80%, transparent), var(--bg-2))",
      border: "1px solid var(--border-rgba)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
      color: "var(--text)",
    };

    const tooltip = {
      backgroundColor: "var(--bg-3)",
      border: "1px solid var(--border-rgba)",
      color: "var(--text)",
      borderRadius: "12px",
      boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
      fontSize: "0.95rem",
      padding: "10px 12px",
    };

    return {
      card,
      tooltip,
      grid: { stroke: "var(--border-rgba)", strokeDasharray: "4 4" },
      axisStroke: "var(--muted)",
      tick: { fill: "var(--text)", fontSize: 14 },
      legendWrap: { color: "var(--text)" },

      // Series colors (tokenized)
      budgetFill: "var(--primary)",
      actualFill: "var(--danger)",
    };
  }, []);

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      <div>
        <h3 style={{ color: "var(--heading)", fontWeight: 800, fontSize: 18 }}>
          Presupuesto vs Gasto Real
        </h3>
        <p className="mt-1" style={{ color: "var(--muted)", fontSize: 14 }}>
          Compara el presupuesto asignado con el gasto real por categoría.
        </p>
      </div>

      {data.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14, fontStyle: "italic" }}>
          No hay datos disponibles.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid {...ui.grid} />

              <XAxis
                dataKey="category"
                stroke={ui.axisStroke}
                tick={ui.tick}
              />
              <YAxis stroke={ui.axisStroke} tick={ui.tick} />

              <Tooltip
                formatter={(val) => money(val)}
                contentStyle={ui.tooltip}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--text)", fontWeight: 800 }}
                cursor={{ fill: "color-mix(in srgb, var(--text) 6%, transparent)" }}
              />

              <Legend
                wrapperStyle={ui.legendWrap}
                formatter={(value) => (
                  <span style={{ color: "var(--text)" }} className="text-xs sm:text-sm">
                    {value}
                  </span>
                )}
              />

              <Bar
                dataKey="presupuesto"
                fill={ui.budgetFill}
                name="Presupuesto"
                radius={[6, 6, 0, 0]}
              />
              <Bar
                dataKey="gastado"
                fill={ui.actualFill}
                name="Gastado"
                radius={[6, 6, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default BudgetVsActualChart;
