// 缓存策略决定「发新版本后手机上能不能真的看到新版本」：
//
// - 外壳（index.html / app.js / lib/**.js / styles.css / manifest）走 network-first。
//   这类文件的 URL 不带版本号、内容会变，如果 cache-first，装过 PWA 的手机会一直
//   吃旧代码——2026-08 安卓上「注册后不给 7 天试用、强制要激活码」就是这么来的：
//   前端早就发了试用版，但 CACHE 名没跟着改，手机上跑的还是账号+激活码那版 app.js。
//   network-first 之后，只要联得上网就一定拿新代码，断网才回落缓存，离线可用不受影响。
// - data/manifest.json / data/keys.json 同理走 network-first：密码轮换靠它们生效。
// - data/<version>/*.enc 与 assets/** 的内容不可变（.enc 的 URL 自带版本号），
//   cache-first 安全，也是离线体积的大头，不该每次都走网络。
//
// CACHE 名仍然要在外壳文件增删时改（addAll 的清单变了），但即使忘了改，
// network-first 也不会再把用户钉死在旧版本上。

const CACHE = 'indo-learn-v22';

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
  './lib/word-svg.js',
  './lib/catalog.js',
  './lib/nav.js',
  './lib/views/home.js',
  './lib/views/unlock.js',
  './lib/views/guide.js',
  './lib/views/packs.js',
  './lib/views/dialogs.js',
  './lib/views/grammar.js',
  './lib/views/course.js',
  './lib/views/roots.js',
  './lib/views/listening.js',
  './lib/views/pager.js',
  './lib/version.js',
  './lib/content-modules.js',
  './lib/config.js',
  './lib/remote-provider.js',
  './lib/views/auth.js',
];

// 不可变资源：URL 变了内容才会变，可以放心 cache-first。
const IMMUTABLE = /\/(?:data\/v\d+\/[^/]+\.enc|assets\/.+)$/;

export function chooseStrategy(pathname) {
  if (/\/data\/(manifest|keys)\.json$/.test(pathname)) return 'network-first';
  if (IMMUTABLE.test(pathname)) return 'cache-first';
  return 'network-first';
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
