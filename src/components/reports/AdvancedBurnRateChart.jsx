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
          {entry.dataKey === "Expected" ? "Esperado" : "Real"}:{" "}
          {formatCurrencyDOP(entry.value)}
        </p>
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
      <p className="text-sm text-slate-300">Cargando burn rate avanzado...</p>
    );
  }

  if (errMsg) {
    return (
      <div className="text-sm text-red-300 border border-red-800 rounded-lg p-3">
        {errMsg}
      </div>
    );
  }

  if (!data || !data.series || !data.series.length) {
    return (
      <p className="text-sm text-slate-300">
        No hay datos suficientes para calcular el burn rate avanzado este mes.
      </p>
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

  // ✅ Lo que querías: histórico usado para aprender patrones
  const historyFrom = meta?.history_from || "—";
  const historyTo = meta?.history_to || "—";

  // (Opcional) Mes analizado, por si lo quieres mostrar pequeño
  // const analyzedFrom = meta?.date_from || "—";
  // const analyzedTo = meta?.date_to || "—";

  const lastPoint =
    chartData[day_of_month - 1] || chartData[chartData.length - 1];

  const isOverExpected =
    (lastPoint?.Real || 0) > (lastPoint?.Expected || 0);

  const realLineColor = isOverExpected ? "#e63946" : "#16a34a";

  return (
    <div className="space-y-4">
      {/* ===== Header + histórico usado ===== */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">
            Burn Rate Avanzado (por patrones)
          </h3>

          <p className="text-sm text-slate-400">
            Histórico usado: <strong>{historyFrom}</strong> →{" "}
            <strong>{historyTo}</strong>
          </p>

          {/* Si luego quieres mostrar el mes analizado también, descomenta:
          <p className="text-xs text-slate-500 mt-0.5">
            Mes analizado: <strong>{analyzedFrom}</strong> →{" "}
            <strong>{analyzedTo}</strong>
          </p>
          */}
        </div>
      </div>

      {/* ===== Controls ===== */}
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Historial (meses)
          </label>
          <input
            type="number"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="input w-24"
          />
        </div>

        <div>
          <label className="text-xs text-slate-400 mb-1 block">
            Min. ocurrencias
          </label>
          <input
            type="number"
            min={2}
            value={minOccurrences}
            onChange={(e) => setMinOccurrences(Number(e.target.value))}
            className="input w-24"
          />
        </div>

        <div className="flex items-center gap-4 pb-1">
          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={includeOccasional}
              onChange={(e) => setIncludeOccasional(e.target.checked)}
            />
            Incluir ocasionales
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={includeNoise}
              onChange={(e) => setIncludeNoise(e.target.checked)}
            />
            Incluir eventuales
          </label>
        </div>

        <button
          onClick={load}
          disabled={loading}
          className="
            ml-auto px-4 py-2 rounded-lg
            bg-amber-500 hover:bg-amber-400
            text-slate-900 font-semibold
            disabled:opacity-50
          "
        >
          {loading ? "Calculando..." : "Recalcular"}
        </button>
      </div>

      <details>
        <summary className="cursor-pointer text-sm text-slate-300">
          Ajustes avanzados
        </summary>

        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Min intervalo (días)
            </label>
            <input
              type="number"
              min={1}
              value={minIntervalDays}
              onChange={(e) => setMinIntervalDays(Number(e.target.value))}
              className="input w-28"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Max intervalo (días)
            </label>
            <input
              type="number"
              min={1}
              value={maxIntervalDays}
              onChange={(e) => setMaxIntervalDays(Number(e.target.value))}
              className="input w-28"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 mb-1 block">
              Coef. variación máx
            </label>
            <input
              type="number"
              step="0.05"
              min={0.05}
              max={2}
              value={maxCoefVariation}
              onChange={(e) => setMaxCoefVariation(Number(e.target.value))}
              className="input w-28"
            />
          </div>
        </div>
      </details>

      {/* ===== Banner ===== */}
      <div
        className={`text-sm rounded border px-4 py-3 ${
          (chartData[day_of_month - 1]?.Real || 0) >
          (chartData[day_of_month - 1]?.Expected || 0)
            ? "bg-red-900/40 text-red-200 border-red-500/60"
            : "bg-emerald-900/40 text-emerald-200 border-emerald-500/60"
        }`}
      >
        <p className="font-semibold flex items-center gap-1 text-base">
          {isOverExpected
            ? "🔥 Estás gastando por encima de lo esperado según tus patrones."
            : "🟢 Vas por debajo de lo esperado según tus patrones."}
        </p>
        <p>
          Diferencia vs esperado a la fecha:{" "}
          <strong>{formatCurrencyDOP(variance_to_expected)}</strong>
        </p>
        <p>
          Diferencia proyectada vs esperado del mes:{" "}
          <strong>{formatCurrencyDOP(variance_to_expected_end)}</strong>
        </p>
      </div>

      {/* ===== Resumen ===== */}
      <div className="text-sm text-slate-200 space-y-1 leading-relaxed">
        <p>
          Mes: <strong>{month}</strong> — Hoy: <strong>{today}</strong> (día{" "}
          {day_of_month} de {days_in_month})
        </p>
        <p>
          Esperado mes (por patrones):{" "}
          <strong>{formatCurrencyDOP(expected_total)}</strong>
        </p>
        <p>
          Esperado acumulado:{" "}
          <strong>{formatCurrencyDOP(expected_to_date)}</strong> | Real
          acumulado: <strong>{formatCurrencyDOP(actual_to_date)}</strong>
        </p>
        <p>
          Proyección real al cierre del mes:{" "}
          <strong>{formatCurrencyDOP(projected_end_of_month)}</strong>
        </p>
      </div>

      {/* ===== Chart ===== */}
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
              content={<AdvancedBurnRateTooltip />}
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
                  id: "Expected",
                  value: "Esperado",
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
              stroke="#8884d8"
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
                    stroke="#ffffff"
                    strokeWidth={2}
                  />
                );
              }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-base text-slate-200 leading-relaxed">
        La línea <strong>Esperado</strong> se construye con tu{" "}
        <strong>histórico usado</strong> (arriba). La línea <strong>Real</strong>{" "}
        es tu gasto acumulado día a día.
      </p>
    </div>
  );
}
