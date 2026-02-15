import { useEffect, useMemo, useRef, useState } from "react";
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

// Tooltip custom: Expected vs Real (sin duplicar área)
function AdvancedBurnRateTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;

  const filtered = payload.filter(
    (item) => item.dataKey === "Expected" || item.dataKey === "Real"
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
        fontSize: "0.85rem",
        lineHeight: "1.3rem",
        minWidth: 220,
      }}
    >
      <p style={{ marginBottom: 6, fontWeight: 800 }}>
        Día {label}
      </p>

      {filtered.map((entry) => (
        <div
          key={entry.dataKey}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            marginTop: 4,
          }}
        >
          <span style={{ color: "var(--muted)", fontWeight: 700 }}>
            {entry.dataKey === "Expected" ? "Esperado" : "Real"}
          </span>
          <span style={{ fontWeight: 800 }}>{formatCurrencyDOP(entry.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdvancedBurnRateChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  // ===== Params (editables) =====
  const [months, setMonths] = useState(6);
  const [minOccurrences, setMinOccurrences] = useState(3);
  const [includeOccasional, setIncludeOccasional] = useState(false);
  const [includeNoise, setIncludeNoise] = useState(true);

  const [minIntervalDays, setMinIntervalDays] = useState(3);
  const [maxIntervalDays, setMaxIntervalDays] = useState(70);
  const [maxCoefVariation, setMaxCoefVariation] = useState(0.6);

  // ===== Data =====
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");

  const didInitialLoad = useRef(false);

  // ===== Tokenized UI styles =====
  const ui = useMemo(() => {
    const card = {
      background:
        "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 80%, transparent), var(--bg-2))",
      border: "1px solid var(--border-rgba)",
      borderRadius: "var(--radius-lg)",
      boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
      color: "var(--text)",
    };

    const controlBase = {
      backgroundColor: "var(--control-bg)",
      color: "var(--control-text)",
      border: "1px solid var(--control-border)",
      borderRadius: "var(--radius-md)",
      padding: "8px 10px",
      outline: "none",
      boxShadow: "none",
    };

    const label = {
      color: "var(--muted)",
      fontSize: 12,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
    };

    return {
      card,
      label,
      control: controlBase,
      helper: { color: "var(--muted)" },

      axisLine: { stroke: "var(--border-rgba)" },
      tick: { fill: "var(--text)", fontSize: 14 },
      cursor: { stroke: "var(--muted)", strokeWidth: 1, strokeDasharray: "3 3" },

      legend: { fontSize: "0.95rem", color: "var(--text)" },

      // Botón principal (recalcular) como “warning/primary” según tus tokens
      btn: {
        backgroundColor: "var(--btn-warning-bg)",
        color: "var(--btn-warning-text)",
        border: "1px solid color-mix(in srgb, var(--btn-warning-bg) 60%, var(--border-rgba))",
        borderRadius: "var(--btn-radius)",
        padding: "10px 14px",
        fontWeight: 800,
        boxShadow: "0 0 var(--btn-glow-blur) 0 color-mix(in srgb, var(--glow-color) 40%, transparent)",
        transition: "filter 150ms ease, transform 120ms ease, opacity 150ms ease",
      },

      detailsBox: {
        border: "1px solid var(--border-rgba)",
        backgroundColor: "color-mix(in srgb, var(--panel) 55%, transparent)",
        borderRadius: "var(--radius-md)",
      },
    };
  }, []);

  const load = async () => {
    if (!token) return;

    setLoading(true);
    setErrMsg("");

    try {
      const res = await axios.get(
        `${api}/analytics/advanced-burn-rate-current-month`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            months,
            min_occurrences: minOccurrences,
            include_occasional: includeOccasional,
            include_noise: includeNoise,
            min_interval_days: minIntervalDays,
            max_interval_days: maxIntervalDays,
            max_coef_variation: maxCoefVariation,
          },
        }
      );

      setData(res.data?.data || null);
    } catch (e) {
      console.error("Advanced burn rate error:", e);
      setData(null);
      setErrMsg(e.response?.data?.error || "No se pudo calcular el burn rate.");
    } finally {
      setLoading(false);
    }
  };

  // 1 carga inicial
  useEffect(() => {
    if (!token || didInitialLoad.current) return;
    didInitialLoad.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const chartData = useMemo(() => {
    const series = data?.series || [];
    return series.map((d) => ({
      day: d.day,
      Expected: d.expected_cumulative,
      Real: d.actual_cumulative,
      RealArea: d.actual_cumulative,
      isToday: d.day === data?.day_of_month,
    }));
  }, [data]);

  if (loading) {
    return (
      <div className="p-4" style={ui.card}>
        <p style={ui.helper}>Cargando burn rate avanzado...</p>
      </div>
    );
  }

  if (errMsg) {
    return (
      <div
        className="p-4"
        style={{
          ...ui.card,
          backgroundColor: "color-mix(in srgb, var(--danger) 14%, transparent)",
          border: `1px solid color-mix(in srgb, var(--danger) 55%, var(--border-rgba))`,
        }}
      >
        <p style={{ color: "var(--text)", fontWeight: 700 }}>{errMsg}</p>
      </div>
    );
  }

  if (!data?.series?.length) {
    return (
      <div className="p-4" style={ui.card}>
        <p style={ui.helper}>
          No hay datos suficientes para calcular el burn rate avanzado este mes.
        </p>
      </div>
    );
  }

  const {
    month,
    today,
    days_in_month,
    day_of_month,
    expected_total,
    expected_to_date,
    actual_to_date,
    projected_end_of_month,
    variance_to_expected,
    variance_to_expected_end,
    meta,
  } = data;

  // Histórico usado para aprender patrones
  const historyFrom = meta?.history_from || "—";
  const historyTo = meta?.history_to || "—";

  const lastPoint =
    chartData[day_of_month - 1] || chartData[chartData.length - 1];

  const isOverExpected = (lastPoint?.Real || 0) > (lastPoint?.Expected || 0);

  const realLineColor = isOverExpected ? "var(--danger)" : "var(--success)";
  const expectedLineColor = "var(--primary)";

  const bannerStyle = {
    backgroundColor: isOverExpected
      ? "color-mix(in srgb, var(--danger) 16%, transparent)"
      : "color-mix(in srgb, var(--success) 16%, transparent)",
    border: `1px solid ${
      isOverExpected
        ? "color-mix(in srgb, var(--danger) 55%, var(--border-rgba))"
        : "color-mix(in srgb, var(--success) 55%, var(--border-rgba))"
    }`,
    borderRadius: "var(--radius-md)",
    padding: "12px 14px",
    color: "var(--text)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
  };

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      {/* ===== Header + histórico usado ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 style={{ color: "var(--heading)", fontWeight: 800, fontSize: 18 }}>
            Burn Rate Avanzado (por patrones)
          </h3>

          <p className="mt-1" style={{ color: "var(--muted)", fontSize: 13 }}>
            Histórico usado: <strong style={{ color: "var(--text)" }}>{historyFrom}</strong>{" "}
            → <strong style={{ color: "var(--text)" }}>{historyTo}</strong>
          </p>
        </div>
      </div>

      {/* ===== Controls ===== */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label style={ui.label}>Historial (meses)</label>
          <input
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            style={ui.control}
            className="w-24 mt-1"
            onFocus={(e) => {
              e.currentTarget.style.border = "1px solid var(--control-border-focus)";
              e.currentTarget.style.boxShadow = "var(--control-focus-shadow)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid var(--control-border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <div>
          <label style={ui.label}>Min. ocurrencias</label>
          <input
            type="number"
            min={2}
            value={minOccurrences}
            onChange={(e) => setMinOccurrences(Number(e.target.value))}
            style={ui.control}
            className="w-24 mt-1"
            onFocus={(e) => {
              e.currentTarget.style.border = "1px solid var(--control-border-focus)";
              e.currentTarget.style.boxShadow = "var(--control-focus-shadow)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.border = "1px solid var(--control-border)";
              e.currentTarget.style.boxShadow = "none";
            }}
          />
        </div>

        <div className="flex items-center gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
            <input
              type="checkbox"
              checked={includeOccasional}
              onChange={(e) => setIncludeOccasional(e.target.checked)}
              style={{ accentColor: "var(--primary)" }}
            />
            Incluir ocasionales
          </label>

          <label className="flex items-center gap-2 text-sm" style={{ color: "var(--text)" }}>
            <input
              type="checkbox"
              checked={includeNoise}
              onChange={(e) => setIncludeNoise(e.target.checked)}
              style={{ accentColor: "var(--primary)" }}
            />
            Incluir eventuales
          </label>
        </div>

        <button
          onClick={load}
          disabled={loading}
          style={{
            ...ui.btn,
            opacity: loading ? 0.6 : 1,
            cursor: loading ? "not-allowed" : "pointer",
          }}
          className="ml-auto"
          onMouseDown={(e) => {
            if (!loading) e.currentTarget.style.transform = "scale(0.98)";
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.filter = "brightness(1.05)";
          }}
          onBlur={(e) => {
            e.currentTarget.style.filter = "none";
            e.currentTarget.style.transform = "scale(1)";
          }}
        >
          {loading ? "Calculando..." : "Recalcular"}
        </button>
      </div>

      <details
        style={ui.detailsBox}
        className="px-3 py-2"
      >
        <summary className="cursor-pointer text-sm" style={{ color: "var(--text)", fontWeight: 700 }}>
          Ajustes avanzados
        </summary>

        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <label style={ui.label}>Min intervalo (días)</label>
            <input
              type="number"
              min={1}
              value={minIntervalDays}
              onChange={(e) => setMinIntervalDays(Number(e.target.value))}
              style={ui.control}
              className="w-28 mt-1"
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid var(--control-border-focus)";
                e.currentTarget.style.boxShadow = "var(--control-focus-shadow)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid var(--control-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label style={ui.label}>Max intervalo (días)</label>
            <input
              type="number"
              min={1}
              value={maxIntervalDays}
              onChange={(e) => setMaxIntervalDays(Number(e.target.value))}
              style={ui.control}
              className="w-28 mt-1"
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid var(--control-border-focus)";
                e.currentTarget.style.boxShadow = "var(--control-focus-shadow)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid var(--control-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          <div>
            <label style={ui.label}>Coef. variación máx</label>
            <input
              type="number"
              step="0.05"
              min={0.05}
              max={2}
              value={maxCoefVariation}
              onChange={(e) => setMaxCoefVariation(Number(e.target.value))}
              style={ui.control}
              className="w-28 mt-1"
              onFocus={(e) => {
                e.currentTarget.style.border = "1px solid var(--control-border-focus)";
                e.currentTarget.style.boxShadow = "var(--control-focus-shadow)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.border = "1px solid var(--control-border)";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>
        </div>
      </details>

      {/* ===== Banner ===== */}
      <div style={bannerStyle}>
        <p
          className="font-semibold flex items-center gap-2 text-base"
          style={{ color: isOverExpected ? "var(--danger)" : "var(--success)" }}
        >
          {isOverExpected
            ? "🔥 Estás gastando por encima de lo esperado según tus patrones."
            : "🟢 Vas por debajo de lo esperado según tus patrones."}
        </p>

        <div className="mt-1 text-sm" style={{ color: "var(--text)" }}>
          <p style={{ margin: 0 }}>
            Diferencia vs esperado a la fecha:{" "}
            <strong>{formatCurrencyDOP(variance_to_expected)}</strong>
          </p>
          <p style={{ margin: 0 }}>
            Diferencia proyectada vs esperado del mes:{" "}
            <strong>{formatCurrencyDOP(variance_to_expected_end)}</strong>
          </p>
        </div>
      </div>

      {/* ===== Resumen ===== */}
      <div className="text-sm space-y-1 leading-relaxed" style={{ color: "var(--text)" }}>
        <p>
          <span style={{ color: "var(--muted)" }}>Mes:</span> <strong>{month}</strong>{" "}
          <span style={{ color: "var(--muted)" }}>— Hoy:</span> <strong>{today}</strong>{" "}
          <span style={{ color: "var(--muted)" }}>
            (día {day_of_month} de {days_in_month})
          </span>
        </p>

        <p>
          <span style={{ color: "var(--muted)" }}>Esperado mes (por patrones):</span>{" "}
          <strong>{formatCurrencyDOP(expected_total)}</strong>
        </p>

        <p>
          <span style={{ color: "var(--muted)" }}>Esperado acumulado:</span>{" "}
          <strong>{formatCurrencyDOP(expected_to_date)}</strong>{" "}
          <span style={{ color: "var(--muted)" }}>| Real acumulado:</span>{" "}
          <strong>{formatCurrencyDOP(actual_to_date)}</strong>
        </p>

        <p>
          <span style={{ color: "var(--muted)" }}>Proyección real al cierre del mes:</span>{" "}
          <strong>{formatCurrencyDOP(projected_end_of_month)}</strong>
        </p>
      </div>

      {/* ===== Chart ===== */}
      <div style={{ width: "100%", height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={chartData}>
            <XAxis
              dataKey="day"
              tick={ui.tick}
              axisLine={ui.axisLine}
              tickLine={ui.axisLine}
            />
            <YAxis
              tick={ui.tick}
              axisLine={ui.axisLine}
              tickLine={ui.axisLine}
            />

            <Tooltip content={<AdvancedBurnRateTooltip />} cursor={ui.cursor} />

            <Legend
              wrapperStyle={ui.legend}
              payload={[
                {
                  id: "Expected",
                  value: "Esperado",
                  type: "line",
                  color: expectedLineColor,
                },
                {
                  id: "Real",
                  value: "Real",
                  type: "line",
                  color: realLineColor,
                },
              ]}
            />

            <Area
              type="monotone"
              dataKey="RealArea"
              stroke="none"
              fill={realLineColor}
              fillOpacity={0.08}
              isAnimationActive={false}
            />

            <Line
              type="monotone"
              dataKey="Expected"
              stroke={expectedLineColor}
              strokeDasharray="5 5"
              strokeWidth={2}
              dot={false}
            />

            <Line
              type="monotone"
              dataKey="Real"
              stroke={realLineColor}
              strokeWidth={3}
              dot={(props) => {
                const { cx, cy, payload } = props;
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
              }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-sm leading-relaxed" style={{ color: "var(--text)" }}>
        La línea <strong>Esperado</strong> se construye con tu{" "}
        <strong>histórico usado</strong> (arriba). La línea <strong>Real</strong>{" "}
        es tu gasto acumulado día a día.
      </p>
    </div>
  );
}
