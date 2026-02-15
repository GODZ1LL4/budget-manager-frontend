import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal";
import FFSelect from "../components/FFSelect";
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
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [priceHistory, setPriceHistory] = useState([]);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  const [showEditItemModal, setShowEditItemModal] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState([]);

  const [showDeletePriceModal, setShowDeletePriceModal] = useState(false);
  const [priceToDelete, setPriceToDelete] = useState(null);

  const api = import.meta.env.VITE_API_URL;

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("es-DO", {
      style: "currency",
      currency: "DOP",
      minimumFractionDigits: 2,
    }).format(amount);

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchItems = async () => {
    try {
      const res = await axios.get(`${api}/items-with-price`, authHeaders);
      setItems(res.data.data);
    } catch {
      toast.error("Error al cargar artículos");
    }
  };

  const fetchTaxes = async () => {
    try {
      const res = await axios.get(`${api}/taxes`, authHeaders);
      setTaxes(res.data.data);
    } catch {
      toast.error("Error al cargar impuestos");
    }
  };

  const fetchPrices = async (itemId) => {
    try {
      const res = await axios.get(`${api}/item-prices/${itemId}`, authHeaders);
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
        { name, description, category, tax_id: selectedTaxId || null },
        authHeaders
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
        authHeaders
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
        { item_id: selectedItem.id, price: numericPrice, date },
        authHeaders
      );

      setPrice("");
      await fetchPrices(selectedItem.id);
      await fetchItems();

      setSelectedItem((prev) => (prev ? { ...prev, latest_price: numericPrice } : prev));
      toast.success("Precio agregado correctamente");
    } catch (err) {
      const code = err?.response?.data?.error;
      const message = err?.response?.data?.message;

      if (code === "DUPLICATE_PRICE_FOR_DATE") {
        toast.error(message || "Ya existe un precio para este artículo en esa fecha.");
      } else if (message) {
        toast.error(message);
      } else {
        toast.error("Error al agregar precio");
      }
    }
  };

  const handleDeleteItem = async (item) => {
    if (!item) return;

    try {
      await axios.delete(`${api}/items/${item.id}`, authHeaders);

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

  const handleAskDeletePrice = (priceRecord) => {
    setPriceToDelete(priceRecord);
    setShowDeletePriceModal(true);
  };

  const handleConfirmDeletePrice = async () => {
    if (!selectedItem || !priceToDelete) return;

    try {
      await axios.delete(`${api}/item-prices/${priceToDelete.id}`, authHeaders);

      toast.success("Precio eliminado correctamente");
      setShowDeletePriceModal(false);
      setPriceToDelete(null);

      await fetchPrices(selectedItem.id);
      await fetchItems();
    } catch (err) {
      const code = err?.response?.data?.error;
      const message = err?.response?.data?.message;

      if (code === "PRICE_NOT_FOUND") {
        toast.error(message || "El precio ya no existe.");
      } else if (code === "FORBIDDEN") {
        toast.error(message || "No tienes permiso para eliminar este precio.");
      } else {
        toast.error("Error al eliminar precio");
      }
    }
  };

  const filteredItems = items.filter((item) =>
    item.name?.toLowerCase().includes(search.toLowerCase())
  );

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
        return prev.filter((id) => !filteredItems.some((item) => item.id === id));
      } else {
        const set = new Set(prev);
        filteredItems.forEach((item) => set.add(item.id));
        return Array.from(set);
      }
    });
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      toast.error("Debes seleccionar al menos un artículo");
      return;
    }

    try {
      const response = await axios.post(
        `${api}/items-with-price/export-prices`,
        { ids: selectedIds },
        { ...authHeaders, responseType: "blob" }
      );

      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
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

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await axios.post(`${api}/items-with-price/import-prices`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      toast.success(`Importación completada. Filas insertadas: ${res.data.inserted}`);
      if (res.data.errors?.length) console.warn("Errores de importación:", res.data.errors);

      fetchItems();
    } catch (error) {
      console.error(error);
      toast.error("Error al importar archivo de precios");
    } finally {
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchItems();
    fetchTaxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const taxOptions = useMemo(() => {
    const base = [{ value: "", label: "Sin impuesto" }];
    const mapped = taxes.map((tax) => ({
      value: tax.id,
      label: `${tax.name} (${tax.is_exempt ? "Exento" : `${tax.rate}%`})`,
    }));
    return [...base, ...mapped];
  }, [taxes]);

  return (
    <div className="ff-card p-4 md:p-6">
      <h2 className="ff-h1 ff-heading-accent mb-2">Artículos</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Registra productos y controla cómo varían sus precios a lo largo del tiempo.
      </p>

      <button
        type="button"
        className="text-sm underline underline-offset-2 mb-4"
        style={{ color: "var(--primary)" }}
        onClick={() => setShowTaxModal(true)}
      >
        Administrar impuestos
      </button>

      {/* Crear artículo */}
      <form onSubmit={handleCreateItem} className="grid gap-4 mb-6 md:grid-cols-3">
        <div className="flex flex-col space-y-1">
          <label className="ff-label uppercase font-semibold">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="ff-input" required />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label uppercase font-semibold">Categoría</label>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="ff-input" />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label uppercase font-semibold">Impuesto</label>
          <FFSelect
            value={selectedTaxId}
            onChange={(v) => setSelectedTaxId(v)}
            options={taxOptions}
            searchable
            clearable={false}
            placeholder="Sin impuesto"
          />
        </div>

        <div className="flex flex-col md:col-span-3 space-y-1">
          <label className="ff-label uppercase font-semibold">Descripción</label>
          <input value={description} onChange={(e) => setDescription(e.target.value)} className="ff-input" />
        </div>

        <div className="md:col-span-3">
          <button type="submit" className="ff-btn ff-btn-primary">
            Agregar artículo
          </button>
        </div>
      </form>

      {/* Search + acciones */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Buscar artículo..."
            className="ff-input w-full md:w-1/3"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end w-full md:w-auto text-sm">
            <span className="text-xs text-[var(--muted)]">
              Total: <span className="font-semibold text-[var(--text)]">{filteredItems.length}</span> ·
              Seleccionados:{" "}
              <span className="font-semibold" style={{ color: "var(--primary)" }}>
                {selectedIds.length}
              </span>
            </span>

            <button
              type="button"
              onClick={toggleSelectAllFiltered}
              disabled={filteredItems.length === 0}
              className="ff-btn ff-btn-outline ff-btn-sm rounded-full"
            >
              <span className="text-xs">☑️</span>
              {allFilteredSelected ? "Desmarcar todos" : "Marcar todos"}
            </button>

            <button
              type="button"
              onClick={handleExport}
              disabled={selectedIds.length === 0}
              className="ff-btn ff-btn-outline ff-btn-sm rounded-full"
              style={{ borderColor: "color-mix(in srgb, var(--primary) 55%, var(--border-rgba))" }}
            >
              <span className="text-xs">⬇️</span>
              Exportar precios
            </button>

            <label className="ff-btn ff-btn-ghost ff-btn-sm rounded-full cursor-pointer">
              <span className="text-xs">⬆️</span>
              Importar precios
              <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
            </label>
          </div>
        </div>
      </div>

      {/* Lista */}
      <ul className="space-y-3">
        {filteredItems.map((item, idx) => (
          <li
            key={item.id}
            className="p-4 rounded-xl"
            style={{
              background:
                idx % 2 === 0
                  ? "color-mix(in srgb, var(--panel) 60%, transparent)"
                  : "color-mix(in srgb, var(--panel-2) 65%, transparent)",
              border: "var(--border-w) solid var(--border-rgba)",
              boxShadow: "var(--glow-shadow)",
            }}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1">
                <label className="flex items-center gap-2 mb-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded"
                    style={{ accentColor: "var(--primary)" }}
                    checked={selectedIds.includes(item.id)}
                    onChange={() => toggleItemSelection(item.id)}
                  />
                  <span className="font-semibold text-[var(--text)]">
                    {item.name}{" "}
                    <span className="text-sm italic text-[var(--muted)]">
                      {item.category ? `(${item.category})` : ""}
                    </span>
                  </span>
                </label>

                <p className="text-sm text-[var(--muted)]">
                  {item.description || <span className="italic opacity-70">Sin descripción</span>}
                </p>

                <p className="text-xs text-[var(--muted)] mt-1">
                  Impuesto:{" "}
                  {item.tax_name
                    ? item.is_exempt
                      ? "Exento"
                      : `${item.tax_name} (${item.tax_rate}%)`
                    : "No asignado"}
                </p>

                <p className="text-sm text-[var(--muted)] mt-1">
                  Último precio:{" "}
                  {item.latest_price !== null ? formatCurrency(item.latest_price) : "No registrado"}
                </p>
              </div>

              <div className="space-x-3 whitespace-nowrap text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedItem(item);
                    setPrice("");
                    setDate(new Date().toISOString().split("T")[0]);
                    fetchPrices(item.id);
                    setShowPriceModal(true);
                  }}
                  className="underline underline-offset-2"
                  style={{ color: "var(--primary)" }}
                >
                  Ver precios
                </button>

                <button
                  type="button"
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
                  className="underline underline-offset-2"
                  style={{ color: "var(--text)" }}
                >
                  Editar
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setItemToDelete(item);
                    setShowDeleteModal(true);
                  }}
                  className="underline underline-offset-2"
                  style={{ color: "var(--danger)" }}
                >
                  Eliminar
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* Modal editar item */}
      <Modal isOpen={showEditItemModal} onClose={() => setShowEditItemModal(false)} title="Editar artículo">
        {itemToEdit && (
          <form onSubmit={handleEditItem} className="space-y-4">
            <div className="space-y-1">
              <label className="ff-label">Nombre</label>
              <input
                value={itemToEdit.name}
                onChange={(e) => setItemToEdit({ ...itemToEdit, name: e.target.value })}
                className="ff-input"
              />
            </div>

            <div className="space-y-1">
              <label className="ff-label">Categoría</label>
              <input
                value={itemToEdit.category || ""}
                onChange={(e) => setItemToEdit({ ...itemToEdit, category: e.target.value })}
                className="ff-input"
              />
            </div>

            <div className="space-y-1">
              <label className="ff-label">Descripción</label>
              <textarea
                value={itemToEdit.description || ""}
                onChange={(e) => setItemToEdit({ ...itemToEdit, description: e.target.value })}
                className="ff-input"
                rows={3}
                style={{ resize: "none" }}
              />
            </div>

            <div className="space-y-1">
              <label className="ff-label">Impuesto</label>
              <FFSelect
                value={itemToEdit.tax_id || ""}
                onChange={(v) => setItemToEdit({ ...itemToEdit, tax_id: v })}
                options={taxOptions}
                searchable
                clearable={false}
                placeholder="Sin impuesto"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" className="ff-btn ff-btn-primary">
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
        size="lg"
      >
        <form onSubmit={handleAddPrice} className="grid gap-3 mb-5 sm:grid-cols-3">
          <div className="sm:col-span-1 space-y-1">
            <label className="ff-label">Precio</label>
            <input
              type="number"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="ff-input"
              placeholder="0.00"
              required
            />
          </div>

          <div className="sm:col-span-1 space-y-1">
            <label className="ff-label">Fecha</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ff-input" required />
          </div>

          <div className="sm:col-span-1 flex items-end">
            <button type="submit" className="ff-btn ff-btn-primary w-full">
              Agregar
            </button>
          </div>
        </form>

        <div className="max-h-80 overflow-auto rounded-xl">
          <table className="ff-table">
            <thead>
              <tr>
                <th className="ff-th">Fecha</th>
                <th className="ff-th" style={{ textAlign: "right" }}>
                  Precio
                </th>
                <th className="ff-th" style={{ textAlign: "right" }}>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {priceHistory.length === 0 ? (
                <tr>
                  <td className="ff-td" colSpan={3} style={{ color: "var(--muted)" }}>
                    <span className="italic">Sin precios aún.</span>
                  </td>
                </tr>
              ) : (
                priceHistory.map((p) => (
                  <tr key={p.id} className="ff-tr">
                    <td className="ff-td">{p.date}</td>
                    <td className="ff-td" style={{ textAlign: "right", color: "var(--primary)", fontWeight: 700 }}>
                      {formatCurrency(p.price)}
                    </td>
                    <td className="ff-td" style={{ textAlign: "right" }}>
                      <button
                        type="button"
                        onClick={() => handleAskDeletePrice(p)}
                        className="ff-btn ff-btn-danger ff-btn-sm"
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Modal impuestos */}
      <Modal isOpen={showTaxModal} onClose={() => setShowTaxModal(false)} title="Gestión de Impuestos" size="lg">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const name = e.target.name.value;
            const rate = parseFloat(e.target.rate.value);
            const is_exempt = e.target.exempt.checked;

            try {
              await axios.post(`${api}/taxes`, { name, rate, is_exempt }, authHeaders);
              toast.success("Impuesto guardado correctamente");
              fetchTaxes();
              e.target.reset();
            } catch {
              toast.error("Error al guardar impuesto");
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="ff-label">Nombre</label>
            <input name="name" className="ff-input" placeholder="Ej. ITBIS, Selectivo, etc." />
          </div>

          <div className="space-y-1">
            <label className="ff-label">Porcentaje (%)</label>
            <input name="rate" type="number" step="0.01" className="ff-input" placeholder="Ej. 18" />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input name="exempt" type="checkbox" className="h-4 w-4 rounded" style={{ accentColor: "var(--primary)" }} />
            Exento de impuestos
          </label>

          <div className="pt-1 flex justify-end">
            <button type="submit" className="ff-btn ff-btn-primary">
              Guardar
            </button>
          </div>
        </form>

        <div className="mt-5 max-h-72 overflow-auto rounded-xl">
          <table className="ff-table">
            <thead>
              <tr>
                <th className="ff-th">Impuesto</th>
                <th className="ff-th" style={{ textAlign: "right" }}>
                  Tipo
                </th>
                <th className="ff-th" style={{ textAlign: "right" }}>
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {taxes.map((tax) => (
                <tr key={tax.id} className="ff-tr">
                  <td className="ff-td">
                    <span className="font-semibold">{tax.name}</span>
                  </td>
                  <td className="ff-td" style={{ textAlign: "right", color: "var(--muted)" }}>
                    {tax.is_exempt ? "Exento" : `${tax.rate}%`}
                  </td>
                  <td className="ff-td" style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await axios.delete(`${api}/taxes/${tax.id}`, authHeaders);
                          toast.success("Impuesto eliminado");
                          fetchTaxes();
                        } catch {
                          toast.error("Error al eliminar impuesto");
                        }
                      }}
                      className="ff-btn ff-btn-danger ff-btn-sm"
                    >
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {taxes.length === 0 && (
                <tr>
                  <td className="ff-td" colSpan={3} style={{ color: "var(--muted)" }}>
                    <span className="italic">No hay impuestos todavía.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      {/* Modal eliminar artículo */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        title="Eliminar artículo"
      >
        <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
          {itemToDelete ? `¿Seguro que deseas eliminar el artículo "${itemToDelete.name}"?` : ""}
          <br />
          <span className="text-xs opacity-80">Esta acción no se puede deshacer.</span>
        </p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            className="ff-btn ff-btn-danger"
            onClick={async () => {
              await handleDeleteItem(itemToDelete);
              setShowDeleteModal(false);
              setItemToDelete(null);
            }}
          >
            Eliminar
          </button>

          <button
            type="button"
            className="ff-btn ff-btn-outline"
            onClick={() => {
              setShowDeleteModal(false);
              setItemToDelete(null);
            }}
          >
            Cancelar
          </button>
        </div>
      </Modal>

      {/* Modal eliminar precio */}
      <Modal
        isOpen={showDeletePriceModal}
        onClose={() => {
          setShowDeletePriceModal(false);
          setPriceToDelete(null);
        }}
        title="Eliminar precio"
      >
        <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
          {priceToDelete ? (
            <>
              ¿Seguro que deseas eliminar el precio del día{" "}
              <span className="font-semibold text-[var(--text)]">{priceToDelete.date}</span> por{" "}
              <span className="font-semibold text-[var(--text)]">
                {formatCurrency(priceToDelete.price)}
              </span>
              ?
            </>
          ) : (
            ""
          )}
          <br />
          <span className="text-xs opacity-80">Esta acción no se puede deshacer.</span>
        </p>

        <div className="flex justify-end gap-3">
          <button type="button" className="ff-btn ff-btn-danger" onClick={handleConfirmDeletePrice}>
            Eliminar
          </button>

          <button
            type="button"
            className="ff-btn ff-btn-outline"
            onClick={() => {
              setShowDeletePriceModal(false);
              setPriceToDelete(null);
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
