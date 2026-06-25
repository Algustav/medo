const LOCAL_STORAGE_KEY = "medo-tasks-v1";
const PENDING_STORAGE_KEY = "medo-pending-ops-v1";
const OLD_LOCAL_STORAGE_KEY = "todo-tasks-v1";
const OLD_PENDING_STORAGE_KEY = "todo-pending-ops-v1";
const LEGACY_STORAGE_KEY = "standalone-todos";

function cloneTask(task) {
  return {
    ...task,
    tags: [...task.tags]
  };
}

function normalizeTask(task, index = 0) {
  const fallbackCreatedAt = Number.isFinite(Number(task.position)) ? Number(task.position) : index;
  return {
    id: String(task.id),
    title: String(task.title || "").trim(),
    note: String(task.note || "").trim(),
    tags: Array.isArray(task.tags) ? task.tags.map(String).map(tag => tag.trim()).filter(Boolean) : [],
    done: Boolean(task.done),
    position: Number.isFinite(Number(task.position)) ? Number(task.position) : index,
    createdAt: Number.isFinite(Number(task.createdAt)) ? Number(task.createdAt) : fallbackCreatedAt
  };
}

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readLocalTasks() {
  const saved = readJson(LOCAL_STORAGE_KEY, null);
  if (Array.isArray(saved)) return saved.map(normalizeTask);

  const oldSaved = readJson(OLD_LOCAL_STORAGE_KEY, null);
  if (Array.isArray(oldSaved)) {
    const migrated = oldSaved.map(normalizeTask);
    writeLocalTasks(migrated);
    return migrated;
  }

  const legacy = readJson(LEGACY_STORAGE_KEY, null);
  if (!Array.isArray(legacy)) return [];

  const migrated = legacy.map((task, index) => normalizeTask({
    ...task,
    tags: [],
    position: index
  }, index));
  writeLocalTasks(migrated);
  return migrated;
}

function writeLocalTasks(tasks) {
  writeJson(LOCAL_STORAGE_KEY, tasks.map(normalizeTask));
}

function readPendingOps() {
  const saved = readJson(PENDING_STORAGE_KEY, null);
  const ops = Array.isArray(saved) ? saved : readJson(OLD_PENDING_STORAGE_KEY, []);
  return Array.isArray(ops) ? ops : [];
}

function writePendingOps(ops) {
  writeJson(PENDING_STORAGE_KEY, ops);
}

function compactOps(ops) {
  const compacted = [];
  const deletedIds = new Set();

  for (const op of ops) {
    if (op.type === "clearDone") {
      compacted.push(op);
      continue;
    }

    if (op.type === "delete") {
      deletedIds.add(op.id);
      for (let index = compacted.length - 1; index >= 0; index -= 1) {
        const candidate = compacted[index];
        if ((candidate.id && candidate.id === op.id) || candidate.task?.id === op.id) {
          compacted.splice(index, 1);
        }
      }
      compacted.push(op);
      continue;
    }

    const id = op.id || op.task?.id;
    if (id && deletedIds.has(id)) continue;

    if (op.type === "update") {
      const previous = compacted.find(candidate => candidate.type === "update" && candidate.id === op.id);
      if (previous) {
        previous.patch = { ...previous.patch, ...op.patch };
        continue;
      }
    }

    if (op.type === "reorder") {
      const previousIndex = compacted.findIndex(candidate => candidate.type === "reorder");
      if (previousIndex >= 0) compacted.splice(previousIndex, 1);
    }

    compacted.push(op);
  }

  return compacted;
}

async function apiRequest(options = {}) {
  const response = await fetch("/api/tasks", {
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    ...options
  });

  if (!response.ok) {
    throw new Error(`API ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

async function sendOperation(op) {
  if (op.type === "create") {
    return apiRequest({
      method: "POST",
      body: JSON.stringify(op.task)
    });
  }

  if (op.type === "update") {
    return apiRequest({
      method: "PATCH",
      body: JSON.stringify({ id: op.id, ...op.patch })
    });
  }

  if (op.type === "delete") {
    return apiRequest({
      method: "DELETE",
      body: JSON.stringify({ id: op.id })
    });
  }

  if (op.type === "reorder") {
    return apiRequest({
      method: "PUT",
      body: JSON.stringify({ ids: op.ids })
    });
  }

  if (op.type === "clearDone") {
    return apiRequest({
      method: "DELETE",
      body: JSON.stringify({ done: true })
    });
  }

  return null;
}

export class TaskStore extends EventTarget {
  constructor() {
    super();
    this.mode = "local";
    this.localTasks = readLocalTasks();
    this.pendingOps = compactOps(readPendingOps());
  }

  get hasPending() {
    return this.pendingOps.length > 0;
  }

  get status() {
    if (this.mode === "cloud") {
      return this.hasPending ? "syncing" : "synced";
    }
    return this.hasPending ? "offline-pending" : "offline";
  }

  snapshot() {
    return this.localTasks
      .map(cloneTask)
      .sort((a, b) => a.position - b.position);
  }

  emitStatus() {
    this.dispatchEvent(new CustomEvent("statuschange", {
      detail: { mode: this.mode, pending: this.pendingOps.length, status: this.status }
    }));
  }

  saveLocal() {
    writeLocalTasks(this.localTasks);
  }

  queue(op) {
    this.pendingOps = compactOps([...this.pendingOps, op]);
    writePendingOps(this.pendingOps);
    this.emitStatus();
  }

  async flushPending() {
    if (!this.pendingOps.length) return;

    const remaining = [...this.pendingOps];
    while (remaining.length) {
      await sendOperation(remaining[0]);
      remaining.shift();
      this.pendingOps = remaining;
      writePendingOps(this.pendingOps);
      this.emitStatus();
    }
  }

  async refreshFromCloud() {
    const data = await apiRequest();
    this.localTasks = (data.tasks || []).map(normalizeTask);
    this.saveLocal();
    return this.snapshot();
  }

  async sync() {
    try {
      this.mode = "cloud";
      this.emitStatus();
      await this.flushPending();
      return await this.refreshFromCloud();
    } catch (error) {
      this.mode = "local";
      this.emitStatus();
      throw error;
    }
  }

  async load() {
    try {
      return await this.sync();
    } catch {
      return this.snapshot();
    }
  }

  applyCloudOperation(op) {
    this.queue(op);
  }

  async create(task) {
    const normalized = normalizeTask(task, this.localTasks.length);
    this.localTasks.push(normalized);
    this.saveLocal();
    this.applyCloudOperation({ type: "create", task: normalized });
    return cloneTask(normalized);
  }

  async update(id, patch) {
    let updated = null;
    this.localTasks = this.localTasks.map(task => {
      if (task.id !== id) return task;
      updated = normalizeTask({ ...task, ...patch });
      return updated;
    });
    this.saveLocal();
    this.applyCloudOperation({ type: "update", id, patch });
    return updated ? cloneTask(updated) : null;
  }

  async remove(id) {
    this.localTasks = this.localTasks.filter(task => task.id !== id);
    this.saveLocal();
    this.applyCloudOperation({ type: "delete", id });
  }

  async reorder(ids) {
    const positions = new Map(ids.map((id, index) => [id, index]));
    this.localTasks = this.localTasks.map(task => ({
      ...task,
      position: positions.has(task.id) ? positions.get(task.id) : task.position
    }));
    this.saveLocal();
    this.applyCloudOperation({ type: "reorder", ids });
  }

  async clearDone() {
    this.localTasks = this.localTasks.filter(task => !task.done);
    this.saveLocal();
    this.applyCloudOperation({ type: "clearDone" });
  }
}
