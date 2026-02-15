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
  ReferenceLine,
} from "recharts";

function ProjectedVsActualExpenseByCategoryChart({ token }) {
  const [data, setData] = useState([]);
  const [meta, setMeta] = useState(null);
  const api = import.meta.env.VITE_API_URL;

  // ===== Tokenized UI =====
  const ui = useMemo(() => {
    const axis = "color-mix(in srgb, var(--muted) 80%, transparent)";
    const grid = "color-mix(in srgb, var(--border-rgba) 65%, transparent)";
    const panelBg =
      "linear-gradient(135deg, var(--bg-3), color-mix(in srgb, var(--panel) 78%, transparent), var(--bg-2))";

    return {
      // semantic colors
      projected: "var(--primary)", // Proyectado
      actual: "var(--danger)", // Real gastado

      text: "var(--text)",
      muted: "var(--muted)",
      heading: "var(--heading)",
      border: "var(--border-rgba)",
      axis,
      grid,

      card: {
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-rgba)",
        background: panelBg,
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
        color: "var(--text)",
      },

      tooltip: {
        backgroundColor: "var(--bg-3)",
        border: "1px solid var(--border-rgba)",
        color: "var(--text)",
        borderRadius: "12px",
        boxShadow: "0 18px 45px rgba(0,0,0,0.85)",
        padding: "10px 12px",
      },

      refLine: "color-mix(in srgb, var(--muted) 55%, transparent)",
      cursorFill: "color-mix(in srgb, var(--muted) 10%, transparent)",
    };
  }, []);

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/projected-vs-actual-expense-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setData(Array.isArray(res.data?.data) ? res.data.data : []);
        setMeta(res.data?.meta ?? null);
      })
      .catch((err) =>
        console.error("Error cargando proyección vs realidad:", err)
      );
  }, [token, api]);

  const formatCurrency = (v) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(Number.isFinite(+v) ? +v : 0);

  const formatCompact = (v) =>
    new Intl.NumberFormat("es-DO", { notation: "compact" }).format(
      Number.isFinite(+v) ? +v : 0
    );

  const toNum = (x) => (Number.isFinite(+x) ? +x : 0);

  // Datos saneados + label + ordenados para lectura (ranking)
  const chartData = useMemo(() => {
    const rows = (Array.isArray(data) ? data : []).map((row) => {
      const projected = toNum(row.projected_monthly);
      const actual = toNum(row.actual_month_to_date);

      return {
        ...row,
        projected_monthly: projected,
        actual_month_to_date: actual,
        label: `${row.category ?? "Sin categoría"} (${row.stability_type ?? "n/a"})`,
        sortKey: Math.max(projected, actual),
      };
    });

    rows.sort((a, b) => b.sortKey - a.sortKey);
    return rows;
  }, [data]);

  // Layout vertical => ancho de YAxis dinámico para labels largos
  const yAxisWidth = useMemo(() => {
    const maxLen = chartData.reduce(
      (acc, r) => Math.max(acc, (r.label || "").length),
      0
    );
    // Aproximación: 7px por carácter, clamp 140..320
    return Math.max(140, Math.min(320, Math.round(maxLen * 7)));
  }, [chartData]);

  // Altura dinámica
  const chartHeight = useMemo(() => {
    const n = chartData.length;
    const base = 220;
    const perRow = 26;
    return Math.max(320, Math.min(920, base + n * perRow));
  }, [chartData]);

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      <div>
        <h3 className="text-xl font-semibold" style={{ color: ui.heading }}>
          Proyección vs realidad por categoría
        </h3>
        <p className="text-sm mt-1" style={{ color: ui.muted }}>
          Compara lo proyectado (mediana histórica) con el gasto real del mes{" "}
          <span style={{ color: ui.text, fontWeight: 600 }}>
            {meta?.month || ""}
          </span>
          .
        </p>
      </div>

      {chartData.length === 0 ? (
        <p className="text-sm italic" style={{ color: ui.muted }}>
          No hay datos suficientes para este análisis.
        </p>
      ) : (
        <div className="w-full" style={{ height: chartHeight }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 24, bottom: 10, left: 10 }}
              barCategoryGap={8}
            >
              <CartesianGrid stroke={ui.grid} strokeDasharray="4 4" />

              {/* X = monto */}
              <XAxis
                type="number"
                stroke={ui.axis}
                tick={{ fill: ui.text, fontSize: 12 }}
                tickFormatter={formatCompact}
              />

              {/* Y = categorías */}
              <YAxis
                type="category"
                dataKey="label"
                width={yAxisWidth}
                stroke={ui.axis}
                tick={{ fill: ui.text, fontSize: 12 }}
              />

              <ReferenceLine x={0} stroke={ui.refLine} strokeWidth={1} />

              <Tooltip
                cursor={{ fill: ui.cursorFill }}
                contentStyle={ui.tooltip}
                formatter={(value, _name, item) => {
                  const key = item?.dataKey;
                  if (key === "projected_monthly")
                    return [formatCurrency(value), "Proyectado del mes"];
                  if (key === "actual_month_to_date")
                    return [formatCurrency(value), "Real gastado"];
                  return [formatCurrency(value), _name];
                }}
              />

              <Legend
                wrapperStyle={{ color: ui.text }}
                formatter={(val) => (
                  <span style={{ color: ui.text, fontSize: 13 }}>{val}</span>
                )}
              />

              {/* ✅ Token colors */}
              <Bar
                dataKey="projected_monthly"
                name="Proyectado del mes"
                fill={ui.projected}
                radius={[8, 8, 8, 8]}
              />
              <Bar
                dataKey="actual_month_to_date"
                name="Real gastado"
                fill={ui.actual}
                radius={[8, 8, 8, 8]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="text-xs leading-relaxed" style={{ color: ui.muted }}>
        Tip: Si el <span style={{ color: ui.text }}>Real (MTD)</span> va por encima
        del <span style={{ color: ui.text }}>Proyectado</span> temprano en el mes,
        puede ser señal de gasto acelerado (no necesariamente “fuera de control”
        si tus gastos son front-loaded).
      </div>
    </div>
  );
}

export default ProjectedVsActualExpenseByCategoryChart;
