import { useEffect, useMemo, useState } from "react";
import axios from "axios";

// 🔔 react-toastify
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import FFSelect from "../components/FFSelect";

function Goals({ token }) {
  const api = import.meta.env.VITE_API_URL;

  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // form crear
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isPriority, setIsPriority] = useState(false);

  // aportes por meta (estado local)
  const [amountByGoal, setAmountByGoal] = useState({});

  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token]
  );

  const fetchGoals = async () => {
    try {
      const res = await axios.get(`${api}/goals`, authHeaders);
      setGoals(res.data.data || []);
    } catch {
      toast.error("Error al cargar metas");
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await axios.get(`${api}/accounts/balances`, authHeaders);
      setAccounts(res.data.data || []);
    } catch {
      toast.error("Error al cargar cuentas");
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchGoals();
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const accountMap = useMemo(() => {
    const map = new Map();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const handleCreate = async (e) => {
    e.preventDefault();

    const t = Number(target);
    if (!name.trim()) return toast.error("El nombre es obligatorio");
    if (!Number.isFinite(t) || t <= 0)
      return toast.error("Monto objetivo inválido");

    try {
      await axios.post(
        `${api}/goals`,
        {
          name,
          target_amount: t,
          due_date: dueDate || null,
          account_id: accountId || null, // ✅ null = tracking
          is_priority: isPriority,
        },
        authHeaders
      );

      setName("");
      setTarget("");
      setDueDate("");
      setAccountId("");
      setIsPriority(false);

      await fetchGoals();
      await fetchAccounts();
      toast.success("Meta creada correctamente");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al crear meta");
    }
  };

  const setQuickAmount = (goalId, delta) => {
    setAmountByGoal((prev) => {
      const current = Number(prev[goalId] || 0);
      return { ...prev, [goalId]: String((current + delta).toFixed(2)) };
    });
  };

  const parseAmountForGoal = (goalId) => {
    const raw = amountByGoal[goalId];
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return amount;
  };

  const handleDeposit = async (goal) => {
    const amount = parseAmountForGoal(goal.id);
    if (amount == null) return toast.error("Monto inválido");

    try {
      await axios.post(
        `${api}/goals/${goal.id}/deposit`,
        { amount },
        authHeaders
      );

      setAmountByGoal((p) => ({ ...p, [goal.id]: "" }));
      await fetchGoals();
      await fetchAccounts();

      toast.success(
        goal.account_id ? "Aporte reservado" : "Aporte registrado (tracking)"
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al aportar");
    }
  };

  const handleWithdraw = async (goal, reservedForUi) => {
    const amount = parseAmountForGoal(goal.id);
    if (amount == null) return toast.error("Monto inválido");

    if ((reservedForUi ?? 0) <= 0) {
      return toast.error("No hay monto disponible para retirar en esta meta");
    }

    try {
      await axios.post(
        `${api}/goals/${goal.id}/withdraw`,
        { amount },
        authHeaders
      );

      setAmountByGoal((p) => ({ ...p, [goal.id]: "" }));
      await fetchGoals();
      await fetchAccounts();

      toast.success(
        goal.account_id ? "Reserva liberada" : "Retiro registrado (tracking)"
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al retirar");
    }
  };

  const handleTogglePriority = async (goal) => {
    try {
      await axios.put(
        `${api}/goals/${goal.id}`,
        { is_priority: !goal.is_priority },
        authHeaders
      );
      await fetchGoals();
      toast.success(
        goal.is_priority
          ? "Prioridad removida"
          : "Meta marcada como prioritaria"
      );
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Error al actualizar prioridad"
      );
    }
  };

  const handleDelete = async (goal) => {
    if ((goal.reserved_amount || 0) > 0) {
      return toast.error(
        "Primero retira/libera el monto antes de eliminar la meta."
      );
    }

    if (!confirm("¿Eliminar esta meta?")) return;

    try {
      await axios.delete(`${api}/goals/${goal.id}`, authHeaders);
      await fetchGoals();
      await fetchAccounts();
      toast.success("Meta eliminada");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al eliminar meta");
    }
  };

  const handleComplete = async (goal) => {
    // opcional: confirmar si hay saldo reservado
    const reserved = Number(goal.reserved_amount ?? 0);
    const msg =
      reserved > 0
        ? `¿Completar meta y liberar ${reserved.toFixed(2)} DOP?`
        : "¿Completar meta?";
    if (!confirm(msg)) return;

    try {
      const res = await axios.post(
        `${api}/goals/${goal.id}/complete`,
        {},
        authHeaders
      );
      await fetchGoals();
      await fetchAccounts();
      const released = Number(res?.data?.data?.released_amount || 0);
      toast.success(
        released > 0
          ? `Meta completada. Liberado: ${released.toFixed(2)} DOP`
          : "Meta completada"
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al completar meta");
    }
  };

  const accountOptions = useMemo(() => {
    const base = [{ value: "", label: "Sin cuenta (tracking)" }];
    const mapped = accounts.map((a) => ({
      value: a.id,
      label: `${a.name} — Disponible: ${Number(a.available_balance).toFixed(
        2
      )} DOP`,
    }));
    return [...base, ...mapped];
  }, [accounts]);

  return (
    <div className="ff-card p-6 space-y-5">
      <ToastContainer position="top-right" autoClose={2500} />

      <div>
        <h2 className="text-2xl font-bold text-[var(--heading-accent)] mb-1">
          Metas de Ahorro
        </h2>
        <p className="text-sm text-[var(--muted)]">
          Aporta y retira montos. Si asignas una cuenta, afecta el disponible.
          Si no, funciona como tracking.
        </p>
      </div>

      {/* Formulario Crear */}
      <form onSubmit={handleCreate} className="grid gap-4 mb-4 md:grid-cols-3">
        <div className="flex flex-col space-y-1">
          <label className="ff-label">Nombre</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ej: Viaje, computadora..."
            className="ff-input"
            required
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">Monto objetivo (DOP)</label>
          <input
            type="number"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="1000"
            min="0"
            className="ff-input"
            required
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">Fecha límite</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="ff-input"
          />
        </div>

        <div className="flex flex-col space-y-1 md:col-span-2">
          <label className="ff-label">Cuenta (para reservar fondos)</label>
          <FFSelect
            value={accountId}
            onChange={(v) => setAccountId(v)}
            options={accountOptions}
            placeholder="Sin cuenta (tracking)"
            searchable
            clearable={false}
          />
          <p className="text-xs text-[var(--muted)]">
            Con cuenta: valida contra disponible. Sin cuenta: no afecta balances
            (solo tracking).
          </p>
        </div>

        <div className="flex items-center gap-2 md:col-span-1 mt-6">
          <input
            id="priority-create"
            type="checkbox"
            checked={isPriority}
            onChange={(e) => setIsPriority(e.target.checked)}
            className="h-4 w-4 rounded"
            style={{ accentColor: "var(--primary)" }}
          />
          <label
            htmlFor="priority-create"
            className="text-sm text-[var(--muted)]"
          >
            Meta prioritaria
          </label>
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            className="ff-btn ff-btn-primary w-full md:w-auto"
          >
            Crear meta
          </button>
        </div>
      </form>

      <ul className="space-y-5">
        {goals.map((goal) => {
          const reservedRaw = Number(goal.reserved_amount ?? 0);
          const targetRaw = Number(goal.target_amount ?? 0);

          const reserved = Math.abs(reservedRaw) < 0.000001 ? 0 : reservedRaw;
          const targetN = Math.abs(targetRaw) < 0.000001 ? 0 : targetRaw;

          const progress =
            targetN > 0 ? Math.max(0, Math.min(1, reserved / targetN)) : 0;

          const reservedText = reserved.toFixed(2);
          const targetText = targetN.toFixed(2);

          const acc = goal.account_id ? accountMap.get(goal.account_id) : null;
          const isTracking = !goal.account_id;
          const canWithdraw = reserved > 0;
          const isCompleted = goal.status === "completed";

          return (
            <li
              key={goal.id}
              className="p-5 rounded-2xl space-y-4"
              style={{
                background: "color-mix(in srgb, var(--panel) 65%, transparent)",
                border: "var(--border-w) solid var(--border-rgba)",
                boxShadow: "var(--glow-shadow)",
              }}
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <p className="font-semibold text-[var(--text)] text-lg">
                      {goal.name}
                    </p>

                    {goal.is_priority && (
                      <span
                        className="text-xs px-2.5 py-1 rounded-full border"
                        style={{
                          background:
                            "color-mix(in srgb, var(--warning) 18%, transparent)",
                          color:
                            "color-mix(in srgb, var(--warning) 85%, var(--text))",
                          borderColor:
                            "color-mix(in srgb, var(--warning) 35%, var(--border-rgba))",
                        }}
                      >
                        Prioridad
                      </span>
                    )}

                    {isTracking && (
                      <span
                        className="text-xs px-2.5 py-1 rounded-full border"
                        style={{
                          background:
                            "color-mix(in srgb, var(--muted) 14%, transparent)",
                          color:
                            "color-mix(in srgb, var(--text) 90%, var(--muted))",
                          borderColor:
                            "color-mix(in srgb, var(--muted) 22%, var(--border-rgba))",
                        }}
                      >
                        Tracking
                      </span>
                    )}
                  </div>

                  {isCompleted && (
                    <span
                      className="text-xs px-2.5 py-1 rounded-full border"
                      style={{
                        background:
                          "color-mix(in srgb, var(--primary) 18%, transparent)",
                        color:
                          "color-mix(in srgb, var(--primary) 85%, var(--text))",
                        borderColor:
                          "color-mix(in srgb, var(--primary) 35%, var(--border-rgba))",
                      }}
                    >
                      Completada
                    </span>
                  )}

                  <p className="text-sm text-[var(--muted)] mt-1">
                    <span className="font-semibold text-[var(--text)]">
                      {reservedText}
                    </span>{" "}
                    / {targetText} DOP
                    {goal.due_date ? (
                      <span className="ml-2 text-[var(--muted)]">
                        — Vence: {goal.due_date}
                      </span>
                    ) : null}
                  </p>

                  {acc ? (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      Cuenta:{" "}
                      <span className="text-[var(--text)] font-medium">
                        {acc.name}
                      </span>{" "}
                      • Disponible:{" "}
                      <span className="text-[var(--text)] font-medium">
                        {Number(acc.available_balance).toFixed(2)} DOP
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      Esta meta no afecta cuentas (solo tracking).
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePriority(goal)}
                    className="text-sm font-semibold underline underline-offset-2"
                    style={{ color: "var(--warning)" }}
                  >
                    {goal.is_priority ? "Quitar prioridad" : "Marcar prioridad"}
                  </button>
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => handleComplete(goal)}
                      className="text-sm font-semibold underline underline-offset-2"
                      style={{ color: "var(--primary)" }}
                      title="Marca la meta como completada y libera todo el monto reservado"
                    >
                      Completar y liberar
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDelete(goal)}
                    className="text-sm font-semibold underline underline-offset-2"
                    style={{ color: "var(--danger)" }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              <div
                className="w-full h-2.5 rounded-full overflow-hidden"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 70%, transparent)",
                  border: "var(--border-w) solid",
                  borderColor:
                    "color-mix(in srgb, var(--border-rgba) 60%, transparent)",
                }}
              >
                <div
                  className="h-2.5 rounded-full transition-all duration-300"
                  style={{
                    width: `${progress * 100}%`,
                    background:
                      "linear-gradient(90deg, color-mix(in srgb, var(--primary) 92%, #000) 0%, color-mix(in srgb, var(--primary) 72%, #000) 100%)",
                  }}
                />
              </div>

              {!isCompleted ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="md:col-span-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amountByGoal[goal.id] ?? ""}
                      onChange={(e) =>
                        setAmountByGoal((p) => ({
                          ...p,
                          [goal.id]: e.target.value,
                        }))
                      }
                      placeholder="Monto"
                      className="ff-input"
                    />

                    <div className="flex gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => setQuickAmount(goal.id, 100)}
                        className="ff-btn ff-btn-ghost ff-btn-sm"
                      >
                        +100
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickAmount(goal.id, 500)}
                        className="ff-btn ff-btn-ghost ff-btn-sm"
                      >
                        +500
                      </button>
                      <button
                        type="button"
                        onClick={() => setQuickAmount(goal.id, 1000)}
                        className="ff-btn ff-btn-ghost ff-btn-sm"
                      >
                        +1000
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2 flex gap-3 items-start">
                    <button
                      type="button"
                      onClick={() => handleDeposit(goal)}
                      className="ff-btn ff-btn-primary flex-1"
                      title={isTracking ? "Tracking: no afecta cuentas" : ""}
                    >
                      Aportar
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWithdraw(goal, reserved)}
                      disabled={!canWithdraw}
                      className={`ff-btn flex-1 ${
                        canWithdraw
                          ? "ff-btn-outline"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                      title={
                        !canWithdraw
                          ? "No hay monto disponible para retirar"
                          : ""
                      }
                    >
                      Retirar
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-sm rounded-xl p-3"
                  style={{
                    background:
                      "color-mix(in srgb, var(--panel) 75%, transparent)",
                    border: "var(--border-w) solid var(--border-rgba)",
                    color: "var(--muted)",
                  }}
                >
                  Esta meta está completada. El monto reservado fue liberado.
                  Registra el gasto desde <b>Transacciones</b>.
                </div>
              )}
            </li>
          );
        })}

        {goals.length === 0 && (
          <li className="text-base italic text-[var(--muted)]">
            Aún no tienes metas creadas. Crea la primera desde el formulario
            superior.
          </li>
        )}
      </ul>
    </div>
  );
}

export default Goals;
