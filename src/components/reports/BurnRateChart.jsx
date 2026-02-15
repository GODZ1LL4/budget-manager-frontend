// src/components/reports/BurnRateChart.jsx
import { useEffect, useMemo, useState } from "react";
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

function BurnRateTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  // Solo Ideal y Real (ignoramos el área)
  const filtered = payload.filter(
    (item) => item.dataKey === "Ideal" || item.dataKey === "Real"
  );
  if (!filtered.length) return null;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-3)",
        color: "var(--text)",
        border: "1px solid var(--border-rgba)",
        borderRadius: "12px",
        padding: "10px 12px",
        boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
        minWidth: 220,
      }}
    >
      <div style={{ fontWeight: 800, marginBottom: 6 }}>
        Día {label}
      </div>

      {filtered.map((entry) => (
        <div
          key={entry.dataKey}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            fontSize: 13,
            lineHeight: "18px",
            marginTop: 4,
          }}
        >
          <span style={{ color: "var(--muted)", fontWeight: 700 }}>
            {entry.dataKey === "Ideal" ? "Ideal" : "Real"}
          </span>
          <span style={{ fontWeight: 800 }}>{formatCurrencyDOP(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function BurnRateChart({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Tokens de estilo (todos centralizados)
  const styles = useMemo(() => {
    return {
      card: {
        background:
          "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 80%, transparent), var(--bg-2))",
        border: "1px solid var(--border-rgba)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
        color: "var(--text)",
      },
      subtleText: { color: "var(--muted)" },
      axisLine: { stroke: "var(--border-rgba)" },
      tick: { fill: "var(--text)", fontSize: 14 },
      cursor: {
        stroke: "var(--muted)",
        strokeWidth: 1,
        strokeDasharray: "3 3",
      },
      legendWrap: { color: "var(--text)", fontSize: "0.95rem" },
    };
  }, []);

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
    return (
      <div className="p-4" style={styles.card}>
        <p style={styles.subtleText}>Cargando ritmo de gasto...</p>
      </div>
    );
  }

  if (!data?.series?.length) {
    return (
      <div className="p-4" style={styles.card}>
        <p style={styles.subtleText}>
          No hay datos suficientes para calcular el burn rate de este mes.
        </p>
      </div>
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

  const lastPoint =
    data.series[day_of_month - 1] || data.series[data.series.length - 1];

  const isOverIdeal =
    (lastPoint?.actual_cumulative || 0) > (lastPoint?.ideal_cumulative || 0);

  const realLineColor = isOverIdeal ? "var(--danger)" : "var(--success)";
  const idealLineColor = "var(--primary)";

  const chartData = data.series.map((d) => ({
    day: d.day,
    Ideal: d.ideal_cumulative,
    Real: d.actual_cumulative,
    RealArea: d.actual_cumulative,
    isToday: d.day === day_of_month,
  }));

  const renderRealDot = ({ cx, cy, payload }) => {
    if (!payload?.isToday) return null;
    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={realLineColor}
        stroke="var(--text)"
        strokeWidth={2}
      />
    );
  };

  const bannerStyle = {
    backgroundColor: isOverIdeal
      ? "color-mix(in srgb, var(--danger) 16%, transparent)"
      : "color-mix(in srgb, var(--success) 16%, transparent)",
    border: `1px solid ${
      isOverIdeal
        ? "color-mix(in srgb, var(--danger) 55%, var(--border-rgba))"
        : "color-mix(in srgb, var(--success) 55%, var(--border-rgba))"
    }`,
    borderRadius: "var(--radius-md)",
    color: "var(--text)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
  };

  const bannerTitleColor = isOverIdeal ? "var(--danger)" : "var(--success)";

  return (
    <div className="rounded-2xl p-6 space-y-4" style={styles.card}>
      {/* Banner de estado (tokenizado) */}
      <div className="px-4 py-3" style={bannerStyle}>
        <p
          className="font-semibold flex items-center gap-2 text-base"
          style={{ color: bannerTitleColor }}
        >
          {isOverIdeal
            ? "🔥 Estás gastando por encima del ritmo ideal."
            : "🟢 Vas por debajo del ritmo ideal, buen control."}
        </p>

        <div className="mt-1 text-sm" style={{ color: "var(--text)" }}>
          <div>
            Diferencia vs ideal a la fecha:{" "}
            <strong>{formatCurrencyDOP(variance_to_ideal)}</strong>
          </div>
          <div>
            Diferencia proyectada vs presupuesto del mes:{" "}
            <strong>{formatCurrencyDOP(variance_to_budget_end)}</strong>
          </div>
        </div>
      </div>

      {/* Resumen numérico */}
      <div className="text-sm space-y-1 leading-relaxed">
        <p>
          <span style={styles.subtleText}>Mes:</span>{" "}
          <strong>{month}</strong>{" "}
          <span style={styles.subtleText}>— Hoy:</span>{" "}
          <strong>{today}</strong>
        </p>

        <p>
          <span style={styles.subtleText}>Presupuesto mensual:</span>{" "}
          <strong>{formatCurrencyDOP(budget_total)}</strong>
        </p>

        <p>
          <span style={styles.subtleText}>Gasto ideal acumulado:</span>{" "}
          <strong>{formatCurrencyDOP(ideal_to_date)}</strong>{" "}
          <span style={styles.subtleText}>| Gasto real acumulado:</span>{" "}
          <strong>{formatCurrencyDOP(actual_to_date)}</strong>
        </p>

        <p>
          <span style={styles.subtleText}>
            Proyección de gasto al cierre del mes:
          </span>{" "}
          <strong>{formatCurrencyDOP(projected_end_of_month)}</strong>
        </p>
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData}>
            <XAxis
              dataKey="day"
              tick={styles.tick}
              axisLine={styles.axisLine}
              tickLine={styles.axisLine}
            />
            <YAxis
              tick={styles.tick}
              axisLine={styles.axisLine}
              tickLine={styles.axisLine}
            />

            <Tooltip content={<BurnRateTooltip />} cursor={styles.cursor} />

            <Legend
              wrapperStyle={styles.legendWrap}
              payload={[
                {
                  id: "Ideal",
                  value: "Ideal",
                  type: "line",
                  color: idealLineColor,
                },
                {
                  id: "Real",
                  value: "Real",
                  type: "line",
                  color: realLineColor,
                },
              ]}
            />

            {/* Área real (no aparece en leyenda/tooltip) */}
            <Area
              type="monotone"
              dataKey="RealArea"
              stroke="none"
              fill={realLineColor}
              fillOpacity={0.08}
              isAnimationActive={false}
            />

            {/* Línea ideal */}
            <Line
              type="monotone"
              dataKey="Ideal"
              stroke={idealLineColor}
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
            />

            {/* Línea real */}
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

      <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
        La línea <strong>Ideal</strong> representa un gasto lineal del
        presupuesto durante todo el mes. La línea <strong>Real</strong> muestra
        tu gasto acumulado día a día. Si la línea real va por encima de la
        ideal, estás quemando el presupuesto más rápido de lo previsto.
      </p>
    </div>
  );
}
