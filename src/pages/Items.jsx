import { useEffect, useState } from "react";
import axios from "axios";

function Items({ token }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [selectedItem, setSelectedItem] = useState(null);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [priceHistory, setPriceHistory] = useState([]);

  const api = import.meta.env.VITE_API_URL;

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${api}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data.data);
    } catch {
      alert("Error al cargar artículos");
    }
  };

  const fetchPrices = async (itemId) => {
    try {
      const res = await axios.get(`${api}/item-prices/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPriceHistory(res.data.data);
    } catch {
      alert("Error al obtener historial de precios");
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${api}/items`,
        { name, description, category },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setName("");
      setDescription("");
      setCategory("");
      fetchItems();
    } catch {
      alert("Error al crear artículo");
    }
  };

  const handleAddPrice = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;
    try {
      await axios.post(
        `${api}/item-prices`,
        {
          item_id: selectedItem.id,
          price: parseFloat(price),
          date,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setPrice("");
      fetchPrices(selectedItem.id);
    } catch {
      alert("Error al agregar precio");
    }
  };

  useEffect(() => {
    if (token) fetchItems();
  }, [token]);

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Artículos</h2>
      <p className="text-sm text-gray-500 mb-4">
        Registra productos y controla cómo varían sus precios a lo largo del
        tiempo.
      </p>

      <form
        onSubmit={handleCreateItem}
        className="grid gap-4 mb-6 md:grid-cols-3"
      >
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Nombre</label>
          <input
            placeholder="Ej: Shampoo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Categoría</label>
          <input
            placeholder="Ej: Higiene"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="flex flex-col md:col-span-3">
          <label className="text-sm font-medium mb-1">Descripción</label>
          <input
            placeholder="Descripción breve del artículo"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="md:col-span-3">
          <button
            type="submit"
            className="bg-gray-800 text-white font-semibold px-4 py-2 rounded hover:brightness-90 transition"
          >
            Agregar Artículo
          </button>
        </div>
      </form>

      <ul className="space-y-4 mb-6">
        {items.map((item) => (
          <li
            key={item.id}
            className="p-4 bg-gray-50 border border-gray-300 rounded shadow-sm"
          >
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold text-gray-800">
                  {item.name}{" "}
                  <span className="text-sm italic text-gray-500">
                    ({item.category})
                  </span>
                </p>
                <p className="text-sm text-gray-600">{item.description}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedItem(item);
                  setPriceHistory([]);
                  fetchPrices(item.id);
                }}
                className="text-blue-600 text-sm underline"
              >
                Ver precios
              </button>
            </div>
          </li>
        ))}
      </ul>

      {selectedItem && (
        <div className="pt-6 border-t mt-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">
            Historial de precios: {selectedItem.name}
          </h3>

          <form onSubmit={handleAddPrice} className="flex flex-wrap gap-2 mb-4">
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Precio"
              className="border border-gray-300 p-2 rounded w-32"
              required
            />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="border border-gray-300 p-2 rounded"
              required
            />
            <button
              type="submit"
              className="bg-green-600 text-white px-4 py-2 rounded hover:brightness-95 transition"
            >
              Agregar precio
            </button>
          </form>

          {priceHistory.length === 0 ? (
            <p className="text-sm text-gray-500">Sin precios aún.</p>
          ) : (
            <ul className="text-sm text-gray-700 space-y-1">
              {priceHistory.map((p) => (
                <li key={p.id}>
                  {p.date} — <strong>{p.price.toFixed(2)} USD</strong>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default Items;
