const CACHE_NAME = 'o-avesso-v11';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './pages/index.html',
  './pages/manifest.json',
  './pages/manual.html',
  './pages/ficha.html',
  './pages/dado.html',
  './pages/diario.html',
  './pages/quadro-de-linhas.html',
  './pages/gerador-npcs.html',
  './pages/caderno-mestre.html',
  './pages/mapa.html',
  './pages/conta.html',
  './pages/icons/icon-192.png',
  './pages/icons/icon-512.png',
  './scripts/db.js',
  './scripts/util.js',
  './scripts/atmosfera.js',
  './scripts/session.js',
  './scripts/hub.js',
  './scripts/manual.js',
  './scripts/ficha.js',
  './scripts/dado.js',
  './scripts/caderno-mestre.js',
  './scripts/quadro-de-linhas.js',
  './scripts/mapa.js',
  './scripts/gerador-npcs.js',
  './scripts/diario.js',
  './scripts/conta.js',
  './styles/shared.css',
  './styles/hub.css',
  './styles/manual.css',
  './styles/ficha.css',
  './styles/dado.css',
  './styles/caderno-mestre.css',
  './styles/quadro-de-linhas.css',
  './styles/mapa.css',
  './styles/gerador-npcs.css',
  './styles/diario.css',
  './styles/conta.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // nada de banco no cache: login e dados sempre vão na fonte
  if (event.request.url.includes('supabase.co')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./pages/index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
