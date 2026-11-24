/* 诗词背诵 Service Worker
 * 策略：
 *  - install 预缓存应用外壳（html/css/js/json/manifest/图标/字体css）
 *  - 其余同源 GET 请求（图片/字体分片）走 stale-while-revalidate 动态缓存
 *  - 导航请求 network-first，离线回退缓存页
 *  - 版本号变更时 activate 清旧缓存
 */
const VERSION = 'v1.0.8';
const CACHE = 'poetry-recite-' + VERSION;
const PRECACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data/poems.json',
  './manifest.webmanifest',
  './fonts/lxgwwenkaiscreen.css',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // 页面导航：网络优先，离线回退缓存
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 其余资源：SWR——缓存秒回，后台刷新
  e.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
