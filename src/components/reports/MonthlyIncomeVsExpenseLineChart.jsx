import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import FFSelect from "../FFSelect";

function formatMonthLabel(ym) {
  if (ym == null) return "—";

  const s = String(ym);
  if (!/^\d{4}-\d{2}$/.test(s)) return s;

  const y = s.slice(0, 4);
  const m = Number(s.slice(5, 7));

  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  return `${months[m - 1] || s} ${y}`;
}

function formatCurrency(val) {
  const n = Number(val);
  return `RD$ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function MonthlyIncomeVsExpenseLineChart({ token }) {
  const [data, setData] = useState([]);
  const [months, setMonths] = useState("6");
  const api = import.meta.env.VITE_API_URL;

  const periodOptions = useMemo(
    () => [
      { value: "3", label: "3 meses" },
      { value: "6", label: "6 meses" },
      { value: "12", label: "12 meses" },
      { value: "24", label: "24 meses" },
    ],
    []
  );

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${api}/analytics/income-vs-expense-monthly`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { months: Number(months) || 6 },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) =>
        console.error("Error cargando Ingreso vs Gasto mensual:", err)
      );
  }, [token, months, api]);

  // ===== Recharts styles tokenizados =====
  const gridStroke = "color-mix(in srgb, var(--border-rgba) 55%, transparent)";
  const axisStroke = "color-mix(in srgb, var(--text) 55%, transparent)";
  const tickFill = "color-mix(in srgb, var(--text) 78%, transparent)";

  const tooltipStyles = useMemo(
    () => ({
      backgroundColor: "var(--panel)",
      border: "1px solid var(--border-rgba)",
      color: "var(--text)",
      borderRadius: "0.75rem",
      boxShadow: "var(--glow-shadow)",
    }),
    []
  );

  const legendStyle = useMemo(
    () => ({ color: "color-mix(in srgb, var(--text) 85%, transparent)" }),
    []
  );

  // Colores de líneas por token (ingreso=success, gasto=danger)
  const incomeStroke = "var(--success)";
  const expenseStroke = "var(--danger)";

  // (Opcional) dot con un tono más “sólido” del token
  const incomeDotFill = "color-mix(in srgb, var(--success) 92%, var(--text))";
  const expenseDotFill = "color-mix(in srgb, var(--danger) 92%, var(--text))";

  return (
    <div
      className="rounded-2xl p-6 space-y-4 border"
      style={{
        borderColor: "var(--border-rgba)",
        background:
          "linear-gradient(to bottom right, var(--bg-1), color-mix(in srgb, var(--panel) 45%, transparent), var(--bg-1))",
        boxShadow: "0 16px 40px rgba(0,0,0,0.55)",
      }}
    >
      {/* Header (FFSelect + mejor distribución) */}
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-[var(--text)]">
            Ingresos vs Gastos (mensual)
          </h3>
          <p className="text-sm mt-1 text-[color-mix(in srgb,var(--text)_70%,transparent)]">
            Comparación histórica de ingresos y gastos por mes.
          </p>
        </div>

        <div className="w-full lg:w-[240px]">
          <label
            className="text-[11px] uppercase tracking-[0.18em]"
            style={{ color: "color-mix(in srgb,var(--text)_70%,transparent)" }}
          >
            Período
          </label>

          <FFSelect
            value={months}
            onChange={(v) => setMonths(String(v))}
            options={periodOptions}
            placeholder="Selecciona período..."
            searchable={false}
            clearable={false}
            className="mt-1 w-full"
            getOptionLabel={(o) => o.label}
            getOptionValue={(o) => o.value}
          />
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm italic text-[color-mix(in srgb,var(--text)_60%,transparent)]">
          No hay datos suficientes para este período.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />

              <XAxis
                dataKey="month"
                tickFormatter={formatMonthLabel}
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 12 }}
              />

              <YAxis stroke={axisStroke} tick={{ fill: tickFill, fontSize: 12 }} />

              <Tooltip
                formatter={(val) => formatCurrency(val)}
                labelFormatter={formatMonthLabel}
                contentStyle={tooltipStyles}
              />

              <Legend wrapperStyle={legendStyle} />

              <Line
                type="linear"
                dataKey="income"
                name="Ingresos"
                stroke={incomeStroke}
                strokeWidth={2.5}
                dot={{
                  r: 3,
                  fill: incomeDotFill,
                  stroke: incomeStroke,
                  strokeWidth: 1.5,
                }}
                activeDot={{
                  r: 5,
                  fill: incomeDotFill,
                  stroke: incomeStroke,
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />

              <Line
                type="linear"
                dataKey="expense"
                name="Gastos"
                stroke={expenseStroke}
                strokeWidth={2.5}
                dot={{
                  r: 3,
                  fill: expenseDotFill,
                  stroke: expenseStroke,
                  strokeWidth: 1.5,
                }}
                activeDot={{
                  r: 5,
                  fill: expenseDotFill,
                  stroke: expenseStroke,
                  strokeWidth: 2,
                }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default MonthlyIncomeVsExpenseLineChart;