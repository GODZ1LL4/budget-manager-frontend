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
    fontSize={11}
    fill="#374151"
  >
    {payload.value}
  </text>
);

function TopVariableCategoriesChart({ token }) {
  const [data, setData] = useState([]);

  const [selectedStabilities, setSelectedStabilities] = useState(["variable"]);
  const [dateFrom, setDateFrom] = useState(defaultDateFrom);
  const [dateTo, setDateTo] = useState(defaultDateTo);
  const [limit, setLimit] = useState(10);

  const api = import.meta.env.VITE_API_URL;

  const loadData = () => {
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
      .then((res) => setData(res.data.data))
      .catch(() => alert("Error al cargar categorías top"));
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
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-md font-semibold text-gray-700 mb-3">
        Top {limit} {titleStabilityPart} con más gasto
      </h3>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-3 text-sm mb-3">
        {/* Estabilidad */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Estabilidad:</span>
          {STABILITIES.map((st) => (
            <label key={st} className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={selectedStabilities.includes(st)}
                onChange={() => toggleStability(st)}
              />
              <span className="capitalize">{st}</span>
            </label>
          ))}
        </div>

        {/* Rango de fechas */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Rango:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          />
          <span>-</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded px-2 py-1 text-xs"
          />
        </div>

        {/* Límite */}
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Top:</span>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value) || 10)}
            className="w-16 border rounded px-2 py-1 text-xs"
          />
        </div>
      </div>

      {/* Gráfico */}
      <ResponsiveContainer width="100%" height={getChartHeight()}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{
            top: 16,
            right: 40,
            bottom: 16,
            left: 8, // margen mínimo; el espacio lo da YAxis.width
          }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis
            type="number"
            domain={[0, (max) => max * 1.1]} // aire a la derecha para labels
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
          />
          <Bar dataKey="total" fill="#f59e0b">
            <LabelList
              dataKey="total"
              position="right"
              formatter={(val) => formatMoney(val)}
              style={{ fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default TopVariableCategoriesChart;
