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
import Modal from "../Modal";
import { withUserTimeZone } from "../../lib/dates/localDate";

const STORAGE_KEY = "report:advanced-burn-rate:params";

const DEFAULT_PARAMS = {
  months: 6,
  minOccurrences: 3,
  includeOccasional: false,
  includeNoise: true,
  minIntervalDays: 3,
  maxIntervalDays: 70,
  maxCoefVariation: 0.6,
};

function parseDraftNumber(value) {
  const normalized = String(value ?? "").trim().replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function clampDraftNumber(value, min, max, fallback) {
  const number = parseDraftNumber(value);
  if (number == null) return fallback;
  return Math.max(min, Math.min(max, number));
}

function sanitizeParams(raw) {
  const minIntervalDays = clampDraftNumber(
    raw?.minIntervalDays,
    1,
    365,
    DEFAULT_PARAMS.minIntervalDays
  );

  return {
    months: clampDraftNumber(raw?.months, 1, 36, DEFAULT_PARAMS.months),
    minOccurrences: clampDraftNumber(
      raw?.minOccurrences,
      2,
      50,
      DEFAULT_PARAMS.minOccurrences
    ),
    includeOccasional:
      typeof raw?.includeOccasional === "boolean"
        ? raw.includeOccasional
        : DEFAULT_PARAMS.includeOccasional,
    includeNoise:
      typeof raw?.includeNoise === "boolean"
        ? raw.includeNoise
        : DEFAULT_PARAMS.includeNoise,
    minIntervalDays,
    maxIntervalDays: clampDraftNumber(
      raw?.maxIntervalDays,
      minIntervalDays,
      3650,
      Math.max(DEFAULT_PARAMS.maxIntervalDays, minIntervalDays)
    ),
    maxCoefVariation: clampDraftNumber(
      raw?.maxCoefVariation,
      0.05,
      2,
      DEFAULT_PARAMS.maxCoefVariation
    ),
  };
}

function getInitialParams() {
  if (typeof window === "undefined") return DEFAULT_PARAMS;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_PARAMS;
    return sanitizeParams(JSON.parse(saved));
  } catch {
    return DEFAULT_PARAMS;
  }
}

function formatCurrencyDOP(value) {
  const num = Number(value) || 0;
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
}

function formatPercent(value) {
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${Number(value).toFixed(2)}%`;
}

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
      <p style={{ marginBottom: 6, fontWeight: 800 }}>Día {label}</p>

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
          <span style={{ fontWeight: 800 }}>
            {formatCurrencyDOP(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AdvancedBurnRateChart({ token }) {
  const api = import.meta.env.VITE_API_URL;
  const initialParams = getInitialParams();

  const [months, setMonths] = useState(String(initialParams.months));
  const [minOccurrences, setMinOccurrences] = useState(
    String(initialParams.minOccurrences)
  );
  const [includeOccasional, setIncludeOccasional] = useState(
    initialParams.includeOccasional
  );
  const [includeNoise, setIncludeNoise] = useState(initialParams.includeNoise);
  const [minIntervalDays, setMinIntervalDays] = useState(
    String(initialParams.minIntervalDays)
  );
  const [maxIntervalDays, setMaxIntervalDays] = useState(
    String(initialParams.maxIntervalDays)
  );
  const [maxCoefVariation, setMaxCoefVariation] = useState(
    String(initialParams.maxCoefVariation)
  );

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errMsg, setErrMsg] = useState("");
  const [detailOpen, setDetailOpen] = useState(false);

  const didInitialLoad = useRef(false);

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
      cursor: {
        stroke: "var(--muted)",
        strokeWidth: 1,
        strokeDasharray: "3 3",
      },
      legend: { fontSize: "0.95rem", color: "var(--text)" },
      btn: {
        backgroundColor: "var(--btn-primary-bg)",
        color: "var(--btn-primary-text)",
        border: "1px solid color-mix(in srgb, var(--btn-primary-bg) 60%, var(--border-rgba))",
        borderRadius: "var(--btn-radius)",
        padding: "10px 14px",
        fontWeight: 800,
        boxShadow:
          "0 0 var(--btn-glow-blur) 0 color-mix(in srgb, var(--glow-color) 40%, transparent)",
        transition: "filter 150ms ease, transform 120ms ease, opacity 150ms ease",
      },
      detailsBox: {
        border: "1px solid var(--border-rgba)",
        backgroundColor: "color-mix(in srgb, var(--panel) 55%, transparent)",
        borderRadius: "var(--radius-md)",
      },
      tableCell: {
        padding: "12px 10px",
        borderTop: "1px solid var(--border-rgba)",
        verticalAlign: "top",
      },
    };
  }, []);

  const load = async () => {
    if (!token) return;

    setLoading(true);
    setErrMsg("");

    try {
      const params = sanitizeParams({
        months,
        minOccurrences,
        includeOccasional,
        includeNoise,
        minIntervalDays,
        maxIntervalDays,
        maxCoefVariation,
      });

      const res = await axios.get(
        `${api}/analytics/advanced-burn-rate-current-month`,
        withUserTimeZone({
          headers: { Authorization: `Bearer ${token}` },
          params: {
            months: params.months,
            min_occurrences: params.minOccurrences,
            include_occasional: params.includeOccasional,
            include_noise: params.includeNoise,
            min_interval_days: params.minIntervalDays,
            max_interval_days: params.maxIntervalDays,
            max_coef_variation: params.maxCoefVariation,
          },
        })
      );

      setData(res.data?.data || null);
    } catch (e) {
      console.error("Advanced burn rate error:", e);
      setData(null);
      setErrMsg(
        e.response?.data?.error || "No se pudo calcular el burn rate."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token || didInitialLoad.current) return;
    didInitialLoad.current = true;
    load();
  }, [token]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const paramsToSave = sanitizeParams({
      months,
      minOccurrences,
      includeOccasional,
      includeNoise,
      minIntervalDays,
      maxIntervalDays,
      maxCoefVariation,
    });

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(paramsToSave));
    } catch (e) {
      console.error("No se pudieron guardar los parámetros del reporte:", e);
    }
  }, [
    months,
    minOccurrences,
    includeOccasional,
    includeNoise,
    minIntervalDays,
    maxIntervalDays,
    maxCoefVariation,
  ]);

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

  const categoryBreakdown = useMemo(() => {
    return (data?.category_breakdown || []).filter(
      (row) =>
        Number(row.expected_to_date || 0) > 0 ||
        Number(row.actual_to_date || 0) > 0 ||
        Number(row.forecast_end_of_month || 0) > 0
    );
  }, [data]);

  const categoryTotals = data?.category_totals || null;

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
          border: "1px solid color-mix(in srgb, var(--danger) 55%, var(--border-rgba))",
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
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 style={{ color: "var(--heading)", fontWeight: 800, fontSize: 18 }}>
            Burn Rate Avanzado (por patrones)
          </h3>

          <p className="mt-1" style={{ color: "var(--muted)", fontSize: 13 }}>
            Histórico usado:{" "}
            <strong style={{ color: "var(--text)" }}>{historyFrom}</strong> →{" "}
            <strong style={{ color: "var(--text)" }}>{historyTo}</strong>
          </p>
        </div>

        
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label style={ui.label}>Historial (meses)</label>
          <input
            type="text"
            inputMode="numeric"
            min={1}
            max={36}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
            style={ui.control}
            className="w-24 mt-1"
          />
        </div>

        <div>
          <label style={ui.label}>Min. ocurrencias</label>
          <input
            type="text"
            inputMode="numeric"
            min={2}
            value={minOccurrences}
            onChange={(e) => setMinOccurrences(e.target.value)}
            style={ui.control}
            className="w-24 mt-1"
          />
        </div>

        <div className="flex items-center gap-4 pb-1">
          <label
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--text)" }}
          >
            <input
              type="checkbox"
              checked={includeOccasional}
              onChange={(e) => setIncludeOccasional(e.target.checked)}
              style={{ accentColor: "var(--primary)" }}
            />
            Incluir ocasionales
          </label>

          <label
            className="flex items-center gap-2 text-sm"
            style={{ color: "var(--text)" }}
          >
            <input
              type="checkbox"
              checked={includeNoise}
              onChange={(e) => setIncludeNoise(e.target.checked)}
              style={{ accentColor: "var(--primary)" }}
            />
            Incluir eventuales
          </label>
        </div>

                <div className="ml-auto flex items-center gap-2">
          

          <button
            onClick={load}
            disabled={loading}
            style={{
              ...ui.btn,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Calculando..." : "Recalcular"}
          </button>
          <button
            type="button"
            onClick={() => setDetailOpen(true)}
            style={{
              ...ui.btn,
              padding: "10px 14px",
              backgroundColor: "transparent",
              color: "var(--text)",
              border: "1px solid var(--border-rgba)",
              boxShadow: "none",
            }}
          >
            Ver detalle
          </button>
        </div>

      </div>

      <details style={ui.detailsBox} className="px-3 py-2">
        <summary
          className="cursor-pointer text-sm"
          style={{ color: "var(--text)", fontWeight: 700 }}
        >
          Ajustes avanzados
        </summary>

        <div className="mt-3 flex flex-wrap gap-4">
          <div>
            <label style={ui.label}>Min intervalo (días)</label>
            <input
              type="text"
              inputMode="numeric"
              min={1}
              value={minIntervalDays}
              onChange={(e) => setMinIntervalDays(e.target.value)}
              style={ui.control}
              className="w-28 mt-1"
            />
          </div>

          <div>
            <label style={ui.label}>Max intervalo (días)</label>
            <input
              type="text"
              inputMode="numeric"
              min={1}
              value={maxIntervalDays}
              onChange={(e) => setMaxIntervalDays(e.target.value)}
              style={ui.control}
              className="w-28 mt-1"
            />
          </div>

          <div>
            <label style={ui.label}>Coef. variación máx</label>
            <input
              type="text"
              inputMode="decimal"
              step="0.05"
              min={0.05}
              max={2}
              value={maxCoefVariation}
              onChange={(e) => setMaxCoefVariation(e.target.value)}
              style={ui.control}
              className="w-28 mt-1"
            />
          </div>
        </div>
      </details>

      <div style={bannerStyle}>
        <p
          className="font-semibold text-base"
          style={{ color: isOverExpected ? "var(--danger)" : "var(--success)" }}
        >
          {isOverExpected
            ? "Estás gastando por encima de lo esperado según tus patrones."
            : "Vas por debajo de lo esperado según tus patrones."}
        </p>

        <div className="mt-1 text-sm" style={{ color: "var(--text)" }}>
          <p style={{ margin: 0 }}>
            Diferencia vs esperado a la fecha:{" "}
            <strong>{formatCurrencyDOP(variance_to_expected)}</strong>
          </p>
          <p style={{ margin: 0 }}>
            Forecast al cierre vs esperado del mes:{" "}
            <strong>{formatCurrencyDOP(variance_to_expected_end)}</strong>
          </p>
        </div>
      </div>

      <div
        className="text-sm space-y-1 leading-relaxed"
        style={{ color: "var(--text)" }}
      >
        <p>
          <span style={{ color: "var(--muted)" }}>Mes:</span>{" "}
          <strong>{month}</strong>{" "}
          <span style={{ color: "var(--muted)" }}>| Hoy:</span>{" "}
          <strong>{today}</strong>{" "}
          <span style={{ color: "var(--muted)" }}>
            (día {day_of_month} de {days_in_month})
          </span>
        </p>

        <p>
          <span style={{ color: "var(--muted)" }}>Esperado mes:</span>{" "}
          <strong>{formatCurrencyDOP(expected_total)}</strong>
        </p>

        <p>
          <span style={{ color: "var(--muted)" }}>Esperado acumulado:</span>{" "}
          <strong>{formatCurrencyDOP(expected_to_date)}</strong>{" "}
          <span style={{ color: "var(--muted)" }}>| Real acumulado:</span>{" "}
          <strong>{formatCurrencyDOP(actual_to_date)}</strong>
        </p>

        <p>
          <span style={{ color: "var(--muted)" }}>Forecast cierre real:</span>{" "}
          <strong>{formatCurrencyDOP(projected_end_of_month)}</strong>
        </p>
      </div>

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
        La línea <strong>Esperado</strong> usa tus patrones históricos. La línea{" "}
        <strong>Real</strong> muestra tu gasto acumulado real día a día.
      </p>

      <Modal
        isOpen={detailOpen}
        onClose={() => setDetailOpen(false)}
        title="Detalle del burn rate por categoría"
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-sm" style={{ color: "var(--muted)" }}>
            El detalle compara cómo vas hoy contra lo esperado y cómo podría
            cerrar el mes usando forecast real por categoría.
          </p>

          {!categoryBreakdown.length ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>
              No hay detalle por categorías disponible.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                    <th className="py-2 pr-4">Categoría</th>
                    <th className="py-2 pr-4">Esperado hoy</th>
                    <th className="py-2 pr-4">Real hoy</th>
                    <th className="py-2 pr-4">Desv. hoy</th>
                    <th className="py-2 pr-4">% hoy</th>
                    <th className="py-2 pr-4">Esperado cierre</th>
                    <th className="py-2 pr-4">Forecast cierre</th>
                    <th className="py-2 pr-4">Desv. cierre</th>
                  </tr>
                </thead>

                <tbody>
                  {categoryBreakdown.map((row) => {
                    const isOverToday = Number(row.variance_to_date || 0) > 0;
                    const isOverEnd = Number(row.variance_to_end || 0) > 0;

                    return (
                      <tr key={row.category}>
                        <td style={ui.tableCell}>
                          <div style={{ color: "var(--text)", fontWeight: 700 }}>
                            {row.category}
                          </div>
                        </td>
                        <td style={ui.tableCell}>
                          {formatCurrencyDOP(row.expected_to_date)}
                        </td>
                        <td style={ui.tableCell}>
                          {formatCurrencyDOP(row.actual_to_date)}
                        </td>
                        <td
                          style={{
                            ...ui.tableCell,
                            color: isOverToday
                              ? "var(--danger)"
                              : "var(--success)",
                            fontWeight: 800,
                          }}
                        >
                          {Number(row.variance_to_date) > 0 ? "+" : ""}
                          {formatCurrencyDOP(row.variance_to_date)}
                        </td>
                        <td style={ui.tableCell}>
                          {formatPercent(row.variance_to_date_pct)}
                        </td>
                        <td style={ui.tableCell}>
                          {formatCurrencyDOP(row.expected_end_of_month)}
                        </td>
                        <td style={ui.tableCell}>
                          {formatCurrencyDOP(row.forecast_end_of_month)}
                        </td>
                        <td
                          style={{
                            ...ui.tableCell,
                            color: isOverEnd
                              ? "var(--danger)"
                              : "var(--success)",
                            fontWeight: 800,
                          }}
                        >
                          {Number(row.variance_to_end) > 0 ? "+" : ""}
                          {formatCurrencyDOP(row.variance_to_end)}
                        </td>
                      </tr>
                    );
                  })}

                  {categoryTotals && (
                    <tr>
                      <td
                        style={{
                          ...ui.tableCell,
                          fontWeight: 800,
                          color: "var(--heading)",
                          background:
                            "color-mix(in srgb, var(--panel) 70%, transparent)",
                        }}
                      >
                        Total
                      </td>
                      <td
                        style={{
                          ...ui.tableCell,
                          fontWeight: 800,
                          background:
                            "color-mix(in srgb, var(--panel) 70%, transparent)",
                        }}
                      >
                        {formatCurrencyDOP(categoryTotals.expected_to_date)}
                      </td>
                      <td
                        style={{
                          ...ui.tableCell,
                          fontWeight: 800,
                          background:
                            "color-mix(in srgb, var(--panel) 70%, transparent)",
                        }}
                      >
                        {formatCurrencyDOP(categoryTotals.actual_to_date)}
                      </td>
                      <td
                        style={{
                          ...ui.tableCell,
                          fontWeight: 800,
                          color:
                            Number(categoryTotals.variance_to_date) > 0
                              ? "var(--danger)"
                              : "var(--success)",
                          background:
                            "color-mix(in srgb, var(--panel) 70%, transparent)",
                        }}
                      >
                        {Number(categoryTotals.variance_to_date) > 0 ? "+" : ""}
                        {formatCurrencyDOP(categoryTotals.variance_to_date)}
                      </td>
                      <td
                        style={{
                          ...ui.tableCell,
                          fontWeight: 800,
                          background:
                            "color-mix(in srgb, var(--panel) 70%, transparent)",
                        }}
                      >
                        {formatPercent(categoryTotals.variance_to_date_pct)}
                      </td>
                      <td
                        style={{
                          ...ui.tableCell,
                          fontWeight: 800,
                          background:
                            "color-mix(in srgb, var(--panel) 70%, transparent)",
                        }}
                      >
                        {formatCurrencyDOP(categoryTotals.expected_end_of_month)}
                      </td>
                      <td
                        style={{
                          ...ui.tableCell,
                          fontWeight: 800,
                          background:
                            "color-mix(in srgb, var(--panel) 70%, transparent)",
                        }}
                      >
                        {formatCurrencyDOP(categoryTotals.forecast_end_of_month)}
                      </td>
                      <td
                        style={{
                          ...ui.tableCell,
                          fontWeight: 800,
                          color:
                            Number(categoryTotals.variance_to_end) > 0
                              ? "var(--danger)"
                              : "var(--success)",
                          background:
                            "color-mix(in srgb, var(--panel) 70%, transparent)",
                        }}
                      >
                        {Number(categoryTotals.variance_to_end) > 0 ? "+" : ""}
                        {formatCurrencyDOP(categoryTotals.variance_to_end)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setDetailOpen(false)}
              style={ui.btn}
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
