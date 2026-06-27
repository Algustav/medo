const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: JSON_HEADERS
  });
}

function mapTask(row) {
  let tags = [];
  try {
    tags = JSON.parse(row.tags || "[]");
  } catch {
    tags = [];
  }

  return {
    id: row.id,
    title: row.title,
    note: row.note || "",
    tags: Array.isArray(tags) ? tags : [],
    done: Boolean(row.done),
    position: Number(row.position),
    createdAt: Number.isFinite(Number(row.created_at)) ? Number(row.created_at) : Number(row.position),
    archived: Boolean(row.archived)
  };
}

async function requestBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function cleanTags(tags) {
  if (!Array.isArray(tags)) return [];
  return [...new Set(
    tags
      .map(tag => String(tag).trim().replace(/^#/, "").toLowerCase())
      .filter(Boolean)
  )].slice(0, 8);
}

async function ensureSchema(env) {
  try {
    await env.TODO_DB
      .prepare("ALTER TABLE tasks ADD COLUMN created_at REAL NOT NULL DEFAULT 0")
      .run();
  } catch {
    // 已存在该列时忽略；用于让旧 D1 数据库自动补齐排序字段。
  }

  try {
    await env.TODO_DB
      .prepare("CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)")
      .run();
  } catch {
    // 索引创建失败不影响核心读写。
  }

  try {
    await env.TODO_DB
      .prepare("ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0")
      .run();
  } catch {
    // 已存在该列时忽略；用于让旧 D1 数据库自动补齐归档字段。
  }

  try {
    await env.TODO_DB
      .prepare("CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(archived)")
      .run();
  } catch {
    // 索引创建失败不影响核心读写。
  }
}

export async function onRequestGet({ env }) {
  await ensureSchema(env);

  const result = await env.TODO_DB
    .prepare("SELECT id, title, note, tags, done, position, created_at, archived FROM tasks ORDER BY position ASC")
    .all();

  return json({ tasks: result.results.map(mapTask) });
}

export async function onRequestPost({ request, env }) {
  await ensureSchema(env);

  const body = await requestBody(request);
  const title = String(body?.title || "").trim();

  if (!body?.id || !title) {
    return json({ error: "id and title are required" }, 400);
  }

  const task = {
    id: String(body.id),
    title: title.slice(0, 200),
    note: String(body.note || "").trim().slice(0, 2000),
    tags: cleanTags(body.tags),
    done: Boolean(body.done),
    position: Number.isFinite(Number(body.position)) ? Number(body.position) : 0,
    createdAt: Number.isFinite(Number(body.createdAt)) ? Number(body.createdAt) : Date.now(),
    archived: Boolean(body.archived)
  };

  await env.TODO_DB
    .prepare(
      `INSERT INTO tasks (id, title, note, tags, done, position, created_at, archived)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
      + ` ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          note = excluded.note,
          tags = excluded.tags,
          done = excluded.done,
          position = excluded.position,
          created_at = excluded.created_at,
          archived = excluded.archived`
    )
    .bind(
      task.id,
      task.title,
      task.note,
      JSON.stringify(task.tags),
      Number(task.done),
      task.position,
      task.createdAt,
      Number(task.archived)
    )
    .run();

  return json({ task }, 201);
}

export async function onRequestPatch({ request, env }) {
  await ensureSchema(env);

  const body = await requestBody(request);
  const id = String(body?.id || "");

  if (!id) return json({ error: "id is required" }, 400);

  const current = await env.TODO_DB
    .prepare("SELECT id, title, note, tags, done, position, created_at, archived FROM tasks WHERE id = ?1")
    .bind(id)
    .first();

  if (!current) return json({ error: "task not found" }, 404);

  const previous = mapTask(current);
  const task = {
    ...previous,
    title: body.title === undefined ? previous.title : String(body.title).trim().slice(0, 200),
    note: body.note === undefined ? previous.note : String(body.note).trim().slice(0, 2000),
    tags: body.tags === undefined ? previous.tags : cleanTags(body.tags),
    done: body.done === undefined ? previous.done : Boolean(body.done),
    position: body.position === undefined ? previous.position : Number(body.position),
    createdAt: body.createdAt === undefined ? previous.createdAt : Number(body.createdAt),
    archived: body.archived === undefined ? previous.archived : Boolean(body.archived)
  };

  if (!task.title || !Number.isFinite(task.position) || !Number.isFinite(task.createdAt)) {
    return json({ error: "invalid task" }, 400);
  }

  await env.TODO_DB
    .prepare(
      `UPDATE tasks
       SET title = ?2, note = ?3, tags = ?4, done = ?5, position = ?6, created_at = ?7, archived = ?8
       WHERE id = ?1`
    )
    .bind(
      task.id,
      task.title,
      task.note,
      JSON.stringify(task.tags),
      Number(task.done),
      task.position,
      task.createdAt,
      Number(task.archived)
    )
    .run();

  return json({ task });
}

export async function onRequestPut({ request, env }) {
  const body = await requestBody(request);
  const ids = Array.isArray(body?.ids) ? body.ids.map(String) : [];

  if (!ids.length) return json({ error: "ids are required" }, 400);

  await env.TODO_DB.batch(
    ids.map((id, position) => (
      env.TODO_DB
        .prepare("UPDATE tasks SET position = ?2 WHERE id = ?1")
        .bind(id, position)
    ))
  );

  return json({ ok: true });
}

export async function onRequestDelete({ request, env }) {
  const body = await requestBody(request);

  if (body?.done === true) {
    await env.TODO_DB.prepare("DELETE FROM tasks WHERE done = 1").run();
    return json({ ok: true });
  }

  const id = String(body?.id || "");
  if (!id) return json({ error: "id is required" }, 400);

  await env.TODO_DB
    .prepare("DELETE FROM tasks WHERE id = ?1")
    .bind(id)
    .run();

  return json({ ok: true });
}
