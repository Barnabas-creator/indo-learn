import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleContentIndex } from './content.js';
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
