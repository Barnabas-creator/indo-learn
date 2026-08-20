// 密码哈希与会话令牌。WebCrypto 在 Workers 与 Node 22 上都有，同一份代码两边跑。
const subtle = globalThis.crypto.subtle;
const enc = new TextEncoder();

export const PBKDF2_ITERATIONS = 600000;
export const TOKEN_TTL_MS = 30 * 86400_000;

function toB64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromB64(b64) {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

function toB64Url(buf) {
  return toB64(buf).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  return fromB64(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
}

export async function hashPassword(password, saltB64) {
  const salt = saltB64
    ? fromB64(saltB64)
    : globalThis.crypto.getRandomValues(new Uint8Array(16));
  const base = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    base,
    256,
  );
  return { hash: toB64(bits), salt: toB64(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const again = await hashPassword(password, salt);
  // 逐字节比较，长度不同直接不通过；不提前 return，避免时间侧信道
  if (again.hash.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= again.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

async function hmac(secret, data) {
  const key = await subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  return subtle.sign('HMAC', key, enc.encode(data));
}

export async function signToken(accountId, secret, now = Date.now()) {
  const payload = toB64Url(enc.encode(JSON.stringify({ sub: accountId, exp: now + TOKEN_TTL_MS })));
  const sig = toB64Url(await hmac(secret, payload));
  return `${payload}.${sig}`;
}

export async function verifyToken(token, secret, now = Date.now()) {
  const [payload, sig] = String(token ?? '').split('.');
  if (!payload || !sig) return null;
  const expected = toB64Url(await hmac(secret, payload));
  if (expected !== sig) return null;
  try {
    const { sub, exp } = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    if (typeof sub !== 'number' || typeof exp !== 'number' || now >= exp) return null;
    return sub;
  } catch {
    return null;
  }
}
