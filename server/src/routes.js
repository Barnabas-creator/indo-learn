// 四个接口的处理函数。只做参数校验与编排，SQL 在 db.js，算法在 crypto.js / codes.js。
import { hashPassword, verifyPassword, signToken, verifyToken } from './crypto.js';
import { generateCode, hashCode } from './codes.js';
import {
  createAccount, findAccountByEmail, findAccountById, setAccountStatus,
  insertCode, findCode, bindCode, currentContentKey,
  countAttempts, recordAttempt,
} from './db.js';

export const RATE_LIMIT = 10;
export const RATE_WINDOW_MS = 60000;
const MIN_PASSWORD = 8;

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function clientIp(request) {
  return request.headers.get('cf-connecting-ip') ?? 'unknown';
}

async function overLimit(env, request, endpoint, now) {
  const ip = clientIp(request);
  const n = await countAttempts(env.DB, { ip, endpoint, since: now - RATE_WINDOW_MS });
  if (n >= RATE_LIMIT) return true;
  await recordAttempt(env.DB, { ip, endpoint, now });
  return false;
}

async function readJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function handleRegister(request, env, now = Date.now()) {
  const { email, password } = await readJson(request);
  const mail = String(email ?? '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return json({ error: 'invalid_email' }, 400);
  if (String(password ?? '').length < MIN_PASSWORD) return json({ error: 'weak_password' }, 400);
  if (await findAccountByEmail(env.DB, mail)) return json({ error: 'email_taken' }, 409);

  const { hash, salt } = await hashPassword(password);
  const accountId = await createAccount(env.DB, { email: mail, hash, salt, now });

  const code = generateCode();
  await insertCode(env.DB, { codeHash: await hashCode(code), accountId: null, now });

  if (env.AUTO_ISSUE_CODE === 'true') return json({ ok: true, accountId, code });
  return json({ ok: true, accountId });
}

export async function handleLogin(request, env, now = Date.now()) {
  if (await overLimit(env, request, '/login', now)) {
    return json({ error: 'too_many_attempts' }, 429);
  }
  const { email, password } = await readJson(request);
  const mail = String(email ?? '').trim().toLowerCase();
  const account = await findAccountByEmail(env.DB, mail);
  if (!account) return json({ error: 'bad_credentials' }, 401);
  if (!(await verifyPassword(String(password ?? ''), account.password_hash, account.salt))) {
    return json({ error: 'bad_credentials' }, 401);
  }
  if (account.status === 'disabled') return json({ error: 'account_disabled' }, 403);
  const token = await signToken(account.id, env.SESSION_SECRET, now);
  return json({ token, status: account.status });
}
