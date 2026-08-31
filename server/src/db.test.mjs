import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAccount, findAccountByEmail, findAccountById, setAccountStatus,
  insertCode, findCode, bindCode, currentContentKey,
  countAttempts, recordAttempt, recordError, expireCodesOfAccount,
  listContentUnits, getContentUnit, currentContentVersion, bumpContentHits, countContentHits,
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
        async all() { return { results: queue.length ? queue.shift() : [] }; },
      };
      return stmt;
    },
  };
}

test('建账号默认状态 pending、不带试用到期时间', async () => {
  const db = fakeDb();
  const id = await createAccount(db, { email: 'a@b.com', hash: 'H', salt: 'S', now: 1000 });
  assert.equal(id, 7);
  assert.match(db.calls[0].sql, /INSERT INTO accounts/);
  assert.deepEqual(db.calls[0].args, ['a@b.com', 'H', 'S', 'pending', null, 1000]);
});

test('建账号可以指定状态与试用到期时间（注册即送试用用）', async () => {
  const db = fakeDb();
  await createAccount(db, {
    email: 'a@b.com', hash: 'H', salt: 'S', now: 1000, status: 'trial', trialEndsAt: 1000 + 7 * 86400_000,
  });
  assert.deepEqual(db.calls[0].args, ['a@b.com', 'H', 'S', 'trial', 604801000, 1000]);
});

test('按邮箱查账号，带上 trial_ends_at', async () => {
  const db = fakeDb([{ id: 1, email: 'a@b.com', status: 'active' }]);
  const row = await findAccountByEmail(db, 'a@b.com');
  assert.equal(row.id, 1);
  assert.deepEqual(db.calls[0].args, ['a@b.com']);
  assert.match(db.calls[0].sql, /trial_ends_at/);
});

test('按 id 查账号，带上 trial_ends_at', async () => {
  const db = fakeDb([{ id: 1, email: 'a@b.com', status: 'trial', trial_ends_at: 999 }]);
  const row = await findAccountById(db, 1);
  assert.equal(row.trial_ends_at, 999);
  assert.match(db.calls[0].sql, /trial_ends_at/);
});

test('改状态', async () => {
  const db = fakeDb();
  await setAccountStatus(db, 3, 'active');
  assert.match(db.calls[0].sql, /UPDATE accounts/);
  assert.deepEqual(db.calls[0].args, ['active', 3]);
});

test('插入未绑定的码时 account_id 为 null，不传 expiresAt 时为 null（永不过期）', async () => {
  const db = fakeDb();
  await insertCode(db, { codeHash: 'CH', accountId: null, now: 5 });
  assert.deepEqual(db.calls[0].args, ['CH', null, 5, null]);
});

test('插入码可以带上过期时间，绑定到指定账号', async () => {
  const db = fakeDb();
  await insertCode(db, {
    codeHash: 'CH', accountId: 3, now: 5, expiresAt: 5 + 1800000,
  });
  assert.deepEqual(db.calls[0].args, ['CH', 3, 5, 1800005]);
});

test('查码把 expires_at 也选出来', async () => {
  const db = fakeDb();
  await findCode(db, 'CH');
  assert.match(db.calls[0].sql, /expires_at/);
});

test('作废某账号名下未使用的码', async () => {
  const db = fakeDb();
  await expireCodesOfAccount(db, { accountId: 9 });
  assert.match(db.calls[0].sql, /UPDATE codes/);
  assert.match(db.calls[0].sql, /used_at IS NULL/);
  assert.deepEqual(db.calls[0].args, [9]);
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

test('清单默认只出 free 单元', async () => {
  const db = fakeDb();
  await listContentUnits(db, { includePaid: false });
  assert.match(db.calls[0].sql, /WHERE tier = \?/);
  assert.deepEqual(db.calls[0].args, ['free']);
});

test('清单带 includePaid 时不加 tier 条件', async () => {
  const db = fakeDb();
  await listContentUnits(db, { includePaid: true });
  assert.doesNotMatch(db.calls[0].sql, /WHERE tier/);
});

// 10.5A：清单要把 meta 列也选出来，路由层才有东西可解析给前端。
test('清单 SELECT 带上 meta 列', async () => {
  const db = fakeDb();
  await listContentUnits(db, { includePaid: true });
  assert.match(db.calls[0].sql, /SELECT module, unit_id, tier, title, meta FROM content/);
});

test('清单返回查到的行，带 meta 原始字符串（路由层负责解析）', async () => {
  const db = fakeDb([[{
    module: 'packs', unit_id: 'u1', tier: 'free', title: 'T', meta: '{"count":1}',
  }]]);
  const rows = await listContentUnits(db, { includePaid: true });
  assert.deepEqual(rows, [{
    module: 'packs', unit_id: 'u1', tier: 'free', title: 'T', meta: '{"count":1}',
  }]);
});

test('取单元按 module + unit_id 两个键', async () => {
  const db = fakeDb([{ tier: 'paid', version: 'c1', body: '{"a":1}' }]);
  const row = await getContentUnit(db, 'packs', 'freq-beginner-001');
  assert.deepEqual(db.calls[0].args, ['packs', 'freq-beginner-001']);
  assert.equal(row.version, 'c1');
});

test('取当前内容版本', async () => {
  const db = fakeDb([{ version: 'c3' }]);
  assert.equal(await currentContentVersion(db), 'c3');
});

test('取当前内容版本，没有行时为 null', async () => {
  const db = fakeDb([null]);
  assert.equal(await currentContentVersion(db), null);
});

test('当日计数自增后返回新值', async () => {
  const db = fakeDb([{ n: 5 }]);
  const n = await bumpContentHits(db, { subject: 'acct:1', day: '2026-08-31' });
  assert.match(db.calls[0].sql, /ON CONFLICT/);
  assert.deepEqual(db.calls[0].args, ['acct:1', '2026-08-31']);
  assert.equal(n, 5);
});

test('查当日计数，没有行时算 0', async () => {
  const db = fakeDb([null]);
  assert.equal(await countContentHits(db, { subject: 'ip:1.1.1.1', day: '2026-08-31' }), 0);
});
