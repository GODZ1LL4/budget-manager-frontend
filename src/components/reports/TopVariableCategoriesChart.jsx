// src/components/reports/TopVariableCategoriesChart.jsx
import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";

const safeNum = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const formatMoney = (v) => {
  const num = safeNum(v);
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    minimumFractionDigits: 2,
  }).format(num);
};

const STABILITIES = ["fixed", "variable", "occasional"];

// Fechas por defecto
const today = new Date();
const year = today.getFullYear();
const defaultDateFrom = `${year}-01-01`;
const defaultDateTo = today.toISOString().split("T")[0];

function TopVariableCategoriesChart({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [data, setData] = useState([]);

  const [selectedStabilities, setSelectedStabilities] = useState(["variable"]);
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [limit, setLimit] = useState(10);

  const ui = useMemo(() => {
    const border = "var(--border-rgba)";
    const panel = "var(--panel)";
    const panel2 = "var(--panel-2)";
    const bg2 = "var(--bg-2)";
    const bg3 = "var(--bg-3)";

    return {
      text: "var(--text)",
      muted: "var(--muted)",
      ring: "var(--ring)",
      border,

      // semantic
      primary: "var(--primary)",
      success: "var(--success)",
      warning: "var(--warning)",
      danger: "var(--danger)",

      card: {
        borderRadius: "var(--radius-lg)",
        border: `1px solid ${border}`,
        background: `linear-gradient(135deg, ${bg3}, color-mix(in srgb, ${panel} 78%, transparent), ${bg2})`,
        boxShadow: "0 16px 40px rgba(0,0,0,0.85)",
      },

      control: {
        background: "var(--control-bg)",
        color: "var(--control-text)",
        border: `1px solid ${border}`,
        borderRadius: "var(--radius-md)",
      },

      tooltip: {
        backgroundColor: "var(--tooltip-bg, #020617)",
        border: `1px solid ${border}`,
        color: "var(--tooltip-text, #e5e7eb)",
        borderRadius: "0.5rem",
        boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
      },

      gridStroke: "color-mix(in srgb, var(--muted) 22%, transparent)",
      axisStroke: "color-mix(in srgb, var(--muted) 55%, transparent)",
      tickFill: "color-mix(in srgb, var(--text) 85%, transparent)",

      rowHintBg: `color-mix(in srgb, ${panel2} 55%, transparent)`,
    };
  }, []);

  // Tick personalizado del eje Y (categorías)
  const CategoryTick = ({ x, y, payload }) => (
    <text x={x} y={y} dy={4} textAnchor="end" fontSize={13} fill={ui.tickFill}>
      {payload?.value}
    </text>
  );

  // Label custom al final de la barra
  const CustomRightLabel = (props) => {
    const { x, y, width, value } = props;
    if (value == null) return null;

    const textX = x + width + 8;
    const textY = y + 10;

    return (
      <text
        x={textX}
        y={textY}
        fill={ui.tickFill}
        fontSize={13}
        fontWeight={600}
        textAnchor="start"
        dominantBaseline="middle"
      >
        {formatMoney(value)}
      </text>
    );
  };

  const toggleStability = (stability) => {
    setSelectedStabilities((prev) => {
      if (prev.includes(stability)) return prev.filter((s) => s !== stability);
      return [...prev, stability];
    });
  };

  const titleStabilityPart =
    selectedStabilities.length === 0
      ? "categorías"
      : `categorías (${selectedStabilities.join(", ")})`;

  // Ancho dinámico para labels del eje Y
  const labelWidth = useMemo(() => {
    if (!data?.length) return 80;
    const longest = Math.max(
      ...data.map((d) => (d.category ? String(d.category).length : 0))
    );
    return Math.min(240, Math.max(90, Math.round(longest * 6.4)));
  }, [data]);

  // Altura dinámica según cantidad de categorías
  const chartHeight = useMemo(() => {
    const perBar = 26;
    const base = 90;
    const count = data?.length || 1;
    return Math.max(260, base + count * perBar);
  }, [data]);

  const loadData = async () => {
    if (!token) return;

    const params = new URLSearchParams();

    if (selectedStabilities.length > 0) {
      params.set("stability_types", selectedStabilities.join(","));
    }

    params.set("date_from", dateFrom);
    params.set("date_to", dateTo);
    params.set("limit", String(limit));

    try {
      const res = await axios.get(
        `${api}/analytics/top-variable-categories?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setData(res?.data?.data || []);
    } catch (err) {
      console.error("Error al cargar categorías top:", err);
      setData([]);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, api, selectedStabilities, dateFrom, dateTo, limit]);

  return (
    <div className="rounded-2xl p-6 space-y-4" style={ui.card}>
      <div>
        <h3 className="text-lg font-semibold mb-1" style={{ color: ui.text }}>
          Top {limit} {titleStabilityPart} con más gasto
        </h3>
        <p className="text-sm" style={{ color: ui.muted }}>
          Filtra por tipo de estabilidad, rango de fechas y cantidad de
          resultados para ver en qué categorías estás gastando más.
        </p>
      </div>

      {/* Filtros */}
      <div
        className="flex flex-wrap items-center gap-3 text-sm"
        style={{ color: ui.text }}
      >
        {/* Estabilidad */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium" style={{ color: ui.muted }}>
            Estabilidad:
          </span>

          {STABILITIES.map((st) => {
            const checked = selectedStabilities.includes(st);

            return (
              <label
                key={st}
                className="flex items-center gap-2 text-xs sm:text-sm"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleStability(st)}
                  style={{
                    accentColor: "var(--ring)",
                  }}
                />
                <span
                  className="capitalize"
                  style={{ color: checked ? ui.text : ui.muted }}
                >
                  {st}
                </span>
              </label>
            );
          })}
        </div>

        {/* Rango de fechas */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium" style={{ color: ui.muted }}>
            Rango:
          </span>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="px-3 py-2 text-sm outline-none"
            style={ui.control}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "var(--glow-shadow)";
              e.currentTarget.style.borderColor =
                "color-mix(in srgb, var(--ring) 55%, var(--border-rgba))";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--border-rgba)";
            }}
          />

          <span style={{ color: ui.muted }}>—</span>

          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="px-3 py-2 text-sm outline-none"
            style={ui.control}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "var(--glow-shadow)";
              e.currentTarget.style.borderColor =
                "color-mix(in srgb, var(--ring) 55%, var(--border-rgba))";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--border-rgba)";
            }}
          />
        </div>

        {/* Límite */}
        <div className="flex items-center gap-2">
          <span className="font-medium" style={{ color: ui.muted }}>
            Top:
          </span>

          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 10)}
            className="w-20 px-3 py-2 text-sm outline-none"
            style={ui.control}
            onFocus={(e) => {
              e.currentTarget.style.boxShadow = "var(--glow-shadow)";
              e.currentTarget.style.borderColor =
                "color-mix(in srgb, var(--ring) 55%, var(--border-rgba))";
            }}
            onBlur={(e) => {
              e.currentTarget.style.boxShadow = "none";
              e.currentTarget.style.borderColor = "var(--border-rgba)";
            }}
          />
        </div>
      </div>

      {/* Gráfico */}
      {data.length === 0 ? (
        <p className="text-sm italic" style={{ color: ui.muted }}>
          No hay datos para los filtros seleccionados.
        </p>
      ) : (
        <>
          {/* SOLO el chart dentro del alto fijo */}
          <div className="w-full" style={{ height: chartHeight }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data}
                layout="vertical"
                margin={{ top: 16, right: 44, bottom: 16, left: 8 }}
              >
                <CartesianGrid stroke={ui.gridStroke} strokeDasharray="4 4" />
                <XAxis
                  type="number"
                  domain={[0, (max) => max * 1.1]}
                  stroke={ui.axisStroke}
                  tick={{ fill: ui.tickFill, fontSize: 14 }}
                  tickFormatter={(v) => formatMoney(v)}
                />
                <YAxis
                  type="category"
                  dataKey="category"
                  width={labelWidth}
                  tick={<CategoryTick />}
                  stroke={ui.axisStroke}
                />
                <Tooltip
                  formatter={(val) => formatMoney(val)}
                  labelFormatter={(name) => name}
                  contentStyle={{ ...ui.tooltip, fontSize: "0.85rem" }}
                  itemStyle={{ color: ui.text }}
                  labelStyle={{ color: ui.text, fontWeight: 700 }}
                />
                <Bar dataKey="total" fill={ui.warning} radius={[6, 6, 6, 6]}>
                  <LabelList dataKey="total" content={<CustomRightLabel />} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tip FUERA del alto fijo */}
          <div
            className="mt-3 rounded-xl px-3 py-2 text-xs"
            style={{
              border: `1px solid ${ui.border}`,
              background: ui.rowHintBg,
              color: ui.muted,
            }}
          >
            Tip: prueba activar{" "}
            <span style={{ color: ui.text, fontWeight: 600 }}>fixed</span> o{" "}
            <span style={{ color: ui.text, fontWeight: 600 }}>occasional</span>{" "}
            para comparar “gastos imprescindibles” vs “variables”.
          </div>
        </>
      )}
    </div>
  );
}

export default TopVariableCategoriesChart;
