import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Modal from "../components/Modal";
import FFSelect from "../components/FFSelect";
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

  // ✅ Modal eliminar presupuesto
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBudget, setDeleteBudget] = useState(null); // guarda el budget completo para mostrar info
  const [deleteLoading, setDeleteLoading] = useState(false);

  const api = import.meta.env.VITE_API_URL;

  const fetchBudgets = async () => {
    try {
      const params = new URLSearchParams();
      if (filterType === "month") params.append("month", filterValue);
      else params.append("year", filterValue);

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

    // ✅ FFSelect no soporta required: validación explícita
    if (!categoryId) {
      toast.error("Selecciona una categoría");
      return;
    }

    const n = Number(limitAmount);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Ingresa un límite válido");
      return;
    }

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

  const openDeleteModal = (budget) => {
    setDeleteBudget(budget);
    setDeleteOpen(true);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeleteBudget(null);
  };

  const confirmDelete = async () => {
    if (!deleteBudget) return;

    setDeleteLoading(true);
    try {
      await axios.delete(`${api}/budgets/${deleteBudget.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success("Presupuesto eliminado");
      await fetchBudgets();
      closeDeleteModal();
    } catch {
      toast.error("Error al eliminar el presupuesto");
    } finally {
      setDeleteLoading(false);
    }
  };

  // Estado derivado: ¿están todos seleccionados en el modal?
  const allSelected =
    importItems.length > 0 && importItems.every((it) => it.selected);

  useEffect(() => {
    if (token) fetchCategories();
  }, [token]);

  useEffect(() => {
    if (token) fetchBudgets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterType, filterValue]);

  const categoryOptions = useMemo(
    () =>
      categories.map((cat) => ({
        value: cat.id,
        label: cat.name,
      })),
    [categories]
  );

  const filterTypeOptions = useMemo(
    () => [
      { value: "month", label: "Mes" },
      { value: "year", label: "Año" },
    ],
    []
  );

  return (
    <div className="ff-card p-6 space-y-4">
      <h2 className="text-2xl font-bold mb-1 text-[var(--heading-accent)]">
        Flujos Personales
      </h2>

      <p className="text-sm text-[var(--muted)] mb-4">
        Establece un límite de gasto por categoría cada mes. El sistema te
        mostrará cuánto has utilizado.
      </p>

      {/* Formulario de creación de presupuesto */}
      <form
        onSubmit={handleCreate}
        className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      >
        <div className="flex flex-col">
          <label className="ff-label mb-1">Categoría</label>

          <FFSelect
            value={categoryId}
            onChange={(v) => setCategoryId(v)}
            options={categoryOptions}
            placeholder="Selecciona una categoría"
          />
        </div>

        <div className="flex flex-col">
          <label className="ff-label mb-1">Mes</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="ff-input"
            required
          />
        </div>

        <div className="flex items-center mt-2 sm:mt-6">
          <input
            type="checkbox"
            id="repeat"
            checked={repeatYearly}
            onChange={() => setRepeatYearly(!repeatYearly)}
            className="mr-2 h-4 w-4 rounded"
            style={{
              accentColor: "var(--primary)",
            }}
          />
          <label htmlFor="repeat" className="text-sm text-[var(--muted)]">
            Repetir este presupuesto para todo el año
          </label>
        </div>

        <div className="flex flex-col">
          <label className="ff-label mb-1">Límite mensual</label>
          <input
            type="number"
            min="0"
            placeholder="Ej: 500.00"
            value={limitAmount}
            onChange={(e) => setLimitAmount(e.target.value)}
            className="ff-input"
            required
          />
        </div>

        <div className="col-span-full flex flex-wrap gap-2 mt-2">
          <button type="submit" className="ff-btn ff-btn-primary">
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
                  { headers: { Authorization: `Bearer ${token}` } }
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
            className="ff-btn ff-btn-outline"
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
          <label className="ff-label mb-1">Ver por:</label>

          <FFSelect
            value={filterType}
            onChange={(v) => {
              const type = v;
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
            options={filterTypeOptions}
          />
        </div>

        <div className="flex flex-col md:col-span-2">
          <label className="ff-label mb-1">
            {filterType === "month" ? "Seleccionar mes" : "Seleccionar año"}
          </label>

          {filterType === "month" ? (
            <input
              type="month"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="ff-input"
            />
          ) : (
            <input
              type="number"
              min="2000"
              max="2100"
              value={filterValue}
              onChange={(e) => setFilterValue(e.target.value)}
              className="ff-input"
              placeholder="Año"
            />
          )}
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3 text-[var(--heading)]">
        Resumen
      </h3>

      <ul className="space-y-4">
        {budgets.map((b) => {
          const percent = b.spent / b.limit;
          const over = percent >= 1;

          const accent = over ? "var(--danger)" : "var(--success)";

          return (
            <li
              key={b.id}
              className="p-4 rounded-xl"
              style={{
                border: "var(--border-w) solid",
                borderColor: `color-mix(in srgb, ${accent} 55%, var(--border-rgba))`,
                background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                boxShadow: "var(--glow-shadow)",
              }}
            >
              <div className="flex justify-between items-center mb-2 gap-3">
                <div>
                  <p className="font-semibold text-[var(--text)]">
                    {b.category_name} —{" "}
                    <span className="text-[var(--muted)]">{b.month}</span>
                  </p>

                  <p className="text-sm text-[var(--muted)]">
                    Gasto:{" "}
                    <span className="font-semibold text-[var(--text)]">
                      {b.spent.toFixed(2)}
                    </span>{" "}
                    / {b.limit.toFixed(2)}
                  </p>
                </div>

                <button
                  onClick={() => openDeleteModal(b)}
                  className="text-xs font-semibold underline underline-offset-2"
                  style={{
                    color: `color-mix(in srgb, ${accent} 70%, var(--text))`,
                  }}
                >
                  Eliminar
                </button>
              </div>

              <div
                className="w-full h-2 rounded-full overflow-hidden"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 70%, transparent)",
                  border: "var(--border-w) solid",
                  borderColor:
                    "color-mix(in srgb, var(--border-rgba) 55%, transparent)",
                }}
              >
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.min(100, percent * 100)}%`,
                    background: `linear-gradient(
                      90deg,
                      color-mix(in srgb, ${accent} 92%, #000) 0%,
                      color-mix(in srgb, ${accent} 72%, #000) 100%
                    )`,
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
          <p className="text-sm text-[var(--muted)]">
            {importPreview
              ? `No se encontraron gastos en ${importPreview.from_month} para sugerir presupuestos.`
              : "Cargando información..."}
          </p>
        ) : (
          <>
            <div className="flex justify-between items-center mb-3 gap-3">
              <p className="text-sm text-[var(--muted)]">
                Basado en tus gastos de{" "}
                <strong className="text-[var(--text)]">
                  {importPreview.from_month}
                </strong>
                , se sugieren presupuestos para el mes{" "}
                <strong className="text-[var(--text)]">
                  {importPreview.to_month}
                </strong>
                . Las categorías seleccionadas sin presupuesto se crearán con
                ese monto y, si una categoría ya tiene presupuesto, se{" "}
                <strong className="text-[var(--text)]">actualizará</strong> al
                valor sugerido del mes anterior.
              </p>

              <button
                type="button"
                className="text-[11px] font-semibold underline underline-offset-2 shrink-0"
                style={{ color: "var(--primary)" }}
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

            <div className="max-h-96 overflow-y-auto mb-4">
              <table className="ff-table">
                <thead>
                  <tr>
                    <th className="ff-th">Seleccionar</th>
                    <th className="ff-th">Categoría</th>
                    <th className="ff-th" style={{ textAlign: "right" }}>
                      Gasto {importPreview.from_month}
                    </th>
                    <th className="ff-th" style={{ textAlign: "right" }}>
                      Presupuesto actual {importPreview.to_month}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {importItems.map((item, idx) => (
                    <tr key={item.category_id} className="ff-tr">
                      <td className="ff-td">
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
                          style={{ accentColor: "var(--primary)" }}
                        />
                      </td>

                      <td className="ff-td">
                        {item.category_name || "Sin nombre"}
                      </td>

                      <td className="ff-td" style={{ textAlign: "right" }}>
                        {item.spent_last_month.toFixed(2)}
                      </td>

                      <td className="ff-td" style={{ textAlign: "right" }}>
                        {item.existing_budget_limit != null
                          ? item.existing_budget_limit.toFixed(2)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                className="ff-btn ff-btn-primary"
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
                      { headers: { Authorization: `Bearer ${token}` } }
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
                className="ff-btn ff-btn-ghost"
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
      {/* ✅ Modal confirmar eliminación */}
      <Modal
        isOpen={deleteOpen}
        onClose={closeDeleteModal}
        title="Eliminar presupuesto"
        size="sm"
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          ¿Seguro que deseas eliminar el presupuesto de{" "}
          <span style={{ color: "var(--text)", fontWeight: 700 }}>
            {deleteBudget?.category_name || "esta categoría"}
          </span>{" "}
          para{" "}
          <span style={{ color: "var(--text)", fontWeight: 700 }}>
            {deleteBudget?.month || ""}
          </span>
          ? Esta acción no se puede deshacer.
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleteLoading}
            className="ff-btn ff-btn-danger"
          >
            {deleteLoading ? "Eliminando..." : "Sí, eliminar"}
          </button>
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={deleteLoading}
            className="ff-btn ff-btn-outline"
          >
            Cancelar
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default Budgets;
