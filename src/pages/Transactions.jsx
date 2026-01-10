import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal"; // ajusta la ruta según tu estructura
import ImportShoppingListModal from "../components/ImportShoppingListModal";
import ShoppingListQuickModal from "../components/ShoppingListQuickModal";

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

  const addLine = () => {
    setArticleLines([...articleLines, { item_id: "", quantity: 1 }]);
  };

  const updateLine = (index, field, value) => {
    const updated = [...articleLines];
    updated[index][field] = value;
    setArticleLines(updated);
  };

  const removeLine = (index) => {
    setArticleLines(articleLines.filter((_, i) => i !== index));
  };

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

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_18px_45px_rgba(0,0,0,0.9)]
        text-slate-200 space-y-6
      "
    >
      <div>
        <h2 className="text-2xl font-bold mb-1 text-[#f6e652]">
          Transacciones
        </h2>
        <p className="text-sm text-slate-400">
          Registra tus ingresos y gastos, o marca como lista de compra para
          asociar artículos.
        </p>
      </div>

      {/* Formulario principal */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3"
      >
        <div className="col-span-full space-y-3 py-3 px-4 rounded-xl bg-slate-900/40 border border-slate-800">
          {/* Checkbox principal */}
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isShoppingList}
              onChange={(e) => setIsShoppingList(e.target.checked)}
              className="
        h-4 w-4 rounded 
        border-slate-600 bg-slate-900 
        text-emerald-500 focus:ring-emerald-500/70
      "
            />
            <span className="text-sm font-medium text-slate-200">
              Esta transacción es una{" "}
              <span className="text-emerald-300">lista de compra</span>
            </span>
          </label>

          {/* Contenido que aparece al activar */}
          {/* Lista de compra */}
          {isShoppingList && (
            <div className="pl-7 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowQuickShoppingModal(true)}
                  className="
          inline-flex items-center gap-2
          px-3 py-2 text-sm font-semibold rounded-lg
          bg-emerald-600 text-slate-100
          shadow-[0_0_10px_rgba(16,185,129,0.4)]
          hover:brightness-110 active:scale-95
          transition-all
        "
                >
                  <span className="text-base">🛒</span>
                  <span>Crear lista de compra</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportShoppingModal(true)}
                  className="
          inline-flex items-center gap-2
          px-3 py-2 text-sm font-semibold rounded-lg
          bg-indigo-600 text-slate-100
          shadow-[0_0_10px_rgba(99,102,241,0.4)]
          hover:brightness-110 active:scale-95
          transition-all
        "
                >
                  <span className="text-base">📥</span>
                  <span>Importar lista de compra desde archivo</span>
                </button>
              </div>

              <p className="text-xs text-slate-400">
                Puedes crear la lista desde el modal o importar desde CSV.
              </p>
            </div>
          )}
        </div>

        {/* Monto */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">Monto</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            readOnly={isShoppingList}
            className={`
      w-full rounded-lg px-3 py-2 text-sm border
      ${
        isShoppingList
          ? "bg-slate-900/70 border-slate-800 text-slate-500"
          : "bg-slate-900 border-slate-700 text-slate-100"
      }
      placeholder:text-slate-500
      focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
      transition-colors
    `}
            required
          />
        </div>

        {/* Descuento (solo si es lista de compra) */}
        {isShoppingList && (
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-300">
              Descuento (%)
            </label>
            <input
              type="number"
              value={discount}
              min="0"
              max="100"
              step="0.01"
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              className="
        w-full rounded-lg px-3 py-2 text-sm
        bg-slate-900 border border-slate-700
        text-slate-100 placeholder:text-slate-500
        focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
        transition-colors
      "
              placeholder="Ej. 5"
            />
          </div>
        )}

        {/* Tipo */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>

        {/* Fecha */}
        <div className="flex flex-col space-y-1">
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

        {/* Cuenta */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">Cuenta</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
            required
          >
            <option value="">Selecciona una cuenta</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Categoría */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">
            Categoría
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
            required
          >
            <option value="">Selecciona una categoría</option>
            {categories
              .filter((c) => c.type === type)
              .map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
          </select>
        </div>

        {/* Recurrencia */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">Repetir</label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          >
            <option value="">Una vez</option>
            <option value="monthly">Mensual</option>
            <option value="biweekly">Quincenal</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>

        {recurrence && (
          <div className="flex flex-col space-y-1">
            <label className="text-sm font-medium text-slate-300">
              Repetir hasta
            </label>
            <input
              type="date"
              value={recurrenceEndDate}
              onChange={(e) => setRecurrenceEndDate(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
            />
          </div>
        )}

        {/* Descripción */}
        <div className="flex flex-col md:col-span-3 space-y-1">
          <label className="text-sm font-medium text-slate-300">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ejemplo: compra supermercado"
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          />
        </div>

        <div className="md:col-span-3 mt-2">
          <button
            type="submit"
            className="
              w-full
              inline-flex items-center justify-center
              px-4 py-2.5 text-sm font-semibold rounded-lg
              bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
              text-slate-950
              shadow-[0_0_18px_rgba(16,185,129,0.7)]
              hover:brightness-110 active:scale-95
              transition-all
            "
          >
            Agregar transacción
          </button>
        </div>
      </form>

      {/* Filtros de transacciones */}
      <div className="mb-4 rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Filtros</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Descripción */}
          <div className="flex flex-col space-y-1">
            <label className="text-[13px] font-medium text-slate-400">
              Descripción
            </label>
            <input
              type="text"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              placeholder="Buscar por descripción"
            />
          </div>

          {/* Tipo */}
          <div className="flex flex-col space-y-1">
            <label className="text-[13px] font-medium text-slate-400">
              Tipo
            </label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
            >
              <option value="all">Todos</option>
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>

          {/* Categoría */}
          <div className="flex flex-col space-y-1">
            <label className="text-[13px] font-medium text-slate-400">
              Categoría
            </label>
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              disabled={filterType === "transfer"}
            >
              <option value="">Todas</option>

              {categories
                .filter((cat) => {
                  if (filterType === "all") return true;
                  if (filterType === "transfer") return false;
                  return cat.type === filterType;
                })
                .map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
            </select>
          </div>

          {/* Cuenta */}
          <div className="flex flex-col space-y-1">
            <label className="text-[13px] font-medium text-slate-400">
              Cuenta
            </label>
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
            >
              <option value="">Todas</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Fecha desde */}
          <div className="flex flex-col space-y-1">
            <label className="text-[13px] font-medium text-slate-400">
              Desde
            </label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
            />
          </div>

          {/* Fecha hasta */}
          <div className="flex flex-col space-y-1">
            <label className="text-[13px] font-medium text-slate-400">
              Hasta
            </label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
            />
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => fetchTransactions()}
            className="
              w-full sm:w-auto
              inline-flex items-center justify-center
              px-4 py-2 text-sm font-semibold rounded-lg
              bg-blue-600 text-white
              hover:brightness-110 active:scale-95
              transition-all
            "
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
            className="
              w-full sm:w-auto
              inline-flex items-center justify-center
              px-4 py-2 text-sm font-semibold rounded-lg
              border border-slate-600
              bg-slate-900 text-slate-200
              hover:bg-slate-800 hover:border-slate-500
              active:scale-95
              transition-all
            "
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Historial */}
      <div>
        <h3 className="text-lg font-semibold text-slate-100 mb-3">
          Historial reciente
        </h3>
        <ul className="space-y-3">
          {transactions.map((tx) => {
            const isShoppingListTx = tx.is_shopping_list === true;

            return (
              <li
                key={tx.id}
                className="
                  p-4 rounded-2xl
                  border border-slate-800
                  bg-slate-950/70
                  shadow-[0_10px_30px_rgba(0,0,0,0.7)]
                  flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2
                "
              >
                <div>
                  <p className="text-sm font-semibold text-slate-100 flex flex-wrap items-center gap-2">
                    <span
                      className={
                        tx.type === "income"
                          ? "text-emerald-400"
                          : tx.type === "expense"
                          ? "text-rose-400"
                          : "text-slate-200"
                      }
                    >
                      {tx.type === "income"
                        ? "+"
                        : tx.type === "expense"
                        ? "-"
                        : ""}
                      {Number(tx.amount).toFixed(2)} DOP
                    </span>

                    <span className="text-slate-200">
                      —{" "}
                      {tx.type === "transfer"
                        ? "Transferencia"
                        : tx.categories?.name || "Sin categoría"}
                    </span>

                    {isShoppingListTx && (
                      <button
                        type="button"
                        onClick={() => openDetail(tx)}
                        className="
                          inline-flex items-center
                          text-[10px] uppercase tracking-wide
                          bg-indigo-950/70 text-indigo-200
                          px-2 py-0.5 rounded-full
                          hover:bg-indigo-900 border border-indigo-800
                        "
                        title="Ver detalle de la lista de compra"
                      >
                        <span className="mr-1">🛒</span>
                        Lista de compra
                      </button>
                    )}
                  </p>

                  <p className="text-sm  text-slate-400 mt-1">
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
                      className="
      text-sm font-semibold
      text-blue-400 hover:text-blue-300
      hover:underline transition-colors
    "
                    >
                      Editar
                    </button>
                  )}

                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="
        text-sm font-semibold
        text-rose-400 hover:text-rose-300
        hover:underline transition-colors
      "
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
          <p className="text-sm text-slate-300">Cargando...</p>
        ) : (
          <div className="space-y-6 text-slate-200">
            {/* === RESUMEN SUPERIOR === */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Resumen de la transacción
                </p>
                <p className="mt-1 text-2xl font-extrabold text-emerald-300 leading-tight">
                  {Number(selectedTx.amount).toFixed(2)} DOP
                </p>
                {selectedTx.discount_percent > 0 && (
                  <p className="text-sm  text-emerald-300 mt-1 flex items-center gap-1">
                    <span className="text-[11px]">🔖</span>
                    Descuento aplicado:{" "}
                    <span className="font-semibold">
                      {selectedTx.discount_percent}%
                    </span>
                  </p>
                )}
                <p className="mt-2 text-sm  text-slate-400">
                  {selectedTx.description || "Sin descripción"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 justify-start sm:justify-end">
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-200">
                  <span className="text-[13px]">📅</span>
                  <span className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Fecha
                  </span>
                  <span className="text-sm  text-slate-100">
                    {selectedTx.date}
                  </span>
                </span>

                <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1 text-[11px] text-slate-200">
                  <span className="text-[13px]">💼</span>
                  <span className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Cuenta
                  </span>
                  <span className="text-sm  text-slate-100">
                    {selectedTx.account?.name || "Sin cuenta"}
                  </span>
                </span>

                {selectedTx.categories && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-fuchsia-600/60 bg-gradient-to-r from-fuchsia-900/70 via-purple-900/70 to-indigo-900/70 px-3 py-1 text-[11px] text-fuchsia-100">
                    <span className="text-[13px]">🏷️</span>
                    <span className="font-semibold uppercase tracking-[0.16em] text-fuchsia-200">
                      Categoría
                    </span>
                    <span className="text-sm  text-fuchsia-50">
                      {selectedTx.categories.name}
                    </span>
                  </span>
                )}
              </div>
            </div>

            <hr className="border-slate-800" />

            {/* === TABLA DE ARTÍCULOS === */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <span className="text-[15px]">🛒</span>
                  <span>Artículos comprados</span>
                </h4>
                {selectedTxItems.length > 0 && (
                  <span className="text-[11px] text-slate-400">
                    {selectedTxItems.length} ítem
                    {selectedTxItems.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {isLoadingItems && (
                <p className="text-sm  text-slate-400 italic">
                  Cargando artículos...
                </p>
              )}

              {!isLoadingItems && selectedTxItems.length === 0 && (
                <p className="text-sm  text-slate-400 italic">
                  No hay artículos asociados a esta transacción.
                </p>
              )}

              {!isLoadingItems && selectedTxItems.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
                  <table className="min-w-full text-sm ">
                    <thead className="bg-slate-900/80">
                      <tr className="border-b border-slate-800">
                        <th className="py-2 pl-4 pr-2 text-left font-semibold text-slate-300">
                          #
                        </th>
                        <th className="py-2 px-2 text-left font-semibold text-slate-300">
                          Artículo
                        </th>
                        <th className="py-2 px-2 text-center font-semibold text-slate-300">
                          Cantidad
                        </th>
                        <th className="py-2 px-2 text-right font-semibold text-slate-300">
                          Precio unit.
                        </th>
                        <th className="py-2 px-2 text-center font-semibold text-slate-300">
                          ITBIS
                        </th>
                        <th className="py-2 pr-4 pl-2 text-right font-semibold text-slate-300">
                          Total línea
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedTxItems.map((item, idx) => {
                        const itemName =
                          item.items?.name || "Artículo sin nombre";

                        return (
                          <tr
                            key={item.id}
                            className={
                              idx % 2 === 0
                                ? "bg-slate-950/40"
                                : "bg-slate-900/50"
                            }
                          >
                            <td className="py-2 pl-4 pr-2 text-slate-400">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-2 text-slate-100">
                              {itemName}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-200">
                              {item.quantity}
                            </td>
                            <td className="py-2 px-2 text-right text-slate-200">
                              {Number(item.unit_price_net).toFixed(2)} DOP
                            </td>
                            <td className="py-2 px-2 text-center text-slate-200">
                              {item.is_exempt_used
                                ? "Exento"
                                : `${item.tax_rate_used || 0}%`}
                            </td>
                            <td className="py-2 pr-4 pl-2 text-right font-semibold text-slate-100">
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

            {/* === FOOTER === */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={closeDetail}
                className="
                  px-4 py-2 text-sm font-semibold rounded-lg
                  border border-slate-600
                  bg-slate-900 text-slate-100
                  hover:bg-slate-800 hover:border-slate-500
                  active:scale-95
                  transition-all
                "
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
          // data.transaction tiene la transacción creada
          // refrescamos la lista de transacciones y reseteamos el form
          await fetchTransactions();
          setAmount("");
          setDescription("");
          setIsShoppingList(false);
          setArticleLines([{ item_id: "", quantity: 1 }]);
          setDiscount(0);
          setShowImportShoppingModal(false);
        }}
      />

      {/* Modal de edición de transacción */}
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
          <p className="text-sm text-slate-300">Cargando...</p>
        ) : (
          <form onSubmit={handleEditSubmit} className="space-y-4 text-sm">
            {editingTx.is_shopping_list && (
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                🛒 Esta transacción es una <strong>lista de compra</strong>. El
                monto total proviene del detalle de artículos y{" "}
                <strong>no se puede editar aquí</strong>.
              </div>
            )}

            {/* Monto */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Monto
              </label>
              <input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => handleEditChange("amount", e.target.value)}
                readOnly={editingTx.is_shopping_list === true}
                className={`
            w-full rounded-lg px-3 py-2 text-sm border
            ${
              editingTx.is_shopping_list
                ? "bg-slate-900/70 border-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-slate-900 border-slate-700 text-slate-100"
            }
            placeholder:text-slate-500
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            transition-colors
          `}
              />
            </div>

            {/* Tipo */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-slate-300">Tipo</label>
              <select
                value={editForm.type}
                onChange={(e) => handleEditChange("type", e.target.value)}
                disabled={editingTx.is_shopping_list === true}
                className={`
            w-full rounded-lg px-3 py-2 text-sm
            ${
              editingTx.is_shopping_list
                ? "bg-slate-900/70 border-slate-800 text-slate-500 cursor-not-allowed"
                : "bg-slate-900 border-slate-700 text-slate-100"
            }
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            transition-colors
          `}
              >
                {/* 👇 Solo gasto / ingreso, sin transferencia */}
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>

            {/* Fecha */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Fecha
              </label>
              <input
                type="date"
                value={editForm.date}
                onChange={(e) => handleEditChange("date", e.target.value)}
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

            {/* Cuenta */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Cuenta
              </label>
              <select
                value={editForm.account_id}
                onChange={(e) => handleEditChange("account_id", e.target.value)}
                className="
            w-full rounded-lg px-3 py-2 text-sm
            bg-slate-900 border border-slate-700
            text-slate-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            transition-colors
          "
                required
              >
                <option value="">Selecciona una cuenta</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Categoría */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Categoría
              </label>
              <select
                value={editForm.category_id}
                onChange={(e) =>
                  handleEditChange("category_id", e.target.value)
                }
                className="
            w-full rounded-lg px-3 py-2 text-sm
            bg-slate-900 border border-slate-700
            text-slate-100
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            transition-colors
          "
                required
              >
                <option value="">Selecciona una categoría</option>
                {categories
                  .filter((cat) => {
                    // 👇 Ahora filtra según el tipo seleccionado en el modal
                    if (!editForm.type) return true;
                    return cat.type === editForm.type;
                  })
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Descripción */}
            <div className="flex flex-col space-y-1">
              <label className="text-sm font-medium text-slate-300">
                Descripción
              </label>
              <input
                type="text"
                value={editForm.description}
                onChange={(e) =>
                  handleEditChange("description", e.target.value)
                }
                className="
            w-full rounded-lg px-3 py-2 text-sm
            bg-slate-900 border border-slate-700
            text-slate-100 placeholder:text-slate-500
            focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
            transition-colors
          "
                placeholder="Ejemplo: compra supermercado"
              />
            </div>

            {/* Botones */}
            <div className="flex justify-end gap-2 pt-2">
              {/* ✅ Guardar primero */}
              <button
                type="submit"
                className="
            px-4 py-2 text-sm font-semibold rounded-lg
            bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
            text-slate-950
            shadow-[0_0_14px_rgba(16,185,129,0.7)]
            hover:brightness-110 active:scale-95
            transition-all
          "
              >
                Guardar cambios
              </button>

              <button
                type="button"
                onClick={closeEdit}
                className="
            px-4 py-2 text-sm font-semibold rounded-lg
            border border-slate-600
            bg-slate-900 text-slate-100
            hover:bg-slate-800 hover:border-slate-500
            active:scale-95
            transition-all
          "
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
