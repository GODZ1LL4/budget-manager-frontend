import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal";

function Items({ token }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTaxId, setSelectedTaxId] = useState("");
  const [taxes, setTaxes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [showEditItemModal, setShowEditItemModal] = useState(false);
  const api = import.meta.env.VITE_API_URL;

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(amount);

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${api}/items-with-price`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setItems(res.data.data);
    } catch {
      alert("Error al cargar artículos");
    }
  };

  const fetchTaxes = async () => {
    try {
      const res = await axios.get(`${api}/taxes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTaxes(res.data.data);
    } catch {
      alert("Error al cargar impuestos");
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
        {
          name,
          description,
          category,
          tax_id: selectedTaxId || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setName("");
      setDescription("");
      setCategory("");
      setSelectedTaxId("");
      fetchItems();
    } catch {
      alert("Error al crear artículo");
    }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();

    try {
      await axios.post(
        `${api}/items`,
        {
          id: itemToEdit.id,
          name: itemToEdit.name,
          description: itemToEdit.description,
          category: itemToEdit.category,
          tax_id: itemToEdit.tax_id || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setItemToEdit(null);
      setShowEditItemModal(false);
      fetchItems();
    } catch {
      alert("Error al editar artículo");
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
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPrice("");
      fetchPrices(selectedItem.id);
    } catch {
      alert("Error al agregar precio");
    }
  };

  useEffect(() => {
    if (token) {
      fetchItems();
      fetchTaxes();
    }
  }, [token]);

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Artículos</h2>
      <p className="text-sm text-gray-500 mb-4">
        Registra productos y controla cómo varían sus precios a lo largo del tiempo.
      </p>

      <button
        className="text-sm text-blue-600 underline mb-4"
        onClick={() => setShowTaxModal(true)}
      >
        Administrar impuestos
      </button>

      {/* Formulario solo para crear artículos */}
      <form onSubmit={handleCreateItem} className="grid gap-4 mb-6 md:grid-cols-3">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Categoría</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Impuesto</label>
          <select
            value={selectedTaxId}
            onChange={(e) => setSelectedTaxId(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          >
            <option value="">Sin impuesto</option>
            {taxes.map((tax) => (
              <option key={tax.id} value={tax.id}>
                {tax.name} ({tax.is_exempt ? "Exento" : `${tax.rate}%`})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col md:col-span-3">
          <label className="text-sm font-medium mb-1">Descripción</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="md:col-span-3">
          <button className="bg-gray-800 text-white px-4 py-2 rounded">
            Agregar Artículo
          </button>
        </div>
      </form>

      <ul className="space-y-4">
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
                <p className="text-sm text-gray-500 mt-1">
                  Impuesto:{" "}
                  {item.tax_name
                    ? item.is_exempt
                      ? "Exento"
                      : `${item.tax_name} (${item.tax_rate}%)`
                    : "No asignado"}
                </p>
                <p className="text-sm text-gray-500">
                  Último precio:{" "}
                  {item.latest_price !== null
                    ? formatCurrency(item.latest_price)
                    : "No registrado"}
                </p>
              </div>
              <div className="space-x-2">
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    fetchPrices(item.id);
                    setShowPriceModal(true);
                  }}
                  className="text-blue-600 text-sm underline"
                >
                  Ver precios
                </button>
                <button
                  onClick={() => {
                    setItemToEdit({
                      id: item.id,
                      name: item.name,
                      category: item.category,
                      description: item.description,
                      tax_id: item.tax_id,
                    });
                    setShowEditItemModal(true);
                  }}
                  className="text-gray-600 text-sm underline"
                >
                  Editar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Modal edición de artículo */}
      <Modal
        isOpen={showEditItemModal}
        onClose={() => setShowEditItemModal(false)}
        title="Editar artículo"
      >
        {itemToEdit && (
          <form onSubmit={handleEditItem} className="space-y-3">
            <input
              value={itemToEdit.name}
              onChange={(e) =>
                setItemToEdit({ ...itemToEdit, name: e.target.value })
              }
              className="w-full p-2 border rounded"
              placeholder="Nombre"
            />
            <input
              value={itemToEdit.category || ""}
              onChange={(e) =>
                setItemToEdit({ ...itemToEdit, category: e.target.value })
              }
              className="w-full p-2 border rounded"
              placeholder="Categoría"
            />
            <textarea
              value={itemToEdit.description || ""}
              onChange={(e) =>
                setItemToEdit({ ...itemToEdit, description: e.target.value })
              }
              className="w-full p-2 border rounded"
              placeholder="Descripción"
            />
            <select
              value={itemToEdit.tax_id || ""}
              onChange={(e) =>
                setItemToEdit({ ...itemToEdit, tax_id: e.target.value })
              }
              className="w-full p-2 border rounded"
            >
              <option value="">Sin impuesto</option>
              {taxes.map((tax) => (
                <option key={tax.id} value={tax.id}>
                  {tax.name} ({tax.is_exempt ? "Exento" : `${tax.rate}%`})
                </option>
              ))}
            </select>
            <button className="bg-blue-600 text-white px-4 py-2 rounded">
              Guardar cambios
            </button>
          </form>
        )}
      </Modal>

      {/* Modal precios */}
      <Modal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        title={`Precios de: ${selectedItem?.name || ""}`}
      >
        <form onSubmit={handleAddPrice} className="flex gap-2 mb-4">
          <input
            type="number"
            step="0.01"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="border p-2 w-32"
            placeholder="Precio"
            required
          />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border p-2"
            required
          />
          <button className="bg-green-600 text-white px-4 py-2 rounded">
            Agregar
          </button>
        </form>
        <ul className="text-sm text-gray-700 space-y-1">
          {priceHistory.length === 0 ? (
            <p className="text-gray-400">Sin precios aún.</p>
          ) : (
            priceHistory.map((p) => (
              <li key={p.id}>
                {p.date} — <strong>{formatCurrency(p.price)}</strong>
              </li>
            ))
          )}
        </ul>
      </Modal>

      {/* Modal impuestos */}
      <Modal
        isOpen={showTaxModal}
        onClose={() => setShowTaxModal(false)}
        title="Gestión de Impuestos"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = e.target.name.value;
            const rate = parseFloat(e.target.rate.value);
            const is_exempt = e.target.exempt.checked;
            try {
              await axios.post(
                `${api}/taxes`,
                { name, rate, is_exempt },
                { headers: { Authorization: `Bearer ${token}` } }
              );
              fetchTaxes();
              e.target.reset();
            } catch {
              alert("Error al guardar impuesto");
            }
          }}
          className="space-y-2"
        >
          <input name="name" className="w-full p-2 border" placeholder="Nombre" />
          <input
            name="rate"
            type="number"
            step="0.01"
            className="w-full p-2 border"
            placeholder="Porcentaje (ej: 18)"
          />
          <label className="flex items-center gap-2 text-sm">
            <input name="exempt" type="checkbox" />
            Exento de impuestos
          </label>
          <button className="bg-green-600 text-white px-4 py-2 rounded">
            Guardar
          </button>
        </form>
        <ul className="mt-4 space-y-1">
          {taxes.map((tax) => (
            <li
              key={tax.id}
              className="flex justify-between items-center border-b pb-1"
            >
              <span>
                {tax.name} — {tax.is_exempt ? "Exento" : `${tax.rate}%`}
              </span>
              <button
                onClick={async () => {
                  if (confirm("¿Eliminar impuesto?")) {
                    await axios.delete(`${api}/taxes/${tax.id}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    fetchTaxes();
                  }
                }}
                className="text-red-500 text-sm"
              >
                Eliminar
              </button>
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
}

export default Items;
