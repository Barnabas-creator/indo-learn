import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleRegister, handleLogin } from './routes.js';
import { hashPassword, signToken } from './crypto.js';
import { handleActivate, handleContentKey } from './routes.js';
import { hashCode } from './codes.js';

function req(body, ip = '1.1.1.1') {
  return new Request('https://api.test/x', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
}

// 内存版假 D1：够跑通路由逻辑
function memDb() {
  const accounts = [];
  const codes = [];
  const attempts = [];
  const db = {
    accounts, codes, attempts,
    prepare(sql) {
      const stmt = { sql, args: [] };
      return {
        bind(...args) { stmt.args = args; return this; },
        async first() {
          if (/FROM accounts WHERE email/.test(sql)) {
            return accounts.find((a) => a.email === stmt.args[0]) ?? null;
          }
          if (/FROM accounts WHERE id/.test(sql)) {
            return accounts.find((a) => a.id === stmt.args[0]) ?? null;
          }
          if (/FROM codes/.test(sql)) {
            return codes.find((c) => c.code_hash === stmt.args[0]) ?? null;
          }
          if (/COUNT\(\*\)/.test(sql)) {
            const [ip, endpoint, since] = stmt.args;
            return { n: attempts.filter((a) => a.ip === ip && a.endpoint === endpoint && a.ts > since).length };
          }
          if (/FROM content_keys/.test(sql)) {
            return db.contentKey ?? null;
          }
          return null;
        },
        async run() {
          if (/INSERT INTO accounts/.test(sql)) {
            const [email, password_hash, salt, status, created_at] = stmt.args;
            const id = accounts.length + 1;
            accounts.push({ id, email, password_hash, salt, status, created_at });
            return { meta: { last_row_id: id } };
          }
          if (/INSERT INTO codes/.test(sql)) {
            codes.push({ code_hash: stmt.args[0], account_id: stmt.args[1], used_at: null });
          }
          if (/INSERT INTO attempts/.test(sql)) {
            attempts.push({ ip: stmt.args[0], endpoint: stmt.args[1], ts: stmt.args[2] });
          }
          if (/UPDATE accounts/.test(sql)) {
            const acc = accounts.find((a) => a.id === stmt.args[1]);
            if (acc) acc.status = stmt.args[0];
          }
          if (/UPDATE codes/.test(sql)) {
            const c = codes.find((cd) => cd.code_hash === stmt.args[2]);
            if (c) { c.account_id = stmt.args[0]; c.used_at = stmt.args[1]; }
          }
          return { meta: { last_row_id: 0 } };
        },
      };
    },
  };
  return db;
}

const env = () => ({ DB: memDb(), SESSION_SECRET: 'rahasia', AUTO_ISSUE_CODE: 'true' });

test('注册成功返回激活码（自动发码模式）', async () => {
  const res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), env());
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.match(body.code, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
});

test('关掉自动发码时不返回码', async () => {
  const e = { ...env(), AUTO_ISSUE_CODE: 'false' };
  const res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const body = await res.json();
  assert.equal(body.code, undefined);
  assert.equal(body.ok, true);
});

test('邮箱重复报 email_taken', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const res = await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'email_taken');
});

test('密码太短报 weak_password', async () => {
  const res = await handleRegister(req({ email: 'a@b.com', password: '123' }), env());
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'weak_password');
});

test('邮箱格式不对报 invalid_email', async () => {
  const res = await handleRegister(req({ email: 'bukan-email', password: 'rahasia123' }), env());
  assert.equal((await res.json()).error, 'invalid_email');
});

test('登录成功返回令牌与状态', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const res = await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const body = await res.json();
  assert.ok(body.token);
  assert.equal(body.status, 'pending');
});

test('密码错报 bad_credentials', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  const res = await handleLogin(req({ email: 'a@b.com', password: 'salah-sekali' }), e);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'bad_credentials');
});

test('账号不存在也报 bad_credentials（不泄露账号是否存在）', async () => {
  const res = await handleLogin(req({ email: 'nobody@b.com', password: 'rahasia123' }), env());
  assert.equal((await res.json()).error, 'bad_credentials');
});

test('同一 IP 一分钟内登录超过 10 次被限流', async () => {
  const e = env();
  await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e);
  for (let i = 0; i < 10; i++) {
    await handleLogin(req({ email: 'a@b.com', password: 'salah-sekali' }), e, 1000);
  }
  const res = await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e, 1000);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'too_many_attempts');
});

function authReq(token, body = {}) {
  return new Request('https://api.test/x', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      'cf-connecting-ip': '1.1.1.1',
    },
    body: JSON.stringify(body),
  });
}

async function registerAndLogin(e) {
  const reg = await (await handleRegister(req({ email: 'a@b.com', password: 'rahasia123' }), e)).json();
  const log = await (await handleLogin(req({ email: 'a@b.com', password: 'rahasia123' }), e)).json();
  return { code: reg.code, token: log.token };
}

test('用正确的码激活后账号变 active', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  const res = await handleActivate(authReq(token, { code }), e);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'active');
  assert.equal(e.DB.accounts[0].status, 'active');
});

test('错误的码报 bad_code', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  const res = await handleActivate(authReq(token, { code: 'ZZZZ-ZZZZ-ZZZZ-ZZZZ' }), e);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error, 'bad_code');
});

test('码已被别的账号用过报 code_used', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  await handleActivate(authReq(token, { code }), e);
  e.DB.accounts.push({ id: 2, email: 'c@d.com', status: 'pending' });
  const token2 = await signToken(2, e.SESSION_SECRET);
  const res = await handleActivate(authReq(token2, { code }), e);
  assert.equal(res.status, 409);
  assert.equal((await res.json()).error, 'code_used');
});

test('没令牌取密钥报 unauthorized', async () => {
  const res = await handleContentKey(new Request('https://api.test/content-key'), env());
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'unauthorized');
});

test('未激活账号取密钥报 not_activated', async () => {
  const e = env();
  const { token } = await registerAndLogin(e);
  const res = await handleContentKey(authReq(token), e);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'not_activated');
});

test('已激活账号能取到内容密钥', async () => {
  const e = env();
  const { code, token } = await registerAndLogin(e);
  await handleActivate(authReq(token, { code }), e);
  e.DB.contentKey = { version: 'v5', cek: 'KUNCI' };
  const res = await handleContentKey(authReq(token), e);
  const body = await res.json();
  assert.equal(body.cek, 'KUNCI');
  assert.equal(body.contentVersion, 'v5');
  assert.ok(body.expiresAt > Date.now());
});
