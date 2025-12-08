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
    <div
      className="
        rounded-2xl p-6
        bg-slate-950/70
        border border-slate-800
        shadow-[0_18px_40px_rgba(0,0,0,0.7)]
        text-slate-100
        space-y-4
      "
    >
      <h2 className="text-2xl font-bold mb-1 text-[#f6e652]">
        Flujos Personales
      </h2>
      <p className="text-sm text-slate-400 mb-4">
        Establece un límite de gasto por categoría cada mes. El sistema te
        mostrará cuánto has utilizado.
      </p>

      {/* Formulario de creación de presupuesto */}
      <form
        onSubmit={handleCreate}
        className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      >
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-slate-300">
            Categoría
          </label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="
              border border-slate-700 bg-slate-900
              text-slate-100 text-sm
              px-3 py-2 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition
            "
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
          <label className="text-sm font-medium mb-1 text-slate-300">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="
              border border-slate-700 bg-slate-900
              text-slate-100 text-sm
              px-3 py-2 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition
            "
            required
          />
        </div>

        <div className="flex items-center mt-2 sm:mt-6">
          <input
            type="checkbox"
            id="repeat"
            checked={repeatYearly}
            onChange={() => setRepeatYearly(!repeatYearly)}
            className="mr-2 h-4 w-4 text-emerald-500 bg-slate-900 border-slate-600 rounded"
          />
          <label htmlFor="repeat" className="text-sm text-slate-300">
            Repetir este presupuesto para todo el año
          </label>
        </div>

        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-slate-300">
            Límite mensual
          </label>
          <input
            type="number"
            min="0"
            placeholder="Ej: 500.00"
            value={limitAmount}
            onChange={(e) => setLimitAmount(e.target.value)}
            className="
              border border-slate-700 bg-slate-900
              text-slate-100 text-sm
              px-3 py-2 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition
            "
            required
          />
        </div>

        <div className="col-span-full flex flex-wrap gap-2 mt-2">
          <button
            type="submit"
            className="
              w-full md:w-auto
              bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
              text-slate-950 font-semibold
              px-4 py-2 rounded-lg text-sm
              shadow-[0_0_16px_rgba(16,185,129,0.6)]
              hover:brightness-110 active:scale-95
              transition
            "
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
            className="
              bg-slate-900 text-slate-200 text-sm
              px-3 py-2 rounded-lg
              border border-slate-600
              hover:bg-slate-800 hover:border-slate-500
              active:scale-95
              transition
            "
            disabled={importLoading}
          >
            {importLoading
              ? "Cargando sugerencias..."
              : "Sugerir desde mes anterior"}
          </button>
        </div>
      </form>

      {/* 🔍 Filtro por mes o año */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:items-end mb-4">
        <div className="flex flex-col">
          <label className="text-sm font-medium mb-1 text-slate-300">
            Ver por:
          </label>
          <select
            value={filterType}
            onChange={(e) => {
              const type = e.target.value;
              setFilterType(type);
              const now = new Date();
              setFilterValue(
                type === "month"
                  ? `${now.getFullYear()}-${String(
                      now.getMonth() + 1
                    ).padStart(2, "0")}`
                  : `${now.getFullYear()}`
              );
            }}
            className="
              border border-slate-700 bg-slate-900
              text-slate-100 text-sm
              px-3 py-2 rounded-lg
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition
            "
          >
            <option value="month">Mes</option>
            <option value="year">Año</option>
          </select>
        </div>

        <div className="flex flex-col md:col-span-2">
          <label className="text-sm font-medium mb-1 text-slate-300">
            {filterType === "month" ? "Seleccionar mes" : "Seleccionar año"}
          </label>
          {filterType === "month" ? (
            <input
              type="month"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="
                border border-slate-700 bg-slate-900
                text-slate-100 text-sm
                px-3 py-2 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition
              "
            />
          ) : (
            <input
              type="number"
              min="2000"
              max="2100"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="
                border border-slate-700 bg-slate-900
                text-slate-100 text-sm
                px-3 py-2 rounded-lg
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition
              "
              placeholder="Año"
            />
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3 text-slate-200">Resumen</h3>
      <ul className="space-y-4">
        {budgets.map((b) => {
          const percent = b.spent / b.limit;
          const over = percent >= 1;

          return (
            <li
              key={b.id}
              className={`
                p-4 rounded-xl border
                ${
                  over
                    ? "border-rose-500/70 bg-rose-950/40"
                    : "border-emerald-500/70 bg-emerald-950/40"
                }
                shadow-[0_10px_30px_rgba(0,0,0,0.45)]
              `}
            >
              <div className="flex justify-between items-center mb-2 gap-3">
                <div>
                  <p className="font-semibold text-slate-100">
                    {b.category_name} —{" "}
                    <span className="text-slate-300">{b.month}</span>
                  </p>
                  <p className="text-sm text-slate-300">
                    Gasto:{" "}
                    <span className="font-semibold text-slate-100">
                      {b.spent.toFixed(2)}
                    </span>{" "}
                    / {b.limit.toFixed(2)}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(b.id)}
                  className="
                    text-xs font-semibold
                    text-rose-300 hover:text-rose-200
                    underline underline-offset-2
                  "
                >
                  Eliminar
                </button>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className={`
                    h-2 rounded-full
                    ${
                      over
                        ? "bg-gradient-to-r from-rose-500 via-rose-400 to-rose-300"
                        : "bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-300"
                    }
                  `}
                  style={{
                    width: `${Math.min(100, percent * 100)}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/* Modal de importación desde mes anterior (ya dark) */}
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
          <p className="text-sm text-slate-300">
            {importPreview
              ? `No se encontraron gastos en ${importPreview.from_month} para sugerir presupuestos.`
              : "Cargando información..."}
          </p>
        ) : (
          <>
            {/* Texto + Marcar/Desmarcar todos */}
            <div className="flex justify-between items-center mb-3 gap-3 text-slate-200">
              <p className="text-sm text-slate-300">
                Basado en tus gastos de{" "}
                <strong className="text-slate-100">
                  {importPreview.from_month}
                </strong>
                , se sugieren presupuestos para el mes{" "}
                <strong className="text-slate-100">
                  {importPreview.to_month}
                </strong>
                . Las categorías seleccionadas sin presupuesto se crearán con
                ese monto y, si una categoría ya tiene presupuesto, se{" "}
                <strong className="text-slate-100">actualizará</strong> al
                valor sugerido del mes anterior.
              </p>
              <button
                type="button"
                className="
                  text-[11px] font-semibold
                  text-emerald-300 hover:text-emerald-200
                  underline underline-offset-2
                  shrink-0
                "
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

            {/* Tabla */}
            <div className="max-h-96 overflow-y-auto border border-slate-800 rounded-lg mb-4 bg-slate-950/40">
              <table className="w-full text-xs sm:text-sm">
                <thead className="bg-slate-900/80 border-b border-slate-800">
                  <tr>
                    <th className="p-2 text-left text-slate-300">
                      Seleccionar
                    </th>
                    <th className="p-2 text-left text-slate-300">Categoría</th>
                    <th className="p-2 text-right text-slate-300">
                      Gasto {importPreview.from_month}
                    </th>
                    <th className="p-2 text-right text-slate-300">
                      Presupuesto actual {importPreview.to_month}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {importItems.map((item, idx) => (
                    <tr
                      key={item.category_id}
                      className={
                        idx % 2 === 0
                          ? "border-t border-slate-800 bg-slate-950/40 hover:bg-slate-900/70"
                          : "border-t border-slate-800 bg-slate-900/60 hover:bg-slate-900"
                      }
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
                      <td className="p-2 text-slate-200">
                        {item.category_name || "Sin nombre"}
                      </td>
                      <td className="p-2 text-right text-slate-100">
                        {item.spent_last_month.toFixed(2)}
                      </td>
                      <td className="p-2 text-right text-slate-100">
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
            <div className="flex justify-end gap-2 pt-1">
              <button
                className="
                  px-4 py-2 text-sm font-semibold rounded-lg
                  bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
                  text-slate-950
                  shadow-[0_0_16px_rgba(16,185,129,0.6)]
                  hover:brightness-110
                  active:scale-95
                  transition-all
                "
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
                className="
                  px-4 py-2 text-sm font-semibold rounded-lg
                  border border-slate-600
                  bg-slate-900 text-slate-300
                  hover:bg-slate-800 hover:border-slate-500
                  active:scale-95
                  transition-all
                "
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
