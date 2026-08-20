// 远程内容提供者：账号 + 激活码模式。
// 与 provider.js 同签名（init / lock / getPacks / getDialogs / getGrammar），
// 另有 register / login / activate 供新视图调用。
//
// 内容仍是 Pages 上的静态加密文件；服务器只下发内容密钥（CEK）。
// 会话与密钥存 localStorage，30 天内离线可用。
import { decryptJson, importCek } from './crypto.js';

export const REMOTE_STORAGE_KEY = 'indo-learn-session';

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

  // 拉最新密钥；联不上就沿用本地缓存（离线可用的关键）
  async function refreshKey() {
    try {
      const res = await apiFetch('/content-key', { token: session.token });
      session.cek = res.cek;
      session.contentVersion = res.contentVersion;
      session.expiresAt = res.expiresAt;
      session.status = 'active';
      cekKey = null;
      save();
    } catch {
      // 离线：本地密钥还没过期就继续用
    }
  }

  async function init() {
    session = read();
    if (!session || (session.expiresAt ?? 0) <= now()) {
      clear();
      return { unlocked: false, status: 'none' };
    }
    if (session.status === 'active') await refreshKey();
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
    return { status: session.status };
  }

  async function activate(code) {
    const res = await apiFetch('/activate', { method: 'POST', token: session.token, body: { code } });
    session.status = res.status;
    save();
    await refreshKey();
    return { status: session.status };
  }

  async function load(name) {
    if (!session?.cek) throw new Error('未解锁');
    if (cache.has(name)) return cache.get(name);
    if (!cekKey) cekKey = await importCek(session.cek);
    const manifest = await fetchJson('data/manifest.json');
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
