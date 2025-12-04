import { useEffect, useState } from "react";
import axios from "axios";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";

function formatCurrencyDOP(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
}

// Tooltip custom para no duplicar la serie "Real"
function BurnRateTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  // Nos quedamos solo con Ideal y Real (ignoramos el área)
  const filtered = payload.filter(
    (item) => item.dataKey === "Ideal" || item.dataKey === "Real"
  );

  if (!filtered.length) return null;

  return (
    <div
      style={{
        backgroundColor: "#020617",
        color: "#e5e7eb",
        border: "1px solid #4b5563",
        borderRadius: "0.5rem",
        padding: "10px 14px",
        fontSize: "0.85rem",
        lineHeight: "1.3rem",
      }}
    >
      <p style={{ marginBottom: 6 }}>
        <strong>Día {label}</strong>
      </p>
      {filtered.map((entry) => (
        <p key={entry.dataKey} style={{ margin: 0 }}>
          {entry.dataKey === "Ideal" ? "Ideal" : "Real"}:{" "}
          {formatCurrencyDOP(entry.value)}
        </p>
      ))}
    </div>
  );
}

function BurnRateChart({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBurnRate = async () => {
      try {
        const res = await axios.get(
          `${api}/analytics/spending-burn-rate-current-month`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setData(res.data.data || null);
      } catch (err) {
        console.error("Error al cargar burn rate:", err);
      } finally {
        setLoading(false);
      }
    };

    if (token) fetchBurnRate();
  }, [token, api]);

  if (loading) {
    return <p className="text-sm text-slate-300">Cargando ritmo de gasto...</p>;
  }

  if (!data || !data.series || !data.series.length) {
    return (
      <p className="text-sm text-slate-300">
        No hay datos suficientes para calcular el burn rate de este mes.
      </p>
    );
  }

  const {
    month,
    today,
    budget_total,
    ideal_to_date,
    actual_to_date,
    projected_end_of_month,
    variance_to_ideal,
    variance_to_budget_end,
    day_of_month,
  } = data;

  // Punto del día actual
  const lastPoint =
    data.series[day_of_month - 1] || data.series[data.series.length - 1];

  const isOverIdeal =
    (lastPoint?.actual_cumulative || 0) > (lastPoint?.ideal_cumulative || 0);

  const realLineColor = isOverIdeal ? "#e63946" : "#16a34a"; // rojo / verde

  // Data para el gráfico (separamos Real y RealArea)
  const chartData = data.series.map((d) => ({
    day: d.day,
    Ideal: d.ideal_cumulative,
    Real: d.actual_cumulative,
    RealArea: d.actual_cumulative,
    isToday: d.day === day_of_month,
  }));

  // Dot grande solo para el día actual
  const renderRealDot = (props) => {
    const { cx, cy, payload } = props;
    if (!payload || !payload.isToday) return null;

    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={realLineColor}
        stroke="#ffffff"
        strokeWidth={2}
      />
    );
  };

  return (
    <div>
      {/* Banner de estado */}
      <div
        className={`mb-3 text-sm rounded border px-4 py-3 ${
          isOverIdeal
            ? "bg-red-900/40 text-red-200 border-red-500/60"
            : "bg-emerald-900/40 text-emerald-200 border-emerald-500/60"
        }`}
      >
        <p className="font-semibold flex items-center gap-1 text-base">
          {isOverIdeal
            ? "🔥 Estás gastando por encima del ritmo ideal."
            : "🟢 Vas por debajo del ritmo ideal, buen control."}
        </p>
        <p>
          Diferencia vs ideal a la fecha:{" "}
          <strong>{formatCurrencyDOP(variance_to_ideal)}</strong>
        </p>
        <p>
          Diferencia proyectada vs presupuesto del mes:{" "}
          <strong>{formatCurrencyDOP(variance_to_budget_end)}</strong>
        </p>
      </div>

      {/* Resumen numérico */}
      <div className="mb-3 text-sm text-slate-200 space-y-1 leading-relaxed">
        <p>
          Mes: <strong>{month}</strong> — Hoy: <strong>{today}</strong>
        </p>
        <p>
          Presupuesto mensual:{" "}
          <strong>{formatCurrencyDOP(budget_total)}</strong>
        </p>
        <p>
          Gasto ideal acumulado:{" "}
          <strong>{formatCurrencyDOP(ideal_to_date)}</strong> | Gasto real
          acumulado: <strong>{formatCurrencyDOP(actual_to_date)}</strong>
        </p>
        <p>
          Proyección de gasto al cierre del mes:{" "}
          <strong>{formatCurrencyDOP(projected_end_of_month)}</strong>
        </p>
      </div>

      {/* Gráfico */}
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData}>
            <XAxis
              dataKey="day"
              tick={{ fill: "#e5e7eb", fontSize: 14 }}
              axisLine={{ stroke: "#64748b" }}
              tickLine={{ stroke: "#64748b" }}
            />
            <YAxis
              tick={{ fill: "#e5e7eb", fontSize: 14 }}
              axisLine={{ stroke: "#64748b" }}
              tickLine={{ stroke: "#64748b" }}
            />
            <Tooltip
              content={<BurnRateTooltip />}
              cursor={{
                stroke: "#64748b",
                strokeWidth: 1,
                strokeDasharray: "3 3",
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "1rem", color: "#e5e7eb" }}
              payload={[
                {
                  id: "Ideal",
                  value: "Ideal",
                  type: "line",
                  color: "#8884d8",
                },
                {
                  id: "Real",
                  value: "Real",
                  type: "line",
                  color: realLineColor,
                },
              ]}
            />

            {/* Área bajo la línea real (no aparece en leyenda ni tooltip) */}
            <Area
              type="monotone"
              dataKey="RealArea"
              stroke="none"
              fill={realLineColor}
              fillOpacity={0.08}
              isAnimationActive={false}
            />

            {/* Línea ideal (discontinua) */}
            <Line
              type="monotone"
              dataKey="Ideal"
              stroke="#8884d8"
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
            />

            {/* Línea real con color dinámico y punto del día actual */}
            <Line
              type="monotone"
              dataKey="Real"
              stroke={realLineColor}
              strokeWidth={3}
              dot={renderRealDot}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-base text-slate-200 mt-3 leading-relaxed">
        La línea <strong>Ideal</strong> representa un gasto lineal del
        presupuesto durante todo el mes. La línea <strong>Real</strong> muestra
        tu gasto acumulado día a día. Si la línea real va por encima de la
        ideal, estás quemando el presupuesto más rápido de lo previsto.
      </p>
    </div>
  );
}

export default BurnRateChart;
