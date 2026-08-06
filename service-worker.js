const CACHE_NAME = 'o-avesso-v15';
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
  './pages/moradores.html',
  './pages/conta.html',
  './pages/icons/icon-192.png',
  './pages/icons/icon-512.png',
  './scripts/db.js',
  './scripts/util.js',
  './scripts/regras.js',
  './scripts/lugares.js',
  './scripts/elenco.js',
  './scripts/visitantes.js',
  './scripts/pulso.js',
  './scripts/diario-store.js',
  './scripts/avisos.js',
  './scripts/atmosfera.js',
  './scripts/session.js',
  './scripts/hub.js',
  './scripts/manual.js',
  './scripts/ficha.js',
  './scripts/dado.js',
  './scripts/caderno-mestre.js',
  './scripts/quadro-de-linhas.js',
  './scripts/mapa.js',
  './scripts/moradores.js',
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
  './styles/moradores.css',
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

// ---------------------------------------------------------------------------
// Avisos (Web Push).
//
// Chega aqui quando o mestre publica o entre-sessões e aperta "avisar a mesa".
// Nada dispara sozinho: quem envia é a função avisar-mesa, e só a pedido dele.
// ---------------------------------------------------------------------------

self.addEventListener('push', (event) => {
  let recado = {};
  try {
    recado = event.data ? event.data.json() : {};
  } catch (e) {
    recado = { texto: event.data ? event.data.text() : '' };
  }

  const destino = new URL(recado.url || './pages/diario.html', self.registration.scope).href;

  event.waitUntil(
    self.registration.showNotification(recado.titulo || 'O Avesso', {
      body: recado.texto || 'Alguma coisa mudou do outro lado do espelho.',
      icon: './pages/icons/icon-192.png',
      badge: './pages/icons/icon-192.png',
      // uma tag só: dois avisos seguidos substituem um ao outro em vez de
      // empilhar seis notificações iguais na tela de quem estava fora
      tag: 'avesso-entre-sessoes',
      data: { url: destino }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = (event.notification.data && event.notification.data.url)
    || new URL('./pages/diario.html', self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      // se o app já está aberto em algum lugar, leva aquela janela pro Diário
      for (const janela of janelas) {
        if ('focus' in janela) {
          if ('navigate' in janela) janela.navigate(destino).catch(() => {});
          return janela.focus();
        }
      }
      return self.clients.openWindow(destino);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // nada de banco no cache: login e dados sempre vão na fonte
  if (event.request.url.includes('supabase.co')) return;
  if (event.request.method !== 'GET') return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('./pages/index.html'))
    );
    return;
  }

  // Entrega o que está guardado na hora (abre rápido e funciona offline),
  // mas busca a versão nova por trás e atualiza o cache pra próxima vez.
  //
  // Antes isto era só cache: quem esquecia de subir o CACHE_NAME ficava preso
  // na versão antiga pra sempre, sem jeito de sair a não ser limpando o site
  // na mão. Assim o esquecimento custa um carregamento, não uma eternidade.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const rede = fetch(event.request)
          .then((resposta) => {
            if (resposta && resposta.ok && resposta.type === 'basic') {
              cache.put(event.request, resposta.clone());
            }
            return resposta;
          })
          .catch(() => cached);
        return cached || rede;
      })
    )
  );
});
