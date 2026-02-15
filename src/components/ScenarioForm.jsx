import { useEffect, useState } from "react";
import axios from "axios";
import FFSelect from "../components/FFSelect";

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
    setTransactions((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${api}/scenarios`,
        { name, description, transactions },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setName("");
      setDescription("");
      setTransactions([]);
      onSuccess?.();
    } catch (err) {
      console.error(
        "❌ Error al crear escenario:",
        err.response?.data || err.message
      );
      alert(
        `Error: ${err.response?.data?.error || "No se pudo crear el escenario."}`
      );
    }
  };

  return (
    <form onSubmit={handleSubmit} className="ff-card p-4 md:p-5 space-y-4">
      <div className="flex flex-col gap-1 mb-1">
        <h3 className="text-lg md:text-xl font-semibold text-[var(--text)]">
          Nuevo escenario
        </h3>
        <p className="text-xs md:text-sm text-[var(--muted)]">
          Define un escenario con ingresos y gastos simulados para analizar cómo
          se comportarían tus finanzas.
        </p>
      </div>

      {/* Nombre + descripción */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="ff-label">Nombre del escenario</label>
          <input
            type="text"
            placeholder="Ej. Mes ajustado, Escenario pesimista..."
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="ff-input"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="ff-label">Descripción (opcional)</label>
          <input
            type="text"
            placeholder="Breve descripción del escenario"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="ff-input"
          />
        </div>
      </div>

      {/* Transacciones del escenario */}
      {transactions.length > 0 && (
        <div className="space-y-3 mt-2">
          {transactions.map((tx, index) => (
            <div key={index} className="ff-surface p-3 md:p-4 space-y-3">
              {/* Nombre de la transacción */}
              <div className="space-y-1">
                <label className="ff-label">Nombre de transacción</label>
                <input
                  type="text"
                  placeholder="Ej. Renta, Luz, Pago tarjeta..."
                  value={tx.name}
                  onChange={(e) => updateTransaction(index, "name", e.target.value)}
                  className="ff-input"
                  required
                />
              </div>

              {/* Monto / tipo / fechas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="ff-label">Monto estimado</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={tx.amount}
                    min={0}
                    step="0.01"
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      updateTransaction(
                        index,
                        "amount",
                        Number.isNaN(v) ? 0 : Math.max(0, v)
                      );
                    }}
                    className="ff-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="ff-label">Tipo</label>
                  <FFSelect
                    value={tx.type}
                    onChange={(v) => {
                      updateTransaction(index, "type", v);
                      // al cambiar tipo, limpia categoría (para no quedar inválida)
                      updateTransaction(index, "category_id", null);
                    }}
                    clearable={false}
                    options={[
                      { value: "expense", label: "Gasto" },
                      { value: "income", label: "Ingreso" },
                    ]}
                  />
                </div>

                <div className="space-y-1">
                  <label className="ff-label">Fecha inicio</label>
                  <input
                    type="date"
                    value={tx.start_date}
                    onChange={(e) =>
                      updateTransaction(index, "start_date", e.target.value)
                    }
                    className="ff-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="ff-label">Fecha fin (opcional)</label>
                  <input
                    type="date"
                    value={tx.end_date}
                    onChange={(e) =>
                      updateTransaction(index, "end_date", e.target.value)
                    }
                    className="ff-input"
                  />
                </div>
              </div>

              {/* Categoría */}
              <div className="space-y-1">
                <label className="ff-label">Categoría (opcional)</label>
                <FFSelect
                  value={tx.category_id || ""}
                  onChange={(v) => updateTransaction(index, "category_id", v || null)}
                  placeholder="Sin categoría"
                  options={categories.filter((c) => c.type === tx.type)}
                  getOptionValue={(cat) => cat.id}
                  getOptionLabel={(cat) => cat.name}
                />
              </div>

              {/* Recurrencia */}
              <div className="space-y-1">
                <label className="ff-label">Recurrencia</label>
                <FFSelect
                  value={tx.recurrence}
                  onChange={(v) => updateTransaction(index, "recurrence", v)}
                  clearable={false}
                  options={[
                    { value: "daily", label: "Diario" },
                    { value: "weekly", label: "Semanal" },
                    { value: "biweekly", label: "Quincenal" },
                    { value: "monthly", label: "Mensual" },
                  ]}
                />
              </div>

              {/* Excluir fines de semana */}
              <label
                className="inline-flex items-center gap-2 text-xs"
                style={{ color: "var(--text)" }}
              >
                <input
                  type="checkbox"
                  checked={!!tx.exclude_weekends}
                  onChange={(e) =>
                    updateTransaction(index, "exclude_weekends", e.target.checked)
                  }
                  className="h-4 w-4 rounded"
                  style={{ accentColor: "var(--primary)" }}
                />
                Excluir fines de semana en la simulación
              </label>
            </div>
          ))}
        </div>
      )}

      {/* Botones de acción */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button type="button" onClick={addTransaction} className="ff-btn">
          Agregar transacción
        </button>

        <button type="submit" className="ff-btn ff-btn-primary">
          Guardar escenario
        </button>
      </div>
    </form>
  );
}

export default ScenarioForm;
