// src/components/reports/TopItemsByCategoryChart.jsx
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
import FFSelect from "../FFSelect"; // ✅ ajusta la ruta si tu estructura difiere

function TopItemsByCategoryChart({ token, categories = [] }) {
  const api = import.meta.env.VITE_API_URL;

  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [limit, setLimit] = useState(10);
  const [data, setData] = useState([]);

  // --- Helpers para leer tokens CSS (sin hardcode de colores) ---
  const cssVar = (name, fallback = "") => {
    if (typeof window === "undefined") return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name);
    return (v || fallback).trim();
  };

  const tokens = useMemo(() => {
    const text = cssVar("--text", "#e5e7eb");
    const muted = cssVar("--muted", "#94a3b8");
    const border = cssVar("--border-rgba", "rgba(148,163,184,0.25)");
    const panel = cssVar("--panel", "rgba(2,6,23,0.8)");
    const primary = cssVar("--primary", "#6366f1");

    const grid = `color-mix(in srgb, ${border} 85%, transparent)`;
    const tooltipBg = `color-mix(in srgb, ${panel} 92%, transparent)`;
    const tooltipBorder = `color-mix(in srgb, ${border} 90%, transparent)`;
    const tooltipShadow = `0 18px 45px color-mix(in srgb, #000 85%, transparent)`;

    return { text, muted, primary, grid, tooltipBg, tooltipBorder, tooltipShadow };
  }, []);

  // Solo categorías de gasto
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.type === "expense"),
    [categories]
  );

  // Seleccionar categoría por defecto (primera de gasto)
  useEffect(() => {
    if (expenseCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(expenseCategories[0].id);
    }
  }, [expenseCategories, selectedCategoryId]);

  // Cargar datos cuando cambie categoría, año o límite
  useEffect(() => {
    if (!token || !selectedCategoryId) return;

    axios
      .get(`${api}/analytics/top-items-by-category`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { category_id: selectedCategoryId, year, limit },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar top ítems por categoría:", err);
      });
  }, [token, selectedCategoryId, year, limit, api]);

  const selectedCategoryName =
    expenseCategories.find((c) => String(c.id) === String(selectedCategoryId))
      ?.name || "—";

  const formatMoney = (v, decimals = 2) => {
    const num = typeof v === "number" ? v : Number(v ?? 0);
    if (Number.isNaN(num)) return "RD$ 0.00";
    return `RD$ ${num.toFixed(decimals)}`;
  };

  const getLabelWidth = () => {
    if (!data || data.length === 0) return 80;
    const longest = Math.max(...data.map((d) => (d.item ? d.item.length : 0)));
    return Math.min(220, Math.max(80, longest * 7));
  };

  const getChartHeight = () => {
    const perBar = 28;
    const base = 80;
    const count = data?.length || 1;
    return Math.max(260, base + count * perBar);
  };

  const labelWidth = getLabelWidth();

  const CategoryTick = ({ x, y, payload }) => (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={13}
      fill={tokens.text}
    >
      {payload.value}
    </text>
  );

  const CustomRightLabel = ({ x, y, width, value }) => {
    if (value == null) return null;
    return (
      <text
        x={x + width + 8}
        y={y + 10}
        fill={tokens.text}
        fontSize={13}
        fontWeight={600}
        textAnchor="start"
        dominantBaseline="middle"
      >
        {formatMoney(value, 0)}
      </text>
    );
  };

  const handleLimitChange = (e) => {
    const value = Number(e.target.value);
    if (!value || value < 1) setLimit(10);
    else setLimit(Math.min(value, 50));
  };

  return (
    <div
      className="
        rounded-2xl p-6 space-y-4
        border border-[var(--border-rgba)]
        bg-gradient-to-br
        from-[color-mix(in srgb,var(--bg-1)_100%,transparent)]
        via-[color-mix(in srgb,var(--bg-2)_100%,transparent)]
        to-[color-mix(in srgb,var(--bg-1)_100%,transparent)]
        shadow-[0_16px_40px_color-mix(in srgb,#000_85%,transparent)]
      "
    >
      <h3 className="font-semibold mb-1 text-[var(--text)] text-sm sm:text-base">
        Top {limit} ítems por gasto en la categoría:{" "}
        <span className="font-bold text-[color-mix(in srgb,var(--primary)_65%,var(--text))]">
          {selectedCategoryName}
        </span>{" "}
        <span className="text-[var(--muted)]">({year})</span>
      </h3>

      <p className="text-xs sm:text-sm text-[var(--muted)] mb-2">
        Se muestran solo categorías de tipo gasto. Los ítems se ordenan por
        dinero gastado dentro de la categoría seleccionada y año indicado.
      </p>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-3 sm:items-center text-xs sm:text-sm text-[var(--text)]">
        {/* Categoría (✅ usando tu FFSelect) */}
        <div className="flex items-center gap-2">
          <span className="text-[color-mix(in srgb,var(--muted)_85%,var(--text))]">
            Categoría:
          </span>

          <FFSelect
            value={selectedCategoryId}
            onChange={(v) => setSelectedCategoryId(String(v))}
            options={expenseCategories}
            placeholder="Selecciona categoría..."
            searchable
            clearable
            getOptionLabel={(opt) => opt?.name ?? "—"}
            getOptionValue={(opt) => opt?.id ?? ""}
            className="min-w-[220px] w-[260px] max-w-full"
          />
        </div>

        {/* Año */}
        <div className="flex items-center gap-2">
          <span className="text-[color-mix(in srgb,var(--muted)_85%,var(--text))]">
            Año:
          </span>
          <input
            type="number"
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value) || new Date().getFullYear())
            }
            className="
              border border-[var(--border-rgba)] rounded-lg px-2 py-1 w-24
              bg-[var(--panel-2)] text-[var(--text)]
              focus:outline-none focus:ring-2 focus:ring-[var(--ring)]
            "
            min="2000"
          />
        </div>

        {/* Límite */}
        <div className="flex items-center gap-2">
          <span className="text-[color-mix(in srgb,var(--muted)_85%,var(--text))]">
            Top:
          </span>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={handleLimitChange}
            className="
              border border-[var(--border-rgba)] rounded-lg px-2 py-1 w-20
              bg-[var(--panel-2)] text-[var(--text)]
              focus:outline-none focus:ring-2 focus:ring-[var(--ring)]
            "
          />
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-xs sm:text-sm text-[color-mix(in srgb,var(--muted)_80%,transparent)]">
          No hay datos disponibles para esta categoría, año y límite.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={getChartHeight()}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 16, right: 32, bottom: 16, left: 8 }}
          >
            <CartesianGrid stroke={tokens.grid} strokeDasharray="4 4" />

            <XAxis
              type="number"
              domain={[0, (max) => max * 1.1]}
              stroke={tokens.muted}
              tick={{ fill: tokens.text, fontSize: 11 }}
            />

            <YAxis dataKey="item" type="category" width={labelWidth} tick={<CategoryTick />} />

            <Tooltip
              formatter={(value, name) => {
                if (name === "total_spent") return [formatMoney(value, 2), "Total gastado"];
                if (name === "total_quantity") return [value, "Cantidad"];
                return [value, name];
              }}
              labelFormatter={(label) => `Artículo: ${label}`}
              contentStyle={{
                backgroundColor: tokens.tooltipBg,
                border: `1px solid ${tokens.tooltipBorder}`,
                color: tokens.text,
                borderRadius: "0.5rem",
                boxShadow: tokens.tooltipShadow,
                fontSize: "0.8rem",
              }}
              itemStyle={{ color: tokens.text }}
              labelStyle={{ color: tokens.text, fontWeight: 600 }}
            />

            <Bar dataKey="total_spent" fill={tokens.primary} radius={[4, 4, 4, 4]}>
              <LabelList dataKey="total_spent" content={<CustomRightLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TopItemsByCategoryChart;
