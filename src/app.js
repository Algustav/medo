import { TaskStore } from "./store.js?v=20260627b";
import { initThemeSelector } from "./ui/page-theme.js?v=20260625o";

const store = new TaskStore();

const AUTO_SYNC_DEBOUNCE_MS = 2500;
const AUTO_SYNC_MIN_INTERVAL_MS = 15000;
const AUTO_SYNC_IDLE_INTERVAL_MS = 120000;
const AUTO_SYNC_RETRY_AFTER_FAILURE_MS = 60000;

const form = document.querySelector("#todoForm");
const titleInput = document.querySelector("#todoTitle");
const noteInput = document.querySelector("#todoNote");
const tagsInput = document.querySelector("#todoTags");
const list = document.querySelector("#todoList");
const template = document.querySelector("#todoItemTemplate");
const count = document.querySelector("#todoCount");
const emptyState = document.querySelector("#emptyState");
const clearDoneButton = document.querySelector("#clearDoneButton");
const statusFilters = document.querySelector("#statusFilters");
const tagFilters = document.querySelector("#tagFilters");
const syncStatus = document.querySelector("#syncStatus");
const themeSelect = document.querySelector("#themeSelect");
const syncButton = document.querySelector("#syncButton");
const sortButton = document.querySelector("#sortButton");
const submitButton = form.querySelector("button[type='submit']");
const cancelEditButton = document.querySelector("#cancelEditButton");
const formActions = document.querySelector(".form-actions");
const tagSuggestions = document.querySelector("#tagSuggestions");

const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[),.;:!?，。；：！？）】》]+$/;
const SORT_STORAGE_KEY = "medo-sort-mode-v1";
const SORT_MODES = ["newest", "oldest", "manual"];
const SORT_META = {
  newest: { label: "排序：新任务在前", symbol: "∨" },
  oldest: { label: "排序：旧任务在前", symbol: "∧" },
  manual: { label: "排序：手动排序", symbol: "⋮⋮" }
};

let tasks = [];
let statusFilter = "active";
let tagFilter = "";
let busy = false;
let autoSyncTimer = null;
let autoSyncInFlight = false;
let lastAutoSyncAt = 0;
let lastAutoSyncFailedAt = 0;
let editingId = "";
let sortMode = SORT_MODES.includes(localStorage.getItem(SORT_STORAGE_KEY))
  ? localStorage.getItem(SORT_STORAGE_KEY)
  : "newest";

initThemeSelector(themeSelect);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {
    // 离线缓存失败不影响主功能；Cloudflare Pages 上线后通常会正常注册。
  });
}

function parseTags(value) {
  return [...new Set(
    value
      .split(/[,，、\s]+/)
      .map(tag => tag.trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean)
  )].slice(0, 8);
}

function sortedTasks(source = tasks) {
  return [...source].sort((a, b) => {
    if (sortMode === "newest") {
      return b.createdAt - a.createdAt || b.position - a.position;
    }

    if (sortMode === "oldest") {
      return a.createdAt - b.createdAt || a.position - b.position;
    }

    return a.position - b.position;
  });
}

function visibleTasks() {
  return sortedTasks().filter(task => {
    const matchesStatus =
      (statusFilter === "all" && !task.archived) ||
      (statusFilter === "active" && !task.done && !task.archived) ||
      (statusFilter === "done" && task.done && !task.archived) ||
      (statusFilter === "archived" && task.archived);
    const matchesTag = !tagFilter || task.tags.some(tag => tag.toLowerCase() === tagFilter);
    return matchesStatus && matchesTag;
  });
}

function activeTags() {
  return [...new Set(
    tasks
      .filter(task => !task.done && !task.archived)
      .flatMap(task => task.tags.map(tag => tag.toLowerCase()))
  )]
    .sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function currentInputTags() {
  return new Set(parseTags(tagsInput.value));
}

function renderTagSuggestions() {
  const currentTags = currentInputTags();
  const suggestions = activeTags().filter(tag => !currentTags.has(tag)).slice(0, 12);
  tagSuggestions.replaceChildren();

  if (!suggestions.length) {
    tagSuggestions.hidden = true;
    return;
  }

  suggestions.forEach(tag => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-suggestion";
    button.textContent = tag;
    button.dataset.tag = tag;
    tagSuggestions.append(button);
  });

  tagSuggestions.hidden = false;
}

function addTagToInput(tag) {
  const tags = parseTags(tagsInput.value);
  if (!tags.includes(tag)) tags.push(tag);
  tagsInput.value = tags.join(", ");
  tagsInput.focus();
  renderTagSuggestions();
}

function appendTextWithLinks(target, text) {
  target.replaceChildren();
  let cursor = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;
    const trailing = raw.match(TRAILING_PUNCTUATION)?.[0] || "";
    const urlText = trailing ? raw.slice(0, -trailing.length) : raw;

    if (start > cursor) {
      target.append(document.createTextNode(text.slice(cursor, start)));
    }

    const link = document.createElement("a");
    link.href = urlText.startsWith("www.") ? `https://${urlText}` : urlText;
    link.textContent = urlText;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    target.append(link);

    if (trailing) target.append(document.createTextNode(trailing));
    cursor = start + raw.length;
  }

  if (cursor < text.length) {
    target.append(document.createTextNode(text.slice(cursor)));
  }
}

function collapseNoteText(value) {
  return value.length > 30 ? `${value.slice(0, 30)}...更多` : value;
}

function setNoteExpanded(note, expanded) {
  const fullText = note.dataset.fullText || "";
  note.classList.toggle("expanded", expanded);
  if (expanded) {
    appendTextWithLinks(note, `${fullText} 收起`);
  } else {
    note.textContent = collapseNoteText(fullText);
  }
}

function setBusy(nextBusy, message = "") {
  busy = nextBusy;
  submitButton.disabled = busy;
  cancelEditButton.disabled = busy;
  clearDoneButton.disabled = busy || !tasks.some(task => task.done);
  syncButton.disabled = busy;
  sortButton.disabled = busy;
  if (message) syncStatus.textContent = message;
}

function statusText(detail = {}) {
  const pending = detail.pending ?? store.pendingOps?.length ?? 0;

  if (detail.status === "synced") return "已同步";
  if (detail.status === "syncing") return pending ? `同步中 ${pending}` : "同步中";
  if (detail.status === "offline-pending") return `待同步 ${pending}`;
  return "离线";
}

function setStatus(detail) {
  syncStatus.classList.remove("error");
  syncStatus.textContent = statusText(detail);
}

function showError(error) {
  console.error(error);
  syncStatus.textContent = "本地已存";
  syncStatus.classList.add("error");
}

function canAutoSync() {
  return navigator.onLine && document.visibilityState !== "hidden";
}

function scheduleAutoSync(reason = "change", delay = AUTO_SYNC_DEBOUNCE_MS) {
  window.clearTimeout(autoSyncTimer);
  autoSyncTimer = window.setTimeout(() => {
    runAutoSync(reason);
  }, delay);
}

async function runAutoSync(reason = "auto", { force = false } = {}) {
  if (busy || autoSyncInFlight || !canAutoSync()) return;

  const now = Date.now();
  const hasPending = store.pendingOps.length > 0;
  const shouldPull =
    force ||
    hasPending ||
    now - lastAutoSyncAt > AUTO_SYNC_IDLE_INTERVAL_MS ||
    reason === "online" ||
    reason === "visible" ||
    reason === "focus";

  if (!shouldPull) return;
  if (!force && now - lastAutoSyncAt < AUTO_SYNC_MIN_INTERVAL_MS && !hasPending) return;
  if (!force && lastAutoSyncFailedAt && now - lastAutoSyncFailedAt < AUTO_SYNC_RETRY_AFTER_FAILURE_MS) return;

  autoSyncInFlight = true;
  syncButton.disabled = true;

  try {
    tasks = await store.sync();
    lastAutoSyncAt = Date.now();
    lastAutoSyncFailedAt = 0;
    render();
    setStatus({ status: store.status, pending: store.pendingOps.length });
  } catch (error) {
    lastAutoSyncFailedAt = Date.now();
    setStatus({ status: store.status, pending: store.pendingOps.length });
  } finally {
    autoSyncInFlight = false;
    syncButton.disabled = busy;
  }
}

function renderTagFilters() {
  const tags = activeTags();
  tagFilters.replaceChildren();

  if (tagFilter && !tags.includes(tagFilter)) tagFilter = "";
  if (!tags.length) return;

  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = `tag-filter${tagFilter ? "" : " active"}`;
  allButton.textContent = "全部标签";
  allButton.dataset.tag = "";
  tagFilters.append(allButton);

  tags.forEach(tag => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `tag-filter${tagFilter === tag ? " active" : ""}`;
    button.textContent = tag;
    button.dataset.tag = tag;
    tagFilters.append(button);
  });
}

function renderSortButton() {
  const meta = SORT_META[sortMode];
  sortButton.textContent = meta.symbol;
  sortButton.setAttribute("aria-label", meta.label);
  sortButton.title = meta.label;
}

function setSortMode(nextMode) {
  sortMode = nextMode;
  localStorage.setItem(SORT_STORAGE_KEY, sortMode);
  renderSortButton();
}

function renderComposerMode() {
  const isEditing = Boolean(editingId);
  form.classList.toggle("is-editing", isEditing);
  formActions.classList.toggle("is-editing", isEditing);
  cancelEditButton.hidden = !isEditing;
  submitButton.textContent = isEditing ? "✓" : "+";
  submitButton.setAttribute("aria-label", isEditing ? "保存修改" : "添加");
  submitButton.title = isEditing ? "保存修改" : "添加";
  titleInput.placeholder = isEditing ? "编辑任务" : "新增任务";
}

function exitEditMode({ clearForm = true } = {}) {
  editingId = "";
  if (clearForm) form.reset();
  tagSuggestions.hidden = true;
  renderComposerMode();
}

function startEdit(task) {
  editingId = task.id;
  titleInput.value = task.title;
  noteInput.value = task.note;
  tagsInput.value = task.tags.join(", ");
  tagSuggestions.hidden = true;
  renderComposerMode();
  titleInput.focus();
}

function render() {
  const visible = visibleTasks();
  list.replaceChildren();

  visible.forEach(task => {
    const item = template.content.firstElementChild.cloneNode(true);
    item.dataset.id = task.id;
    item.classList.toggle("done", task.done);
    item.classList.toggle("archived", task.archived);

    const check = item.querySelector(".check");
    check.checked = task.done;
    check.setAttribute("aria-label", `${task.done ? "恢复" : "完成"}：${task.title}`);

    const archiveButton = item.querySelector(".archive-button");
    archiveButton.textContent = task.archived ? "⇱" : "⇲";
    archiveButton.setAttribute("aria-label", task.archived ? "恢复归档" : "归档任务");
    archiveButton.title = task.archived ? "恢复归档" : "归档任务";

    const title = item.querySelector(".title");
    title.title = "点击编辑任务";
    appendTextWithLinks(title, task.title);

    const note = item.querySelector(".note");
    note.hidden = !task.note;
    if (task.note.length > 30) {
      note.classList.add("is-collapsible");
      note.dataset.fullText = task.note;
      note.setAttribute("role", "button");
      note.tabIndex = 0;
      note.title = "点击展开/收起备注";
      setNoteExpanded(note, false);
    } else {
      appendTextWithLinks(note, task.note);
    }

    const tags = item.querySelector(".tags");
    task.tags.forEach(tag => {
      const label = document.createElement("span");
      label.className = "tag";
      label.textContent = tag;
      tags.append(label);
    });

    list.append(item);
  });

  const activeCount = tasks.filter(task => !task.done && !task.archived).length;
  const visibleTotal = tasks.filter(task => !task.archived).length;
  const archivedCount = tasks.filter(task => task.archived).length;
  count.textContent = statusFilter === "archived"
    ? `${archivedCount} 个归档`
    : `${activeCount} 个待办 / ${visibleTotal} 个任务`;
  emptyState.textContent = tasks.length ? "当前筛选下没有任务。" : "暂无任务。";
  emptyState.classList.toggle("show", visible.length === 0);
  clearDoneButton.disabled = busy || !tasks.some(task => task.done);
  renderTagFilters();
  renderSortButton();
  renderComposerMode();
  if (document.activeElement === tagsInput) renderTagSuggestions();
}

async function mutate(action) {
  if (busy) return;
  setBusy(true, "正在保存…");
  syncStatus.classList.remove("error");
  try {
    await action();
    render();
    setStatus({ status: store.status, pending: store.pendingOps.length });
    scheduleAutoSync("mutation");
  } catch (error) {
    render();
    showError(error);
    scheduleAutoSync("mutation-failed", AUTO_SYNC_RETRY_AFTER_FAILURE_MS);
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  mutate(async () => {
    if (editingId) {
      const updated = await store.update(editingId, {
        title,
        note: noteInput.value.trim(),
        tags: parseTags(tagsInput.value),
        archived: false
      });
      tasks = tasks.map(task => task.id === editingId ? updated : task);
      exitEditMode();
      return;
    }

    const task = await store.create({
      id: crypto.randomUUID(),
      title,
      note: noteInput.value.trim(),
      tags: parseTags(tagsInput.value),
      done: false,
      position: tasks.length,
      createdAt: Date.now(),
      archived: false
    });
    tasks.push(task);
    form.reset();
    tagSuggestions.hidden = true;
    titleInput.focus();
  });
});

tagsInput.addEventListener("focus", renderTagSuggestions);
tagsInput.addEventListener("input", renderTagSuggestions);

tagSuggestions.addEventListener("mousedown", event => {
  event.preventDefault();
  event.stopPropagation();
});

tagSuggestions.addEventListener("click", event => {
  event.stopPropagation();
  const button = event.target.closest("[data-tag]");
  if (!button) return;
  addTagToInput(button.dataset.tag);
});

document.addEventListener("click", event => {
  if (event.target === tagsInput || event.target.closest("#tagSuggestions")) return;
  tagSuggestions.hidden = true;
});

list.addEventListener("change", event => {
  if (!event.target.matches(".check")) return;
  const item = event.target.closest(".item");
  const task = tasks.find(candidate => candidate.id === item.dataset.id);
  if (!task) return;

  mutate(async () => {
    const updated = await store.update(task.id, { done: event.target.checked });
    tasks = tasks.map(candidate => candidate.id === task.id ? updated : candidate);
  });
});

list.addEventListener("click", event => {
  if (event.target.closest("a")) return;

  const title = event.target.closest(".title");
  if (title) {
    const id = title.closest(".item").dataset.id;
    const task = tasks.find(candidate => candidate.id === id);
    if (task) startEdit(task);
    return;
  }

  const note = event.target.closest(".note.is-collapsible");
  if (note) {
    setNoteExpanded(note, !note.classList.contains("expanded"));
    return;
  }

  const tagButton = event.target.closest(".tag-button");
  if (tagButton) {
    const item = tagButton.closest(".item");
    const id = item.dataset.id;
    const task = tasks.find(candidate => candidate.id === id);
    if (!task) return;
    const editor = item.querySelector(".tag-editor");
    const input = item.querySelector(".tag-editor-input");
    input.value = task.tags.join(", ");
    editor.hidden = false;
    input.focus();
    return;
  }

  const cancelButton = event.target.closest(".cancel-tags");
  if (cancelButton) {
    cancelButton.closest(".tag-editor").hidden = true;
    return;
  }

  const archiveButton = event.target.closest(".archive-button");
  if (!archiveButton) return;
  const id = archiveButton.closest(".item").dataset.id;
  const task = tasks.find(candidate => candidate.id === id);
  if (!task) return;

  mutate(async () => {
    const updated = await store.update(id, { archived: !task.archived });
    tasks = tasks.map(candidate => candidate.id === id ? updated : candidate);
    if (editingId === id) exitEditMode();
  });
});

list.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") return;
  const note = event.target.closest(".note.is-collapsible");
  if (!note) return;
  event.preventDefault();
  setNoteExpanded(note, !note.classList.contains("expanded"));
});

list.addEventListener("submit", event => {
  const editor = event.target.closest(".tag-editor");
  if (!editor) return;
  event.preventDefault();
  const item = editor.closest(".item");
  const id = item.dataset.id;
  const value = editor.querySelector(".tag-editor-input").value;

  mutate(async () => {
    const updated = await store.update(id, { tags: parseTags(value) });
    tasks = tasks.map(candidate => candidate.id === id ? updated : candidate);
  });
});

statusFilters.addEventListener("click", event => {
  const button = event.target.closest("[data-status]");
  if (!button || button.id === "syncButton") return;
  statusFilter = button.dataset.status;
  statusFilters.querySelectorAll(".filter").forEach(filter => {
    filter.classList.toggle("active", filter === button);
  });
  render();
});

sortButton.addEventListener("click", () => {
  const currentIndex = SORT_MODES.indexOf(sortMode);
  setSortMode(SORT_MODES[(currentIndex + 1) % SORT_MODES.length]);
  render();
});

tagFilters.addEventListener("click", event => {
  const button = event.target.closest("[data-tag]");
  if (!button) return;
  tagFilter = button.dataset.tag;
  render();
});

clearDoneButton.addEventListener("click", () => {
  mutate(async () => {
    await store.clearDone();
    tasks = tasks.filter(task => !task.done);
    if (editingId && !tasks.some(task => task.id === editingId)) exitEditMode();
  });
});

cancelEditButton.addEventListener("click", () => {
  exitEditMode();
  titleInput.focus();
});

syncButton.addEventListener("click", async () => {
  if (busy) return;
  setBusy(true, "正在同步…");
  try {
    tasks = await store.sync();
    render();
    setStatus({ status: store.status, pending: store.pendingOps.length });
  } catch (error) {
    showError(error);
  } finally {
    setBusy(false);
  }
});

function installDragSorting() {
  let draggedItem = null;

  list.addEventListener("pointerdown", event => {
    const handle = event.target.closest(".drag-handle");
    if (!handle || busy) return;
    draggedItem = handle.closest(".item");
    handle.setPointerCapture(event.pointerId);
    draggedItem.classList.add("dragging");
    event.preventDefault();
  });

  list.addEventListener("pointermove", event => {
    if (!draggedItem) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".item");
    if (!target || target === draggedItem || target.parentElement !== list) return;

    const rect = target.getBoundingClientRect();
    const insertAfter = event.clientY > rect.top + rect.height / 2;
    list.insertBefore(draggedItem, insertAfter ? target.nextSibling : target);
  });

  function finishDrag() {
    if (!draggedItem) return;
    draggedItem.classList.remove("dragging");
    draggedItem = null;

    const visibleIds = [...list.querySelectorAll(".item")].map(item => item.dataset.id);
    const visibleSet = new Set(visibleIds);
    let visibleIndex = 0;
    const displayedOrder = sortedTasks();
    setSortMode("manual");
    const orderedIds = displayedOrder.map(task => (
      visibleSet.has(task.id) ? visibleIds[visibleIndex++] : task.id
    ));

    tasks = tasks.map(task => ({
      ...task,
      position: orderedIds.indexOf(task.id)
    }));
    render();

    mutate(() => store.reorder(orderedIds));
  }

  list.addEventListener("pointerup", finishDrag);
  list.addEventListener("pointercancel", finishDrag);
}

store.addEventListener("statuschange", event => {
  setStatus(event.detail);
});

window.addEventListener("online", async () => {
  scheduleAutoSync("online", 300);
});

window.addEventListener("focus", () => {
  scheduleAutoSync("focus", 600);
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    scheduleAutoSync("visible", 600);
  }
});

window.setInterval(() => {
  scheduleAutoSync("interval", 0);
}, AUTO_SYNC_IDLE_INTERVAL_MS);

installDragSorting();
renderSortButton();
renderComposerMode();

async function start() {
  try {
    setBusy(true, "正在连接…");
    tasks = await store.load();
    render();
    setStatus({ status: store.status, pending: store.pendingOps.length });
    scheduleAutoSync("startup", 1200);
  } finally {
    setBusy(false);
  }
}

start().catch(showError);
