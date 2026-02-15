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

const formatCurrency = (v) =>
  new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(Number.isFinite(Number(v)) ? Number(v) : 0);

// ✅ helper: leer CSS variables (tema actual)
function cssVar(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || fallback).trim();
}

function ExpenseByWeekdayChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [data, setData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  // total | avg_txn | avg_day
  const [mode, setMode] = useState("total");

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/expense-by-weekday`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) =>
        console.error("Error cargando gasto por día de la semana:", err)
      )
      .finally(() => setLoading(false));
  }, [token, api, year]);

  const modeLabel =
    mode === "total"
      ? "Gasto total"
      : mode === "avg_txn"
      ? "Promedio por transacción"
      : "Promedio por día";

  const dataKey = mode;

  // ✅ tokens a colores para Recharts
  const chartColors = useMemo(() => {
    const axis = cssVar("--muted", "#94a3b8");
    const tick = cssVar("--text", "#e2e8f0");
    const grid = cssVar("--border-rgba", "rgba(148,163,184,0.22)");
    const bar = cssVar("--warning", "#fbbf24"); // para “gasto” luce bien
    const panelBg = cssVar("--bg-3", "#0a0c10");
    const border = cssVar("--border-rgba", "rgba(148,163,184,0.22)");
    const text = cssVar("--text", "#e2e8f0");
    const heading = cssVar("--heading", tick);

    return { axis, tick, grid, bar, panelBg, border, text, heading };
  }, [mode]);

  // ✅ tooltip tokenizado
  const tooltipStyle = useMemo(
    () => ({
      background: "color-mix(in srgb, var(--bg-3) 78%, transparent)",
      border: "1px solid var(--border-rgba)",
      color: "var(--text)",
      borderRadius: "var(--radius-md)",
      boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
      padding: "10px 12px",
      backdropFilter: "blur(10px)",
    }),
    []
  );

  return (
    <div
      className="
        rounded-2xl p-6
        border shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-4
      "
      style={{
        background:
          "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--bg-2) 70%, var(--bg-3)), var(--bg-3))",
        borderColor: "var(--border-rgba)",
        color: "var(--text)",
      }}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div>
          <h3 className="text-xl font-semibold" style={{ color: "var(--heading)" }}>
            Hábitos de gasto por día de la semana
          </h3>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Analiza tu gasto según el día y cambia la métrica para obtener
            distintas perspectivas.
          </p>
        </div>

        <div className="flex items-end gap-3">
          {/* Año */}
          <div className="flex flex-col items-end">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "var(--muted)" }}
            >
              Año
            </label>
            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              className="mt-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2"
              style={{
                background: "var(--control-bg)",
                border: "1px solid var(--border-rgba)",
                color: "var(--control-text)",
                boxShadow: "none",
                outline: "none",
                // ring
                "--tw-ring-color": "color-mix(in srgb, var(--ring) 60%, transparent)",
              }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Métrica */}
          <div className="flex flex-col items-end">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "var(--muted)" }}
            >
              Métrica
            </label>

            <div
              className="mt-1 inline-flex rounded-lg p-1"
              style={{
                border: "1px solid var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              }}
            >
              {[
                { key: "total", label: "Total" },
                { key: "avg_txn", label: "Transacción" },
                { key: "avg_day", label: "Por día" },
              ].map((b) => {
                const active = mode === b.key;
                return (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setMode(b.key)}
                    className="px-3 py-1 text-xs rounded-md transition"
                    style={{
                      background: active
                        ? "color-mix(in srgb, var(--panel) 88%, var(--bg-1))"
                        : "transparent",
                      color: active ? "var(--text)" : "var(--muted)",
                      border: active ? "1px solid var(--border-rgba)" : "1px solid transparent",
                    }}
                  >
                    {b.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Contenido */}
      {loading && data.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          Cargando…
        </p>
      ) : data.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          No hay datos suficientes para este análisis.
        </p>
      ) : (
        <div className="w-full">
          {/* Área del gráfico */}
          <div className="h-[300px] w-full">
            <ResponsiveContainer>
              <BarChart data={data}>
                <CartesianGrid stroke={chartColors.grid} strokeDasharray="4 4" />

                <XAxis
                  dataKey="label"
                  stroke={chartColors.axis}
                  tick={{ fill: chartColors.tick, fontSize: 12 }}
                />
                <YAxis
                  stroke={chartColors.axis}
                  tick={{ fill: chartColors.tick, fontSize: 12 }}
                />

                <Tooltip
                  formatter={(val) => formatCurrency(val)}
                  labelFormatter={(label) => `Día: ${label}`}
                  contentStyle={tooltipStyle}
                  itemStyle={{ color: "var(--text)" }}
                  labelStyle={{ color: "var(--heading)", fontWeight: 700 }}
                />

                <Legend
                  wrapperStyle={{ color: chartColors.tick }}
                  formatter={() => (
                    <span style={{ color: "var(--text)" }} className="text-sm">
                      {modeLabel}
                    </span>
                  )}
                />

                <Bar
                  dataKey={dataKey}
                  fill={chartColors.bar}
                  name={modeLabel}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Footer */}
          <div
            className="mt-3 rounded-xl border p-3"
            style={{
              borderColor: "var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 55%, transparent)",
            }}
          >
            <p
              className="text-xs leading-relaxed whitespace-normal break-words"
              style={{ color: "var(--muted)" }}
            >
              <span style={{ color: "var(--heading)" }} className="font-semibold">
                Promedio por transacción
              </span>{" "}
              indica cuánto gastas cada vez que realizas una compra ese día.{" "}
              <span style={{ color: "var(--heading)" }} className="font-semibold">
                Promedio por día
              </span>{" "}
              muestra cuánto te cuesta ese día en promedio, incluso si no compras
              siempre.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseByWeekdayChart;
