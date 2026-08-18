// 缓存策略是密码轮换能否生效的关键：
// manifest.json / keys.json 必须 network-first，否则用户的 PWA 会一直
// 用着旧的加密包和旧的 keys，换了密码也没有感觉。
// data/<version>/*.enc 的 URL 带版本号，内容不可变，cache-first 安全。

const CACHE = 'indo-learn-v6';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.webmanifest',
  './lib/crypto.js',
  './lib/provider.js',
  './lib/tts.js',
  './lib/icons.js',
  './lib/emoji-map.js',
  './lib/catalog.js',
  './lib/views/home.js',
  './lib/views/unlock.js',
  './lib/views/packs.js',
  './lib/views/dialogs.js',
  './lib/views/grammar.js',
];

export function chooseStrategy(pathname) {
  if (/\/data\/(manifest|keys)\.json$/.test(pathname)) return 'network-first';
  return 'cache-first';
}

async function cacheFirst(request) {
  const hit = await caches.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res.ok) (await caches.open(CACHE)).put(request, res.clone());
    return res;
  } catch {
    const hit = await caches.match(request);
    if (hit) return hit;
    throw new Error('离线且无缓存');
  }
}

if (typeof self !== 'undefined' && typeof self.addEventListener === 'function') {
  self.addEventListener('install', (e) => {
    e.waitUntil(
      caches
        .open(CACHE)
        .then((c) => c.addAll(SHELL))
        .then(() => self.skipWaiting()),
    );
  });

  self.addEventListener('activate', (e) => {
    e.waitUntil(
      caches
        .keys()
        .then((keys) =>
          Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
        )
        .then(() => self.clients.claim()),
    );
  });

  self.addEventListener('fetch', (e) => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);
    if (url.origin !== self.location.origin) return;
    const strategy = chooseStrategy(url.pathname);
    e.respondWith(
      strategy === 'network-first' ? networkFirst(e.request) : cacheFirst(e.request),
    );
  });
}
