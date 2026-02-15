import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

// ✅ helper: leer CSS variables (tema actual)
function cssVar(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || fallback).trim();
}

function ExpenseByStabilityChart({ token }) {
  const [data, setData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/expense-by-stability-type`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res?.data?.data || []))
      .catch((err) => {
        console.error("Error al cargar gastos por tipo:", err);
      });
  }, [token, api]);

  const labelMap = {
    fixed: "Fijo",
    variable: "Variable",
    occasional: "Ocasional",
  };

  const displayData = useMemo(
    () =>
      (data || []).map((d) => ({
        ...d,
        name: labelMap[d.type] || d.type,
      })),
    [data]
  );

  // ✅ Colores por tipo usando tokens (cambian con el tema)
  const colorsByType = useMemo(() => {
    const primary = cssVar("--primary", "#10b981");
    const warning = cssVar("--warning", "#fbbf24");
    const danger = cssVar("--danger", "#fb7185");

    return {
      fixed: primary,
      variable: warning,
      occasional: danger,
    };
  }, []);

  // ✅ Tooltip tokenizado
  const tooltipStyle = useMemo(
    () => ({
      background: "color-mix(in srgb, var(--bg-3) 78%, transparent)",
      border: "1px solid var(--border-rgba)",
      color: "var(--text)",
      borderRadius: "var(--radius-md)",
      boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
      padding: "10px 12px",
      backdropFilter: "blur(10px)",
      fontSize: "0.95rem",
    }),
    []
  );

  return (
    <div
      className="rounded-2xl p-6 space-y-4 border shadow-[0_16px_40px_rgba(0,0,0,0.85)]"
      style={{
        background:
          "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--bg-2) 70%, var(--bg-3)), var(--bg-3))",
        borderColor: "var(--border-rgba)",
        color: "var(--text)",
      }}
    >
      <div>
        <h3 className="text-lg font-semibold" style={{ color: "var(--heading)" }}>
          Distribución de gastos por tipo de estabilidad
        </h3>
        <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
          Muestra qué proporción de tus gastos corresponde a gastos fijos,
          variables y ocasionales.
        </p>
      </div>

      {displayData.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          No hay datos de gastos por tipo de estabilidad para el período actual.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={displayData}
                dataKey="total"
                nameKey="name"
                outerRadius="75%"
                label={({ name, percent }) =>
                  `${name} (${(percent * 100).toFixed(1)}%)`
                }
              >
                {displayData.map((row, index) => (
                  <Cell
                    key={`${row.type}-${index}`}
                    fill={colorsByType[row.type] || cssVar("--primary", "#10b981")}
                    // borde del slice usando el fondo del tema
                    stroke={cssVar("--bg-3", "#0a0c10")}
                    strokeWidth={1}
                  />
                ))}
              </Pie>

              <Tooltip
                formatter={(value) => `RD$ ${Number(value || 0).toFixed(2)}`}
                labelFormatter={(label) => `Tipo: ${label}`}
                contentStyle={tooltipStyle}
                itemStyle={{ color: "var(--text)" }}
                labelStyle={{ color: "var(--heading)", fontWeight: 700 }}
              />

              <Legend
                wrapperStyle={{ color: cssVar("--text", "#e2e8f0") }}
                formatter={(value) => (
                  <span className="text-xs sm:text-sm" style={{ color: "var(--text)" }}>
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ExpenseByStabilityChart;
