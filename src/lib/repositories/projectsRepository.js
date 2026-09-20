import axios from "axios";
import { getActiveLocalUserId } from "../storage/kvStore";
import {
  getCachedProjects,
  getPendingProjectOps,
  setCachedProjects,
  setPendingProjectOps,
} from "../storage/projectsLocalStore";
import {
  isSqliteReady,
  queryRows,
  runStatement,
} from "../storage/offlineSqlRepository";
import {
  canSyncRemote,
  canUsePremiumBackend,
} from "../subscription/subscriptionAccess";
import { isOfflineLikeError } from "./networkFallback";

const api = import.meta.env.VITE_API_URL;
const PROJECT_ENTITY_TYPES = [
  "project",
  "project_task",
  "project_milestone",
  "project_transaction_link",
];
let projectsSyncPromise = null;

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

function isLocalId(value) {
  return String(value || "").startsWith("local-");
}

function normalizeProjectStatus(status) {
  return ["active", "paused", "completed", "cancelled"].includes(status)
    ? status
    : "active";
}

function normalizePriority(priority) {
  return ["low", "medium", "high"].includes(priority) ? priority : "medium";
}

function normalizeTaskStatus(status) {
  return ["todo", "doing", "done", "blocked"].includes(status)
    ? status
    : "todo";
}

function normalizeTask(task = {}) {
  return {
    ...task,
    title: String(task.title || "").trim(),
    notes: task.notes || "",
    status: normalizeTaskStatus(task.status),
    due_date: task.due_date || null,
    position: Number(task.position ?? 0),
  };
}

function normalizeMilestone(milestone = {}) {
  return {
    ...milestone,
    title: String(milestone.title || "").trim(),
    target_date: milestone.target_date || null,
    completed_at: milestone.completed_at || null,
  };
}

function normalizeLinkedTransaction(transaction = {}) {
  return {
    ...transaction,
    id: transaction?.id ?? transaction?.transaction_id,
    amount: Number(transaction?.amount ?? 0),
    type: transaction?.type || "expense",
    description: transaction?.description || "",
    date: transaction?.date || null,
    linked_at: transaction?.linked_at || null,
  };
}

function sortTasks(tasks = []) {
  return [...tasks].sort((left, right) => {
    const positionDiff = Number(left.position ?? 0) - Number(right.position ?? 0);
    if (positionDiff !== 0) return positionDiff;
    return String(left.title || "").localeCompare(String(right.title || ""));
  });
}

function sortMilestones(milestones = []) {
  return [...milestones].sort((left, right) => {
    const leftDate = left.target_date || "9999-99-99";
    const rightDate = right.target_date || "9999-99-99";
    const dateCompare = String(leftDate).localeCompare(String(rightDate));
    if (dateCompare !== 0) return dateCompare;
    return String(left.title || "").localeCompare(String(right.title || ""));
  });
}

function normalizeProject(project = {}) {
  const linkedTransactions = (project.linked_transactions || []).map(
    normalizeLinkedTransaction
  );

  return {
    ...project,
    name: String(project.name || "").trim(),
    description: project.description || "",
    status: normalizeProjectStatus(project.status),
    priority: normalizePriority(project.priority),
    start_date: project.start_date || null,
    due_date: project.due_date || null,
    budget_amount: Number(project.budget_amount ?? 0),
    account_id: project.account_id || null,
    category_id: project.category_id || null,
    tasks: sortTasks((project.tasks || []).map(normalizeTask)),
    milestones: sortMilestones((project.milestones || []).map(normalizeMilestone)),
    linked_transactions: linkedTransactions,
    actual_spent: linkedTransactions.reduce((total, transaction) => {
      if (transaction.type === "income") {
        return total - Number(transaction.amount || 0);
      }

      if (transaction.type === "expense") {
        return total + Number(transaction.amount || 0);
      }

      return total;
    }, 0),
  };
}

function sortProjects(projects = []) {
  const statusOrder = {
    active: 0,
    paused: 1,
    completed: 2,
    cancelled: 3,
  };
  const priorityOrder = {
    high: 0,
    medium: 1,
    low: 2,
  };

  return [...projects].sort((left, right) => {
    const leftStatus = statusOrder[left.status] ?? 99;
    const rightStatus = statusOrder[right.status] ?? 99;
    if (leftStatus !== rightStatus) return leftStatus - rightStatus;

    const leftPriority = priorityOrder[left.priority] ?? 99;
    const rightPriority = priorityOrder[right.priority] ?? 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;

    const leftDue = left.due_date || "9999-99-99";
    const rightDue = right.due_date || "9999-99-99";
    const dueCompare = String(leftDue).localeCompare(String(rightDue));
    if (dueCompare !== 0) return dueCompare;

    return String(left.name || "").localeCompare(String(right.name || ""));
  });
}

function normalizeProjectPayload(payload = {}) {
  const name = String(payload.name || "").trim();
  if (!name) throw new Error("El nombre del proyecto es obligatorio");

  const budget = Number(payload.budget_amount ?? 0);
  if (!Number.isFinite(budget) || budget < 0) {
    throw new Error("El presupuesto debe ser cero o mayor");
  }

  return {
    name,
    description: String(payload.description || "").trim() || null,
    status: normalizeProjectStatus(payload.status),
    priority: normalizePriority(payload.priority),
    start_date: payload.start_date || null,
    due_date: payload.due_date || null,
    budget_amount: budget,
    account_id: payload.account_id || null,
    category_id: payload.category_id || null,
  };
}

function normalizeTaskPayload(payload = {}) {
  const title = String(payload.title || "").trim();
  if (!title) throw new Error("El titulo de la tarea es obligatorio");

  return {
    title,
    notes: String(payload.notes || "").trim() || null,
    status: normalizeTaskStatus(payload.status),
    due_date: payload.due_date || null,
    position: Number.isFinite(Number(payload.position))
      ? Number(payload.position)
      : 0,
  };
}

function normalizeMilestonePayload(payload = {}) {
  const title = String(payload.title || "").trim();
  if (!title) throw new Error("El titulo del hito es obligatorio");

  return {
    title,
    target_date: payload.target_date || null,
    completed_at: payload.completed_at || null,
  };
}

function mergeRemoteWithPending(remoteItems, cachedItems) {
  const remoteIds = new Set(remoteItems.map((project) => String(project.id)));
  const pendingLocal = cachedItems.filter((project) => {
    if (remoteIds.has(String(project.id))) return false;
    if (isLocalId(project.id) || project.sync_status) return true;
    return (
      (project.tasks || []).some((task) => task.sync_status || isLocalId(task.id)) ||
      (project.milestones || []).some(
        (milestone) => milestone.sync_status || isLocalId(milestone.id)
      ) ||
      (project.linked_transactions || []).some(
        (transaction) => transaction.sync_status || isLocalId(transaction.id)
      )
    );
  });

  return sortProjects([...remoteItems, ...pendingLocal].map(normalizeProject));
}

async function replaceProjectsInSql(projects) {
  const activeUserId = await getActiveLocalUserId();
  const userId = activeUserId || null;

  await runStatement(`DELETE FROM project_milestones WHERE user_id = ?`, [
    userId,
  ]);
  await runStatement(`DELETE FROM project_transaction_links WHERE user_id = ?`, [
    userId,
  ]);
  await runStatement(`DELETE FROM project_tasks WHERE user_id = ?`, [userId]);
  await runStatement(`DELETE FROM projects WHERE user_id = ?`, [userId]);

  for (const rawProject of projects) {
    const project = normalizeProject(rawProject);
    await runStatement(
      `INSERT OR REPLACE INTO projects
        (id, user_id, name, description, status, priority, start_date, due_date, budget_amount, account_id, category_id, sync_status, payload_json, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(project.id),
        project.user_id || userId,
        project.name || "Proyecto",
        project.description || null,
        project.status,
        project.priority,
        project.start_date || null,
        project.due_date || null,
        Number(project.budget_amount ?? 0),
        project.account_id ? String(project.account_id) : null,
        project.category_id ? String(project.category_id) : null,
        project.sync_status || null,
        JSON.stringify(project),
        new Date().toISOString(),
      ]
    );

    for (const rawTask of project.tasks || []) {
      const task = normalizeTask(rawTask);
      await runStatement(
        `INSERT OR REPLACE INTO project_tasks
          (id, user_id, project_id, title, notes, status, due_date, position, sync_status, payload_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(task.id),
          task.user_id || project.user_id || userId,
          String(project.id),
          task.title || "Tarea",
          task.notes || null,
          task.status,
          task.due_date || null,
          Number(task.position ?? 0),
          task.sync_status || null,
          JSON.stringify({ ...task, project_id: project.id }),
          new Date().toISOString(),
        ]
      );
    }

    for (const rawMilestone of project.milestones || []) {
      const milestone = normalizeMilestone(rawMilestone);
      await runStatement(
        `INSERT OR REPLACE INTO project_milestones
          (id, user_id, project_id, title, target_date, completed_at, sync_status, payload_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(milestone.id),
          milestone.user_id || project.user_id || userId,
          String(project.id),
          milestone.title || "Hito",
          milestone.target_date || null,
          milestone.completed_at || null,
          milestone.sync_status || null,
          JSON.stringify({ ...milestone, project_id: project.id }),
          new Date().toISOString(),
        ]
      );
    }

    for (const rawTransaction of project.linked_transactions || []) {
      const transaction = normalizeLinkedTransaction(rawTransaction);
      if (!transaction.id) continue;

      await runStatement(
        `INSERT OR REPLACE INTO project_transaction_links
          (id, user_id, project_id, transaction_id, sync_status, payload_json, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          `${String(project.id)}::${String(transaction.id)}`,
          project.user_id || userId,
          String(project.id),
          String(transaction.id),
          transaction.sync_status || null,
          JSON.stringify(transaction),
          new Date().toISOString(),
        ]
      );
    }
  }
}

async function listProjectsFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const userId = activeUserId || null;

  const [projectRows, taskRows, milestoneRows, linkRows, transactionRows] =
    await Promise.all([
    queryRows(
      `SELECT *
       FROM projects
       WHERE user_id = ?
       ORDER BY updated_at DESC, name ASC`,
      [userId]
    ),
    queryRows(
      `SELECT *
       FROM project_tasks
       WHERE user_id = ?
       ORDER BY position ASC, updated_at DESC`,
      [userId]
    ),
    queryRows(
      `SELECT *
       FROM project_milestones
       WHERE user_id = ?
       ORDER BY target_date ASC, updated_at DESC`,
      [userId]
    ),
    queryRows(
      `SELECT *
       FROM project_transaction_links
       WHERE user_id = ?
       ORDER BY updated_at DESC`,
      [userId]
    ),
    queryRows(
      `SELECT id, payload_json
       FROM transactions
       WHERE user_id = ?`,
      [userId]
    ),
  ]);

  const transactionMap = new Map();
  for (const row of transactionRows) {
    try {
      transactionMap.set(
        String(row.id),
        normalizeLinkedTransaction(JSON.parse(row.payload_json))
      );
    } catch {
      transactionMap.set(String(row.id), normalizeLinkedTransaction({ id: row.id }));
    }
  }

  const tasksByProject = {};
  for (const row of taskRows) {
    let task = null;
    try {
      task = row.payload_json ? JSON.parse(row.payload_json) : null;
    } catch {
      task = null;
    }

    const normalized = normalizeTask({
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      notes: row.notes,
      status: row.status,
      due_date: row.due_date,
      position: row.position,
      sync_status: row.sync_status,
      ...task,
    });

    tasksByProject[row.project_id] ??= [];
    tasksByProject[row.project_id].push(normalized);
  }

  const milestonesByProject = {};
  for (const row of milestoneRows) {
    let milestone = null;
    try {
      milestone = row.payload_json ? JSON.parse(row.payload_json) : null;
    } catch {
      milestone = null;
    }

    const normalized = normalizeMilestone({
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      target_date: row.target_date,
      completed_at: row.completed_at,
      sync_status: row.sync_status,
      ...milestone,
    });

    milestonesByProject[row.project_id] ??= [];
    milestonesByProject[row.project_id].push(normalized);
  }

  const transactionsByProject = {};
  for (const row of linkRows) {
    let payload = null;
    try {
      payload = row.payload_json ? JSON.parse(row.payload_json) : null;
    } catch {
      payload = null;
    }

    const transaction = normalizeLinkedTransaction({
      ...(transactionMap.get(String(row.transaction_id)) || {}),
      ...payload,
      id: row.transaction_id,
      sync_status: row.sync_status,
    });

    transactionsByProject[row.project_id] ??= [];
    transactionsByProject[row.project_id].push(transaction);
  }

  const projects = projectRows.map((row) => {
    let payload = null;
    try {
      payload = row.payload_json ? JSON.parse(row.payload_json) : null;
    } catch {
      payload = null;
    }

    return normalizeProject({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      description: row.description,
      status: row.status,
      priority: row.priority,
      start_date: row.start_date,
      due_date: row.due_date,
      budget_amount: row.budget_amount,
      account_id: row.account_id,
      category_id: row.category_id,
      sync_status: row.sync_status,
      ...payload,
      tasks: tasksByProject[row.id] || [],
      milestones: milestonesByProject[row.id] || [],
      linked_transactions: transactionsByProject[row.id] || [],
    });
  });

  return sortProjects(projects);
}

async function getLocalProjects() {
  if (await isSqliteReady()) {
    return listProjectsFromSql();
  }

  return sortProjects((await getCachedProjects()).map(normalizeProject));
}

async function setLocalProjects(projects) {
  const normalized = sortProjects(projects.map(normalizeProject));
  await setCachedProjects(normalized);

  if (await isSqliteReady()) {
    await replaceProjectsInSql(normalized);
  }

  return normalized;
}

async function updateProjectCache(updater) {
  const current = await getLocalProjects();
  const next = typeof updater === "function" ? updater(current) : updater;
  return setLocalProjects(next);
}

async function getPendingProjectsFromSql() {
  const activeUserId = await getActiveLocalUserId();
  const rows = await queryRows(
    `SELECT *
     FROM pending_ops
     WHERE user_id = ?
       AND entity_type IN (?, ?, ?, ?)
     ORDER BY created_at ASC`,
    [activeUserId || null, ...PROJECT_ENTITY_TYPES]
  );

  return rows.map((row) => {
    let parsed = {};
    try {
      parsed = row.payload_json ? JSON.parse(row.payload_json) : {};
    } catch {
      parsed = {};
    }

    return {
      id: row.id,
      entity_type: row.entity_type,
      type: row.op_type,
      entity_id: row.entity_id,
      local_id: row.local_id,
      payload: parsed.payload ?? null,
      project_id: parsed.project_id ?? null,
      local_project_id: parsed.local_project_id ?? null,
      created_at: row.created_at,
    };
  });
}

async function setPendingProjectsInSql(items) {
  const activeUserId = await getActiveLocalUserId();
  await runStatement(
    `DELETE FROM pending_ops
     WHERE user_id = ?
       AND entity_type IN (?, ?, ?, ?)`,
    [activeUserId || null, ...PROJECT_ENTITY_TYPES]
  );

  for (const item of items) {
    await runStatement(
      `INSERT OR REPLACE INTO pending_ops
        (id, user_id, entity_type, op_type, entity_id, local_id, payload_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(item.id || crypto.randomUUID()),
        activeUserId || null,
        item.entity_type,
        item.type,
        item.entity_id ? String(item.entity_id) : null,
        item.local_id ? String(item.local_id) : null,
        JSON.stringify({
          payload: item.payload ?? null,
          project_id: item.project_id ?? null,
          local_project_id: item.local_project_id ?? null,
        }),
        item.created_at || new Date().toISOString(),
      ]
    );
  }
}

async function getPendingOps() {
  if (await isSqliteReady()) {
    return getPendingProjectsFromSql();
  }

  return getPendingProjectOps();
}

async function setPendingOps(items) {
  if (await isSqliteReady()) {
    await setPendingProjectsInSql(items);
    return;
  }

  await setPendingProjectOps(items);
}

function appendPendingOp(existing, op) {
  return [
    ...existing,
    {
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      ...op,
    },
  ];
}

async function mutatePendingOps(mutator) {
  const current = await getPendingOps();
  await setPendingOps(mutator([...current]));
}

async function addPendingOp(op) {
  await mutatePendingOps((current) => appendPendingOp(current, op));
}

async function mergePendingCreate({ entityType, localId, payload }) {
  await mutatePendingOps((current) =>
    current.map((op) =>
      op.entity_type === entityType &&
      op.type === "create" &&
      String(op.local_id) === String(localId)
        ? { ...op, payload: { ...op.payload, ...payload } }
        : op
    )
  );
}

async function removePendingForLocalEntity(entityType, localId) {
  await mutatePendingOps((current) =>
    current.filter(
      (op) =>
        !(
          op.entity_type === entityType &&
          String(op.local_id || op.entity_id) === String(localId)
        )
    )
  );
}

async function reconcileSyncedProject(localProjectId, remoteProject) {
  if (!localProjectId || !remoteProject?.id) {
    return;
  }

  const current = await getLocalProjects();
  const localProject = current.find(
    (project) => String(project.id) === String(localProjectId)
  );
  const remote = normalizeProject(remoteProject);

  if (!localProject) {
    await setLocalProjects([
      remote,
      ...current.filter((project) => String(project.id) !== String(remote.id)),
    ]);
    return;
  }

  const reconciled = normalizeProject({
    ...localProject,
    ...remote,
    id: remote.id,
    sync_status: null,
    tasks: (localProject.tasks || []).length
      ? localProject.tasks
      : remote.tasks || [],
    milestones: (localProject.milestones || []).length
      ? localProject.milestones
      : remote.milestones || [],
    linked_transactions: (localProject.linked_transactions || []).length
      ? localProject.linked_transactions
      : remote.linked_transactions || [],
  });

  await setLocalProjects([
    reconciled,
    ...current.filter(
      (project) =>
        String(project.id) !== String(localProjectId) &&
        String(project.id) !== String(remote.id)
    ),
  ]);
}

function resolveTransactionId(op) {
  const candidate =
    op.entity_id ||
    op.payload?.transaction_id ||
    op.payload?.transaction?.id ||
    null;

  if (!candidate || isLocalId(candidate)) {
    return null;
  }

  return candidate;
}

function withUpdatedProject(projects, projectId, updater) {
  return projects.map((project) =>
    String(project.id) === String(projectId)
      ? normalizeProject(updater(project))
      : project
  );
}

function shouldUseRemote(subscriptionMode) {
  return isOnline() && canUsePremiumBackend(subscriptionMode);
}

function hasLocalReference(payload = {}) {
  return isLocalId(payload.account_id) || isLocalId(payload.category_id);
}

function sanitizeProjectPayloadForRemote(payload = {}) {
  return {
    ...payload,
    account_id: isLocalId(payload.account_id) ? null : payload.account_id || null,
    category_id: isLocalId(payload.category_id)
      ? null
      : payload.category_id || null,
  };
}

export async function listProjects({ token, subscriptionMode }) {
  const cached = await getLocalProjects();

  if (!shouldUseRemote(subscriptionMode)) {
    return { data: cached, source: "cache" };
  }

  try {
    const res = await axios.get(`${api}/projects`, {
      headers: authHeaders(token),
    });
    const remote = (res.data.data || []).map(normalizeProject);
    const merged = mergeRemoteWithPending(remote, cached);
    await setLocalProjects(merged);
    return { data: merged, source: "remote" };
  } catch (error) {
    if (!isOfflineLikeError(error)) throw error;
    return { data: cached, source: "cache" };
  }
}

export async function createProject({ token, payload, subscriptionMode }) {
  const normalizedPayload = normalizeProjectPayload(payload);

  if (shouldUseRemote(subscriptionMode) && !hasLocalReference(normalizedPayload)) {
    try {
      const res = await axios.post(
        `${api}/projects`,
        sanitizeProjectPayloadForRemote(normalizedPayload),
        { headers: authHeaders(token) }
      );
      return { offline: false, data: normalizeProject(res.data.data) };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const localProject = normalizeProject({
    id: `local-project-${crypto.randomUUID()}`,
    ...normalizedPayload,
    tasks: [],
    milestones: [],
    sync_status: "pending_create",
  });

  await updateProjectCache((projects) => [...projects, localProject]);
  await addPendingOp({
    entity_type: "project",
    type: "create",
    local_id: localProject.id,
    payload: normalizedPayload,
  });

  return { offline: true, data: localProject };
}

export async function updateProjectRecord({
  token,
  project,
  payload,
  subscriptionMode,
}) {
  const normalizedPayload = normalizeProjectPayload({
    ...project,
    ...payload,
  });

  if (
    !isLocalId(project.id) &&
    shouldUseRemote(subscriptionMode) &&
    !hasLocalReference(normalizedPayload)
  ) {
    try {
      const res = await axios.put(
        `${api}/projects/${project.id}`,
        sanitizeProjectPayloadForRemote(normalizedPayload),
        { headers: authHeaders(token) }
      );
      return { offline: false, data: normalizeProject(res.data.data) };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      ...normalizedPayload,
      sync_status: isLocalId(item.id) ? "pending_create" : "pending_update",
    }))
  );

  if (isLocalId(project.id)) {
    await mergePendingCreate({
      entityType: "project",
      localId: project.id,
      payload: normalizedPayload,
    });
  } else {
    await addPendingOp({
      entity_type: "project",
      type: "update",
      entity_id: project.id,
      payload: normalizedPayload,
    });
  }

  return { offline: true };
}

export async function completeProjectRecord({ token, project, subscriptionMode }) {
  return updateProjectStatus({
    token,
    project,
    status: "completed",
    subscriptionMode,
    remoteAction: "complete",
  });
}

export async function updateProjectStatus({
  token,
  project,
  status,
  subscriptionMode,
  remoteAction = "update",
}) {
  const safeStatus = normalizeProjectStatus(status);

  if (!isLocalId(project.id) && shouldUseRemote(subscriptionMode)) {
    try {
      const url =
        remoteAction === "complete"
          ? `${api}/projects/${project.id}/complete`
          : `${api}/projects/${project.id}`;
      const res =
        remoteAction === "complete"
          ? await axios.post(url, {}, { headers: authHeaders(token) })
          : await axios.put(url, { status: safeStatus }, { headers: authHeaders(token) });
      return { offline: false, data: normalizeProject(res.data.data) };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      status: safeStatus,
      sync_status: isLocalId(item.id) ? "pending_create" : "pending_update",
    }))
  );

  if (isLocalId(project.id)) {
    await mergePendingCreate({
      entityType: "project",
      localId: project.id,
      payload: { status: safeStatus },
    });
  } else {
    await addPendingOp({
      entity_type: "project",
      type: remoteAction === "complete" ? "complete" : "update",
      entity_id: project.id,
      payload: { status: safeStatus },
    });
  }

  return { offline: true };
}

export async function deleteProjectRecord({ token, project, subscriptionMode }) {
  if (!isLocalId(project.id) && shouldUseRemote(subscriptionMode)) {
    try {
      await axios.delete(`${api}/projects/${project.id}`, {
        headers: authHeaders(token),
      });
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    projects.filter((item) => String(item.id) !== String(project.id))
  );

  if (isLocalId(project.id)) {
    await mutatePendingOps((current) =>
      current.filter(
        (op) =>
          String(op.local_id || "") !== String(project.id) &&
          String(op.local_project_id || "") !== String(project.id) &&
          String(op.project_id || "") !== String(project.id)
      )
    );
  } else {
    await addPendingOp({
      entity_type: "project",
      type: "delete",
      entity_id: project.id,
    });
  }

  return { offline: true };
}

export async function linkProjectTransaction({
  token,
  project,
  transaction,
  subscriptionMode,
}) {
  if (!project?.id || !transaction?.id) {
    throw new Error("Proyecto y transaccion son obligatorios");
  }

  const normalizedTransaction = normalizeLinkedTransaction(transaction);

  if (
    !isLocalId(project.id) &&
    !isLocalId(normalizedTransaction.id) &&
    shouldUseRemote(subscriptionMode)
  ) {
    try {
      const res = await axios.post(
        `${api}/projects/${project.id}/transactions`,
        { transaction_id: normalizedTransaction.id },
        { headers: authHeaders(token) }
      );
      return {
        offline: false,
        data: normalizeLinkedTransaction(res.data.data || normalizedTransaction),
      };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => {
      const existing = new Set(
        (item.linked_transactions || []).map((entry) => String(entry.id))
      );

      if (existing.has(String(normalizedTransaction.id))) {
        return item;
      }

      return {
        ...item,
        linked_transactions: [
          normalizedTransaction,
          ...(item.linked_transactions || []),
        ],
      };
    })
  );

  await addPendingOp({
    entity_type: "project_transaction_link",
    type: "link",
    project_id: isLocalId(project.id) ? null : project.id,
    local_project_id: isLocalId(project.id) ? project.id : null,
    entity_id: isLocalId(normalizedTransaction.id)
      ? null
      : normalizedTransaction.id,
    local_id: isLocalId(normalizedTransaction.id)
      ? normalizedTransaction.id
      : null,
    payload: {
      transaction: normalizedTransaction,
      transaction_id: normalizedTransaction.id,
    },
  });

  return { offline: true, data: normalizedTransaction };
}

export async function unlinkProjectTransaction({
  token,
  project,
  transaction,
  subscriptionMode,
}) {
  if (!project?.id || !transaction?.id) {
    throw new Error("Proyecto y transaccion son obligatorios");
  }

  if (
    !isLocalId(project.id) &&
    !isLocalId(transaction.id) &&
    shouldUseRemote(subscriptionMode)
  ) {
    try {
      await axios.delete(`${api}/projects/${project.id}/transactions/${transaction.id}`, {
        headers: authHeaders(token),
      });
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      linked_transactions: (item.linked_transactions || []).filter(
        (entry) => String(entry.id) !== String(transaction.id)
      ),
    }))
  );

  await mutatePendingOps((current) => {
    if (isLocalId(project.id) || isLocalId(transaction.id)) {
      return current.filter(
        (op) =>
          !(
            op.entity_type === "project_transaction_link" &&
            op.type === "link" &&
            String(op.local_project_id || op.project_id) === String(project.id) &&
            String(
              op.local_id ||
                op.entity_id ||
                op.payload?.transaction_id ||
                op.payload?.transaction?.id
            ) === String(transaction.id)
          )
      );
    }

    return appendPendingOp(current, {
      entity_type: "project_transaction_link",
      type: "unlink",
      project_id: project.id,
      entity_id: transaction.id,
      payload: { transaction_id: transaction.id },
    });
  });

  return { offline: true };
}

export async function remapProjectTransactionReference(
  localTransactionId,
  remoteTransaction
) {
  if (!localTransactionId || !remoteTransaction?.id) {
    return;
  }

  const remote = normalizeLinkedTransaction(remoteTransaction);

  await updateProjectCache((projects) =>
    projects.map((project) =>
      normalizeProject({
        ...project,
        linked_transactions: (project.linked_transactions || []).map((transaction) =>
          String(transaction.id) === String(localTransactionId)
            ? {
                ...transaction,
                ...remote,
                id: remote.id,
                sync_status: null,
              }
            : transaction
        ),
      })
    )
  );

  await mutatePendingOps((current) =>
    current.map((op) => {
      if (op.entity_type !== "project_transaction_link") {
        return op;
      }

      const referencesLocalTransaction =
        String(op.local_id || "") === String(localTransactionId) ||
        String(op.payload?.transaction_id || "") === String(localTransactionId) ||
        String(op.payload?.transaction?.id || "") === String(localTransactionId);

      if (!referencesLocalTransaction) {
        return op;
      }

      return {
        ...op,
        entity_id: remote.id,
        local_id: null,
        payload: {
          ...(op.payload || {}),
          transaction_id: remote.id,
          transaction: {
            ...(op.payload?.transaction || {}),
            ...remote,
            id: remote.id,
            sync_status: null,
          },
        },
      };
    })
  );
}

export async function createProjectTask({
  token,
  project,
  payload,
  subscriptionMode,
}) {
  const normalizedPayload = normalizeTaskPayload(payload);

  if (!isLocalId(project.id) && shouldUseRemote(subscriptionMode)) {
    try {
      const res = await axios.post(
        `${api}/projects/${project.id}/tasks`,
        normalizedPayload,
        { headers: authHeaders(token) }
      );
      return { offline: false, data: normalizeTask(res.data.data) };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const localTask = normalizeTask({
    id: `local-project-task-${crypto.randomUUID()}`,
    project_id: project.id,
    ...normalizedPayload,
    sync_status: "pending_create",
  });

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      tasks: [...(item.tasks || []), localTask],
    }))
  );

  await addPendingOp({
    entity_type: "project_task",
    type: "create",
    local_id: localTask.id,
    project_id: isLocalId(project.id) ? null : project.id,
    local_project_id: isLocalId(project.id) ? project.id : null,
    payload: normalizedPayload,
  });

  return { offline: true, data: localTask };
}

export async function updateProjectTask({
  token,
  project,
  task,
  payload,
  subscriptionMode,
}) {
  const normalizedPayload = {
    ...payload,
  };

  if (normalizedPayload.title !== undefined) {
    normalizedPayload.title = String(normalizedPayload.title || "").trim();
    if (!normalizedPayload.title) {
      throw new Error("El titulo de la tarea es obligatorio");
    }
  }
  if (normalizedPayload.status !== undefined) {
    normalizedPayload.status = normalizeTaskStatus(normalizedPayload.status);
  }
  if (normalizedPayload.notes !== undefined) {
    normalizedPayload.notes = String(normalizedPayload.notes || "").trim() || null;
  }
  if (normalizedPayload.due_date !== undefined) {
    normalizedPayload.due_date = normalizedPayload.due_date || null;
  }

  if (
    !isLocalId(project.id) &&
    !isLocalId(task.id) &&
    shouldUseRemote(subscriptionMode)
  ) {
    try {
      const res = await axios.put(
        `${api}/projects/${project.id}/tasks/${task.id}`,
        normalizedPayload,
        { headers: authHeaders(token) }
      );
      return { offline: false, data: normalizeTask(res.data.data) };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      tasks: (item.tasks || []).map((entry) =>
        String(entry.id) === String(task.id)
          ? normalizeTask({
              ...entry,
              ...normalizedPayload,
              sync_status: isLocalId(entry.id)
                ? "pending_create"
                : "pending_update",
            })
          : entry
      ),
    }))
  );

  if (isLocalId(task.id)) {
    await mergePendingCreate({
      entityType: "project_task",
      localId: task.id,
      payload: normalizedPayload,
    });
  } else {
    await addPendingOp({
      entity_type: "project_task",
      type: "update",
      entity_id: task.id,
      project_id: project.id,
      payload: normalizedPayload,
    });
  }

  return { offline: true };
}

export async function deleteProjectTask({
  token,
  project,
  task,
  subscriptionMode,
}) {
  if (
    !isLocalId(project.id) &&
    !isLocalId(task.id) &&
    shouldUseRemote(subscriptionMode)
  ) {
    try {
      await axios.delete(`${api}/projects/${project.id}/tasks/${task.id}`, {
        headers: authHeaders(token),
      });
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      tasks: (item.tasks || []).filter(
        (entry) => String(entry.id) !== String(task.id)
      ),
    }))
  );

  if (isLocalId(task.id)) {
    await removePendingForLocalEntity("project_task", task.id);
  } else {
    await addPendingOp({
      entity_type: "project_task",
      type: "delete",
      entity_id: task.id,
      project_id: project.id,
    });
  }

  return { offline: true };
}

export async function createProjectMilestone({
  token,
  project,
  payload,
  subscriptionMode,
}) {
  const normalizedPayload = normalizeMilestonePayload(payload);

  if (!isLocalId(project.id) && shouldUseRemote(subscriptionMode)) {
    try {
      const res = await axios.post(
        `${api}/projects/${project.id}/milestones`,
        normalizedPayload,
        { headers: authHeaders(token) }
      );
      return { offline: false, data: normalizeMilestone(res.data.data) };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  const localMilestone = normalizeMilestone({
    id: `local-project-milestone-${crypto.randomUUID()}`,
    project_id: project.id,
    ...normalizedPayload,
    sync_status: "pending_create",
  });

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      milestones: [...(item.milestones || []), localMilestone],
    }))
  );

  await addPendingOp({
    entity_type: "project_milestone",
    type: "create",
    local_id: localMilestone.id,
    project_id: isLocalId(project.id) ? null : project.id,
    local_project_id: isLocalId(project.id) ? project.id : null,
    payload: normalizedPayload,
  });

  return { offline: true, data: localMilestone };
}

export async function updateProjectMilestone({
  token,
  project,
  milestone,
  payload,
  subscriptionMode,
}) {
  const normalizedPayload = { ...payload };

  if (normalizedPayload.title !== undefined) {
    normalizedPayload.title = String(normalizedPayload.title || "").trim();
    if (!normalizedPayload.title) {
      throw new Error("El titulo del hito es obligatorio");
    }
  }
  if (normalizedPayload.target_date !== undefined) {
    normalizedPayload.target_date = normalizedPayload.target_date || null;
  }
  if (normalizedPayload.completed_at !== undefined) {
    normalizedPayload.completed_at = normalizedPayload.completed_at || null;
  }

  if (
    !isLocalId(project.id) &&
    !isLocalId(milestone.id) &&
    shouldUseRemote(subscriptionMode)
  ) {
    try {
      const res = await axios.put(
        `${api}/projects/${project.id}/milestones/${milestone.id}`,
        normalizedPayload,
        { headers: authHeaders(token) }
      );
      return { offline: false, data: normalizeMilestone(res.data.data) };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      milestones: (item.milestones || []).map((entry) =>
        String(entry.id) === String(milestone.id)
          ? normalizeMilestone({
              ...entry,
              ...normalizedPayload,
              sync_status: isLocalId(entry.id)
                ? "pending_create"
                : "pending_update",
            })
          : entry
      ),
    }))
  );

  if (isLocalId(milestone.id)) {
    await mergePendingCreate({
      entityType: "project_milestone",
      localId: milestone.id,
      payload: normalizedPayload,
    });
  } else {
    await addPendingOp({
      entity_type: "project_milestone",
      type: "update",
      entity_id: milestone.id,
      project_id: project.id,
      payload: normalizedPayload,
    });
  }

  return { offline: true };
}

export async function deleteProjectMilestone({
  token,
  project,
  milestone,
  subscriptionMode,
}) {
  if (
    !isLocalId(project.id) &&
    !isLocalId(milestone.id) &&
    shouldUseRemote(subscriptionMode)
  ) {
    try {
      await axios.delete(
        `${api}/projects/${project.id}/milestones/${milestone.id}`,
        { headers: authHeaders(token) }
      );
      return { offline: false };
    } catch (error) {
      if (!isOfflineLikeError(error)) throw error;
    }
  }

  await updateProjectCache((projects) =>
    withUpdatedProject(projects, project.id, (item) => ({
      ...item,
      milestones: (item.milestones || []).filter(
        (entry) => String(entry.id) !== String(milestone.id)
      ),
    }))
  );

  if (isLocalId(milestone.id)) {
    await removePendingForLocalEntity("project_milestone", milestone.id);
  } else {
    await addPendingOp({
      entity_type: "project_milestone",
      type: "delete",
      entity_id: milestone.id,
      project_id: project.id,
    });
  }

  return { offline: true };
}

function resolveProjectId(op, localProjectIdMap) {
  return (
    op.project_id ||
    (op.local_project_id ? localProjectIdMap.get(op.local_project_id) : null) ||
    (op.local_id ? localProjectIdMap.get(op.local_id) : null)
  );
}

function withResolvedProject(op, resolvedProjectId) {
  if (!resolvedProjectId) return op;
  return {
    ...op,
    project_id: resolvedProjectId,
    local_project_id: null,
  };
}

export async function syncPendingProjects({ token, subscriptionMode }) {
  if (!isOnline() || !canSyncRemote(subscriptionMode)) {
    return { synced: 0 };
  }
  if (projectsSyncPromise) return projectsSyncPromise;

  projectsSyncPromise = (async () => {
    const pending = await getPendingOps();
    if (!pending.length) return { synced: 0 };

    const remaining = [];
    const localProjectIdMap = new Map();
    let synced = 0;

    for (const op of pending) {
      try {
        if (op.entity_type === "project") {
          const projectId =
            op.entity_id ||
            (op.local_id ? localProjectIdMap.get(op.local_id) : null);

          if (op.type === "create") {
            const res = await axios.post(
              `${api}/projects`,
              sanitizeProjectPayloadForRemote(op.payload),
              { headers: authHeaders(token) }
            );
            const remoteProject = normalizeProject(res.data.data);
            if (op.local_id && remoteProject.id) {
              localProjectIdMap.set(op.local_id, remoteProject.id);
              await reconcileSyncedProject(op.local_id, remoteProject);
            }
            synced += 1;
            continue;
          }

          if (!projectId) {
            remaining.push(op);
            continue;
          }

          if (op.type === "update") {
            await axios.put(
              `${api}/projects/${projectId}`,
              sanitizeProjectPayloadForRemote(op.payload),
              { headers: authHeaders(token) }
            );
          } else if (op.type === "complete") {
            await axios.post(
              `${api}/projects/${projectId}/complete`,
              {},
              { headers: authHeaders(token) }
            );
          } else if (op.type === "delete") {
            await axios.delete(`${api}/projects/${projectId}`, {
              headers: authHeaders(token),
            });
          }

          synced += 1;
          continue;
        }

        if (op.entity_type === "project_task") {
          const projectId = resolveProjectId(op, localProjectIdMap);
          if (!projectId) {
            remaining.push(op);
            continue;
          }

          if (op.type === "create") {
            await axios.post(`${api}/projects/${projectId}/tasks`, op.payload, {
              headers: authHeaders(token),
            });
          } else if (op.type === "update") {
            if (!op.entity_id) {
              remaining.push(withResolvedProject(op, projectId));
              continue;
            }
            await axios.put(
              `${api}/projects/${projectId}/tasks/${op.entity_id}`,
              op.payload,
              { headers: authHeaders(token) }
            );
          } else if (op.type === "delete") {
            if (!op.entity_id) {
              remaining.push(withResolvedProject(op, projectId));
              continue;
            }
            await axios.delete(
              `${api}/projects/${projectId}/tasks/${op.entity_id}`,
              { headers: authHeaders(token) }
            );
          }

          synced += 1;
          continue;
        }

        if (op.entity_type === "project_milestone") {
          const projectId = resolveProjectId(op, localProjectIdMap);
          if (!projectId) {
            remaining.push(op);
            continue;
          }

          if (op.type === "create") {
            await axios.post(
              `${api}/projects/${projectId}/milestones`,
              op.payload,
              { headers: authHeaders(token) }
            );
          } else if (op.type === "update") {
            if (!op.entity_id) {
              remaining.push(withResolvedProject(op, projectId));
              continue;
            }
            await axios.put(
              `${api}/projects/${projectId}/milestones/${op.entity_id}`,
              op.payload,
              { headers: authHeaders(token) }
            );
          } else if (op.type === "delete") {
            if (!op.entity_id) {
              remaining.push(withResolvedProject(op, projectId));
              continue;
            }
            await axios.delete(
              `${api}/projects/${projectId}/milestones/${op.entity_id}`,
              { headers: authHeaders(token) }
            );
          }

          synced += 1;
          continue;
        }

        if (op.entity_type === "project_transaction_link") {
          const projectId = resolveProjectId(op, localProjectIdMap);
          const transactionId = resolveTransactionId(op);

          if (!projectId || !transactionId) {
            remaining.push(withResolvedProject(op, projectId));
            continue;
          }

          if (op.type === "link") {
            await axios.post(
              `${api}/projects/${projectId}/transactions`,
              { transaction_id: transactionId },
              { headers: authHeaders(token) }
            );
          } else if (op.type === "unlink") {
            await axios.delete(
              `${api}/projects/${projectId}/transactions/${transactionId}`,
              { headers: authHeaders(token) }
            );
          }

          synced += 1;
          continue;
        }

        remaining.push(op);
      } catch {
        const resolvedProjectId = resolveProjectId(op, localProjectIdMap);
        remaining.push(withResolvedProject(op, resolvedProjectId));
      }
    }

    await setPendingOps(remaining);
    return { synced };
  })();

  try {
    return await projectsSyncPromise;
  } finally {
    projectsSyncPromise = null;
  }
}
