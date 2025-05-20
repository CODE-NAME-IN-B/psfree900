const CACHE_NAME = 'boharon-cache-v2';
const STATIC_CACHE = 'static-cache-v2';
const DYNAMIC_CACHE = 'dynamic-cache-v2';

// قائمة الملفات الأساسية التي يجب تخزينها
const STATIC_ASSETS = [
    '/',
    '/index.html',
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
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-solid-900.woff2',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/webfonts/fa-brands-400.woff2'
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
            // السيطرة على جميع الصفحات المفتوحة
            clients.claim()
        ])
    );
});

// استراتيجية التخزين المؤقت: Cache First with Network Fallback
self.addEventListener('fetch', event => {
    // تجاهل طلبات POST
    if (event.request.method !== 'GET') return;

    // تجاهل طلبات التحليلات
    if (event.request.url.includes('analytics')) return;

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                if (cachedResponse) {
                    // إرجاع النسخة المخزنة مؤقتاً
                    return cachedResponse;
                }

                // إذا لم تكن هناك نسخة مخزنة، قم بالاتصال بالشبكة
                return fetch(event.request)
                    .then(response => {
                        // نسخ الاستجابة للتخزين المؤقت
                        const responseClone = response.clone();
                        
                        // تخزين الاستجابة في التخزين المؤقت الديناميكي
                        caches.open(DYNAMIC_CACHE)
                            .then(cache => {
                                cache.put(event.request, responseClone);
                            });

                        return response;
                    })
                    .catch(() => {
                        // إذا كان الطلب هو صفحة HTML، قم بإرجاع الصفحة الرئيسية المخزنة مؤقتاً
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                        
                        // إرجاع صورة بديلة للصور المفقودة
                        if (event.request.headers.get('accept').includes('image')) {
                            return caches.match('/img/logo.png');
                        }

                        // إرجاع استجابة افتراضية للطلبات الأخرى
                        return new Response('Offline content not available', {
                            status: 503,
                            statusText: 'Service Unavailable',
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