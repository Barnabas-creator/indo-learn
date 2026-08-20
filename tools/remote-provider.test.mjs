import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteProvider, REMOTE_STORAGE_KEY } from '../lib/remote-provider.js';

function memStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  };
}

// 假接口：按路径返回预设结果，记录调用
function fakeApi(responses) {
  const calls = [];
  return {
    calls,
    async apiFetch(path, options = {}) {
      calls.push({ path, options });
      const r = responses[path];
      if (typeof r === 'function') return r(options);
      if (!r) throw new Error('no_response');
      return r;
    },
  };
}

const CONTENT = { packs: { p1: [{ word: 'satu' }] }, dialogs: [], grammar: [] };

// 静态加密文件的假 fetch：直接返回明文，跳过解密（解密在 provider 里另测）
function fakeFetchJson() {
  return async (path) => {
    if (path.endsWith('manifest.json')) return { contentVersion: 'v5' };
    throw new Error(`unexpected ${path}`);
  };
}

test('没登录时 init 返回未解锁', async () => {
  const api = fakeApi({});
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage: memStorage(),
  });
  assert.deepEqual(await p.init(), { unlocked: false, status: 'none' });
});

test('注册把邮箱密码发到 /register 并返回激活码', async () => {
  const api = fakeApi({ '/register': { ok: true, code: 'ABCD-EFGH-JKMN-PQRS' } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage: memStorage(),
  });
  const out = await p.register('a@b.com', 'rahasia123');
  assert.equal(out.code, 'ABCD-EFGH-JKMN-PQRS');
  assert.equal(api.calls[0].path, '/register');
});

test('登录存下令牌，init 之后认得状态', async () => {
  const storage = memStorage();
  const api = fakeApi({
    '/login': { token: 'T', status: 'pending' },
  });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  await p.login('a@b.com', 'rahasia123');
  assert.ok(storage.getItem(REMOTE_STORAGE_KEY));
  const p2 = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  assert.deepEqual(await p2.init(), { unlocked: false, status: 'pending' });
});

test('激活成功后状态变 active 且拿到内容密钥', async () => {
  const storage = memStorage();
  const api = fakeApi({
    '/login': { token: 'T', status: 'pending' },
    '/activate': { ok: true, status: 'active' },
    '/content-key': { cek: 'KUNCI', contentVersion: 'v5', expiresAt: Date.now() + 1000 },
  });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  await p.login('a@b.com', 'rahasia123');
  await p.activate('ABCD-EFGH-JKMN-PQRS');
  const saved = JSON.parse(storage.getItem(REMOTE_STORAGE_KEY));
  assert.equal(saved.status, 'active');
  assert.equal(saved.cek, 'KUNCI');
});

test('令牌过期后 init 清掉会话', async () => {
  const storage = memStorage();
  storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({
    token: 'T', status: 'active', cek: 'KUNCI', contentVersion: 'v5', expiresAt: 1,
  }));
  const api = fakeApi({});
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage, now: () => 999999,
  });
  assert.deepEqual(await p.init(), { unlocked: false, status: 'none' });
  assert.equal(storage.getItem(REMOTE_STORAGE_KEY), null);
});

test('离线时（接口抛错）用本地缓存的密钥继续可用', async () => {
  const storage = memStorage();
  storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({
    token: 'T', status: 'active', cek: 'KUNCI', contentVersion: 'v5',
    expiresAt: Date.now() + 86400000,
  }));
  const api = fakeApi({ '/content-key': () => { throw new Error('offline'); } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  assert.deepEqual(await p.init(), { unlocked: true, status: 'active' });
});

test('lock 清掉会话', async () => {
  const storage = memStorage();
  const api = fakeApi({ '/login': { token: 'T', status: 'active' } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  await p.login('a@b.com', 'rahasia123');
  p.lock();
  assert.equal(storage.getItem(REMOTE_STORAGE_KEY), null);
});
