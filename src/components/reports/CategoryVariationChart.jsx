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
        <h3 className="text-lg md:text-xl font-semibold text-slate-100">
          Variación de gastos por categoría (anual)
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Analiza cómo varía el gasto mensual por categoría a lo largo del año
          actual.
        </p>
      </div>

      {/* Controles de selección (alineado con ItemPriceTrendChart dark) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-slate-300">
            Máximo{" "}
            <span className="font-semibold text-emerald-300">
              {MAX_CATEGORIES}
            </span>{" "}
            categorías. Seleccionadas:{" "}
            <span className="font-semibold text-slate-100">
              {selectedIds.length}/{MAX_CATEGORIES}
            </span>
          </div>

          <button
            type="button"
            onClick={handleClearAll}
            disabled={selectedIds.length === 0}
            className={`
              text-xs sm:text-sm px-3 py-1.5 rounded-lg border
              transition-colors
              ${
                selectedIds.length === 0
                  ? "text-slate-600 border-slate-800 bg-slate-900 cursor-not-allowed"
                  : "text-slate-100 border-slate-600 bg-slate-900 hover:bg-slate-800"
              }
            `}
          >
            Desmarcar todos
          </button>
        </div>

        <div
          className="
            max-h-48 overflow-y-auto
            border border-slate-800 rounded-xl
            bg-slate-950/70
            p-2 space-y-1
          "
        >
          {expenseCategories.length === 0 ? (
            <p className="text-xs text-slate-500">
              No hay categorías de gasto registradas.
            </p>
          ) : (
            expenseCategories.map((cat) => {
              const idStr = String(cat.id);
              const checked = selectedIds.includes(idStr);
              return (
                <label
                  key={cat.id}
                  className="
                    flex items-center gap-2
                    text-xs sm:text-sm
                    text-slate-200
                    cursor-pointer
                    hover:bg-slate-900/70
                    rounded-md px-2 py-1
                  "
                >
                  <input
                    type="checkbox"
                    className="form-checkbox accent-emerald-400"
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
        <p className="text-sm text-slate-400">
          Selecciona una o varias categorías de gasto (hasta {MAX_CATEGORIES}){" "}
          para ver su variación mensual en el año actual.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="month"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <Tooltip
                formatter={(value) =>
                  `RD$ ${Number(value || 0).toFixed(2)}`
                }
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
                  fontSize: "1rem",
                }}
                itemStyle={{ color: "#e5e7eb" }}
                labelStyle={{ color: "#e5e7eb", fontWeight: 600 }}
              />
              <Legend
                wrapperStyle={{ color: "#e2e8f0" }}
                formatter={(value) => (
                  <span className="text-slate-200 text-xs sm:text-sm">
                    {value}
                  </span>
                )}
              />

              {selectedIds.map((catId, index) => {
                const cat = expenseCategories.find(
                  (c) => String(c.id) === String(catId)
                );
                const color = `hsl(${(index * 60) % 360}, 70%, 55%)`;

                return (
                  <Line
                    key={catId}
                    type="monotone"
                    dataKey={catId}
                    stroke={color}
                    name={cat?.name || catId}
                    connectNulls={true}
                    strokeWidth={2}
                    // puntos siempre visibles
                    dot={{
                      r: 4,
                      strokeWidth: 1,
                      stroke: "#020617",
                      fill: color,
                    }}
                    // punto más grande al hover
                    activeDot={{
                      r: 7,
                      strokeWidth: 2,
                      stroke: "#e5e7eb",
                    }}
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default CategoryVariationChart;
