import { useEffect, useMemo, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import axios from "axios";
import { HiDotsVertical } from "react-icons/hi";
import Modal from "../components/Modal";
import FFSelect from "../components/FFSelect";
import ShoppingPlanModal from "../components/ShoppingPlanModal";
import { toast } from "react-toastify";
import {
  createItem,
  createItemPrice,
  createTax,
  deleteItemPriceRecord,
  deleteItemRecord,
  deleteTaxRecord,
  listItemPrices,
  listItems,
  listTaxes,
  syncPendingItems,
  updateItem,
} from "../lib/repositories/itemsRepository";
import { canUsePremiumBackend } from "../lib/subscription/subscriptionAccess";
import { todayDateKey, withUserTimeZone } from "../lib/dates/localDate";
import useClickOutside from "../hooks/useClickOutside";
import useOverflowMenuPosition from "../hooks/useOverflowMenuPosition";

function Items({ token, subscriptionMode }) {
  const [items, setItems] = useState([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [selectedTaxId, setSelectedTaxId] = useState("");
  const [taxes, setTaxes] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [price, setPrice] = useState("");
  const [date, setDate] = useState(() => todayDateKey());
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
  const [showShoppingPlanModal, setShowShoppingPlanModal] = useState(false);
  const [mobileMenuId, setMobileMenuId] = useState(null);
  const mobileMenuRef = useRef(null);

  const api = import.meta.env.VITE_API_URL;
  const isNativeMobile = Capacitor.getPlatform() !== "web";
  const canAccessItemsOnThisDevice = canUsePremiumBackend(subscriptionMode);

  useClickOutside(mobileMenuRef, () => setMobileMenuId(null), Boolean(mobileMenuId));
  const mobileMenuPlacement = useOverflowMenuPosition(
    mobileMenuRef,
    Boolean(mobileMenuId)
  );

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
      const res = await listItems({ token });
      setItems(res.data);
      if (res.source === "cache") {
        toast.info("Mostrando articulos guardados localmente");
      }
    } catch {
      toast.error("Error al cargar articulos");
    }
  };

  const fetchTaxes = async () => {
    try {
      const res = await listTaxes({ token });
      setTaxes(res.data);
    } catch {
      toast.error("Error al cargar impuestos");
    }
  };

  const fetchPrices = async (itemId) => {
    try {
      const res = await listItemPrices({ token, itemId });
      setPriceHistory(res.data);
    } catch {
      toast.error("Error al obtener historial de precios");
    }
  };

  const handleCreateItem = async (e) => {
    e.preventDefault();

    try {
      const result = await createItem({
        token,
        payload: {
          name,
          description,
          category,
          tax_id: selectedTaxId || null,
        },
      });

      setName("");
      setDescription("");
      setCategory("");
      setSelectedTaxId("");

      toast.success(
        result.offline
          ? "Articulo guardado localmente. Se sincronizara luego."
          : "Articulo creado correctamente"
      );
      await fetchItems();
    } catch {
      toast.error("Error al crear articulo");
    }
  };

  const handleEditItem = async (e) => {
    e.preventDefault();

    try {
      const result = await updateItem({
        token,
        item: itemToEdit,
      });

      setItemToEdit(null);
      setShowEditItemModal(false);

      toast.success(
        result.offline
          ? "Articulo actualizado localmente. Se sincronizara luego."
          : "Articulo actualizado correctamente"
      );
      await fetchItems();
    } catch {
      toast.error("Error al editar articulo");
    }
  };

  const handleAddPrice = async (e) => {
    e.preventDefault();
    if (!selectedItem) return;

    const numericPrice = parseFloat(price);
    if (Number.isNaN(numericPrice)) {
      toast.error("Precio invalido");
      return;
    }

    try {
      const result = await createItemPrice({
        token,
        payload: { item_id: selectedItem.id, price: numericPrice, date },
      });

      setPrice("");
      await fetchPrices(selectedItem.id);
      await fetchItems();

      setSelectedItem((prev) =>
        prev ? { ...prev, latest_price: numericPrice } : prev
      );

      toast.success(
        result.offline
          ? "Precio guardado localmente. Se sincronizara luego."
          : "Precio agregado correctamente"
      );
    } catch (err) {
      const code = err?.response?.data?.error;
      const message = err?.response?.data?.message;

      if (code === "DUPLICATE_PRICE_FOR_DATE") {
        toast.error(
          message || "Ya existe un precio para este articulo en esa fecha."
        );
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
      const result = await deleteItemRecord({ token, item });
      toast.success(
        result.offline
          ? "Articulo eliminado localmente. Se sincronizara luego."
          : "Articulo eliminado correctamente"
      );
      setItemToDelete(null);
      setMobileMenuId(null);
      await fetchItems();
    } catch (err) {
      const errorCode = err?.response?.data?.error;
      const message = err?.response?.data?.message;

      if (errorCode === "ITEM_IN_USE") {
        toast.error(
          message ||
            "No se puede eliminar el articulo porque ya se ha usado en transacciones."
        );
      } else {
        toast.error("Error al eliminar articulo");
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
      const result = await deleteItemPriceRecord({
        token,
        itemId: selectedItem.id,
        priceRecord: priceToDelete,
      });

      toast.success(
        result.offline
          ? "Precio eliminado localmente. Se sincronizara luego."
          : "Precio eliminado correctamente"
      );
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
        return prev.filter(
          (id) => !filteredItems.some((item) => item.id === id)
        );
      }

      const nextSet = new Set(prev);
      filteredItems.forEach((item) => nextSet.add(item.id));
      return Array.from(nextSet);
    });
  };

  const handleExport = async () => {
    if (selectedIds.length === 0) {
      toast.error("Debes seleccionar al menos un articulo");
      return;
    }

    try {
      const response = await axios.post(
        `${api}/items-with-price/export-prices`,
        { ids: selectedIds },
        withUserTimeZone({ ...authHeaders, responseType: "blob" })
      );

      const blob = new Blob([response.data], {
        type: "text/csv;charset=utf-8;",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `precios-articulos-${todayDateKey()}.csv`
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
      const res = await axios.post(
        `${api}/items-with-price/import-prices`,
        formData,
        withUserTimeZone({
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        })
      );

      toast.success(
        `Importacion completada. Filas insertadas: ${res.data.inserted}`
      );
      await fetchItems();
    } catch (error) {
      console.error(error);
      toast.error("Error al importar archivo de precios");
    } finally {
      e.target.value = "";
    }
  };

  useEffect(() => {
    if (!token || !canAccessItemsOnThisDevice) return;
    fetchItems();
    fetchTaxes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canAccessItemsOnThisDevice]);

  useEffect(() => {
    if (!token || !canAccessItemsOnThisDevice) return;

    const runSync = async () => {
      const result = await syncPendingItems({ token, subscriptionMode });
      if (result.synced > 0) {
        await Promise.all([fetchItems(), fetchTaxes()]);
        toast.success(`Se sincronizaron ${result.synced} cambios de articulos`);
      }
    };

    runSync();

    const handleOnline = () => {
      runSync();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, canAccessItemsOnThisDevice, subscriptionMode]);

  const taxOptions = useMemo(() => {
    const base = [{ value: "", label: "Sin impuesto" }];
    const mapped = taxes.map((tax) => ({
      value: tax.id,
      label: `${tax.name} (${tax.is_exempt ? "Exento" : `${tax.rate}%`})`,
    }));
    return [...base, ...mapped];
  }, [taxes]);

  const openPricesModal = (item) => {
    setSelectedItem(item);
    setPrice("");
    setDate(todayDateKey());
    fetchPrices(item.id);
    setShowPriceModal(true);
    setMobileMenuId(null);
  };

  const openEditModal = (item) => {
    setItemToEdit({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      tax_id: item.tax_id,
    });
    setShowEditItemModal(true);
    setMobileMenuId(null);
  };

  const openDeleteModal = (item) => {
    setItemToDelete(item);
    setShowDeleteModal(true);
    setMobileMenuId(null);
  };

  if (!canAccessItemsOnThisDevice) {
    return null;
  }

  return (
    <div className="ff-card p-4 md:p-6">
      <h2 className="ff-h1 ff-heading-accent mb-2">Articulos</h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        Registra productos y controla como varian sus precios a lo largo del
        tiempo.
      </p>

      <button
        type="button"
        className="text-sm underline underline-offset-2 mb-4"
        style={{ color: "var(--primary)" }}
        onClick={() => setShowTaxModal(true)}
      >
        Administrar impuestos
      </button>

      <form
        onSubmit={handleCreateItem}
        className="grid gap-4 mb-6 md:grid-cols-3"
      >
        <div className="flex flex-col space-y-1">
          <label className="ff-label uppercase font-semibold">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ff-input"
            required
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label uppercase font-semibold">Categoria</label>
          <input
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="ff-input"
          />
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
          <label className="ff-label uppercase font-semibold">Descripcion</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="ff-input"
          />
        </div>

        <div className="md:col-span-3">
          <button type="submit" className="ff-btn ff-btn-primary w-full sm:w-auto">
            Agregar articulo
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-3 mb-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            type="text"
            placeholder="Buscar articulo..."
            className="ff-input w-full md:w-1/3"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-3 justify-between md:justify-end w-full md:w-auto text-sm">
            <span className="text-xs text-[var(--muted)]">
              Total:{" "}
              <span className="font-semibold text-[var(--text)]">
                {filteredItems.length}
              </span>
              {!isNativeMobile && (
                <>
                  {" "}· Seleccionados:{" "}
                  <span
                    className="font-semibold"
                    style={{ color: "var(--primary)" }}
                  >
                    {selectedIds.length}
                  </span>
                </>
              )}
            </span>

            <button
              type="button"
              onClick={() => setShowShoppingPlanModal(true)}
              disabled={items.length === 0}
              className="ff-btn ff-btn-primary ff-btn-sm rounded-full"
            >
              Plan de compra
            </button>

            {!isNativeMobile && (
              <>
                <button
                  type="button"
                  onClick={toggleSelectAllFiltered}
                  disabled={filteredItems.length === 0}
                  className="ff-btn ff-btn-outline ff-btn-sm rounded-full"
                >
                  {allFilteredSelected ? "Desmarcar todos" : "Marcar todos"}
                </button>

                <button
                  type="button"
                  onClick={handleExport}
                  disabled={selectedIds.length === 0}
                  className="ff-btn ff-btn-outline ff-btn-sm rounded-full"
                >
                  Exportar precios
                </button>

                <label className="ff-btn ff-btn-ghost ff-btn-sm rounded-full cursor-pointer">
                  Importar precios
                  <input
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleImport}
                  />
                </label>
              </>
            )}
          </div>
        </div>
      </div>

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
              <div className="min-w-0 flex-1">
                <label className="flex items-center gap-2 mb-1">
                  {!isNativeMobile && (
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded"
                      style={{ accentColor: "var(--primary)" }}
                      checked={selectedIds.includes(item.id)}
                      onChange={() => toggleItemSelection(item.id)}
                    />
                  )}
                  <span className="font-semibold text-[var(--text)]">
                    {item.name}{" "}
                    <span className="text-sm italic text-[var(--muted)]">
                      {item.category ? `(${item.category})` : ""}
                    </span>
                  </span>
                </label>

                <p className="text-sm text-[var(--muted)]">
                  {item.description || (
                    <span className="italic opacity-70">Sin descripcion</span>
                  )}
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
                  Ultimo precio:{" "}
                  {item.latest_price !== null
                    ? formatCurrency(item.latest_price)
                    : "No registrado"}
                </p>

                <p className="text-xs text-[var(--muted)] mt-1">
                  Estado: {item.sync_status ? "Pendiente" : "Sincronizado"}
                </p>
              </div>

              {!isNativeMobile ? (
                <div className="space-x-3 whitespace-nowrap text-sm">
                  <button
                    type="button"
                    onClick={() => openPricesModal(item)}
                    className="underline underline-offset-2"
                    style={{ color: "var(--primary)" }}
                  >
                    Ver precios
                  </button>

                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="underline underline-offset-2"
                    style={{ color: "var(--text)" }}
                  >
                    Editar
                  </button>

                  <button
                    type="button"
                    onClick={() => openDeleteModal(item)}
                    className="underline underline-offset-2"
                    style={{ color: "var(--danger)" }}
                  >
                    Eliminar
                  </button>
                </div>
              ) : (
                <div
                  ref={mobileMenuId === item.id ? mobileMenuRef : null}
                  className="relative self-start"
                >
                  <button
                    type="button"
                    data-overflow-trigger="true"
                    aria-label="Acciones"
                    onClick={() =>
                      setMobileMenuId((prev) =>
                        prev === item.id ? null : item.id
                      )
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                      background:
                        "color-mix(in srgb, var(--panel) 92%, transparent)",
                      color: "var(--text)",
                    }}
                  >
                    <HiDotsVertical size={18} />
                  </button>

                  {mobileMenuId === item.id && (
                    <div
                      data-overflow-menu="true"
                      className="absolute right-0 top-12 z-10 min-w-[180px] rounded-[var(--radius-md)] border p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                      style={{
                        top: mobileMenuPlacement === "up" ? "auto" : "3rem",
                        bottom: mobileMenuPlacement === "up" ? "3rem" : "auto",
                        borderColor:
                          "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                        background:
                          "color-mix(in srgb, var(--panel) 96%, transparent)",
                      }}
                    >
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          onClick={() => openPricesModal(item)}
                          className="ff-btn ff-btn-primary w-full"
                        >
                          Ver precios
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          className="ff-btn ff-btn-outline w-full"
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          onClick={() => openDeleteModal(item)}
                          className="ff-btn ff-btn-danger w-full"
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <ShoppingPlanModal
        isOpen={showShoppingPlanModal}
        onClose={() => setShowShoppingPlanModal(false)}
        items={items}
        selectedIds={selectedIds}
      />

      <Modal
        isOpen={showEditItemModal}
        onClose={() => setShowEditItemModal(false)}
        title="Editar articulo"
      >
        {itemToEdit && (
          <form onSubmit={handleEditItem} className="space-y-4">
            <div className="space-y-1">
              <label className="ff-label">Nombre</label>
              <input
                value={itemToEdit.name}
                onChange={(e) =>
                  setItemToEdit({ ...itemToEdit, name: e.target.value })
                }
                className="ff-input"
              />
            </div>

            <div className="space-y-1">
              <label className="ff-label">Categoria</label>
              <input
                value={itemToEdit.category || ""}
                onChange={(e) =>
                  setItemToEdit({ ...itemToEdit, category: e.target.value })
                }
                className="ff-input"
              />
            </div>

            <div className="space-y-1">
              <label className="ff-label">Descripcion</label>
              <textarea
                value={itemToEdit.description || ""}
                onChange={(e) =>
                  setItemToEdit({
                    ...itemToEdit,
                    description: e.target.value,
                  })
                }
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
              <button
                type="submit"
                className="ff-btn ff-btn-primary w-full sm:w-auto"
              >
                Guardar cambios
              </button>
            </div>
          </form>
        )}
      </Modal>

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
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="ff-input"
              required
            />
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
                  Estado
                </th>
                <th className="ff-th" style={{ textAlign: "right" }}>
                  Accion
                </th>
              </tr>
            </thead>
            <tbody>
              {priceHistory.length === 0 ? (
                <tr>
                  <td
                    className="ff-td"
                    colSpan={4}
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="italic">Sin precios aun.</span>
                  </td>
                </tr>
              ) : (
                priceHistory.map((p) => (
                  <tr key={p.id} className="ff-tr">
                    <td className="ff-td">{p.date}</td>
                    <td
                      className="ff-td"
                      style={{
                        textAlign: "right",
                        color: "var(--primary)",
                        fontWeight: 700,
                      }}
                    >
                      {formatCurrency(p.price)}
                    </td>
                    <td
                      className="ff-td"
                      style={{ textAlign: "right", color: "var(--muted)" }}
                    >
                      {p.sync_status ? "Pendiente" : "Sincronizado"}
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

      <Modal
        isOpen={showTaxModal}
        onClose={() => setShowTaxModal(false)}
        title="Gestion de Impuestos"
        size="lg"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const nameValue = e.target.name.value;
            const rate = parseFloat(e.target.rate.value);
            const isExempt = e.target.exempt.checked;

            try {
              const result = await createTax({
                token,
                payload: { name: nameValue, rate, is_exempt: isExempt },
              });
              toast.success(
                result.offline
                  ? "Impuesto guardado localmente. Se sincronizara luego."
                  : "Impuesto guardado correctamente"
              );
              await fetchTaxes();
              e.target.reset();
            } catch {
              toast.error("Error al guardar impuesto");
            }
          }}
          className="space-y-4"
        >
          <div className="space-y-1">
            <label className="ff-label">Nombre</label>
            <input
              name="name"
              className="ff-input"
              placeholder="Ej. ITBIS, Selectivo, etc."
            />
          </div>

          <div className="space-y-1">
            <label className="ff-label">Porcentaje (%)</label>
            <input
              name="rate"
              type="number"
              step="0.01"
              className="ff-input"
              placeholder="Ej. 18"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
            <input
              name="exempt"
              type="checkbox"
              className="h-4 w-4 rounded"
              style={{ accentColor: "var(--primary)" }}
            />
            Exento de impuestos
          </label>

          <div className="pt-1 flex justify-end">
            <button
              type="submit"
              className="ff-btn ff-btn-primary w-full sm:w-auto"
            >
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
                  Estado
                </th>
                <th className="ff-th" style={{ textAlign: "right" }}>
                  Accion
                </th>
              </tr>
            </thead>
            <tbody>
              {taxes.map((tax) => (
                <tr key={tax.id} className="ff-tr">
                  <td className="ff-td">
                    <span className="font-semibold">{tax.name}</span>
                  </td>
                  <td
                    className="ff-td"
                    style={{ textAlign: "right", color: "var(--muted)" }}
                  >
                    {tax.is_exempt ? "Exento" : `${tax.rate}%`}
                  </td>
                  <td
                    className="ff-td"
                    style={{ textAlign: "right", color: "var(--muted)" }}
                  >
                    {tax.sync_status ? "Pendiente" : "Sincronizado"}
                  </td>
                  <td className="ff-td" style={{ textAlign: "right" }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const result = await deleteTaxRecord({ token, tax });
                          toast.success(
                            result.offline
                              ? "Impuesto eliminado localmente. Se sincronizara luego."
                              : "Impuesto eliminado"
                          );
                          await fetchTaxes();
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
                  <td
                    className="ff-td"
                    colSpan={4}
                    style={{ color: "var(--muted)" }}
                  >
                    <span className="italic">No hay impuestos todavia.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setItemToDelete(null);
        }}
        title="Eliminar articulo"
      >
        <p className="text-sm text-[var(--muted)] mb-6 leading-relaxed">
          {itemToDelete
            ? `Seguro que deseas eliminar el articulo "${itemToDelete.name}"?`
            : ""}
          <br />
          <span className="text-xs opacity-80">
            Esta accion no se puede deshacer.
          </span>
        </p>

        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <button
            type="button"
            className="ff-btn ff-btn-danger w-full sm:w-auto"
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
            className="ff-btn ff-btn-outline w-full sm:w-auto"
            onClick={() => {
              setShowDeleteModal(false);
              setItemToDelete(null);
            }}
          >
            Cancelar
          </button>
        </div>
      </Modal>

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
              Seguro que deseas eliminar el precio del dia{" "}
              <span className="font-semibold text-[var(--text)]">
                {priceToDelete.date}
              </span>{" "}
              por{" "}
              <span className="font-semibold text-[var(--text)]">
                {formatCurrency(priceToDelete.price)}
              </span>
              ?
            </>
          ) : (
            ""
          )}
          <br />
          <span className="text-xs opacity-80">
            Esta accion no se puede deshacer.
          </span>
        </p>

        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
          <button
            type="button"
            className="ff-btn ff-btn-danger w-full sm:w-auto"
            onClick={handleConfirmDeletePrice}
          >
            Eliminar
          </button>

          <button
            type="button"
            className="ff-btn ff-btn-outline w-full sm:w-auto"
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
