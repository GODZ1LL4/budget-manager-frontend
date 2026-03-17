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
} from "recharts";
import FFSelect from "../FFSelect";

function formatCurrency(val) {
  const n = Number(val);
  return `RD$ ${(Number.isFinite(n) ? n : 0).toFixed(2)}`;
}

function DailyExpenseLineChart({ token }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [data, setData] = useState([]);
  const [month, setMonth] = useState(String(currentMonth));
  const [year, setYear] = useState(String(currentYear));
  const api = import.meta.env.VITE_API_URL;

  const monthOptions = useMemo(
    () => [
      { value: "1", label: "Enero" },
      { value: "2", label: "Febrero" },
      { value: "3", label: "Marzo" },
      { value: "4", label: "Abril" },
      { value: "5", label: "Mayo" },
      { value: "6", label: "Junio" },
      { value: "7", label: "Julio" },
      { value: "8", label: "Agosto" },
      { value: "9", label: "Septiembre" },
      { value: "10", label: "Octubre" },
      { value: "11", label: "Noviembre" },
      { value: "12", label: "Diciembre" },
    ],
    []
  );

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = currentYear + 1; y >= currentYear - 5; y--) {
      years.push({ value: String(y), label: String(y) });
    }
    return years;
  }, [currentYear]);

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/daily-expense-by-month`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          month: Number(month),
          year: Number(year),
        },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) =>
        console.error("Error cargando gasto diario del mes:", err)
      );
  }, [token, month, year, api]);

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

  const expenseStroke = "var(--danger)";
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
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-xl font-semibold text-[var(--text)]">
            Gasto por dia del mes
          </h3>
          <p className="text-sm mt-1 text-[color-mix(in srgb,var(--text)_70%,transparent)]">
            Evolucion diaria del gasto en el mes seleccionado.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-auto">
          <div className="min-w-[180px]">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "color-mix(in srgb,var(--text)_70%,transparent)" }}
            >
              Mes
            </label>

            <FFSelect
              value={month}
              onChange={(v) => setMonth(String(v))}
              options={monthOptions}
              placeholder="Selecciona mes..."
              searchable={false}
              clearable={false}
              className="mt-1 w-full"
              getOptionLabel={(o) => o.label}
              getOptionValue={(o) => o.value}
            />
          </div>

          <div className="min-w-[140px]">
            <label
              className="text-[11px] uppercase tracking-[0.18em]"
              style={{ color: "color-mix(in srgb,var(--text)_70%,transparent)" }}
            >
              Ano
            </label>

            <FFSelect
              value={year}
              onChange={(v) => setYear(String(v))}
              options={yearOptions}
              placeholder="Selecciona ano..."
              searchable={false}
              clearable={false}
              className="mt-1 w-full"
              getOptionLabel={(o) => o.label}
              getOptionValue={(o) => o.value}
            />
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-sm italic text-[color-mix(in srgb,var(--text)_60%,transparent)]">
          No hay datos suficientes para este mes.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <LineChart data={data}>
              <CartesianGrid stroke={gridStroke} strokeDasharray="4 4" />

              <XAxis
                dataKey="day"
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 12 }}
              />

              <YAxis
                stroke={axisStroke}
                tick={{ fill: tickFill, fontSize: 12 }}
              />

              <Tooltip
                formatter={(val) => formatCurrency(val)}
                labelFormatter={(label) => `Día ${label}`}
                contentStyle={tooltipStyles}
              />

              <Line
                type="linear"
                dataKey="expense"
                name="Gasto"
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

export default DailyExpenseLineChart;
