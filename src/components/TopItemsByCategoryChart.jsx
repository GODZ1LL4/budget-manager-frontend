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
  const [data, setData] = useState([]);

  // Solo categorías de gasto
  const expenseCategories = categories.filter((c) => c.type === "expense");

  // Seleccionar categoría por defecto (primera de gasto)
  useEffect(() => {
    if (expenseCategories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(expenseCategories[0].id);
    }
  }, [expenseCategories, selectedCategoryId]);

  // Cargar datos cuando cambie categoría o año
  useEffect(() => {
    if (!token || !selectedCategoryId) return;

    axios
      .get(
        `${api}/analytics/top-items-by-category?category_id=${selectedCategoryId}&year=${year}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      )
      .then((res) => setData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar top ítems por categoría:", err);
      });
  }, [token, selectedCategoryId, year, api]);

  // Nombre de la categoría seleccionada (para el título)
  const selectedCategoryName =
    expenseCategories.find((c) => c.id === selectedCategoryId)?.name ||
    "—";

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2 text-gray-700">
        Top ítems por gasto en la categoría: {selectedCategoryName} ({year})
      </h3>

      <div className="flex flex-wrap gap-2 mb-4 items-center">
        <select
          value={selectedCategoryId}
          onChange={(e) => setSelectedCategoryId(e.target.value)}
          className="border border-gray-300 rounded p-1"
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

        <input
          type="number"
          value={year}
          onChange={(e) =>
            setYear(Number(e.target.value) || new Date().getFullYear())
          }
          className="border border-gray-300 rounded p-1 w-24"
          min="2000"
        />
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 100, right: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" />
          <YAxis dataKey="item" type="category" width={180} />
          <Tooltip
            formatter={(value, name) => {
              if (name === "total_spent") {
                return [`RD$ ${Number(value).toFixed(2)}`, "Total gastado"];
              }
              if (name === "total_quantity") {
                return [value, "Cantidad"];
              }
              return [value, name];
            }}
          />
          <Bar dataKey="total_spent" fill="#6366f1">
            <LabelList
              dataKey="total_spent"
              position="right"
              formatter={(v) => `RD$ ${Number(v).toFixed(0)}`}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-gray-500 mt-2">
        Solo se muestran categorías de tipo gasto. El gráfico ordena los ítems
        por dinero gastado dentro de la categoría seleccionada en el año
        indicado.
      </p>
    </div>
  );
}

export default TopItemsByCategoryChart;
