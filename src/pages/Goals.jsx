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
    fetchGoals();
  }, [token]);

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold mb-2 text-lime-600">Metas de Ahorro</h2>
      <p className="text-sm text-gray-500 mb-4">
        Crea metas de ahorro con una fecha objetivo y visualizá tu progreso en
        tiempo real.
      </p>

      <form onSubmit={handleCreate} className="grid gap-4 mb-6 md:grid-cols-3">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Viaje, computadora..."
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">
            Monto objetivo (USD)
          </label>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="1000"
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Fecha límite</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          />
        </div>

        <div className="md:col-span-3">
          <button
            type="submit"
            className="bg-lime-600 text-white font-semibold px-4 py-2 rounded hover:brightness-90 transition w-full md:w-auto"
          >
            Crear Meta
          </button>
        </div>
      </form>

      <ul className="space-y-4">
        {goals.map((goal) => {
          const progress = goal.current_amount / goal.target_amount;
          const progressColor = progress >= 1 ? "#16a34a" : "#3b82f6"; // verde si completo, azul si no

          return (
            <li
              key={goal.id}
              className="p-4 border border-gray-300 rounded bg-gray-50 shadow-sm"
            >
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="font-semibold text-gray-800">{goal.name}</p>
                  <p className="text-sm text-gray-600">
                    {goal.current_amount} / {goal.target_amount} USD
                    {goal.due_date ? ` — Vence: ${goal.due_date}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(goal.id)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Eliminar
                </button>
              </div>

              <input
                type="range"
                min="0"
                max={goal.target_amount}
                step="0.01"
                value={goal.current_amount}
                onChange={(e) => handleUpdate(goal.id, e.target.value)}
                className="w-full mt-1"
              />

              <div className="w-full h-2 bg-gray-200 rounded mt-1">
                <div
                  className="h-2 rounded transition-all duration-300"
                  style={{
                    width: `${Math.min(100, progress * 100)}%`,
                    backgroundColor: progressColor,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default Goals;
