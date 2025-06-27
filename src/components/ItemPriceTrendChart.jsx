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

function ItemPriceTrendChart({ token }) {
  const [items, setItems] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [priceData, setPriceData] = useState([]);
  const api = import.meta.env.VITE_API_URL;

  // Obtener lista de artículos (para el selector)
  useEffect(() => {
    axios
      .get(`${api}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(res.data.data));
  }, [token]);

  // Obtener datos de precios históricos según selección
  useEffect(() => {
    if (selectedIds.length === 0) {
      setPriceData([]);
      return;
    }

    axios
      .get(`${api}/analytics/item-prices-trend`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { item_ids: selectedIds },
      })
      .then((res) => setPriceData(res.data.data));
  }, [selectedIds]);

  // Crear estructura para gráfico (por fecha)
  const groupedByDate = {};
  const itemNameMap = {};

  priceData.forEach((entry) => {
    const key = entry.date;
    if (!groupedByDate[key]) groupedByDate[key] = { date: key };
    groupedByDate[key][entry.item_id] = entry.price;

    itemNameMap[entry.item_id] = entry.item_name;
  });

  const chartData = Object.values(groupedByDate);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="text-lg font-semibold mb-4">
        Tendencia de precios por artículo
      </h3>

      <select
        multiple
        onChange={(e) => {
          const values = Array.from(e.target.selectedOptions).map(
            (o) => o.value
          );
          setSelectedIds(values);
        }}
        className="border border-gray-300 rounded mb-4 w-full p-2 h-32"
      >
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>

      {chartData.length === 0 ? (
        <p className="text-sm text-gray-500">
          No hay datos disponibles para los artículos seleccionados.
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
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}

export default ItemPriceTrendChart;
