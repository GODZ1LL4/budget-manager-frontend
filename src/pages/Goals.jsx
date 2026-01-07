import { useEffect, useMemo, useState } from "react";
import axios from "axios";

// 🔔 react-toastify
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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
    if (!Number.isFinite(t) || t <= 0) return toast.error("Monto objetivo inválido");

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

    // ✅ Opción A: si no hay cuenta, se permite (tracking)
    try {
      await axios.post(
        `${api}/goals/${goal.id}/deposit`,
        { amount },
        authHeaders
      );

      setAmountByGoal((p) => ({ ...p, [goal.id]: "" }));
      await fetchGoals();
      await fetchAccounts();

      toast.success(goal.account_id ? "Aporte reservado" : "Aporte registrado (tracking)");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al aportar");
    }
  };

  const handleWithdraw = async (goal, reservedForUi) => {
    const amount = parseAmountForGoal(goal.id);
    if (amount == null) return toast.error("Monto inválido");

    // ✅ guardia UX (el backend también valida)
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

      toast.success(goal.account_id ? "Reserva liberada" : "Retiro registrado (tracking)");
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
      toast.success(goal.is_priority ? "Prioridad removida" : "Meta marcada como prioritaria");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Error al actualizar prioridad");
    }
  };

  const handleDelete = async (goal) => {
    if ((goal.reserved_amount || 0) > 0) {
      return toast.error("Primero retira/libera el monto antes de eliminar la meta.");
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
      <ToastContainer position="top-right" autoClose={2500} />

      <div>
        <h2 className="text-2xl font-bold text-[#f6e652] mb-1">
          Metas de Ahorro
        </h2>
        <p className="text-sm text-slate-400">
          Aporta y retira montos. Si asignas una cuenta, afecta el disponible. Si no, funciona como tracking.
        </p>
      </div>

      {/* Formulario Crear */}
      <form onSubmit={handleCreate} className="grid gap-4 mb-4 md:grid-cols-3">
        {/* Nombre */}
        <div className="flex flex-col space-y-1">
          <label className="text-sm font-medium text-slate-300">Nombre</label>
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
          <label className="text-sm font-medium text-slate-300">Fecha límite</label>
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

        {/* Cuenta */}
        <div className="flex flex-col space-y-1 md:col-span-2">
          <label className="text-sm font-medium text-slate-300">
            Cuenta (para reservar fondos)
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="
              w-full rounded-lg px-3 py-2 text-sm
              bg-slate-900 border border-slate-700
              text-slate-100
              focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
              transition-colors
            "
          >
            <option value="">Sin cuenta (tracking)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} — Disponible: {Number(a.available_balance).toFixed(2)} DOP
              </option>
            ))}
          </select>
          <p className="text-xs text-slate-500">
            Con cuenta: valida contra disponible. Sin cuenta: no afecta balances (solo tracking).
          </p>
        </div>

        {/* Prioridad */}
        <div className="flex items-center gap-2 md:col-span-1 mt-6">
          <input
            id="priority-create"
            type="checkbox"
            checked={isPriority}
            onChange={(e) => setIsPriority(e.target.checked)}
            className="h-4 w-4 accent-emerald-400"
          />
          <label htmlFor="priority-create" className="text-sm text-slate-300">
            Meta prioritaria
          </label>
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
      <ul className="space-y-5">
        {goals.map((goal) => {
          // ===== Normalización segura (evita -0.00, NaN, >100%) =====
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

          return (
            <li
              key={goal.id}
              className="
                p-5 rounded-2xl
                bg-slate-950/60
                border border-slate-800
                shadow-[0_10px_30px_rgba(0,0,0,0.7)]
                space-y-4
              "
            >
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <p className="font-semibold text-slate-100 text-lg">
                      {goal.name}
                    </p>

                    {goal.is_priority && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/30">
                        Prioridad
                      </span>
                    )}

                    {isTracking && (
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-500/15 text-slate-200 border border-slate-400/20">
                        Tracking
                      </span>
                    )}
                  </div>

                  <p className="text-sm text-slate-300 mt-1">
                    <span className="font-semibold text-slate-100">
                      {reservedText}
                    </span>{" "}
                    / {targetText} DOP
                    {goal.due_date ? (
                      <span className="ml-2 text-slate-400">
                        — Vence: {goal.due_date}
                      </span>
                    ) : null}
                  </p>

                  {acc ? (
                    <p className="text-sm text-slate-400 mt-1">
                      Cuenta:{" "}
                      <span className="text-slate-200 font-medium">
                        {acc.name}
                      </span>{" "}
                      • Disponible:{" "}
                      <span className="text-slate-200 font-medium">
                        {Number(acc.available_balance).toFixed(2)} DOP
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 mt-1">
                      Esta meta no afecta cuentas (solo tracking).
                    </p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => handleTogglePriority(goal)}
                    className="text-sm font-semibold text-amber-300 hover:underline"
                  >
                    {goal.is_priority ? "Quitar prioridad" : "Marcar prioridad"}
                  </button>

                  <button
                    onClick={() => handleDelete(goal)}
                    className="text-sm font-semibold text-rose-400 hover:text-rose-300 hover:underline"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {/* Barra */}
              <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-2.5 rounded-full transition-all duration-300 bg-emerald-400"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>

              {/* Aportes / Retiros */}
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
                    className="
                      w-full rounded-lg px-3 py-2.5 text-base
                      bg-slate-900 border border-slate-700
                      text-slate-100 placeholder:text-slate-500
                      focus:outline-none focus:ring-2 focus:ring-emerald-500/70 focus:border-emerald-500
                      transition-colors
                    "
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => setQuickAmount(goal.id, 100)}
                      className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700"
                    >
                      +100
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickAmount(goal.id, 500)}
                      className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700"
                    >
                      +500
                    </button>
                    <button
                      type="button"
                      onClick={() => setQuickAmount(goal.id, 1000)}
                      className="text-sm px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700"
                    >
                      +1000
                    </button>
                  </div>
                </div>

                <div className="md:col-span-2 flex gap-3 items-start">
                  <button
                    type="button"
                    onClick={() => handleDeposit(goal)}
                    className="
                      flex-1 px-4 py-2.5 rounded-lg text-base font-semibold
                      bg-emerald-500 text-slate-950 hover:brightness-110 active:scale-95
                      transition-all
                    "
                    title={isTracking ? "Tracking: no afecta cuentas" : ""}
                  >
                    Aportar
                  </button>

                  <button
                    type="button"
                    onClick={() => handleWithdraw(goal, reserved)}
                    disabled={!canWithdraw}
                    className={`
                      flex-1 px-4 py-2.5 rounded-lg text-base font-semibold
                      ${
                        canWithdraw
                          ? "bg-slate-800 text-slate-100 hover:bg-slate-700 active:scale-95"
                          : "bg-slate-800 text-slate-400 cursor-not-allowed"
                      }
                      transition-all
                    `}
                    title={!canWithdraw ? "No hay monto disponible para retirar" : ""}
                  >
                    Retirar
                  </button>
                </div>
              </div>
            </li>
          );
        })}

        {goals.length === 0 && (
          <li className="text-base text-slate-500 italic">
            Aún no tienes metas creadas. Crea la primera desde el formulario superior.
          </li>
        )}
      </ul>
    </div>
  );
}

export default Goals;
