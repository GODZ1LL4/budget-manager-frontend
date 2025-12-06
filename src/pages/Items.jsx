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

  // Modal de confirmación de borrado
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Búsqueda y selección
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

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

  // Lista filtrada por búsqueda
  const filteredItems = items.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

  // Helpers de selección
  const toggleItemSelection = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const allFilteredSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.includes(item.id));

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const allSelected =
        filteredItems.length > 0 &&
        filteredItems.every((item) => prev.includes(item.id));

      if (allSelected) {
        // desmarcar todos los filtrados
        return prev.filter(
          (id) => !filteredItems.some((item) => item.id === id)
        );
      } else {
        // marcar todos los filtrados
        const set = new Set(prev);
        filteredItems.forEach((item) => set.add(item.id));
        return Array.from(set);
      }
    });
  };

  // Exportar precios seleccionados
  const handleExport = async () => {
    if (selectedIds.length === 0) {
      toast.error("Debes seleccionar al menos un artículo");
      return;
    }

    try {
      const response = await axios.post(
        `${api}/items-with-price/export-prices`,
        { ids: selectedIds },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        }
      );

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `precios-articulos-${new Date().toISOString().split("T")[0]}.csv`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      toast.error("Error al exportar precios");
    }
  };

  // Importar precios desde CSV
  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(
        `${api}/items-with-price/import-prices`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      toast.success(
        `Importación completada. Filas insertadas: ${res.data.inserted}`
      );
      if (res.data.errors?.length) {
        console.warn("Errores de importación:", res.data.errors);
      }

      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error("Error al importar archivo de precios");
    } finally {
      e.target.value = ""; // reset input file
    }
  };

  useEffect(() => {
    if (token) {
      fetchItems();
      fetchTaxes();
    }
  }, [token]);

  return (
    <div
      className="
        rounded-2xl p-4 md:p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900
        border border-slate-800
        shadow-[0_18px_45px_rgba(0,0,0,0.85)]
        text-slate-200
      "
    >
      <h2 className="text-2xl font-bold mb-2 text-[#f6e652]">Artículos</h2>
      <p className="text-sm text-slate-400 mb-4">
        Registra productos y controla cómo varían sus precios a lo largo del
        tiempo.
      </p>

      <button
        className="text-sm text-emerald-300 hover:text-emerald-200 underline mb-4"
        onClick={() => setShowTaxModal(true)}
      >
        Administrar impuestos
      </button>

      {/* Formulario solo para crear artículos */}
      <form
        onSubmit={handleCreateItem}
        className="grid gap-4 mb-6 md:grid-cols-3"
      >
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-3 py-2 text-sm
              bg-slate-900 text-slate-100
              placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
            required
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Categoría
          </label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-3 py-2 text-sm
              bg-slate-900 text-slate-100
              placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Impuesto
          </label>
          <select
            value={selectedTaxId}
            onChange={(e) => setSelectedTaxId(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-3 py-2 text-sm
              bg-slate-900 text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          >
            <option value="">Sin impuesto</option>
            {taxes.map((tax) => (
              <option key={tax.id} value={tax.id}>
                {tax.name} ({tax.is_exempt ? "Exento" : `${tax.rate}%`})
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col md:col-span-3 space-y-1">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300">
            Descripción
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="
              border border-slate-700 rounded-lg px-3 py-2 text-sm
              bg-slate-900 text-slate-100
              placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          />
        </div>

        <div className="md:col-span-3">
          <button
            className="
              px-4 py-2 text-sm font-semibold rounded-lg
              bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
              text-slate-950
              shadow-[0_0_16px_rgba(16,185,129,0.7)]
              hover:brightness-110 active:scale-95
              transition-all
            "
          >
            Agregar artículo
          </button>
        </div>
      </form>

      {/* Barra de búsqueda + selección + exportar/importar */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Buscar artículo..."
            className="
              border border-slate-700 rounded-lg px-3 py-2 text-sm
              bg-slate-900 text-slate-100
              placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
              w-full md:w-1/3
            "
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end w-full md:w-auto text-sm">
            <span className="text-xs text-slate-400">
              Total:{" "}
              <span className="font-semibold text-slate-100">
                {filteredItems.length}
              </span>{" "}
              · Seleccionados:{" "}
              <span className="font-semibold text-emerald-300">
                {selectedIds.length}
              </span>
            </span>

            {/* Marcar / desmarcar todos */}
            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              disabled={filteredItems.length === 0}
              className={`
                inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs md:text-sm
                border border-slate-600 bg-slate-900 text-slate-200
                hover:bg-slate-800 hover:border-slate-500
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              `}
            >
              <span className="text-xs">☑️</span>
              {allFilteredSelected ? "Desmarcar todos" : "Marcar todos"}
            </button>

            {/* Exportar precios */}
            <button
              type="button"
              onClick={handleExport}
              disabled={selectedIds.length === 0}
              className="
                inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs md:text-sm
                bg-sky-600 text-white shadow-sm
                hover:bg-sky-500
                disabled:opacity-40 disabled:cursor-not-allowed
                transition-colors
              "
            >
              <span className="text-xs">⬇️</span>
              <span>Exportar precios</span>
            </button>

            {/* Importar precios */}
            <label
              className="
                inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs md:text-sm
                border border-sky-500 text-sky-300 bg-slate-900
                hover:bg-slate-800 hover:border-sky-400
                cursor-pointer transition-colors
              "
            >
              <span className="text-xs">⬆️</span>
              <span>Importar precios</span>
              <input
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Lista de artículos */}
      <ul className="space-y-3">
        {filteredItems.map((item, idx) => (
          <li
            key={item.id}
            className={`
              p-4 rounded-xl border
              ${
                idx % 2 === 0
                  ? "bg-slate-950/50 border-slate-800"
                  : "bg-slate-900/70 border-slate-800"
              }
              shadow-[0_10px_30px_rgba(0,0,0,0.45)]
            `}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <label className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-emerald-500 focus:ring-emerald-500/70"
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                  />
                  <span className="font-semibold text-slate-100">
                    {item.name}{" "}
                    <span className="text-sm italic text-slate-400">
                      {item.category ? `(${item.category})` : ""}
                    </span>
                  </span>
                </label>

                <p className="text-sm text-slate-300">
                  {item.description || (
                    <span className="italic text-slate-500">
                      Sin descripción
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Impuesto:{" "}
                  {item.tax_name
                    ? item.is_exempt
                      ? "Exento"
                      : `${item.tax_name} (${item.tax_rate}%)`
                    : "No asignado"}
                </p>
                <p className="text-sm text-slate-300 mt-1">
                  Último precio:{" "}
                  {item.latest_price !== null
                    ? formatCurrency(item.latest_price)
                    : "No registrado"}
                </p>
              </div>
              <div className="space-x-2 whitespace-nowrap text-sm">
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    fetchPrices(item.id);
                    setShowPriceModal(true);
                  }}
                  className="text-sky-400 hover:text-sky-300 underline"
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
                  className="text-slate-300 hover:text-slate-100 underline"
                >
                  Editar
                </button>
                <button
                  onClick={() => {
                    setItemToDelete(item);
                    setShowDeleteModal(true);
                  }}
                  className="text-rose-400 hover:text-rose-300 underline"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* === Modales (ya estaban en dark, los dejo igual) === */}

      {/* Modal edición de artículo */}
      <Modal
        isOpen={showEditItemModal}
        onClose={() => setShowEditItemModal(false)}
        title="Editar artículo"
      >
        {itemToEdit && (
          <form onSubmit={handleEditItem} className="space-y-4 text-slate-200">
            {/* Nombre */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Nombre
              </label>
              <input
                value={itemToEdit.name}
                onChange={(e) =>
                  setItemToEdit({ ...itemToEdit, name: e.target.value })
                }
                className="
                  w-full rounded-lg px-3 py-2 text-sm
                  bg-slate-900 border border-slate-700
                  text-slate-100 placeholder:text-slate-500
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                  transition-colors
                "
                placeholder="Nombre del artículo"
              />
            </div>

            {/* Categoría */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Categoría
              </label>
              <input
                value={itemToEdit.category || ""}
                onChange={(e) =>
                  setItemToEdit({ ...itemToEdit, category: e.target.value })
                }
                className="
                  w-full rounded-lg px-3 py-2 text-sm
                  bg-slate-900 border border-slate-700
                  text-slate-100 placeholder:text-slate-500
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                  transition-colors
                "
                placeholder="Ej. Snacks, Bebidas, Aseo..."
              />
            </div>

            {/* Descripción */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Descripción
              </label>
              <textarea
                value={itemToEdit.description || ""}
                onChange={(e) =>
                  setItemToEdit({ ...itemToEdit, description: e.target.value })
                }
                className="
                  w-full rounded-lg px-3 py-2 text-sm
                  bg-slate-900 border border-slate-700
                  text-slate-100 placeholder:text-slate-500
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                  transition-colors
                  resize-none
                "
                rows={3}
                placeholder="Detalle opcional del artículo"
              />
            </div>

            {/* Impuesto */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Impuesto
              </label>
              <select
                value={itemToEdit.tax_id || ""}
                onChange={(e) =>
                  setItemToEdit({ ...itemToEdit, tax_id: e.target.value })
                }
                className="
                  w-full rounded-lg px-3 py-2 text-sm
                  bg-slate-900 border border-slate-700
                  text-slate-100
                  focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                  transition-colors
                "
              >
                <option value="">Sin impuesto</option>
                {taxes.map((tax) => (
                  <option key={tax.id} value={tax.id}>
                    {tax.name} ({tax.is_exempt ? "Exento" : `${tax.rate}%`})
                  </option>
                ))}
              </select>
            </div>

            {/* Botón guardar */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                className="
                  inline-flex items-center justify-center
                  px-4 py-2 text-sm font-semibold
                  rounded-lg
                  bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
                  text-slate-950
                  shadow-[0_0_18px_rgba(16,185,129,0.7)]
                  hover:brightness-110
                  active:scale-95
                  transition-all
                "
              >
                Guardar cambios
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Modal precios */}
      <Modal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        title={`Precios de: ${selectedItem?.name || ""}`}
      >
        <form
          onSubmit={handleAddPrice}
          className="flex flex-col sm:flex-row gap-3 mb-6 text-slate-200"
        >
          {/* Precio */}
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-300">Precio</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              placeholder="0.00"
              required
            />
          </div>

          {/* Fecha */}
          <div className="flex-1 space-y-1">
            <label className="text-sm font-medium text-slate-300">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              required
            />
          </div>

          {/* Botón Agregar */}
          <div className="flex items-end">
            <button
              type="submit"
              className="
                w-full sm:w-auto
                inline-flex items-center justify-center
                px-4 py-2 text-sm font-semibold
                rounded-lg
                bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
                text-slate-950
                shadow-[0_0_15px_rgba(16,185,129,0.5)]
                hover:brightness-110
                active:scale-95
                transition-all
              "
            >
              Agregar
            </button>
          </div>
        </form>

        {/* Historial de precios */}
        <ul className="text-sm text-slate-300 space-y-2">
          {priceHistory.length === 0 ? (
            <p className="text-slate-500 italic">Sin precios aún.</p>
          ) : (
            priceHistory.map((p) => (
              <li
                key={p.id}
                className="
                  flex justify-between
                  bg-slate-900/50 border border-slate-800
                  px-3 py-2 rounded-lg
                "
              >
                <span className="text-slate-400">{p.date}</span>
                <strong className="text-emerald-300">
                  {formatCurrency(p.price)}
                </strong>
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
        {/* FORMULARIO NUEVO IMPUESTO */}
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
          className="space-y-4 text-slate-200"
        >
          {/* Nombre */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Nombre</label>
            <input
              name="name"
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              placeholder="Ej. ITBIS, Selectivo, etc."
            />
          </div>

          {/* Porcentaje */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">
              Porcentaje (%)
            </label>
            <input
              name="rate"
              type="number"
              step="0.01"
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              placeholder="Ej. 18"
            />
          </div>

          {/* Exento */}
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              name="exempt"
              type="checkbox"
              className="
                h-4 w-4 rounded border-slate-600 bg-slate-900
                text-emerald-500
                focus:ring-emerald-500/70
              "
            />
            Exento de impuestos
          </label>

          {/* Botón guardar */}
          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              className="
                inline-flex items-center justify-center
                px-4 py-2 text-sm font-semibold
                rounded-lg
                bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
                text-slate-950
                shadow-[0_0_16px_rgba(16,185,129,0.6)]
                hover:brightness-110
                active:scale-95
                transition-all
              "
            >
              Guardar
            </button>
          </div>
        </form>

        {/* LISTA DE IMPUESTOS EXISTENTES */}
        <ul className="mt-5 space-y-2">
          {taxes.map((tax) => (
            <li
              key={tax.id}
              className="
                flex justify-between items-center gap-3
                rounded-lg px-3 py-2
                bg-slate-950/50 border border-slate-800
              "
            >
              <span className="text-sm text-slate-200">
                <span className="font-semibold">{tax.name}</span>{" "}
                <span className="text-slate-400">—</span>{" "}
                <span className="text-slate-300">
                  {tax.is_exempt ? "Exento" : `${tax.rate}%`}
                </span>
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
                className="
                  text-xs font-semibold
                  text-rose-400
                  hover:text-rose-300
                  hover:underline
                  transition-colors
                "
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
        <p className="text-sm text-slate-300 mb-6 leading-relaxed">
          {itemToDelete
            ? `¿Seguro que deseas eliminar el artículo "${itemToDelete.name}"?`
            : ""}
          <br />
          <span className="text-slate-500 text-xs">
            Esta acción no se puede deshacer.
          </span>
        </p>

        <div className="flex justify-end gap-3">
          {/* Botón ELIMINAR */}
          <button
            className="
              px-4 py-2 text-sm font-semibold rounded-lg
              bg-gradient-to-r from-rose-600 via-rose-500 to-rose-400
              text-white
              shadow-[0_0_12px_rgba(244,63,94,0.35)]
              hover:brightness-110
              active:scale-95
              transition-all
            "
            onClick={async () => {
              await handleDeleteItem(itemToDelete);
              setShowDeleteModal(false);
              setItemToDelete(null);
            }}
          >
            Eliminar
          </button>

          {/* Botón CANCELAR */}
          <button
            className="
              px-4 py-2 text-sm font-semibold rounded-lg
              border border-slate-600
              bg-slate-900
              text-slate-300
              hover:bg-slate-800 hover:border-slate-500
              active:scale-95
              transition-all
            "
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
