import { TaskStore } from "./store.js?v=20260625c";
import { initThemeSelector } from "./ui/page-theme.js?v=20260625c";

const store = new TaskStore();

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

const URL_PATTERN = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;
const TRAILING_PUNCTUATION = /[),.;:!?，。；：！？）】》]+$/;

let tasks = [];
let statusFilter = "active";
let tagFilter = "";
let busy = false;

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
      .map(tag => tag.trim().replace(/^#/, ""))
      .filter(Boolean)
  )].slice(0, 8);
}

function sortedTasks(source = tasks) {
  return [...source].sort((a, b) => a.position - b.position);
}

function visibleTasks() {
  return sortedTasks().filter(task => {
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && !task.done) ||
      (statusFilter === "done" && task.done);
    const matchesTag = !tagFilter || task.tags.includes(tagFilter);
    return matchesStatus && matchesTag;
  });
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
  form.querySelector("button").disabled = busy;
  clearDoneButton.disabled = busy || !tasks.some(task => task.done);
  syncButton.disabled = busy;
  if (message) syncStatus.textContent = message;
}

function statusText(detail = {}) {
  const pending = detail.pending ?? store.pendingOps?.length ?? 0;

  if (detail.status === "synced") return "已同步到 D1";
  if (detail.status === "syncing") return `正在同步 ${pending} 个离线改动…`;
  if (detail.status === "offline-pending") return `离线可用，待同步 ${pending} 个改动`;
  return "本地离线模式";
}

function setStatus(detail) {
  syncStatus.classList.remove("error");
  syncStatus.textContent = statusText(detail);
}

function showError(error) {
  console.error(error);
  syncStatus.textContent = "保存失败，已先保存在本地";
  syncStatus.classList.add("error");
}

function renderTagFilters() {
  const tags = [...new Set(tasks.flatMap(task => task.tags))].sort((a, b) => a.localeCompare(b, "zh-CN"));
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
    button.textContent = `#${tag}`;
    button.dataset.tag = tag;
    tagFilters.append(button);
  });
}

function render() {
  const visible = visibleTasks();
  list.replaceChildren();

  visible.forEach(task => {
    const item = template.content.firstElementChild.cloneNode(true);
    item.dataset.id = task.id;
    item.classList.toggle("done", task.done);

    const check = item.querySelector(".check");
    check.checked = task.done;
    check.setAttribute("aria-label", `${task.done ? "恢复" : "完成"}：${task.title}`);

    appendTextWithLinks(item.querySelector(".title"), task.title);

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
      label.textContent = `#${tag}`;
      tags.append(label);
    });

    list.append(item);
  });

  const activeCount = tasks.filter(task => !task.done).length;
  count.textContent = `${activeCount} 个待办 / ${tasks.length} 个任务`;
  emptyState.textContent = tasks.length ? "当前筛选下没有任务。" : "暂无任务。";
  emptyState.classList.toggle("show", visible.length === 0);
  clearDoneButton.disabled = busy || !tasks.some(task => task.done);
  renderTagFilters();
}

async function mutate(action) {
  if (busy) return;
  setBusy(true, "正在保存…");
  syncStatus.classList.remove("error");
  try {
    await action();
    render();
    setStatus({ status: store.status, pending: store.pendingOps.length });
  } catch (error) {
    render();
    showError(error);
  } finally {
    setBusy(false);
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  const title = titleInput.value.trim();
  if (!title) return;

  mutate(async () => {
    const task = await store.create({
      id: crypto.randomUUID(),
      title,
      note: noteInput.value.trim(),
      tags: parseTags(tagsInput.value),
      done: false,
      position: tasks.length
    });
    tasks.push(task);
    form.reset();
    titleInput.focus();
  });
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

  const deleteButton = event.target.closest(".delete-button");
  if (!deleteButton) return;
  const id = deleteButton.closest(".item").dataset.id;

  mutate(async () => {
    await store.remove(id);
    tasks = tasks.filter(task => task.id !== id);
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
  });
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
    const orderedIds = sortedTasks().map(task => (
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
  try {
    tasks = await store.sync();
    render();
    setStatus({ status: store.status, pending: store.pendingOps.length });
  } catch {
    setStatus({ status: store.status, pending: store.pendingOps.length });
  }
});

installDragSorting();

async function start() {
  try {
    setBusy(true, "正在连接…");
    tasks = await store.load();
    render();
    setStatus({ status: store.status, pending: store.pendingOps.length });
  } finally {
    setBusy(false);
  }
}

start().catch(showError);
