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
  }, [token, api]);

  const addTransaction = () => {
    setTransactions((prev) => [
      ...prev,
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
      console.error(
        "❌ Error al crear escenario:",
        err.response?.data || err.message
      );
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
      className="
        border border-slate-800/80 rounded-2xl
        p-4 md:p-5
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900
        shadow-[0_18px_45px_rgba(0,0,0,0.8)]
        space-y-4
        text-slate-200
      "
    >
      <div className="flex flex-col gap-1 mb-1">
        <h3 className="text-lg md:text-xl font-semibold text-slate-100">
          Nuevo escenario
        </h3>
        <p className="text-xs md:text-sm text-slate-400">
          Define un escenario con ingresos y gastos simulados para analizar
          cómo se comportarían tus finanzas.
        </p>
      </div>

      {/* Nombre + descripción */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">
            Nombre del escenario
          </label>
          <input
            type="text"
            placeholder="Ej. Mes ajustado, Escenario pesimista..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-slate-300">
            Descripción (opcional)
          </label>
          <input
            type="text"
            placeholder="Breve descripción del escenario"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100 placeholder:text-slate-500
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          />
        </div>
      </div>

      {/* Transacciones del escenario */}
      {transactions.length > 0 && (
        <div className="space-y-3 mt-2">
          {transactions.map((tx, index) => (
            <div
              key={index}
              className="
                p-3 md:p-4 rounded-xl
                bg-slate-900/70
                border border-slate-800
                space-y-3
              "
            >
              {/* Nombre de la transacción */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Nombre de transacción
                </label>
                <input
                  type="text"
                  placeholder="Ej. Renta, Luz, Pago tarjeta..."
                  value={tx.name}
                  onChange={(e) =>
                    updateTransaction(index, "name", e.target.value)
                  }
                  className="
                    w-full rounded-lg px-3 py-2 text-sm
                    bg-slate-950 border border-slate-700
                    text-slate-100 placeholder:text-slate-500
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                    transition-colors
                  "
                  required
                />
              </div>

              {/* Monto / tipo / fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Monto estimado
                  </label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={tx.amount}
                    onChange={(e) =>
                      updateTransaction(index, "amount", e.target.value)
                    }
                    className="
                      w-full rounded-lg px-3 py-2 text-sm
                      bg-slate-950 border border-slate-700
                      text-slate-100 placeholder:text-slate-500
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                      transition-colors
                    "
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Tipo
                  </label>
                  <select
                    value={tx.type}
                    onChange={(e) =>
                      updateTransaction(index, "type", e.target.value)
                    }
                    className="
                      w-full rounded-lg px-3 py-2 text-sm
                      bg-slate-950 border border-slate-700
                      text-slate-100
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                      transition-colors
                    "
                  >
                    <option value="expense">Gasto</option>
                    <option value="income">Ingreso</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Fecha inicio
                  </label>
                  <input
                    type="date"
                    value={tx.start_date}
                    onChange={(e) =>
                      updateTransaction(index, "start_date", e.target.value)
                    }
                    className="
                      w-full rounded-lg px-3 py-2 text-sm
                      bg-slate-950 border border-slate-700
                      text-slate-100
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                      transition-colors
                    "
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-300">
                    Fecha fin (opcional)
                  </label>
                  <input
                    type="date"
                    value={tx.end_date}
                    onChange={(e) =>
                      updateTransaction(index, "end_date", e.target.value)
                    }
                    className="
                      w-full rounded-lg px-3 py-2 text-sm
                      bg-slate-950 border border-slate-700
                      text-slate-100
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                      transition-colors
                    "
                  />
                </div>
              </div>

              {/* Categoría */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Categoría (opcional)
                </label>
                <select
                  value={tx.category_id || ""}
                  onChange={(e) =>
                    updateTransaction(
                      index,
                      "category_id",
                      e.target.value || null
                    )
                  }
                  className="
                    w-full rounded-lg px-3 py-2 text-sm
                    bg-slate-950 border border-slate-700
                    text-slate-100
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                    transition-colors
                  "
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
              </div>

              {/* Recurrencia */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-300">
                  Recurrencia
                </label>
                <select
                  value={tx.recurrence}
                  onChange={(e) =>
                    updateTransaction(index, "recurrence", e.target.value)
                  }
                  className="
                    w-full rounded-lg px-3 py-2 text-sm
                    bg-slate-950 border border-slate-700
                    text-slate-100
                    focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                    transition-colors
                  "
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              {/* Excluir fines de semana */}
              <label className="inline-flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={tx.exclude_weekends}
                  onChange={(e) =>
                    updateTransaction(
                      index,
                      "exclude_weekends",
                      e.target.checked
                    )
                  }
                  className="
                    h-4 w-4 rounded border-slate-600 bg-slate-950
                    text-emerald-500
                    focus:ring-emerald-500/70
                  "
                />
                Excluir fines de semana en la simulación
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          type="button"
          onClick={addTransaction}
          className="
            inline-flex items-center justify-center
            px-4 py-2 text-sm font-semibold rounded-lg
            border border-slate-600
            bg-slate-900 text-slate-200
            hover:bg-slate-800 hover:border-slate-500
            active:scale-95
            transition-all
          "
        >
          Agregar transacción
        </button>

        <button
          type="submit"
          className="
            inline-flex items-center justify-center
            px-4 py-2 text-sm font-semibold rounded-lg
            bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
            text-slate-950
            shadow-[0_0_18px_rgba(16,185,129,0.7)]
            hover:brightness-110
            active:scale-95
            transition-all
          "
        >
          Guardar escenario
        </button>
      </div>
    </form>
  );
}

export default ScenarioForm;
