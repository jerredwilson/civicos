const CACHE = 'civicos-v1'

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(['/']))
  )
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', e => {
  const { request } = e
  const url = new URL(request.url)

  // Skip non-GET and cross-origin requests (API calls go through normally)
  if (request.method !== 'GET' || url.origin !== location.origin) return

  // Navigation requests: network first, fall back to cached index.html (for offline)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    )
    return
  }

  // Static assets: stale-while-revalidate
  e.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(request).then(cached => {
        const networkFetch = fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone())
          return response
        })
        return cached ?? networkFetch
      })
    )
  )
})
