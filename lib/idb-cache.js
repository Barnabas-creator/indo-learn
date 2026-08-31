// 已取过的内容单元存本地，下次没网也能复习。
//
// 明文存，不加密：内容已经在这台设备的屏幕和内存里，再用一把同样存在这台设备上的
// 密钥加密一遍挡不住任何拿到设备的人，只是让代码变复杂。
//
// 隐私模式、存储配额满、浏览器禁了 IndexedDB —— 这些都不该让应用挂掉，
// 打不开就退化成「每次都联网取」，功能照旧，只是没有离线。
const DB_NAME = 'indo-learn';
const STORE = 'units';
const META_KEY = '__version';

export function openIdbStore(indexedDB = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDB) { reject(new Error('no indexeddb')); return; }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const db = req.result;
      const run = (mode, fn) => new Promise((res, rej) => {
        const tx = db.transaction(STORE, mode);
        const r = fn(tx.objectStore(STORE));
        tx.oncomplete = () => res(r?.result);
        tx.onerror = () => rej(tx.error);
      });
      resolve({
        get: (k) => run('readonly', (s) => s.get(k)),
        put: (k, v) => run('readwrite', (s) => s.put(v, k)),
        clear: () => run('readwrite', (s) => s.clear()),
      });
    };
  });
}

export function createUnitCache({ openDb = () => openIdbStore() } = {}) {
  let storePromise = null;
  // 打不开就记住这件事，之后所有调用直接空转，不用每次都重试一遍。
  let dead = false;

  async function store() {
    if (dead) return null;
    storePromise ??= openDb().catch(() => { dead = true; return null; });
    return storePromise;
  }

  return {
    async get(key) {
      const s = await store();
      if (!s) return undefined;
      try { return await s.get(key); } catch { return undefined; }
    },
    async put(key, value) {
      const s = await store();
      if (!s) return;
      try { await s.put(key, value); } catch { /* 配额满等：不缓存就是了 */ }
    },
    async clear() {
      const s = await store();
      if (s) { try { await s.clear(); } catch { /* 同上 */ } }
    },
    async getMeta() {
      const s = await store();
      if (!s) return undefined;
      try { return await s.get(META_KEY); } catch { return undefined; }
    },
    // 版本变了先清库再落新版本号：顺序反了会留下一批版本号对不上的旧单元。
    async setMeta(version) {
      const s = await store();
      if (!s) return;
      try {
        const old = await s.get(META_KEY);
        if (old !== version) await s.clear();
        await s.put(META_KEY, version);
      } catch { /* 同上 */ }
    },
  };
}
