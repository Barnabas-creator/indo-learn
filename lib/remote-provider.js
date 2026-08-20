// 远程内容提供者：账号 + 激活码模式。
// 与 provider.js 同签名（init / lock / getPacks / getDialogs / getGrammar），
// 另有 register / login / activate 供新视图调用。
//
// 内容仍是 Pages 上的静态加密文件；服务器只下发内容密钥（CEK）。
// 会话与密钥存 localStorage，30 天内离线可用。
import { decryptJson, importCek } from './crypto.js';

export const REMOTE_STORAGE_KEY = 'indo-learn-session';

// 服务器明确拒绝的错误码：账号被吊销 / 令牌失效 / 未激活，必须清会话强制重新登录。
// 其余错误（服务器自身故障 no_content_key/server_error、网络不通）不清会话——
// 离线可用是核心设计，不能被服务器一时故障或断网打断。
const REVOKE_ERRORS = new Set(['unauthorized', 'account_disabled', 'not_activated']);

export function createRemoteProvider({ fetchJson, apiFetch, storage, now = () => Date.now() }) {
  let session = null; // { token, status, cek, contentVersion, expiresAt }
  let cekKey = null; // 导入后的 CryptoKey
  const cache = new Map();

  function save() {
    storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify(session));
  }

  function clear() {
    session = null;
    cekKey = null;
    cache.clear();
    storage.removeItem(REMOTE_STORAGE_KEY);
  }

  function read() {
    const raw = storage.getItem(REMOTE_STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  // 拉最新密钥；服务器明确拒绝（吊销/未激活/令牌失效）才清会话，
  // 网络不通或服务器自身故障（no_content_key/server_error）沿用本地缓存密钥继续可用。
  async function refreshKey() {
    try {
      const res = await apiFetch('/content-key', { token: session.token });
      session.cek = res.cek;
      session.contentVersion = res.contentVersion;
      session.expiresAt = res.expiresAt;
      session.status = 'active';
      cekKey = null;
      cache.clear(); // 密钥/版本变了，内存里的旧明文不能继续用
      save();
    } catch (err) {
      if (REVOKE_ERRORS.has(err?.message)) {
        clear();
      }
      // 否则视为网络故障或服务器自身问题：保留本地缓存密钥，继续离线可用
    }
  }

  async function init() {
    session = read();
    if (!session || (session.expiresAt ?? 0) <= now()) {
      clear();
      return { unlocked: false, status: 'none' };
    }
    if (session.status === 'active') await refreshKey();
    if (!session) return { unlocked: false, status: 'none' }; // 刷新时被吊销
    const unlocked = session.status === 'active' && Boolean(session.cek);
    return { unlocked, status: session.status };
  }

  async function register(email, password) {
    return apiFetch('/register', { method: 'POST', body: { email, password } });
  }

  async function login(email, password) {
    const res = await apiFetch('/login', { method: 'POST', body: { email, password } });
    session = {
      token: res.token,
      status: res.status,
      cek: null,
      contentVersion: null,
      expiresAt: now() + 30 * 86400_000,
    };
    save();
    if (res.status === 'active') await refreshKey();
    return { status: session ? session.status : 'none' };
  }

  async function activate(code) {
    const res = await apiFetch('/activate', { method: 'POST', token: session.token, body: { code } });
    session.status = res.status;
    save();
    await refreshKey();
    return { status: session ? session.status : 'none' };
  }

  async function load(name) {
    if (!session?.cek) throw new Error('未解锁');
    if (cache.has(name)) return cache.get(name);

    const manifest = await fetchJson('data/manifest.json');
    if (manifest.contentVersion !== session.contentVersion) {
      // 内容已升级但本地密钥还是旧版本：先刷新，避免用旧 CEK 解新密文
      await refreshKey();
      if (!session) throw new Error('未解锁'); // 刷新时被吊销
      if (manifest.contentVersion !== session.contentVersion) {
        // 刷新后版本仍对不上（比如离线拿不到新密钥）：明确报「内容已过期」，
        // 而不是让调用方收到一个难懂的解密失败
        throw new Error('content_outdated');
      }
    }
    if (!cekKey) cekKey = await importCek(session.cek);
    const payload = await fetchJson(`data/${manifest.contentVersion}/${name}.enc`);
    const value = await decryptJson(payload.data, payload.iv, cekKey);
    cache.set(name, value);
    return value;
  }

  return {
    init,
    register,
    login,
    activate,
    lock: clear,
    getPacks: () => load('packs'),
    getDialogs: () => load('dialogs'),
    getGrammar: () => load('grammar'),
  };
}
