import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import FFSelect from "../FFSelect";
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
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [loading, setLoading] = useState(false);

  // total | avg_txn | avg_day
  const [mode, setMode] = useState("total");

  const currentYear = new Date().getFullYear();

  // ✅ FFSelect options
  const yearOptions = useMemo(
    () =>
      Array.from({ length: 6 }, (_, i) => {
        const y = String(currentYear - i);
        return { value: y, label: y };
      }),
    [currentYear]
  );

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/expense-by-weekday`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year: Number(year) },
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
    const bar = cssVar("--warning", "#fbbf24");
    return { axis, tick, grid, bar };
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
      className="rounded-2xl p-6 border shadow-[0_16px_40px_rgba(0,0,0,0.85)] space-y-4"
      style={{
        background:
          "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--bg-2) 70%, var(--bg-3)), var(--bg-3))",
        borderColor: "var(--border-rgba)",
        color: "var(--text)",
      }}
    >
      {/* ✅ Header (layout premium) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h3
            className="text-lg sm:text-xl font-semibold"
            style={{ color: "var(--heading)" }}
          >
            Hábitos de gasto por día de la semana
          </h3>
          <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
            Analiza tu gasto según el día y cambia la métrica para obtener
            distintas perspectivas.
          </p>
        </div>

        {/* ✅ Controles: grid en mobile, barra en desktop */}
        <div
          className="
            w-full lg:w-auto
            grid grid-cols-1 sm:grid-cols-2 gap-3
            lg:flex lg:items-end lg:justify-end
          "
        >
          {/* ✅ Año (FFSelect) */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "var(--muted)" }}
            >
              Año
            </label>

            <FFSelect
              value={year}
              onChange={(v) => setYear(String(v))}
              options={yearOptions}
              placeholder="Selecciona año..."
              searchable={false}
              clearable={false}
              className="w-full lg:w-[160px]"
              getOptionLabel={(o) => o.label}
              getOptionValue={(o) => o.value}
            />

            {loading ? (
              <span className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>
                Actualizando…
              </span>
            ) : null}
          </div>

          {/* ✅ Métrica (segmented control) */}
          <div className="flex flex-col gap-1">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "var(--muted)" }}
            >
              Métrica
            </label>

            <div
              className="h-10 w-full lg:w-[320px] flex items-center gap-1 rounded-lg p-1"
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
                    className="h-full flex-1 text-xs rounded-md transition"
                    style={{
                      background: active
                        ? "color-mix(in srgb, var(--panel) 92%, var(--bg-1))"
                        : "transparent",
                      color: active ? "var(--text)" : "var(--muted)",
                      border: active
                        ? "1px solid color-mix(in srgb, var(--border-rgba) 85%, transparent)"
                        : "1px solid transparent",
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