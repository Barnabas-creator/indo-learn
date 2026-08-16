import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createProvider, UNLOCK_TTL_DAYS, STORAGE_KEY,
} from '../lib/provider.js';
import { buildBundle } from './pack-content.mjs';

const CONTENT = {
  packs: [{ id: 'p1', title: '数字', words: [] }],
  dialogs: [{ id: 'd1', sceneZh: '打招呼', lines: [] }],
  grammar: [{ id: 'g1', title: '词缀', lessons: [] }],
};

function makeStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, v),
    removeItem: (k) => map.delete(k),
  };
}

function routesFor(bundle, version) {
  return {
    'data/manifest.json': bundle.manifest,
    'data/keys.json': bundle.keys,
    [`data/${version}/packs.enc`]: bundle.files['packs.enc'],
    [`data/${version}/dialogs.enc`]: bundle.files['dialogs.enc'],
    [`data/${version}/grammar.enc`]: bundle.files['grammar.enc'],
  };
}

async function harness({
  password = '密码A', version = 'v1', now = () => 1_000_000,
} = {}) {
  const bundle = await buildBundle(CONTENT, password, version);
  const routes = routesFor(bundle, version);
  const storage = makeStorage();
  const provider = createProvider({
    fetchJson: async (path) => {
      if (!(path in routes)) throw new Error(`404 ${path}`);
      return routes[path];
    },
    storage,
    now,
  });
  return { provider, storage, bundle, routes };
}

test('初始状态未解锁', async () => {
  const { provider } = await harness();
  assert.deepEqual(await provider.init(), { unlocked: false });
});

test('正确密码解锁后可取内容', async () => {
  const { provider } = await harness();
  await provider.init();
  await provider.unlock('密码A');
  assert.deepEqual(await provider.getPacks(), CONTENT.packs);
  assert.deepEqual(await provider.getDialogs(), CONTENT.dialogs);
  assert.deepEqual(await provider.getGrammar(), CONTENT.grammar);
});

test('错误密码抛出「密码不正确」', async () => {
  const { provider } = await harness();
  await provider.init();
  await assert.rejects(() => provider.unlock('错误'), /密码不正确/);
});

test('解锁后写入带有效期的凭据', async () => {
  const { provider, storage } = await harness({ now: () => 1_000_000 });
  await provider.init();
  await provider.unlock('密码A');
  const saved = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(saved.contentVersion, 'v1');
  assert.equal(saved.expiresAt, 1_000_000 + UNLOCK_TTL_DAYS * 86400_000);
  assert.ok(saved.cek);
});

test('凭据未过期时再次 init 直接解锁', async () => {
  let t = 1_000_000;
  const { provider, storage, routes } = await harness({ now: () => t });
  await provider.init();
  await provider.unlock('密码A');
  const saved = storage.getItem(STORAGE_KEY);

  t += 86400_000;
  const p2 = createProvider({
    fetchJson: async (path) => routes[path],
    storage: { getItem: () => saved, setItem: () => {}, removeItem: () => {} },
    now: () => t,
  });
  assert.deepEqual(await p2.init(), { unlocked: true });
  assert.deepEqual(await p2.getPacks(), CONTENT.packs);
});

test('凭据过期后回到未解锁', async () => {
  let t = 1_000_000;
  const { provider, storage, routes } = await harness({ now: () => t });
  await provider.init();
  await provider.unlock('密码A');
  const saved = storage.getItem(STORAGE_KEY);

  t += (UNLOCK_TTL_DAYS + 1) * 86400_000;
  const p2 = createProvider({
    fetchJson: async (path) => routes[path],
    storage: { getItem: () => saved, setItem: () => {}, removeItem: () => {} },
    now: () => t,
  });
  assert.deepEqual(await p2.init(), { unlocked: false });
});

test('内容版本变化时旧凭据失效', async () => {
  const t = 1_000_000;
  const { provider, storage } = await harness({ now: () => t });
  await provider.init();
  await provider.unlock('密码A');
  const saved = storage.getItem(STORAGE_KEY);

  const v2 = await buildBundle(CONTENT, '密码B', 'v2');
  const p2 = createProvider({
    fetchJson: async (path) => routesFor(v2, 'v2')[path],
    storage: { getItem: () => saved, setItem: () => {}, removeItem: () => {} },
    now: () => t,
  });
  assert.deepEqual(await p2.init(), { unlocked: false });
});

test('lock 后无法再取内容', async () => {
  const { provider } = await harness();
  await provider.init();
  await provider.unlock('密码A');
  provider.lock();
  await assert.rejects(() => provider.getPacks(), /未解锁/);
});
