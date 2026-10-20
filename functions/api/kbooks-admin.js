import { initialize, onRequest as booksRequest } from './kbooks.js';

// Public identifiers for the existing meDo Access application, not credentials.
const ISSUER = 'https://mail-1d5.cloudflareaccess.com';
const AUDIENCE = 'c20f04f7ebc2bc3bf977036f13030cadcca8dce6f6f2c8fe2f879886f3e8a225';
const ORIGIN = 'https://medo.ganlei.com';
let cachedKeys;
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
});
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

export async function authenticated(request, report = () => {}) {
  const fail = reason => { report(reason); return false; };
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token || token.length > 16384) return fail('missing_assertion');
  let stage = 'decode';
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return fail('malformed_token');
    const header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    const now = Date.now() / 1000;
    if (header.alg !== 'RS256' || typeof header.kid !== 'string') return fail('invalid_algorithm');
    if (claims.iss !== ISSUER) return fail('wrong_issuer');
    if (!(Array.isArray(claims.aud) ? claims.aud : [claims.aud]).includes(AUDIENCE)) return fail('wrong_application');
    if (typeof claims.exp !== 'number' || claims.exp <= now ||
        (claims.nbf !== undefined && (typeof claims.nbf !== 'number' || claims.nbf > now))) return fail('expired_token');
    if (typeof claims.email !== 'string' || !claims.email.includes('@')) return fail('human_login_required');
    if (!cachedKeys || cachedKeys.expires < Date.now() || !cachedKeys.keys.some(k => k.kid === header.kid)) {
      stage = 'fetch_keys';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      let response;
      try {
        response = await fetch(`${ISSUER}/cdn-cgi/access/certs`, { redirect: 'manual', headers: { 'User-Agent': 'KClip-BookUploader/1.0' }, signal: controller.signal });
      } finally { clearTimeout(timeout); }
      if (!response.ok) return fail(`keys_http_${response.status}`);
      stage = 'parse_keys';
      const { keys } = await response.json();
      if (!Array.isArray(keys)) throw new Error('Invalid Access keys');
      cachedKeys = { keys, expires: Date.now() + 300000 };
    }
    const jwk = cachedKeys.keys.find(k => k.kid === header.kid && k.kty === 'RSA');
    if (!jwk) return fail('unknown_signing_key');
    stage = 'import_key';
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
    return valid || fail('invalid_signature');
  } catch (error) {
    console.warn('kbooks-admin verification unavailable', stage, error.name, error.message);
    return fail(`verification_unavailable_${stage}_${error.name}`);
  }
}

export async function onRequest({ request, env }) {
  if (new URL(request.url).origin !== ORIGIN) return json({ error: '请通过 medo.ganlei.com 访问管理页面。' }, 403);
  let reason;
  if (!await authenticated(request, value => { reason = value; })) {
    console.warn('kbooks-admin access denied', reason);
    return json({ error: reason === 'human_login_required' ? '请使用 Zero Trust 邮箱登录管理书库。' : '登录验证失败，请刷新页面重新登录 Zero Trust。', reason }, 401);
  }
  const url = new URL(request.url);
  const op = url.searchParams.get('op') || 'list';
  const methods = { list: 'GET', upload: 'POST', delete: 'DELETE' };
  if (!methods[op]) return json({ error: '不支持的操作。' }, 400);
  if (request.method !== methods[op]) return json({ error: '请求方式不正确。' }, 405);
  if (request.method !== 'GET' && request.headers.get('Origin') !== ORIGIN) return json({ error: '请求来源不正确，请刷新页面。' }, 403);
  if (!env.TODO_DB || !env.KINDLE_BOOKS) return json({ error: '书库尚未配置。' }, 503);
  try {
    if (op === 'list') {
      await initialize(env.TODO_DB);
      const result = await env.TODO_DB.prepare(`SELECT b.id, b.title, b.size, b.created_at,
        COUNT(r.book_id) AS received_count FROM kbooks b LEFT JOIN kbook_receipts r ON r.book_id = b.id
        GROUP BY b.id ORDER BY b.created_at DESC, b.id`).all();
      return json({ books: result.results || [] });
    }
    const target = new URL('/api/kbooks', ORIGIN);
    target.searchParams.set('op', op);
    if (op === 'delete') target.searchParams.set('id', url.searchParams.get('id') || '');
    if (op === 'upload') {
      const title = (url.searchParams.get('title') || '').trim().replace(/^(?:Kclip-)+/i, '');
      target.searchParams.set('title', title ? `Kclip-${title}` : '');
    }
    const headers = new Headers(request.headers);
    headers.set('Authorization', `Bearer ${env.KBOOK_UPLOAD_TOKEN || ''}`);
    return await booksRequest({ env, request: new Request(target, {
      method: request.method, headers, body: request.body, duplex: 'half'
    }) });
  } catch { return json({ error: '书库暂时不可用，请稍后重试。' }, 503); }
}
