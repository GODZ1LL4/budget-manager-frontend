// src/components/ScenarioManager.jsx
import { useEffect, useMemo, useState, useCallback } from "react";
import axios from "axios";
import dayjs from "dayjs";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
dayjs.extend(isSameOrBefore);

import ImportBudgetModal from "./ImportBudgetModal";
import CollapseSection from "./CollapseSection";
import ScenarioForm from "./ScenarioForm";
import ScenarioCalendar from "./ScenarioCalendar";
import Modal from "./Modal";
import TransactionForm from "./TransactionForm";
import { toast } from "react-toastify";

function Sparkline({ values = [], width = 240, height = 48, padding = 6 }) {
  const clean = Array.isArray(values)
    ? values.filter((v) => Number.isFinite(v))
    : [];

  if (clean.length === 0) return null;

  const max = Math.max(...clean);
  const min = Math.min(...clean);
  const range = max - min || 1;

  if (clean.length === 1) {
    const y = height / 2;
    const x1 = padding;
    const x2 = width - padding;
    return (
      <svg width={width} height={height} className="w-full h-12">
        <line x1={x1} y1={y} x2={x2} y2={y} stroke="currentColor" strokeWidth="2" />
      </svg>
    );
  }

  const step = (width - padding * 2) / (clean.length - 1);

  const points = clean
    .map((v, i) => {
      const x = padding + i * step;
      const y = height - padding - ((v - min) / range) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="w-full h-12">
      <polyline fill="none" stroke="currentColor" strokeWidth="2" points={points} />
    </svg>
  );
}

function BudgetsDiff({ aiMonth, aiBudgets, currentBudgets, categoriesById }) {
  const currentByCat = useMemo(() => {
    const m = new Map();
    for (const b of currentBudgets || []) {
      if (aiMonth && b.month !== aiMonth) continue;
      m.set(b.category_id, Number(b.limit_amount || 0));
    }
    return m;
  }, [currentBudgets, aiMonth]);

  return (
    <div className="mt-4 text-slate-200">
      <h5 className="font-semibold text-slate-100 mb-1">
        Cambios de presupuesto
      </h5>
      <div className="text-xs text-slate-400 mb-2">
        Comparación contra presupuestos actuales del mes{" "}
        <span className="font-semibold text-slate-200">
          {aiMonth || "(mes del plan)"}
        </span>
        .
      </div>
      <ul className="space-y-1 text-sm">
        {(aiBudgets || []).map((b, i) => {
          const prev = currentByCat.get(b.category_id) ?? 0;
          const diff = Number(b.amount) - prev;
          const catName =
            b.category_name ||
            (b.category_id ? categoriesById.get(b.category_id) : null) ||
            "Sin categoría";
          return (
            <li
              key={i}
              className="flex justify-between border-b border-slate-800 py-1"
            >
              <span className="text-slate-200">{catName}</span>
              <span
                className={
                  diff === 0
                    ? "text-slate-200"
                    : diff > 0
                    ? "text-rose-300"
                    : "text-emerald-300"
                }
              >
                RD$ {prev.toFixed(2)} →{" "}
                <strong>RD$ {Number(b.amount).toFixed(2)}</strong>
                {diff !== 0
                  ? ` (${diff > 0 ? "+" : ""}${diff.toFixed(2)})`
                  : ""}
              </span>
            </li>
          );
        })}
        {(!aiBudgets || aiBudgets.length === 0) && (
          <li className="text-slate-500 italic">
            Sin sugerencias de presupuesto
          </li>
        )}
      </ul>
    </div>
  );
}

function ScenarioManager({ token }) {
  const [scenarios, setScenarios] = useState([]);
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [projection, setProjection] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    amount: 0,
    type: "expense",
    category_id: null,
  });
  const [editMode, setEditMode] = useState(false);
  const [editId, setEditId] = useState(null);
  const [categories, setCategories] = useState([]);

  const [showEditScenario, setShowEditScenario] = useState(false);
  const [scenarioForm, setScenarioForm] = useState({
    name: "",
    description: "",
  });
  const [scenarioEditingId, setScenarioEditingId] = useState(null);

  const [calendarRange, setCalendarRange] = useState({
    start: dayjs().startOf("month").format("YYYY-MM-DD"),
    end: dayjs().endOf("month").add(1, "day").format("YYYY-MM-DD"), // end exclusivo
  });

  const visibleMonthKey = useMemo(() => {
    return dayjs(calendarRange.start).add(15, "day").format("YYYY-MM");
  }, [calendarRange]);

  const monthProjection = useMemo(
    () =>
      (projection || []).filter(
        (tx) => dayjs(tx.date).format("YYYY-MM") === visibleMonthKey
      ),
    [projection, visibleMonthKey]
  );

  const stats = useMemo(() => {
    let income = 0;
    let expense = 0;
    const categoryTotals = {};
    for (const tx of monthProjection) {
      const amt = Number(tx.amount || 0);
      if (tx.type === "income") income += amt;
      if (tx.type === "expense") {
        expense += amt;
        const cat = tx.category_name || "Sin categoría";
        categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
      }
    }
    return {
      balance: income - expense,
      totalIncome: income,
      totalExpense: expense,
      categoryTotals,
    };
  }, [monthProjection]);

  const api = import.meta.env.VITE_API_URL;

  useEffect(() => {
    let isMounted = true;
    const fetchAll = async () => {
      try {
        const [scenariosRes, categoriesRes] = await Promise.all([
          axios.get(`${api}/scenarios`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${api}/categories`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (isMounted) {
          setScenarios(scenariosRes.data.data || []);
          setCategories(categoriesRes.data.data || []);
        }
      } catch (err) {
        console.error("❌ Error al cargar escenarios o categorías:", err);
      }
    };
    if (token) fetchAll();
    return () => {
      isMounted = false;
    };
  }, [token, api]);

  const fetchProjectionRange = async (id, start, end) => {
    try {
      const res = await axios.get(`${api}/scenarios/${id}/projection`, {
        params: { start, end },
        headers: { Authorization: `Bearer ${token}` },
      });
      setProjection(res.data.data || []);
    } catch (err) {
      console.error("❌ Error al obtener proyección:", err);
    }
  };

  const handleSelectScenario = (scenario) => {
    setSelectedScenario(scenario);
    const start = dayjs().startOf("month").format("YYYY-MM-DD");
    const endExclusive = dayjs()
      .endOf("month")
      .add(1, "day")
      .format("YYYY-MM-DD");
    setCalendarRange({ start, end: endExclusive });
    fetchProjectionRange(scenario.id, start, endExclusive);
  };

  const handleDateRangeSelect = (start, end) => {
    const correctedEnd = dayjs(end).subtract(1, "day").format("YYYY-MM-DD");
    setSelectedDate({ start, end: correctedEnd });
    setFormData({ name: "", amount: 0, type: "expense", category_id: null });
    setEditMode(false);
    setEditId(null);
    setShowModal(true);
  };

  const handleEventClick = async (info) => {
    const realId = info.event.extendedProps?.realId;
    if (!realId) return;
    try {
      const res = await axios.get(
        `${api}/scenarios/scenario_transactions/${realId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const tx = res.data.data;
      setFormData({
        name: tx.name,
        amount: tx.amount,
        type: tx.type,
        category_id: tx.category_id || null,
      });
      setSelectedDate({
        start: tx.start_date,
        end: tx.end_date || tx.start_date,
      });
      setEditMode(true);
      setEditId(tx.id);
      setShowModal(true);
    } catch (err) {
      console.error("❌ Error al cargar transacción:", err);
      alert("No se pudo cargar la transacción.");
    }
  };

  const handleSaveTransaction = async () => {
    try {
      if (editMode && editId) {
        await axios.put(
          `${api}/scenarios/scenario_transactions/${editId}`,
          {
            name: formData.name,
            amount: formData.amount,
            type: formData.type,
            category_id: formData.category_id || null,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      } else {
        await axios.post(
          `${api}/scenarios/scenario_transactions`,
          {
            scenario_id: selectedScenario.id,
            name: formData.name,
            amount: formData.amount,
            type: formData.type,
            category_id: formData.category_id || null,
            start_date: selectedDate.start,
            end_date: selectedDate.end,
            recurrence: null,
            exclude_weekends: false,
          },
          { headers: { Authorization: `Bearer ${token}` } }
        );
      }

      if (selectedScenario) {
        await fetchProjectionRange(
          selectedScenario.id,
          calendarRange.start,
          calendarRange.end
        );
      }

      setShowModal(false);
      setEditMode(false);
      setEditId(null);
      setFormData({ name: "", amount: 0, type: "expense", category_id: null });
    } catch (err) {
      console.error("❌ Error al guardar transacción:", err);
      alert("Error al guardar transacción.");
    }
  };

  const handleDeleteTransaction = async () => {
    if (!editId || !confirm("¿Eliminar esta transacción?")) return;
    try {
      await axios.delete(`${api}/scenarios/scenario_transactions/${editId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (selectedScenario) {
        await fetchProjectionRange(
          selectedScenario.id,
          calendarRange.start,
          calendarRange.end
        );
      }

      setShowModal(false);
      setEditMode(false);
      setEditId(null);
    } catch (err) {
      console.error("❌ Error al eliminar transacción:", err);
      alert("No se pudo eliminar la transacción.");
    }
  };

  const handleUpdateScenario = async () => {
    try {
      const res = await axios.put(
        `${api}/scenarios/${scenarioEditingId}`,
        { name: scenarioForm.name, description: scenarioForm.description },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setScenarios((prev) =>
        prev.map((s) =>
          s.id === scenarioEditingId ? { ...s, ...res.data.data } : s
        )
      );
      if (selectedScenario?.id === scenarioEditingId) {
        setSelectedScenario((prev) => ({ ...prev, ...res.data.data }));
      }
      setShowEditScenario(false);
      setScenarioEditingId(null);
    } catch (err) {
      console.error("❌ Error al actualizar escenario:", err);
      alert("No se pudo actualizar el escenario.");
    }
  };

  const handleDeleteScenario = async (id) => {
    if (
      !confirm(
        "¿Eliminar este escenario? Se borrarán sus transacciones simuladas."
      )
    )
      return;
    try {
      await axios.delete(`${api}/scenarios/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setScenarios((prev) => prev.filter((s) => s.id !== id));
      if (selectedScenario?.id === id) {
        setSelectedScenario(null);
        setProjection([]);
      }
    } catch (err) {
      console.error("❌ Error al eliminar escenario:", err);
      alert(err.response?.data?.error || "No se pudo eliminar el escenario.");
    }
  };

  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importScope, setImportScope] = useState("current");
  const [importLoading, setImportLoading] = useState(false);
  const [, setImportConflicts] = useState([]);

  const fetchImportPreview = useCallback(
    async (scope = "current") => {
      if (!selectedScenario) return;
      setImportLoading(true);
      try {
        const res = await axios.get(
          `${api}/scenarios/${selectedScenario.id}/budget-import-preview`,
          {
            params: { scope },
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setImportPreview(res.data.data || null);
        setImportConflicts(res.data.data?.conflicts || []);
      } catch (err) {
        console.error("❌ Error al obtener preview de importación:", err);
        alert("No se pudo obtener el preview de importación.");
      } finally {
        setImportLoading(false);
      }
    },
    [api, token, selectedScenario]
  );

  return (
    <div className="p-6 space-y-6 text-slate-200">
      <h2 className="text-2xl font-bold text-slate-200 flex items-center justify-between">
        Escenarios
      </h2>

      {/* Formulario (ya dark) */}
      <ScenarioForm
        token={token}
        onSuccess={() => {
          setSelectedScenario(null);
          setProjection([]);
          axios
            .get(`${api}/scenarios`, {
              headers: { Authorization: `Bearer ${token}` },
            })
            .then((res) => setScenarios(res.data.data || []))
            .catch((err) =>
              console.error("❌ Error recargando escenarios:", err)
            );
        }}
      />

      {/* Lista de escenarios */}
      <div className="mt-4">
        <h3 className="text-lg font-semibold text-slate-100 mb-2">
          Escenarios guardados
        </h3>
        <ul className="space-y-2">
          {scenarios.map((sc) => {
            const isActive = selectedScenario?.id === sc.id;
            return (
              <li
                key={sc.id}
                className={`
                  p-3 rounded-xl border
                  bg-slate-900/70 border-slate-800
                  hover:bg-slate-900 transition-colors
                  cursor-pointer
                  ${isActive ? "ring-1 ring-emerald-500/70" : ""}
                `}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex-1"
                    onClick={() => handleSelectScenario(sc)}
                  >
                    <p className="font-semibold text-slate-100">{sc.name}</p>
                    <p className="text-xs text-slate-400">
                      {sc.description || "Sin descripción"}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="
                        text-xs px-3 py-1.5 rounded-lg
                        border border-slate-600
                        bg-slate-950 text-slate-200
                        hover:bg-slate-900 hover:border-slate-500
                        transition-colors
                      "
                      onClick={() => {
                        setScenarioForm({
                          name: sc.name,
                          description: sc.description || "",
                        });
                        setScenarioEditingId(sc.id);
                        setShowEditScenario(true);
                      }}
                    >
                      Editar
                    </button>
                    <button
                      className="
                        text-xs px-3 py-1.5 rounded-lg
                        border border-rose-600/70
                        bg-rose-900/30 text-rose-200
                        hover:bg-rose-900/50
                        transition-colors
                      "
                      onClick={() => handleDeleteScenario(sc.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {selectedScenario && (
        <>
          {/* Panel de estadísticas */}
          <div
            className="
              mt-4 rounded-2xl p-4 md:p-5
              bg-gradient-to-br from-slate-950 via-slate-900 to-slate-900
              border border-slate-800
              shadow-[0_16px_40px_rgba(0,0,0,0.85)]
            "
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  Estadísticas del escenario
                </h3>
                <p className="text-xs text-slate-400">
                  Resumen del mes visible en el calendario.
                </p>
              </div>
              <button
                className="
                  bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm
                  hover:brightness-110 active:scale-95
                  transition-all
                "
                onClick={() => {
                  setImportScope("current");
                  setShowImportModal(true);
                  fetchImportPreview("current");
                }}
              >
                Importar a presupuesto
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-xs text-slate-400">Balance</p>
                <p
                  className={`text-xl font-bold mt-1 ${
                    stats.balance >= 0 ? "text-emerald-300" : "text-rose-300"
                  }`}
                >
                  RD$ {stats.balance.toFixed(2)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-xs text-slate-400">Total ingresos</p>
                <p className="text-xl font-bold mt-1 text-emerald-300">
                  RD$ {stats.totalIncome.toFixed(2)}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                <p className="text-xs text-slate-400">Total gastos</p>
                <p className="text-xl font-bold mt-1 text-rose-300">
                  RD$ {stats.totalExpense.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2 text-slate-100">
                Gastos por categoría
              </h4>
              <ul className="space-y-1 text-xs md:text-sm text-slate-200">
                {Object.entries(stats.categoryTotals).map(([cat, total]) => (
                  <li
                    key={cat}
                    className="flex justify-between border-b border-slate-800 py-1"
                  >
                    <span>{cat}</span>
                    <span className="text-right font-medium">
                      RD$ {total.toFixed(2)}
                    </span>
                  </li>
                ))}
                {Object.keys(stats.categoryTotals).length === 0 && (
                  <li className="text-slate-500 italic">
                    No hay gastos registrados
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Calendario */}
          <ScenarioCalendar
            projection={projection}
            onDateRangeSelect={handleDateRangeSelect}
            onEventClick={handleEventClick}
            onViewRangeChange={(start, end) => {
              setCalendarRange({ start, end });
              if (selectedScenario) {
                fetchProjectionRange(selectedScenario.id, start, end);
              }
            }}
          />

          {/* Lista de transacciones proyectadas */}
          <CollapseSection title="Transacciones proyectadas">
            <ul className="space-y-3">
              {monthProjection.map((tx) => (
                <li
                  key={`${tx.id}-${tx.date}`}
                  className="
                    p-3 rounded-xl
                    bg-slate-900/70 border border-slate-800
                    flex flex-col sm:flex-row sm:justify-between sm:items-center
                  "
                >
                  <div>
                    <p className="font-medium text-slate-100">
                      <span
                        className={
                          tx.type === "income"
                            ? "text-emerald-300"
                            : "text-rose-300"
                        }
                      >
                        {tx.type === "income" ? "+" : "-"}RD$
                        {tx.amount.toFixed(2)}
                      </span>{" "}
                      — {tx.name}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {tx.date} — {tx.category_name || "Sin categoría"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </CollapseSection>
        </>
      )}

      {/* Modal: crear/editar transacción simulada */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          setShowModal(false);
          setEditMode(false);
          setEditId(null);
        }}
        title={
          editMode
            ? `Editar transacción del ${selectedDate?.start} al ${selectedDate?.end}`
            : `Agregar transacción del ${selectedDate?.start} al ${selectedDate?.end}`
        }
      >
        <TransactionForm
          formData={formData}
          setFormData={setFormData}
          categories={categories}
          onCancel={() => setShowModal(false)}
          onSave={handleSaveTransaction}
          onDelete={editMode ? handleDeleteTransaction : null}
          isEditing={editMode}
        />
      </Modal>

      {/* Modal: editar escenario */}
      <Modal
        isOpen={showEditScenario}
        onClose={() => {
          setShowEditScenario(false);
          setScenarioEditingId(null);
        }}
        title="Editar escenario"
      >
        <div className="space-y-4 text-slate-200">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Nombre</label>
            <input
              type="text"
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              placeholder="Ej: Escenario base, Plan agresivo..."
              value={scenarioForm.name}
              onChange={(e) =>
                setScenarioForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">
              Descripción
            </label>
            <input
              type="text"
              className="
                w-full rounded-lg px-3 py-2 text-sm
                bg-slate-900 border border-slate-700
                text-slate-100 placeholder:text-slate-500
                focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                transition-colors
              "
              placeholder="Descripción corta del escenario (opcional)"
              value={scenarioForm.description}
              onChange={(e) =>
                setScenarioForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="
                px-4 py-2 text-sm font-semibold rounded-lg
                bg-gradient-to-r from-emerald-500 via-emerald-500 to-emerald-400
                text-slate-950
                shadow-[0_0_16px_rgba(16,185,129,0.6)]
                hover:brightness-110
                active:scale-95
                transition-all
              "
              onClick={handleUpdateScenario}
            >
              Guardar
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
              onClick={() => setShowEditScenario(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Importación de budgets */}
      <ImportBudgetModal
        isOpen={showImportModal}
        onClose={() => {
          setShowImportModal(false);
          setImportPreview(null);
          setImportConflicts([]);
        }}
        scope={importScope}
        setScope={(s) => {
          setImportScope(s);
          fetchImportPreview(s);
        }}
        loading={importLoading}
        preview={importPreview}
        onConfirm={async ({ strategy }) => {
          try {
            const res = await axios.post(
              `${api}/scenarios/${selectedScenario.id}/import-to-budgets`,
              { scope: importScope, strategy },
              { headers: { Authorization: `Bearer ${token}` } }
            );
            const { inserted, updated, skipped } = res.data.data || {};
            toast.success(
              `Presupuesto importado ✅\nInsertados: ${inserted}, Actualizados: ${updated}, Omitidos: ${skipped}`,
              { duration: 5000 }
            );

            setShowImportModal(false);
            setImportPreview(null);
            setImportConflicts([]);
          } catch (err) {
            console.error("❌ Error al importar a budgets:", err);
            toast.error(
              err.response?.data?.error || "No se pudo importar a presupuesto."
            );
          }
        }}
      />
    </div>
  );
}

export default ScenarioManager;
