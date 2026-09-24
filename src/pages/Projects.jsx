import { useEffect, useMemo, useState } from "react";
import {
  HiCheck,
  HiClipboardList,
  HiPause,
  HiPencil,
  HiPlay,
  HiPlus,
  HiTrash,
  HiX,
} from "react-icons/hi";
import { toast } from "react-toastify";
import FFSelect from "../components/FFSelect";
import Modal from "../components/Modal";
import { useAppPreferences } from "../context/AppPreferencesContext";
import { listAccounts } from "../lib/repositories/accountsRepository";
import { listCategories } from "../lib/repositories/categoriesRepository";
import { listTransactions } from "../lib/repositories/transactionsRepository";
import {
  completeProjectRecord,
  createProject,
  createProjectMilestone,
  createProjectTask,
  deleteProjectMilestone,
  deleteProjectRecord,
  deleteProjectTask,
  listProjects,
  linkProjectTransaction,
  syncPendingProjects,
  unlinkProjectTransaction,
  updateProjectMilestone,
  updateProjectRecord,
  updateProjectStatus,
  updateProjectTask,
} from "../lib/repositories/projectsRepository";

const emptyProjectForm = {
  name: "",
  description: "",
  status: "active",
  priority: "medium",
  start_date: "",
  due_date: "",
  budget_amount: "",
  account_id: "",
};

const emptyTaskForm = {
  title: "",
  notes: "",
  due_date: "",
};

const emptyMilestoneForm = {
  title: "",
  target_date: "",
};

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getTaskStats(project) {
  const tasks = project.tasks || [];
  const done = tasks.filter((task) => task.status === "done").length;
  const total = tasks.length;

  return {
    done,
    total,
    progress: total > 0 ? done / total : 0,
  };
}

function isProjectOverdue(project) {
  if (!project.due_date || project.status === "completed") return false;
  return String(project.due_date) < getTodayKey();
}

function isProjectCompleted(project) {
  return project?.status === "completed";
}

function getTransactionCategoryName(transaction, categoryMap, fallback) {
  const category = Array.isArray(transaction?.categories)
    ? transaction.categories[0]
    : transaction?.categories;
  const categoryId =
    transaction?.category_id || category?.id || transaction?.category?.id;

  return (
    transaction?.category_name ||
    category?.name ||
    transaction?.category?.name ||
    (categoryId ? categoryMap.get(String(categoryId))?.name : null) ||
    fallback
  );
}

function getProjectCategoryBreakdown(project, categoryMap, fallbackCategory) {
  const rowsByCategory = new Map();

  for (const transaction of project.linked_transactions || []) {
    if (transaction.type && transaction.type !== "expense") continue;

    const rawAmount = Number(transaction.amount || 0);
    if (!Number.isFinite(rawAmount) || rawAmount === 0) continue;

    const amount = Math.abs(rawAmount);
    const category = Array.isArray(transaction?.categories)
      ? transaction.categories[0]
      : transaction?.categories;
    const categoryId =
      transaction?.category_id || category?.id || transaction?.category?.id;
    const categoryName = getTransactionCategoryName(
      transaction,
      categoryMap,
      fallbackCategory
    );
    const key = categoryId ? `id:${categoryId}` : `name:${categoryName}`;

    if (!rowsByCategory.has(key)) {
      rowsByCategory.set(key, {
        key,
        category: categoryName,
        count: 0,
        total: 0,
      });
    }

    const row = rowsByCategory.get(key);
    row.count += 1;
    row.total += amount;
  }

  const total = Array.from(rowsByCategory.values()).reduce(
    (sum, row) => sum + row.total,
    0
  );

  return Array.from(rowsByCategory.values())
    .map((row) => ({
      ...row,
      percent: total > 0 ? (row.total / total) * 100 : 0,
    }))
    .sort(
      (left, right) =>
        right.total - left.total || left.category.localeCompare(right.category)
    );
}

function StatusPill({ children, tone = "primary" }) {
  const toneVar =
    tone === "danger"
      ? "var(--danger)"
      : tone === "warning"
      ? "var(--warning)"
      : tone === "success"
      ? "var(--success)"
      : "var(--primary)";

  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold"
      style={{
        background: `color-mix(in srgb, ${toneVar} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${toneVar} 35%, var(--border-rgba))`,
        color: `color-mix(in srgb, ${toneVar} 85%, var(--text))`,
      }}
    >
      {children}
    </span>
  );
}

function Projects({ token, subscriptionMode }) {
  const { t, formatCurrency } = useAppPreferences();
  const [projects, setProjects] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [form, setForm] = useState(emptyProjectForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [detailProjectId, setDetailProjectId] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editProjectId, setEditProjectId] = useState(null);
  const [editForm, setEditForm] = useState(emptyProjectForm);
  const [deleteProject, setDeleteProject] = useState(null);
  const [taskFormByProject, setTaskFormByProject] = useState({});
  const [milestoneFormByProject, setMilestoneFormByProject] = useState({});
  const [selectedTransactionByProject, setSelectedTransactionByProject] =
    useState({});
  const [loadingAction, setLoadingAction] = useState(false);

  const projectStatusOptions = useMemo(
    () => [
      { value: "active", label: t("projects.statusActive") },
      { value: "paused", label: t("projects.statusPaused") },
      { value: "completed", label: t("projects.statusCompleted") },
      { value: "cancelled", label: t("projects.statusCancelled") },
    ],
    [t]
  );

  const priorityOptions = useMemo(
    () => [
      { value: "low", label: t("projects.priorityLow") },
      { value: "medium", label: t("projects.priorityMedium") },
      { value: "high", label: t("projects.priorityHigh") },
    ],
    [t]
  );

  const taskStatusOptions = useMemo(
    () => [
      { value: "todo", label: t("projects.taskTodo") },
      { value: "doing", label: t("projects.taskDoing") },
      { value: "done", label: t("projects.taskDone") },
      { value: "blocked", label: t("projects.taskBlocked") },
    ],
    [t]
  );

  const statusFilterOptions = useMemo(
    () => [
      { value: "all", label: t("projects.allStatuses") },
      ...projectStatusOptions,
    ],
    [projectStatusOptions, t]
  );

  const priorityFilterOptions = useMemo(
    () => [
      { value: "all", label: t("projects.allPriorities") },
      ...priorityOptions,
    ],
    [priorityOptions, t]
  );

  const accountOptions = useMemo(
    () => [
      { value: "", label: t("projects.noAccount") },
      ...accounts.map((account) => ({
        value: account.id,
        label: account.name,
      })),
    ],
    [accounts, t]
  );

  const accountMap = useMemo(() => {
    const map = new Map();
    accounts.forEach((account) => map.set(String(account.id), account));
    return map;
  }, [accounts]);

  const categoryMap = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => map.set(String(category.id), category));
    return map;
  }, [categories]);

  const fetchProjects = async () => {
    try {
      const res = await listProjects({ token, subscriptionMode });
      setProjects(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      toast.error(error?.response?.data?.error || t("projects.fetchError"));
    }
  };

  const fetchLookups = async () => {
    try {
      const [accountsRes, categoriesRes, transactionsRes] = await Promise.all([
        listAccounts({ token, subscriptionMode }),
        listCategories({ token, subscriptionMode }),
        listTransactions({ token, subscriptionMode }),
      ]);
      setAccounts(Array.isArray(accountsRes.data) ? accountsRes.data : []);
      setCategories(Array.isArray(categoriesRes.data) ? categoriesRes.data : []);
      setTransactions(
        Array.isArray(transactionsRes.data) ? transactionsRes.data : []
      );
    } catch {
      setAccounts([]);
      setCategories([]);
      setTransactions([]);
    }
  };

  useEffect(() => {
    if (!token) return;
    fetchProjects();
    fetchLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriptionMode]);

  useEffect(() => {
    if (!token) return;

    const runSync = async () => {
      const result = await syncPendingProjects({ token, subscriptionMode });
      if (result.synced > 0) {
        await fetchProjects();
        toast.success(t("projects.synced", { count: result.synced }));
      }
    };

    runSync();

    const handleOnline = () => runSync();
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, subscriptionMode, t]);

  const decoratedProjects = useMemo(
    () =>
      projects.map((project) => {
        const categoryBreakdown = getProjectCategoryBreakdown(
          project,
          categoryMap,
          t("projects.noCategory")
        );
        const categoryExpenseTotal = categoryBreakdown.reduce(
          (total, row) => total + row.total,
          0
        );

        return {
          ...project,
          taskStats: getTaskStats(project),
          overdue: isProjectOverdue(project),
          account: project.account_id
            ? accountMap.get(String(project.account_id))
            : null,
          categoryBreakdown,
          categoryExpenseTotal,
        };
      }),
    [accountMap, categoryMap, projects, t]
  );

  const filteredProjects = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return decoratedProjects.filter((project) => {
      const matchesSearch =
        !search ||
        String(project.name || "").toLowerCase().includes(search) ||
        String(project.description || "").toLowerCase().includes(search);
      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;
      const matchesPriority =
        priorityFilter === "all" || project.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [decoratedProjects, priorityFilter, searchTerm, statusFilter]);

  const summary = useMemo(() => {
    const active = projects.filter((project) => project.status === "active").length;
    const completed = projects.filter(
      (project) => project.status === "completed"
    ).length;
    const overdue = projects.filter(isProjectOverdue).length;
    const totalBudget = projects.reduce(
      (total, project) => total + Number(project.budget_amount || 0),
      0
    );

    return { active, completed, overdue, totalBudget };
  }, [projects]);

  const detailProject = useMemo(
    () =>
      decoratedProjects.find(
        (project) => String(project.id) === String(detailProjectId)
      ) || null,
    [decoratedProjects, detailProjectId]
  );
  const detailReadOnly = isProjectCompleted(detailProject);

  const transactionMap = useMemo(() => {
    const map = new Map();
    transactions.forEach((transaction) =>
      map.set(String(transaction.id), transaction)
    );
    return map;
  }, [transactions]);

  const editProject = useMemo(
    () =>
      projects.find((project) => String(project.id) === String(editProjectId)) ||
      null,
    [editProjectId, projects]
  );

  const getStatusLabel = (status) =>
    projectStatusOptions.find((option) => option.value === status)?.label ||
    status;

  const getTaskStatusLabel = (status) =>
    taskStatusOptions.find((option) => option.value === status)?.label ||
    status;

  const getTaskTone = (status) => {
    if (status === "done") return "success";
    if (status === "blocked") return "danger";
    if (status === "doing") return "warning";
    return "primary";
  };

  const getPriorityLabel = (priority) =>
    priorityOptions.find((option) => option.value === priority)?.label || priority;

  const getProjectTone = (project) => {
    if (project.overdue) return "danger";
    if (project.status === "completed") return "success";
    if (project.status === "paused") return "warning";
    return "primary";
  };

  const getLinkedTransactionCategoryName = (
    transaction,
    fallback = t("projects.noCategoryShort")
  ) =>
    getTransactionCategoryName(
      transaction,
      categoryMap,
      fallback
    );

  const getTransactionLabel = (transaction) => {
    const description =
      transaction.description ||
      getLinkedTransactionCategoryName(transaction, "") ||
      t("transactions.noDescription");
    return `${transaction.date || "-"} - ${description} - ${formatCurrency(
      transaction.amount
    )}`;
  };

  const getAvailableTransactionOptions = (project) => {
    const linkedIds = new Set(
      (project?.linked_transactions || []).map((transaction) =>
        String(transaction.id)
      )
    );

    return transactions
      .filter((transaction) => transaction.type === "expense")
      .filter((transaction) => !linkedIds.has(String(transaction.id)))
      .map((transaction) => ({
        value: transaction.id,
        label: getTransactionLabel(transaction),
        subLabel: getLinkedTransactionCategoryName(transaction),
      }));
  };

  const updateFormValue = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateEditFormValue = (field, value) => {
    setEditForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setLoadingAction(true);

    try {
      await createProject({
        token,
        payload: {
          ...form,
          budget_amount: form.budget_amount || 0,
        },
        subscriptionMode,
      });

      setForm(emptyProjectForm);
      await fetchProjects();
      toast.success(t("projects.created"));
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || t("projects.createError"));
    } finally {
      setLoadingAction(false);
    }
  };

  const openEdit = (project) => {
    if (isProjectCompleted(project)) return;

    setEditProjectId(project.id);
    setEditForm({
      name: project.name || "",
      description: project.description || "",
      status: project.status || "active",
      priority: project.priority || "medium",
      start_date: project.start_date || "",
      due_date: project.due_date || "",
      budget_amount: String(project.budget_amount || ""),
      account_id: project.account_id || "",
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    if (loadingAction) return;
    setEditOpen(false);
    setEditProjectId(null);
    setEditForm(emptyProjectForm);
  };

  const handleEdit = async (event) => {
    event.preventDefault();
    if (!editProject) return;
    if (isProjectCompleted(editProject)) return;
    setLoadingAction(true);

    try {
      await updateProjectRecord({
        token,
        project: editProject,
        payload: {
          ...editForm,
          budget_amount: editForm.budget_amount || 0,
        },
        subscriptionMode,
      });
      await fetchProjects();
      closeEdit();
      toast.success(t("projects.updated"));
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || t("projects.updateError"));
    } finally {
      setLoadingAction(false);
    }
  };

  const handleStatusAction = async (project, status) => {
    if (isProjectCompleted(project)) return;

    setLoadingAction(true);
    try {
      if (status === "completed") {
        await completeProjectRecord({ token, project, subscriptionMode });
      } else {
        await updateProjectStatus({ token, project, status, subscriptionMode });
      }
      await fetchProjects();
      toast.success(t("projects.statusUpdated"));
    } catch (error) {
      toast.error(error?.response?.data?.error || t("projects.statusError"));
    } finally {
      setLoadingAction(false);
    }
  };

  const confirmDeleteProject = async () => {
    if (!deleteProject) return;
    if (isProjectCompleted(deleteProject)) {
      setDeleteProject(null);
      return;
    }
    setLoadingAction(true);

    try {
      await deleteProjectRecord({
        token,
        project: deleteProject,
        subscriptionMode,
      });
      await fetchProjects();
      setDeleteProject(null);
      if (String(detailProjectId) === String(deleteProject.id)) {
        setDetailProjectId(null);
      }
      toast.success(t("projects.deleted"));
    } catch (error) {
      toast.error(error?.response?.data?.error || t("projects.deleteError"));
    } finally {
      setLoadingAction(false);
    }
  };

  const updateTaskForm = (projectId, field, value) => {
    setTaskFormByProject((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] || emptyTaskForm),
        [field]: value,
      },
    }));
  };

  const updateMilestoneForm = (projectId, field, value) => {
    setMilestoneFormByProject((current) => ({
      ...current,
      [projectId]: {
        ...(current[projectId] || emptyMilestoneForm),
        [field]: value,
      },
    }));
  };

  const handleCreateTask = async (project) => {
    if (isProjectCompleted(project)) return;

    const taskForm = taskFormByProject[project.id] || emptyTaskForm;
    try {
      await createProjectTask({
        token,
        project,
        payload: {
          ...taskForm,
          status: "todo",
          position: (project.tasks || []).length + 1,
        },
        subscriptionMode,
      });
      setTaskFormByProject((current) => ({
        ...current,
        [project.id]: emptyTaskForm,
      }));
      await fetchProjects();
      toast.success(t("projects.taskCreated"));
    } catch (error) {
      toast.error(error?.response?.data?.error || error.message || t("projects.taskError"));
    }
  };

  const handleTaskStatus = async (project, task, status) => {
    if (isProjectCompleted(project)) return;

    try {
      await updateProjectTask({
        token,
        project,
        task,
        payload: { status },
        subscriptionMode,
      });
      await fetchProjects();
    } catch (error) {
      toast.error(error?.response?.data?.error || t("projects.taskError"));
    }
  };

  const handleDeleteTask = async (project, task) => {
    if (isProjectCompleted(project)) return;

    try {
      await deleteProjectTask({ token, project, task, subscriptionMode });
      await fetchProjects();
      toast.success(t("projects.taskDeleted"));
    } catch (error) {
      toast.error(error?.response?.data?.error || t("projects.taskError"));
    }
  };

  const handleCreateMilestone = async (project) => {
    if (isProjectCompleted(project)) return;

    const milestoneForm =
      milestoneFormByProject[project.id] || emptyMilestoneForm;
    try {
      await createProjectMilestone({
        token,
        project,
        payload: milestoneForm,
        subscriptionMode,
      });
      setMilestoneFormByProject((current) => ({
        ...current,
        [project.id]: emptyMilestoneForm,
      }));
      await fetchProjects();
      toast.success(t("projects.milestoneCreated"));
    } catch (error) {
      toast.error(
        error?.response?.data?.error || error.message || t("projects.milestoneError")
      );
    }
  };

  const handleToggleMilestone = async (project, milestone) => {
    if (isProjectCompleted(project)) return;

    try {
      await updateProjectMilestone({
        token,
        project,
        milestone,
        payload: {
          completed_at: milestone.completed_at ? null : new Date().toISOString(),
        },
        subscriptionMode,
      });
      await fetchProjects();
    } catch (error) {
      toast.error(error?.response?.data?.error || t("projects.milestoneError"));
    }
  };

  const handleDeleteMilestone = async (project, milestone) => {
    if (isProjectCompleted(project)) return;

    try {
      await deleteProjectMilestone({
        token,
        project,
        milestone,
        subscriptionMode,
      });
      await fetchProjects();
      toast.success(t("projects.milestoneDeleted"));
    } catch (error) {
      toast.error(error?.response?.data?.error || t("projects.milestoneError"));
    }
  };

  const handleLinkTransaction = async (project) => {
    if (isProjectCompleted(project)) return;

    const transactionId = selectedTransactionByProject[project.id];
    const transaction = transactionMap.get(String(transactionId));

    if (!transaction) {
      toast.error(t("projects.selectTransaction"));
      return;
    }

    try {
      await linkProjectTransaction({
        token,
        project,
        transaction,
        subscriptionMode,
      });
      setSelectedTransactionByProject((current) => ({
        ...current,
        [project.id]: "",
      }));
      await fetchProjects();
      toast.success(t("projects.transactionLinked"));
    } catch (error) {
      toast.error(
        error?.response?.data?.error || error.message || t("projects.transactionLinkError")
      );
    }
  };

  const handleUnlinkTransaction = async (project, transaction) => {
    if (isProjectCompleted(project)) return;

    try {
      await unlinkProjectTransaction({
        token,
        project,
        transaction,
        subscriptionMode,
      });
      await fetchProjects();
      toast.success(t("projects.transactionUnlinked"));
    } catch (error) {
      toast.error(error?.response?.data?.error || t("projects.transactionLinkError"));
    }
  };

  return (
    <div className="ff-card p-6 space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--heading-accent)]">
            {t("projects.title")}
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {t("projects.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:min-w-[34rem]">
          <SummaryBox label={t("projects.active")} value={summary.active} />
          <SummaryBox label={t("projects.overdue")} value={summary.overdue} tone="danger" />
          <SummaryBox label={t("projects.completed")} value={summary.completed} tone="success" />
          <SummaryBox
            label={t("projects.totalBudget")}
            value={formatCurrency(summary.totalBudget)}
          />
        </div>
      </div>

      <form
        onSubmit={handleCreate}
        className="grid grid-cols-1 gap-4 md:grid-cols-3"
      >
        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.name")}</label>
          <input
            value={form.name}
            onChange={(event) => updateFormValue("name", event.target.value)}
            className="ff-input"
            placeholder={t("projects.namePlaceholder")}
            required
          />
        </div>

        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="ff-label">{t("projects.description")}</label>
          <input
            value={form.description}
            onChange={(event) =>
              updateFormValue("description", event.target.value)
            }
            className="ff-input"
            placeholder={t("projects.descriptionPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.priority")}</label>
          <FFSelect
            value={form.priority}
            onChange={(value) => updateFormValue("priority", value)}
            options={priorityOptions}
            clearable={false}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.startDate")}</label>
          <input
            type="date"
            value={form.start_date}
            onChange={(event) =>
              updateFormValue("start_date", event.target.value)
            }
            className="ff-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.dueDate")}</label>
          <input
            type="date"
            value={form.due_date}
            onChange={(event) => updateFormValue("due_date", event.target.value)}
            className="ff-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.budget")}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.budget_amount}
            onChange={(event) =>
              updateFormValue("budget_amount", event.target.value)
            }
            className="ff-input"
            placeholder="0.00"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.account")}</label>
          <FFSelect
            value={form.account_id}
            onChange={(value) => updateFormValue("account_id", value)}
            options={accountOptions}
            placeholder={t("projects.noAccount")}
          />
        </div>

        <div className="md:col-span-3 flex justify-end">
          <button
            type="submit"
            className="ff-btn ff-btn-primary w-full md:w-auto"
            disabled={loadingAction}
          >
            <HiPlus size={18} aria-hidden="true" />
            {t("projects.create")}
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.search")}</label>
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="ff-input"
            placeholder={t("projects.searchPlaceholder")}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.status")}</label>
          <FFSelect
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusFilterOptions}
            clearable={false}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.priority")}</label>
          <FFSelect
            value={priorityFilter}
            onChange={setPriorityFilter}
            options={priorityFilterOptions}
            clearable={false}
          />
        </div>
      </div>

      <ul className="space-y-4">
        {filteredProjects.map((project) => {
          const progressPct = Math.round(project.taskStats.progress * 100);
          const tone = getProjectTone(project);

          return (
            <li
              key={project.id}
              className="rounded-xl border p-4"
              style={{
                borderColor: "var(--border-rgba)",
                background: "color-mix(in srgb, var(--panel) 70%, transparent)",
              }}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-[var(--text)]">
                      {project.name}
                    </h3>
                    <StatusPill tone={tone}>
                      {project.overdue
                        ? t("projects.overdue")
                        : getStatusLabel(project.status)}
                    </StatusPill>
                    <StatusPill tone={project.priority === "high" ? "warning" : "primary"}>
                      {getPriorityLabel(project.priority)}
                    </StatusPill>
                    {project.sync_status && (
                      <StatusPill tone="warning">{t("projects.pendingSync")}</StatusPill>
                    )}
                  </div>

                  {project.description && (
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      {project.description}
                    </p>
                  )}

                  <div className="mt-3 grid grid-cols-1 gap-2 text-sm text-[var(--muted)] sm:grid-cols-2 lg:grid-cols-4">
                    <span>
                      {t("projects.dueDate")}:{" "}
                      <strong className="text-[var(--text)]">
                        {project.due_date || "-"}
                      </strong>
                    </span>
                    <span>
                      {t("projects.budget")}:{" "}
                      <strong className="text-[var(--text)]">
                        {formatCurrency(project.budget_amount)}
                      </strong>
                    </span>
                    <span>
                      {t("projects.account")}:{" "}
                      <strong className="text-[var(--text)]">
                        {project.account?.name || t("projects.noAccountShort")}
                      </strong>
                    </span>
                    <span>
                      {t("projects.categorySpend")}:{" "}
                      <strong className="text-[var(--text)]">
                        {formatCurrency(project.categoryExpenseTotal)}
                      </strong>
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1 flex items-center justify-between text-xs text-[var(--muted)]">
                      <span>
                        {t("projects.taskProgress", {
                          done: project.taskStats.done,
                          total: project.taskStats.total,
                        })}
                      </span>
                      <span>{progressPct}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full border"
                      style={{
                        borderColor: "var(--border-rgba)",
                        background: "color-mix(in srgb, var(--panel) 80%, transparent)",
                      }}
                    >
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${progressPct}%`,
                          background:
                            "linear-gradient(90deg, color-mix(in srgb, var(--primary) 92%, #000) 0%, color-mix(in srgb, var(--success) 78%, #000) 100%)",
                        }}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end lg:max-w-[24rem]">
                  <button
                    type="button"
                    onClick={() => setDetailProjectId(project.id)}
                    className="ff-btn ff-btn-outline ff-btn-sm"
                  >
                    <HiClipboardList size={16} aria-hidden="true" />
                    {t("projects.details")}
                  </button>
                  {!isProjectCompleted(project) && (
                    <button
                      type="button"
                      onClick={() => openEdit(project)}
                      className="ff-btn ff-btn-outline ff-btn-sm"
                    >
                      <HiPencil size={16} aria-hidden="true" />
                      {t("common.edit")}
                    </button>
                  )}
                  {project.status === "paused" ? (
                    <button
                      type="button"
                      onClick={() => handleStatusAction(project, "active")}
                      className="ff-btn ff-btn-primary ff-btn-sm"
                    >
                      <HiPlay size={16} aria-hidden="true" />
                      {t("projects.resume")}
                    </button>
                  ) : project.status !== "completed" ? (
                    <button
                      type="button"
                      onClick={() => handleStatusAction(project, "paused")}
                      className="ff-btn ff-btn-warning ff-btn-sm"
                    >
                      <HiPause size={16} aria-hidden="true" />
                      {t("projects.pause")}
                    </button>
                  ) : null}
                  {project.status !== "completed" && (
                    <button
                      type="button"
                      onClick={() => handleStatusAction(project, "completed")}
                      className="ff-btn ff-btn-success ff-btn-sm"
                    >
                      <HiCheck size={16} aria-hidden="true" />
                      {t("projects.complete")}
                    </button>
                  )}
                  {!isProjectCompleted(project) && (
                    <button
                      type="button"
                      onClick={() => setDeleteProject(project)}
                      className="ff-btn ff-btn-danger ff-btn-sm"
                    >
                      <HiTrash size={16} aria-hidden="true" />
                      {t("common.delete")}
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}

        {filteredProjects.length === 0 && (
          <li className="text-sm italic text-[var(--muted)]">
            {projects.length === 0
              ? t("projects.empty")
              : t("projects.emptyFilter")}
          </li>
        )}
      </ul>

      <Modal
        isOpen={Boolean(detailProject)}
        onClose={() => setDetailProjectId(null)}
        title={detailProject?.name || t("projects.details")}
        size="xl"
      >
        {detailProject && (
          <div className="space-y-6">
            <div
              className="sticky top-0 z-20 -mx-4 -mt-2 flex justify-end border-b px-4 pb-3 pt-2 sm:hidden"
              style={{
                background: "var(--modal-panel)",
                borderColor: "var(--border-rgba)",
              }}
            >
              <button
                type="button"
                onClick={() => setDetailProjectId(null)}
                className="ff-btn ff-btn-outline ff-btn-sm"
                aria-label={t("common.close")}
              >
                <HiX size={16} aria-hidden="true" />
                {t("common.close")}
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <SummaryBox
                label={t("projects.status")}
                value={getStatusLabel(detailProject.status)}
              />
              <SummaryBox
                label={t("projects.priority")}
                value={getPriorityLabel(detailProject.priority)}
              />
              <SummaryBox
                label={t("projects.tasks")}
                value={`${detailProject.taskStats.done}/${detailProject.taskStats.total}`}
              />
              <SummaryBox
                label={t("projects.budget")}
                value={formatCurrency(detailProject.budget_amount)}
              />
              <SummaryBox
                label={t("projects.actualSpent")}
                value={formatCurrency(detailProject.actual_spent)}
                tone={
                  detailProject.actual_spent > detailProject.budget_amount &&
                  detailProject.budget_amount > 0
                    ? "danger"
                    : "primary"
                }
              />
              <SummaryBox
                label={t("projects.remainingBudget")}
                value={formatCurrency(
                  Number(detailProject.budget_amount || 0) -
                    Number(detailProject.actual_spent || 0)
                )}
                tone={
                  Number(detailProject.budget_amount || 0) -
                    Number(detailProject.actual_spent || 0) <
                  0
                    ? "danger"
                    : "success"
                }
              />
            </div>

            <ProjectCategoryMetrics
              rows={detailProject.categoryBreakdown}
              total={detailProject.categoryExpenseTotal}
              formatCurrency={formatCurrency}
              t={t}
            />

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-[var(--text)]">
                {t("projects.linkedTransactions")}
              </h3>

              {!detailReadOnly && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
                  <FFSelect
                    value={selectedTransactionByProject[detailProject.id] || ""}
                    onChange={(value) =>
                      setSelectedTransactionByProject((current) => ({
                        ...current,
                        [detailProject.id]: value,
                      }))
                    }
                    options={getAvailableTransactionOptions(detailProject)}
                    placeholder={t("projects.selectTransactionPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => handleLinkTransaction(detailProject)}
                    className="ff-btn ff-btn-primary"
                  >
                    <HiPlus size={18} aria-hidden="true" />
                    {t("projects.linkTransaction")}
                  </button>
                </div>
              )}

              <ul className="space-y-2">
                {(detailProject.linked_transactions || []).map((transaction) => (
                  <li
                    key={transaction.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      borderColor: "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--panel) 70%, transparent)",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">
                        {transaction.description ||
                          transaction.categories?.name ||
                          t("transactions.noDescription")}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {transaction.date || "-"}
                        {` - ${getLinkedTransactionCategoryName(
                          transaction,
                          t("projects.noCategory")
                        )}`}
                        {transaction.sync_status
                          ? ` - ${t("projects.pendingSync")}`
                          : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="text-sm font-semibold"
                        style={{ color: "var(--danger)" }}
                      >
                        {formatCurrency(transaction.amount)}
                      </span>
                      {!detailReadOnly && (
                        <button
                          type="button"
                          onClick={() =>
                            handleUnlinkTransaction(detailProject, transaction)
                          }
                          className="ff-btn ff-btn-danger ff-btn-sm"
                        >
                          <HiTrash size={16} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                ))}

                {(detailProject.linked_transactions || []).length === 0 && (
                  <li className="text-sm italic text-[var(--muted)]">
                    {t("projects.noLinkedTransactions")}
                  </li>
                )}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-[var(--text)]">
                {t("projects.tasks")}
              </h3>

              {!detailReadOnly && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <input
                    value={
                      (taskFormByProject[detailProject.id] || emptyTaskForm).title
                    }
                    onChange={(event) =>
                      updateTaskForm(detailProject.id, "title", event.target.value)
                    }
                    className="ff-input md:col-span-2"
                    placeholder={t("projects.taskTitle")}
                  />
                  <input
                    type="date"
                    value={
                      (taskFormByProject[detailProject.id] || emptyTaskForm)
                        .due_date
                    }
                    onChange={(event) =>
                      updateTaskForm(
                        detailProject.id,
                        "due_date",
                        event.target.value
                      )
                    }
                    className="ff-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreateTask(detailProject)}
                    className="ff-btn ff-btn-primary"
                  >
                    <HiPlus size={18} aria-hidden="true" />
                    {t("projects.addTask")}
                  </button>
                </div>
              )}

              <ul className="space-y-2">
                {(detailProject.tasks || []).map((task) => (
                  <li
                    key={task.id}
                    className={`grid grid-cols-1 gap-2 rounded-lg border p-3 ${
                      detailReadOnly
                        ? "sm:grid-cols-[1fr_auto]"
                        : "md:grid-cols-[1fr_12rem_auto]"
                    }`}
                    style={{
                      borderColor: "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--panel) 70%, transparent)",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">
                        {task.title}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {task.due_date
                          ? `${t("projects.dueDate")}: ${task.due_date}`
                          : t("projects.noDueDate")}
                        {task.sync_status ? ` - ${t("projects.pendingSync")}` : ""}
                      </p>
                    </div>
                    {detailReadOnly ? (
                      <div className="sm:justify-self-end">
                        <StatusPill tone={getTaskTone(task.status)}>
                          {getTaskStatusLabel(task.status)}
                        </StatusPill>
                      </div>
                    ) : (
                      <>
                        <FFSelect
                          value={task.status}
                          onChange={(value) =>
                            handleTaskStatus(detailProject, task, value)
                          }
                          options={taskStatusOptions}
                          clearable={false}
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteTask(detailProject, task)}
                          className="ff-btn ff-btn-danger ff-btn-sm"
                        >
                          <HiTrash size={16} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
                {(detailProject.tasks || []).length === 0 && (
                  <li className="text-sm italic text-[var(--muted)]">
                    {t("projects.noTasks")}
                  </li>
                )}
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="text-base font-semibold text-[var(--text)]">
                {t("projects.milestones")}
              </h3>

              {!detailReadOnly && (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_12rem_auto]">
                  <input
                    value={
                      (milestoneFormByProject[detailProject.id] ||
                        emptyMilestoneForm).title
                    }
                    onChange={(event) =>
                      updateMilestoneForm(
                        detailProject.id,
                        "title",
                        event.target.value
                      )
                    }
                    className="ff-input"
                    placeholder={t("projects.milestoneTitle")}
                  />
                  <input
                    type="date"
                    value={
                      (milestoneFormByProject[detailProject.id] ||
                        emptyMilestoneForm).target_date
                    }
                    onChange={(event) =>
                      updateMilestoneForm(
                        detailProject.id,
                        "target_date",
                        event.target.value
                      )
                    }
                    className="ff-input"
                  />
                  <button
                    type="button"
                    onClick={() => handleCreateMilestone(detailProject)}
                    className="ff-btn ff-btn-primary"
                  >
                    <HiPlus size={18} aria-hidden="true" />
                    {t("projects.addMilestone")}
                  </button>
                </div>
              )}

              <ul className="space-y-2">
                {(detailProject.milestones || []).map((milestone) => (
                  <li
                    key={milestone.id}
                    className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
                    style={{
                      borderColor: "var(--border-rgba)",
                      background:
                        "color-mix(in srgb, var(--panel) 70%, transparent)",
                    }}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text)]">
                        {milestone.title}
                      </p>
                      <p className="text-xs text-[var(--muted)]">
                        {milestone.target_date
                          ? `${t("projects.targetDate")}: ${milestone.target_date}`
                          : t("projects.noTargetDate")}
                        {milestone.sync_status
                          ? ` - ${t("projects.pendingSync")}`
                          : ""}
                      </p>
                    </div>
                    {detailReadOnly ? (
                      <div>
                        <StatusPill
                          tone={milestone.completed_at ? "success" : "primary"}
                        >
                          {milestone.completed_at
                            ? t("projects.milestoneDone")
                            : t("projects.taskTodo")}
                        </StatusPill>
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleMilestone(detailProject, milestone)
                          }
                          className={`ff-btn ff-btn-sm ${
                            milestone.completed_at
                              ? "ff-btn-success"
                              : "ff-btn-outline"
                          }`}
                        >
                          <HiCheck size={16} aria-hidden="true" />
                          {milestone.completed_at
                            ? t("projects.milestoneDone")
                            : t("projects.markDone")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteMilestone(detailProject, milestone)
                          }
                          className="ff-btn ff-btn-danger ff-btn-sm"
                        >
                          <HiTrash size={16} aria-hidden="true" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                {(detailProject.milestones || []).length === 0 && (
                  <li className="text-sm italic text-[var(--muted)]">
                    {t("projects.noMilestones")}
                  </li>
                )}
              </ul>
            </section>
          </div>
        )}
      </Modal>

      <ProjectEditModal
        accountOptions={accountOptions}
        editForm={editForm}
        isOpen={editOpen}
        loading={loadingAction}
        onChange={updateEditFormValue}
        onClose={closeEdit}
        onSubmit={handleEdit}
        priorityOptions={priorityOptions}
        statusOptions={projectStatusOptions}
        t={t}
      />

      <Modal
        isOpen={Boolean(deleteProject)}
        onClose={() => setDeleteProject(null)}
        title={t("projects.deleteTitle")}
        size="sm"
      >
        <p className="text-sm text-[var(--muted)]">
          {t("projects.deleteConfirm")}{" "}
          <span className="font-semibold text-[var(--text)]">
            {deleteProject?.name || ""}
          </span>
          ?
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={confirmDeleteProject}
            className="ff-btn ff-btn-danger"
            disabled={loadingAction}
          >
            {loadingAction ? t("common.loadingDelete") : t("projects.yesDelete")}
          </button>
          <button
            type="button"
            onClick={() => setDeleteProject(null)}
            className="ff-btn ff-btn-outline"
            disabled={loadingAction}
          >
            {t("common.cancel")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function SummaryBox({ label, value, tone = "primary" }) {
  const color =
    tone === "danger"
      ? "var(--danger)"
      : tone === "success"
      ? "var(--success)"
      : "var(--primary)";

  return (
    <div
      className="rounded-lg border px-3 py-2"
      style={{
        borderColor: "var(--border-rgba)",
        background: "color-mix(in srgb, var(--panel) 75%, transparent)",
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 truncate text-base font-bold" style={{ color }}>
        {value}
      </p>
    </div>
  );
}

function ProjectCategoryMetrics({ rows, total, formatCurrency, t }) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <h3 className="text-base font-semibold text-[var(--text)]">
          {t("projects.categorySpendTitle")}
        </h3>
        <p className="text-sm text-[var(--muted)]">
          {t("projects.categorySpendTotal")}:{" "}
          <span className="font-semibold text-[var(--text)]">
            {formatCurrency(total)}
          </span>
        </p>
      </div>

      {rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((row) => {
            const percent = Math.max(0, Math.min(100, row.percent || 0));

            return (
              <div key={row.key} className="space-y-1.5">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--text)]">
                      {row.category}
                    </p>
                    <p className="text-xs text-[var(--muted)]">
                      {t("projects.categoryTransactionCount", {
                        count: row.count,
                      })}
                    </p>
                  </div>
                  <div className="text-sm font-semibold text-[var(--text)]">
                    {formatCurrency(row.total)} - {Math.round(percent)}%
                  </div>
                </div>
                <div
                  className="h-2 overflow-hidden rounded-full border"
                  style={{
                    borderColor: "var(--border-rgba)",
                    background:
                      "color-mix(in srgb, var(--panel) 82%, transparent)",
                  }}
                >
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${percent}%`,
                      background:
                        "linear-gradient(90deg, color-mix(in srgb, var(--primary) 92%, #000) 0%, color-mix(in srgb, var(--warning) 78%, #000) 100%)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm italic text-[var(--muted)]">
          {t("projects.categorySpendEmpty")}
        </p>
      )}
    </section>
  );
}

function ProjectEditModal({
  accountOptions,
  editForm,
  isOpen,
  loading,
  onChange,
  onClose,
  onSubmit,
  priorityOptions,
  statusOptions,
  t,
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("projects.editTitle")}
      size="lg"
    >
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.name")}</label>
          <input
            value={editForm.name}
            onChange={(event) => onChange("name", event.target.value)}
            className="ff-input"
            required
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.status")}</label>
          <FFSelect
            value={editForm.status}
            onChange={(value) => onChange("status", value)}
            options={statusOptions}
            clearable={false}
          />
        </div>

        <div className="flex flex-col gap-1 md:col-span-2">
          <label className="ff-label">{t("projects.description")}</label>
          <textarea
            value={editForm.description}
            onChange={(event) => onChange("description", event.target.value)}
            className="ff-input min-h-24"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.priority")}</label>
          <FFSelect
            value={editForm.priority}
            onChange={(value) => onChange("priority", value)}
            options={priorityOptions}
            clearable={false}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.budget")}</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={editForm.budget_amount}
            onChange={(event) => onChange("budget_amount", event.target.value)}
            className="ff-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.startDate")}</label>
          <input
            type="date"
            value={editForm.start_date}
            onChange={(event) => onChange("start_date", event.target.value)}
            className="ff-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.dueDate")}</label>
          <input
            type="date"
            value={editForm.due_date}
            onChange={(event) => onChange("due_date", event.target.value)}
            className="ff-input"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="ff-label">{t("projects.account")}</label>
          <FFSelect
            value={editForm.account_id}
            onChange={(value) => onChange("account_id", value)}
            options={accountOptions}
          />
        </div>

        <div className="md:col-span-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="ff-btn ff-btn-outline"
            disabled={loading}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            className="ff-btn ff-btn-primary"
            disabled={loading}
          >
            {loading ? t("projects.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default Projects;
