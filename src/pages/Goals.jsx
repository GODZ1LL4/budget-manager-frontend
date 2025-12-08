import { useEffect, useState } from "react";
import axios from "axios";

function Goals({ token }) {
  const [goals, setGoals] = useState([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState("");

  const api = import.meta.env.VITE_API_URL;

  const fetchGoals = async () => {
    try {
      const res = await axios.get(`${api}/goals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGoals(res.data.data);
    } catch {
      alert("Error al cargar metas");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${api}/goals`,
        {
          name,
          target_amount: parseFloat(target),
          due_date: dueDate || null,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setName("");
      setTarget("");
      setDueDate("");
      fetchGoals();
    } catch (err) {
      const msg = err?.response?.data?.error || "Error al crear meta";
      alert(msg);
    }
  };

  const handleUpdate = async (id, amount) => {
    try {
      await axios.put(
        `${api}/goals/${id}`,
        {
          current_amount: parseFloat(amount),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      fetchGoals();
    } catch {
      alert("Error al actualizar meta");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Eliminar esta meta?")) return;
    try {
      await axios.delete(`${api}/goals/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchGoals();
    } catch {
      alert("Error al eliminar meta");
    }
  };

  useEffect(() => {
    if (token) fetchGoals();
  }, [token]);

  return (
    <div
      className="
        rounded-2xl p-6
        bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950
        border border-slate-800
        shadow-[0_18px_45px_rgba(0,0,0,0.9)]
        text-slate-200 space-y-5
      "
    >
      <div>
        <h2 className="text-2xl font-bold text-[#f6e652] mb-1">
          Metas de Ahorro
        </h2>
        <p className="text-sm text-slate-400">
          Crea metas con una fecha objetivo y seguí tu progreso en tiempo real.
        </p>
      </div>

      {/* Formulario */}
      <form
        onSubmit={handleCreate}
        className="grid gap-4 mb-4 md:grid-cols-3"
      >
        {/* Nombre */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">
            Nombre
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Viaje, computadora..."
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

        {/* Monto objetivo */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">
            Monto objetivo (DOP)
          </label>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="1000"
            min="0"
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

        {/* Fecha límite */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">
            Fecha límite
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          />
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            className="
              inline-flex items-center justify-center
              px-5 py-2.5 text-sm font-semibold rounded-lg
              bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
              text-slate-950
              shadow-[0_0_18px_rgba(16,185,129,0.7)]
              hover:brightness-110 active:scale-95
              transition-all w-full md:w-auto
            "
          >
            Crear meta
          </button>
        </div>
      </form>

      {/* Lista de metas */}
      <ul className="space-y-4">
        {goals.map((goal) => {
          const progress =
            goal.target_amount > 0
              ? goal.current_amount / goal.target_amount
              : 0;
          const progressColor = progress >= 1 ? "#22c55e" : "#3b82f6";

          return (
            <li
              key={goal.id}
              className="
                p-4 rounded-2xl
                bg-slate-950/60
                border border-slate-800
                shadow-[0_10px_30px_rgba(0,0,0,0.7)]
              "
            >
              <div className="flex justify-between items-start gap-3 mb-2">
                <div>
                  <p className="font-semibold text-slate-100">
                    {goal.name}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {goal.current_amount.toFixed(2)} /{" "}
                    {goal.target_amount.toFixed(2)} DOP
                    {goal.due_date ? (
                      <span className="ml-1 text-slate-500">
                        — Vence: {goal.due_date}
                      </span>
                    ) : null}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="
                    text-xs font-semibold
                    text-rose-400 hover:text-rose-300
                    hover:underline transition-colors
                  "
                >
                  Eliminar
                </button>
              </div>

              {/* Slider de progreso */}
              <input
                type="range"
                min="0"
                max={goal.target_amount || 0}
                step="0.01"
                value={goal.current_amount}
                onChange={(e) => handleUpdate(goal.id, e.target.value)}
                className="
                  w-full mt-1
                  accent-emerald-400
                  bg-transparent
                "
              />

              {/* Barra visual */}
              <div className="w-full h-2 bg-slate-800 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, progress * 100)}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </div>
            </li>
          );
        })}

        {goals.length === 0 && (
          <li className="text-sm text-slate-500 italic">
            Aún no tienes metas creadas. Crea la primera desde el formulario
            superior.
          </li>
        )}
      </ul>
    </div>
  );
}

export default Goals;
