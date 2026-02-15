import { useEffect, useMemo, useState } from "react";
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

// ✅ helper: leer CSS variables (tema actual)
function cssVar(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name);
  return (v || fallback).trim();
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || payload.length === 0) return null;

  const row = payload[0]?.payload;
  if (!row) return null;

  const balance = Number(row.balance ?? 0) || 0;

  const text = cssVar("--text", "#e2e8f0");
  const muted = cssVar("--muted", "#94a3b8");
  const border = cssVar("--border-rgba", "rgba(148,163,184,0.22)");
  const bg = cssVar("--bg-3", "#0a0c10");
  const success = cssVar("--success", "#34d399");
  const danger = cssVar("--danger", "#fb7185");

  const balanceColor = balance >= 0 ? success : danger;

  return (
    <div
      style={{
        background: `color-mix(in srgb, ${bg} 78%, transparent)`,
        padding: "10px 12px",
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-md)",
        color: text,
        fontSize: "0.95rem",
        boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
        backdropFilter: "blur(10px)",
        minWidth: 220,
      }}
    >
      <p style={{ marginBottom: 6, fontWeight: 800, color: text }}>
        Mes: {label}
      </p>
      <p style={{ margin: 0, color: muted }}>
        Ingresos: {formatMoney(row.income)}
      </p>
      <p style={{ margin: 0, color: muted }}>
        Gastos: {formatMoney(row.expense)}
      </p>

      <p
        style={{
          margin: 0,
          marginTop: 6,
          fontWeight: 800,
          color: balanceColor,
        }}
      >
        Balance: {formatMoney(balance)}
      </p>
    </div>
  );
}

function MonthlyIncomeVsExpenseChart({ token }) {
  const [data, setData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  const api = import.meta.env.VITE_API_URL;

  const currentYear = new Date().getFullYear();
  const yearOptions = useMemo(
    () => Array.from({ length: 6 }, (_, i) => currentYear - i),
    [currentYear]
  );

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    axios
      .get(`${api}/analytics/monthly-income-expense-avg`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { year },
      })
      .then((res) => setData(res?.data?.data || []))
      .catch((err) => console.error("Error al cargar datos:", err))
      .finally(() => setLoading(false));
  }, [token, api, year]);

  // KPI: Balance acumulado del año
  const yearlyBalance = data.reduce(
    (acc, row) => acc + (Number(row.balance ?? 0) || 0),
    0
  );

  const yearlyBalanceStyle = {
    color: yearlyBalance >= 0 ? "var(--success)" : "var(--danger)",
  };

  const monthLabel = (m) => (typeof m === "string" ? m.slice(5, 7) : m);

  // ✅ tokens → colores reales
  const gridStroke = cssVar("--border-rgba", "rgba(148,163,184,0.22)");
  const axisStroke = cssVar("--muted", "#94a3b8");
  const tickFill = cssVar("--text", "#e2e8f0");

  const incomeFill = cssVar("--success", "#10b981");
  const expenseFill = cssVar("--danger", "#fb7185");

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
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <h3
          className="text-lg md:text-xl font-semibold"
          style={{ color: "var(--heading)" }}
        >
          Balance de Ingreso vs Gasto
        </h3>

        <div className="flex flex-col items-end gap-1">
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
                border: "1px solid var(--control-border)",
                color: "var(--control-text)",
                boxShadow: "none",
                outline: "none",
              }}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <p className="text-sm font-medium" style={yearlyBalanceStyle}>
            Balance acumulado del año:{" "}
            <span className="font-semibold">{formatMoney(yearlyBalance)}</span>
            {loading ? (
              <span className="ml-2 text-xs" style={{ color: "var(--muted)" }}>
                Actualizando…
              </span>
            ) : null}
          </p>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm italic" style={{ color: "var(--muted)" }}>
          No hay datos disponibles para el período actual.
        </p>
      ) : (
        <div className="w-full h-[350px]">
          <ResponsiveContainer>
            <BarChart data={data}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />

              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 14 }}
              />

              <YAxis
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 14 }}
              />

              <Tooltip content={<CustomTooltip />} />

              <Legend
                wrapperStyle={{ color: tickFill }}
                formatter={(value) => (
                  <span
                    className="text-xs sm:text-sm"
                    style={{ color: tickFill }}
                  >
                    {value}
                  </span>
                )}
              />

              <Bar
                dataKey="income"
                fill={incomeFill}
                name="Ingresos"
                radius={[4, 4, 0, 0]}
              />

              <Bar
                dataKey="expense"
                fill={expenseFill}
                name="Gastos"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default MonthlyIncomeVsExpenseChart;
