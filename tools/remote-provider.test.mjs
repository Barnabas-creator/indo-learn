import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRemoteProvider, REMOTE_STORAGE_KEY, normalizeEmail } from '../lib/remote-provider.js';
import { generateCek, exportCek, encryptJson } from '../lib/crypto.js';

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
  assert.deepEqual(await p.init(), { unlocked: false, status: 'none', email: null });
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
  assert.deepEqual(await p2.init(), { unlocked: false, status: 'pending', email: 'a@b.com' });
});

// --- 以下为审查追加：暂存激活码要按邮箱校验，靠 init()/login() 记住的 email ---

test('login 之后 init 返回的 email 与登录用的邮箱一致', async () => {
  const storage = memStorage();
  const api = fakeApi({ '/login': { token: 'T', status: 'pending' } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  await p.login('someone@example.com', 'rahasia123');
  const p2 = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  const { email } = await p2.init();
  assert.equal(email, 'someone@example.com');
});

test('normalizeEmail 去首尾空格并转小写，跟服务端归一化规则一致', () => {
  assert.equal(normalizeEmail('  Bob@Test.com '), 'bob@test.com');
  assert.equal(normalizeEmail('a@b.com'), 'a@b.com');
});

test('登录邮箱带大小写和首尾空格，init 返回归一化后的邮箱', async () => {
  const storage = memStorage();
  const api = fakeApi({ '/login': { token: 'T', status: 'pending' } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  await p.login('  Bob@Test.com ', 'rahasia123');
  const p2 = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  const { email } = await p2.init();
  assert.equal(email, 'bob@test.com');
});

test('会话被清后 init 返回的 email 为 null', async () => {
  const storage = memStorage();
  const api = fakeApi({ '/login': { token: 'T', status: 'active' } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  await p.login('someone@example.com', 'rahasia123');
  p.lock();
  const p2 = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  const { email } = await p2.init();
  assert.equal(email, null);
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
  assert.deepEqual(await p.init(), { unlocked: false, status: 'none', email: null });
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
  assert.deepEqual(await p.init(), { unlocked: true, status: 'active', email: null });
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

// --- 以下为审查追加：区分「服务器明确拒绝」与「网络/服务器故障」 ---

test('服务器返回 account_disabled 时，init 清掉会话', async () => {
  const storage = memStorage();
  storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({
    token: 'T', status: 'active', cek: 'KUNCI', contentVersion: 'v5',
    expiresAt: Date.now() + 86400000,
  }));
  const api = fakeApi({ '/content-key': () => { throw new Error('account_disabled'); } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  assert.deepEqual(await p.init(), { unlocked: false, status: 'none', email: null });
  assert.equal(storage.getItem(REMOTE_STORAGE_KEY), null);
});

test('服务器返回 unauthorized 时，init 清掉会话', async () => {
  const storage = memStorage();
  storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({
    token: 'T', status: 'active', cek: 'KUNCI', contentVersion: 'v5',
    expiresAt: Date.now() + 86400000,
  }));
  const api = fakeApi({ '/content-key': () => { throw new Error('unauthorized'); } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  assert.deepEqual(await p.init(), { unlocked: false, status: 'none', email: null });
  assert.equal(storage.getItem(REMOTE_STORAGE_KEY), null);
});

test('服务器返回 no_content_key（服务器自己的问题）时不清会话，仍可用', async () => {
  const storage = memStorage();
  storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({
    token: 'T', status: 'active', cek: 'KUNCI', contentVersion: 'v5',
    expiresAt: Date.now() + 86400000,
  }));
  const api = fakeApi({ '/content-key': () => { throw new Error('no_content_key'); } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  assert.deepEqual(await p.init(), { unlocked: true, status: 'active', email: null });
  assert.ok(storage.getItem(REMOTE_STORAGE_KEY));
});

test('网络异常（TypeError，fetch 自己的错误）时不清会话，仍可用', async () => {
  const storage = memStorage();
  storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({
    token: 'T', status: 'active', cek: 'KUNCI', contentVersion: 'v5',
    expiresAt: Date.now() + 86400000,
  }));
  const api = fakeApi({ '/content-key': () => { throw new TypeError('Failed to fetch'); } });
  const p = createRemoteProvider({
    fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage,
  });
  assert.deepEqual(await p.init(), { unlocked: true, status: 'active', email: null });
  assert.ok(storage.getItem(REMOTE_STORAGE_KEY));
});

test('内容版本比会话新时，load 会自动刷新密钥再解密', async () => {
  const cek1 = await generateCek();
  const cek2 = await generateCek();
  const cek1B64 = await exportCek(cek1);
  const cek2B64 = await exportCek(cek2);
  const packsV2 = { p2: [{ word: 'dua' }] };
  const cipherV2 = await encryptJson(packsV2, cek2);

  let keyCallCount = 0;
  const contentKeyResponses = [
    { cek: cek1B64, contentVersion: 'v1', expiresAt: Date.now() + 86400000 },
    { cek: cek2B64, contentVersion: 'v2', expiresAt: Date.now() + 86400000 },
  ];
  const api = fakeApi({
    '/login': { token: 'T', status: 'active' },
    '/content-key': () => contentKeyResponses[Math.min(keyCallCount++, contentKeyResponses.length - 1)],
  });

  let version = 'v1'; // manifest 报告的版本，稍后模拟内容升级
  const fetchJson = async (path) => {
    if (path.endsWith('manifest.json')) return { contentVersion: version };
    if (path === 'data/v2/packs.enc') return cipherV2;
    throw new Error(`unexpected ${path}`);
  };
  const p = createRemoteProvider({ fetchJson, apiFetch: api.apiFetch, storage: memStorage() });

  await p.login('a@b.com', 'rahasia123'); // 内部 refreshKey，会话落在 v1

  version = 'v2'; // Pages 上内容已经升级，但会话密钥还是 v1
  const packs = await p.getPacks();
  assert.deepEqual(packs, packsV2);

  const keyCalls = api.calls.filter((c) => c.path === '/content-key');
  assert.equal(keyCalls.length, 2); // login 时一次，load 发现版本不一致又刷新一次
});

test('刷新密钥后清空内存缓存，同一名字重新解密而不是吐旧值', async () => {
  const cek1 = await generateCek();
  const cek2 = await generateCek();
  const cek1B64 = await exportCek(cek1);
  const cek2B64 = await exportCek(cek2);
  const packsV1 = { p1: [{ word: 'satu' }] };
  const packsV2 = { p2: [{ word: 'dua' }] };
  const cipherV1 = await encryptJson(packsV1, cek1);
  const cipherV2 = await encryptJson(packsV2, cek2);

  let keyCallCount = 0;
  const contentKeyResponses = [
    { cek: cek1B64, contentVersion: 'v1', expiresAt: Date.now() + 86400000 },
    { cek: cek2B64, contentVersion: 'v2', expiresAt: Date.now() + 86400000 },
  ];
  const api = fakeApi({
    '/login': { token: 'T', status: 'active' },
    '/activate': { ok: true, status: 'active' },
    '/content-key': () => contentKeyResponses[Math.min(keyCallCount++, contentKeyResponses.length - 1)],
  });

  let version = 'v1';
  const fetchJson = async (path) => {
    if (path.endsWith('manifest.json')) return { contentVersion: version };
    if (path === `data/${version}/packs.enc`) return version === 'v1' ? cipherV1 : cipherV2;
    throw new Error(`unexpected ${path}`);
  };
  const p = createRemoteProvider({ fetchJson, apiFetch: api.apiFetch, storage: memStorage() });

  await p.login('a@b.com', 'rahasia123'); // 会话落在 v1
  const first = await p.getPacks();
  assert.deepEqual(first, packsV1); // 缓存了 v1 的明文

  await p.activate('ABCD-EFGH-JKMN-PQRS'); // 再刷新一次密钥（v2），应清空内存缓存
  version = 'v2';
  const second = await p.getPacks();
  assert.deepEqual(second, packsV2); // 不是 first 时缓存的 v1 内容
});

// --- 卖码模式：request-code（重新申请激活码） ---

test('requestCode 带上登录令牌调 POST /request-code', async () => {
  const api = fakeApi({
    '/login': { token: 'T', status: 'pending' },
    '/request-code': (options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.token, 'T');
      return { ok: true };
    },
  });
  const p = createRemoteProvider({ fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage: memStorage() });
  await p.login('a@b.com', 'rahasia123');
  const out = await p.requestCode();
  assert.deepEqual(out, { ok: true });
  assert.equal(api.calls.at(-1).path, '/request-code');
});

test('register 的返回值把 codeIssued 透传给调用方（卖码模式没有明文码）', async () => {
  const api = fakeApi({ '/register': { ok: true, accountId: 1, codeIssued: true } });
  const p = createRemoteProvider({ fetchJson: fakeFetchJson(), apiFetch: api.apiFetch, storage: memStorage() });
  const out = await p.register('a@b.com', 'rahasia123');
  assert.equal(out.codeIssued, true);
  assert.equal(out.code, undefined);
});
