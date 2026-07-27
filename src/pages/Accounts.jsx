import { useEffect, useMemo, useRef, useState } from "react";
import Modal from "../components/Modal";
import FFSelect from "../components/FFSelect";
import { HiDotsVertical } from "react-icons/hi";
import {
  createAccount,
  createTransfer,
  deleteAccount,
  listAccountBalances,
  listAccounts,
  syncPendingAccounts,
  updateAccount,
} from "../lib/repositories/accountsRepository";
import { syncPendingTransactions } from "../lib/repositories/transactionsRepository";
import { useAppPreferences } from "../context/AppPreferencesContext";
import useClickOutside from "../hooks/useClickOutside";
import useOverflowMenuPosition from "../hooks/useOverflowMenuPosition";
import { todayDateKey } from "../lib/dates/localDate";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

function Accounts({ token, subscriptionMode }) {
  const [name, setName] = useState("");
  const [accounts, setAccounts] = useState([]);
  const [editId, setEditId] = useState(null);
  const [balances, setBalances] = useState({});
  const [showTransfer, setShowTransfer] = useState(false);
  const [tFrom, setTFrom] = useState("");
  const [tFromName, setTFromName] = useState("");
  const [tTo, setTTo] = useState("");
  const [tAmount, setTAmount] = useState("");
  const [tDate, setTDate] = useState(
    () => todayDateKey()
  );
  const [tDesc, setTDesc] = useState("");
  const [tLoading, setTLoading] = useState(false);
  const [tError, setTError] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleteAcc, setDeleteAcc] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [mobileMenuId, setMobileMenuId] = useState(null);
  const mobileMenuRef = useRef(null);
  const { t, formatCurrency } = useAppPreferences();

  useClickOutside(mobileMenuRef, () => setMobileMenuId(null), Boolean(mobileMenuId));
  const mobileMenuPlacement = useOverflowMenuPosition(
    mobileMenuRef,
    Boolean(mobileMenuId)
  );

  const openDelete = (acc) => {
    setDeleteAcc(acc);
    setShowDelete(true);
    setMobileMenuId(null);
  };

  const closeDelete = () => {
    if (!deleteLoading) {
      setShowDelete(false);
      setDeleteAcc(null);
    }
  };

  const fetchAccounts = async () => {
    try {
      const res = await listAccounts({ token, subscriptionMode });
      setAccounts(res.data || []);
    } catch {
      toast.error(t("accounts.fetchError"));
    }
  };

  const fetchBalances = async () => {
    try {
      const res = await listAccountBalances({ token, subscriptionMode });
      setBalances(res.data || {});
    } catch (err) {
      console.error("No se pudo cargar balances", err);
      toast.error(t("accounts.balancesError"));
    }
  };

  const reload = async () => {
    await Promise.all([fetchAccounts(), fetchBalances()]);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("accounts.nameRequired"));
      return;
    }

    try {
      const result = await createAccount({
        token,
        name: name.trim(),
        subscriptionMode,
      });
      setName("");
      await reload();
      toast.success(
        result.offline
          ? t("accounts.createdOffline")
          : t("accounts.created")
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || t("accounts.createError"));
    }
  };

  const handleUpdate = async (id) => {
    if (!name.trim()) {
      toast.error(t("accounts.nameRequired"));
      return;
    }

    try {
      const result = await updateAccount({
        token,
        id,
        name: name.trim(),
        subscriptionMode,
      });
      setEditId(null);
      setName("");
      await reload();
      toast.success(
        result.offline
          ? t("accounts.updatedOffline")
          : t("accounts.updated")
      );
    } catch (err) {
      toast.error(err?.response?.data?.error || t("accounts.updateError"));
    }
  };

  const confirmDelete = async () => {
    if (!deleteAcc) return;
    setDeleteLoading(true);

    try {
      const result = await deleteAccount({
        token,
        account: deleteAcc,
        subscriptionMode,
      });
      await reload();
      toast.success(
        result.offline
          ? t("accounts.deletedOffline", { name: deleteAcc.name })
          : t("accounts.deleted", { name: deleteAcc.name })
      );
      closeDelete();
    } catch (err) {
      toast.error(err?.response?.data?.error || t("accounts.deleteError"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const startEdit = (acc) => {
    setEditId(acc.id);
    setName(acc.name);
  };

  const cancelEdit = () => {
    setEditId(null);
    setName("");
    setMobileMenuId(null);
  };

  const openTransfer = (acc) => {
    setTFrom(acc.id);
    setTFromName(acc.name);
    setTTo("");
    setTAmount("");
    setTDate(todayDateKey());
    setTDesc("");
    setTError("");
    setShowTransfer(true);
    setMobileMenuId(null);
  };

  useEffect(() => {
    if (token) reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriptionMode]);

  useEffect(() => {
    if (!token) return;

    const runSync = async () => {
      const accountsResult = await syncPendingAccounts({
        token,
        subscriptionMode,
      });
      const transactionsResult = await syncPendingTransactions({
        token,
        subscriptionMode,
      });
      const totalSynced =
        Number(accountsResult?.synced || 0) +
        Number(transactionsResult?.synced || 0);

      if (totalSynced > 0) {
        await reload();
        toast.success(t("accounts.synced", { count: totalSynced }));
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

  const submitTransfer = async (e) => {
    e.preventDefault();
    setTError("");

    if (!tFrom || !tTo || !tDate || tAmount === "") {
      toast.error(t("accounts.fillAllFields"));
      return;
    }

    const amountNum = Number(tAmount);
    if (Number.isNaN(amountNum) || amountNum <= 0) {
      toast.error(t("accounts.invalidAmount"));
      return;
    }

    if (tFrom === tTo) {
      toast.error(t("accounts.differentAccounts"));
      return;
    }

    const fromBalance = balances[tFrom]?.current ?? 0;
    if (fromBalance < amountNum) {
      toast.error(t("accounts.insufficientFunds"));
      return;
    }

    try {
      setTLoading(true);

      const result = await createTransfer({
        token,
        payload: {
          from_account_id: tFrom,
          to_account_id: tTo,
          amount: amountNum,
          date: tDate,
          description: tDesc || null,
        },
        subscriptionMode,
      });

      const toName =
        accounts.find((account) => account.id === tTo)?.name ||
        t("accounts.destinationAccount");
      const amountLabel = formatCurrency(amountNum);
      toast.success(
        result?.offline
          ? t("accounts.transferOffline", {
              amount: amountLabel,
              fromName: tFromName,
              toName,
            })
          : t("accounts.transferDone", {
              amount: amountLabel,
              fromName: tFromName,
              toName,
            })
      );

      setShowTransfer(false);
      setTFrom("");
      setTTo("");
      setTAmount("");
      setTDesc("");
      await reload();
    } catch (err) {
      console.error(err);
      const msg =
        err?.code === "OFFLINE_TRANSFER_NOT_SUPPORTED"
          ? t("accounts.transferConnectionRequired")
          : err?.response?.data?.error || t("accounts.transferError");
      setTError(msg);
      toast.error(msg);
    } finally {
      setTLoading(false);
    }
  };

  const transferOptions = useMemo(() => {
    return accounts.map((acc) => ({
      value: acc.id,
      label: acc.name,
      disabled: String(acc.id) === String(tFrom),
      subLabel:
        String(acc.id) === String(tFrom) ? t("accounts.sameAccount") : "",
    }));
  }, [accounts, tFrom, t]);

  const renderDesktopBalanceSummary = (bal, compact = false) => (
    <>
      <p
        className={compact ? "text-base font-semibold" : "text-xl font-semibold"}
        style={{ color: "var(--text)" }}
      >
        {formatCurrency(bal.current)}
      </p>
      <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
        {t("accounts.reserved")}: {formatCurrency(bal.reserved)}
        <br />
        {t("common.available")}: {formatCurrency(bal.available)}
      </p>
    </>
  );

  return (
    <div className="ff-card p-4 sm:p-6 space-y-4">
      <h2 className="ff-h1 ff-heading-accent mb-2">{t("accounts.title")}</h2>

      <p className="ff-heading-muted text-sm mb-4">
        {t("accounts.subtitle")}
      </p>

      <form
        onSubmit={handleCreate}
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
      >
        <div className="flex flex-col sm:max-w-sm sm:flex-1">
          <label className="ff-label">{t("accounts.name")}</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("accounts.namePlaceholder")}
            className="ff-input w-full sm:w-64"
          />
        </div>

        <button type="submit" className="ff-btn ff-btn-primary w-full sm:w-auto">
          {t("common.add")}
        </button>
      </form>

      <div className="space-y-3 md:hidden">
        {accounts.map((acc) => {
          const bal = balances[acc.id] || {
            current: 0,
            reserved: 0,
            available: 0,
          };

          return (
            <section
              key={acc.id}
              className="relative rounded-[var(--radius-lg)] border p-4"
              style={{
                borderColor: "var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 88%, transparent)",
              }}
            >
              {editId === acc.id ? (
                <div className="space-y-4">
                  <div className="flex flex-col space-y-1">
                    <label className="ff-label">{t("accounts.name")}</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="ff-input"
                    />
                  </div>

                  <div
                    className="rounded-[var(--radius-md)] border px-3 py-2"
                    style={{
                      borderColor:
                        "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                    }}
                  >
                    <p
                      className="text-[11px] uppercase tracking-[0.14em]"
                      style={{ color: "var(--muted)" }}
                    >
                      {t("accounts.balance")}
                    </p>
                    <p className="mt-2 text-xl font-semibold" style={{ color: "var(--text)" }}>
                      {formatCurrency(bal.current)}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdate(acc.id)}
                      className="ff-btn ff-btn-primary w-full"
                    >
                      {t("common.save")}
                    </button>

                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="ff-btn ff-btn-outline w-full"
                    >
                      {t("common.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[11px] uppercase tracking-[0.14em]"
                        style={{ color: "var(--muted)" }}
                      >
                        {t("accounts.name")}
                      </p>
                      <p className="mt-2 truncate text-lg font-semibold" style={{ color: "var(--text)" }}>
                        {acc.name}
                      </p>
                    </div>

                    <div
                      ref={mobileMenuId === acc.id ? mobileMenuRef : null}
                      className="relative shrink-0"
                    >
                      <button
                        type="button"
                        data-overflow-trigger="true"
                        aria-label={t("accounts.actions")}
                        onClick={() =>
                          setMobileMenuId((prev) => (prev === acc.id ? null : acc.id))
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

                      {mobileMenuId === acc.id && (
                        <div
                          data-overflow-menu="true"
                          className="absolute right-0 top-12 z-10 min-w-[180px] rounded-[var(--radius-md)] border p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                          style={{
                            top:
                              mobileMenuPlacement === "up" ? "auto" : "3rem",
                            bottom:
                              mobileMenuPlacement === "up" ? "3rem" : "auto",
                            borderColor:
                              "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                            background: "color-mix(in srgb, var(--panel) 96%, transparent)",
                          }}
                        >
                          <div className="grid grid-cols-1 gap-2">
                            <button
                              onClick={() => openTransfer(acc)}
                              className="ff-btn ff-btn-primary w-full"
                              type="button"
                            >
                              {t("accounts.transfer")}
                            </button>

                            <button
                              onClick={() => {
                                startEdit(acc);
                                setMobileMenuId(null);
                              }}
                              className="ff-btn ff-btn-warning w-full"
                              type="button"
                            >
                              {t("common.edit")}
                            </button>

                            <button
                              onClick={() => {
                                openDelete(acc);
                                setMobileMenuId(null);
                              }}
                              className="ff-btn ff-btn-danger w-full"
                              type="button"
                            >
                              {t("common.delete")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div
                      className="rounded-[var(--radius-md)] border px-3 py-2"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                      }}
                    >
                      <p
                        className="text-[11px] uppercase tracking-[0.14em]"
                        style={{ color: "var(--muted)" }}
                      >
                        {t("accounts.balance")}
                      </p>
                      <p className="mt-2 text-base font-semibold" style={{ color: "var(--text)" }}>
                        {formatCurrency(bal.current)}
                      </p>
                    </div>

                    <div
                      className="rounded-[var(--radius-md)] border px-3 py-2"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                      }}
                    >
                      <p
                        className="text-[11px] uppercase tracking-[0.14em]"
                        style={{ color: "var(--muted)" }}
                      >
                        {t("accounts.reserved")}
                      </p>
                      <p className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>
                        {formatCurrency(bal.reserved)}
                      </p>
                    </div>

                    <div
                      className="rounded-[var(--radius-md)] border px-3 py-2"
                      style={{
                        borderColor:
                          "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                      }}
                    >
                      <p
                        className="text-[11px] uppercase tracking-[0.14em]"
                        style={{ color: "var(--muted)" }}
                      >
                        {t("common.available")}
                      </p>
                      <p className="mt-2 text-sm font-medium" style={{ color: "var(--text)" }}>
                        {formatCurrency(bal.available)}
                      </p>
                    </div>
                  </div>

                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="hidden overflow-hidden md:block">
        <table className="ff-table text-sm">
          <thead>
            <tr>
              <th className="ff-th">{t("accounts.name")}</th>
              <th className="ff-th">{t("accounts.balance")}</th>
              <th className="ff-th text-center">{t("accounts.actions")}</th>
            </tr>
          </thead>

          <tbody>
            {accounts.map((acc) => {
              const bal = balances[acc.id] || {
                current: 0,
                reserved: 0,
                available: 0,
              };

              return (
                <tr key={acc.id} className="ff-tr">
                  {editId === acc.id ? (
                    <>
                      <td className="ff-td align-middle">
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="ff-input"
                        />
                      </td>

                      <td className="ff-td">
                        {renderDesktopBalanceSummary(bal)}
                      </td>

                      <td className="ff-td">
                        <div className="flex justify-center flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdate(acc.id)}
                            className="ff-btn ff-btn-primary"
                          >
                            {t("common.save")}
                          </button>

                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="ff-btn ff-btn-outline"
                          >
                            {t("common.cancel")}
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="ff-td">{acc.name}</td>

                      <td className="ff-td">
                        {renderDesktopBalanceSummary(bal, true)}
                      </td>

                      <td className="ff-td">
                        <div className="flex justify-center flex-wrap gap-2">
                          <button
                            onClick={() => openTransfer(acc)}
                            className="ff-btn ff-btn-primary"
                            type="button"
                          >
                            {t("accounts.transfer")}
                          </button>

                          <button
                            onClick={() => startEdit(acc)}
                            className="ff-btn ff-btn-warning"
                            type="button"
                          >
                            {t("common.edit")}
                          </button>

                          <button
                            onClick={() => openDelete(acc)}
                            className="ff-btn ff-btn-danger"
                            type="button"
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={showTransfer}
        onClose={() => !tLoading && setShowTransfer(false)}
        title={t("accounts.fromTransfer", { name: tFromName })}
      >
        <form onSubmit={submitTransfer} className="space-y-4">
          {tError && (
            <div
              className="text-sm rounded-[var(--radius-md)] px-3 py-2 border"
              style={{
                borderColor: "var(--border-rgba)",
                background:
                  "color-mix(in srgb, var(--danger) 14%, transparent)",
                color: "var(--text)",
              }}
            >
              {tError}
            </div>
          )}

          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("accounts.toLabel")}</label>
            <FFSelect
              value={tTo}
              onChange={(v) => setTTo(v)}
              options={[
                {
                  value: "",
                  label: t("accounts.selectAccount"),
                  disabled: true,
                },
                ...transferOptions,
              ]}
              placeholder={t("accounts.selectAccount")}
              disabled={tLoading}
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("accounts.amount")}</label>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={tAmount}
              onChange={(e) => setTAmount(e.target.value)}
              onBlur={() => {
                if (tAmount !== "" && !Number.isNaN(Number(tAmount))) {
                  setTAmount(Number(tAmount).toFixed(2));
                }
              }}
              className="ff-input"
              disabled={tLoading}
              required
            />

            <p className="text-sm mt-1" style={{ color: "var(--muted)" }}>
              {t("accounts.realBalance")}:{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {formatCurrency(balances[tFrom]?.current)}
              </span>{" "}
              • {t("common.available")}:{" "}
              <span style={{ color: "var(--text)", fontWeight: 600 }}>
                {formatCurrency(balances[tFrom]?.available)}
              </span>
            </p>
          </div>

          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("accounts.date")}</label>
            <input
              type="date"
              value={tDate}
              onChange={(e) => setTDate(e.target.value)}
              className="ff-input"
              disabled={tLoading}
              required
            />
          </div>

          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("accounts.descriptionOptional")}</label>
            <input
              type="text"
              value={tDesc}
              onChange={(e) => setTDesc(e.target.value)}
              className="ff-input"
              disabled={tLoading}
              placeholder={t("accounts.descriptionPlaceholder")}
            />
          </div>

          <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
            <button
              type="submit"
              className="ff-btn ff-btn-primary w-full sm:w-auto"
              disabled={tLoading}
            >
              {tLoading ? t("accounts.transferring") : t("accounts.confirmTransfer")}
            </button>
            <button
              type="button"
              onClick={() => setShowTransfer(false)}
              className="ff-btn ff-btn-outline w-full sm:w-auto"
              disabled={tLoading}
            >
              {t("common.cancel")}
            </button>     
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={showDelete}
        onClose={closeDelete}
        title={t("accounts.deleteTitle")}
      >
        {(() => {
          const bal = deleteAcc ? balances[deleteAcc.id] : null;
          const current = Number(bal?.current ?? 0);
          const hasBalance = Math.abs(current) > 0.000001;

          return (
            <div className="space-y-4">
              <div className="text-sm" style={{ color: "var(--text)" }}>
                <p>
                  {t("accounts.deleteConfirm")}{" "}
                  <strong style={{ color: "var(--text)" }}>
                    {deleteAcc?.name}
                  </strong>
                  ?
                </p>
                <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
                  {t("accounts.deleteIrreversible")}
                </p>

                {hasBalance && (
                  <div
                    className="mt-3 text-xs rounded-[var(--radius-md)] px-3 py-2 border"
                    style={{
                      borderColor: "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--warning) 14%, transparent)",
                      color: "var(--text)",
                    }}
                  >
                    {t("accounts.balanceWarning", {
                      amount: formatCurrency(current),
                    })}
                  </div>
                )}
              </div>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"> 
                <button
                  type="button"
                  onClick={confirmDelete}
                  className="ff-btn ff-btn-danger w-full sm:w-auto"
                  disabled={deleteLoading || hasBalance}
                  style={hasBalance ? { opacity: 0.6 } : undefined}
                >
                  {deleteLoading ? t("accounts.deleting") : t("accounts.yesDelete")}
                </button>

                <button
                  type="button"
                  onClick={closeDelete}
                  className="ff-btn ff-btn-outline w-full sm:w-auto"
                  disabled={deleteLoading}
                >
                  {t("common.cancel")}
                </button>

               
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}

export default Accounts;
