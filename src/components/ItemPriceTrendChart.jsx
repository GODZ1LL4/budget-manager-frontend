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

  // Handler basado en selectedIds actual (no en prev)
  const handleCheckboxChange = (e) => {
    const idStr = String(e.target.value);
    const isChecked = e.target.checked;

    if (isChecked) {
      // marcar
      if (selectedIds.includes(idStr)) return;

      if (selectedIds.length >= MAX_ITEMS) {
        toast.error(
          `Solo puedes seleccionar hasta ${MAX_ITEMS} artículos a la vez.`
        );
        return;
      }

      setSelectedIds([...selectedIds, idStr]);
    } else {
      // desmarcar (nunca toca límite)
      setSelectedIds(selectedIds.filter((x) => x !== idStr));
    }
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Tendencia de precios por artículo
      </h3>

      {/* Controles de selección */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs sm:text-sm text-gray-700">
            Máximo{" "}
            <span className="font-semibold">{MAX_ITEMS}</span> artículos.
            Seleccionados:{" "}
            <span className="font-semibold">
              {selectedIds.length}/{MAX_ITEMS}
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
          {items.length === 0 ? (
            <p className="text-xs text-gray-500">
              No hay artículos registrados.
            </p>
          ) : (
            items.map((item) => {
              const idStr = String(item.id);
              const checked = selectedIds.includes(idStr);
              return (
                <label
                  key={item.id}
                  className="flex items-center gap-2 text-xs sm:text-sm cursor-pointer"
                >
                  <input
                    type="checkbox"
                    className="form-checkbox"
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
        <p className="text-sm text-gray-500">
          Selecciona uno o más artículos (hasta {MAX_ITEMS}) para ver su
          tendencia de precios.
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip formatter={(value) => `RD$ ${value.toFixed(2)}`} />
            <Legend />
            {selectedIds.map((id, index) => (
              <Line
                key={id}
                type="monotone"
                dataKey={id}
                stroke={`hsl(${(index * 60) % 360}, 70%, 50%)`}
                name={itemNameMap[id] || id}
                dot={false}
                connectNulls={true}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default ItemPriceTrendChart;
