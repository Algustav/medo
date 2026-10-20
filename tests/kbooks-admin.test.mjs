import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';

const moduleURL = source => `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`;
const booksURL = moduleURL(readFileSync(new URL('../functions/api/kbooks.js', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../functions/api/kbooks-admin.js', import.meta.url), 'utf8').replace("'./kbooks.js'", JSON.stringify(booksURL));
const { onRequest, authenticated } = await import(moduleURL(source));
const issuer = 'https://mail-1d5.cloudflareaccess.com';
const aud = 'c20f04f7ebc2bc3bf977036f13030cadcca8dce6f6f2c8fe2f879886f3e8a225';
const origin = 'https://medo.ganlei.com';
const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'test-key' };
const actualFetch = globalThis.fetch;
globalThis.fetch = async url => {
  assert.equal(url, `${issuer}/cdn-cgi/access/certs`);
  return Response.json({ keys: [jwk] });
};
const b64 = value => Buffer.from(JSON.stringify(value)).toString('base64url');
async function token(claims = {}, header = {}) {
  const unsigned = `${b64({ alg: 'RS256', kid: jwk.kid, ...header })}.${b64({ iss: issuer, aud: [aud], email: 'owner@example.test', exp: Math.floor(Date.now() / 1000) + 600, ...claims })}`;
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(unsigned));
  return `${unsigned}.${Buffer.from(signature).toString('base64url')}`;
}
const validToken = await token();
function setup() {
  const sql = new DatabaseSync(':memory:'); const objects = new Map();
  const env = {
    KBOOK_UPLOAD_TOKEN: 'u'.repeat(40),
    KINDLE_BOOKS: { async put(k, bytes) { objects.set(k, bytes); }, async delete(k) { objects.delete(k); } },
    TODO_DB: {
      prepare(query) { let args = []; return {
        bind(...values) { args = values; return this; },
        async first() { return sql.prepare(query).get(...args); },
        async all() { return { results: sql.prepare(query).all(...args) }; },
        async run() { return sql.prepare(query).run(...args); }
      }; },
      async batch(statements) { for (const statement of statements) await statement.run(); }
    }
  };
  const call = (query = '', { method = 'GET', body, headers = {}, host = origin, jwt = validToken } = {}) => onRequest({ env, request: new Request(`${host}/api/kbooks-admin?${query}`, {
    method, body, headers: { 'Cf-Access-Jwt-Assertion': jwt, Origin: origin, ...headers }
  }) });
  const bytes = new Uint8Array(100); bytes.set(new TextEncoder().encode('BOOKMOBI'), 60);
  return { sql, objects, env, call, bytes };
}

test('Access validates signature, issuer, audience, expiry and human login', async () => {
  assert.equal(await authenticated(new Request(origin, { headers: { 'Cf-Access-Jwt-Assertion': validToken } })), true);
  for (const jwt of [await token({ aud: ['other-app'] }), await token({ iss: 'https://attacker.example' }), await token({ exp: 1 }), await token({ email: undefined }), await token({ nbf: Date.now() / 1000 + 600 }), await token({}, { alg: 'none' }), `${validToken.slice(0, -8)}AAAAAAAA`]) {
    assert.equal(await authenticated(new Request(origin, { headers: { 'Cf-Access-Jwt-Assertion': jwt } })), false);
  }
});
test('public alternate host, spoofed email and cross-origin changes are rejected', async () => {
  const s = setup();
  assert.equal((await s.call('', { host: 'https://medo-imy.pages.dev' })).status, 403);
  assert.equal((await s.call('', { jwt: '', headers: { 'Cf-Access-Authenticated-User-Email': 'owner@example.test' } })).status, 401);
  assert.equal((await s.call('op=upload', { method: 'POST', body: s.bytes, headers: { Origin: 'https://attacker.example' } })).status, 403);
  assert.equal((await s.call('op=delete&id=' + 'a'.repeat(64), { method: 'GET' })).status, 405);
  assert.equal(s.objects.size, 0);
});
test('admin upload, inventory, receipt count, deduplication and deletion use the real book pipeline', async () => {
  const s = setup();
  assert.deepEqual(await (await s.call()).json(), { books: [] });
  const uploaded = await s.call('op=upload&title=' + encodeURIComponent('Kclip-测试书'), { method: 'POST', body: s.bytes });
  assert.equal(uploaded.status, 200);
  const book = await uploaded.json(); assert.equal(book.title, 'Kclip-测试书'); assert.equal(s.objects.size, 1);
  s.sql.prepare('INSERT INTO kbook_receipts VALUES (?, ?, ?)').run('oasis3', book.id, Date.now());
  const inventory = await (await s.call()).json();
  assert.equal(inventory.books.length, 1); assert.equal(inventory.books[0].received_count, 1);
  await s.call('op=upload&title=again', { method: 'POST', body: s.bytes });
  assert.equal((await (await s.call()).json()).books.length, 1);
  assert.equal((await s.call('op=delete&id=' + book.id, { method: 'DELETE' })).status, 200);
  assert.equal(s.objects.size, 0); assert.equal((await (await s.call()).json()).books.length, 0);
  assert.equal(s.sql.prepare('SELECT count(*) AS n FROM kbook_receipts').get().n, 0);
});
test('invalid book, size, title and storage failures do not report success', async () => {
  const s = setup();
  assert.equal((await s.call('op=upload&title=x', { method: 'POST', body: 'invalid' })).status, 400);
  assert.equal((await s.call('op=upload&title=', { method: 'POST', body: s.bytes })).status, 400);
  assert.equal((await s.call('op=upload&title=x', { method: 'POST', body: s.bytes, headers: { 'Content-Length': '20971521' } })).status, 413);
  s.env.KINDLE_BOOKS.put = async () => { throw new Error('test storage error'); };
  assert.equal((await s.call('op=upload&title=x', { method: 'POST', body: s.bytes })).status, 503);
});
test.after(() => { globalThis.fetch = actualFetch; });
