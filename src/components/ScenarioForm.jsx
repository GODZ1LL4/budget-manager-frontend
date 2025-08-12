import { useEffect, useState } from "react";
import axios from "axios";

function ScenarioForm({ token, onSuccess }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);

  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await axios.get(`${api}/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(res.data.data || []);
      } catch (err) {
        console.error("❌ Error al cargar categorías:", err);
      }
    };

    if (token) fetchCategories();
  }, [token]);

  const addTransaction = () => {
    setTransactions([
      ...transactions,
      {
        name: "",
        amount: 0,
        type: "expense",
        start_date: "",
        end_date: "",
        recurrence: "daily",
        exclude_weekends: true,
        category_id: null,
        account_id: null,
        description: "",
      },
    ]);
  };

  const updateTransaction = (index, field, value) => {
    const updated = [...transactions];
    updated[index][field] = value;
    setTransactions(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${api}/scenarios`,
        {
          name,
          description,
          transactions,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setName("");
      setDescription("");
      setTransactions([]);
      onSuccess();
    } catch (err) {
      console.error("❌ Error al crear escenario:", err.response?.data || err.message);
      alert(
        `Error: ${
          err.response?.data?.error || "No se pudo crear el escenario."
        }`
      );
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border border-gray-200 rounded p-4 space-y-4"
    >
      <h3 className="text-lg font-semibold text-gray-800">Nuevo Escenario</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <input
          type="text"
          placeholder="Nombre del escenario"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border p-2 rounded"
          required
        />
        <input
          type="text"
          placeholder="Descripción (opcional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="border p-2 rounded"
        />
      </div>

      {transactions.length > 0 && (
        <div className="space-y-3">
          {transactions.map((tx, index) => (
            <div
              key={index}
              className="p-3 border border-gray-300 rounded space-y-2 bg-gray-50"
            >
              <input
                type="text"
                placeholder="Nombre de transacción"
                value={tx.name}
                onChange={(e) => updateTransaction(index, "name", e.target.value)}
                className="border p-2 rounded w-full"
                required
              />

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <input
                  type="number"
                  placeholder="Monto estimado"
                  value={tx.amount}
                  onChange={(e) => updateTransaction(index, "amount", e.target.value)}
                  className="border p-2 rounded"
                />

                <select
                  value={tx.type}
                  onChange={(e) => updateTransaction(index, "type", e.target.value)}
                  className="border p-2 rounded"
                >
                  <option value="expense">Gasto</option>
                  <option value="income">Ingreso</option>
                </select>

                <input
                  type="date"
                  value={tx.start_date}
                  onChange={(e) =>
                    updateTransaction(index, "start_date", e.target.value)
                  }
                  className="border p-2 rounded"
                />
                <input
                  type="date"
                  value={tx.end_date}
                  onChange={(e) =>
                    updateTransaction(index, "end_date", e.target.value)
                  }
                  className="border p-2 rounded"
                />
              </div>

              {/* Selección de categoría opcional */}
              <select
                value={tx.category_id || ""}
                onChange={(e) =>
                  updateTransaction(index, "category_id", e.target.value || null)
                }
                className="border p-2 rounded w-full"
              >
                <option value="">Sin categoría</option>
                {categories
                  .filter((c) => c.type === tx.type)
                  .map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
              </select>

              <select
                value={tx.recurrence}
                onChange={(e) =>
                  updateTransaction(index, "recurrence", e.target.value)
                }
                className="border p-2 rounded w-full"
              >
                <option value="daily">Diario</option>
                <option value="weekly">Semanal</option>
                <option value="biweekly">Quincenal</option>
                <option value="monthly">Mensual</option>
              </select>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={tx.exclude_weekends}
                  onChange={(e) =>
                    updateTransaction(index, "exclude_weekends", e.target.checked)
                  }
                />
                Excluir fines de semana
              </label>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addTransaction}
        className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
      >
        Agregar transacción 
      </button>

      <button
        type="submit"
        className="block mt-4 bg-green-600 text-white py-2 px-4 rounded hover:brightness-110"
      >
        Guardar Escenario
      </button>
    </form>
  );
}

export default ScenarioForm;
