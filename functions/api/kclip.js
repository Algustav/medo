const reply = (text, status = 200) => new Response(text, {
  status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
});

export async function receive(request, env) {
  if (!env.KCLIP_TOKEN || env.KCLIP_TOKEN.length < 32) return reply('Server token not configured', 503);
  if (request.headers.get('Authorization') !== `Bearer ${env.KCLIP_TOKEN}`) return reply('Unauthorized', 401);
  if (request.method !== 'POST') return reply('POST required', 405);
  const device = request.headers.get('X-Kclip-Device') || '';
  const offsetText = request.headers.get('X-Kclip-Offset') || '';
  const offset = Number(offsetText);
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(device) || !/^\d+$/.test(offsetText) || !Number.isSafeInteger(offset)) {
    return reply('Invalid device or offset', 400);
  }
  // Existing meDo notes support 20,000 Unicode characters. Never truncate.
  const reader = request.body?.getReader();
  if (!reader) return reply('Empty upload', 400);
  const chunks = []; let length = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 80000) { await reader.cancel(); return reply('Batch exceeds meDo note limit; checkpoint unchanged', 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length); let pos = 0;
  for (const chunk of chunks) { bytes.set(chunk, pos); pos += chunk.length; }
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { return reply('Invalid UTF-8', 400); }
  if (!text.trim() || !/(?:^|\n)==========\s*$/.test(text)) return reply('Incomplete clipping; retry after Kindle finishes saving', 422);
  if (Array.from(text).length > 20000) return reply('Batch exceeds 20,000 characters; checkpoint unchanged', 413);
  const end = offset + length;
  if (!Number.isSafeInteger(end)) return reply('Invalid offset', 400);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const id = `kclip-${device}-${offset}-${hash}`;
  const db = env.TODO_DB;
  if (await db.prepare('SELECT id FROM kclip_receipts WHERE id = ?').bind(id).first()) return reply(`OK ${end}`);
  await db.prepare('INSERT OR IGNORE INTO kclip_devices (device, byte_offset) VALUES (?, 0)').bind(device).run();
  const now = Date.now();
  const title = `Kindle 摘录 ${new Date(now).toISOString().replace('T', ' ').slice(0, 19)} UTC`;
  // D1 batch is transactional. Conditional writes prevent overlapping uploads.
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO tasks (id, title, note, tags, done, position, created_at, archived, importance)
      SELECT ?, ?, ?, '["kclip","memo"]', 0, COALESCE((SELECT MIN(position) FROM tasks), 0) - 1, ?, 0, 1
      WHERE EXISTS (SELECT 1 FROM kclip_devices WHERE device = ? AND byte_offset = ?)`)
      .bind(id, title, text, now, device, offset),
    db.prepare(`INSERT OR IGNORE INTO kclip_receipts (id, device, end_offset, created_at)
      SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM kclip_devices WHERE device = ? AND byte_offset = ?)`)
      .bind(id, device, end, now, device, offset),
    db.prepare('UPDATE kclip_devices SET byte_offset = ? WHERE device = ? AND byte_offset = ?').bind(end, device, offset)
  ]);
  const receipt = await db.prepare('SELECT id FROM kclip_receipts WHERE id = ?').bind(id).first();
  return receipt ? reply(`OK ${end}`) : reply('Checkpoint conflict; do not reset local state or change the source file', 409);
}

export function onRequest({ request, env }) { return receive(request, env); }
