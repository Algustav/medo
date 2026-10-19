const MAX_BYTES = 20 * 1024 * 1024;
const response = (body, status = 200, type = 'text/plain; charset=utf-8') =>
  new Response(body, { status, headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
const deviceOK = value => /^[A-Za-z0-9_-]{1,64}$/.test(value || '');
const idOK = value => /^[a-f0-9]{64}$/.test(value || '');
export function bookFilename(title, id) {
  const clean = title.normalize('NFC').replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g, '_').replace(/[. ]+$/g, '').replace(/^[. ]+/g, '') || 'Book';
  let stem = '';
  for (const char of clean) {
    if (new TextEncoder().encode(stem + char).length > 160) break;
    stem += char;
  }
  stem = stem.replace(/^(?:Kclip-)+/i, '');
  return `Kclip-${stem} [${id.slice(0, 8)}].azw3`;
}

async function initialize(db) {
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS kbooks (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, size INTEGER NOT NULL,
      created_at INTEGER NOT NULL)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS kbook_receipts (
      device TEXT NOT NULL, book_id TEXT NOT NULL, received_at INTEGER NOT NULL,
      PRIMARY KEY (device, book_id))`)
  ]);
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const op = url.searchParams.get('op') || 'list';
  if (!['list', 'upload', 'file', 'ack', 'meta'].includes(op)) return response('Unknown operation', 400);
  const secret = op === 'upload' ? env.KBOOK_UPLOAD_TOKEN : env.KCLIP_TOKEN;
  if (!secret || secret.length < 32) return response('Server token not configured', 503);
  if (request.headers.get('Authorization') !== `Bearer ${secret}`) return response('Unauthorized', 401);
  const method = ['upload', 'ack'].includes(op) ? 'POST' : 'GET';
  if (request.method !== method) return response(`${method} required`, 405);
  if (!env.KINDLE_BOOKS || !env.TODO_DB) return response('Storage binding missing', 503);
  const device = url.searchParams.get('device');
  const id = url.searchParams.get('id');
  if ((op === 'list' || op === 'ack') && !deviceOK(device)) return response('Invalid device', 400);
  if (['file', 'ack', 'meta'].includes(op) && !idOK(id)) return response('Invalid book ID', 400);
  try {
    await initialize(env.TODO_DB);
    if (op === 'upload') {
      const title = (url.searchParams.get('title') || '').trim();
      if (!title || title.length > 240 || /[\x00-\x1f\x7f]/.test(title)) return response('Invalid title', 400);
      if (Number(request.headers.get('Content-Length')) > MAX_BYTES) return response('Maximum size: 20 MiB', 413);
      const reader = request.body?.getReader();
      if (!reader) return response('Empty file', 400);
      const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BYTES) { await reader.cancel(); return response('Maximum size: 20 MiB', 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      // AZW3 uses the Palm database BOOK/MOBI signature; this is a format sanity check.
      if (size < 78 || new TextDecoder().decode(bytes.subarray(60, 68)) !== 'BOOKMOBI') return response('Expected AZW3/MOBI container', 400);
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
      // A content address makes retries safe, including a failed DB write after R2 succeeds.
      await env.KINDLE_BOOKS.put(`${hash}.azw3`, bytes, { httpMetadata: { contentType: 'application/octet-stream' } });
      await env.TODO_DB.prepare('INSERT OR IGNORE INTO kbooks (id, title, size, created_at) VALUES (?, ?, ?, ?)')
        .bind(hash, title, size, Date.now()).run();
      return response(JSON.stringify({ id: hash, title, size, queued: true }), 200, 'application/json; charset=utf-8');
    }
    if (op === 'list') {
      const rows = await env.TODO_DB.prepare(`SELECT b.id, b.size, b.title FROM kbooks b
        WHERE NOT EXISTS (SELECT 1 FROM kbook_receipts r WHERE r.book_id = b.id AND r.device = ?)
        ORDER BY b.created_at, b.id LIMIT 100`).bind(device).all();
      if (url.searchParams.get('format') === '2') {
        return response(`KBOOKS2\t${Math.floor(Date.now() / 1000)}\n` + rows.results.map(row =>
          `${row.id}\t${row.size}\t${bookFilename(row.title, row.id)}\n`).join(''));
      }
      return response('KBOOKS1\n' + rows.results.map(row => `${row.id}\t${row.size}\n`).join(''));
    }
    const book = await env.TODO_DB.prepare('SELECT id, title, size FROM kbooks WHERE id = ?').bind(id).first();
    if (!book) return response('Book not found', 404);
    if (op === 'meta') return response(JSON.stringify({ ...book, filename: bookFilename(book.title, book.id) }), 200, 'application/json; charset=utf-8');
    if (op === 'file') {
      const object = await env.KINDLE_BOOKS.get(`${id}.azw3`);
      if (!object) return response('File missing', 404);
      return new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream',
        'Content-Length': String(book.size), 'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="${id}.azw3"` } });
    }
    if (request.headers.get('X-Book-SHA256') !== id) return response('Checksum confirmation required', 400);
    await env.TODO_DB.prepare('INSERT OR IGNORE INTO kbook_receipts (device, book_id, received_at) VALUES (?, ?, ?)')
      .bind(device, id, Date.now()).run();
    return response(`OK ${id}`);
  } catch {
    return response('Storage operation failed; safe to retry', 503);
  }
}
