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
import ConfirmModal from "./ConfirmModal";

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
        <line
          x1={x1}
          y1={y}
          x2={x2}
          y2={y}
          stroke="currentColor"
          strokeWidth="2"
        />
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
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        points={points}
      />
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

  // PROJECTION normal (lo que viene de /projection)
  const [projection, setProjection] = useState([]);

  // ✅ NUEVO: preview avanzado (solo UI, no guardado)
  const [advEnabled, setAdvEnabled] = useState(false);
  const [advPreview, setAdvPreview] = useState([]);
  const [advMeta, setAdvMeta] = useState(null);
  const [advLoading, setAdvLoading] = useState(false);

  // ✅ NUEVO: params ajustables para predicción avanzada
  const [advParams, setAdvParams] = useState({
    months: 12,
    min_occurrences: 3,
    include_occasional: false,
    include_noise: true,
    min_interval_days: 3,
    max_interval_days: 70,
    max_coef_variation: 0.6,
  });

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

  const [confirmDeleteScenarioOpen, setConfirmDeleteScenarioOpen] =
    useState(false);
  const [scenarioToDelete, setScenarioToDelete] = useState(null);
  const [deleteScenarioLoading, setDeleteScenarioLoading] = useState(false);

  // ✅ NUEVO: merge de eventos (lo que pinta el calendario)
  const mergedProjection = useMemo(() => {
    if (!advEnabled) return projection || [];
    return [...(projection || []), ...(advPreview || [])];
  }, [projection, advPreview, advEnabled]);

  const visibleMonthKey = useMemo(() => {
    return dayjs(calendarRange.start).add(15, "day").format("YYYY-MM");
  }, [calendarRange]);

  const monthProjection = useMemo(
    () =>
      (mergedProjection || []).filter(
        (tx) => dayjs(tx.date).format("YYYY-MM") === visibleMonthKey
      ),
    [mergedProjection, visibleMonthKey]
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

  const [focusedMonthStart, setFocusedMonthStart] = useState(
    dayjs().startOf("month").format("YYYY-MM-DD")
  );

  const [confirmDeleteTxOpen, setConfirmDeleteTxOpen] = useState(false);
  const [deleteTxLoading, setDeleteTxLoading] = useState(false);
  const [txToDelete, setTxToDelete] = useState(null);
  // opcional: guarda info para mostrar en el modal (nombre/fecha/monto)

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

  // ✅ NUEVO: fetch preview avanzado (rango visible)
  const fetchAdvancedPreview = useCallback(
    async (scenarioId, start, end) => {
      if (!scenarioId || !advEnabled) return;

      setAdvLoading(true);
      try {
        const res = await axios.get(
          `${api}/scenarios/${scenarioId}/advanced-forecast/preview`,
          {
            params: {
              start,
              end,
              ...advParams,
            },
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        // Normaliza a shape similar a projection (ScenarioCalendar lo espera)
        const rows = (res.data.data || []).map((e) => ({
          id: e.instance_key || `adv-${scenarioId}-${e.date}`,
          date: e.date,
          name: e.name,
          amount: Number(e.amount || 0),
          type: e.type || "expense",
          category_id: e.category_id || null,
          category_name: e.category_name || "Sin categoría",
          account_id: e.account_id || null,
          account_name: e.account_name || null,
          isProjected: true,
          // para que onEventClick no intente abrirlo como realId
          realId: null,
          // opcional: etiqueta
          source: "advanced_forecast",
        }));

        setAdvPreview(rows);
        setAdvMeta(res.data.meta || null);
      } catch (err) {
        console.error("❌ Error preview advanced forecast:", err);
        toast.error("No se pudo cargar el preview de predicción avanzada.");
        setAdvPreview([]);
        setAdvMeta(null);
      } finally {
        setAdvLoading(false);
      }
    },
    [api, token, advEnabled, advParams]
  );

  // ✅ NUEVO: registrar forecast avanzado (replace)
  const registerAdvancedForecast = async () => {
    if (!selectedScenario) return;

    try {
      setAdvLoading(true);

      const mStart = dayjs(focusedMonthStart)
        .startOf("month")
        .format("YYYY-MM-DD");
      const mEnd = dayjs(focusedMonthStart).endOf("month").format("YYYY-MM-DD"); // inclusivo

      const res = await axios.post(
        `${api}/scenarios/${selectedScenario.id}/advanced-forecast/register`,
        {
          focused: focusedMonthStart, // 👈 recomendado
          start: mStart, // opcional, por compat
          end: mEnd, // inclusivo
          params: advParams,
          mode: "replace",
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      toast.success(
        `✅ Registradas ${
          res.data.inserted || 0
        } transacciones simuladas (predicción avanzada).`
      );

      // refrescar proyección real del escenario (ya incluye lo registrado)
      await fetchProjectionRange(
        selectedScenario.id,
        calendarRange.start,
        calendarRange.end
      );

      // limpiar preview (opcional)
      setAdvPreview([]);
      setAdvMeta(null);
      setAdvEnabled(false);
    } catch (err) {
      console.error("❌ Error register advanced forecast:", err);
      toast.error(
        err.response?.data?.error ||
          "No se pudo registrar la predicción avanzada."
      );
    } finally {
      setAdvLoading(false);
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

    // reset de preview avanzado al cambiar escenario
    setAdvPreview([]);
    setAdvMeta(null);
    setAdvEnabled(false);

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
    // ✅ si es forecast avanzado (no realId), no abrir editor
    const realId = info.event.extendedProps?.realId;
    const src = info.event.extendedProps?.source;
    if (!realId) {
      if (src === "advanced_forecast") {
        toast.info(
          "Esto es un preview de predicción avanzada. Regístralo para editarlo."
        );
      }
      return;
    }

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

        // si preview está encendido, refrescarlo también
        if (advEnabled) {
          await fetchAdvancedPreview(
            selectedScenario.id,
            calendarRange.start,
            calendarRange.end
          );
        }
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
    const id = txToDelete?.id || editId;
    if (!id) return;

    try {
      setDeleteTxLoading(true);

      await axios.delete(`${api}/scenarios/scenario_transactions/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (selectedScenario) {
        await fetchProjectionRange(
          selectedScenario.id,
          calendarRange.start,
          calendarRange.end
        );

        if (advEnabled) {
          await fetchAdvancedPreview(
            selectedScenario.id,
            calendarRange.start,
            calendarRange.end
          );
        }
      }

      toast.success("Transacción eliminada ✅");

      // cerrar todo
      setShowModal(false);
      setEditMode(false);
      setEditId(null);

      setConfirmDeleteTxOpen(false);
      setTxToDelete(null);
    } catch (err) {
      console.error("❌ Error al eliminar transacción:", err);
      toast.error("No se pudo eliminar la transacción.");
    } finally {
      setDeleteTxLoading(false);
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
    try {
      setDeleteScenarioLoading(true);

      await axios.delete(`${api}/scenarios/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setScenarios((prev) => prev.filter((s) => s.id !== id));

      if (selectedScenario?.id === id) {
        setSelectedScenario(null);
        setProjection([]);
        setAdvPreview([]);
        setAdvMeta(null);
        setAdvEnabled(false);
      }

      toast.success("Escenario eliminado ✅");
    } catch (err) {
      console.error("❌ Error al eliminar escenario:", err);
      toast.error(
        err.response?.data?.error || "No se pudo eliminar el escenario."
      );
    } finally {
      setDeleteScenarioLoading(false);
      setConfirmDeleteScenarioOpen(false);
      setScenarioToDelete(null);
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
    <div className="p-6 space-y-6 text-[var(--text)]">
      <h2 className="ff-h2 flex items-center justify-between">
        <span className="ff-heading-accent">Escenarios</span>
      </h2>

      <ScenarioForm
        token={token}
        onSuccess={() => {
          setSelectedScenario(null);
          setProjection([]);
          setAdvPreview([]);
          setAdvMeta(null);
          setAdvEnabled(false);
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

      <div className="mt-4">
        <h3 className="text-lg font-semibold text-[var(--text)] mb-2">
          Escenarios guardados
        </h3>

        <ul className="space-y-2">
          {scenarios.map((sc) => {
            const isActive = selectedScenario?.id === sc.id;
            return (
              <li
                key={sc.id}
                className="p-3 rounded-[var(--radius-lg)] border transition-colors cursor-pointer"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 75%, transparent)",
                  borderColor: "var(--border-rgba)",
                  boxShadow: "var(--glow-shadow)",
                  outline: isActive
                    ? `1px solid color-mix(in srgb, var(--primary) 55%, transparent)`
                    : "none",
                }}
              >
                <div className="flex items-start justify-between gap-2">
                  <div
                    className="flex-1"
                    onClick={() => handleSelectScenario(sc)}
                  >
                    <p className="font-semibold text-[var(--text)]">
                      {sc.name}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {sc.description || "Sin descripción"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="ff-btn ff-btn-outline ff-btn-sm"
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
                      type="button"
                      className="ff-btn ff-btn-danger ff-btn-sm"
                      onClick={() => {
                        setScenarioToDelete(sc);
                        setConfirmDeleteScenarioOpen(true);
                      }}
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
          {/* ✅ PANEL: Predicción avanzada */}
          <div className="ff-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">
                  Predicción avanzada (preview → registrar)
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Ajusta parámetros, previsualiza en el calendario y luego
                  registra para importar a presupuesto.
                </p>

                {advMeta?.history_from && (
                  <p
                    className="text-xs mt-1"
                    style={{
                      color:
                        "color-mix(in srgb, var(--muted) 70%, transparent)",
                    }}
                  >
                    Histórico usado:{" "}
                    <span className="font-semibold text-[var(--text)]">
                      {advMeta.history_from}
                    </span>{" "}
                    →{" "}
                    <span className="font-semibold text-[var(--text)]">
                      {advMeta.history_to}
                    </span>
                  </p>
                )}
              </div>

              <label
                className="flex items-center gap-2 text-sm"
                style={{ color: "var(--text)" }}
              >
                <input
                  type="checkbox"
                  checked={advEnabled}
                  onChange={async (e) => {
                    const on = e.target.checked;
                    setAdvEnabled(on);
                    setAdvPreview([]);
                    setAdvMeta(null);

                    if (on) {
                      await fetchAdvancedPreview(
                        selectedScenario.id,
                        calendarRange.start,
                        calendarRange.end
                      );
                    }
                  }}
                  style={{ accentColor: "var(--primary)" }}
                />
                Mostrar preview
              </label>
            </div>

            <div className="mt-4 grid grid-cols-2 md:grid-cols-6 gap-3">
              <FieldNumber
                label="Meses"
                value={advParams.months}
                min={1}
                max={36}
                onChange={(v) => setAdvParams((p) => ({ ...p, months: v }))}
              />
              <FieldNumber
                label="Min ocurr."
                value={advParams.min_occurrences}
                min={2}
                max={50}
                onChange={(v) =>
                  setAdvParams((p) => ({ ...p, min_occurrences: v }))
                }
              />
              <FieldNumber
                label="Min intervalo"
                value={advParams.min_interval_days}
                min={1}
                max={365}
                onChange={(v) =>
                  setAdvParams((p) => ({ ...p, min_interval_days: v }))
                }
              />
              <FieldNumber
                label="Max intervalo"
                value={advParams.max_interval_days}
                min={1}
                max={3650}
                onChange={(v) =>
                  setAdvParams((p) => ({ ...p, max_interval_days: v }))
                }
              />
              <FieldNumber
                label="Coef var máx"
                value={advParams.max_coef_variation}
                step={0.05}
                min={0.05}
                max={2}
                onChange={(v) =>
                  setAdvParams((p) => ({ ...p, max_coef_variation: v }))
                }
              />

              <div className="flex flex-col gap-2 justify-end">
                <label
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--text)" }}
                >
                  <input
                    type="checkbox"
                    checked={advParams.include_noise}
                    onChange={(e) =>
                      setAdvParams((p) => ({
                        ...p,
                        include_noise: e.target.checked,
                      }))
                    }
                    style={{ accentColor: "var(--primary)" }}
                  />
                  Incluir eventuales
                </label>

                <label
                  className="flex items-center gap-2 text-xs"
                  style={{ color: "var(--text)" }}
                >
                  <input
                    type="checkbox"
                    checked={advParams.include_occasional}
                    onChange={(e) =>
                      setAdvParams((p) => ({
                        ...p,
                        include_occasional: e.target.checked,
                      }))
                    }
                    style={{ accentColor: "var(--primary)" }}
                  />
                  Incluir ocasionales
                </label>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2 justify-end">
              <button
                type="button"
                className="ff-btn ff-btn-outline"
                disabled={!advEnabled || advLoading}
                onClick={() =>
                  fetchAdvancedPreview(
                    selectedScenario.id,
                    calendarRange.start,
                    calendarRange.end
                  )
                }
              >
                {advLoading ? "Cargando..." : "Preview"}
              </button>

              <button
                type="button"
                className="ff-btn ff-btn-primary"
                disabled={
                  advLoading || !advEnabled || (advPreview?.length || 0) === 0
                }
                onClick={registerAdvancedForecast}
              >
                Registrar en escenario
              </button>
            </div>

            {advEnabled && (
              <div className="mt-2 text-xs text-[var(--muted)]">
                Preview actual:{" "}
                <strong className="text-[var(--text)]">
                  {advPreview.length}
                </strong>{" "}
                eventos simulados.
              </div>
            )}
          </div>

          {/* Panel de estadísticas */}
          <div className="ff-card mt-4 p-4 md:p-5">
            <div className="flex items-center justify-between mb-3 gap-2">
              <div>
                <h3 className="text-lg font-semibold text-[var(--text)]">
                  Estadísticas del escenario
                </h3>
                <p className="text-xs text-[var(--muted)]">
                  Resumen del mes visible en el calendario.
                </p>
              </div>

              <button
                type="button"
                className="ff-btn ff-btn-primary"
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
              <div className="ff-surface p-3">
                <p className="text-xs text-[var(--muted)]">Balance</p>
                <p
                  className="text-xl font-bold mt-1"
                  style={{
                    color:
                      stats.balance >= 0 ? "var(--success)" : "var(--danger)",
                  }}
                >
                  RD$ {stats.balance.toFixed(2)}
                </p>
              </div>

              <div className="ff-surface p-3">
                <p className="text-xs text-[var(--muted)]">Total ingresos</p>
                <p
                  className="text-xl font-bold mt-1"
                  style={{ color: "var(--success)" }}
                >
                  RD$ {stats.totalIncome.toFixed(2)}
                </p>
              </div>

              <div className="ff-surface p-3">
                <p className="text-xs text-[var(--muted)]">Total gastos</p>
                <p
                  className="text-xl font-bold mt-1"
                  style={{ color: "var(--danger)" }}
                >
                  RD$ {stats.totalExpense.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <h4 className="text-sm font-semibold mb-2 text-[var(--text)]">
                Gastos por categoría
              </h4>

              <ul className="space-y-1 text-xs md:text-sm text-[var(--text)]">
                {Object.entries(stats.categoryTotals).map(([cat, total]) => (
                  <li
                    key={cat}
                    className="flex justify-between py-1"
                    style={{
                      borderBottom:
                        "var(--border-w) solid color-mix(in srgb, var(--border-rgba) 60%, transparent)",
                    }}
                  >
                    <span>{cat}</span>
                    <span className="text-right font-medium">
                      RD$ {total.toFixed(2)}
                    </span>
                  </li>
                ))}

                {Object.keys(stats.categoryTotals).length === 0 && (
                  <li
                    className="italic"
                    style={{
                      color:
                        "color-mix(in srgb, var(--muted) 70%, transparent)",
                    }}
                  >
                    No hay gastos registrados
                  </li>
                )}
              </ul>
            </div>
          </div>

          {/* Calendario */}
          <ScenarioCalendar
            projection={mergedProjection} // ✅ aquí usamos el merge
            onDateRangeSelect={handleDateRangeSelect}
            onEventClick={handleEventClick}
            onViewRangeChange={async (gridStart, gridEnd, monthStart) => {
              setCalendarRange({ start: gridStart, end: gridEnd });
              setFocusedMonthStart(monthStart);

              if (selectedScenario) {
                // 1) projection: usa el grid para pintar bien
                await fetchProjectionRange(
                  selectedScenario.id,
                  gridStart,
                  gridEnd
                );

                // 2) advanced preview: usa SOLO el mes
                if (advEnabled) {
                  const mStart = dayjs(focusedMonthStart)
                    .startOf("month")
                    .format("YYYY-MM-DD");
                  const mEndExcl = dayjs(focusedMonthStart)
                    .endOf("month")
                    .add(1, "day")
                    .format("YYYY-MM-DD");
                  await fetchAdvancedPreview(
                    selectedScenario.id,
                    mStart,
                    mEndExcl
                  );
                }
              }
            }}
          />

          {/* Lista de transacciones proyectadas (mes visible) */}
          <CollapseSection title="Transacciones proyectadas">
            <ul className="space-y-3">
              {monthProjection.map((tx) => (
                <li
                  key={`${tx.id}-${tx.date}`}
                  className="ff-surface p-3 flex flex-col sm:flex-row sm:justify-between sm:items-center"
                >
                  <div>
                    <p className="font-medium text-[var(--text)]">
                      <span
                        style={{
                          color:
                            tx.type === "income"
                              ? "var(--success)"
                              : "var(--danger)",
                        }}
                      >
                        {tx.type === "income" ? "+" : "-"}RD$
                        {Number(tx.amount || 0).toFixed(2)}
                      </span>{" "}
                      — {tx.name}
                      {tx.source === "advanced_forecast" && (
                        <span
                          className="ml-2 text-[10px] px-2 py-0.5 rounded-full border"
                          style={{
                            borderColor:
                              "color-mix(in srgb, var(--warning) 45%, var(--border-rgba))",
                            background:
                              "color-mix(in srgb, var(--warning) 12%, transparent)",
                            color:
                              "color-mix(in srgb, var(--warning) 90%, var(--text))",
                          }}
                        >
                          AI Preview
                        </span>
                      )}
                    </p>

                    <p className="text-xs mt-0.5 text-[var(--muted)]">
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
          onDelete={
            editMode
              ? () => {
                  // arma “payload” para mostrar en modal
                  setTxToDelete({
                    id: editId,
                    name: formData?.name,
                    amount: formData?.amount,
                    type: formData?.type,
                    start: selectedDate?.start,
                    end: selectedDate?.end,
                  });
                  setConfirmDeleteTxOpen(true);
                }
              : null
          }
          isEditing={editMode}
        />
      </Modal>
      {/* Modal: eliminar transaccion simulada */}
      <ConfirmModal
        isOpen={confirmDeleteTxOpen}
        onClose={() => {
          if (deleteTxLoading) return;
          setConfirmDeleteTxOpen(false);
          setTxToDelete(null);
        }}
        onConfirm={handleDeleteTransaction}
        title="Eliminar transacción"
        message="Esta acción no se puede deshacer."
        details={
          <div className="space-y-1" style={{ color: "var(--text)" }}>
            <div>
              Vas a eliminar{" "}
              <span className="font-semibold text-[var(--text)]">
                {txToDelete?.name || "esta transacción"}
              </span>
              .
            </div>

            <div className="text-[var(--muted)]">
              {txToDelete?.type === "income" ? "Ingreso" : "Gasto"} ·{" "}
              <span className="text-[var(--text)] font-semibold">
                RD$ {Number(txToDelete?.amount || 0).toFixed(2)}
              </span>
            </div>

            {txToDelete?.start && (
              <div className="text-[var(--muted)]">
                Fecha:{" "}
                <span className="text-[var(--text)] font-semibold">
                  {txToDelete.start}
                </span>
                {txToDelete?.end && txToDelete.end !== txToDelete.start ? (
                  <>
                    {" "}
                    →{" "}
                    <span className="text-[var(--text)] font-semibold">
                      {txToDelete.end}
                    </span>
                  </>
                ) : null}
              </div>
            )}
          </div>
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        danger
        loading={deleteTxLoading}
      />

      {/* Modal: editar escenario */}
      <Modal
        isOpen={showEditScenario}
        onClose={() => {
          setShowEditScenario(false);
          setScenarioEditingId(null);
        }}
        title="Editar escenario"
      >
        <div className="space-y-4" style={{ color: "var(--text)" }}>
          <div className="space-y-1">
            <label className="ff-label">Nombre</label>
            <input
              type="text"
              className="ff-input"
              placeholder="Ej: Escenario base, Plan agresivo..."
              value={scenarioForm.name}
              onChange={(e) =>
                setScenarioForm((f) => ({ ...f, name: e.target.value }))
              }
              required
            />
          </div>

          <div className="space-y-1">
            <label className="ff-label">Descripción</label>
            <input
              type="text"
              className="ff-input"
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
              className="ff-btn ff-btn-primary"
              onClick={handleUpdateScenario}
            >
              Guardar
            </button>
            <button
              type="button"
              className="ff-btn ff-btn-outline"
              onClick={() => setShowEditScenario(false)}
            >
              Cancelar
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal eliminar escenario */}
      <ConfirmModal
        isOpen={confirmDeleteScenarioOpen}
        onClose={() => {
          if (deleteScenarioLoading) return;
          setConfirmDeleteScenarioOpen(false);
          setScenarioToDelete(null);
        }}
        onConfirm={() => handleDeleteScenario(scenarioToDelete?.id)}
        title="Eliminar escenario"
        message="Esta acción no se puede deshacer."
        details={
          <div className="space-y-1">
            <div>
              Vas a eliminar{" "}
              <span className="font-semibold text-slate-100">
                {scenarioToDelete?.name}
              </span>
              .
            </div>
            <div className="text-slate-400">
              Se borrarán también sus transacciones simuladas y los presupuestos
              importados desde este escenario.
            </div>
          </div>
        }
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        danger
        loading={deleteScenarioLoading}
      />

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
        onConfirm={async ({ selectedKeys }) => {
          try {
            const res = await axios.post(
              `${api}/scenarios/${selectedScenario.id}/import-to-budgets`,
              { scope: importScope, selected_keys: selectedKeys },
              { headers: { Authorization: `Bearer ${token}` } }
            );

            const { inserted, updated, skipped, selected } =
              res.data.data || {};
            toast.success(
              `Presupuesto importado ✅
Seleccionados: ${selected}
Insertados: ${inserted}, Actualizados: ${updated}, Omitidos: ${skipped}`,
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

// ✅ helper UI simple
function FieldNumber({ label, value, min, max, step = 1, onChange }) {
  return (
    <div className="flex flex-col">
      <label className="ff-label">{label}</label>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="ff-input"
      />
    </div>
  );
}

export default ScenarioManager;
