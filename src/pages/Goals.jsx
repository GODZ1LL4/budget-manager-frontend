import { useEffect, useMemo, useRef, useState } from "react";
import { HiDotsVertical } from "react-icons/hi";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Modal from "../components/Modal";
import FFSelect from "../components/FFSelect";
import {
  listAccountBalances,
  listAccounts,
} from "../lib/repositories/accountsRepository";
import {
  completeGoalRecord,
  createGoal,
  deleteGoalRecord,
  depositToGoal,
  listGoals,
  syncPendingGoals,
  updateGoalRecord,
  withdrawFromGoal,
} from "../lib/repositories/goalsRepository";
import { useAppPreferences } from "../context/AppPreferencesContext";
import useClickOutside from "../hooks/useClickOutside";
import useOverflowMenuPosition from "../hooks/useOverflowMenuPosition";

function Goals({ token, subscriptionMode }) {
  const [goals, setGoals] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState("");
  const [target, setTarget] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [accountId, setAccountId] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteGoal, setDeleteGoal] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completeGoal, setCompleteGoal] = useState(null);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [amountByGoal, setAmountByGoal] = useState({});
  const [mobileMenuId, setMobileMenuId] = useState(null);
  const mobileMenuRef = useRef(null);
  const { t, preferences, formatCurrency } = useAppPreferences();

  useClickOutside(mobileMenuRef, () => setMobileMenuId(null), Boolean(mobileMenuId));
  const mobileMenuPlacement = useOverflowMenuPosition(
    mobileMenuRef,
    Boolean(mobileMenuId)
  );

  const fetchGoals = async () => {
    try {
      const res = await listGoals({ token, subscriptionMode });
      setGoals(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error(t("goals.goalsError"));
    }
  };

  const fetchAccounts = async () => {
    try {
      const [accountsRes, balancesRes] = await Promise.all([
        listAccounts({ token, subscriptionMode }),
        listAccountBalances({ token, subscriptionMode }),
      ]);

      const accountList = Array.isArray(accountsRes.data) ? accountsRes.data : [];
      const balancesData = balancesRes.data;

      const normalizedAccounts = accountList.map((account) => {
        const balanceEntry = Array.isArray(balancesData)
          ? balancesData.find((item) => String(item.id) === String(account.id))
          : balancesData?.[account.id];

        const currentBalance = Number(
          balanceEntry?.current_balance ??
            balanceEntry?.current ??
            account.current_balance ??
            account.current ??
            0
        );

        const reservedBalance = Number(
          balanceEntry?.reserved_balance ??
            balanceEntry?.reserved ??
            account.reserved_balance ??
            account.reserved ??
            0
        );

        const availableBalance = Number(
          balanceEntry?.available_balance ??
            balanceEntry?.available ??
            account.available_balance ??
            account.available ??
            currentBalance - reservedBalance
        );

        return {
          ...account,
          current_balance: currentBalance,
          reserved_balance: reservedBalance,
          available_balance: availableBalance,
        };
      });

      setAccounts(normalizedAccounts);
    } catch {
      setAccounts([]);
      toast.error(t("goals.accountsError"));
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchGoals();
    fetchAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriptionMode]);

  useEffect(() => {
    if (!token) return;

    const runSync = async () => {
      const result = await syncPendingGoals({ token, subscriptionMode });
      if (result.synced > 0) {
        await fetchGoals();
        await fetchAccounts();
        toast.success(t("goals.synced", { count: result.synced }));
      }
    };

    runSync();

    const handleOnline = () => {
      runSync();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriptionMode, t]);

  const accountMap = useMemo(() => {
    const map = new Map();
    for (const a of Array.isArray(accounts) ? accounts : []) {
      map.set(a.id, a);
    }
    return map;
  }, [accounts]);

  const handleCreate = async (e) => {
    e.preventDefault();

    const numericTarget = Number(target);
    if (!name.trim()) return toast.error(t("goals.nameRequired"));
    if (!Number.isFinite(numericTarget) || numericTarget <= 0) {
      return toast.error(t("goals.invalidTarget"));
    }

    try {
      await createGoal({
        token,
        payload: {
          name,
          target_amount: numericTarget,
          due_date: dueDate || null,
          account_id: accountId || null,
          is_priority: isPriority,
        },
        subscriptionMode,
      });

      setName("");
      setTarget("");
      setDueDate("");
      setAccountId("");
      setIsPriority(false);

      await fetchGoals();
      await fetchAccounts();
      toast.success(t("goals.created"));
    } catch (err) {
      toast.error(err?.response?.data?.error || t("goals.createError"));
    }
  };

  const parseAmountForGoal = (goalId) => {
    const raw = amountByGoal[goalId];
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return amount;
  };

  const handleDeposit = async (goal) => {
    const amount = parseAmountForGoal(goal.id);
    if (amount == null) return toast.error(t("goals.invalidAmount"));

    if (goal.status === "completed") {
      return toast.error(t("goals.completedGoalDeposit"));
    }

    const targetAmount = Number(goal.target_amount ?? 0);
    if (targetAmount > 0) {
      const reservedAmount = Number(goal.reserved_amount ?? 0);
      const remainingToTarget = Math.max(0, targetAmount - reservedAmount);

      if (remainingToTarget <= 0) {
        return toast.error(t("goals.targetReached"));
      }

      if (amount > remainingToTarget) {
        return toast.error(
          t("goals.depositMax", {
            amount: formatCurrency(remainingToTarget),
          })
        );
      }
    }

    try {
      await depositToGoal({
        token,
        goal,
        amount,
        subscriptionMode,
      });

      setAmountByGoal((prev) => ({ ...prev, [goal.id]: "" }));
      await fetchGoals();
      await fetchAccounts();

      toast.success(
        goal.account_id
          ? t("goals.reservedContribution")
          : t("goals.trackingContribution")
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || t("goals.depositError"));
    }
  };

  const handleWithdraw = async (goal, reservedForUi) => {
    const amount = parseAmountForGoal(goal.id);
    if (amount == null) return toast.error(t("goals.invalidAmount"));

    if (goal.status === "completed") {
      return toast.error(t("goals.completedGoalWithdraw"));
    }

    if ((reservedForUi ?? 0) <= 0) {
      return toast.error(t("goals.noReservedFunds"));
    }

    if (amount > Number(reservedForUi || 0)) {
      return toast.error(
        t("goals.withdrawMax", {
          amount: formatCurrency(reservedForUi || 0),
        })
      );
    }

    try {
      await withdrawFromGoal({
        token,
        goal,
        amount,
        subscriptionMode,
      });

      setAmountByGoal((prev) => ({ ...prev, [goal.id]: "" }));
      await fetchGoals();
      await fetchAccounts();

      toast.success(
        goal.account_id
          ? t("goals.releasedReserve")
          : t("goals.trackingWithdraw")
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || t("goals.withdrawError"));
    }
  };

  const handleTogglePriority = async (goal) => {
    try {
      await updateGoalRecord({
        token,
        goalId: goal.id,
        payload: { is_priority: !goal.is_priority },
        subscriptionMode,
      });
      await fetchGoals();
      toast.success(
        goal.is_priority
          ? t("goals.priorityRemoved")
          : t("goals.priorityMarked")
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || t("goals.priorityError"));
    }
  };

  const openDeleteModal = (goal) => {
    if ((goal.reserved_amount || 0) > 0) {
      return toast.error(t("goals.deleteBlocked"));
    }
    setDeleteGoal(goal);
    setDeleteOpen(true);
    setMobileMenuId(null);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeleteGoal(null);
  };

  const confirmDelete = async () => {
    if (!deleteGoal) return;

    setDeleteLoading(true);
    try {
      await deleteGoalRecord({
        token,
        goal: deleteGoal,
        subscriptionMode,
      });
      await fetchGoals();
      await fetchAccounts();
      toast.success(t("goals.deleted"));
      closeDeleteModal();
    } catch (err) {
      toast.error(err?.response?.data?.error || t("goals.deleteError"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openCompleteModal = (goal) => {
    setCompleteGoal(goal);
    setCompleteOpen(true);
    setMobileMenuId(null);
  };

  const closeCompleteModal = () => {
    if (completeLoading) return;
    setCompleteOpen(false);
    setCompleteGoal(null);
  };

  const confirmComplete = async () => {
    if (!completeGoal) return;

    setCompleteLoading(true);
    try {
      const result = await completeGoalRecord({
        token,
        goal: completeGoal,
        subscriptionMode,
      });
      await fetchGoals();
      await fetchAccounts();

      const released = Number(result?.data?.released_amount || 0);
      toast.success(
        released > 0
          ? t("goals.completedWithRelease", {
              amount: formatCurrency(released),
            })
          : t("goals.completed")
      );

      closeCompleteModal();
    } catch (err) {
      toast.error(err?.response?.data?.error || t("goals.completeError"));
    } finally {
      setCompleteLoading(false);
    }
  };

  const accountOptions = useMemo(() => {
    const base = [{ value: "", label: t("goals.noAccountTracking") }];
    const mapped = (Array.isArray(accounts) ? accounts : []).map((account) => ({
      value: account.id,
      label: `${account.name} — ${t("common.available")}: ${formatCurrency(
        account.available_balance
      )}`,
    }));
    return [...base, ...mapped];
  }, [accounts, t, formatCurrency]);

  return (
    <div className="ff-card p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-[var(--heading-accent)] mb-1">
          {t("goals.title")}
        </h2>
        <p className="text-sm text-[var(--muted)]">{t("goals.subtitle")}</p>
      </div>

      <form onSubmit={handleCreate} className="grid gap-4 mb-4 md:grid-cols-3">
        <div className="flex flex-col space-y-1">
          <label className="ff-label">{t("goals.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("goals.namePlaceholder")}
            className="ff-input"
            required
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">
            {`${t("goals.targetAmount")} (${preferences.currency})`}
          </label>
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
          <label className="ff-label">{t("goals.dueDate")}</label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="ff-input"
          />
        </div>

        <div className="flex flex-col space-y-1 md:col-span-2">
          <label className="ff-label">{t("goals.accountReserve")}</label>
          <FFSelect
            value={accountId}
            onChange={(v) => setAccountId(v)}
            options={accountOptions}
            placeholder={t("goals.noAccountTracking")}
            searchable
            clearable={false}
          />
          <p className="text-xs text-[var(--muted)]">{t("goals.accountHelp")}</p>
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
            {t("goals.priorityGoal")}
          </label>
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            className="ff-btn ff-btn-primary w-full md:w-auto"
          >
            {t("goals.createGoal")}
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
          const reservedText = formatCurrency(reserved);
          const targetText = formatCurrency(targetN);
          const acc = goal.account_id ? accountMap.get(goal.account_id) : null;
          const isTracking = !goal.account_id;
          const canWithdraw = reserved > 0;
          const isCompleted = goal.status === "completed";
          const requestedAmount = Number(amountByGoal[goal.id] ?? 0);
          const hasValidRequestedAmount =
            Number.isFinite(requestedAmount) && requestedAmount > 0;
          const remainingToTarget = Math.max(0, targetN - reserved);
          const availableForGoal = Number(acc?.available_balance ?? 0);
          const exceedsReserved = hasValidRequestedAmount && requestedAmount > reserved;
          const exceedsTarget =
            hasValidRequestedAmount && requestedAmount > remainingToTarget;
          const exceedsAvailable =
            hasValidRequestedAmount &&
            !isTracking &&
            requestedAmount > availableForGoal;
          const canDepositAction =
            !isCompleted &&
            hasValidRequestedAmount &&
            !exceedsAvailable &&
            (targetN <= 0 || requestedAmount <= remainingToTarget);
          const canWithdrawAction =
            !isCompleted &&
            hasValidRequestedAmount &&
            canWithdraw &&
            !exceedsReserved;

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
                        {t("common.priority")}
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
                        {t("common.tracking")}
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
                      {t("goals.completedState")}
                    </span>
                  )}

                  <p className="text-sm text-[var(--muted)] mt-1">
                    <span className="font-semibold text-[var(--text)]">
                      {reservedText}
                    </span>{" "}
                    / {targetText}
                    {goal.due_date ? (
                      <span className="ml-2 text-[var(--muted)]">
                        {" "}
                        - {t("goals.dueLabel")}: {goal.due_date}
                      </span>
                    ) : null}
                  </p>

                  {acc ? (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {t("goals.account")}:{" "}
                      <span className="text-[var(--text)] font-medium">
                        {acc.name}
                      </span>{" "}
                      • {t("common.available")}:{" "}
                      <span className="text-[var(--text)] font-medium">
                        {formatCurrency(acc.available_balance)}
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      {t("goals.affectsNoAccounts")}
                    </p>
                  )}
                </div>

                <div className="hidden md:flex flex-col items-end gap-2">
                  <button
                    type="button"
                    onClick={() => handleTogglePriority(goal)}
                    className="text-sm font-semibold underline underline-offset-2"
                    style={{ color: "var(--warning)" }}
                  >
                    {goal.is_priority
                      ? t("goals.removePriority")
                      : t("goals.markPriority")}
                  </button>
                  {!isCompleted && (
                    <button
                      type="button"
                      onClick={() => openCompleteModal(goal)}
                      className="text-sm font-semibold underline underline-offset-2"
                      style={{ color: "var(--primary)" }}
                      title={t("goals.completeTitleHint")}
                    >
                      {t("goals.completeAndRelease")}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => openDeleteModal(goal)}
                    className="text-sm font-semibold underline underline-offset-2"
                    style={{ color: "var(--danger)" }}
                  >
                    {t("common.delete")}
                  </button>
                </div>

                <div
                  ref={mobileMenuId === goal.id ? mobileMenuRef : null}
                  className="relative md:hidden"
                >
                  <button
                    type="button"
                    data-overflow-trigger="true"
                    aria-label="Actions"
                    onClick={() =>
                      setMobileMenuId((prev) => (prev === goal.id ? null : goal.id))
                    }
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                      background:
                        "color-mix(in srgb, var(--panel) 92%, transparent)",
                      color: "var(--text)",
                    }}
                  >
                    <HiDotsVertical size={18} />
                  </button>

                  {mobileMenuId === goal.id && (
                    <div
                      data-overflow-menu="true"
                      className="absolute right-0 top-12 z-10 min-w-[190px] rounded-[var(--radius-md)] border p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                      style={{
                        top: mobileMenuPlacement === "up" ? "auto" : "3rem",
                        bottom: mobileMenuPlacement === "up" ? "3rem" : "auto",
                        borderColor:
                          "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                        background: "color-mix(in srgb, var(--panel) 96%, transparent)",
                      }}
                    >
                      <div className="grid grid-cols-1 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            handleTogglePriority(goal);
                            setMobileMenuId(null);
                          }}
                          className="ff-btn ff-btn-warning w-full"
                        >
                          {goal.is_priority
                            ? t("goals.removePriority")
                            : t("goals.markPriority")}
                        </button>

                        {!isCompleted && (
                          <button
                            type="button"
                            onClick={() => openCompleteModal(goal)}
                            className="ff-btn ff-btn-primary w-full"
                            title={t("goals.completeTitleHint")}
                          >
                            {t("goals.completeAndRelease")}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => openDeleteModal(goal)}
                          className="ff-btn ff-btn-danger w-full"
                        >
                          {t("common.delete")}
                        </button>
                      </div>
                    </div>
                  )}
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
                        setAmountByGoal((prev) => ({
                          ...prev,
                          [goal.id]: e.target.value,
                        }))
                      }
                      placeholder={t("goals.amountPlaceholder")}
                      className="ff-input"
                    />

                    {hasValidRequestedAmount && exceedsTarget && (
                      <p className="text-xs mt-2" style={{ color: "var(--warning)" }}>
                        {t("goals.depositHint", {
                          amount: formatCurrency(remainingToTarget),
                        })}
                      </p>
                    )}

                    {hasValidRequestedAmount && exceedsAvailable && (
                      <p className="text-xs mt-2" style={{ color: "var(--warning)" }}>
                        {t("goals.availableHint", {
                          amount: formatCurrency(availableForGoal),
                        })}
                      </p>
                    )}
                  </div>

                  <div className="md:col-span-2 flex gap-3 items-start">
                    <button
                      type="button"
                      onClick={() => handleDeposit(goal)}
                      disabled={!canDepositAction}
                      className={`ff-btn flex-1 ${
                        canDepositAction
                          ? "ff-btn-primary"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                      title={
                        isCompleted
                          ? t("goals.completeGoalTooltip")
                          : !hasValidRequestedAmount
                          ? t("goals.validAmountTooltip")
                          : exceedsAvailable
                          ? t("goals.availableTooltip")
                          : exceedsTarget
                          ? t("goals.targetTooltip")
                          : isTracking
                          ? t("goals.trackingTooltip")
                          : ""
                      }
                    >
                      {t("goals.deposit")}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleWithdraw(goal, reserved)}
                      disabled={!canWithdrawAction}
                      className={`ff-btn flex-1 ${
                        canWithdrawAction
                          ? "ff-btn-outline"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                      title={
                        isCompleted
                          ? t("goals.completeGoalTooltip")
                          : !hasValidRequestedAmount
                          ? t("goals.validAmountTooltip")
                          : !canWithdraw
                          ? t("goals.noWithdrawTooltip")
                          : exceedsReserved
                          ? t("goals.reservedTooltip")
                          : ""
                      }
                    >
                      {t("goals.withdraw")}
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
                  {t("goals.completedInfo")}
                </div>
              )}
            </li>
          );
        })}

        {goals.length === 0 && (
          <li className="text-base italic text-[var(--muted)]">
            {t("goals.noGoals")}
          </li>
        )}
      </ul>

      <Modal
        isOpen={deleteOpen}
        onClose={closeDeleteModal}
        title={t("goals.deleteTitle")}
        size="sm"
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {t("goals.deleteConfirm")}{" "}
          <span style={{ color: "var(--text)", fontWeight: 700 }}>
            {deleteGoal?.name || ""}
          </span>
          ? {t("goals.irreversible")}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleteLoading}
            className="ff-btn ff-btn-danger"
          >
            {deleteLoading ? t("common.loadingDelete") : t("goals.yesDelete")}
          </button>
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={deleteLoading}
            className="ff-btn ff-btn-outline"
          >
            {t("common.cancel")}
          </button>
        </div>
      </Modal>

      <Modal
        isOpen={completeOpen}
        onClose={closeCompleteModal}
        title={t("goals.completeTitle")}
        size="sm"
      >
        {(() => {
          const reserved = Number(completeGoal?.reserved_amount ?? 0);
          const reservedSafe = Math.abs(reserved) < 0.000001 ? 0 : reserved;

          return (
            <>
              <p className="text-sm" style={{ color: "var(--muted)" }}>
                {t("goals.completeIntro")}{" "}
                <span style={{ color: "var(--text)", fontWeight: 700 }}>
                  {completeGoal?.name || ""}
                </span>
                .
              </p>

              <div
                className="mt-3 text-sm rounded-xl p-3"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 75%, transparent)",
                  border: "var(--border-w) solid var(--border-rgba)",
                  color: "var(--muted)",
                }}
              >
                {reservedSafe > 0
                  ? t("goals.reservedRelease", {
                      amount: formatCurrency(reservedSafe),
                    })
                  : t("goals.noReservedRelease")}
              </div>

              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={confirmComplete}
                  disabled={completeLoading}
                  className="ff-btn ff-btn-danger"
                >
                  {completeLoading
                    ? t("goals.completing")
                    : t("goals.yesComplete")}
                </button>
                <button
                  type="button"
                  onClick={closeCompleteModal}
                  disabled={completeLoading}
                  className="ff-btn ff-btn-outline"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </>
          );
        })()}
      </Modal>
    </div>
  );
}

export default Goals;
