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

  // Ancho dinámico para los labels del eje Y (nombre del ítem)
  const getLabelWidth = () => {
    if (!data || data.length === 0) return 80;
    const longest = Math.max(
      ...data.map((d) => (d.item ? d.item.length : 0))
    );
    // Aprox 6px por carácter, acotado entre 80 y 200
    return Math.min(200, Math.max(80, longest * 6));
  };

  // Altura dinámica según cantidad de ítems
  const getChartHeight = () => {
    const perBar = 28; // px por barra
    const base = 80;   // margen extra
    const count = data?.length || 1;
    return Math.max(260, base + count * perBar);
  };

  const labelWidth = getLabelWidth();

  const formatMoney = (v, decimals = 2) => {
    const num = typeof v === "number" ? v : Number(v ?? 0);
    if (Number.isNaN(num)) return "RD$ 0.00";
    return `RD$ ${num.toFixed(decimals)}`;
  };

  // Tick custom para que los nombres se lean bien
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

  const handleLimitChange = (e) => {
    const value = Number(e.target.value);
    if (!value || value < 1) {
      setLimit(10);
    } else {
      setLimit(Math.min(value, 50)); // por si quieres poner un máximo razonable
    }
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-3 text-gray-700 text-sm sm:text-base">
        Top {limit} ítems por gasto en la categoría:{" "}
        <span className="font-bold">{selectedCategoryName}</span> ({year})
      </h3>

      {/* Controles responsivos */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4 sm:items-center">
        {/* Categoría */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-700">Categoría:</span>
          <select
            value={selectedCategoryId}
            onChange={(e) => setSelectedCategoryId(e.target.value)}
            className="border border-gray-300 rounded px-2 py-1 text-xs sm:text-sm"
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
          <span className="text-xs sm:text-sm text-gray-700">Año:</span>
          <input
            type="number"
            value={year}
            onChange={(e) =>
              setYear(Number(e.target.value) || new Date().getFullYear())
            }
            className="border border-gray-300 rounded px-2 py-1 w-24 text-xs sm:text-sm"
            min="2000"
          />
        </div>

        {/* Límite (Top N) */}
        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm text-gray-700">Top:</span>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={handleLimitChange}
            className="border border-gray-300 rounded px-2 py-1 w-20 text-xs sm:text-sm"
          />
        </div>
      </div>

      {data.length === 0 ? (
        <p className="text-xs sm:text-sm text-gray-500">
          No hay datos disponibles para esta categoría, año y límite.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={getChartHeight()}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 16, right: 24, bottom: 16, left: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              domain={[0, (max) => max * 1.1]} // un poco de aire a la derecha
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
            />
            <Bar dataKey="total_spent" fill="#6366f1">
              <LabelList
                dataKey="total_spent"
                position="right"
                formatter={(v) => formatMoney(v, 0)}
                style={{ fontSize: 11 }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      <p className="text-xs text-gray-500 mt-2">
        Solo se muestran categorías de tipo gasto. El gráfico ordena los ítems
        por dinero gastado dentro de la categoría seleccionada en el año y
        límite indicados.
      </p>
    </div>
  );
}

export default TopItemsByCategoryChart;
