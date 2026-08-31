import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServerProvider, normalizeEmail, trialDaysLeft } from '../lib/server-provider.js';

function memStorage() {
  const m = new Map();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) };
}

function memCache() {
  const m = new Map();
  let version;
  return {
    m,
    async get(k) { return m.get(k); },
    async put(k, v) { m.set(k, v); },
    async clear() { m.clear(); },
    async getMeta() { return version; },
    async setMeta(v) { if (version !== v) m.clear(); version = v; },
  };
}

// apiFetch 假实现：记录调用，按路径给预设响应
function fakeApi(routes) {
  const calls = [];
  return {
    calls,
    fetch: async (path, opts) => {
      calls.push({ path, opts });
      const r = routes[path];
      if (typeof r === 'function') return r();
      if (r === undefined) throw new Error('not_found');
      return r;
    },
  };
}

const INDEX = { version: 'c1', modules: { packs: [{ id: 'p-1', tier: 'free', title: null }] } };

test('第一次取单元走网络并写缓存', async () => {
  const api = fakeApi({ '/content/index': INDEX, '/content/packs/p-1': { version: 'c1', body: [1] } });
  const cache = memCache();
  const p = createServerProvider({ apiFetch: api.fetch, storage: memStorage(), cache });
  await p.getIndex();
  assert.deepEqual(await p.getUnit('packs', 'p-1'), [1]);
  assert.deepEqual(await cache.get('packs/p-1'), [1]);
});

test('第二次取同一单元不再发请求', async () => {
  const api = fakeApi({ '/content/index': INDEX, '/content/packs/p-1': { version: 'c1', body: [1] } });
  const cache = memCache();
  const p = createServerProvider({ apiFetch: api.fetch, storage: memStorage(), cache });
  await p.getIndex();
  await p.getUnit('packs', 'p-1');
  const before = api.calls.length;
  await p.getUnit('packs', 'p-1');
  assert.equal(api.calls.length, before);
});

test('内容版本变了，旧缓存作废', async () => {
  const cache = memCache();
  const api1 = fakeApi({ '/content/index': INDEX, '/content/packs/p-1': { version: 'c1', body: [1] } });
  const p1 = createServerProvider({ apiFetch: api1.fetch, storage: memStorage(), cache });
  await p1.getIndex();
  await p1.getUnit('packs', 'p-1');

  const api2 = fakeApi({
    '/content/index': { ...INDEX, version: 'c2' },
    '/content/packs/p-1': { version: 'c2', body: [2] },
  });
  const p2 = createServerProvider({ apiFetch: api2.fetch, storage: memStorage(), cache });
  await p2.getIndex();
  assert.deepEqual(await p2.getUnit('packs', 'p-1'), [2]);
});

test('没网但缓存里有：照常返回', async () => {
  const cache = memCache();
  const api1 = fakeApi({ '/content/index': INDEX, '/content/packs/p-1': { version: 'c1', body: [1] } });
  const p1 = createServerProvider({ apiFetch: api1.fetch, storage: memStorage(), cache });
  await p1.getIndex();
  await p1.getUnit('packs', 'p-1');

  const offline = { fetch: async () => { throw new Error('Failed to fetch'); } };
  const p2 = createServerProvider({ apiFetch: offline.fetch, storage: memStorage(), cache });
  assert.deepEqual(await p2.getUnit('packs', 'p-1'), [1]);
});

test('没网且没缓存：抛 offline_uncached', async () => {
  const offline = { fetch: async () => { throw new Error('Failed to fetch'); } };
  const p = createServerProvider({ apiFetch: offline.fetch, storage: memStorage(), cache: memCache() });
  await assert.rejects(() => p.getUnit('packs', 'p-9'), /offline_uncached/);
});

test('清单也进缓存，没网时用缓存的清单', async () => {
  const cache = memCache();
  const api = fakeApi({ '/content/index': INDEX });
  const p1 = createServerProvider({ apiFetch: api.fetch, storage: memStorage(), cache });
  await p1.getIndex();
  const offline = { fetch: async () => { throw new Error('Failed to fetch'); } };
  const p2 = createServerProvider({ apiFetch: offline.fetch, storage: memStorage(), cache });
  assert.deepEqual((await p2.getIndex()).modules.packs[0].id, 'p-1');
});

test('401 清会话，网络故障不清', async () => {
  const storage = memStorage();
  storage.setItem('indo-learn-session', JSON.stringify({
    token: 't', status: 'active', expiresAt: 9e15, email: 'a@b.com',
  }));
  const api = fakeApi({ '/content/packs/p-2': () => { throw new Error('unauthorized'); } });
  const p = createServerProvider({ apiFetch: api.fetch, storage, cache: memCache() });
  await p.init();
  await assert.rejects(() => p.getUnit('packs', 'p-2'));
  assert.equal(storage.getItem('indo-learn-session'), null);

  storage.setItem('indo-learn-session', JSON.stringify({
    token: 't', status: 'active', expiresAt: 9e15, email: 'a@b.com',
  }));
  const offline = { fetch: async () => { throw new Error('Failed to fetch'); } };
  const p2 = createServerProvider({ apiFetch: offline.fetch, storage, cache: memCache() });
  await p2.init();
  await assert.rejects(() => p2.getUnit('packs', 'p-2'), /offline_uncached/);
  assert.ok(storage.getItem('indo-learn-session'));
});

test('rate_limited 原样抛给调用方，会话不动', async () => {
  const storage = memStorage();
  storage.setItem('indo-learn-session', JSON.stringify({
    token: 't', status: 'active', expiresAt: 9e15, email: 'a@b.com',
  }));
  const api = fakeApi({ '/content/packs/p-2': () => { throw new Error('rate_limited'); } });
  const p = createServerProvider({ apiFetch: api.fetch, storage, cache: memCache() });
  await p.init();
  await assert.rejects(() => p.getUnit('packs', 'p-2'), /rate_limited/);
  assert.ok(storage.getItem('indo-learn-session'));
});

// ---- 以下是 brief 8 条之外，为堵审查漏洞补的测试 ----

test('getIndex 遇 401：也清会话（不止 getUnit）', async () => {
  const storage = memStorage();
  storage.setItem('indo-learn-session', JSON.stringify({
    token: 't', status: 'active', expiresAt: 9e15, email: 'a@b.com',
  }));
  // 没有预先缓存过清单，401 无兜底可用，原样抛出
  const api = fakeApi({ '/content/index': () => { throw new Error('unauthorized'); } });
  const p = createServerProvider({ apiFetch: api.fetch, storage, cache: memCache() });
  await p.init();
  await assert.rejects(() => p.getIndex(), /unauthorized/);
  assert.equal(storage.getItem('indo-learn-session'), null);
});

test('getUnit 遇 not_found：原样抛出，不能被吞成 offline_uncached', async () => {
  // 路由表里没配这条路径，fakeApi 对未知路径直接抛 not_found —— 模拟服务端明确说「没这个单元」
  const api = fakeApi({});
  const p = createServerProvider({ apiFetch: api.fetch, storage: memStorage(), cache: memCache() });
  await assert.rejects(() => p.getUnit('packs', 'p-404'), /not_found/);
});

test('直接取单元（没先调用 getIndex）：setMeta 要先于 put，否则清库会连带删掉刚取到的值', async () => {
  const cache = memCache();
  const api = fakeApi({ '/content/packs/p-1': { version: 'c1', body: [1] } });
  const p = createServerProvider({ apiFetch: api.fetch, storage: memStorage(), cache });
  const body = await p.getUnit('packs', 'p-1');
  assert.deepEqual(body, [1]);
  // 缓存版本从 undefined 变成 c1 会触发 setMeta 内部清库；若实现里 put 在 setMeta 之前，
  // 刚写入的值会被这次清库连带删掉，下面这个断言就会失败
  assert.deepEqual(await cache.get('packs/p-1'), [1]);
});

test('init 时会话已过期：本地直接判定清会话，不发网络请求', async () => {
  const storage = memStorage();
  storage.setItem('indo-learn-session', JSON.stringify({
    token: 't', status: 'active', expiresAt: 1, email: 'a@b.com', // 早已过期
  }));
  const api = { called: false, fetch: async () => { api.called = true; throw new Error('不该被调用'); } };
  const p = createServerProvider({ apiFetch: api.fetch, storage, cache: memCache() });
  const result = await p.init();
  assert.equal(result.unlocked, false);
  assert.equal(storage.getItem('indo-learn-session'), null);
  assert.equal(api.called, false); // 内容不再靠密钥刷新解锁，init 不该联网
});

test('init 时试用会话过期：lastRevokeReason 报 trial_expired，好让 UI 区分普通登录过期', async () => {
  const storage = memStorage();
  storage.setItem('indo-learn-session', JSON.stringify({
    token: 't', status: 'trial', expiresAt: 1, email: 'a@b.com',
  }));
  const p = createServerProvider({ apiFetch: async () => { throw new Error('不该被调用'); }, storage, cache: memCache() });
  await p.init();
  assert.equal(p.lastRevokeReason(), 'trial_expired');
});

test('normalizeEmail、trialDaysLeft 原样搬自 remote-provider，行为不变', () => {
  assert.equal(normalizeEmail('  A@B.COM '), 'a@b.com');
  const now = Date.now();
  assert.equal(trialDaysLeft(now + 86400_000 * 2, now), 2);
  assert.equal(trialDaysLeft(now - 1000, now), 0);
  assert.equal(trialDaysLeft(null), 0);
});
