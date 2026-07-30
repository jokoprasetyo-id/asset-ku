const CACHE_NAME = 'neraca-cache-v1';
const urlsToCache = [
  './index.html',
  './manifest.json'
];

// Install Event
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event - Stale-While-Revalidate strategy for HTML, Network First for others if needed
self.addEventListener('fetch', event => {
  // Hanya proses request GET (jangan cache POST ke Firebase)
  if (event.request.method !== 'GET') return;

  // Lewati caching untuk API Firebase dan Firestore
  if (event.request.url.includes('firestore.googleapis.com') || event.request.url.includes('identitytoolkit.googleapis.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          // Tetap lakukan fetch ke network untuk mengupdate cache di background
          const fetchRequest = event.request.clone();
          fetch(fetchRequest).then(
            networkResponse => {
              if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                return;
              }
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, networkResponse.clone());
                });
            }
          ).catch(() => {});
          
          return response;
        }

        // Tidak ada di cache, ambil dari network
        return fetch(event.request).then(
          networkResponse => {
            // Check jika request valid
            if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        );
      })
  );
});
