import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleContentIndex, handleContentUnit } from './content.js';
import { signToken } from './crypto.js';

const SECRET = 's';

// 内存假 D1：只认这两条 SQL，够跑清单路由
function memDb({ units = [], version = 'c1', accounts = [] } = {}) {
  return {
    prepare(sql) {
      const stmt = { args: [] };
      return {
        bind(...args) { stmt.args = args; return this; },
        async first() {
          if (/FROM content_meta/.test(sql)) return { version };
          if (/FROM accounts WHERE id/.test(sql)) {
            return accounts.find((a) => a.id === stmt.args[0]) ?? null;
          }
          return null;
        },
        async all() {
          const onlyFree = /WHERE tier = \?/.test(sql);
          return { results: onlyFree ? units.filter((u) => u.tier === 'free') : units };
        },
      };
    },
  };
}

const UNITS = [
  { module: 'packs', unit_id: 'p-1', tier: 'free', title: null },
  { module: 'packs', unit_id: 'p-2', tier: 'paid', title: null },
  { module: 'dialogs', unit_id: 'sapaan', tier: 'free', title: '打招呼' },
];

const get = (token) => new Request('https://api.test/content/index', {
  headers: token ? { authorization: `Bearer ${token}` } : {},
});

test('不带 token 只给 free 单元', async () => {
  const env = { DB: memDb({ units: UNITS }), SESSION_SECRET: SECRET };
  const body = await (await handleContentIndex(get(), env, 1000)).json();
  assert.deepEqual(body.modules.packs.map((u) => u.id), ['p-1']);
  assert.equal(body.version, 'c1');
});

test('active 账号拿到全部单元', async () => {
  const accounts = [{ id: 1, status: 'active', trial_ends_at: null }];
  const env = { DB: memDb({ units: UNITS, accounts }), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const body = await (await handleContentIndex(get(token), env, 1000)).json();
  assert.deepEqual(body.modules.packs.map((u) => u.id), ['p-1', 'p-2']);
});

test('试用过期的账号退回 free 清单，不报错', async () => {
  const accounts = [{ id: 1, status: 'trial', trial_ends_at: 500 }];
  const env = { DB: memDb({ units: UNITS, accounts }), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const body = await (await handleContentIndex(get(token), env, 1000)).json();
  assert.deepEqual(body.modules.packs.map((u) => u.id), ['p-1']);
});

test('试用未过期的账号拿到全部单元', async () => {
  const accounts = [{ id: 1, status: 'trial', trial_ends_at: 2000 }];
  const env = { DB: memDb({ units: UNITS, accounts }), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const body = await (await handleContentIndex(get(token), env, 1000)).json();
  assert.deepEqual(body.modules.packs.map((u) => u.id), ['p-1', 'p-2']);
});

test('停用账号退回 free 清单，不报错', async () => {
  const accounts = [{ id: 1, status: 'disabled', trial_ends_at: null }];
  const env = { DB: memDb({ units: UNITS, accounts }), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const res = await handleContentIndex(get(token), env, 1000);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).modules.packs.map((u) => u.id), ['p-1']);
});

test('清单按模块分组，只有 id/tier/title', async () => {
  const env = { DB: memDb({ units: UNITS }), SESSION_SECRET: SECRET };
  const body = await (await handleContentIndex(get(), env, 1000)).json();
  assert.deepEqual(body.modules.dialogs, [{ id: 'sapaan', tier: 'free', title: '打招呼' }]);
});

test('清单带私有缓存头，减免费额度的请求数', async () => {
  const env = { DB: memDb({ units: UNITS }), SESSION_SECRET: SECRET };
  const res = await handleContentIndex(get(), env, 1000);
  assert.equal(res.headers.get('cache-control'), 'private, max-age=300');
});

// 内存假 D1：只认单元查询和账号查询，够跑 GET /content/:module/:id
function unitDb(rows, accounts = []) {
  return {
    prepare(sql) {
      const stmt = { args: [] };
      return {
        bind(...args) { stmt.args = args; return this; },
        async first() {
          if (/FROM content WHERE module/.test(sql)) {
            return rows.find((r) => r.module === stmt.args[0] && r.unit_id === stmt.args[1]) ?? null;
          }
          if (/FROM accounts WHERE id/.test(sql)) {
            return accounts.find((a) => a.id === stmt.args[0]) ?? null;
          }
          if (/INSERT INTO content_hits/.test(sql)) return { n: 1 };
          return null;
        },
        async all() { return { results: [] }; },
      };
    },
  };
}

const ROWS = [
  { module: 'packs', unit_id: 'p-1', tier: 'free', version: 'c1', body: '[{"w":"satu"}]' },
  { module: 'packs', unit_id: 'p-2', tier: 'paid', version: 'c1', body: '[{"w":"dua"}]' },
];

const unitReq = (path, token) => new Request(`https://api.test${path}`, {
  headers: {
    'cf-connecting-ip': '1.1.1.1',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  },
});

test('free 单元不用登录也能取', async () => {
  const env = { DB: unitDb(ROWS), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).body, [{ w: 'satu' }]);
});

test('paid 单元没 token 是 401', async () => {
  const env = { DB: unitDb(ROWS), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-2'), env, 1000);
  assert.equal(res.status, 401);
  assert.equal((await res.json()).error, 'unauthorized');
});

test('paid 单元给 active 账号', async () => {
  const accounts = [{ id: 1, status: 'active', trial_ends_at: null }];
  const env = { DB: unitDb(ROWS, accounts), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const res = await handleContentUnit(unitReq('/content/packs/p-2', token), env, 1000);
  assert.equal(res.status, 200);
});

test('试用过期取 paid 单元是 403 trial_expired', async () => {
  const accounts = [{ id: 1, status: 'trial', trial_ends_at: 500 }];
  const env = { DB: unitDb(ROWS, accounts), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const res = await handleContentUnit(unitReq('/content/packs/p-2', token), env, 1000);
  assert.equal(res.status, 403);
  assert.equal((await res.json()).error, 'trial_expired');
});

test('被停用的账号是 403 account_disabled', async () => {
  const accounts = [{ id: 1, status: 'disabled', trial_ends_at: null }];
  const env = { DB: unitDb(ROWS, accounts), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const res = await handleContentUnit(unitReq('/content/packs/p-2', token), env, 1000);
  assert.equal((await res.json()).error, 'account_disabled');
});

test('未激活账号取 paid 单元是 403 not_activated', async () => {
  const accounts = [{ id: 1, status: 'pending', trial_ends_at: null }];
  const env = { DB: unitDb(ROWS, accounts), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const res = await handleContentUnit(unitReq('/content/packs/p-2', token), env, 1000);
  assert.equal((await res.json()).error, 'not_activated');
});

test('不存在的单元是 404', async () => {
  const env = { DB: unitDb(ROWS), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/nope'), env, 1000);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

test('响应带 version，前端据此判断缓存是否过期', async () => {
  const env = { DB: unitDb(ROWS), SESSION_SECRET: SECRET };
  const body = await (await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000)).json();
  assert.equal(body.version, 'c1');
});

// module 不在六个固定模块之列（比如路径打错，或者以后有人手滑传了别的词）：
// 不查库直接 404，别把非法输入当正常参数传给 getContentUnit。
test('module 不在六个固定名单里是 404', async () => {
  const env = { DB: unitDb(ROWS), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/notamodule/p-1'), env, 1000);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});
