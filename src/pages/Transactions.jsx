import { useEffect, useState } from "react";
import axios from "axios";

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

  const [recurrence, setRecurrence] = useState("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");

  const api = import.meta.env.VITE_API_URL;

  const fetchInitialData = async () => {
    try {
      const [accRes, catRes, txRes, itemRes] = await Promise.all([
        axios.get(`${api}/accounts`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${api}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${api}/transactions`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${api}/items`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      setAccounts(accRes.data.data);
      setCategories(catRes.data.data);
      setTransactions(txRes.data.data);
      setItems(itemRes.data.data);
    } catch {
      alert("Error cargando datos iniciales");
    }
  };

  useEffect(() => {
    if (token) fetchInitialData();
  }, [token]);

  useEffect(() => {
    if (isShoppingList && items.length > 0) {
      const total = articleLines.reduce((sum, line) => {
        const item = items.find((i) => i.id === line.item_id);
        const price = item?.latest_price || 0;
        const qty = parseFloat(line.quantity) || 1;
        return sum + price * qty;
      }, 0);
      setAmount(total.toFixed(2));
    }
  }, [articleLines, isShoppingList, items]);

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
      fetchInitialData();
    } catch {
      alert("Error al crear transacción");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta transacción?")) return;
    try {
      await axios.delete(`${api}/transactions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchInitialData();
    } catch {
      alert("Error al eliminar");
    }
  };

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold text-gray-800 mb-2">Transacciones</h2>
      <p className="text-sm text-gray-500 mb-4">
        Registra tus ingresos y gastos, o marca como lista de compra para
        asociar artículos.
      </p>

      <form onSubmit={handleSubmit} className="grid md:grid-cols-3 gap-4 mb-6">
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
            {articleLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-4 gap-2 mb-2">
                <select
                  value={line.item_id}
                  onChange={(e) => updateLine(idx, "item_id", e.target.value)}
                  className="border p-2 col-span-2"
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
                  className="border p-2"
                  value={line.quantity}
                  onChange={(e) => updateLine(idx, "quantity", e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => removeLine(idx)}
                  className="text-red-600 text-xs col-span-4 text-left"
                >
                  Quitar
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLine}
              className="text-blue-600 text-sm mt-1 mb-4"
            >
              + Agregar otro artículo
            </button>
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

      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        Historial reciente
      </h3>
      <ul className="space-y-3">
        {transactions.map((tx) => (
          <li
            key={tx.id}
            className="p-4 border border-gray-200 rounded shadow-sm flex justify-between items-center"
          >
            <div>
              <p className="text-sm font-semibold text-gray-800">
                <span
                  className={
                    tx.type === "income" ? "text-green-600" : "text-red-600"
                  }
                >
                  {tx.type === "income" ? "+" : "-"}
                  {tx.amount.toFixed(2)} DOP
                </span>{" "}
                —{" "}
                <span className="text-gray-600">
                  {tx.categories?.name || "Sin categoría"}
                </span>
              </p>
              <p className="text-xs text-gray-500">
                {tx.description || "Sin descripción"} —{" "}
                {tx.accounts?.name || "Sin cuenta"} — {tx.date}
              </p>
            </div>
            <button
              onClick={() => handleDelete(tx.id)}
              className="text-red-600 text-xs hover:underline"
            >
              Eliminar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default Transactions;
