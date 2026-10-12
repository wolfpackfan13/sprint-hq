// SprintHQ service worker
//
// Makes the app installable and lets it open from the home screen even on a
// weak or missing connection. Scope is limited on purpose:
//   - Only same-origin GET requests inside this app's folder are handled.
//     Supabase, Google, Anthropic and font requests go straight to the
//     network, untouched and uncached.
//   - The page itself (index.html) is network-first, so every launch picks up
//     the latest deploy. The cached copy is only used when the network is
//     down or slow.
//   - Built JS/CSS files have content hashes in their names, so they are
//     cached once and served from cache after that.
//
// Cache Storage is shared by every site on wolfpackfan13.github.io, so every
// cache this file creates or deletes starts with "sprintHQ-".

const VERSION = 'v1'
const SHELL_CACHE = `sprintHQ-shell-${VERSION}`
const ASSET_CACHE = `sprintHQ-assets-${VERSION}`
const MAX_ASSETS = 40
const NAV_TIMEOUT_MS = 3500

const SCOPE = new URL(self.registration.scope)
const SHELL_URL = SCOPE.href // e.g. https://wolfpackfan13.github.io/sprint-hq/

const PRECACHE = [
  './',
  './manifest.json',
  './icon.svg',
  './icon-192.png',
  './apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, ASSET_CACHE])
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith('sprintHQ-') && !keep.has(name))
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== SCOPE.origin) return
  if (!url.pathname.startsWith(SCOPE.pathname)) return

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event))
    return
  }

  if (url.pathname.startsWith(`${SCOPE.pathname}assets/`)) {
    event.respondWith(cacheFirst(request))
    return
  }

  event.respondWith(staleWhileRevalidate(request))
})

// Network first for the app page. If the network takes too long and there is
// a cached copy, show the cached copy and let the network finish in the
// background so the next launch is current.
async function handleNavigation(event) {
  const cache = await caches.open(SHELL_CACHE)

  const network = fetch(event.request)
    .then((response) => {
      // Safari refuses a cached redirect as a page response, so only store
      // direct hits.
      if (response.ok && !response.redirected) cache.put(SHELL_URL, response.clone())
      return response
    })

  const cached = await cache.match(SHELL_URL)
  if (!cached) return network

  event.waitUntil(network.catch(() => {}))

  const timeout = new Promise((resolve) => setTimeout(() => resolve(cached), NAV_TIMEOUT_MS))
  return Promise.race([network, timeout]).catch(() => cached)
}

async function cacheFirst(request) {
  const cache = await caches.open(ASSET_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) {
    await cache.put(request, response.clone())
    trimCache(cache)
  }
  return response
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(SHELL_CACHE)
  const cached = await cache.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone())
      return response
    })
    .catch(() => cached)
  return cached || network
}

// Old builds leave hashed files behind. Keep the newest MAX_ASSETS entries.
async function trimCache(cache) {
  const keys = await cache.keys()
  const excess = keys.length - MAX_ASSETS
  for (let i = 0; i < excess; i++) await cache.delete(keys[i])
}
