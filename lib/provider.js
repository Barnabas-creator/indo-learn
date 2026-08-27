// 内容访问接口。今天只有静态加密实现；将来上服务器时新增 RemoteProvider，
// 保持同样的方法签名，UI 层不改动。
//
// 明文只保留在内存（闭包变量），绝不写入任何持久化存储 ——
// 一旦落盘，密码轮换即失去意义。
import {
  deriveKek, unwrapCek, decryptJson, exportCek, importCek,
} from './crypto.js';

export const UNLOCK_TTL_DAYS = 30;
export const STORAGE_KEY = 'indo-learn-unlock';

const DAY_MS = 86400_000;

export function createProvider({ fetchJson, storage, now = () => Date.now() }) {
  let manifest = null;
  let keys = null;
  let cek = null;
  const cache = new Map(); // 内存明文缓存，随页面关闭消失

  function saveCredential(cekB64) {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        cek: cekB64,
        contentVersion: manifest.contentVersion,
        keysVersion: keys.version,
        expiresAt: now() + UNLOCK_TTL_DAYS * DAY_MS,
      }),
    );
  }

  function readCredential() {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function init() {
    manifest = await fetchJson('data/manifest.json');
    keys = await fetchJson('data/keys.json');

    const saved = readCredential();
    const valid =
      saved &&
      saved.expiresAt > now() &&
      saved.contentVersion === manifest.contentVersion &&
      saved.keysVersion === keys.version;

    if (!valid) {
      storage.removeItem(STORAGE_KEY);
      cek = null;
      cache.clear();
      return { unlocked: false };
    }

    cek = await importCek(saved.cek);
    return { unlocked: true };
  }

  async function unlock(password) {
    const kek = await deriveKek(password, keys.kdf.salt, keys.kdf.iterations);
    try {
      cek = await unwrapCek(keys.wrapped, keys.iv, kek);
    } catch {
      throw new Error('密码不正确');
    }
    saveCredential(await exportCek(cek));
  }

  async function load(name) {
    if (!cek) throw new Error('未解锁');
    if (cache.has(name)) return cache.get(name);
    const payload = await fetchJson(
      `data/${manifest.contentVersion}/${name}.enc`,
    );
    let value;
    try {
      value = await decryptJson(payload.data, payload.iv, cek);
    } catch {
      // 密钥/密文真对不上（不是网络问题）：调用方（app.js）据此判断要不要清凭据。
      throw new Error('content_decrypt_failed');
    }
    cache.set(name, value);
    return value;
  }

  function lock() {
    cek = null;
    cache.clear();
    storage.removeItem(STORAGE_KEY);
  }

  return {
    init,
    unlock,
    lock,
    getPacks: () => load('packs'),
    getDialogs: () => load('dialogs'),
    getGrammar: () => load('grammar'),
    getCourse: () => load('course'),
  };
}
