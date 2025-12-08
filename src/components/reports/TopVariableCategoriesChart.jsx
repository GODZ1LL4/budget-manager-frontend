import { useEffect, useState } from "react";
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

const formatMoney = (v) => {
  const num = typeof v === "number" ? v : Number(v ?? 0);
  if (Number.isNaN(num)) return "RD$ 0.00";
  return `RD$ ${num.toFixed(2)}`;
};

const STABILITIES = ["fixed", "variable", "occasional"];

// Fechas por defecto
const today = new Date();
const year = today.getFullYear();
const defaultDateFrom = `${year}-01-01`;
const defaultDateTo = today.toISOString().split("T")[0];

// Tick personalizado del eje Y (categorías)
const CategoryTick = ({ x, y, payload }) => (
  <text
    x={x}
    y={y}
    dy={4}
    textAnchor="end"
    fontSize={13}        // ↑ fuente más grande
    fill="#e5e7eb"
  >
    {payload.value}
  </text>
);

// Label custom al final de la barra
const CustomRightLabel = (props) => {
  const { x, y, width, value } = props;
  if (value == null) return null;

  const textX = x + width + 8;     // fin de la barra + padding
  const textY = y + 10;            // centrado vertical aprox

  return (
    <text
      x={textX}
      y={textY}
      fill="#e5e7eb"
      fontSize={13}
      fontWeight={600}
      textAnchor="start"
      dominantBaseline="middle"
    >
      {formatMoney(value)}
    </text>
  );
};

function TopVariableCategoriesChart({ token }) {
  const [data, setData] = useState([]);

  const [selectedStabilities, setSelectedStabilities] = useState(["variable"]);
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [limit, setLimit] = useState(10);

  const api = import.meta.env.VITE_API_URL;

  const loadData = () => {
    if (!token) return;

    const params = new URLSearchParams();

    if (selectedStabilities.length > 0) {
      params.set("stability_types", selectedStabilities.join(","));
    }

    params.set("date_from", dateFrom);
    params.set("date_to", dateTo);
    params.set("limit", String(limit));

    axios
      .get(`${api}/analytics/top-variable-categories?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) =>
        console.error("Error al cargar categorías top:", err)
      );
  };

  useEffect(() => {
    loadData();
  }, [token, api, selectedStabilities, dateFrom, dateTo, limit]);

  const toggleStability = (stability) => {
    setSelectedStabilities((prev) => {
      if (prev.includes(stability)) {
        return prev.filter((s) => s !== stability);
      }
      return [...prev, stability];
    });
  };

  const titleStabilityPart =
    selectedStabilities.length === 0
      ? "categorías"
      : `categorías (${selectedStabilities.join(", ")})`;

  // Ancho dinámico para labels del eje Y
  const getLabelWidth = () => {
    if (!data || data.length === 0) return 80;
    const longest = Math.max(
      ...data.map((d) => (d.category ? d.category.length : 0))
    );
    return Math.min(200, Math.max(80, longest * 6)); // ~6px por carácter
  };

  // Altura dinámica según cantidad de categorías
  const getChartHeight = () => {
    const perBar = 26; // px por barra
    const base = 80;   // margen extra
    const count = data?.length || 1;
    return Math.max(260, base + count * perBar);
  };

  const labelWidth = getLabelWidth();

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_16px_40px_rgba(0,0,0,0.85)]
        space-y-4
      "
    >
      <div>
        <h3 className="text-lg font-semibold text-slate-100 mb-1">
          Top {limit} {titleStabilityPart} con más gasto
        </h3>
        <p className="text-sm text-slate-400">
          Filtra por tipo de estabilidad, rango de fechas y cantidad de
          resultados para ver en qué categorías estás gastando más.
        </p>
      </div>

      {/* Filtros (igual que antes, solo dark) */}
      <div className="flex flex-wrap items-center gap-3 text-sm mb-3 text-slate-200">
        {/* Estabilidad */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-300">Estabilidad:</span>
          {STABILITIES.map((st) => (
            <label
              key={st}
              className="flex items-center gap-1 text-xs sm:text-sm"
            >
              <input
                type="checkbox"
                checked={selectedStabilities.includes(st)}
                onChange={() => toggleStability(st)}
                className="form-checkbox accent-emerald-400"
              />
              <span className="capitalize text-slate-200">{st}</span>
            </label>
          ))}
        </div>

        {/* Rango de fechas */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-slate-300">Rango:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-2 py-1 text-ms
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            "
          />
          <span className="text-slate-400">-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-2 py-1 text-ms
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            "
          />
        </div>

        {/* Límite */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-300">Top:</span>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 10)}
            className="
              w-16 border border-slate-700 rounded-lg px-2 py-1 text-ms
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            "
          />
        </div>
      </div>

      {/* Gráfico */}
      {data.length === 0 ? (
        <p className="text-sm text-slate-500 italic">
          No hay datos para los filtros seleccionados.
        </p>
      ) : (
        <div className="w-full" style={{ height: getChartHeight() }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{
                top: 16,
                right: 40,
                bottom: 16,
                left: 8,
              }}
            >
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                type="number"
                domain={[0, (max) => max * 1.1]}
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <YAxis
                type="category"
                dataKey="category"
                width={labelWidth}
                tick={<CategoryTick />}
              />
              <Tooltip
                formatter={(val) => formatMoney(val)}
                labelFormatter={(name) => name}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                  fontSize: "0.8rem",
                }}
                itemStyle={{ color: "#e5e7eb" }}
                labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
              />
              <Bar dataKey="total" fill="#f59e0b" radius={[4, 4, 4, 4]}>
                <LabelList dataKey="total" content={<CustomRightLabel />} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default TopVariableCategoriesChart;
