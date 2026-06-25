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
    position: Number(row.position)
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
  return [...new Set(tags.map(tag => String(tag).trim()).filter(Boolean))].slice(0, 8);
}

export async function onRequestGet({ env }) {
  const result = await env.TODO_DB
    .prepare("SELECT id, title, note, tags, done, position FROM tasks ORDER BY position ASC")
    .all();

  return json({ tasks: result.results.map(mapTask) });
}

export async function onRequestPost({ request, env }) {
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
    position: Number.isFinite(Number(body.position)) ? Number(body.position) : 0
  };

  await env.TODO_DB
    .prepare(
      `INSERT INTO tasks (id, title, note, tags, done, position)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
      + ` ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          note = excluded.note,
          tags = excluded.tags,
          done = excluded.done,
          position = excluded.position`
    )
    .bind(
      task.id,
      task.title,
      task.note,
      JSON.stringify(task.tags),
      Number(task.done),
      task.position
    )
    .run();

  return json({ task }, 201);
}

export async function onRequestPatch({ request, env }) {
  const body = await requestBody(request);
  const id = String(body?.id || "");

  if (!id) return json({ error: "id is required" }, 400);

  const current = await env.TODO_DB
    .prepare("SELECT id, title, note, tags, done, position FROM tasks WHERE id = ?1")
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
    position: body.position === undefined ? previous.position : Number(body.position)
  };

  if (!task.title || !Number.isFinite(task.position)) {
    return json({ error: "invalid task" }, 400);
  }

  await env.TODO_DB
    .prepare(
      `UPDATE tasks
       SET title = ?2, note = ?3, tags = ?4, done = ?5, position = ?6
       WHERE id = ?1`
    )
    .bind(
      task.id,
      task.title,
      task.note,
      JSON.stringify(task.tags),
      Number(task.done),
      task.position
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
