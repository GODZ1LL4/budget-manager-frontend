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

function TopItemsByCategoryChart({ token, categories = [] }) {
  const api = import.meta.env.VITE_API_URL;
  const [year, setYear] = useState(new Date().getFullYear());
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [limit, setLimit] = useState(10);
  const [data, setData] = useState([]);

  // Solo categorías de gasto
  const expenseCategories = categories.filter((c) => c.type === "expense");

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
        params: {
          category_id: selectedCategoryId,
          year,
          limit,
        },
      })
      .then((res) => setData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar top ítems por categoría:", err);
      });
  }, [token, selectedCategoryId, year, limit, api]);

  // Nombre de la categoría seleccionada (para el título)
  const selectedCategoryName =
    expenseCategories.find((c) => c.id === selectedCategoryId)?.name || "—";

  const formatMoney = (v, decimals = 2) => {
    const num = typeof v === "number" ? v : Number(v ?? 0);
    if (Number.isNaN(num)) return "RD$ 0.00";
    return `RD$ ${num.toFixed(decimals)}`;
  };

  // Ancho dinámico para los labels del eje Y (nombre del ítem)
  const getLabelWidth = () => {
    if (!data || data.length === 0) return 80;
    const longest = Math.max(
      ...data.map((d) => (d.item ? d.item.length : 0))
    );
    return Math.min(220, Math.max(80, longest * 7)); // un poco más espacioso en dark
  };

  // Altura dinámica según cantidad de ítems
  const getChartHeight = () => {
    const perBar = 28; // px por barra
    const base = 80; // margen extra
    const count = data?.length || 1;
    return Math.max(260, base + count * perBar);
  };

  const labelWidth = getLabelWidth();

  // Tick custom del eje Y (izquierda)
  const CategoryTick = ({ x, y, payload }) => (
    <text
      x={x}
      y={y}
      dy={4}
      textAnchor="end"
      fontSize={13}
      fill="#e5e7eb"
    >
      {payload.value}
    </text>
  );

  // Label custom al final de la barra (mismo patrón que TopVariableCategories)
  const CustomRightLabel = (props) => {
    const { x, y, width, value } = props;
    if (value == null) return null;

    const textX = x + width + 8; // fin de la barra + padding
    const textY = y + 10; // centrado vertical aproximado

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
        {formatMoney(value, 0)}
      </text>
    );
  };

  const handleLimitChange = (e) => {
    const value = Number(e.target.value);
    if (!value || value < 1) {
      setLimit(10);
    } else {
      setLimit(Math.min(value, 50));
    }
  };

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
      <h3 className="font-semibold mb-1 text-slate-100 text-sm sm:text-base">
        Top {limit} ítems por gasto en la categoría:{" "}
        <span className="font-bold text-emerald-300">
          {selectedCategoryName}
        </span>{" "}
        <span className="text-slate-400">({year})</span>
      </h3>
      <p className="text-xs sm:text-sm text-slate-400 mb-2">
        Se muestran solo categorías de tipo gasto. Los ítems se ordenan por
        dinero gastado dentro de la categoría seleccionada y año indicado.
      </p>

      {/* Controles responsivos */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-3 sm:items-center text-xs sm:text-sm text-slate-200">
        {/* Categoría */}
        <div className="flex items-center gap-2">
          <span className="text-slate-300">Categoría:</span>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-2 py-1
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            "
          >
            {expenseCategories.length === 0 && (
              <option value="">No hay categorías de gasto</option>
            )}

            {expenseCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Año */}
        <div className="flex items-center gap-2">
          <span className="text-slate-300">Año:</span>
          <input
            type="number"
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value) || new Date().getFullYear())
            }
            className="
              border border-slate-700 rounded-lg px-2 py-1 w-24
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            "
            min="2000"
          />
        </div>

        {/* Límite (Top N) */}
        <div className="flex items-center gap-2">
          <span className="text-slate-300">Top:</span>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={handleLimitChange}
            className="
              border border-slate-700 rounded-lg px-2 py-1 w-20
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            "
          />
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-xs sm:text-sm text-slate-500">
          No hay datos disponibles para esta categoría, año y límite.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={getChartHeight()}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 16, right: 32, bottom: 16, left: 8 }}
          >
            <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
            <XAxis
              type="number"
              domain={[0, (max) => max * 1.1]}
              stroke="#94a3b8"
              tick={{ fill: "#cbd5e1", fontSize: 11 }}
            />
            <YAxis
              dataKey="item"
              type="category"
              width={labelWidth}
              tick={<CategoryTick />}
            />
            <Tooltip
              formatter={(value, name) => {
                if (name === "total_spent") {
                  return [formatMoney(value, 2), "Total gastado"];
                }
                if (name === "total_quantity") {
                  return [value, "Cantidad"];
                }
                return [value, name];
              }}
              labelFormatter={(label) => `Artículo: ${label}`}
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
            <Bar dataKey="total_spent" fill="#6366f1" radius={[4, 4, 4, 4]}>
              <LabelList dataKey="total_spent" content={<CustomRightLabel />} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default TopItemsByCategoryChart;
