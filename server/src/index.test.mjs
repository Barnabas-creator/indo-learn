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
