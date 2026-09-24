// 木箱依頼システム：見るだけオフライン用サービスワーカー
// 書き込み（依頼・発注など）のオフライン保留は行わない。
// 各ページ（HTML）と最低限の静的ファイルだけを端末に保存し、
// 電波が無い時は直前に取得できた画面をそのまま表示する。

const CACHE_NAME = 'kizabako-shell-v5';
const PRECACHE_URLS = [
  './home.html',
  './formB_size.html',
  './work_calendar.html',
  './request_calendar.html',
  './stock_view.html',
  './mypage.html',
  './business_days_admin.html',
  './reception_log.html',
  './shikumi_form.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const isHtmlRequest = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHtmlRequest) {
    // ページ本体はネット優先。端末側の通常キャッシュも経由させず、常に最新を取りに行く
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./home.html')))
    );
    return;
  }

  // アイコン等はキャッシュ優先
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || '木箱依頼システム';
  const options = {
    body: data.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    data: { url: data.url || './home.html' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || './home.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.includes(targetUrl.replace('./', '')));
      if (existing) return existing.focus();
      return self.clients.openWindow(targetUrl);
    })
  );
});
