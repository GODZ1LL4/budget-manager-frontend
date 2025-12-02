import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "react-toastify";

function CategoryVariationChart({ token, categories = [] }) {
  const [data, setData] = useState({}); // { [category_id]: [{ month, amount }, ...] }
  const [selectedIds, setSelectedIds] = useState([]); // ids de categorías seleccionadas
  const api = import.meta.env.VITE_API_URL;

  // Solo categorías de tipo "expense"
  const expenseCategories = (categories || []).filter(
    (cat) => cat.type === "expense"
  );

  const MAX_CATEGORIES = 20;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/analytics/yearly-category-variations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || {}))
      .catch((err) => {
        console.error("Error al cargar variaciones anuales por categoría:", err);
      });
  }, [token, api]);

  // Meses del año actual
  const currentYear = new Date().getFullYear();
  const allMonths = Array.from(
    { length: 12 },
    (_, i) => `${currentYear}-${String(i + 1).padStart(2, "0")}`
  );

  // Armar data para el gráfico
  const chartData =
    selectedIds.length === 0
      ? []
      : allMonths.map((month) => {
          const row = { month };
          selectedIds.forEach((catId) => {
            const entries = data[catId] || [];
            const found = entries.find((e) => e.month === month);
            row[catId] = found ? found.amount : 0;
          });
          return row;
        });

  const handleCheckboxChange = (e) => {
    const idStr = String(e.target.value);
    const isChecked = e.target.checked;

    if (isChecked) {
      if (selectedIds.includes(idStr)) return;

      if (selectedIds.length >= MAX_CATEGORIES) {
        toast.error(
          `Solo puedes seleccionar hasta ${MAX_CATEGORIES} categorías a la vez.`
        );
        return;
      }

      setSelectedIds([...selectedIds, idStr]);
    } else {
      setSelectedIds(selectedIds.filter((x) => x !== idStr));
    }
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Variación de gastos por categoría (anual)
      </h3>

      {/* Controles de selección (mismo estilo que ItemPriceTrendChart) */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs sm:text-sm text-gray-700">
            Máximo{" "}
            <span className="font-semibold">{MAX_CATEGORIES}</span> categorías.
            Seleccionadas:{" "}
            <span className="font-semibold">
              {selectedIds.length}/{MAX_CATEGORIES}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedIds.length === 0}
            className={`text-xs sm:text-sm px-2 py-1 rounded border ${
              selectedIds.length === 0
                ? "text-gray-400 border-gray-200 cursor-not-allowed"
                : "text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            Desmarcar todos
          </button>
        </div>

        <div className="max-h-48 overflow-y-auto border rounded p-2 space-y-1">
          {expenseCategories.length === 0 ? (
            <p className="text-xs text-gray-500">
              No hay categorías de gasto registradas.
            </p>
          ) : (
            expenseCategories.map((cat) => {
              const idStr = String(cat.id);
              const checked = selectedIds.includes(idStr);
              return (
                <label
                  key={cat.id}
                  className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    value={idStr}
                    checked={checked}
                    onChange={handleCheckboxChange}
                  />
                  <span className="truncate">{cat.name}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Gráfico */}
      {chartData.length === 0 || selectedIds.length === 0 ? (
        <p className="text-sm text-gray-500">
          Selecciona una o varias categorías de gasto (hasta {MAX_CATEGORIES}){" "}
          para ver su variación mensual en el año actual.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip
              formatter={(value) => `RD$ ${Number(value || 0).toFixed(2)}`}
            />
            <Legend />
            {selectedIds.map((catId, index) => {
              const cat = expenseCategories.find(
                (c) => String(c.id) === String(catId)
              );
              return (
                <Line
                  key={catId}
                  type="monotone"
                  dataKey={catId}
                  stroke={`hsl(${(index * 60) % 360}, 70%, 50%)`}
                  name={cat?.name || catId}
                  dot={false}
                  connectNulls={true}
                  strokeWidth={2}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default CategoryVariationChart;
