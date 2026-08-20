import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccount, findAccountByEmail, setAccountStatus,
  insertCode, findCode, bindCode, currentContentKey,
  countAttempts, recordAttempt, recordError,
} from './db.js';

// 假 D1：记录收到的 SQL 与参数，按预设结果返回
function fakeDb(results = []) {
  const calls = [];
  const queue = [...results];
  return {
    calls,
    prepare(sql) {
      const call = { sql, args: [] };
      calls.push(call);
      const stmt = {
        bind(...args) { call.args = args; return stmt; },
        async first() { return queue.length ? queue.shift() : null; },
        async run() { return { meta: { last_row_id: 7 } }; },
      };
      return stmt;
    },
  };
}

test('建账号带上邮箱、哈希、盐与状态 pending', async () => {
  const db = fakeDb();
  const id = await createAccount(db, { email: 'a@b.com', hash: 'H', salt: 'S', now: 1000 });
  assert.equal(id, 7);
  assert.match(db.calls[0].sql, /INSERT INTO accounts/);
  assert.deepEqual(db.calls[0].args, ['a@b.com', 'H', 'S', 'pending', 1000]);
});

test('按邮箱查账号', async () => {
  const db = fakeDb([{ id: 1, email: 'a@b.com', status: 'active' }]);
  const row = await findAccountByEmail(db, 'a@b.com');
  assert.equal(row.id, 1);
  assert.deepEqual(db.calls[0].args, ['a@b.com']);
});

test('改状态', async () => {
  const db = fakeDb();
  await setAccountStatus(db, 3, 'active');
  assert.match(db.calls[0].sql, /UPDATE accounts/);
  assert.deepEqual(db.calls[0].args, ['active', 3]);
});

test('插入未绑定的码时 account_id 为 null', async () => {
  const db = fakeDb();
  await insertCode(db, { codeHash: 'CH', accountId: null, now: 5 });
  assert.deepEqual(db.calls[0].args, ['CH', null, 5]);
});

test('绑定码写入账号与使用时间', async () => {
  const db = fakeDb();
  await bindCode(db, { codeHash: 'CH', accountId: 9, now: 20 });
  assert.match(db.calls[0].sql, /UPDATE codes/);
  assert.deepEqual(db.calls[0].args, [9, 20, 'CH']);
});

test('查当前内容密钥只取 is_current = 1', async () => {
  const db = fakeDb([{ version: 'v5', cek: 'KEY' }]);
  const row = await currentContentKey(db);
  assert.equal(row.version, 'v5');
  assert.match(db.calls[0].sql, /is_current = 1/);
  assert.match(db.calls[0].sql, /ORDER BY created_at DESC/);
  assert.match(db.calls[0].sql, /LIMIT 1/);
});

test('限流计数按 ip、接口与时间窗', async () => {
  const db = fakeDb([{ n: 3 }]);
  const n = await countAttempts(db, { ip: '1.2.3.4', endpoint: '/login', since: 100 });
  assert.equal(n, 3);
  assert.deepEqual(db.calls[0].args, ['1.2.3.4', '/login', 100]);
});

test('记一次尝试', async () => {
  const db = fakeDb();
  await recordAttempt(db, { ip: '1.2.3.4', endpoint: '/login', now: 200 });
  assert.match(db.calls[0].sql, /INSERT INTO attempts/);
  assert.deepEqual(db.calls[0].args, ['1.2.3.4', '/login', 200]);
});

test('记一条错误日志', async () => {
  const db = fakeDb();
  await recordError(db, {
    ts: 300, method: 'POST', path: '/register', name: 'TypeError', message: '坏了',
  });
  assert.match(db.calls[0].sql, /INSERT INTO error_log/);
  assert.deepEqual(db.calls[0].args, [300, 'POST', '/register', 'TypeError', '坏了']);
});
