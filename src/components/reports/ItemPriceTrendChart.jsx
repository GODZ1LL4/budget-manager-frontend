import { useEffect, useState } from "react";
import axios from "axios";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { toast } from "react-toastify";

function ItemPriceTrendChart({ token }) {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  // Obtener lista de artículos
  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar artículos:", err);
      });
  }, [token, api]);

  // Obtener datos de precios históricos según selección
  useEffect(() => {
    if (!token) return;

    if (selectedIds.length === 0) {
      setPriceData([]);
      return;
    }

    axios
      .get(`${api}/analytics/item-prices-trend`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { item_ids: selectedIds },
      })
      .then((res) => setPriceData(res.data.data || []))
      .catch((err) => {
        console.error("Error al cargar tendencia de precios:", err);
      });
  }, [selectedIds, token, api]);

  // Crear estructura para gráfico (por fecha)
  const groupedByDate = {};
  const itemNameMap = {};

  priceData.forEach((entry) => {
    const key = entry.date;
    if (!groupedByDate[key]) groupedByDate[key] = { date: key };

    groupedByDate[key][entry.item_id] = entry.price;
    itemNameMap[entry.item_id] = entry.item_name;
  });

  const chartData = Object.values(groupedByDate).sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  const MAX_ITEMS = 20;

  const handleCheckboxChange = (e) => {
    const idStr = String(e.target.value);
    const isChecked = e.target.checked;

    if (isChecked) {
      if (selectedIds.includes(idStr)) return;

      if (selectedIds.length >= MAX_ITEMS) {
        toast.error(
          `Solo puedes seleccionar hasta ${MAX_ITEMS} artículos a la vez.`
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
        <h3 className="text-xl font-semibold text-slate-100">
          Tendencia de precios por artículo
        </h3>
        <p className="text-sm text-slate-400 mt-1">
          Selecciona uno o más artículos para ver cómo han variado sus precios
          en el tiempo.
        </p>
      </div>

      {/* Controles de selección */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs sm:text-sm text-slate-300">
            Máximo{" "}
            <span className="font-semibold text-emerald-300">
              {MAX_ITEMS}
            </span>{" "}
            artículos. Seleccionados:{" "}
            <span className="font-semibold text-slate-100">
              {selectedIds.length}/{MAX_ITEMS}
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
          {items.length === 0 ? (
            <p className="text-xs text-slate-500">
              No hay artículos registrados.
            </p>
          ) : (
            items.map((item) => {
              const idStr = String(item.id);
              const checked = selectedIds.includes(idStr);
              return (
                <label
                  key={item.id}
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
                  <span className="truncate">{item.name}</span>
                </label>
              );
            })
          )}
        </div>
      </div>

      {/* Gráfico */}
      {chartData.length === 0 || selectedIds.length === 0 ? (
        <p className="text-sm text-slate-400">
          Selecciona uno o más artículos (hasta {MAX_ITEMS}) para ver su
          tendencia de precios.
        </p>
      ) : (
        <div className="w-full h-[300px]">
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid stroke="#1e293b" strokeDasharray="4 4" />
              <XAxis
                dataKey="date"
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <YAxis
                stroke="#94a3b8"
                tick={{ fill: "#cbd5e1", fontSize: 14 }}
              />
              <Tooltip
                formatter={(value) => `RD$ ${Number(value).toFixed(2)}`}
                contentStyle={{
                  backgroundColor: "#020617",
                  border: "1px solid #4b5563",
                  color: "#e5e7eb",
                  borderRadius: "0.5rem",
                  boxShadow: "0 18px 45px rgba(0,0,0,0.9)",
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

              {selectedIds.map((id, index) => (
                <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={`hsl(${(index * 60) % 360}, 70%, 55%)`}
                name={itemNameMap[id] || id}
                connectNulls={true}
                strokeWidth={2}
              
                // 👇 Nuevo: puntos visibles SIEMPRE
                dot={{ r: 4, strokeWidth: 1, stroke: "#0f172a", fill: `hsl(${(index * 60) % 360}, 70%, 55%)` }}
              
                // 👇 Punto grande cuando se hace hover
                activeDot={{ r: 7, strokeWidth: 2, stroke: "#e2e8f0" }}
              />
              
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export default ItemPriceTrendChart;
