import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
const source = readFileSync(new URL('../functions/api/kbooks.js', import.meta.url), 'utf8');
const { onRequest, bookFilename } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

function setup() {
  const sql = new DatabaseSync(':memory:');
  const objects = new Map();
  const env = { KCLIP_TOKEN: 'd'.repeat(40), KBOOK_UPLOAD_TOKEN: 'u'.repeat(40),
    KINDLE_BOOKS: {
      async delete(key) { objects.delete(key); },
      async put(key, bytes) { objects.set(key, new Uint8Array(bytes)); },
      async get(key) { return objects.has(key) ? { body: objects.get(key) } : null; }
    },
    TODO_DB: {
      prepare(query) {
        let values = [];
        return { bind(...args) { values = args; return this; },
          async first() { return sql.prepare(query).get(...values); },
          async all() { return { results: sql.prepare(query).all(...values) }; },
          async run() { return sql.prepare(query).run(...values); } };
      },
      async batch(statements) { for (const statement of statements) await statement.run(); }
    }
  };
  const call = (query, { body, token = env.KCLIP_TOKEN, method = 'GET', headers = {} } = {}) =>
    onRequest({ env, request: new Request(`https://example.test/api/kbooks?${query}`, {
      method, body, headers: { Authorization: `Bearer ${token}`, ...headers }
    }) });
  const bytes = new Uint8Array(100); bytes.set(new TextEncoder().encode('BOOKMOBI'), 60);
  const upload = () => call('op=upload&title=' + encodeURIComponent('测试书籍'), {
    token: env.KBOOK_UPLOAD_TOKEN, method: 'POST', body: bytes
  });
  return { env, sql, objects, call, upload, bytes };
}

test('upload, download, confirm, deduplicate and isolate device receipts', async () => {
  const s = setup();
  const receipt = await (await s.upload()).json();
  assert.equal(receipt.queued, true);
  assert.equal(receipt.size, 100);
  assert.match(receipt.id, /^[a-f0-9]{64}$/);
  assert.equal((await (await s.upload()).json()).id, receipt.id);
  assert.equal(s.sql.prepare('SELECT count(*) AS n FROM kbooks').get().n, 1);
  const list = await (await s.call('op=list&device=oasis3')).text();
  assert.equal(list, `KBOOKS1\n${receipt.id}\t100\n`);
  const listV2 = await (await s.call('op=list&device=oasis3&format=2')).text();
  assert.match(listV2, /^KBOOKS2\t\d+\n/);
  assert.ok(listV2.includes(`测试书籍 [${receipt.id.slice(0, 8)}].azw3`));
  const metadata = await (await s.call(`op=meta&id=${receipt.id}`)).json();
  assert.equal(metadata.filename, `Kclip-测试书籍 [${receipt.id.slice(0, 8)}].azw3`);
  assert.deepEqual(new Uint8Array(await (await s.call(`op=file&id=${receipt.id}`)).arrayBuffer()), s.bytes);
  assert.equal((await s.call(`op=ack&device=oasis3&id=${receipt.id}`, { method: 'POST' })).status, 400);
  for (let n = 0; n < 2; n++) assert.equal(await (await s.call(`op=ack&device=oasis3&id=${receipt.id}`, {
    method: 'POST', headers: { 'X-Book-SHA256': receipt.id }
  })).text(), `OK ${receipt.id}`);
  assert.equal(await (await s.call('op=list&device=oasis3')).text(), 'KBOOKS1\n');
  assert.match(await (await s.call('op=list&device=voyage')).text(), new RegExp(receipt.id));
  await s.upload();
  assert.equal(await (await s.call('op=list&device=oasis3')).text(), 'KBOOKS1\n');
});

test('only uploader can delete a book, its file and all device receipts; retry is safe', async () => {
  const s = setup();
  const { id } = await (await s.upload()).json();
  await s.call(`op=ack&device=oasis3&id=${id}`, { method: 'POST', headers: { 'X-Book-SHA256': id } });
  assert.equal((await s.call(`op=delete&id=${id}`, { method: 'DELETE' })).status, 401);
  assert.equal(s.objects.size, 1);
  for (let i = 0; i < 2; i++) assert.equal(await (await s.call(`op=delete&id=${id}`, {
    method: 'DELETE', token: s.env.KBOOK_UPLOAD_TOKEN
  })).text(), `DELETED ${id}`);
  assert.equal(s.objects.size, 0);
  assert.equal(s.sql.prepare('SELECT count(*) AS n FROM kbook_receipts').get().n, 0);
  assert.equal((await s.call(`op=meta&id=${id}`)).status, 404);
});

test('filenames preserve Chinese while preventing traversal, control bytes and FAT collisions', () => {
  const id = 'a'.repeat(64);
  assert.equal(bookFilename('  ../测试:书名?\n', id), 'Kclip-_测试_书名__ [aaaaaaaa].azw3');
  assert.equal(bookFilename('Kclip-Kclip-测试', id), 'Kclip-测试 [aaaaaaaa].azw3');
  assert.ok(Buffer.byteLength(bookFilename('书'.repeat(200), id)) < 200);
  assert.notEqual(bookFilename('同名书', id), bookFilename('同名书', 'b'.repeat(64)));
});

test('reject unauthorized writes, bad containers and invalid paths', async () => {
  const s = setup();
  assert.equal((await s.call('op=upload&title=book', { method: 'POST', body: s.bytes })).status, 401);
  assert.equal((await s.call('op=list&device=oasis3', { token: '' })).status, 401);
  assert.equal((await s.call('op=upload&title=book', { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN, body: 'not a book' })).status, 400);
  assert.equal((await s.call('op=file&id=../../config')).status, 400);
  assert.equal((await s.call('op=list&device=bad/device')).status, 400);
  assert.equal((await s.call('op=upload&title=book', { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN,
    body: s.bytes, headers: { 'Content-Length': '67108865' } })).status, 413);
  assert.equal(s.objects.size, 0);
});

test('storage failure is retryable and never creates a downloadable partial entry', async () => {
  const s = setup();
  const originalPut = s.env.KINDLE_BOOKS.put;
  s.env.KINDLE_BOOKS.put = async () => { throw new Error('offline'); };
  assert.equal((await s.upload()).status, 503);
  assert.equal(await (await s.call('op=list&device=oasis3')).text(), 'KBOOKS1\n');
  s.env.KINDLE_BOOKS.put = originalPut;
  const originalPrepare = s.env.TODO_DB.prepare;
  s.env.TODO_DB.prepare = query => {
    if (query.startsWith('INSERT OR IGNORE INTO kbooks ')) throw new Error('database unavailable');
    return originalPrepare(query);
  };
  assert.equal((await s.upload()).status, 503);
  assert.equal(s.objects.size, 1);
  assert.equal(await (await s.call('op=list&device=oasis3')).text(), 'KBOOKS1\n');
  s.env.TODO_DB.prepare = originalPrepare;
  assert.equal((await s.upload()).status, 200);
  assert.equal(s.objects.size, 1);
});

test('short-lived ticket permits one distinct book, identical retries, and no administrative access', async () => {
  const s = setup();
  assert.equal((await s.call('op=ticket', { method: 'POST', body: '{}' })).status, 401);
  const minted = await s.call('op=ticket', { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN,
    body: JSON.stringify({ title: '手机云端验证' }) });
  const ticket = await minted.json();
  assert.match(ticket.token, /^[a-f0-9]{64}$/);
  assert.equal(ticket.title, 'Kclip-手机云端验证');
  assert.equal(ticket.maxBytes, 5 * 1024 * 1024);
  assert.ok(Date.parse(ticket.expiresAt) - Date.now() <= 1800000);
  assert.equal((await s.call('op=list&device=oasis3', { token: ticket.token })).status, 401);
  assert.equal((await s.call('op=upload&title=bad', { method: 'POST', token: ticket.token, body: s.bytes })).status, 401);
  assert.equal((await s.call('op=redeem', { method: 'POST', token: ticket.token, body: 'invalid' })).status, 400);
  assert.equal((await s.call('op=redeem', { method: 'POST', token: ticket.token, body: s.bytes,
    headers: { 'Content-Length': String(ticket.maxBytes + 1) } })).status, 413);
  const redeem = body => s.call('op=redeem&title=ignored', { method: 'POST', token: ticket.token, body });
  // A transient storage failure binds the ticket but allows the same file retry.
  const put = s.env.KINDLE_BOOKS.put;
  s.env.KINDLE_BOOKS.put = async () => { throw new Error('temporary'); };
  assert.equal((await redeem(s.bytes)).status, 503);
  s.env.KINDLE_BOOKS.put = put;
  const receipt = await (await redeem(s.bytes)).json();
  assert.equal(receipt.title, ticket.title);
  assert.equal(receipt.queued, true);
  assert.deepEqual(await (await redeem(s.bytes)).json(), receipt);
  const different = new Uint8Array(s.bytes); different[80] = 1;
  assert.equal((await redeem(different)).status, 409);
  assert.equal((await s.call(`op=delete&id=${receipt.id}`, { method: 'DELETE', token: ticket.token })).status, 401);
  assert.equal(s.objects.size, 1);
  assert.equal(s.sql.prepare('SELECT count(*) AS n FROM kbooks').get().n, 1);
  s.sql.exec('UPDATE kbook_upload_tickets SET expires_at = 0');
  assert.equal((await redeem(s.bytes)).status, 410);
  assert.equal((await s.call('op=redeem', { method: 'POST', token: '0'.repeat(64), body: s.bytes })).status, 401);
});

test('publisher credentials upload multiple books without expiry and cannot read, delete or delegate; revocation works', async () => {
  const s = setup();
  const issued = await s.call('op=publisher', { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN,
    body: JSON.stringify({ label: 'Personal Work' }) });
  const publisher = await issued.json();
  assert.equal(publisher.mode, 'publisher');
  assert.equal(publisher.expiresAt, undefined);
  assert.match(publisher.keyId, /^[a-f0-9]{64}$/);
  const publish = body => s.call('op=publish&title=' + encodeURIComponent('新书'), { method: 'POST', token: publisher.token, body });
  const first = await (await publish(s.bytes)).json();
  assert.equal(first.title, 'Kclip-新书');
  const different = new Uint8Array(s.bytes); different[90] = 3;
  assert.equal((await publish(different)).status, 200);
  assert.equal(s.objects.size, 2);
  for (const [query, method] of [['op=list&device=oasis3', 'GET'], [`op=file&id=${first.id}`, 'GET'],
    [`op=delete&id=${first.id}`, 'DELETE'], ['op=ticket', 'POST'], ['op=publisher', 'POST'], ['op=revoke-publisher', 'POST']]) {
    assert.equal((await s.call(query, { token: publisher.token, method })).status, 401);
  }
  assert.equal((await s.call('op=revoke-publisher', { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN,
    body: JSON.stringify({ keyId: publisher.keyId }) })).status, 200);
  assert.equal((await publish(s.bytes)).status, 401);
});


test('PDF pipeline preserves extension, validates content, requeues receipts and deletes the correct object', async () => {
  const s = setup();
  // Existing installations have no format table; old AZW3 books remain readable.
  const old = await (await s.upload()).json();
  s.sql.exec('DELETE FROM kbook_formats');
  assert.equal((await (await s.call(`op=meta&id=${old.id}`)).json()).format, 'azw3');
  const pdf = new TextEncoder().encode('%PDF-1.7\n' + 'sample PDF content '.repeat(10) + '\n%%EOF\n');
  const upload = await s.call('op=upload&title=PDF', { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN, body: pdf });
  assert.equal(upload.status, 200);
  const book = await upload.json(); assert.equal(book.format, 'pdf');
  assert.ok(s.objects.has(`${book.id}.pdf`));
  const list = await (await s.call('op=list&device=oasis3&format=2')).text();
  assert.ok(list.includes(`Kclip-PDF [${book.id.slice(0, 8)}].pdf`));
  assert.ok(!(await (await s.call('op=list&device=oasis3')).text()).includes(book.id));
  assert.deepEqual(new Uint8Array(await (await s.call(`op=file&id=${book.id}`)).arrayBuffer()), pdf);
  for (const device of ['oasis3', 'voyage']) await s.call(`op=ack&device=${device}&id=${book.id}`, { method: 'POST', headers: { 'X-Book-SHA256': book.id } });
  assert.ok(!(await (await s.call('op=list&device=oasis3&format=2')).text()).includes(book.id));
  assert.equal((await s.call(`op=requeue&id=${book.id}`, { method: 'POST' })).status, 401);
  const issued = await (await s.call('op=publisher', { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN, body: JSON.stringify({label:'test'}) })).json();
  assert.equal((await s.call(`op=requeue&id=${book.id}`, {method:'POST',token:issued.token})).status,401);
  for (let i = 0; i < 2; i++) assert.equal((await s.call(`op=requeue&id=${book.id}`, { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN })).status, 200);
  for (const device of ['oasis3', 'voyage']) assert.ok((await (await s.call(`op=list&device=${device}&format=2`)).text()).includes(book.id));
  assert.ok(s.objects.has(`${book.id}.pdf`));
  assert.equal((await s.call('op=upload&title=bad', { method: 'POST', token: s.env.KBOOK_UPLOAD_TOKEN, body: '%PDF-1.7 fake '.repeat(15) })).status, 400);
  await s.call(`op=delete&id=${book.id}`, {method:'DELETE',token:s.env.KBOOK_UPLOAD_TOKEN});
  assert.ok(!s.objects.has(`${book.id}.pdf`)); assert.ok(s.objects.has(`${old.id}.azw3`));
});
