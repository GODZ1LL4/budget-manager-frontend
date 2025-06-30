import { useEffect, useState } from "react";
import axios from "axios";

function Budgets({ token }) {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [limitAmount, setLimitAmount] = useState("");
  const [repeatYearly, setRepeatYearly] = useState(false);

  const [filterType, setFilterType] = useState("month"); // "month" o "year"
  const [filterValue, setFilterValue] = useState(month);

  const api = import.meta.env.VITE_API_URL;

  const fetchBudgets = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType === "month") {
        params.append("month", filterValue);
      } else {
        params.append("year", filterValue);
      }

      const res = await axios.get(`${api}/budgets?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setBudgets(res.data.data);
    } catch {
      alert("Error al cargar presupuestos");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${api}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res.data.data.filter((cat) => cat.type === "expense"));
    } catch {
      alert("Error al cargar categorías");
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await axios.post(
        `${api}/budgets`,
        {
          category_id: categoryId,
          month,
          limit_amount: parseFloat(limitAmount),
          repeat: repeatYearly,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      setCategoryId("");
      setLimitAmount("");
      fetchBudgets();
    } catch {
      alert("Error al crear el presupuesto");
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("¿Deseas eliminar este presupuesto?")) return;
    try {
      await axios.delete(`${api}/budgets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchBudgets();
    } catch {
      alert("Error al eliminar el presupuesto");
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [token]);

  useEffect(() => {
    fetchBudgets();
  }, [token, filterType, filterValue]);

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold mb-2 text-[#1e40af]">Flujos Personales</h2>
      <p className="text-sm text-gray-500 mb-4">
        Establece un límite de gasto por categoría cada mes. El sistema te
        mostrará cuánto has utilizado.
      </p>

      <form onSubmit={handleCreate} className="grid gap-4 mb-6 md:grid-cols-3">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Categoría</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="border border-gray-300 p-2 rounded"
            required
          >
            <option value="">Selecciona una categoría</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div className="flex items-center mt-2">
          <input
            type="checkbox"
            id="repeat"
            checked={repeatYearly}
            onChange={() => setRepeatYearly(!repeatYearly)}
            className="mr-2"
          />
          <label htmlFor="repeat" className="text-sm text-gray-700">
            Repetir este presupuesto para todo el año
          </label>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Límite mensual</label>
          <input
            type="number"
            min="0"
            placeholder="Ej: 500.00"
            value={limitAmount}
            onChange={(e) => setLimitAmount(e.target.value)}
            className="border border-gray-300 p-2 rounded"
            required
          />
        </div>

        <div className="md:col-span-3">
          <button
            type="submit"
            className="bg-[#1e40af] text-white font-semibold px-4 py-2 rounded hover:brightness-90 transition w-full md:w-auto"
          >
            Agregar Flujo
          </button>
        </div>
      </form>

      {/* 🔍 Filtro por mes o año */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <label className="text-sm mr-2">Ver por:</label>
          <select
            value={filterType}
            onChange={(e) => {
              const type = e.target.value;
              setFilterType(type);
              const now = new Date();
              setFilterValue(
                type === "month"
                  ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
                  : `${now.getFullYear()}`
              );
            }}
            className="border border-gray-300 p-2 rounded"
          >
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </select>
        </div>

        {filterType === "month" ? (
          <input
            type="month"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="border border-gray-300 p-2 rounded"
          />
        ) : (
          <input
            type="number"
            min="2000"
            max="2100"
            value={filterValue}
            onChange={(e) => setFilterValue(e.target.value)}
            className="border border-gray-300 p-2 rounded w-24"
            placeholder="Año"
          />
        )}
      </div>

      <h3 className="text-lg font-semibold mb-3 text-gray-800">Resumen</h3>
      <ul className="space-y-4">
        {budgets.map((b) => {
          const percent = b.spent / b.limit;
          const over = percent >= 1;

          return (
            <li
              key={b.id}
              className={`p-4 rounded border shadow-sm ${
                over
                  ? "border-red-400 bg-red-50"
                  : "border-green-400 bg-green-50"
              }`}
            >
              <div className="flex justify-between items-center mb-2">
                <div>
                  <p className="font-semibold text-gray-800">
                    {b.category_name} — {b.month}
                  </p>
                  <p className="text-sm text-gray-700">
                    Gasto: {b.spent.toFixed(2)} / {b.limit.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Eliminar
                </button>
              </div>
              <div className="w-full h-2 bg-gray-200 rounded">
                <div
                  className="h-2 rounded"
                  style={{
                    width: `${Math.min(100, percent * 100)}%`,
                    backgroundColor: over ? "#dc2626" : "#22c55e",
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

export default Budgets;
