import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  handleContentIndex, handleContentUnit, ACCOUNT_DAILY_LIMIT, ANON_DAILY_LIMIT, dayKey,
} from './content.js';
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
  { module: 'packs', unit_id: 'p-1', tier: 'free', title: null, meta: null },
  { module: 'packs', unit_id: 'p-2', tier: 'paid', title: null, meta: null },
  {
    module: 'dialogs', unit_id: 'sapaan', tier: 'free', title: '打招呼', meta: '{"scene":"greeting","rounds":2}',
  },
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

test('清单按模块分组，字段是 id/tier/title/meta', async () => {
  const env = { DB: memDb({ units: UNITS }), SESSION_SECRET: SECRET };
  const body = await (await handleContentIndex(get(), env, 1000)).json();
  assert.deepEqual(body.modules.dialogs, [{
    id: 'sapaan', tier: 'free', title: '打招呼', meta: { scene: 'greeting', rounds: 2 },
  }]);
});

// 10.5A：meta 存的是 JSON 字符串，路由层要解析成对象才能直接喂给前端。
test('meta 是 JSON 字符串时解析成对象', async () => {
  const env = { DB: memDb({ units: UNITS }), SESSION_SECRET: SECRET };
  const body = await (await handleContentIndex(get(), env, 1000)).json();
  const dialog = body.modules.dialogs.find((u) => u.id === 'sapaan');
  assert.deepEqual(dialog.meta, { scene: 'greeting', rounds: 2 });
});

test('meta 为 null 的单元返回 null', async () => {
  const env = { DB: memDb({ units: UNITS }), SESSION_SECRET: SECRET };
  const body = await (await handleContentIndex(get(), env, 1000)).json();
  const p1 = body.modules.packs.find((u) => u.id === 'p-1');
  assert.equal(p1.meta, null);
});

// meta 是坏 JSON（比如库里手改坏了、或者某次推送写入时出了岔子）不该把整个清单
// 请求打挂——只坏这一条单元的 meta，其余单元照常返回。
test('meta 是坏 JSON 时该单元的 meta 为 null，不抛错、不影响其它单元', async () => {
  const badUnits = [
    ...UNITS,
    { module: 'grammar', unit_id: 'phonetic', tier: 'free', title: '发音篇', meta: '{not json' },
  ];
  const env = { DB: memDb({ units: badUnits }), SESSION_SECRET: SECRET };
  const res = await handleContentIndex(get(), env, 1000);
  assert.equal(res.status, 200);
  const body = await res.json();
  const grammar = body.modules.grammar.find((u) => u.id === 'phonetic');
  assert.equal(grammar.meta, null);
  // 坏的那一条不连累别的单元
  const p1 = body.modules.packs.find((u) => u.id === 'p-1');
  assert.equal(p1.meta, null);
  const dialog = body.modules.dialogs.find((u) => u.id === 'sapaan');
  assert.deepEqual(dialog.meta, { scene: 'greeting', rounds: 2 });
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

// 固定位置解构 [, , module, unitId] 对第 4 段来者不拒——第 4 段被静默丢弃，
// /content/packs/p-1/extra 会被当成合法的 /content/packs/p-1 处理，返回 200。
// 段数校验（必须恰好 3 段）堵住这个口子。
test('路径带多余的尾部分段是 404，不会被当成合法单元请求', async () => {
  const env = { DB: unitDb(ROWS), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-1/extra'), env, 1000);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

// 段数校验顺带统一了空段路径的处理：以前这两种是靠「解构越界恰好是 undefined」
// 撞对 404，现在要靠 filter(Boolean) 之后段数不等于 3 来撞对，确认没有跑偏。
test('module 段缺失（/content/packs/）是 404', async () => {
  const env = { DB: unitDb(ROWS), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/'), env, 1000);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

test('module 段是空段（/content//p-1）是 404', async () => {
  const env = { DB: unitDb(ROWS), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content//p-1'), env, 1000);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error, 'not_found');
});

// 限流：内存假 D1，counter 模拟当天已有的计数，可选 log 记录每次写入
// content_hits / error_log 的实参，用来断言 subject 前缀和超限落库这两件事。
function countingDb(rows, accounts = [], counter = { n: 0 }, log = { hits: [], errors: [] }) {
  return {
    counter,
    log,
    prepare(sql) {
      const stmt = { args: [] };
      return {
        bind(...args) { stmt.args = args; return this; },
        async first() {
          if (/INSERT INTO content_hits/.test(sql)) {
            counter.n += 1;
            log.hits.push(stmt.args);
            return { n: counter.n };
          }
          if (/FROM content WHERE module/.test(sql)) {
            return rows.find((r) => r.module === stmt.args[0] && r.unit_id === stmt.args[1]) ?? null;
          }
          if (/FROM accounts WHERE id/.test(sql)) {
            return accounts.find((a) => a.id === stmt.args[0]) ?? null;
          }
          return null;
        },
        async run() {
          if (/INSERT INTO error_log/.test(sql)) log.errors.push(stmt.args);
          return { meta: {} };
        },
        async all() { return { results: [] }; },
      };
    },
  };
}

test('日期键按 UTC 取到天', () => {
  assert.equal(dayKey(Date.UTC(2026, 7, 31, 23, 59)), '2026-08-31');
});

test('匿名超过上限返回 429', async () => {
  const counter = { n: ANON_DAILY_LIMIT }; // 下一次就是第 61 次
  const env = { DB: countingDb(ROWS, [], counter), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.equal(res.status, 429);
  assert.equal((await res.json()).error, 'rate_limited');
});

test('匿名第 60 次仍然放行', async () => {
  const counter = { n: ANON_DAILY_LIMIT - 2 };
  const env = { DB: countingDb(ROWS, [], counter), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.equal(res.status, 200);
});

// 上限边界要卡到「恰好」，不能只在附近估算：下一次正好是第 60 次时必须放行，
// 再下一次（第 61 次）才该被拦。
test('恰好命中上限（第 60 次）放行', async () => {
  const counter = { n: ANON_DAILY_LIMIT - 1 };
  const env = { DB: countingDb(ROWS, [], counter), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.equal(res.status, 200);
  assert.equal(counter.n, ANON_DAILY_LIMIT);
});

test('超出上限恰好一次（第 61 次）就是 429', async () => {
  const counter = { n: ANON_DAILY_LIMIT };
  const env = { DB: countingDb(ROWS, [], counter), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.equal(res.status, 429);
  assert.equal(counter.n, ANON_DAILY_LIMIT + 1);
});

test('账号上限比匿名宽', async () => {
  assert.ok(ACCOUNT_DAILY_LIMIT > ANON_DAILY_LIMIT);
  const accounts = [{ id: 1, status: 'active', trial_ends_at: null }];
  const counter = { n: ANON_DAILY_LIMIT + 10 };
  const env = { DB: countingDb(ROWS, accounts, counter), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const res = await handleContentUnit(unitReq('/content/packs/p-2', token), env, 1000);
  assert.equal(res.status, 200);
});

// 计数主体要能分清「谁在扒」：匿名按 IP 前缀，登录账号按账号前缀，
// 不能让带 token 的请求悄悄并进 IP 那一档、或反过来把匿名算进别人的账号额度。
test('匿名请求按 ip: 前缀计数，不是按账号', async () => {
  const counter = { n: 0 };
  const log = { hits: [], errors: [] };
  const env = { DB: countingDb(ROWS, [], counter, log), SESSION_SECRET: SECRET };
  await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.equal(log.hits.length, 1);
  assert.equal(log.hits[0][0], 'ip:1.1.1.1');
  assert.equal(log.hits[0][1], dayKey(1000));
});

test('登录账号请求按 acct: 前缀计数，不按 IP', async () => {
  const accounts = [{ id: 1, status: 'active', trial_ends_at: null }];
  const counter = { n: 0 };
  const log = { hits: [], errors: [] };
  const env = { DB: countingDb(ROWS, accounts, counter, log), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  await handleContentUnit(unitReq('/content/packs/p-2', token), env, 1000);
  assert.equal(log.hits[0][0], 'acct:1');
});

// free 单元本不需要登录，但带了有效 token 的请求应该并入账号额度而不是 IP
// 额度——这正是 requireAccount 要在判定之前统一调用一次的原因。
test('free 单元带有效 token 也按账号计数', async () => {
  const accounts = [{ id: 1, status: 'active', trial_ends_at: null }];
  const counter = { n: 0 };
  const log = { hits: [], errors: [] };
  const env = { DB: countingDb(ROWS, accounts, counter, log), SESSION_SECRET: SECRET };
  const token = await signToken(1, SECRET, 1000);
  const res = await handleContentUnit(unitReq('/content/packs/p-1', token), env, 1000);
  assert.equal(res.status, 200);
  assert.equal(log.hits[0][0], 'acct:1');
});

// 超限那一刻要落 error_log，不然「谁在扒」这件事在生产环境里就无从查起。
test('超限时把 subject 写进 error_log', async () => {
  const counter = { n: ANON_DAILY_LIMIT };
  const log = { hits: [], errors: [] };
  const env = { DB: countingDb(ROWS, [], counter, log), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.equal(res.status, 429);
  assert.equal(log.errors.length, 1);
  const [ts, method, path, name, message] = log.errors[0];
  assert.equal(ts, 1000);
  assert.equal(method, 'GET');
  assert.equal(path, '/content/packs/p-1');
  assert.equal(name, 'rate_limited');
  assert.equal(message, 'ip:1.1.1.1');
});

// 放行的请求不该往 error_log 里写垃圾。
test('未超限时不写 error_log', async () => {
  const counter = { n: 0 };
  const log = { hits: [], errors: [] };
  const env = { DB: countingDb(ROWS, [], counter, log), SESSION_SECRET: SECRET };
  await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.deepEqual(log.errors, []);
});

// brief 明确要求：计数放在「取到单元、判完权限」之后——不存在的单元不该
// 消耗额度，否则谁都能靠猜错单元名把别人的计数刷爆。
test('不存在的单元不消耗计数额度', async () => {
  const counter = { n: 0 };
  const log = { hits: [], errors: [] };
  const env = { DB: countingDb(ROWS, [], counter, log), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/nope'), env, 1000);
  assert.equal(res.status, 404);
  assert.equal(counter.n, 0);
  assert.deepEqual(log.hits, []);
});

// 没权限（没登录取 paid 单元）同理，也不该消耗额度——那是没看到内容的请求。
test('没权限被拒的请求不消耗计数额度', async () => {
  const counter = { n: 0 };
  const log = { hits: [], errors: [] };
  const env = { DB: countingDb(ROWS, [], counter, log), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-2'), env, 1000);
  assert.equal(res.status, 401);
  assert.equal(counter.n, 0);
  assert.deepEqual(log.hits, []);
});

// 计数写失败要 fail open：D1 抖动不该把一次本该放行的正常请求变成用户可见的
// 500——bumpContentHits 抛异常时，请求仍要拿到 200 和正确的正文。
function throwingHitsDb(rows, accounts = []) {
  return {
    prepare(sql) {
      const stmt = { args: [] };
      return {
        bind(...args) { stmt.args = args; return this; },
        async first() {
          if (/INSERT INTO content_hits/.test(sql)) throw new Error('D1 write failed');
          if (/FROM content WHERE module/.test(sql)) {
            return rows.find((r) => r.module === stmt.args[0] && r.unit_id === stmt.args[1]) ?? null;
          }
          if (/FROM accounts WHERE id/.test(sql)) {
            return accounts.find((a) => a.id === stmt.args[0]) ?? null;
          }
          return null;
        },
        async run() { return { meta: {} }; },
        async all() { return { results: [] }; },
      };
    },
  };
}

test('计数写失败时 fail open：请求仍返回 200 和正确正文', async () => {
  const env = { DB: throwingHitsDb(ROWS), SESSION_SECRET: SECRET };
  const res = await handleContentUnit(unitReq('/content/packs/p-1'), env, 1000);
  assert.equal(res.status, 200);
  assert.deepEqual((await res.json()).body, [{ w: 'satu' }]);
});

