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
