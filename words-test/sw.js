// 英语单词测试 - PWA Service Worker
// 策略：仅缓存 App 壳（index.html + index.global.js + 图标），采用 stale-while-revalidate
// 更新时递增 CACHE_VERSION，activate 阶段清理旧版本

const CACHE_VERSION = 'v1'
const CACHE_NAME = `app-shell-${CACHE_VERSION}`

const APP_SHELL = [
    './',
    './index.html',
    './index.global.js',
    './manifest.webmanifest',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-512-maskable.png',
]

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
    )
})

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
            .then(() => self.clients.claim())
    )
})

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return
    const url = new URL(event.request.url)
    if (url.origin !== self.location.origin) return

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const fetched = fetch(event.request)
                .then((response) => {
                    if (response && response.ok) {
                        const clone = response.clone()
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
                    }
                    return response
                })
                .catch(() => cached)
            return cached || fetched
        })
    )
})
