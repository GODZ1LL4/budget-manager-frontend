import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal"; // ajusta la ruta según tu estructura

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

      console.log("➡️ Filtros enviados a /transactions:", params);

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

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Transacciones</h2>
      <p className="text-sm text-gray-500 mb-4">
        Registra tus ingresos y gastos, o marca como lista de compra para
        asociar artículos.
      </p>

      {/* Formulario principal */}
      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6"
      >
        <div className="col-span-full">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isShoppingList}
              onChange={(e) => setIsShoppingList(e.target.checked)}
            />
            Esta transacción es una lista de compra
          </label>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Monto</label>
          <input
            type="number"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            readOnly={isShoppingList}
            className={`border border-gray-300 p-2 rounded ${
              isShoppingList ? "bg-gray-100 text-gray-500" : ""
            }`}
            required
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          >
            <option value="expense">Gasto</option>
            <option value="income">Ingreso</option>
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Fecha</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Cuenta</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="border border-gray-300 p-2 rounded"
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

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Categoría</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border border-gray-300 p-2 rounded"
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

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Repetir</label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          >
            <option value="">Una vez</option>
            <option value="monthly">Mensual</option>
            <option value="biweekly">Quincenal</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>

        {recurrence && (
          <div className="flex flex-col">
            <label className="text-sm font-medium mb-1">Repetir hasta</label>
            <input
              type="date"
              value={recurrenceEndDate}
              onChange={(e) => setRecurrenceEndDate(e.target.value)}
              className="border border-gray-300 p-2 rounded"
            />
          </div>
        )}

        <div className="flex flex-col md:col-span-3">
          <label className="text-sm font-medium mb-1">Descripción</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ejemplo: compra supermercado"
            className="border border-gray-300 p-2 rounded"
          />
        </div>

        {isShoppingList && (
          <div className="md:col-span-3">
            <h4 className="font-semibold text-gray-700 mb-1 mt-2">
              Artículos comprados
            </h4>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
              <label className="text-sm font-medium mb-1 sm:mb-0">
                Descuento (%)
              </label>
              <input
                type="number"
                value={discount}
                min="0"
                max="100"
                step="0.01"
                onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                className="border border-gray-300 px-2 py-1 rounded text-sm w-full sm:w-24"
                placeholder="Ej. 5"
              />
            </div>

            {articleLines.map((line, idx) => {
              const item = items.find((i) => i.id === line.item_id);
              const price = item?.latest_price || 0;
              const taxRate = item?.is_exempt
                ? 0
                : parseFloat(item?.tax_rate || 0);
              const taxLabel = item?.is_exempt ? "Exento" : `${taxRate}%`;

              return (
                <div
                  key={idx}
                  className="space-y-2 mb-4 border-b border-gray-200 pb-4"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-2">
                    <select
                      value={line.item_id}
                      onChange={(e) =>
                        updateLine(idx, "item_id", e.target.value)
                      }
                      className="border p-2 sm:col-span-2 w-full rounded"
                    >
                      <option value="">Selecciona artículo</option>
                      {items.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.name}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      placeholder="Cantidad"
                      className="border p-2 sm:col-span-1 w-full rounded"
                      value={line.quantity}
                      onChange={(e) =>
                        updateLine(idx, "quantity", e.target.value)
                      }
                    />

                    <div className="text-sm text-gray-600 sm:col-span-2">
                      <p>
                        Precio: <strong>{price.toFixed(2)} DOP</strong>
                      </p>
                      <p>
                        ITBIS: <strong>{taxLabel}</strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex justify-start">
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:brightness-110 transition w-full sm:w-auto"
                    >
                      Quitar artículo
                    </button>
                  </div>
                </div>
              );
            })}

            <div className="flex justify-start mb-4">
              <button
                type="button"
                onClick={addLine}
                className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:brightness-110 transition w-full sm:w-auto"
              >
                Agregar artículo
              </button>
            </div>
          </div>
        )}

        <div className="md:col-span-3">
          <button
            type="submit"
            className="w-full bg-green-600 text-white font-semibold py-2 rounded hover:brightness-110 transition"
          >
            Agregar transacción
          </button>
        </div>
      </form>

      {/* Filtros de transacciones */}
      <div className="mb-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Filtros</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Descripción */}
          <div className="flex flex-col">
            <label className="text-xs font-medium mb-1">Descripción</label>
            <input
              type="text"
              value={filterDescription}
              onChange={(e) => setFilterDescription(e.target.value)}
              className="border border-gray-300 p-2 rounded text-sm"
              placeholder="Buscar por descripción"
            />
          </div>

          {/* Tipo */}
          <div className="flex flex-col">
            <label className="text-xs font-medium mb-1">Tipo</label>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-300 p-2 rounded text-sm"
            >
              <option value="all">Todos</option>
              <option value="expense">Gasto</option>
              <option value="income">Ingreso</option>
              <option value="transfer">Transferencia</option>
            </select>
          </div>

          {/* Categoría */}
          <div className="flex flex-col">
            <label className="text-xs font-medium mb-1">Categoría</label>
            <select
              value={filterCategoryId}
              onChange={(e) => setFilterCategoryId(e.target.value)}
              className="border border-gray-300 p-2 rounded text-sm"
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
          <div className="flex flex-col">
            <label className="text-xs font-medium mb-1">Cuenta</label>
            <select
              value={filterAccountId}
              onChange={(e) => setFilterAccountId(e.target.value)}
              className="border border-gray-300 p-2 rounded text-sm"
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
          <div className="flex flex-col">
            <label className="text-xs font-medium mb-1">Desde</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="border border-gray-300 p-2 rounded text-sm"
            />
          </div>

          {/* Fecha hasta */}
          <div className="flex flex-col">
            <label className="text-xs font-medium mb-1">Hasta</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="border border-gray-300 p-2 rounded text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-col sm:flex-row gap-2">
          <button
            type="button"
            onClick={() => fetchTransactions()}
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:brightness-110 transition w-full sm:w-auto"
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
            className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 transition w-full sm:w-auto"
          >
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Historial */}
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        Historial reciente
      </h3>
      <ul className="space-y-3">
        {transactions.map((tx) => {
          const isShoppingListTx = tx.is_shopping_list === true;

          return (
            <li
              key={tx.id}
              className="p-4 border border-gray-200 rounded shadow-sm flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2"
            >
              <div>
                <p className="text-sm font-semibold text-gray-800 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      tx.type === "income"
                        ? "text-green-600"
                        : tx.type === "expense"
                        ? "text-red-600"
                        : "text-gray-700"
                    }
                  >
                    {tx.type === "income"
                      ? "+"
                      : tx.type === "expense"
                      ? "-"
                      : ""}
                    {Number(tx.amount).toFixed(2)} DOP
                  </span>

                  <span className="text-gray-600">
                    —{" "}
                    {tx.type === "transfer"
                      ? "Transferencia"
                      : tx.categories?.name || "Sin categoría"}
                  </span>

                  {isShoppingListTx && (
                    <button
                      type="button"
                      onClick={() => openDetail(tx)}
                      className="inline-flex items-center text-[10px] uppercase tracking-wide bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full hover:bg-indigo-100 border border-indigo-100"
                      title="Ver detalle de la lista de compra"
                    >
                      <span className="mr-1">🛒</span>
                      Lista de compra
                    </button>
                  )}
                </p>

                <p className="text-xs text-gray-500 mt-1">
                  {tx.description || "Sin descripción"} —{" "}
                  {tx.type === "transfer"
                    ? `${tx.account_from?.name || "¿?"} → ${
                        tx.account_to?.name || "¿?"
                      }`
                    : tx.account?.name || "Sin cuenta"}{" "}
                  — {tx.date}
                </p>
              </div>

              <button
                onClick={() => handleDelete(tx.id)}
                className="text-red-600 text-xs hover:underline"
              >
                Eliminar
              </button>
            </li>
          );
        })}
      </ul>

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
          <p className="text-sm text-gray-500">Cargando...</p>
        ) : (
          <div className="space-y-5">
            {/* Encabezado con resumen */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Resumen de la transacción
                </p>
                <p className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {Number(selectedTx.amount).toFixed(2)} DOP
                  {selectedTx.discount_percent > 0 && (
                    <span className="inline-flex items-center text-[10px] font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-100">
                      🔖 Descuento {selectedTx.discount_percent}%
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500">
                  {selectedTx.description || "Sin descripción"}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center bg-gray-50 text-gray-700 px-2 py-1 rounded-full border border-gray-100">
                  🧾 <span className="ml-1 font-medium">Fecha:</span>
                  <span className="ml-1">{selectedTx.date}</span>
                </span>
                <span className="inline-flex items-center bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-100">
                  💼 <span className="ml-1 font-medium">Cuenta:</span>
                  <span className="ml-1">
                    {selectedTx.account?.name || "Sin cuenta"}
                  </span>
                </span>
                {selectedTx.categories && (
                  <span className="inline-flex items-center bg-purple-50 text-purple-700 px-2 py-1 rounded-full border border-purple-100">
                    🏷️ <span className="ml-1 font-medium">Categoría:</span>
                    <span className="ml-1">
                      {selectedTx.categories.name}
                    </span>
                  </span>
                )}
              </div>
            </div>

            {/* Tabla de artículos */}
            <div className="border-t pt-4">
              <h4 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                🛒 Artículos comprados
                {selectedTxItems.length > 0 && (
                  <span className="text-[11px] font-normal text-gray-500">
                    {selectedTxItems.length} ítem
                    {selectedTxItems.length > 1 ? "s" : ""}
                  </span>
                )}
              </h4>

              {isLoadingItems && (
                <p className="text-xs text-gray-500 italic">
                  Cargando artículos...
                </p>
              )}

              {!isLoadingItems && selectedTxItems.length === 0 && (
                <p className="text-xs text-gray-500 italic">
                  No hay artículos asociados a esta transacción.
                </p>
              )}

              {!isLoadingItems && selectedTxItems.length > 0 && (
                <div className="overflow-x-auto rounded border border-gray-100">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr className="border-b border-gray-100">
                        <th className="py-2 pl-3 pr-2 text-left font-semibold text-gray-600">
                          #
                        </th>
                        <th className="py-2 px-2 text-left font-semibold text-gray-600">
                          Artículo
                        </th>
                        <th className="py-2 px-2 text-center font-semibold text-gray-600">
                          Cantidad
                        </th>
                        <th className="py-2 px-2 text-right font-semibold text-gray-600">
                          Precio unit.
                        </th>
                        <th className="py-2 px-2 text-center font-semibold text-gray-600">
                          ITBIS
                        </th>
                        <th className="py-2 pr-3 pl-2 text-right font-semibold text-gray-600">
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
                                ? "bg-white border-b border-gray-50"
                                : "bg-gray-50/50 border-b border-gray-50"
                            }
                          >
                            <td className="py-2 pl-3 pr-2 text-gray-500">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-2 text-gray-800">
                              {itemName}
                            </td>
                            <td className="py-2 px-2 text-center text-gray-700">
                              {item.quantity}
                            </td>
                            <td className="py-2 px-2 text-right text-gray-700">
                              {Number(item.unit_price_net).toFixed(2)} DOP
                            </td>
                            <td className="py-2 px-2 text-center text-gray-700">
                              {item.is_exempt_used
                                ? "Exento"
                                : `${item.tax_rate_used || 0}%`}
                            </td>
                            <td className="py-2 pr-3 pl-2 text-right font-semibold text-gray-800">
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
                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 bg-white hover:bg-gray-50"
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

export default Transactions;
