import { useEffect, useState } from "react";
import axios from "axios";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

function ItemTrendChart({ token }) {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [data, setData] = useState([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${api}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setItems(res.data.data))
      .catch(() => console.error("Error al cargar artículos"));
  }, [token]);

  useEffect(() => {
    if (!token || !selectedItem) return;

    axios
      .get(`${api}/analytics/item-trend/${selectedItem}?year=${year}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setData(res.data.data || []))
      .catch(() => console.error("Error al cargar tendencia del artículo"));
  }, [token, selectedItem, year]);

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2 text-gray-700">Tendencia de consumo por artículo</h3>

      <div className="flex gap-2 mb-4">
        <select
          className="border border-gray-300 rounded p-2"
          value={selectedItem || ""}
          onChange={(e) => setSelectedItem(e.target.value)}
        >
          <option value="">Selecciona un artículo</option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <input
          type="number"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="border border-gray-300 rounded p-2 w-24"
          min="2000"
        />
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="quantity" stroke="#3b82f6" name="Cantidad" />
            <Line type="monotone" dataKey="total" stroke="#ef4444" name="Gasto Total" />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-sm text-gray-500">No hay datos disponibles.</p>
      )}
    </div>
  );
}

export default ItemTrendChart;
