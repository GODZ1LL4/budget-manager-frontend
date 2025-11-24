import { useEffect, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal";
import { toast } from "react-toastify";

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

  // Importación desde mes anterior
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importItems, setImportItems] = useState([]);
  const [importLoading, setImportLoading] = useState(false);

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
      toast.error("Error al cargar presupuestos");
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${api}/categories`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCategories(res.data.data.filter((cat) => cat.type === "expense"));
    } catch {
      toast.error("Error al cargar categorías");
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
      toast.success("Presupuesto creado correctamente");
      fetchBudgets();
    } catch {
      toast.error("Error al crear el presupuesto");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Deseas eliminar este presupuesto?")) return;
    try {
      await axios.delete(`${api}/budgets/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Presupuesto eliminado");
      fetchBudgets();
    } catch {
      toast.error("Error al eliminar el presupuesto");
    }
  };

  // Estado derivado: ¿están todos seleccionados en el modal?
  const allSelected =
    importItems.length > 0 && importItems.every((it) => it.selected);

  useEffect(() => {
    if (token) {
      fetchCategories();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchBudgets();
    }
  }, [token, filterType, filterValue]);

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold mb-2 text-[#1e40af]">
        Flujos Personales
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        Establece un límite de gasto por categoría cada mes. El sistema te
        mostrará cuánto has utilizado.
      </p>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      >
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

        <div className="col-span-full flex flex-wrap gap-2">
          <button
            type="submit"
            className="w-full md:w-auto bg-[#1e40af] text-white font-semibold px-4 py-2 rounded hover:brightness-90 transition"
          >
            Agregar Flujo
          </button>

          {/* Botón para sugerir desde el mes anterior */}
          <button
            type="button"
            onClick={async () => {
              try {
                setImportLoading(true);
                const res = await axios.get(
                  `${api}/budgets/history-import-preview?month=${month}`,
                  {
                    headers: { Authorization: `Bearer ${token}` },
                  }
                );

                const preview = res.data.data;
                setImportPreview(preview);
                setImportItems(
                  (preview.items || []).map((item) => ({
                    ...item,
                    // Por defecto seleccionamos las que NO tienen presupuesto existente
                    selected: !item.existing_budget_limit,
                  }))
                );
                setShowImportModal(true);
              } catch {
                toast.error(
                  "Error al obtener sugerencias desde el mes anterior"
                );
              } finally {
                setImportLoading(false);
              }
            }}
            className="bg-gray-100 text-gray-800 text-sm px-3 py-2 rounded border border-gray-300 hover:bg-gray-200 transition"
            disabled={importLoading}
          >
            {importLoading
              ? "Cargando sugerencias..."
              : "Sugerir desde mes anterior"}
          </button>
        </div>
      </form>

      {/* 🔍 Filtro por mes o año */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:items-end mb-4">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1">Ver por:</label>
          <select
            value={filterType}
            onChange={(e) => {
              const type = e.target.value;
              setFilterType(type);
              const now = new Date();
              setFilterValue(
                type === "month"
                  ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(
                      2,
                      "0"
                    )}`
                  : `${now.getFullYear()}`
              );
            }}
            className="border border-gray-300 p-2 rounded"
          >
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </select>
        </div>

        <div className="flex flex-col md:col-span-2">
          <label className="text-sm font-medium mb-1">
            {filterType === "month" ? "Seleccionar mes" : "Seleccionar año"}
          </label>
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
              className="border border-gray-300 p-2 rounded"
              placeholder="Año"
            />
          )}
        </div>
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

      {/* Modal de importación desde mes anterior */}
      <Modal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportPreview(null);
          setImportItems([]);
        }}
        title="Sugerir presupuestos desde el mes anterior"
        size="lg"
      >
        {!importPreview || importItems.length === 0 ? (
          <p className="text-sm text-gray-600">
            {importPreview
              ? `No se encontraron gastos en ${importPreview.from_month} para sugerir presupuestos.`
              : "Cargando información..."}
          </p>
        ) : (
          <>
            {/* Texto + Marcar/Desmarcar todos */}
            <div className="flex justify-between items-center mb-3 gap-2">
              <p className="text-sm text-gray-700">
                Basado en tus gastos de{" "}
                <strong>{importPreview.from_month}</strong>, se sugieren
                presupuestos para el mes{" "}
                <strong>{importPreview.to_month}</strong>. Las categorías
                seleccionadas sin presupuesto se crearán con ese monto y, si una
                categoría ya tiene presupuesto, se <strong>actualizará</strong>{" "}
                al valor sugerido del mes anterior.
              </p>
              <button
                type="button"
                className="text-xs text-blue-600 hover:text-blue-800 underline shrink-0"
                onClick={() => {
                  const newValue = !allSelected;
                  setImportItems((prev) =>
                    prev.map((it) => ({ ...it, selected: newValue }))
                  );
                }}
              >
                {allSelected ? "Desmarcar todos" : "Marcar todos"}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded mb-4">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="p-2 text-left">Seleccionar</th>
                    <th className="p-2 text-left">Categoría</th>
                    <th className="p-2 text-right">
                      Gasto {importPreview.from_month}
                    </th>
                    <th className="p-2 text-right">
                      Presupuesto actual {importPreview.to_month}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {importItems.map((item, idx) => (
                    <tr
                      key={item.category_id}
                      className="border-t hover:bg-gray-50"
                    >
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setImportItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, selected: checked } : it
                              )
                            );
                          }}
                        />
                      </td>
                      <td className="p-2">
                        {item.category_name || "Sin nombre"}
                      </td>
                      <td className="p-2 text-right">
                        {item.spent_last_month.toFixed(2)}
                      </td>
                      <td className="p-2 text-right">
                        {item.existing_budget_limit != null
                          ? item.existing_budget_limit.toFixed(2)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Botones: acción primero, cancelar al final */}
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 rounded bg-[#1e40af] text-white"
                type="button"
                onClick={async () => {
                  const selected = importItems.filter((it) => it.selected);

                  if (selected.length === 0) {
                    toast.error(
                      "Selecciona al menos una categoría para importar."
                    );
                    return;
                  }

                  try {
                    const res = await axios.post(
                      `${api}/budgets/history-import`,
                      {
                        month: importPreview.to_month,
                        items: selected.map((it) => ({
                          category_id: it.category_id,
                          limit_amount: it.spent_last_month,
                        })),
                      },
                      {
                        headers: { Authorization: `Bearer ${token}` },
                      }
                    );

                    const { insertedCount, updatedCount } = res.data || {};
                    toast.success(
                      `Presupuestos procesados. Nuevos: ${
                        insertedCount || 0
                      }, actualizados: ${updatedCount || 0}.`
                    );

                    setShowImportModal(false);
                    setImportPreview(null);
                    setImportItems([]);
                    fetchBudgets();
                  } catch {
                    toast.error(
                      "Error al importar presupuestos desde el mes anterior."
                    );
                  }
                }}
              >
                Crear/Actualizar presupuestos
              </button>

              <button
                type="button"
                className="px-4 py-2 rounded border border-gray-300 text-gray-700"
                onClick={() => {
                  setShowImportModal(false);
                  setImportPreview(null);
                  setImportItems([]);
                }}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}

export default Budgets;
