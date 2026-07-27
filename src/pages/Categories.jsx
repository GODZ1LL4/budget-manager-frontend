import { useEffect, useMemo, useRef, useState } from "react";
import { HiDotsVertical } from "react-icons/hi";
import { toast } from "react-toastify";

import FFSelect from "../components/FFSelect";
import Modal from "../components/Modal";
import {
  createCategory,
  deleteCategoryRecord,
  listCategories,
  syncPendingCategories,
  updateCategory,
} from "../lib/repositories/categoriesRepository";
import { listUsedTransactionCategoryIds } from "../lib/repositories/transactionsRepository";
import { useAppPreferences } from "../context/AppPreferencesContext";
import useClickOutside from "../hooks/useClickOutside";
import useOverflowMenuPosition from "../hooks/useOverflowMenuPosition";

function Categories({ token, subscriptionMode }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("expense");
  const [categories, setCategories] = useState([]);
  const [editId, setEditId] = useState(null);
  const [stabilityType, setStabilityType] = useState("variable");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteCat, setDeleteCat] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [usedCategoryIds, setUsedCategoryIds] = useState(new Set());
  const [mobileMenuId, setMobileMenuId] = useState(null);
  const mobileMenuRef = useRef(null);
  const { t } = useAppPreferences();

  useClickOutside(mobileMenuRef, () => setMobileMenuId(null), Boolean(mobileMenuId));
  const mobileMenuPlacement = useOverflowMenuPosition(
    mobileMenuRef,
    Boolean(mobileMenuId)
  );

  const fetchCategories = async () => {
    try {
      const res = await listCategories({ token, subscriptionMode });
      setCategories(res.data);
    } catch {
      toast.error(t("categories.fetchError"));
    }
  };

  const fetchCategoryUsage = async () => {
    try {
      const ids = await listUsedTransactionCategoryIds();
      setUsedCategoryIds(new Set(ids));
    } catch {
      toast.error(t("categories.usageError"));
    }
  };

  const resetForm = () => {
    setName("");
    setType("expense");
    setStabilityType("variable");
    setEditId(null);
    setMobileMenuId(null);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error(t("categories.nameRequired"));
      return;
    }

    try {
      await createCategory({
        token,
        payload: {
          name: name.trim(),
          type,
          stability_type: stabilityType,
        },
        subscriptionMode,
      });

      resetForm();
      await fetchCategories();
      toast.success(t("categories.created"));
    } catch {
      toast.error(t("categories.createError"));
    }
  };

  const startEdit = (cat) => {
    setEditId(cat.id);
    setName(cat.name);
    setType(cat.type);
    setStabilityType(cat.stability_type || "variable");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const editingCategory = categories.find(
    (category) => String(category.id) === String(editId)
  );

  const handleUpdate = async (id) => {
    if (!name.trim()) {
      toast.error(t("categories.nameRequired"));
      return;
    }

    try {
      await updateCategory({
        token,
        id,
        payload: {
          name: name.trim(),
          type,
          stability_type: stabilityType,
        },
        subscriptionMode,
      });

      resetForm();
      await fetchCategories();
      toast.success(t("categories.updated"));
    } catch {
      toast.error(t("categories.updateError"));
    }
  };

  const openDeleteModal = (cat) => {
    if (usedCategoryIds.has(String(cat.id))) {
      toast.error(t("categories.deleteBlocked"));
      return;
    }

    setDeleteCat(cat);
    setDeleteOpen(true);
    setMobileMenuId(null);
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteOpen(false);
    setDeleteCat(null);
  };

  const confirmDelete = async () => {
    if (!deleteCat) return;

    setDeleteLoading(true);
    try {
      await deleteCategoryRecord({
        token,
        category: deleteCat,
        subscriptionMode,
      });
      await fetchCategories();
      toast.success(t("categories.deleted"));
      closeDeleteModal();
    } catch {
      toast.error(t("categories.deleteError"));
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchCategories();
      fetchCategoryUsage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriptionMode]);

  useEffect(() => {
    if (!token) return;

    const runSync = async () => {
      const result = await syncPendingCategories({
        token,
        subscriptionMode,
      });
      if (result.synced > 0) {
        await fetchCategories();
        await fetchCategoryUsage();
        toast.success(t("categories.synced", { count: result.synced }));
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

  const typeOptions = useMemo(
    () => [
      { value: "expense", label: t("categoryType.expense") },
      { value: "income", label: t("categoryType.income") },
    ],
    [t]
  );

  const stabilityOptions = useMemo(
    () => [
      { value: "fixed", label: t("stabilityType.fixed") },
      { value: "variable", label: t("stabilityType.variable") },
      { value: "occasional", label: t("stabilityType.occasional") },
    ],
    [t]
  );

  const resolveCategoryTypeLabel = (value) =>
    value === "income" ? t("categoryType.income") : t("categoryType.expense");

  const resolveStabilityLabel = (value) =>
    t(`stabilityType.${value || "variable"}`);

  return (
    <div className="ff-card p-4 md:p-6">
      <h2 className="text-xl md:text-2xl font-bold mb-2 text-[var(--heading-accent)]">
        {t("categories.title")}
      </h2>
      <p className="text-sm text-[var(--muted)] mb-4">
        {t("categories.subtitle")}
      </p>

      {editId && (
        <div
          className="mb-4 rounded-2xl border px-4 py-4"
          style={{
            borderColor:
              "color-mix(in srgb, var(--primary) 42%, var(--border-rgba))",
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--primary) 14%, var(--panel)) 0%, color-mix(in srgb, var(--panel) 88%, transparent) 100%)",
            boxShadow: "var(--glow-shadow)",
          }}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {t("categories.editing")}
          </p>
          <p className="mt-1 text-base font-semibold text-[var(--text)]">
            {editingCategory?.name || t("categories.selectedCategory")}
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t("categories.editingHelp")}
          </p>
        </div>
      )}

      <form
        onSubmit={
          editId
            ? (e) => {
                e.preventDefault();
                handleUpdate(editId);
              }
            : handleCreate
        }
        className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(170px,0.7fr)_minmax(190px,0.8fr)_auto]"
      >
        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
            {t("categories.name")}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("categories.namePlaceholder")}
            className="ff-input"
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
            {t("categories.type")}
          </label>
          <FFSelect
            value={type}
            onChange={(v) => setType(v)}
            options={typeOptions}
            searchable={false}
            clearable={false}
          />
        </div>

        <div className="flex flex-col space-y-1">
          <label className="text-xs font-semibold tracking-wide uppercase text-[var(--muted)]">
            {t("categories.stability")}
          </label>
          <FFSelect
            value={stabilityType}
            onChange={(v) => setStabilityType(v)}
            options={stabilityOptions}
            searchable={false}
            clearable={false}
          />
        </div>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="ff-btn ff-btn-primary min-w-[120px] w-full md:w-auto"
          >
            {editId ? t("categories.saveChanges") : t("categories.add")}
          </button>

          {editId && (
            <button
              type="button"
              onClick={resetForm}
              className="ff-btn ff-btn-outline min-w-[110px] w-full md:w-auto"
            >
              {t("common.cancel")}
            </button>
          )}
        </div>
      </form>

      <div className="space-y-3 md:hidden">
        {categories.map((cat) => (
          <article
            key={cat.id}
            className="rounded-2xl p-4"
            style={{
              border: "var(--border-w) solid var(--border-rgba)",
              background: "color-mix(in srgb, var(--panel) 62%, transparent)",
              boxShadow: editId === cat.id ? "var(--glow-shadow)" : "none",
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-base font-semibold text-[var(--text)] break-words">
                  {cat.name}
                </p>
              </div>

              <div
                ref={mobileMenuId === cat.id ? mobileMenuRef : null}
                className="relative shrink-0"
              >
                <button
                  type="button"
                  data-overflow-trigger="true"
                  aria-label="Actions"
                  onClick={() =>
                    setMobileMenuId((prev) => (prev === cat.id ? null : cat.id))
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

                {mobileMenuId === cat.id && (
                  <div
                    data-overflow-menu="true"
                    className="absolute right-0 top-12 z-10 min-w-[180px] rounded-[var(--radius-md)] border p-2 shadow-[0_18px_40px_rgba(0,0,0,0.45)]"
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
                          startEdit(cat);
                          setMobileMenuId(null);
                        }}
                        className="ff-btn ff-btn-outline w-full"
                      >
                        {editId === cat.id
                          ? t("categories.keepEditing")
                          : t("common.edit")}
                      </button>

                      <button
                        type="button"
                        onClick={() => openDeleteModal(cat)}
                        className="ff-btn ff-btn-danger w-full"
                        disabled={usedCategoryIds.has(String(cat.id))}
                        title={
                          usedCategoryIds.has(String(cat.id))
                            ? t("categories.deleteBlocked")
                            : t("common.delete")
                        }
                        style={
                          usedCategoryIds.has(String(cat.id))
                            ? { opacity: 0.55, cursor: "not-allowed" }
                            : undefined
                        }
                      >
                        {t("common.delete")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div
                className="rounded-xl px-3 py-2"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 72%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  {t("categories.type")}
                </p>
                <p className="mt-1 break-words text-sm text-[var(--text)]">
                  {resolveCategoryTypeLabel(cat.type)}
                </p>
              </div>

              <div
                className="rounded-xl px-3 py-2"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 72%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                  {t("categories.stability")}
                </p>
                <p className="mt-1 break-words text-sm text-[var(--text)]">
                  {resolveStabilityLabel(cat.stability_type)}
                </p>
              </div>

              <div
                className="col-span-2 rounded-xl px-3 py-2"
                style={{
                  background:
                    "color-mix(in srgb, var(--panel) 72%, transparent)",
                  border: "1px solid var(--border-rgba)",
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                      {t("categories.state")}
                    </p>
                    <p className="mt-1 break-words text-sm text-[var(--text)]">
                      {usedCategoryIds.has(String(cat.id))
                        ? t("categories.inUse")
                        : cat.sync_status
                        ? t("categories.pending")
                        : t("categories.syncedState")}
                    </p>
                  </div>

                  {editId === cat.id && (
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        color: "var(--text)",
                        border: "1px solid var(--border-rgba)",
                        background:
                          "color-mix(in srgb, var(--primary) 18%, var(--panel))",
                      }}
                    >
                      {t("categories.editing")}
                    </span>
                  )}
                </div>
              </div>
            </div>

          </article>
        ))}

        {categories.length === 0 && (
          <div className="p-4 text-sm text-[var(--muted)]">
            {t("categories.noCategories")}
          </div>
        )}
      </div>

      <div
        className="hidden overflow-x-auto rounded-xl md:block"
        style={{
          border: "var(--border-w) solid var(--border-rgba)",
          background: "color-mix(in srgb, var(--panel) 55%, transparent)",
          boxShadow: "var(--glow-shadow)",
        }}
      >
        <table className="ff-table min-w-full text-sm">
          <thead>
            <tr>
              <th className="ff-th">{t("categories.name")}</th>
              <th className="ff-th">{t("categories.type")}</th>
              <th className="ff-th">{t("categories.stability")}</th>
              <th className="ff-th">{t("categories.state")}</th>
              <th className="ff-th" style={{ textAlign: "center" }}>
                {t("common.actions")}
              </th>
            </tr>
          </thead>

          <tbody>
            {categories.map((cat) => (
              <tr key={cat.id} className="ff-tr">
                <td className="ff-td">
                  <div className="flex items-center gap-2">
                    <span>{cat.name}</span>
                    {editId === cat.id && (
                      <span
                        className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          color: "var(--text)",
                          border: "1px solid var(--border-rgba)",
                          background:
                            "color-mix(in srgb, var(--primary) 18%, var(--panel))",
                        }}
                      >
                        {t("categories.editing")}
                      </span>
                    )}
                  </div>
                </td>

                <td className="ff-td text-xs italic text-[var(--muted)]">
                  {resolveCategoryTypeLabel(cat.type)}
                </td>

                <td className="ff-td text-xs italic text-[var(--muted)]">
                  {resolveStabilityLabel(cat.stability_type)}
                </td>

                <td className="ff-td text-xs text-[var(--muted)]">
                  {usedCategoryIds.has(String(cat.id))
                    ? t("categories.inUse")
                    : cat.sync_status
                    ? t("categories.pending")
                    : t("categories.syncedState")}
                </td>

                <td className="ff-td">
                  <div className="flex justify-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="ff-btn ff-btn-outline ff-btn-sm"
                    >
                      {editId === cat.id
                        ? t("categories.keepEditing")
                        : t("common.edit")}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDeleteModal(cat)}
                      className="ff-btn ff-btn-danger ff-btn-sm"
                      disabled={usedCategoryIds.has(String(cat.id))}
                      title={
                        usedCategoryIds.has(String(cat.id))
                          ? t("categories.deleteBlocked")
                          : t("common.delete")
                      }
                      style={
                        usedCategoryIds.has(String(cat.id))
                          ? { opacity: 0.55, cursor: "not-allowed" }
                          : undefined
                      }
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {categories.length === 0 && (
          <div className="p-4 text-sm text-[var(--muted)]">
            {t("categories.noCategories")}
          </div>
        )}
      </div>

      <Modal
        isOpen={deleteOpen}
        onClose={closeDeleteModal}
        title={t("categories.deleteTitle")}
        size="sm"
      >
        <p className="text-sm" style={{ color: "var(--muted)" }}>
          {t("categories.deleteConfirm")}{" "}
          <span style={{ color: "var(--text)", fontWeight: 700 }}>
            {deleteCat?.name || ""}
          </span>
          ? {t("categories.deleteIrreversible")}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={confirmDelete}
            disabled={deleteLoading}
            className="ff-btn ff-btn-danger"
          >
            {deleteLoading
              ? t("common.loadingDelete")
              : t("categories.yesDelete")}
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
    </div>
  );
}

export default Categories;
