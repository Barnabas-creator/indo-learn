import { test } from 'node:test';
import assert from 'node:assert/strict';
import { notifyOwner } from './notify.js';

// 假 D1：只用来验证 recordError 有没有被调用，不关心内容细节之外的东西
function fakeDb() {
  const calls = [];
  return {
    calls,
    prepare(sql) {
      const call = { sql, args: [] };
      calls.push(call);
      return {
        bind(...args) { call.args = args; return this; },
        async run() { return { meta: { last_row_id: 1 } }; },
        async first() { return null; },
      };
    },
  };
}

function withFetch(impl, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return fn().finally(() => { globalThis.fetch = original; });
}

test('缺少 token 或 chat id 时直接跳过，不调用 fetch', async () => {
  let called = false;
  await withFetch(async () => { called = true; return new Response('{}'); }, async () => {
    await notifyOwner({ DB: fakeDb() }, '测试消息');
  });
  assert.equal(called, false);
});

test('只有 token 没有 chat id 也跳过', async () => {
  let called = false;
  await withFetch(async () => { called = true; return new Response('{}'); }, async () => {
    await notifyOwner({ DB: fakeDb(), TELEGRAM_BOT_TOKEN: 'T' }, '测试消息');
  });
  assert.equal(called, false);
});

test('token 和 chat id 都有时，调 sendMessage，URL 与 body 结构正确', async () => {
  let seenUrl = null;
  let seenBody = null;
  await withFetch(async (url, options) => {
    seenUrl = url;
    seenBody = JSON.parse(options.body);
    return new Response('{"ok":true}', { status: 200 });
  }, async () => {
    await notifyOwner(
      { DB: fakeDb(), TELEGRAM_BOT_TOKEN: 'ABC123', TELEGRAM_CHAT_ID: '8800814164' },
      '🔑 新注册待激活\n\n邮箱：a@b.com',
    );
  });
  assert.equal(seenUrl, 'https://api.telegram.org/botABC123/sendMessage');
  assert.deepEqual(seenBody, { chat_id: '8800814164', text: '🔑 新注册待激活\n\n邮箱：a@b.com' });
});

test('fetch 抛错时函数不抛出，且记一条 error_log', async () => {
  const db = fakeDb();
  await withFetch(async () => { throw new Error('network down'); }, async () => {
    await assert.doesNotReject(
      notifyOwner({ DB: db, TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' }, 'x'),
    );
  });
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO error_log/);
  assert.equal(db.calls[0].args[3], 'Error');
  assert.equal(db.calls[0].args[4], 'network down');
});

test('Telegram 返回非 2xx 时不抛出，也记一条 error_log', async () => {
  const db = fakeDb();
  await withFetch(async () => new Response('{"ok":false}', { status: 400 }), async () => {
    await assert.doesNotReject(
      notifyOwner({ DB: db, TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' }, 'x'),
    );
  });
  assert.equal(db.calls.length, 1);
  assert.match(db.calls[0].sql, /INSERT INTO error_log/);
  assert.match(db.calls[0].args[4], /status 400/);
});

test('连 recordError 本身也失败时依然不抛出', async () => {
  const throwingDb = { prepare() { throw new Error('db 挂了'); } };
  await withFetch(async () => { throw new Error('network down'); }, async () => {
    await assert.doesNotReject(
      notifyOwner({ DB: throwingDb, TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' }, 'x'),
    );
  });
});

test('fetch 收到 signal 参数（5秒超时）', async () => {
  let seenOptions = null;
  await withFetch(async (url, options) => {
    seenOptions = options;
    return new Response('{"ok":true}', { status: 200 });
  }, async () => {
    await notifyOwner(
      { DB: { prepare() { return { bind() { return this; }, async run() { return { meta: { last_row_id: 1 } }; } }; } },
        TELEGRAM_BOT_TOKEN: 'T', TELEGRAM_CHAT_ID: 'C' },
      'x',
    );
  });
  assert(seenOptions.signal instanceof AbortSignal);
});
