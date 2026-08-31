import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from './index.js';

const env = { DB: null, SESSION_SECRET: 's', ALLOWED_ORIGIN: 'https://example.com' };

test('预检请求返回 CORS 头', async () => {
  const res = await worker.fetch(
    new Request('https://api.test/login', { method: 'OPTIONS' }), env,
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://example.com');
});

test('白名单里的第二个域名也能拿到自己的 CORS 头', async () => {
  const twoOrigins = { ...env, ALLOWED_ORIGIN: 'https://example.com,https://two.test' };
  const res = await worker.fetch(
    new Request('https://api.test/login', {
      method: 'OPTIONS', headers: { origin: 'https://two.test' },
    }), twoOrigins,
  );
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://two.test');
  assert.equal(res.headers.get('vary'), 'origin');
});

test('白名单外的 Origin 拿到的是第一个域名，不是自己', async () => {
  const twoOrigins = { ...env, ALLOWED_ORIGIN: 'https://example.com,https://two.test' };
  const res = await worker.fetch(
    new Request('https://api.test/login', {
      method: 'OPTIONS', headers: { origin: 'https://evil.test' },
    }), twoOrigins,
  );
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://example.com');
});

test('未知路径返回 404', async () => {
  const res = await worker.fetch(new Request('https://api.test/nope'), env);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

test('响应都带 CORS 头', async () => {
  const res = await worker.fetch(new Request('https://api.test/nope'), env);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://example.com');
});

test('处理函数抛错时返回 500 而不是崩掉', async () => {
  // DB 为 null，注册时访问 env.DB 会抛错
  const res = await worker.fetch(
    new Request('https://api.test/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'rahasia123' }),
    }),
    env,
  );
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'server_error');
});

test('即使记日志本身也抛错，处理函数抛错时依然返回 500 而不是崩掉', async () => {
  // DB.prepare 一调就抛错：既让业务 handler 失败，也让 catch 里的 recordError 失败
  const throwingDb = {
    prepare() {
      throw new Error('db 挂了');
    },
  };
  const res = await worker.fetch(
    new Request('https://api.test/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'rahasia123' }),
    }),
    { ...env, DB: throwingDb },
  );
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'server_error');
});

test('带尾斜杠的路径 POST /login/ 能命中路由（不再是 404）', async () => {
  // DB 为 null 会让 handleLogin 内部抛错，只要不是 404 就证明路由命中了
  const res = await worker.fetch(
    new Request('https://api.test/login/', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'a@b.com', password: 'rahasia123' }),
    }),
    env,
  );
  assert.notEqual(res.status, 404);
  assert.equal(res.status, 500);
  assert.equal((await res.json()).error, 'server_error');
});

test('带查询串的 GET /content-key?x=1 能命中路由（不再是 404）', async () => {
  const res = await worker.fetch(
    new Request('https://api.test/content-key?x=1'),
    env,
  );
  assert.notEqual(res.status, 404);
});

test('POST /request-code 能命中路由（不再是 404）', async () => {
  const res = await worker.fetch(
    new Request('https://api.test/request-code', { method: 'POST' }),
    env,
  );
  assert.notEqual(res.status, 404);
});

// fetch(request, env, ctx) 把 ctx 一路传给 handler，注册请求命中 ctx.waitUntil
// 而不是卡在等 Telegram 推送——用一个内存假 D1 走完整条 handleRegister 路径。
test('fetch 把第三个参数 ctx 传给 handler：register 走 ctx.waitUntil，不阻塞响应', async () => {
  const accounts = [];
  const codes = [];
  const db = {
    prepare(sql) {
      const stmt = { sql, args: [] };
      return {
        bind(...args) { stmt.args = args; return this; },
        async first() {
          if (/FROM accounts WHERE email/.test(sql)) {
            return accounts.find((a) => a.email === stmt.args[0]) ?? null;
          }
          if (/COUNT\(\*\)/.test(sql)) return { n: 0 };
          return null;
        },
        async run() {
          if (/INSERT INTO accounts/.test(sql)) {
            const [email, password_hash, salt, status, trial_ends_at, created_at] = stmt.args;
            const id = accounts.length + 1;
            accounts.push({
              id, email, password_hash, salt, status, trial_ends_at, created_at,
            });
            return { meta: { last_row_id: id } };
          }
          if (/INSERT INTO codes/.test(sql)) codes.push({ code_hash: stmt.args[0] });
          return { meta: { last_row_id: 0 } };
        },
      };
    },
  };
  const e = {
    ...env, DB: db, TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C',
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => new Promise(() => {}); // 模拟 Telegram 永不响应
  let waitedCount = 0;
  try {
    const res = await worker.fetch(
      new Request('https://api.test/register', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'a@b.com', password: 'rahasia123' }),
      }),
      e,
      { waitUntil: () => { waitedCount += 1; } },
    );
    assert.equal(res.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(waitedCount, 1);
});
