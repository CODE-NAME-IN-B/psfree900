const CACHE_NAME = 'boharon-cache-v2';
const STATIC_CACHE = 'static-cache-v2';
const DYNAMIC_CACHE = 'dynamic-cache-v2';

// قائمة الملفات الأساسية التي يجب تخزينها
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/css/styles.css',
    '/js/remote-logger.js',
    '/js/payload-manager.js',
    '/js/ui.js',
    '/payload.js',
    '/alert.mjs',
    '/img/logo.png',
    '/img/cover.jpg',
    '/fonts/Cairo-Regular.ttf',
    '/fonts/LiberationMono-Regular.ttf',
    '/manifest.json',
    '/sw.js',
    '/config.mjs',
    '/lapse.mjs',
    '/psfree.mjs',
    '/send.mjs',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css'
];

// تثبيت Service Worker وتخزين الملفات الأساسية
self.addEventListener('install', event => {
    event.waitUntil(
        Promise.all([
            // تخزين الملفات الأساسية
            caches.open(STATIC_CACHE)
                .then(cache => {
                    console.log('تخزين الملفات الأساسية');
                    return cache.addAll(STATIC_ASSETS);
                }),
            // تخزين الملفات الديناميكية
            caches.open(DYNAMIC_CACHE)
                .then(cache => {
                    console.log('تهيئة التخزين المؤقت الديناميكي');
                    return cache;
                })
        ])
    );
    // تفعيل Service Worker فوراً
    self.skipWaiting();
});

// تفعيل Service Worker وتنظيف التخزين المؤقت القديم
self.addEventListener('activate', event => {
    event.waitUntil(
        Promise.all([
            // تنظيف التخزين المؤقت القديم
            caches.keys().then(cacheNames => {
                return Promise.all(
                    cacheNames.map(cacheName => {
                        if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
                            console.log('حذف التخزين المؤقت القديم:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            }),
            // السيطرة على جميع التبويبات المفتوحة
            clients.claim()
        ])
    );
});

// استراتيجية التخزين المؤقت: Cache First for Static Assets, Network First for Dynamic Content
self.addEventListener('fetch', event => {
    // تجاهل طلبات POST
    if (event.request.method !== 'GET') return;

    // تجاهل طلبات التحليلات
    if (event.request.url.includes('analytics')) return;

    // التحقق مما إذا كان الطلب هو ملف ثابت
    const isStaticAsset = STATIC_ASSETS.some(asset => 
        event.request.url.endsWith(asset) || 
        event.request.url.includes(asset)
    );

    if (isStaticAsset) {
        // استراتيجية Cache First للملفات الثابتة
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request)
                        .then(response => {
                            if (!response || response.status !== 200 || response.type !== 'basic') {
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
                            // إرجاع صفحة بديلة في حالة الفشل
                            if (event.request.headers.get('accept').includes('text/html')) {
                                return caches.match('/index.html');
                            }
                        });
                })
        );
    } else {
        // استراتيجية Network First للمحتوى الديناميكي
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (!response || response.status !== 200 || response.type !== 'basic') {
                        return response;
                    }
                    const responseClone = response.clone();
                    caches.open(DYNAMIC_CACHE)
                        .then(cache => {
                            cache.put(event.request, responseClone);
                        });
                    return response;
                })
                .catch(() => {
                    return caches.match(event.request)
                        .then(cachedResponse => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            
                            // إذا كان الطلب هو صفحة HTML، قم بإرجاع الصفحة الرئيسية المخزنة مؤقتاً
                            if (event.request.headers.get('accept').includes('text/html')) {
                                return caches.match('/index.html');
                            }
                            
                            // إرجاع صورة بديلة للصور المفقودة
                            if (event.request.headers.get('accept').includes('image')) {
                                return caches.match('/img/logo.png');
                            }
                        });
                })
        );
    }
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