const CACHE_NAME = 'boharon-cache-v3';
const STATIC_CACHE = 'static-cache-v3';
const DYNAMIC_CACHE = 'dynamic-cache-v3';

// قائمة الملفات الأساسية المهمة فقط
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/js/remote-logger.js',
    '/js/payload-manager.js',
    '/js/ui.js',
    '/payload.js',
    '/alert.mjs',
    '/img/logo.png',
    '/manifest.json'
];

// تثبيت Service Worker وتخزين الملفات الأساسية
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(cache => {
                console.log('تخزين الملفات الأساسية');
                return cache.addAll(STATIC_ASSETS);
            })
    );
    self.skipWaiting();
});

// تفعيل Service Worker وتنظيف التخزين المؤقت القديم
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE) {
                            console.log('حذف التخزين المؤقت القديم:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            clients.claim()
        ])
    );
});

// استراتيجية التخزين المؤقت: Cache First
self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('analytics')) return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    return cachedResponse;
                }

                return fetch(event.request)
                    .then(response => {
                        if (!response || response.status !== 200) {
                            return response;
                        }

                        const responseClone = response.clone();
                        caches.open(STATIC_CACHE)
                            .then(cache => {
                                cache.put(event.request, responseClone);
                            });

                        return response;
                    })
                    .catch(() => {
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        if (event.request.headers.get('accept').includes('image')) {
                            return caches.match('/img/logo.png');
                        }
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Offline',
                            headers: new Headers({
                                'Content-Type': 'text/plain'
                            })
                        });
                    });
            })
    );
});

// تحديث التخزين المؤقت في الخلفية
self.addEventListener('sync', event => {
    if (event.tag === 'update-cache') {
        event.waitUntil(
            caches.open(STATIC_CACHE)
                .then(cache => {
                    return cache.addAll(STATIC_ASSETS);
                })
        );
    }
});

// معالجة الأخطاء
self.addEventListener('error', event => {
    console.error('Service Worker Error:', event.error);
}); 