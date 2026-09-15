// Cache offline do app "Afinado". A CI carimba VERSAO com o hash do commit
// a cada publicação, então cada deploy vira um cache novo sozinho.
const VERSAO = 'dev';
const CACHE_NAME = `afinado-${VERSAO}`;

const ARQUIVOS_BASICOS = [
  './',
  './index.html',
  './manifest.json',
  './styles/estilo.css',
  './scripts/app.js',
  './scripts/pitch.js',
  './assets/icone.svg',
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ARQUIVOS_BASICOS))
  );
  // sem skipWaiting: a versão nova espera a pessoa mandar recarregar
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((chave) => chave !== CACHE_NAME).map((chave) => caches.delete(chave)))
    )
  );
});

self.addEventListener('fetch', (evento) => {
  if (evento.request.method !== 'GET') return;
  evento.respondWith(
    caches.match(evento.request).then((resposta) => resposta || fetch(evento.request))
  );
});
