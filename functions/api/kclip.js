const reply = (text, status = 200) => new Response(text, {
  status, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' }
});

export function formatClippings(text) {
  const books = new Map();
  for (const block of text.replace(/\r\n/g, '\n').split(/^==========\s*$/m)) {
    const lines = block.replace(/\uFEFF/g, '').trim().split('\n');
    if (!lines[0]) continue;
    const metadata = lines[1] || '';
    const body = lines.slice(2).join('\n').trim();
    if (!body) continue;
    const type = /笔记|筆記|\bnote\b/i.test(metadata) ? 'note' : /标注|標註|划线|劃線|highlight/i.test(metadata) ? 'highlight' : 'other';
    const location = metadata.match(/(?:位置|location)\s*#?(\d+)(?:\s*[-–]\s*#?(\d+))?/i);
    const entry = { type, body, start: location ? Number(location[1]) : null,
      end: location ? Number(location[2] || location[1]) : null,
      time: metadata.split('|').slice(1).join('|').trim(), notes: [] };
    if (!books.has(lines[0])) books.set(lines[0], []);
    books.get(lines[0]).push(entry);
  }
  const sections = [];
  for (const [book, entries] of books) {
    const attached = new Set();
    entries.forEach((entry, index) => {
      if (entry.type !== 'note' || entry.start === null) return;
      const matches = entries.map((candidate, i) => ({ candidate, i })).filter(({ candidate }) =>
        candidate.type === 'highlight' && candidate.start !== null && candidate.start <= entry.start && candidate.end >= entry.start);
      const simultaneous = matches.filter(({ candidate }) => entry.time && candidate.time === entry.time);
      const prior = matches.filter(({ i }) => i < index).reverse();
      // Only infer a link when unambiguous at the same timestamp, or use the latest preceding highlight.
      const match = simultaneous.length === 1 ? simultaneous[0] : prior[0];
      if (match) { match.candidate.notes.push(entry.body); attached.add(entry); }
    });
    const records = entries.filter(entry => !attached.has(entry)).map(entry => {
      if (entry.type === 'highlight') return [entry.body.split('\n').map(line => `> ${line}`).join('\n'),
        ...entry.notes.map(note => `✍️ ${note}`)].join('\n\n');
      return `${entry.type === 'note' ? '✍️' : '🔖'} ${entry.body}`;
    });
    sections.push(`## ${book}\n\n${records.join('\n\n---\n\n')}`);
  }
  return sections.join('\n\n---\n\n');
}

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
  // Kindle metadata uses #912 for locations; meMo treats these as inline tags.
  // Only remove hashes before numeric locations on metadata lines, not book text.
  const note = formatClippings(text);
  if (!note || Array.from(note).length > 20000) return reply('Formatted note exceeds limit or contains no records; checkpoint unchanged', 413);
  const end = offset + length;
  if (!Number.isSafeInteger(end)) return reply('Invalid offset', 400);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
  const id = `kclip-${device}-${offset}-${hash}`;
  const db = env.TODO_DB;
  if (await db.prepare('SELECT id FROM kclip_receipts WHERE id = ?').bind(id).first()) return reply(`OK ${end}`);
  await db.prepare('INSERT OR IGNORE INTO kclip_devices (device, byte_offset) VALUES (?, 0)').bind(device).run();
  const now = Date.now();
  const title = `Kindle 摘录 · ${new Date(now + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 16)}`;
  // D1 batch is transactional. Conditional writes prevent overlapping uploads.
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO tasks (id, title, note, tags, done, position, created_at, archived, importance)
      SELECT ?, ?, ?, '["kclip","memo"]', 0, COALESCE((SELECT MIN(position) FROM tasks), 0) - 1, ?, 0, 1
      WHERE EXISTS (SELECT 1 FROM kclip_devices WHERE device = ? AND byte_offset = ?)`)
      .bind(id, title, note, now, device, offset),
    db.prepare(`INSERT OR IGNORE INTO kclip_receipts (id, device, end_offset, created_at)
      SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM kclip_devices WHERE device = ? AND byte_offset = ?)`)
      .bind(id, device, end, now, device, offset),
    db.prepare('UPDATE kclip_devices SET byte_offset = ? WHERE device = ? AND byte_offset = ?').bind(end, device, offset)
  ]);
  const receipt = await db.prepare('SELECT id FROM kclip_receipts WHERE id = ?').bind(id).first();
  return receipt ? reply(`OK ${end}`) : reply('Checkpoint conflict; do not reset local state or change the source file', 409);
}

export function onRequest({ request, env }) { return receive(request, env); }
