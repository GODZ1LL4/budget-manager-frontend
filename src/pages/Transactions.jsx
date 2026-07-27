import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Capacitor } from "@capacitor/core";
import { HiDotsVertical, HiUpload } from "react-icons/hi";
import { toast } from "react-toastify";
import Modal from "../components/Modal";
import ImportTransactionsModal from "../components/ImportTransactionsModal";
import ImportShoppingListModal from "../components/ImportShoppingListModal";
import ShoppingListQuickModal from "../components/ShoppingListQuickModal";
import FFSelect from "../components/FFSelect";
import {
  createTransaction,
  deleteTransactionRecord,
  listTransactions,
  loadTransactionsDependencies,
  updateTransaction,
} from "../lib/repositories/transactionsRepository";
import {
  canUsePremiumBackend,
  isLocalOnlyMode,
} from "../lib/subscription/subscriptionAccess";
import {
  addDaysToDateKey,
  currentMonthRange,
  todayDateKey,
} from "../lib/dates/localDate";
import { useAppPreferences } from "../context/AppPreferencesContext";
import useClickOutside from "../hooks/useClickOutside";
import useOverflowMenuPosition from "../hooks/useOverflowMenuPosition";

function getCurrentMonthRange() {
  return currentMonthRange();
}

function filterTransactionsLocally(data, filters) {
  return (data || []).filter((tx) => {
    const descriptionMatch = filters.description?.trim()
      ? (tx.description || "").toLowerCase().includes(filters.description.trim().toLowerCase())
      : true;
    const typeMatch = filters.type && filters.type !== "all" ? tx.type === filters.type : true;
    const accountMatch = filters.accountId
      ? [tx.account_id, tx.account?.id, tx.account_from_id, tx.account_to_id, tx.account_from?.id, tx.account_to?.id]
          .filter(Boolean)
          .some((value) => String(value) === String(filters.accountId))
      : true;
    const categoryMatch = filters.categoryId
      ? String(tx.category_id || tx.categories?.id || "") === String(filters.categoryId)
      : true;
    const fromMatch = filters.dateFrom ? tx.date >= filters.dateFrom : true;
    const toMatch = filters.dateTo ? tx.date <= filters.dateTo : true;
    const absAmount = Math.abs(Number(tx.amount || 0));
    const minMatch = filters.amountMin !== "" ? absAmount >= Number(filters.amountMin) : true;
    const maxMatch = filters.amountMax !== "" ? absAmount <= Number(filters.amountMax) : true;
    const shoppingMatch =
      filters.shoppingMode === "shopping"
        ? tx.is_shopping_list === true
        : filters.shoppingMode === "regular"
        ? tx.is_shopping_list !== true
        : true;

    return (
      descriptionMatch &&
      typeMatch &&
      accountMatch &&
      categoryMatch &&
      fromMatch &&
      toMatch &&
      minMatch &&
      maxMatch &&
      shoppingMatch
    );
  });
}

function Transactions({ token, subscriptionMode }) {
  const monthRange = getCurrentMonthRange();
  const { t, formatCurrency } = useAppPreferences();
  const api = import.meta.env.VITE_API_URL;
  const isNativeMobile = Capacitor.getPlatform() !== "web";
  const canUseShoppingListInMobile = canUsePremiumBackend(subscriptionMode);
  const shoppingListBlockedOnMobile =
    isNativeMobile && !canUseShoppingListInMobile;
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => todayDateKey());
  const [transactions, setTransactions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [isShoppingList, setIsShoppingList] = useState(false);
  const [articleLines, setArticleLines] = useState([{ item_id: "", quantity: 1 }]);
  const [discount, setDiscount] = useState(0);
  const [recurrence, setRecurrence] = useState("");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState("");
  const [showImportTransactionsModal, setShowImportTransactionsModal] = useState(false);
  const [showImportShoppingModal, setShowImportShoppingModal] = useState(false);
  const [showQuickShoppingModal, setShowQuickShoppingModal] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedTx, setSelectedTx] = useState(null);
  const [selectedTxItems, setSelectedTxItems] = useState([]);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [filterDescription, setFilterDescription] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterAccountId, setFilterAccountId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState(monthRange.from);
  const [filterDateTo, setFilterDateTo] = useState(monthRange.to);
  const [filterRangePreset, setFilterRangePreset] = useState("this_month");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [filterShoppingMode, setFilterShoppingMode] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editForm, setEditForm] = useState({ amount: "", type: "expense", account_id: "", category_id: "", description: "", date: "" });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [mobileMenuId, setMobileMenuId] = useState(null);
  const mobileMenuRef = useRef(null);

  useClickOutside(mobileMenuRef, () => setMobileMenuId(null), Boolean(mobileMenuId));
  const mobileMenuPlacement = useOverflowMenuPosition(
    mobileMenuRef,
    Boolean(mobileMenuId)
  );

  const txTypeOptions = useMemo(() => [
    { value: "expense", label: t("transactions.expense") },
    { value: "income", label: t("transactions.income") },
  ], [t]);

  const recurrenceOptions = useMemo(() => [
    { value: "", label: t("transactions.oneTime") },
    { value: "monthly", label: t("transactions.monthly") },
    { value: "biweekly", label: t("transactions.biweekly") },
    { value: "weekly", label: t("transactions.weekly") },
  ], [t]);

  const filterTypeOptions = useMemo(() => [
    { value: "all", label: t("transactions.all") },
    { value: "expense", label: t("transactions.expense") },
    { value: "income", label: t("transactions.income") },
    { value: "transfer", label: t("transactions.transfer") },
  ], [t]);

  const rangePresetOptions = useMemo(() => [
    { value: "custom", label: t("transactions.customRange") },
    { value: "this_month", label: t("transactions.thisMonth") },
    { value: "last_30_days", label: t("transactions.last30Days") },
    { value: "this_year", label: t("transactions.thisYear") },
    { value: "all_time", label: t("transactions.allTime") },
  ], [t]);

  const shoppingFilterOptions = useMemo(() => [
    { value: "all", label: t("transactions.all") },
    { value: "regular", label: t("transactions.regularOnly") },
    { value: "shopping", label: t("transactions.shoppingOnly") },
  ], [t]);

  const accountOptions = useMemo(() => accounts.map((acc) => ({ value: acc.id, label: acc.name })), [accounts]);
  const createCategoryOptions = useMemo(() => categories.filter((cat) => cat.type === type).map((cat) => ({ value: cat.id, label: cat.name })), [categories, type]);
  const filterCategoryOptions = useMemo(() => categories.filter((cat) => filterType === "all" ? true : filterType === "transfer" ? false : cat.type === filterType).map((cat) => ({ value: cat.id, label: cat.name })), [categories, filterType]);
  const editCategoryOptions = useMemo(() => categories.filter((cat) => !editForm.type || cat.type === editForm.type).map((cat) => ({ value: cat.id, label: cat.name })), [categories, editForm.type]);

  const resolveAccountName = (tx) => {
    if (tx.type === "transfer") {
      const fromName = accounts.find((acc) => String(acc.id) === String(tx.account_from_id || tx.account_from?.id || ""))?.name || tx.account_from?.name || t("transactions.unknownAccount");
      const toName = accounts.find((acc) => String(acc.id) === String(tx.account_to_id || tx.account_to?.id || ""))?.name || tx.account_to?.name || t("transactions.unknownAccount");
      return `${fromName} -> ${toName}`;
    }
    return accounts.find((acc) => String(acc.id) === String(tx.account_id || tx.account?.id || ""))?.name || tx.account?.name || t("transactions.noAccount");
  };

  const resolveCategoryName = (tx) =>
    categories.find((cat) => String(cat.id) === String(tx.category_id || tx.categories?.id || ""))?.name ||
    tx.categories?.name ||
    t("transactions.noCategory");

  const resolveItemName = (line) => line.items?.name || t("transactions.itemUnnamed");

  const resolveActiveFilters = (customFilters) => ({
    description: customFilters?.description ?? filterDescription,
    type: customFilters?.type ?? filterType,
    accountId: customFilters?.accountId ?? filterAccountId,
    categoryId: customFilters?.categoryId ?? filterCategoryId,
    dateFrom: customFilters?.dateFrom ?? filterDateFrom,
    dateTo: customFilters?.dateTo ?? filterDateTo,
    amountMin: customFilters?.amountMin ?? filterAmountMin,
    amountMax: customFilters?.amountMax ?? filterAmountMax,
    shoppingMode: customFilters?.shoppingMode ?? filterShoppingMode,
  });

  const fetchTransactions = async (customFilters) => {
    try {
      if (customFilters?.nativeEvent) customFilters = undefined;
      const result = await listTransactions({ token, subscriptionMode });
      setTransactions(filterTransactionsLocally(result.data, resolveActiveFilters(customFilters)));
    } catch (err) {
      console.error("Error cargando transacciones:", err);
      toast.error(t("transactions.loadError"));
    }
  };

  const fetchInitialData = async () => {
    try {
      const deps = await loadTransactionsDependencies({ token, subscriptionMode });
      setAccounts(deps?.accounts || []);
      setCategories(deps?.categories || []);
      setItems(deps?.items || []);
      await fetchTransactions();
    } catch (err) {
      console.error("Error cargando datos iniciales:", err);
      toast.error(t("transactions.initialDataError"));
    }
  };

  const summary = useMemo(() => transactions.reduce((acc, tx) => {
    const value = Number(tx.amount || 0);
    if (tx.type === "income") acc.income += value;
    if (tx.type === "expense") acc.expense += value;
    acc.count += 1;
    return acc;
  }, { income: 0, expense: 0, count: 0 }), [transactions]);

  const resetCreateForm = () => {
    setAmount("");
    setDescription("");
    setArticleLines([{ item_id: "", quantity: 1 }]);
    setRecurrence("");
    setRecurrenceEndDate("");
    setIsShoppingList(false);
    setDiscount(0);
  };

  const openDetail = async (tx) => {
    if (!canUsePremiumBackend(subscriptionMode)) {
      toast.info(t("transactions.itemsDetailUnavailable"));
      return;
    }
    setSelectedTx(tx);
    setIsDetailOpen(true);
    setSelectedTxItems([]);
    setIsLoadingItems(true);
    try {
      const res = await axios.get(`${api}/transactions/${tx.id}/items`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedTxItems(res.data.data || []);
    } catch (err) {
      console.error("Error cargando items de la transaccion:", err);
      toast.error(t("transactions.itemsLoadError"));
    } finally {
      setIsLoadingItems(false);
    }
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedTx(null);
    setSelectedTxItems([]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (shoppingListBlockedOnMobile && isShoppingList) {
      return toast.info(t("transactions.itemsDetailUnavailable"));
    }
    if (isShoppingList) return toast.info(t("transactions.shoppingListInfo"));
    if (!amount || !accountId || !categoryId || !date) {
      return toast.error(t("transactions.fillAllFields"));
    }
    try {
      const result = await createTransaction({
        token,
        payload: {
          amount: parseFloat(amount),
          account_id: accountId,
          category_id: categoryId,
          type,
          description,
          date,
          recurrence: recurrence || null,
          recurrence_end_date: recurrenceEndDate || null,
          items: isShoppingList ? articleLines : [],
          discount: isShoppingList ? discount : 0,
        },
        subscriptionMode,
      });
      toast.success(result?.offline ? t("transactions.createdOffline") : t("transactions.created"));
      resetCreateForm();
      await fetchTransactions();
    } catch (err) {
      console.error("Error al crear transaccion:", err);
      toast.error(t("transactions.createError"));
    }
  };

  const openDeleteModal = (id) => {
    setDeleteId(id);
    setDeleteOpen(true);
    setMobileMenuId(null);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeleteId(null);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleteLoading(true);
    try {
      const transaction = transactions.find((tx) => tx.id === deleteId);
      const result = await deleteTransactionRecord({ token, transaction, subscriptionMode });
      toast.success(result?.offline ? t("transactions.deletedOffline") : t("transactions.deleted"));
      await fetchTransactions();
      closeDeleteModal();
    } catch (err) {
      console.error("Error al eliminar transaccion:", err);
      toast.error(t("transactions.deleteError"));
    } finally {
      setDeleteLoading(false);
    }
  };

  const openEdit = (tx) => {
    setEditingTx(tx);
    setIsEditOpen(true);
    setMobileMenuId(null);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingTx(null);
  };

  const handleEditChange = (field, value) => {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "type") {
        const currentCategory = categories.find((c) => c.id === prev.category_id);
        if (currentCategory && currentCategory.type !== value) next.category_id = "";
      }
      return next;
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingTx) return;
    const isShoppingListTx = editingTx.is_shopping_list === true;
    const payload = {
      account_id: editForm.account_id,
      category_id: editForm.category_id,
      description: editForm.description,
      date: editForm.date,
      recurrence: editingTx.recurrence || null,
      recurrence_end_date: editingTx.recurrence_end_date || null,
    };
    if (!isShoppingListTx) {
      payload.amount = parseFloat(editForm.amount || 0);
      payload.type = editForm.type;
    }
    try {
      const result = await updateTransaction({
        token,
        id: editingTx.id,
        payload,
        subscriptionMode,
      });
      toast.success(result?.offline ? t("transactions.updatedOffline") : t("transactions.updated"));
      await fetchTransactions();
      closeEdit();
    } catch (err) {
      console.error("Error al actualizar transaccion:", err);
      toast.error(t("transactions.updateError"));
    }
  };

  const applyRangePreset = (preset) => {
    const today = todayDateKey();
    setFilterRangePreset(preset);
    if (preset === "custom") return;
    if (preset === "all_time") {
      setFilterDateFrom("");
      setFilterDateTo("");
      return;
    }
    if (preset === "this_year") {
      setFilterDateFrom(`${today.slice(0, 4)}-01-01`);
      setFilterDateTo(today);
      return;
    }
    if (preset === "last_30_days") {
      setFilterDateFrom(addDaysToDateKey(today, -29));
      setFilterDateTo(today);
      return;
    }
    const current = getCurrentMonthRange();
    setFilterDateFrom(current.from);
    setFilterDateTo(current.to);
  };

  const clearFilters = () => {
    const current = getCurrentMonthRange();
    setFilterDescription("");
    setFilterType("all");
    setFilterAccountId("");
    setFilterCategoryId("");
    setFilterDateFrom(current.from);
    setFilterDateTo(current.to);
    setFilterRangePreset("this_month");
    setFilterAmountMin("");
    setFilterAmountMax("");
    setFilterShoppingMode("all");
    fetchTransactions({
      description: "",
      type: "all",
      accountId: "",
      categoryId: "",
      dateFrom: current.from,
      dateTo: current.to,
      amountMin: "",
      amountMax: "",
      shoppingMode: "all",
    });
  };

  const handleExport = async () => {
    if (!canUsePremiumBackend(subscriptionMode)) {
      return toast.info(t("transactions.exportUnavailable"));
    }
    try {
      const params = {};
      if (filterDescription.trim()) params.description = filterDescription.trim();
      if (filterType && filterType !== "all") params.type = filterType;
      if (filterAccountId) params.account_id = filterAccountId;
      if (filterCategoryId) params.category_id = filterCategoryId;
      if (filterDateFrom) params.date_from = filterDateFrom;
      if (filterDateTo) params.date_to = filterDateTo;
      const res = await axios.get(`${api}/transactions/export`, {
        headers: { Authorization: `Bearer ${token}` },
        params,
        responseType: "blob",
      });
      const blob = new Blob([res.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transactions_${filterDateFrom || "all"}_to_${filterDateTo || "all"}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error exportando:", err);
      toast.error(t("transactions.exportError"));
    }
  };

  const handleImportTransactions = async (payloads) => {
    let imported = 0;
    let offline = 0;

    try {
      for (const payload of payloads) {
        const result = await createTransaction({
          token,
          payload,
          subscriptionMode,
        });
        imported += 1;
        if (result?.offline) offline += 1;
      }

      await fetchTransactions();
      toast.success(
        offline > 0
          ? t("transactions.importTransactionsImportedOffline", { count: imported })
          : t("transactions.importTransactionsImported", { count: imported })
      );

      return { imported, offline };
    } catch (err) {
      console.error("Error importando transacciones:", err);
      const message =
        imported > 0
          ? t("transactions.importTransactionsPartialError", { count: imported })
          : t("transactions.importTransactionsError");
      toast.error(message);
      throw new Error(message);
    }
  };

  useEffect(() => {
    if (token) fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriptionMode]);

  useEffect(() => {
    if (editingTx) {
      setEditForm({
        amount: Number(editingTx.amount || 0).toFixed(2),
        type: editingTx.type,
        account_id: editingTx.account_id || "",
        category_id: editingTx.category_id || "",
        description: editingTx.description || "",
        date: editingTx.date || todayDateKey(),
      });
    }
  }, [editingTx]);

  useEffect(() => {
    if (isShoppingList && items.length > 0) {
      let total = articleLines.reduce((sum, line) => {
        const item = items.find((entry) => entry.id === line.item_id);
        if (!item) return sum;
        const price = item.latest_price || 0;
        const qty = parseFloat(line.quantity) || 1;
        const subtotal = price * qty;
        const taxAmount = item.is_exempt ? 0 : subtotal * (parseFloat(item.tax_rate || 0) / 100);
        setRecurrence("");
        setRecurrenceEndDate("");
        return sum + subtotal + taxAmount;
      }, 0);
      if (discount > 0) total = total * (1 - discount / 100);
      setAmount(total.toFixed(2));
    }
  }, [articleLines, isShoppingList, items, discount]);

  useEffect(() => {
    if (shoppingListBlockedOnMobile && isShoppingList) {
      setIsShoppingList(false);
      setDiscount(0);
    }
  }, [shoppingListBlockedOnMobile, isShoppingList]);

  useEffect(() => {
    const selectedCategory = categories.find((c) => c.id === filterCategoryId);
    if (!selectedCategory) return setFilterCategoryId("");
    if (filterType === "expense" && selectedCategory.type !== "expense") setFilterCategoryId("");
    if (filterType === "income" && selectedCategory.type !== "income") setFilterCategoryId("");
    if (filterType === "transfer") setFilterCategoryId("");
  }, [filterType, categories, filterCategoryId]);

  return (
    <div className="ff-card p-6 space-y-6">
      <div>
        <h2 className="ff-h2 mb-1">
          <span className="ff-heading-accent">{t("transactions.title")}</span>
        </h2>
        <p className="text-sm text-[var(--muted)]">{t("transactions.subtitle")}</p>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
        <div className="col-span-full space-y-3 py-3 px-4 rounded-xl border" style={{ background: "color-mix(in srgb, var(--panel) 70%, transparent)", borderColor: "var(--border-rgba)", borderWidth: "var(--border-w)", borderRadius: "var(--radius-lg)" }}>
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isShoppingList}
              onChange={(e) => setIsShoppingList(e.target.checked)}
              disabled={shoppingListBlockedOnMobile}
              className="h-4 w-4 rounded"
              style={{ accentColor: "var(--primary)" }}
            />
            <span className="text-sm font-medium text-[var(--text)]">{t("transactions.shoppingListToggle")}</span>
          </label>
          {shoppingListBlockedOnMobile && (
            <p className="text-xs text-[var(--muted)]">
              Lista de compra disponible en mobile solo para Premium.
            </p>
          )}
          {isShoppingList && (
            <div className="pl-7 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShowQuickShoppingModal(true)} className="ff-btn ff-btn-primary">{t("transactions.createShoppingList")}</button>
                <button type="button" onClick={() => setShowImportShoppingModal(true)} className="ff-btn" style={{ background: "color-mix(in srgb, var(--panel) 88%, var(--bg-1))", borderColor: "color-mix(in srgb, var(--primary) 25%, var(--border-rgba))" }}>{t("transactions.importShoppingList")}</button>
              </div>
              <p className="text-xs text-[var(--muted)]">{t("transactions.shoppingListHelp")}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">{t("transactions.amount")}</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} readOnly={isShoppingList} className="ff-input" required />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">{t("transactions.type")}</label>
          <FFSelect value={type} onChange={(v) => setType(v)} options={txTypeOptions} placeholder={t("transactions.selectOption")} />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">{t("transactions.date")}</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="ff-input" required />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">{t("transactions.account")}</label>
          <FFSelect value={accountId} onChange={(v) => setAccountId(v)} options={accountOptions} placeholder={t("transactions.selectAccount")} />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">{t("transactions.category")}</label>
          <FFSelect value={categoryId} onChange={(v) => setCategoryId(v)} options={createCategoryOptions} placeholder={t("transactions.selectCategory")} />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="ff-label">{t("transactions.recurrence")}</label>
          <FFSelect value={recurrence} disabled={isShoppingList} onChange={(v) => { setRecurrence(v); if (!v) setRecurrenceEndDate(""); }} options={recurrenceOptions} clearable={false} />
        </div>

        {recurrence && (
          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("transactions.recurrenceUntil")}</label>
            <input type="date" value={recurrenceEndDate} onChange={(e) => setRecurrenceEndDate(e.target.value)} className="ff-input" />
          </div>
        )}

        {isShoppingList && (
          <div className="flex flex-col space-y-1">
            <label className="ff-label">{t("transactions.discount")}</label>
            <input type="number" value={discount} min="0" max="100" step="0.01" onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)} className="ff-input" placeholder="5" />
          </div>
        )}

        <div className="flex flex-col md:col-span-3 space-y-1">
          <label className="ff-label">{t("transactions.description")}</label>
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("transactions.descriptionPlaceholder")} className="ff-input" />
        </div>

        <div className="md:col-span-3 mt-2">
          <button type="submit" className="ff-btn ff-btn-primary w-full">{t("transactions.addTransaction")}</button>
        </div>
      </form>

      <div className="ff-surface p-4">
        <div className="hidden md:block">
          <h3 className="text-sm font-semibold text-[var(--text)]">{t("transactions.filters")}</h3>
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((prev) => !prev)}
          className="md:hidden w-full rounded-xl border px-4 py-3 text-left"
          aria-expanded={filtersOpen}
          aria-controls="transactions-filters-panel"
          style={{
            borderColor: "var(--border-rgba)",
            background: "color-mix(in srgb, var(--panel) 80%, transparent)",
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text)]">{t("transactions.filters")}</p>
            </div>
            <span
              className="shrink-0 rounded-full border px-3 py-1 text-xs font-semibold"
              style={{
                borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border-rgba))",
                color: "var(--text)",
                background: "color-mix(in srgb, var(--primary) 10%, transparent)",
              }}
            >
              {filtersOpen ? "Ocultar" : "Abrir"}
            </span>
          </div>
        </button>

        <div id="transactions-filters-panel" className={`${filtersOpen ? "mt-4 block" : "hidden"} md:block md:mt-4`}>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.search")}</label>
              <input type="text" value={filterDescription} onChange={(e) => setFilterDescription(e.target.value)} className="ff-input" placeholder={t("transactions.searchPlaceholder")} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.type")}</label>
              <FFSelect value={filterType} onChange={(v) => setFilterType(v)} options={filterTypeOptions} clearable={false} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.rangePreset")}</label>
              <FFSelect value={filterRangePreset} onChange={(v) => applyRangePreset(v)} options={rangePresetOptions} clearable={false} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.movementKind")}</label>
              <FFSelect value={filterShoppingMode} onChange={(v) => setFilterShoppingMode(v)} options={shoppingFilterOptions} clearable={false} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.category")}</label>
              <FFSelect value={filterCategoryId} onChange={(v) => setFilterCategoryId(v)} options={filterCategoryOptions} placeholder={t("transactions.all")} disabled={filterType === "transfer"} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.account")}</label>
              <FFSelect value={filterAccountId} onChange={(v) => setFilterAccountId(v)} options={accountOptions} placeholder={t("transactions.all")} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.amountMin")}</label>
              <input type="number" step="0.01" value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} className="ff-input" />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.amountMax")}</label>
              <input type="number" step="0.01" value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} className="ff-input" />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.from")}</label>
              <input type="date" value={filterDateFrom} onChange={(e) => { setFilterRangePreset("custom"); setFilterDateFrom(e.target.value); }} className="ff-input" />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.to")}</label>
              <input type="date" value={filterDateTo} onChange={(e) => { setFilterRangePreset("custom"); setFilterDateTo(e.target.value); }} className="ff-input" />
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <button type="button" onClick={() => fetchTransactions()} className="ff-btn ff-btn-primary w-full sm:w-auto">{t("transactions.filters")}</button>
            <button type="button" onClick={clearFilters} className="ff-btn ff-btn-outline w-full sm:w-auto">{t("transactions.clearFilters")}</button>
            <button type="button" onClick={() => setShowImportTransactionsModal(true)} className="hidden sm:inline-flex ff-btn ff-btn-outline w-full items-center justify-center gap-2 sm:w-auto">
              <HiUpload className="h-4 w-4" aria-hidden="true" />
              {t("transactions.importTransactions")}
            </button>
            <button type="button" onClick={handleExport} className="hidden sm:block ff-btn w-full sm:w-auto" disabled={isLocalOnlyMode(subscriptionMode)}>{t("transactions.exportExcel")}</button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 md:gap-3">
        <div className="min-w-0 rounded-xl p-3 border" style={{ borderColor: "var(--border-rgba)", background: "color-mix(in srgb, var(--panel) 76%, transparent)" }}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{t("transactions.summaryCount")}</p>
          <p className="mt-1 font-mono text-base md:text-lg font-semibold text-[var(--text)] leading-tight [overflow-wrap:anywhere]">{summary.count}</p>
        </div>
        <div className="min-w-0 rounded-xl p-3 border" style={{ borderColor: "var(--border-rgba)", background: "color-mix(in srgb, var(--panel) 76%, transparent)" }}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{t("transactions.summaryIncome")}</p>
          <p className="mt-1 font-mono text-base md:text-lg font-semibold leading-tight [overflow-wrap:anywhere]" style={{ color: "var(--success)" }}>{formatCurrency(summary.income)}</p>
        </div>
        <div className="min-w-0 rounded-xl p-3 border" style={{ borderColor: "var(--border-rgba)", background: "color-mix(in srgb, var(--panel) 76%, transparent)" }}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{t("transactions.summaryExpense")}</p>
          <p className="mt-1 font-mono text-base md:text-lg font-semibold leading-tight [overflow-wrap:anywhere]" style={{ color: "var(--danger)" }}>{formatCurrency(summary.expense)}</p>
        </div>
        <div className="min-w-0 rounded-xl p-3 border" style={{ borderColor: "var(--border-rgba)", background: "color-mix(in srgb, var(--panel) 76%, transparent)" }}>
          <p className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">{t("transactions.summaryNet")}</p>
          <p className="mt-1 font-mono text-base md:text-lg font-semibold leading-tight [overflow-wrap:anywhere]" style={{ color: summary.income - summary.expense >= 0 ? "var(--success)" : "var(--danger)" }}>{formatCurrency(summary.income - summary.expense)}</p>
        </div>
      </div>

      <div>
        <h3 className="text-lg font-semibold text-[var(--text)] mb-3">{t("transactions.recentHistory")}</h3>
        <ul className="space-y-3">
          {transactions.map((tx) => {
            const amountColor = tx.type === "income" ? "var(--success)" : tx.type === "expense" ? "var(--danger)" : "var(--text)";
            return (
              <li key={tx.id} className="ff-surface p-4 flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center" style={{ boxShadow: "var(--tx-item-shadow)" }}>
                <div className="flex items-start justify-between gap-3 sm:block">
                  <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--text)] flex flex-wrap items-center gap-2">
                    <span style={{ color: amountColor }}>
                      {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                      {formatCurrency(Number(tx.amount || 0))}
                    </span>
                    <span className="text-[var(--text)]">
                      {" - "}
                      {tx.type === "transfer" ? t("transactions.transferFallback") : resolveCategoryName(tx)}
                    </span>
                    {tx.is_shopping_list === true && (
                      <button
                        type="button"
                        onClick={() => openDetail(tx)}
                        disabled={isLocalOnlyMode(subscriptionMode)}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border"
                        style={{
                          borderColor: "color-mix(in srgb, var(--primary) 35%, var(--border-rgba))",
                          background: "color-mix(in srgb, var(--primary) 12%, transparent)",
                          color: "var(--text)",
                        }}
                        title={t("transactions.detailButtonTitle")}
                      >
                        {t("transactions.shoppingListBadge")}
                      </button>
                    )}
                  </p>

                  <p className="text-sm text-[var(--muted)] mt-1">
                    {tx.description || t("transactions.noDescription")}
                    {" - "}
                    {resolveAccountName(tx)}
                    {" - "}
                    {tx.date}
                  </p>
                  </div>

                  {!isNativeMobile && null}

                  {isNativeMobile && (
                    <div
                      ref={mobileMenuId === tx.id ? mobileMenuRef : null}
                      className="relative shrink-0 self-start"
                    >
                      <button
                        type="button"
                        data-overflow-trigger="true"
                        aria-label="Acciones"
                        onClick={() =>
                          setMobileMenuId((prev) => (prev === tx.id ? null : tx.id))
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

                      {mobileMenuId === tx.id && (
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
                            background:
                              "color-mix(in srgb, var(--panel) 96%, transparent)",
                          }}
                        >
                          <div className="flex flex-col gap-2">
                            {tx.type !== "transfer" && (
                              <button
                                type="button"
                                onClick={() => openEdit(tx)}
                                className="ff-btn ff-btn-outline w-full"
                              >
                                {t("common.edit")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openDeleteModal(tx.id)}
                              className="ff-btn ff-btn-danger w-full"
                            >
                              {t("common.delete")}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {!isNativeMobile && (
                  <div className="flex gap-2">
                    {tx.type !== "transfer" && (
                      <button onClick={() => openEdit(tx)} className="ff-btn ff-btn-outline px-3 py-2 text-sm">
                        {t("common.edit")}
                      </button>
                    )}
                    <button onClick={() => openDeleteModal(tx.id)} className="ff-btn ff-btn-danger px-3 py-2 text-sm">
                      {t("common.delete")}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      <Modal isOpen={isDetailOpen} onClose={closeDetail} title={selectedTx ? `${t("transactions.shoppingListDetailTitle")} - ${selectedTx.date}` : t("transactions.shoppingListDetailTitle")} size="lg">
        {!selectedTx ? (
          <p className="text-sm text-[var(--muted)]">{t("transactions.loading")}</p>
        ) : (
          <div className="space-y-6" style={{ color: "var(--text)" }}>
            <div>
              <div
                className="rounded-2xl border p-4 space-y-4"
                style={{
                  borderColor: "var(--border-rgba)",
                  background: "linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, transparent), color-mix(in srgb, var(--panel) 82%, transparent))",
                  boxShadow: "inset 0 1px 0 color-mix(in srgb, var(--text) 6%, transparent)",
                }}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-1">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{t("transactions.transactionSummary")}</p>
                    <p className="text-sm text-[var(--muted)]">{selectedTx.description || t("transactions.noDescription")}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">{t("transactions.lineTotal")}</p>
                    <p className="mt-1 font-mono text-2xl font-extrabold leading-tight" style={{ color: "var(--primary)" }}>{formatCurrency(Number(selectedTx.amount || 0))}</p>
                    {selectedTx.discount_percent > 0 && (
                      <p className="mt-1 font-mono text-xs" style={{ color: "var(--primary)" }}>
                        {t("transactions.appliedDiscount")}: <span className="font-semibold">{selectedTx.discount_percent}%</span>
                      </p>
                    )}
                  </div>
                </div>

                <div
                  className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm border-t pt-3"
                  style={{ borderColor: "color-mix(in srgb, var(--border-rgba) 75%, transparent)" }}
                >
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{t("transactions.date")}</p>
                    <p className="mt-1 font-mono font-semibold text-[var(--text)]">{selectedTx.date}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{t("transactions.account")}</p>
                    <p className="mt-1 font-semibold text-[var(--text)]">{resolveAccountName(selectedTx)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{t("transactions.category")}</p>
                    <p className="mt-1 font-semibold text-[var(--text)]">{resolveCategoryName(selectedTx)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{t("transactions.quantity")}</p>
                    <p className="mt-1 font-mono font-semibold text-[var(--text)]">{selectedTxItems.length}</p>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-semibold text-[var(--text)]">{t("transactions.purchasedItems")}</h4>
                {selectedTxItems.length > 0 && <span className="text-[11px] text-[var(--muted)]">{selectedTxItems.length}</span>}
              </div>
              {isLoadingItems && <p className="text-sm text-[var(--muted)] italic">{t("transactions.loadingItems")}</p>}
              {!isLoadingItems && selectedTxItems.length === 0 && <p className="text-sm text-[var(--muted)] italic">{t("transactions.noItems")}</p>}
              {!isLoadingItems && selectedTxItems.length > 0 && (
                <div
                  className="overflow-hidden rounded-2xl border"
                  style={{
                    borderColor: "var(--border-rgba)",
                    background: "color-mix(in srgb, var(--panel) 84%, transparent)",
                  }}
                >
                  <div
                    className="hidden sm:grid grid-cols-[minmax(0,2.2fr)_0.7fr_1fr_0.9fr_1fr] gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em]"
                    style={{
                      color: "var(--muted)",
                      background: "repeating-linear-gradient(180deg, color-mix(in srgb, var(--panel) 97%, transparent) 0px, color-mix(in srgb, var(--panel) 97%, transparent) 22px, color-mix(in srgb, var(--border-rgba) 12%, transparent) 23px)",
                      borderBottom: "1px solid var(--border-rgba)",
                    }}
                  >
                    <span className="font-mono">{t("transactions.purchasedItems")}</span>
                    <span className="text-right font-mono">{t("transactions.quantity")}</span>
                    <span className="text-right font-mono">{t("transactions.unitPrice")}</span>
                    <span className="text-right font-mono">{t("transactions.tax")}</span>
                    <span className="text-right font-mono">{t("transactions.lineTotal")}</span>
                  </div>

                  {selectedTxItems.map((line, index) => {
                    const quantity = Number(line.quantity || 0);
                    const lineTotal = Number(line.line_total_final || 0);
                    const taxRate = Number(line.tax_rate_used || 0);
                    const isExempt = line.is_exempt_used === true;
                    const divisor = isExempt ? 1 : 1 + taxRate / 100;
                    const taxAmount = isExempt ? 0 : lineTotal - (divisor > 0 ? lineTotal / divisor : lineTotal);

                    return (
                      <div key={line.id}>
                        <div
                          className="sm:hidden px-4 py-3"
                          style={{
                            background: index % 2 === 0
                              ? "color-mix(in srgb, var(--panel) 76%, transparent)"
                              : "color-mix(in srgb, var(--panel) 81%, transparent)",
                            borderTop: index === 0 ? "none" : "1px dashed color-mix(in srgb, var(--border-rgba) 82%, transparent)",
                          }}
                        >
                          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold text-[var(--text)]">{resolveItemName(line)}</p>
                              <p className="font-mono text-[11px] text-[var(--muted)]">
                                {isExempt ? t("transactions.exempt") : `${t("transactions.tax")}: ${taxRate}%`}
                              </p>
                            </div>
                            <p
                              className="max-w-[38vw] text-right font-mono text-[13px] font-semibold leading-tight [overflow-wrap:anywhere]"
                              style={{ color: "var(--primary)" }}
                            >
                              {formatCurrency(lineTotal)}
                            </p>
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2">
                            <div className="min-w-0 rounded-lg border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--border-rgba) 72%, transparent)" }}>
                              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{t("transactions.quantity")}</p>
                              <p className="mt-1 font-mono text-[13px] font-semibold leading-tight text-[var(--text)]">{quantity}</p>
                            </div>
                            <div className="min-w-0 rounded-lg border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--border-rgba) 72%, transparent)" }}>
                              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{t("transactions.tax")}</p>
                              <p className="mt-1 font-mono text-[13px] font-semibold leading-tight text-[var(--text)] [overflow-wrap:anywhere]">{formatCurrency(taxAmount)}</p>
                            </div>
                            <div className="col-span-2 min-w-0 rounded-lg border px-2.5 py-2" style={{ borderColor: "color-mix(in srgb, var(--border-rgba) 72%, transparent)" }}>
                              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{t("transactions.unitPrice")}</p>
                              <p className="mt-1 font-mono text-[13px] font-semibold leading-tight text-[var(--text)] [overflow-wrap:anywhere]">{formatCurrency(Number(line.unit_price_final || 0))}</p>
                            </div>
                          </div>
                        </div>

                        <div
                          className="hidden sm:grid grid-cols-[minmax(0,2.2fr)_0.7fr_1fr_0.9fr_1fr] gap-3 px-4 py-3 text-sm items-center"
                          style={{
                            background: index % 2 === 0
                              ? "color-mix(in srgb, var(--panel) 76%, transparent)"
                              : "color-mix(in srgb, var(--panel) 81%, transparent)",
                            borderTop: index === 0 ? "none" : "1px dashed color-mix(in srgb, var(--border-rgba) 82%, transparent)",
                          }}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-[var(--text)]">{resolveItemName(line)}</p>
                            <p className="font-mono text-[11px] text-[var(--muted)]">
                              {isExempt ? t("transactions.exempt") : `${t("transactions.tax")}: ${taxRate}%`}
                            </p>
                          </div>
                          <p className="text-right font-mono font-medium text-[var(--text)]">{quantity}</p>
                          <p className="text-right font-mono font-medium text-[var(--text)]">{formatCurrency(Number(line.unit_price_final || 0))}</p>
                          <p className="text-right font-mono font-medium text-[var(--text)]">{formatCurrency(taxAmount)}</p>
                          <p className="text-right font-mono font-semibold" style={{ color: "var(--primary)" }}>{formatCurrency(lineTotal)}</p>
                        </div>
                      </div>
                    );
                  })}

                  <div
                    className="flex flex-col items-stretch gap-3 px-4 py-3 border-t sm:flex-row sm:items-center sm:justify-end sm:gap-6"
                    style={{
                      borderColor: "var(--border-rgba)",
                      background: "repeating-linear-gradient(180deg, color-mix(in srgb, var(--panel) 94%, transparent) 0px, color-mix(in srgb, var(--panel) 94%, transparent) 24px, color-mix(in srgb, var(--border-rgba) 10%, transparent) 25px)",
                    }}
                  >
                    {selectedTx.discount_percent > 0 && (
                      <div className="text-left sm:text-right">
                        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{t("transactions.appliedDiscount")}</p>
                        <p className="font-mono text-sm font-semibold text-[var(--text)]">{selectedTx.discount_percent}%</p>
                      </div>
                    )}
                    <div className="text-left sm:text-right">
                      <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">{t("transactions.lineTotal")}</p>
                      <p className="font-mono text-lg font-extrabold" style={{ color: "var(--primary)" }}>{formatCurrency(Number(selectedTx.amount || 0))}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button type="button" onClick={closeDetail} className="ff-btn ff-btn-outline">{t("transactions.close")}</button>
            </div>
          </div>
        )}
      </Modal>

      <ImportTransactionsModal
        isOpen={showImportTransactionsModal}
        onClose={() => setShowImportTransactionsModal(false)}
        accounts={accounts}
        categories={categories}
        onImport={handleImportTransactions}
        formatCurrency={formatCurrency}
        t={t}
      />

      <ImportShoppingListModal
        isOpen={showImportShoppingModal}
        onClose={() => setShowImportShoppingModal(false)}
        items={items}
        api={api}
        token={token}
        meta={{ account_id: accountId, category_id: categoryId, date, description, discount }}
        onImported={async () => {
          await fetchTransactions();
          resetCreateForm();
          setShowImportShoppingModal(false);
        }}
      />

      <Modal isOpen={isEditOpen} onClose={closeEdit} title={editingTx ? `${t("transactions.editTransaction")} - ${editingTx.date}` : t("transactions.editTransaction")} size="md">
        {!editingTx ? (
          <p className="text-sm text-[var(--muted)]">{t("transactions.loading")}</p>
        ) : (
          <form onSubmit={handleEditSubmit} className="space-y-4 text-sm" style={{ color: "var(--text)" }}>
            {editingTx.is_shopping_list && (
              <div className="rounded-lg border px-3 py-2 text-xs" style={{ borderColor: "color-mix(in srgb, var(--warning) 45%, transparent)", background: "color-mix(in srgb, var(--warning) 12%, transparent)", color: "color-mix(in srgb, var(--warning) 85%, var(--text))" }}>
                {t("transactions.shoppingListEditWarning")}
              </div>
            )}

            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.amount")}</label>
              <input type="number" step="0.01" value={editForm.amount} onChange={(e) => handleEditChange("amount", e.target.value)} readOnly={editingTx.is_shopping_list === true} className="ff-input" style={editingTx.is_shopping_list ? { opacity: 0.65, cursor: "not-allowed" } : undefined} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.type")}</label>
              <FFSelect value={editForm.type} onChange={(v) => handleEditChange("type", v)} disabled={editingTx.is_shopping_list === true} options={txTypeOptions} clearable={false} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.date")}</label>
              <input type="date" value={editForm.date} onChange={(e) => handleEditChange("date", e.target.value)} className="ff-input" required />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.account")}</label>
              <FFSelect value={editForm.account_id} onChange={(v) => handleEditChange("account_id", v)} options={accountOptions} placeholder={t("transactions.selectAccount")} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.category")}</label>
              <FFSelect value={editForm.category_id} onChange={(v) => handleEditChange("category_id", v)} options={editCategoryOptions} placeholder={t("transactions.selectCategory")} />
            </div>
            <div className="flex flex-col space-y-1">
              <label className="ff-label">{t("transactions.description")}</label>
              <input type="text" value={editForm.description} onChange={(e) => handleEditChange("description", e.target.value)} className="ff-input" placeholder={t("transactions.descriptionPlaceholder")} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="submit" className="ff-btn ff-btn-primary">{t("transactions.saveChanges")}</button>
              <button type="button" onClick={closeEdit} className="ff-btn ff-btn-outline">{t("common.cancel")}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={deleteOpen} onClose={closeDeleteModal} title={t("transactions.deleteTitle")} size="sm">
        <p className="text-sm" style={{ color: "var(--muted)" }}>{t("transactions.deleteConfirm")}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={handleDelete} disabled={deleteLoading} className="ff-btn ff-btn-danger">
            {deleteLoading ? t("transactions.deleting") : t("transactions.yesDelete")}
          </button>
          <button type="button" onClick={closeDeleteModal} disabled={deleteLoading} className="ff-btn ff-btn-outline">
            {t("common.cancel")}
          </button>
        </div>
      </Modal>

      <ShoppingListQuickModal
        isOpen={showQuickShoppingModal}
        onClose={() => setShowQuickShoppingModal(false)}
        api={api}
        token={token}
        items={items}
        meta={{ account_id: accountId, category_id: categoryId, date, description, discount }}
        onCreated={async () => {
          await fetchTransactions();
          resetCreateForm();
          setShowQuickShoppingModal(false);
        }}
      />
    </div>
  );
}

export default Transactions;


