import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal";
import { toast } from "react-toastify";

function Items({ token }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTaxId, setSelectedTaxId] = useState("");
  const [taxes, setTaxes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [priceHistory, setPriceHistory] = useState([]);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [showEditItemModal, setShowEditItemModal] = useState(false);

  // NUEVO: modal de confirmación de borrado
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

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
      toast.error("Error al cargar artículos");
    }
  };

  const fetchTaxes = async () => {
    try {
      const res = await axios.get(`${api}/taxes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTaxes(res.data.data);
    } catch {
      toast.error("Error al cargar impuestos");
    }
  };

  const fetchPrices = async (itemId) => {
    try {
      const res = await axios.get(`${api}/item-prices/${itemId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setPriceHistory(res.data.data);
    } catch {
      toast.error("Error al obtener historial de precios");
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
      toast.success("Artículo creado correctamente");
      fetchItems();
    } catch {
      toast.error("Error al crear artículo");
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
      toast.success("Artículo actualizado correctamente");
      fetchItems();
    } catch {
      toast.error("Error al editar artículo");
    }
  };

  const handleAddPrice = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    const numericPrice = parseFloat(price);
    if (Number.isNaN(numericPrice)) {
      toast.error("Precio inválido");
      return;
    }

    try {
      await axios.post(
        `${api}/item-prices`,
        {
          item_id: selectedItem.id,
          price: numericPrice,
          date,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPrice("");
      await fetchPrices(selectedItem.id);
      await fetchItems();
      setSelectedItem((prev) =>
        prev ? { ...prev, latest_price: numericPrice } : prev
      );
      toast.success("Precio agregado correctamente");
    } catch {
      toast.error("Error al agregar precio");
    }
  };

  // Borrado de artículo (se ejecuta luego de confirmar en el modal)
  const handleDeleteItem = async (item) => {
    if (!item) return;

    try {
      await axios.delete(`${api}/items/${item.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      toast.success("Artículo eliminado correctamente");
      setItemToDelete(null);
      fetchItems();
    } catch (err) {
      const errorCode = err?.response?.data?.error;
      const message = err?.response?.data?.message;

      if (errorCode === "ITEM_IN_USE") {
        toast.error(
          message ||
            "No se puede eliminar el artículo porque ya se ha usado en transacciones."
        );
      } else {
        toast.error("Error al eliminar artículo");
      }
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
        Registra productos y controla cómo varían sus precios a lo largo del
        tiempo.
      </p>

      <button
        className="text-sm text-blue-600 underline mb-4"
        onClick={() => setShowTaxModal(true)}
      >
        Administrar impuestos
      </button>

      {/* Formulario solo para crear artículos */}
      <form
        onSubmit={handleCreateItem}
        className="grid gap-4 mb-6 md:grid-cols-3"
      >
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
                <button
                  onClick={() => {
                    setItemToDelete(item);
                    setShowDeleteModal(true);
                  }}
                  className="text-red-600 text-sm underline"
                >
                  Eliminar
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
              toast.success("Impuesto guardado correctamente");
              fetchTaxes();
              e.target.reset();
            } catch {
              toast.error("Error al guardar impuesto");
            }
          }}
          className="space-y-2"
        >
          <input
            name="name"
            className="w-full p-2 border"
            placeholder="Nombre"
          />
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
                  try {
                    await axios.delete(`${api}/taxes/${tax.id}`, {
                      headers: { Authorization: `Bearer ${token}` },
                    });
                    toast.success("Impuesto eliminado");
                    fetchTaxes();
                  } catch {
                    toast.error("Error al eliminar impuesto");
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

      {/* Modal confirmación de eliminación de artículo */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        title="Eliminar artículo"
      >
        <p className="text-sm text-gray-700 mb-6">
          {itemToDelete
            ? `¿Seguro que deseas eliminar el artículo "${itemToDelete.name}"? Esta acción no se puede deshacer.`
            : ""}
        </p>
        <div className="flex justify-end gap-2">
        <button
            className="px-4 py-2 rounded bg-red-600 text-white"
            onClick={async () => {
              await handleDeleteItem(itemToDelete);
              setShowDeleteModal(false);
              setItemToDelete(null);
            }}
          >
            Eliminar
          </button>
          <button
            className="px-4 py-2 rounded border border-gray-300 text-gray-700"
            onClick={() => {
              setShowDeleteModal(false);
              setItemToDelete(null);
            }}
          >
            Cancelar
          </button>       
        </div>
      </Modal>
    </div>
  );
}

export default Items;
