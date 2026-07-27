import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { HiDotsVertical, HiEye, HiMinus, HiPencil, HiPlus } from "react-icons/hi";
import Modal from "../components/Modal";
import FFSelect from "../components/FFSelect";
import { toast } from "react-toastify";
import {
  createBudget,
  deleteBudgetRecord,
  listBudgets,
  listExpenseCategories,
  syncPendingBudgets,
  updateBudgetRecord,
} from "../lib/repositories/budgetsRepository";
import { listTransactions } from "../lib/repositories/transactionsRepository";
import { canUsePremiumBackend } from "../lib/subscription/subscriptionAccess";
import { useAppPreferences } from "../context/AppPreferencesContext";
import useClickOutside from "../hooks/useClickOutside";
import useOverflowMenuPosition from "../hooks/useOverflowMenuPosition";

function getTransactionMonth(date) {
  return String(date || "").slice(0, 7);
}

function getTransactionCategoryId(transaction) {
  return transaction?.category_id ?? transaction?.categories?.id ?? "";
}

function getBudgetTransactions(transactions, budget) {
  if (!budget) return [];

  return (transactions || [])
    .filter((transaction) => {
      const sameCategory =
        String(getTransactionCategoryId(transaction)) ===
        String(budget.category_id);
      const sameMonth = getTransactionMonth(transaction.date) === budget.month;

      return transaction.type === "expense" && sameCategory && sameMonth;
    })
    .sort((left, right) => {
      const dateCompare = String(right.date || "").localeCompare(
        String(left.date || "")
      );
      if (dateCompare !== 0) return dateCompare;

      return String(right.id || "").localeCompare(String(left.id || ""));
    });
}

function formatAmountInputValue(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return "";

  return Number.isInteger(numericValue)
    ? String(numericValue)
    : numericValue.toFixed(2).replace(/\.?0+$/, "");
}

function Budgets({ token, subscriptionMode }) {
  const [budgets, setBudgets] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState("");
  const [month, setMonth] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  });
  const [limitAmount, setLimitAmount] = useState("");
  const [repeatYearly, setRepeatYearly] = useState(false);
  const [filterType, setFilterType] = useState("month");
  const [filterValue, setFilterValue] = useState(month);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importItems, setImportItems] = useState([]);
  const [importLoading, setImportLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [budgetToDelete, setBudgetToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [budgetToEdit, setBudgetToEdit] = useState(null);
  const [editLimitAmount, setEditLimitAmount] = useState("");
  const [editAdjustmentAmount, setEditAdjustmentAmount] = useState("100");
  const [editLoading, setEditLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [detailsBudget, setDetailsBudget] = useState(null);
  const [detailsTransactions, setDetailsTransactions] = useState([]);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [mobileMenuId, setMobileMenuId] = useState(null);
  const mobileMenuRef = useRef(null);
  const detailsRequestIdRef = useRef(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilterId, setCategoryFilterId] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const { t, formatCurrency, formatMonthLabel } = useAppPreferences();

  useClickOutside(mobileMenuRef, () => setMobileMenuId(null), Boolean(mobileMenuId));
  const mobileMenuPlacement = useOverflowMenuPosition(
    mobileMenuRef,
    Boolean(mobileMenuId)
  );

  const api = import.meta.env.VITE_API_URL;

  const fetchBudgets = async () => {
    try {
      const response = await listBudgets({
        token,
        filterType,
        filterValue,
        subscriptionMode,
      });
      setBudgets(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error(t("budgets.fetchError"));
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await listExpenseCategories({ token, subscriptionMode });
      setCategories(Array.isArray(response.data) ? response.data : []);
    } catch {
      toast.error(t("budgets.categoriesError"));
    }
  };

  const resetImportState = () => {
    setShowImportModal(false);
    setImportPreview(null);
    setImportItems([]);
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    if (!categoryId) {
      toast.error(t("budgets.selectCategory"));
      return;
    }

    const duplicatedBudget = budgets.find(
      (budget) =>
        String(budget.category_id) === String(categoryId) &&
        String(budget.month) === String(month)
    );

    if (duplicatedBudget) {
      toast.error(t("budgets.duplicateBudget"));
      return;
    }

    const numericLimit = Number(limitAmount);
    if (!Number.isFinite(numericLimit) || numericLimit < 0) {
      toast.error(t("budgets.invalidLimit"));
      return;
    }

    try {
      const selectedCategory = categories.find(
        (category) => String(category.id) === String(categoryId)
      );

      await createBudget({
        token,
        payload: {
          category_id: categoryId,
          category_name: selectedCategory?.name,
          month,
          limit_amount: parseFloat(limitAmount),
          repeat: repeatYearly,
        },
        subscriptionMode,
      });

      setCategoryId("");
      setLimitAmount("");
      setRepeatYearly(false);
      toast.success(t("budgets.created"));
      await fetchBudgets();
    } catch {
      toast.error(t("budgets.createError"));
    }
  };

  const openDeleteModal = (budget) => {
    setBudgetToDelete(budget);
    setDeleteOpen(true);
    setMobileMenuId(null);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setBudgetToDelete(null);
  };

  const confirmDelete = async () => {
    if (!budgetToDelete) return;

    setDeleteLoading(true);
    try {
      await deleteBudgetRecord({
        token,
        budget: budgetToDelete,
        subscriptionMode,
      });
      toast.success(t("budgets.deleted"));
      await fetchBudgets();
      closeDeleteModal();
    } catch {
      toast.error(t("budgets.deleteError"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEditModal = (budget) => {
    setBudgetToEdit(budget);
    setEditLimitAmount(formatAmountInputValue(budget.limit));
    setEditAdjustmentAmount("100");
    setEditOpen(true);
    setMobileMenuId(null);
  };

  const closeEditModal = () => {
    if (editLoading) return;
    setEditOpen(false);
    setBudgetToEdit(null);
    setEditLimitAmount("");
    setEditAdjustmentAmount("100");
  };

  const applyEditAdjustment = (direction, amount = editAdjustmentAmount) => {
    const delta = Number(amount);
    if (!Number.isFinite(delta) || delta <= 0) {
      toast.error(t("budgets.invalidAdjustment"));
      return;
    }

    const currentLimitValue = Number(editLimitAmount);
    const currentLimit = Number.isFinite(currentLimitValue)
      ? currentLimitValue
      : 0;
    const nextLimit = Math.max(0, currentLimit + direction * delta);
    setEditLimitAmount(formatAmountInputValue(nextLimit));
  };

  const handleEditSubmit = async (event) => {
    event.preventDefault();
    if (!budgetToEdit) return;

    const numericLimit = Number(editLimitAmount);
    if (!Number.isFinite(numericLimit) || numericLimit < 0) {
      toast.error(t("budgets.invalidLimit"));
      return;
    }

    setEditLoading(true);
    try {
      const result = await updateBudgetRecord({
        token,
        budget: budgetToEdit,
        limitAmount: numericLimit,
        subscriptionMode,
      });

      toast.success(
        result?.offline ? t("budgets.updatedOffline") : t("budgets.updated")
      );
      await fetchBudgets();
      setEditOpen(false);
      setBudgetToEdit(null);
      setEditLimitAmount("");
      setEditAdjustmentAmount("100");
    } catch {
      toast.error(t("budgets.updateError"));
    } finally {
      setEditLoading(false);
    }
  };

  const openDetailsModal = async (budget) => {
    const requestId = detailsRequestIdRef.current + 1;
    detailsRequestIdRef.current = requestId;

    setDetailsBudget(budget);
    setDetailsTransactions([]);
    setDetailsOpen(true);
    setDetailsLoading(true);
    setMobileMenuId(null);

    try {
      const result = await listTransactions({ token, subscriptionMode });
      if (detailsRequestIdRef.current === requestId) {
        setDetailsTransactions(getBudgetTransactions(result.data, budget));
      }
    } catch {
      if (detailsRequestIdRef.current === requestId) {
        toast.error(t("budgets.detailsLoadError"));
      }
    } finally {
      if (detailsRequestIdRef.current === requestId) {
        setDetailsLoading(false);
      }
    }
  };

  const closeDetailsModal = () => {
    detailsRequestIdRef.current += 1;
    setDetailsOpen(false);
    setDetailsBudget(null);
    setDetailsTransactions([]);
  };

  const openImportPreview = async () => {
    if (!canUsePremiumBackend(subscriptionMode)) {
      toast.info(t("budgets.remoteSuggestionRequired"));
      return;
    }

    try {
      setImportLoading(true);
      const response = await axios.get(
        `${api}/budgets/history-import-preview?month=${month}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const preview = response.data.data;
      setImportPreview(preview);
      setImportItems(
        (preview.items || []).map((item) => ({
          ...item,
          selected: !item.existing_budget_limit,
        }))
      );
      setShowImportModal(true);
    } catch {
      toast.error(t("budgets.previewError"));
    } finally {
      setImportLoading(false);
    }
  };

  const importSuggestedBudgets = async () => {
    if (!canUsePremiumBackend(subscriptionMode)) {
      toast.info(t("budgets.remoteImportRequired"));
      return;
    }

    const selected = importItems.filter((item) => item.selected);
    if (selected.length === 0) {
      toast.error(t("budgets.selectImportCategory"));
      return;
    }

    try {
      const response = await axios.post(
        `${api}/budgets/history-import`,
        {
          month: importPreview.to_month,
          items: selected.map((item) => ({
            category_id: item.category_id,
            limit_amount: item.spent_last_month,
          })),
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      const { insertedCount, updatedCount } = response.data || {};
      toast.success(
        t("budgets.importProcessed", {
          insertedCount: insertedCount || 0,
          updatedCount: updatedCount || 0,
        })
      );

      resetImportState();
      await fetchBudgets();
    } catch {
      toast.error(t("budgets.importError"));
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriptionMode]);

  useEffect(() => {
    if (!token) return;
    fetchBudgets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterType, filterValue, subscriptionMode]);

  useEffect(() => {
    if (!token) return;

    const runSync = async () => {
      const result = await syncPendingBudgets({
        token,
        filterType,
        filterValue,
        subscriptionMode,
      });

      if (result.synced > 0) {
        await fetchBudgets();
        toast.success(t("budgets.synced", { count: result.synced }));
      }
    };

    runSync();

    const handleOnline = () => {
      runSync();
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterType, filterValue, subscriptionMode, t]);

  const allSelected =
    importItems.length > 0 && importItems.every((item) => item.selected);

  const categoryOptions = useMemo(
    () =>
      categories.map((category) => ({
        value: category.id,
        label: category.name,
      })),
    [categories]
  );

  const filterTypeOptions = useMemo(
    () => [
      { value: "month", label: t("budgets.monthFilter") },
      { value: "year", label: t("budgets.yearFilter") },
    ],
    [t]
  );

  const categoryFilterOptions = useMemo(
    () => [
      { value: "", label: t("budgets.allCategories") },
      ...categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    ],
    [categories, t]
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: t("budgets.allStatuses") },
      { value: "on_track", label: t("budgets.statusOnTrack") },
      { value: "over", label: t("budgets.statusOver") },
      { value: "pending_sync", label: t("budgets.statusPendingSyncFilter") },
      { value: "synced", label: t("budgets.statusSyncedFilter") },
    ],
    [t]
  );

  const decoratedBudgets = useMemo(() => {
    return budgets
      .map((budget) => {
        const category = categories.find(
          (item) => String(item.id) === String(budget.category_id)
        );
        const limit = Number(budget.limit ?? budget.limit_amount ?? 0);
        const spent = Number(budget.spent ?? 0);
        const remaining = limit - spent;
        const percent = limit > 0 ? spent / limit : 0;
        const over = spent > limit && limit > 0;

        return {
          ...budget,
          category,
          limit,
          spent,
          remaining,
          percent,
          over,
        };
      })
      .sort((left, right) => {
        if (left.month !== right.month) {
          return String(right.month).localeCompare(String(left.month));
        }

        return String(left.category_name || "").localeCompare(
          String(right.category_name || "")
        );
      });
  }, [budgets, categories]);

  const filteredBudgets = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return decoratedBudgets.filter((budget) => {
      const matchesSearch =
        !normalizedSearch ||
        String(budget.category_name || "")
          .toLowerCase()
          .includes(normalizedSearch);

      const matchesCategory =
        !categoryFilterId ||
        String(budget.category_id) === String(categoryFilterId);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "over" && budget.over) ||
        (statusFilter === "on_track" && !budget.over) ||
        (statusFilter === "pending_sync" && Boolean(budget.sync_status)) ||
        (statusFilter === "synced" && !budget.sync_status);

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [decoratedBudgets, searchTerm, categoryFilterId, statusFilter]);

  const detailsTotal = useMemo(
    () =>
      detailsTransactions.reduce(
        (total, transaction) => total + Number(transaction.amount || 0),
        0
      ),
    [detailsTransactions]
  );

  const detailsRemaining =
    Number(detailsBudget?.limit ?? detailsBudget?.limit_amount ?? 0) -
    detailsTotal;
  const editLimitPreviewValue = Number(editLimitAmount);
  const editLimitPreview = Number.isFinite(editLimitPreviewValue)
    ? editLimitPreviewValue
    : 0;
  const editRemainingPreview =
    editLimitPreview - Number(budgetToEdit?.spent ?? 0);

  return (
    <div className="ff-card p-6 space-y-4">
      <h2 className="text-2xl font-bold mb-1 text-[var(--heading-accent)]">
        {t("budgets.title")}
      </h2>

      <p className="text-sm text-[var(--muted)] mb-4">
        {t("budgets.subtitle")}
      </p>

      <form
        onSubmit={handleCreate}
        className="grid gap-4 mb-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-3"
      >
        <div className="flex flex-col">
          <label className="ff-label mb-1">{t("budgets.category")}</label>
          <FFSelect
            value={categoryId}
            onChange={(value) => setCategoryId(value)}
            options={categoryOptions}
            placeholder={t("budgets.selectCategory")}
          />
        </div>

        <div className="flex flex-col">
          <label className="ff-label mb-1">{t("budgets.month")}</label>
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            className="ff-input"
            required
          />
        </div>

        <div className="flex items-center mt-2 sm:mt-6">
          <input
            type="checkbox"
            id="repeat"
            checked={repeatYearly}
            onChange={() => setRepeatYearly((prev) => !prev)}
            className="mr-2 h-4 w-4 rounded"
            style={{ accentColor: "var(--primary)" }}
          />
          <label htmlFor="repeat" className="text-sm text-[var(--muted)]">
            {t("budgets.repeatYearly")}
          </label>
        </div>

        <div className="flex flex-col">
          <label className="ff-label mb-1">{t("budgets.monthlyLimit")}</label>
          <input
            type="number"
            min="0"
            placeholder={t("budgets.monthlyLimitPlaceholder")}
            value={limitAmount}
            onChange={(event) => setLimitAmount(event.target.value)}
            className="ff-input"
            required
          />
        </div>

        <div className="col-span-full mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="submit" className="ff-btn ff-btn-primary w-full sm:w-auto">
            {t("budgets.addFlow")}
          </button>

          <button
            type="button"
            onClick={openImportPreview}
            className="ff-btn ff-btn-outline w-full sm:w-auto"
            disabled={importLoading}
          >
            {importLoading
              ? t("budgets.loadingSuggestions")
              : t("budgets.suggestPreviousMonth")}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:items-end mb-4">
        <div className="flex flex-col">
          <label className="ff-label mb-1">{t("budgets.viewBy")}</label>
          <FFSelect
            value={filterType}
            onChange={(value) => {
              const type = value;
              setFilterType(type);
              const now = new Date();
              setFilterValue(
                type === "month"
                  ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
                  : `${now.getFullYear()}`
              );
            }}
            options={filterTypeOptions}
          />
        </div>

        <div className="flex flex-col md:col-span-2">
          <label className="ff-label mb-1">
            {filterType === "month"
              ? t("budgets.selectMonth")
              : t("budgets.selectYear")}
          </label>

          {filterType === "month" ? (
            <input
              type="month"
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              className="ff-input"
            />
          ) : (
            <input
              type="number"
              min="2000"
              max="2100"
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
              className="ff-input"
              placeholder={t("budgets.yearPlaceholder")}
            />
          )}
        </div>
      </div>

      <div
        className="grid grid-cols-1 gap-3 md:grid-cols-3 mb-4 rounded-2xl p-4"
        style={{
          border: "var(--border-w) solid var(--border-rgba)",
          background: "color-mix(in srgb, var(--panel) 60%, transparent)",
        }}
      >
        <div className="flex flex-col">
          <label className="ff-label mb-1">{t("budgets.searchLabel")}</label>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t("budgets.searchPlaceholder")}
            className="ff-input"
          />
        </div>

        <div className="flex flex-col">
          <label className="ff-label mb-1">{t("budgets.categoryFilter")}</label>
          <FFSelect
            value={categoryFilterId}
            onChange={(value) => setCategoryFilterId(value)}
            options={categoryFilterOptions}
            placeholder={t("budgets.allCategories")}
            searchable
            clearable={false}
          />
        </div>

        <div className="flex flex-col">
          <label className="ff-label mb-1">{t("budgets.statusFilter")}</label>
          <FFSelect
            value={statusFilter}
            onChange={(value) => setStatusFilter(value)}
            options={statusFilterOptions}
            searchable={false}
            clearable={false}
          />
        </div>
      </div>

      <h3 className="text-lg font-semibold mb-3 text-[var(--heading)]">
        {t("budgets.summary")}
      </h3>

      {filteredBudgets.length === 0 ? (
        <div className="ff-surface p-5 text-sm text-[var(--muted)]">
          {t("budgets.noBudgets")}
        </div>
      ) : (
        <ul className="space-y-4">
          {filteredBudgets.map((budget) => {
            const accent = budget.over ? "var(--danger)" : "var(--success)";
            const percentLabel = Math.min(
              999,
              Math.max(0, budget.percent * 100)
            );
            const stabilityLabel = budget.category?.stability_type
              ? t(`stabilityType.${budget.category.stability_type}`)
              : t("stabilityType.variable");

            return (
              <li
                key={budget.id}
                className="p-4 rounded-xl"
                style={{
                  border: "var(--border-w) solid",
                  borderColor: `color-mix(in srgb, ${accent} 55%, var(--border-rgba))`,
                  background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                  boxShadow: "var(--glow-shadow)",
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="font-semibold text-[var(--text)]">
                      {budget.category_name}{" "}
                      <span className="text-[var(--muted)]">
                        · {formatMonthLabel(budget.month) || t("budgets.noMonth")}
                      </span>
                    </p>

                    <div className="flex flex-wrap gap-2 text-[11px]">
                      <span
                        className="rounded-full px-2.5 py-1"
                        style={{
                          color: "var(--text)",
                          background:
                            "color-mix(in srgb, var(--panel) 75%, transparent)",
                          border: "1px solid var(--border-rgba)",
                        }}
                      >
                        {t("budgets.expenseCategory")}
                      </span>

                      <span
                        className="rounded-full px-2.5 py-1"
                        style={{
                          color: "var(--text)",
                          background:
                            "color-mix(in srgb, var(--panel) 75%, transparent)",
                          border: "1px solid var(--border-rgba)",
                        }}
                      >
                        {stabilityLabel}
                      </span>

                      <span
                        className="rounded-full px-2.5 py-1"
                        style={{
                          color: "var(--text)",
                          background:
                            "color-mix(in srgb, var(--panel) 75%, transparent)",
                          border: "1px solid var(--border-rgba)",
                        }}
                      >
                        {budget.sync_status
                          ? t("budgets.pendingSync")
                          : t("budgets.syncedState")}
                      </span>
                    </div>
                  </div>

                  <div className="hidden shrink-0 items-start gap-2 sm:flex">
                    <button
                      type="button"
                      onClick={() => openEditModal(budget)}
                      className="ff-btn ff-btn-outline px-3 py-2 text-xs"
                    >
                      <HiPencil size={15} aria-hidden="true" />
                      {t("common.edit")}
                    </button>

                    <button
                      type="button"
                      onClick={() => openDetailsModal(budget)}
                      className="ff-btn ff-btn-outline px-3 py-2 text-xs"
                    >
                      <HiEye size={15} aria-hidden="true" />
                      {t("budgets.viewDetails")}
                    </button>

                    <button
                      type="button"
                      onClick={() => openDeleteModal(budget)}
                      className="ff-btn ff-btn-danger px-3 py-2 text-xs"
                    >
                      {t("common.delete")}
                    </button>
                  </div>

                  <div
                    ref={mobileMenuId === budget.id ? mobileMenuRef : null}
                    className="relative shrink-0 sm:hidden"
                  >
                    <button
                      type="button"
                      data-overflow-trigger="true"
                      aria-label="Actions"
                      onClick={() =>
                        setMobileMenuId((prev) =>
                          prev === budget.id ? null : budget.id
                        )
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

                    {mobileMenuId === budget.id && (
                      <div
                        data-overflow-menu="true"
                        className="absolute right-0 top-12 z-10 min-w-[180px] rounded-[var(--radius-md)] border p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
                        style={{
                          top: mobileMenuPlacement === "up" ? "auto" : "3rem",
                          bottom:
                            mobileMenuPlacement === "up" ? "3rem" : "auto",
                          borderColor:
                            "color-mix(in srgb, var(--border-rgba) 80%, transparent)",
                          background:
                            "color-mix(in srgb, var(--panel) 96%, transparent)",
                        }}
                      >
                        <div className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(budget)}
                            className="ff-btn ff-btn-outline w-full"
                          >
                            <HiPencil size={15} aria-hidden="true" />
                            {t("common.edit")}
                          </button>

                          <button
                            type="button"
                            onClick={() => openDetailsModal(budget)}
                            className="ff-btn ff-btn-outline w-full"
                          >
                            <HiEye size={15} aria-hidden="true" />
                            {t("budgets.viewDetails")}
                          </button>

                          <button
                            type="button"
                            onClick={() => openDeleteModal(budget)}
                            className="ff-btn ff-btn-danger w-full"
                          >
                            {t("common.delete")}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div
                    className="rounded-xl p-3"
                    style={{
                      background:
                        "color-mix(in srgb, var(--panel) 74%, transparent)",
                      border: "1px solid var(--border-rgba)",
                    }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("budgets.budget")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                      {formatCurrency(budget.limit)}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-3"
                    style={{
                      background:
                        "color-mix(in srgb, var(--panel) 74%, transparent)",
                      border: "1px solid var(--border-rgba)",
                    }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("budgets.spent")}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-[var(--text)]">
                      {formatCurrency(budget.spent)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      {t("budgets.calculatedFromTransactions")}
                    </p>
                  </div>

                  <div
                    className="rounded-xl p-3"
                    style={{
                      background:
                        "color-mix(in srgb, var(--panel) 74%, transparent)",
                      border: "1px solid var(--border-rgba)",
                    }}
                  >
                    <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      {t("budgets.remaining")}
                    </p>
                    <p
                      className="mt-1 text-lg font-semibold"
                      style={{
                        color:
                          budget.remaining < 0 ? "var(--danger)" : "var(--text)",
                      }}
                    >
                      {formatCurrency(budget.remaining)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-sm">
                  <p className="text-[var(--muted)]">{t("budgets.budgetUsage")}</p>
                  <p
                    className="font-semibold"
                    style={{
                      color: budget.over ? "var(--danger)" : "var(--text)",
                    }}
                  >
                    {percentLabel.toFixed(0)}%
                  </p>
                </div>

                <div
                  className="w-full h-2 rounded-full overflow-hidden mt-2"
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
                      width: `${Math.min(100, percentLabel)}%`,
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
      )}

      <Modal
        isOpen={editOpen}
        onClose={closeEditModal}
        title={
          budgetToEdit
            ? t("budgets.editTitleWithName", {
                category: budgetToEdit.category_name || t("budgets.noName"),
              })
            : t("budgets.editTitle")
        }
        size="md"
      >
        {!budgetToEdit ? (
          <p className="text-sm text-[var(--muted)]">
            {t("budgets.loadingInfo")}
          </p>
        ) : (
          <form onSubmit={handleEditSubmit} className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div
                className="rounded-xl p-3"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 74%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {t("budgets.currentLimit")}
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">
                  {formatCurrency(budgetToEdit.limit)}
                </p>
              </div>

              <div
                className="rounded-xl p-3"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 74%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {t("budgets.spent")}
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">
                  {formatCurrency(budgetToEdit.spent)}
                </p>
              </div>

              <div
                className="rounded-xl p-3"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 74%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {t("budgets.newRemaining")}
                </p>
                <p
                  className="mt-1 text-base font-semibold"
                  style={{
                    color:
                      editRemainingPreview < 0
                        ? "var(--danger)"
                        : "var(--text)",
                  }}
                >
                  {formatCurrency(editRemainingPreview)}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="ff-label">{t("budgets.monthlyLimit")}</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={editLimitAmount}
                onChange={(event) => setEditLimitAmount(event.target.value)}
                className="ff-input"
                required
              />
            </div>

            <div
              className="rounded-xl p-3 space-y-3"
              style={{
                background:
                  "color-mix(in srgb, var(--panel) 70%, transparent)",
                border: "1px solid var(--border-rgba)",
              }}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <label className="ff-label">
                    {t("budgets.adjustmentAmount")}
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editAdjustmentAmount}
                    onChange={(event) =>
                      setEditAdjustmentAmount(event.target.value)
                    }
                    className="ff-input mt-1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-auto">
                  <button
                    type="button"
                    onClick={() => applyEditAdjustment(1)}
                    className="ff-btn ff-btn-primary"
                  >
                    <HiPlus size={16} aria-hidden="true" />
                    {t("budgets.addAmount")}
                  </button>

                  <button
                    type="button"
                    onClick={() => applyEditAdjustment(-1)}
                    className="ff-btn ff-btn-outline"
                  >
                    <HiMinus size={16} aria-hidden="true" />
                    {t("budgets.subtractAmount")}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                type="submit"
                disabled={editLoading}
                className="ff-btn ff-btn-primary w-full sm:w-auto"
              >
                {editLoading ? t("budgets.saving") : t("budgets.saveAmount")}
              </button>

              <button
                type="button"
                onClick={closeEditModal}
                disabled={editLoading}
                className="ff-btn ff-btn-outline w-full sm:w-auto"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        )}
      </Modal>

      <Modal
        isOpen={detailsOpen}
        onClose={closeDetailsModal}
        title={
          detailsBudget
            ? t("budgets.detailsTitle", {
                category: detailsBudget.category_name || t("budgets.noName"),
                month:
                  formatMonthLabel(detailsBudget.month) ||
                  detailsBudget.month ||
                  t("budgets.noMonth"),
              })
            : t("budgets.detailsTitleFallback")
        }
        size="xl"
      >
        {!detailsBudget ? (
          <p className="text-sm text-[var(--muted)]">
            {t("budgets.loadingInfo")}
          </p>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <div
                className="rounded-xl p-3"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 74%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {t("budgets.budget")}
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">
                  {formatCurrency(detailsBudget.limit)}
                </p>
              </div>

              <div
                className="rounded-xl p-3"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 74%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {t("budgets.spent")}
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">
                  {formatCurrency(detailsTotal)}
                </p>
              </div>

              <div
                className="rounded-xl p-3"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 74%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {t("budgets.remaining")}
                </p>
                <p
                  className="mt-1 text-base font-semibold"
                  style={{
                    color:
                      detailsRemaining < 0 ? "var(--danger)" : "var(--text)",
                  }}
                >
                  {formatCurrency(detailsRemaining)}
                </p>
              </div>

              <div
                className="rounded-xl p-3"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 74%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {t("budgets.transactionsCount")}
                </p>
                <p className="mt-1 text-base font-semibold text-[var(--text)]">
                  {detailsTransactions.length}
                </p>
              </div>
            </div>

            {detailsLoading ? (
              <p className="text-sm text-[var(--muted)]">
                {t("budgets.loadingTransactions")}
              </p>
            ) : detailsTransactions.length === 0 ? (
              <div className="ff-surface p-5 text-sm text-[var(--muted)]">
                {t("budgets.noTransactions")}
              </div>
            ) : (
              <div className="max-h-[55vh] overflow-y-auto pr-1">
                <div className="hidden overflow-hidden rounded-xl border sm:block"
                  style={{
                    borderColor: "var(--border-rgba)",
                    background:
                      "color-mix(in srgb, var(--panel) 84%, transparent)",
                  }}
                >
                  <table className="ff-table">
                    <thead>
                      <tr>
                        <th className="ff-th">{t("transactions.date")}</th>
                        <th className="ff-th">
                          {t("transactions.description")}
                        </th>
                        <th className="ff-th" style={{ textAlign: "right" }}>
                          {t("transactions.amount")}
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {detailsTransactions.map((transaction) => (
                        <tr key={transaction.id} className="ff-tr">
                          <td className="ff-td">{transaction.date || "-"}</td>
                          <td className="ff-td">
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--text)]">
                                {transaction.description ||
                                  t("transactions.noDescription")}
                              </p>
                              {transaction.is_shopping_list === true && (
                                <p className="mt-1 text-xs text-[var(--muted)]">
                                  {t("transactions.shoppingListBadge")}
                                </p>
                              )}
                            </div>
                          </td>
                          <td
                            className="ff-td font-semibold"
                            style={{
                              textAlign: "right",
                              color: "var(--danger)",
                            }}
                          >
                            {formatCurrency(Number(transaction.amount || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <ul className="space-y-3 sm:hidden">
                  {detailsTransactions.map((transaction) => (
                    <li
                      key={transaction.id}
                      className="rounded-xl p-3"
                      style={{
                        background:
                          "color-mix(in srgb, var(--panel) 74%, transparent)",
                        border: "1px solid var(--border-rgba)",
                      }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text)]">
                            {transaction.description ||
                              t("transactions.noDescription")}
                          </p>
                          <p className="mt-1 text-xs text-[var(--muted)]">
                            {transaction.date || "-"}
                            {transaction.is_shopping_list === true
                              ? ` - ${t("transactions.shoppingListBadge")}`
                              : ""}
                          </p>
                        </div>

                        <p
                          className="shrink-0 text-right text-sm font-semibold"
                          style={{ color: "var(--danger)" }}
                        >
                          {formatCurrency(Number(transaction.amount || 0))}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={closeDetailsModal}
                className="ff-btn ff-btn-outline"
              >
                {t("transactions.close")}
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        isOpen={showImportModal}
        onClose={resetImportState}
        title={t("budgets.importTitle")}
        size="lg"
      >
        {!importPreview || importItems.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            {importPreview
              ? t("budgets.importEmpty", { month: importPreview.from_month })
              : t("budgets.loadingInfo")}
          </p>
        ) : (
          <>
            <div className="flex justify-between items-center mb-3 gap-3">
              <p className="text-sm text-[var(--muted)]">
                {t("budgets.importDescription", {
                  fromMonth: importPreview.from_month,
                  toMonth: importPreview.to_month,
                })}
              </p>

              <button
                type="button"
                className="text-[11px] font-semibold underline underline-offset-2 shrink-0"
                style={{ color: "var(--primary)" }}
                onClick={() => {
                  const newValue = !allSelected;
                  setImportItems((prev) =>
                    prev.map((item) => ({ ...item, selected: newValue }))
                  );
                }}
              >
                {allSelected ? t("budgets.unselectAll") : t("budgets.selectAll")}
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto mb-4">
              <table className="ff-table">
                <thead>
                  <tr>
                    <th className="ff-th">{t("budgets.select")}</th>
                    <th className="ff-th">{t("budgets.category")}</th>
                    <th className="ff-th" style={{ textAlign: "right" }}>
                      {t("budgets.expenseForMonth", {
                        month: importPreview.from_month,
                      })}
                    </th>
                    <th className="ff-th" style={{ textAlign: "right" }}>
                      {t("budgets.currentBudgetForMonth", {
                        month: importPreview.to_month,
                      })}
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {importItems.map((item, index) => (
                    <tr key={item.category_id} className="ff-tr">
                      <td className="ff-td">
                        <input
                          type="checkbox"
                          checked={item.selected}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setImportItems((prev) =>
                              prev.map((entry, entryIndex) =>
                                entryIndex === index
                                  ? { ...entry, selected: checked }
                                  : entry
                              )
                            );
                          }}
                          style={{ accentColor: "var(--primary)" }}
                        />
                      </td>

                      <td className="ff-td">
                        {item.category_name || t("budgets.noName")}
                      </td>

                      <td className="ff-td" style={{ textAlign: "right" }}>
                        {formatCurrency(item.spent_last_month)}
                      </td>

                      <td className="ff-td" style={{ textAlign: "right" }}>
                        {item.existing_budget_limit != null
                          ? formatCurrency(item.existing_budget_limit)
                          : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
              <button
                className="ff-btn ff-btn-primary w-full sm:w-auto"
                type="button"
                onClick={importSuggestedBudgets}
              >
                {t("budgets.createOrUpdateBudgets")}
              </button>

              <button
                type="button"
                className="ff-btn ff-btn-ghost w-full sm:w-auto"
                onClick={resetImportState}
              >
                {t("common.cancel")}
              </button>
            </div>
          </>
        )}
      </Modal>

      <Modal
        isOpen={deleteOpen}
        onClose={closeDeleteModal}
        title={t("budgets.deleteTitle")}
        size="sm"
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {t("budgets.deleteConfirm")}{" "}
          <span style={{ color: "var(--text)", fontWeight: 700 }}>
            {budgetToDelete?.category_name || t("budgets.noName")}
          </span>{" "}
          {t("budgets.deleteFor")}{" "}
          <span style={{ color: "var(--text)", fontWeight: 700 }}>
            {budgetToDelete?.month || ""}
          </span>
          ? {t("budgets.deleteIrreversible")}
        </p>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleteLoading}
            className="ff-btn ff-btn-danger w-full sm:w-auto"
          >
            {deleteLoading ? t("common.loadingDelete") : t("budgets.yesDelete")}
          </button>
          <button
            type="button"
            onClick={closeDeleteModal}
            disabled={deleteLoading}
            className="ff-btn ff-btn-outline w-full sm:w-auto"
          >
            {t("common.cancel")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

export default Budgets;
