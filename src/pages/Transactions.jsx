import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal"; // ajusta la ruta según tu estructura
import ImportShoppingListModal from "../components/ImportShoppingListModal";
import ShoppingListQuickModal from "../components/ShoppingListQuickModal";
import FFSelect from "../components/FFSelect";

function Transactions({ token }) {
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );

  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);

  const [isShoppingList, setIsShoppingList] = useState(false);
  const [articleLines, setArticleLines] = useState([
    { item_id: "", quantity: 1 },
  ]);
  const [discount, setDiscount] = useState(0);

  const [recurrence, setRecurrence] = useState("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  // Modal Lista de compras
  const [showImportShoppingModal, setShowImportShoppingModal] = useState(false);

  // Modal de detalle de lista de compras
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedTxItems, setSelectedTxItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);

  // Filtros
  const [filterDescription, setFilterDescription] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");

  // Fecha desde: 1er día del mes actual
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    return `${year}-${month}-01`;
  });

  // Fecha hasta: hoy
  const [filterDateTo, setFilterDateTo] = useState(() => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  });

  //Editar
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    type: "expense",
    account_id: "",
    category_id: "",
    description: "",
    date: "",
  });

  const [showQuickShoppingModal, setShowQuickShoppingModal] = useState(false);

  const api = import.meta.env.VITE_API_URL;

  const fetchTransactions = async (customFilters) => {
    try {
      // Si viene un event (onClick directo), lo ignoramos
      if (customFilters && customFilters.nativeEvent) {
        customFilters = undefined;
      }

      const {
        description = filterDescription,
        type = filterType,
        accountId = filterAccountId,
        categoryId = filterCategoryId,
        dateFrom = filterDateFrom,
        dateTo = filterDateTo,
      } = customFilters || {};

      const params = {};

      if (description.trim()) params.description = description.trim();
      if (type && type !== "all") params.type = type;
      if (accountId) params.account_id = accountId;
      if (categoryId) params.category_id = categoryId;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await axios.get(`${api}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setTransactions(res.data.data || []);
    } catch (err) {
      console.error("Error cargando transacciones:", err);
      alert("Error cargando transacciones");
    }
  };

  const fetchInitialData = async () => {
    try {
      const [accRes, catRes, itemRes] = await Promise.all([
        axios.get(`${api}/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${api}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${api}/items-with-price`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setAccounts(accRes.data.data);
      setCategories(catRes.data.data);
      setItems(itemRes.data.data);

      // 🔁 carga inicial de transacciones con rango por defecto (1er día del mes → hoy)
      await fetchTransactions();
    } catch (err) {
      console.error("Error cargando datos iniciales:", err);
      alert("Error cargando datos iniciales");
    }
  };

  const openDetail = async (tx) => {
    setSelectedTx(tx);
    setIsDetailOpen(true);
    setSelectedTxItems([]);
    setIsLoadingItems(true);

    try {
      const res = await axios.get(`${api}/transactions/${tx.id}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTxItems(res.data.data || []);
    } catch (err) {
      console.error("Error cargando items de la transacción:", err);
      alert("No se pudieron cargar los artículos de esta compra");
    } finally {
      setIsLoadingItems(false);
    }
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedTx(null);
    setSelectedTxItems([]);
  };

  useEffect(() => {
    if (token) fetchInitialData();
  }, [token]);

  // Recalcular total cuando es lista de compra
  useEffect(() => {
    if (isShoppingList && items.length > 0) {
      console.log("🔄 Recalculando total de compra...");

      let total = articleLines.reduce((sum, line, index) => {
        const item = items.find((i) => i.id === line.item_id);
        if (!item) {
          console.warn(`❌ Línea ${index + 1}: artículo no encontrado`, line);
          return sum;
        }

        const price = item.latest_price || 0;
        const qty = parseFloat(line.quantity) || 1;
        const isExempt = item.is_exempt;
        const taxRate = parseFloat(item.tax_rate || 0);

        const subtotal = price * qty;
        const taxAmount = isExempt ? 0 : subtotal * (taxRate / 100);
        const lineTotal = subtotal + taxAmount;

        setRecurrence("");
    setRecurrenceEndDate("");

        console.log(`🧾 Línea ${index + 1}:`);
        console.log(`  Artículo: ${item.name}`);
        console.log(`  Precio: ${price}`);
        console.log(`  Cantidad: ${qty}`);
        console.log(`  Subtotal: ${subtotal}`);
        console.log(
          `  ITBIS: ${isExempt ? "exento" : `${taxRate}% → ${taxAmount}`}`
        );
        console.log(`  Total línea: ${lineTotal}`);

        return sum + lineTotal;
      }, 0);

      if (discount > 0) {
        console.log("💸 Descuento aplicado:", discount);
        total = total * (1 - discount / 100);
      }

      console.log(`✅ Total final con impuestos: ${total.toFixed(2)}`);
      setAmount(total.toFixed(2));
    }
  }, [articleLines, isShoppingList, items, discount]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isShoppingList) {
      alert(
        "Para listas de compra usa el botón 'Agregar artículos (modal)' o importa desde archivo."
      );
      return;
    }

    if (!amount || !accountId || !categoryId || !date) {
      alert("Completa todos los campos");
      return;
    }

    try {
      await axios.post(
        `${api}/transactions`,
        {
          amount: parseFloat(amount),
          account_id: accountId,
          category_id: categoryId,
          type,
          description,
          date,
          recurrence: recurrence || null,
          recurrence_end_date: recurrenceEndDate || null,
          items: isShoppingList ? articleLines : [],
          discount: isShoppingList ? discount : 0,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setAmount("");
      setDescription("");
      setArticleLines([{ item_id: "", quantity: 1 }]);
      setRecurrence("");
      setRecurrenceEndDate("");
      setIsShoppingList(false);
      setDiscount(0);
      await fetchTransactions();
    } catch (err) {
      console.error("Error al crear transacción:", err);
      alert("Error al crear transacción");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    try {
      await axios.delete(`${api}/transactions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchTransactions();
    } catch (err) {
      console.error("Error al eliminar transacción:", err);
      alert("Error al eliminar");
    }
  };

  // Limpiar categoría de filtro si no corresponde al tipo
  useEffect(() => {
    const selectedCategory = categories.find((c) => c.id === filterCategoryId);

    if (!selectedCategory) {
      setFilterCategoryId("");
      return;
    }

    if (filterType === "expense" && selectedCategory.type !== "expense") {
      setFilterCategoryId("");
    }
    if (filterType === "income" && selectedCategory.type !== "income") {
      setFilterCategoryId("");
    }
    if (filterType === "transfer") {
      setFilterCategoryId("");
    }
  }, [filterType, categories, filterCategoryId]);

  //editar tranx
  const openEdit = (tx) => {
    setEditingTx(tx);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingTx(null);
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };

      // 💡 Si cambió el tipo, verificamos si la categoría sigue siendo válida
      if (field === "type") {
        const currentCategory = categories.find(
          (c) => c.id === prev.category_id
        );

        // Si la categoría actual existe y su type NO coincide con el nuevo tipo → la limpiamos
        if (currentCategory && currentCategory.type !== value) {
          next.category_id = "";
        }
      }

      return next;
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;

    try {
      const isShoppingListTx = editingTx.is_shopping_list === true;

      const payload = {
        // siempre podemos cambiar estos:
        account_id: editForm.account_id,
        category_id: editForm.category_id,
        description: editForm.description,
        date: editForm.date,
        recurrence: editingTx.recurrence || null,
        recurrence_end_date: editingTx.recurrence_end_date || null,
      };

      // solo si NO es lista de compras permitimos editar monto y tipo
      if (!isShoppingListTx) {
        payload.amount = parseFloat(editForm.amount || 0);
        payload.type = editForm.type;
      }

      await axios.put(`${api}/transactions/${editingTx.id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      await fetchTransactions();
      closeEdit();
    } catch (err) {
      console.error("Error al actualizar transacción:", err);
      alert("Error al actualizar transacción");
    }
  };

  useEffect(() => {
    if (editingTx) {
      setEditForm({
        amount: Number(editingTx.amount || 0).toFixed(2),
        type: editingTx.type,
        account_id: editingTx.account_id || "",
        category_id: editingTx.category_id || "",
        description: editingTx.description || "",
        date: editingTx.date || new Date().toISOString().split("T")[0],
      });
    }
  }, [editingTx]);

  const handleExport = async () => {
    try {
      // construimos params igual que fetchTransactions (sin nulls)
      const params = {};
      if (filterDescription.trim())
        params.description = filterDescription.trim();
      if (filterType && filterType !== "all") params.type = filterType;
      if (filterAccountId) params.account_id = filterAccountId;
      if (filterCategoryId) params.category_id = filterCategoryId;

      // IMPORTANTE: tus defaults SIEMPRE tienen valor → se mandan
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;

      const res = await axios.get(`${api}/transactions/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: "blob",
      });

      // descargar blob
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const name = `transacciones_${filterDateFrom || "all"}_a_${
        filterDateTo || "all"
      }.xlsx`;
      a.download = name;

      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exportando:", err);
      alert("No se pudo exportar el archivo");
    }
  };

  return (
    <div className="ff-card p-6 space-y-6">
      <div>
        <h2 className="ff-h2 mb-1">
          <span className="ff-heading-accent">Transacciones</span>
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Registra tus ingresos y gastos, o marca como lista de compra para
          asociar artículos.
        </p>
      </div>

      {/* Formulario principal */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3"
      >
        <div
          className="col-span-full space-y-3 py-3 px-4 rounded-xl border"
          style={{
            background: "color-mix(in srgb, var(--panel) 70%, transparent)",
            borderColor: "var(--border-rgba)",
            borderWidth: "var(--border-w)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          {/* Checkbox principal */}
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isShoppingList}
              onChange={(e) => setIsShoppingList(e.target.checked)}
              className="h-4 w-4 rounded"
              style={{
                accentColor: "var(--primary)",
              }}
            />
            <span className="text-sm font-medium text-[var(--text)]">
              Esta transacción es una{" "}
              <span style={{ color: "var(--primary)" }}>lista de compra</span>
            </span>
          </label>

          {/* Lista de compra */}
          {isShoppingList && (
            <div className="pl-7 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickShoppingModal(true)}
                  className="ff-btn ff-btn-primary"
                >
                  <span className="text-base">🛒</span>
                  <span>Crear lista de compra</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportShoppingModal(true)}
                  className="ff-btn"
                  style={{
                    // “secundario” sin inventar un variant nuevo
                    background:
                      "color-mix(in srgb, var(--panel) 88%, var(--bg-1))",
                    borderColor:
                      "color-mix(in srgb, var(--primary) 25%, var(--border-rgba))",
                  }}
                >
                  <span className="text-base">📥</span>
                  <span>Importar lista de compra desde archivo</span>
                </button>
              </div>

              <p className="text-xs text-[var(--muted)]">
                Puedes crear la lista desde el modal o importar desde CSV.
              </p>
            </div>
          )}
        </div>

        {/* Monto */}
        <div className="flex flex-col space-y-1">
          <label className="ff-label">Monto</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            readOnly={isShoppingList}
            className="ff-input"
            style={
              isShoppingList
                ? {
                    opacity: 0.65,
                    cursor: "not-allowed",
                    background:
                      "color-mix(in srgb, var(--control-bg) 70%, transparent)",
                  }
                : undefined
            }
            required
          />
        </div>

        {/* Tipo (FFSelect) */}
        <div className="flex flex-col space-y-1">
          <label className="ff-label">Tipo</label>
          <FFSelect
            value={type}
            onChange={(v) => setType(v)}
            options={[
              { value: "expense", label: "Gasto" },
              { value: "income", label: "Ingreso" },
            ]}
            placeholder="Selecciona..."
            className=""
          />
        </div>

        {/* Fecha */}
        <div className="flex flex-col space-y-1">
          <label className="ff-label">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="ff-input"
            required
          />
        </div>

        {/* Cuenta (FFSelect) */}
        <div className="flex flex-col space-y-1">
          <label className="ff-label">Cuenta</label>
          <FFSelect
            value={accountId}
            onChange={(v) => setAccountId(v)}
            options={accounts}
            placeholder="Selecciona una cuenta"
            getOptionValue={(acc) => acc.id}
            getOptionLabel={(acc) => acc.name}
          />
        </div>

        {/* Categoría (FFSelect) */}
        <div className="flex flex-col space-y-1">
          <label className="ff-label">Categoría</label>
          <FFSelect
            value={categoryId}
            onChange={(v) => setCategoryId(v)}
            options={categories.filter((c) => c.type === type)}
            placeholder="Selecciona una categoría"
            getOptionValue={(cat) => cat.id}
            getOptionLabel={(cat) => cat.name}
          />
        </div>

        {/* Recurrencia (FFSelect) */}
        <div className="flex flex-col space-y-1">
          <label className="ff-label">Repetir</label>
          <FFSelect
            value={recurrence}
            disabled={isShoppingList}
            onChange={(v) => {
              setRecurrence(v);
              if (!v) setRecurrenceEndDate("");
            }}
            options={[
              { value: "", label: "Una vez" },
              { value: "monthly", label: "Mensual" },
              { value: "biweekly", label: "Quincenal" },
              { value: "weekly", label: "Semanal" },
            ]}
            clearable={false}
          />
        </div>

        {recurrence && (
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Repetir hasta</label>
            <input
              type="date"
              value={recurrenceEndDate}
              onChange={(e) => setRecurrenceEndDate(e.target.value)}
              className="ff-input"
            />
          </div>
        )}

        {/* Descuento */}
        {isShoppingList && (
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Descuento (%)</label>
            <input
              type="number"
              value={discount}
              min="0"
              max="100"
              step="0.01"
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="ff-input"
              placeholder="Ej. 5"
            />
          </div>
        )}

        {/* Descripción */}
        <div className="flex flex-col md:col-span-3 space-y-1">
          <label className="ff-label">Descripción</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ejemplo: compra supermercado"
            className="ff-input"
          />
        </div>

        <div className="md:col-span-3 mt-2">
          <button type="submit" className="ff-btn ff-btn-primary w-full">
            Agregar transacción
          </button>
        </div>
      </form>

      {/* Filtros */}
      <div className="ff-surface p-4">
        <h3 className="text-sm font-semibold text-[var(--text)] mb-3">
          Filtros
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Descripción */}
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Descripción</label>
            <input
              type="text"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              className="ff-input"
              placeholder="Buscar por descripción"
            />
          </div>

          {/* Tipo */}
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Tipo</label>
            <FFSelect
              value={filterType}
              onChange={(v) => setFilterType(v)}
              options={[
                { value: "all", label: "Todos" },
                { value: "expense", label: "Gasto" },
                { value: "income", label: "Ingreso" },
                { value: "transfer", label: "Transferencia" },
              ]}
              clearable={false}
            />
          </div>

          {/* Categoría */}
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Categoría</label>
            <FFSelect
              value={filterCategoryId}
              onChange={(v) => setFilterCategoryId(v)}
              options={categories.filter((cat) => {
                if (filterType === "all") return true;
                if (filterType === "transfer") return false;
                return cat.type === filterType;
              })}
              placeholder="Todas"
              getOptionValue={(cat) => cat.id}
              getOptionLabel={(cat) => cat.name}
              disabled={filterType === "transfer"}
            />
          </div>

          {/* Cuenta */}
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Cuenta</label>
            <FFSelect
              value={filterAccountId}
              onChange={(v) => setFilterAccountId(v)}
              options={accounts}
              placeholder="Todas"
              getOptionValue={(acc) => acc.id}
              getOptionLabel={(acc) => acc.name}
            />
          </div>

          {/* Desde */}
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Desde</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="ff-input"
            />
          </div>

          {/* Hasta */}
          <div className="flex flex-col space-y-1">
            <label className="ff-label">Hasta</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="ff-input"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => fetchTransactions()}
            className="ff-btn ff-btn-primary w-full sm:w-auto"
          >
            Buscar
          </button>

          <button
            type="button"
            onClick={() => {
              const today = new Date();
              const year = today.getFullYear();
              const month = String(today.getMonth() + 1).padStart(2, "0");
              const day = String(today.getDate()).padStart(2, "0");

              const newDateFrom = `${year}-${month}-01`;
              const newDateTo = `${year}-${month}-${day}`;

              setFilterDescription("");
              setFilterType("all");
              setFilterAccountId("");
              setFilterCategoryId("");
              setFilterDateFrom(newDateFrom);
              setFilterDateTo(newDateTo);

              fetchTransactions({
                description: "",
                type: "all",
                accountId: "",
                categoryId: "",
                dateFrom: newDateFrom,
                dateTo: newDateTo,
              });
            }}
            className="ff-btn ff-btn-outline w-full sm:w-auto"
          >
            Limpiar filtros
          </button>

          <button
            type="button"
            onClick={handleExport}
            className="ff-btn w-full sm:w-auto"
          >
            Exportar Excel
          </button>
        </div>
      </div>

      {/* Historial */}
      <div>
        <h3 className="text-lg font-semibold text-[var(--text)] mb-3">
          Historial reciente
        </h3>

        <ul className="space-y-3">
          {transactions.map((tx) => {
            const isShoppingListTx = tx.is_shopping_list === true;
            const amountColor =
              tx.type === "income"
                ? "var(--success)"
                : tx.type === "expense"
                ? "var(--danger)"
                : "var(--text)";

            return (
              <li
                key={tx.id}
                className="ff-surface p-4 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
                style={{ boxShadow: "var(--tx-item-shadow)" }}
              >
                <div>
                  <p className="text-sm font-semibold text-[var(--text)] flex flex-wrap items-center gap-2">
                    <span style={{ color: amountColor }}>
                      {tx.type === "income"
                        ? "+"
                        : tx.type === "expense"
                        ? "-"
                        : ""}
                      {Number(tx.amount).toFixed(2)} DOP
                    </span>

                    <span className="text-[var(--text)]">
                      —{" "}
                      {tx.type === "transfer"
                        ? "Transferencia"
                        : tx.categories?.name || "Sin categoría"}
                    </span>

                    {isShoppingListTx && (
                      <button
                        type="button"
                        onClick={() => openDetail(tx)}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border"
                        style={{
                          borderColor:
                            "color-mix(in srgb, var(--primary) 35%, var(--border-rgba))",
                          background:
                            "color-mix(in srgb, var(--primary) 12%, transparent)",
                          color: "var(--text)",
                        }}
                        title="Ver detalle de la lista de compra"
                      >
                        <span className="mr-1">🛒</span>
                        Lista de compra
                      </button>
                    )}
                  </p>

                  <p className="text-sm text-[var(--muted)] mt-1">
                    {tx.description || "Sin descripción"} —{" "}
                    {tx.type === "transfer"
                      ? `${tx.account_from?.name || "¿?"} → ${
                          tx.account_to?.name || "¿?"
                        }`
                      : tx.account?.name || "Sin cuenta"}{" "}
                    — {tx.date}
                  </p>
                </div>

                <div className="flex gap-3">
                  {tx.type !== "transfer" && (
                    <button
                      onClick={() => openEdit(tx)}
                      className="text-sm font-semibold"
                      style={{ color: "var(--link)" }}
                    >
                      Editar
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="text-sm font-semibold"
                    style={{ color: "var(--danger)" }}
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Modal detalle lista de compra */}
      <Modal
        isOpen={isDetailOpen}
        onClose={closeDetail}
        title={
          selectedTx
            ? `Detalle de compra — ${selectedTx.date}`
            : "Detalle de compra"
        }
        size="lg"
      >
        {!selectedTx ? (
          <p className="text-sm text-[var(--muted)]">Cargando...</p>
        ) : (
          <div className="space-y-6" style={{ color: "var(--text)" }}>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.18em]"
                  style={{
                    color: "color-mix(in srgb, var(--muted) 75%, transparent)",
                  }}
                >
                  Resumen de la transacción
                </p>

                <p
                  className="mt-1 text-2xl font-extrabold leading-tight"
                  style={{ color: "var(--primary)" }}
                >
                  {Number(selectedTx.amount).toFixed(2)} DOP
                </p>

                {selectedTx.discount_percent > 0 && (
                  <p
                    className="text-sm mt-1 flex items-center gap-1"
                    style={{ color: "var(--primary)" }}
                  >
                    <span className="text-[11px]">🔖</span>
                    Descuento aplicado:{" "}
                    <span className="font-semibold">
                      {selectedTx.discount_percent}%
                    </span>
                  </p>
                )}

                <p className="mt-2 text-sm text-[var(--muted)]">
                  {selectedTx.description || "Sin descripción"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                {[
                  { icon: "📅", label: "Fecha", value: selectedTx.date },
                  {
                    icon: "💼",
                    label: "Cuenta",
                    value: selectedTx.account?.name || "Sin cuenta",
                  },
                ].map((pill) => (
                  <span
                    key={pill.label}
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
                    style={{
                      borderColor: "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--panel) 75%, transparent)",
                      color: "var(--text)",
                    }}
                  >
                    <span className="text-[13px]">{pill.icon}</span>
                    <span
                      className="font-semibold uppercase tracking-[0.16em]"
                      style={{ color: "var(--muted)" }}
                    >
                      {pill.label}
                    </span>
                    <span className="text-sm">{pill.value}</span>
                  </span>
                ))}

                {selectedTx.categories && (
                  <span
                    className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--primary) 45%, var(--border-rgba))",
                      background:
                        "color-mix(in srgb, var(--primary) 12%, transparent)",
                      color: "var(--text)",
                    }}
                  >
                    <span className="text-[13px]">🏷️</span>
                    <span
                      className="font-semibold uppercase tracking-[0.16em]"
                      style={{
                        color:
                          "color-mix(in srgb, var(--text) 85%, transparent)",
                      }}
                    >
                      Categoría
                    </span>
                    <span className="text-sm">
                      {selectedTx.categories.name}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <hr
              style={{
                borderColor:
                  "color-mix(in srgb, var(--border-rgba) 70%, transparent)",
              }}
            />

            {/* Tabla de artículos */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-[var(--text)] flex items-center gap-2">
                  <span className="text-[15px]">🛒</span>
                  <span>Artículos comprados</span>
                </h4>

                {selectedTxItems.length > 0 && (
                  <span className="text-[11px] text-[var(--muted)]">
                    {selectedTxItems.length} ítem
                    {selectedTxItems.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {isLoadingItems && (
                <p className="text-sm text-[var(--muted)] italic">
                  Cargando artículos...
                </p>
              )}
              {!isLoadingItems && selectedTxItems.length === 0 && (
                <p className="text-sm text-[var(--muted)] italic">
                  No hay artículos asociados a esta transacción.
                </p>
              )}

              {!isLoadingItems && selectedTxItems.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="ff-table text-sm">
                    <thead>
                      <tr>
                        <th className="ff-th">#</th>
                        <th className="ff-th">Artículo</th>
                        <th className="ff-th" style={{ textAlign: "center" }}>
                          Cantidad
                        </th>
                        <th className="ff-th" style={{ textAlign: "right" }}>
                          Precio unit.
                        </th>
                        <th className="ff-th" style={{ textAlign: "center" }}>
                          ITBIS
                        </th>
                        <th className="ff-th" style={{ textAlign: "right" }}>
                          Total línea
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedTxItems.map((item, idx) => {
                        const itemName =
                          item.items?.name || "Artículo sin nombre";
                        return (
                          <tr key={item.id} className="ff-tr">
                            <td
                              className="ff-td"
                              style={{ color: "var(--muted)" }}
                            >
                              {idx + 1}
                            </td>
                            <td className="ff-td">{itemName}</td>
                            <td
                              className="ff-td"
                              style={{ textAlign: "center" }}
                            >
                              {item.quantity}
                            </td>
                            <td
                              className="ff-td"
                              style={{ textAlign: "right" }}
                            >
                              {Number(item.unit_price_net).toFixed(2)} DOP
                            </td>
                            <td
                              className="ff-td"
                              style={{ textAlign: "center" }}
                            >
                              {item.is_exempt_used
                                ? "Exento"
                                : `${item.tax_rate_used || 0}%`}
                            </td>
                            <td
                              className="ff-td"
                              style={{ textAlign: "right", fontWeight: 700 }}
                            >
                              {Number(item.line_total_final).toFixed(2)} DOP
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={closeDetail}
                className="ff-btn ff-btn-outline"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>

      <ImportShoppingListModal
        isOpen={showImportShoppingModal}
        onClose={() => setShowImportShoppingModal(false)}
        items={items}
        api={api}
        token={token}
        meta={{
          account_id: accountId,
          category_id: categoryId,
          date,
          description,
          discount,
        }}
        onImported={async (data) => {
          await fetchTransactions();
          setAmount("");
          setDescription("");
          setIsShoppingList(false);
          setArticleLines([{ item_id: "", quantity: 1 }]);
          setDiscount(0);
          setShowImportShoppingModal(false);
        }}
      />

      {/* Modal de edición */}
      <Modal
        isOpen={isEditOpen}
        onClose={closeEdit}
        title={
          editingTx
            ? `Editar transacción — ${editingTx.date}`
            : "Editar transacción"
        }
        size="md"
      >
        {!editingTx ? (
          <p className="text-sm text-[var(--muted)]">Cargando...</p>
        ) : (
          <form
            onSubmit={handleEditSubmit}
            className="space-y-4 text-sm"
            style={{ color: "var(--text)" }}
          >
            {editingTx.is_shopping_list && (
              <div
                className="rounded-lg border px-3 py-2 text-xs"
                style={{
                  borderColor:
                    "color-mix(in srgb, var(--warning) 45%, transparent)",
                  background:
                    "color-mix(in srgb, var(--warning) 12%, transparent)",
                  color: "color-mix(in srgb, var(--warning) 85%, var(--text))",
                }}
              >
                🛒 Esta transacción es una <strong>lista de compra</strong>. El
                monto total proviene del detalle de artículos y{" "}
                <strong>no se puede editar aquí</strong>.
              </div>
            )}

            {/* Monto */}
            <div className="flex flex-col space-y-1">
              <label className="ff-label">Monto</label>
              <input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => handleEditChange("amount", e.target.value)}
                readOnly={editingTx.is_shopping_list === true}
                className="ff-input"
                style={
                  editingTx.is_shopping_list
                    ? { opacity: 0.65, cursor: "not-allowed" }
                    : undefined
                }
              />
            </div>

            {/* Tipo (FFSelect) */}
            <div className="flex flex-col space-y-1">
              <label className="ff-label">Tipo</label>
              <FFSelect
                value={editForm.type}
                onChange={(v) => handleEditChange("type", v)}
                disabled={editingTx.is_shopping_list === true}
                options={[
                  { value: "expense", label: "Gasto" },
                  { value: "income", label: "Ingreso" },
                ]}
                clearable={false}
              />
            </div>

            {/* Fecha */}
            <div className="flex flex-col space-y-1">
              <label className="ff-label">Fecha</label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => handleEditChange("date", e.target.value)}
                className="ff-input"
                required
              />
            </div>

            {/* Cuenta (FFSelect) */}
            <div className="flex flex-col space-y-1">
              <label className="ff-label">Cuenta</label>
              <FFSelect
                value={editForm.account_id}
                onChange={(v) => handleEditChange("account_id", v)}
                options={accounts}
                placeholder="Selecciona una cuenta"
                getOptionValue={(acc) => acc.id}
                getOptionLabel={(acc) => acc.name}
              />
            </div>

            {/* Categoría (FFSelect) */}
            <div className="flex flex-col space-y-1">
              <label className="ff-label">Categoría</label>
              <FFSelect
                value={editForm.category_id}
                onChange={(v) => handleEditChange("category_id", v)}
                options={categories.filter((cat) => {
                  if (!editForm.type) return true;
                  return cat.type === editForm.type;
                })}
                placeholder="Selecciona una categoría"
                getOptionValue={(cat) => cat.id}
                getOptionLabel={(cat) => cat.name}
              />
            </div>

            {/* Descripción */}
            <div className="flex flex-col space-y-1">
              <label className="ff-label">Descripción</label>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) =>
                  handleEditChange("description", e.target.value)
                }
                className="ff-input"
                placeholder="Ejemplo: compra supermercado"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="submit" className="ff-btn ff-btn-primary">
                Guardar cambios
              </button>

              <button
                type="button"
                onClick={closeEdit}
                className="ff-btn ff-btn-outline"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}
      </Modal>

      <ShoppingListQuickModal
        isOpen={showQuickShoppingModal}
        onClose={() => setShowQuickShoppingModal(false)}
        api={api}
        token={token}
        items={items}
        meta={{
          account_id: accountId,
          category_id: categoryId,
          date,
          description,
          discount,
        }}
        onCreated={async () => {
          await fetchTransactions();
          setAmount("");
          setDescription("");
          setIsShoppingList(false);
          setDiscount(0);
          setShowQuickShoppingModal(false);
        }}
      />
    </div>
  );
}

export default Transactions;
