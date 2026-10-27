/* Only this app's static shell is cached. Drafts stay in a separate IndexedDB. */
'use strict';
const RECORDER_CACHE = 'suilian-shell-v4';
const RECORDER_FILES = ['index.html', 'style.css', 'core.js', 'recommendation-layout.js', 'storage.js', 'app.js', 'manifest.webmanifest', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
const RECORDER_BASE = new URL('./', self.location.href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(RECORDER_CACHE).then(cache => cache.addAll(RECORDER_FILES.map(file => new Request(new URL(file, RECORDER_BASE).href, {cache: 'reload'})))).then(async () => {
    // Migrate versions without an update button. Activation does not reload their open pages.
    const keys = await caches.keys();
    if (keys.some(key => /^suilian-shell-v[123]$/.test(key))) await self.skipWaiting();
  }));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('suilian-shell-') && key !== RECORDER_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== RECORDER_BASE.origin || !url.pathname.startsWith(RECORDER_BASE.pathname)) return;
  const relative = url.pathname.slice(RECORDER_BASE.pathname.length) || 'index.html';
  if (!RECORDER_FILES.includes(relative)) return;
  const key = new URL(relative, RECORDER_BASE).href;
  event.respondWith(caches.open(RECORDER_CACHE).then(cache => cache.match(key)).then(response => response || Response.error()));
});
