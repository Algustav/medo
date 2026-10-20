const MAX_BYTES = 20 * 1024 * 1024;
const response = (body, status = 200, type = 'text/plain; charset=utf-8') =>
  new Response(body, { status, headers: { 'Content-Type': type, 'Cache-Control': 'no-store' } });
const deviceOK = value => /^[A-Za-z0-9_-]{1,64}$/.test(value || '');
const idOK = value => /^[a-f0-9]{64}$/.test(value || '');
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
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
      PRIMARY KEY (device, book_id))`),
    db.prepare(`CREATE TABLE IF NOT EXISTS kbook_upload_tickets (
      token_hash TEXT PRIMARY KEY, title TEXT NOT NULL, expires_at INTEGER NOT NULL,
      max_bytes INTEGER NOT NULL, book_id TEXT)`),
    db.prepare(`CREATE TABLE IF NOT EXISTS kbook_publishers (
      token_hash TEXT PRIMARY KEY, label TEXT NOT NULL, created_at INTEGER NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0)`)
  ]);
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const op = url.searchParams.get('op') || 'list';
  if (!['list', 'upload', 'file', 'ack', 'meta', 'delete', 'ticket', 'redeem', 'publisher', 'revoke-publisher', 'publish'].includes(op)) return response('Unknown operation', 400);
  const bearer = request.headers.get('Authorization') || '';
  if (op === 'redeem' || op === 'publish') {
    if (!/^Bearer [a-f0-9]{64}$/.test(bearer)) return response('Unauthorized', 401);
  } else {
    const secret = ['upload', 'delete', 'ticket', 'publisher', 'revoke-publisher'].includes(op) ? env.KBOOK_UPLOAD_TOKEN : env.KCLIP_TOKEN;
    if (!secret || secret.length < 32) return response('Server token not configured', 503);
    if (bearer !== `Bearer ${secret}`) return response('Unauthorized', 401);
  }
  const method = op === 'delete' ? 'DELETE' : ['upload', 'ack', 'ticket', 'redeem', 'publisher', 'revoke-publisher', 'publish'].includes(op) ? 'POST' : 'GET';
  if (request.method !== method) return response(`${method} required`, 405);
  if (!env.KINDLE_BOOKS || !env.TODO_DB) return response('Storage binding missing', 503);
  const device = url.searchParams.get('device');
  const id = url.searchParams.get('id');
  if ((op === 'list' || op === 'ack') && !deviceOK(device)) return response('Invalid device', 400);
  if (['file', 'ack', 'meta', 'delete'].includes(op) && !idOK(id)) return response('Invalid book ID', 400);
  try {
    await initialize(env.TODO_DB);
    if (op === 'publisher') {
      let input;
      try { input = await request.json(); } catch { return response('Expected JSON label', 400); }
      const label = typeof input?.label === 'string' ? input.label.trim() : '';
      if (!label || label.length > 100 || /[\x00-\x1f\x7f]/.test(label)) return response('Invalid label', 400);
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
      const tokenHash = await sha256(new TextEncoder().encode(token));
      await env.TODO_DB.prepare('INSERT INTO kbook_publishers (token_hash, label, created_at) VALUES (?, ?, ?)')
        .bind(tokenHash, label, Date.now()).run();
      return response(JSON.stringify({ mode: 'publisher', token, keyId: tokenHash, label, maxBytes: MAX_BYTES }), 200, 'application/json; charset=utf-8');
    }
    if (op === 'revoke-publisher') {
      let input;
      try { input = await request.json(); } catch { return response('Expected JSON keyId', 400); }
      if (!idOK(input?.keyId)) return response('Invalid key ID', 400);
      await env.TODO_DB.prepare('UPDATE kbook_publishers SET revoked = 1 WHERE token_hash = ?').bind(input.keyId).run();
      return response('REVOKED');
    }
    if (op === 'publish') {
      const tokenHash = await sha256(new TextEncoder().encode(bearer.slice(7)));
      const publisher = await env.TODO_DB.prepare('SELECT token_hash FROM kbook_publishers WHERE token_hash = ? AND revoked = 0').bind(tokenHash).first();
      if (!publisher) return response('Unauthorized', 401);
    }
    if (op === 'ticket') {
      let input;
      try { input = await request.json(); } catch { return response('Expected JSON title', 400); }
      let title = typeof input?.title === 'string' ? input.title.trim() : '';
      if (!title || title.length > 230 || /[\x00-\x1f\x7f]/.test(title)) return response('Invalid title', 400);
      title = 'Kclip-' + title.replace(/^(?:Kclip-)+/i, '');
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
      const tokenHash = await sha256(new TextEncoder().encode(token));
      const expires = Date.now() + 30 * 60 * 1000;
      const maxBytes = 5 * 1024 * 1024;
      await env.TODO_DB.prepare('INSERT INTO kbook_upload_tickets (token_hash, title, expires_at, max_bytes) VALUES (?, ?, ?, ?)')
        .bind(tokenHash, title, expires, maxBytes).run();
      return response(JSON.stringify({ token, title, expiresAt: new Date(expires).toISOString(), maxBytes }), 200, 'application/json; charset=utf-8');
    }
    let ticket, ticketHash;
    if (op === 'redeem') {
      ticketHash = await sha256(new TextEncoder().encode(bearer.slice(7)));
      ticket = await env.TODO_DB.prepare('SELECT * FROM kbook_upload_tickets WHERE token_hash = ?').bind(ticketHash).first();
      if (!ticket) return response('Unauthorized', 401);
      if (ticket.expires_at <= Date.now()) return response('Upload ticket expired', 410);
    }
    if (op === 'delete') {
      // Retryable even if a previous attempt deleted R2 but failed before D1.
      await env.KINDLE_BOOKS.delete(`${id}.azw3`);
      await env.TODO_DB.batch([
        env.TODO_DB.prepare('DELETE FROM kbook_receipts WHERE book_id = ?').bind(id),
        env.TODO_DB.prepare('DELETE FROM kbooks WHERE id = ?').bind(id)
      ]);
      return response(`DELETED ${id}`);
    }
    if (op === 'upload' || op === 'redeem' || op === 'publish') {
      let title = ticket ? ticket.title : (url.searchParams.get('title') || '').trim();
      if (op === 'publish' && title) title = 'Kclip-' + title.replace(/^(?:Kclip-)+/i, '');
      const maxBytes = ticket ? ticket.max_bytes : MAX_BYTES;
      if (!title || title.length > 240 || /[\x00-\x1f\x7f]/.test(title)) return response('Invalid title', 400);
      if (Number(request.headers.get('Content-Length')) > maxBytes) return response('File exceeds upload size limit', 413);
      const reader = request.body?.getReader();
      if (!reader) return response('Empty file', 400);
      const chunks = []; let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { await reader.cancel(); return response('File exceeds upload size limit', 413); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      // AZW3 uses the Palm database BOOK/MOBI signature; this is a format sanity check.
      if (size < 78 || new TextDecoder().decode(bytes.subarray(60, 68)) !== 'BOOKMOBI') return response('Expected AZW3/MOBI container', 400);
      const hash = await sha256(bytes);
      if (ticket) {
        // Atomically bind the credential to one content hash before writing R2.
        // Identical retries can recover from a lost response or a failed write.
        const claimed = await env.TODO_DB.prepare(`UPDATE kbook_upload_tickets SET book_id = ?
          WHERE token_hash = ? AND expires_at > ? AND (book_id IS NULL OR book_id = ?)
          RETURNING token_hash`).bind(hash, ticketHash, Date.now(), hash).first();
        if (!claimed) return response('Ticket expired or already bound to a different book', 409);
      }
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
