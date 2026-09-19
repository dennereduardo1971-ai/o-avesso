// Cache offline do Afinado.
//
// DUAS COISAS AQUI SÃO CARIMBADAS PELA CI, E NENHUMA DELAS DEVE SER EDITADA
// À MÃO (ver .github/workflows/publicar.yml e ferramentas/listar-arquivos.sh):
//
//   1. VERSAO recebe o hash do commit, então cada publicação vira um cache novo
//      sozinha. Numerar isso na mão já deixou o app preso numa versão antiga
//      sem ninguém perceber.
//   2. ARQUIVOS_BASICOS é gerado a partir do que existe no repositório. Essa
//      lista era manual e essa era a armadilha mais cara do projeto: um
//      arquivo novo que ninguém lembrasse de listar não quebrava nada em
//      desenvolvimento — quebrava só offline, só no celular de quem já tinha
//      o app instalado, e sem nenhuma mensagem de erro. Com o app dividido em
//      dezenas de módulos, esquecer virou questão de tempo. Então a lista
//      passou a ser derivada, não lembrada.
//
// Pra atualizar a lista localmente: ./ferramentas/listar-arquivos.sh

const VERSAO = 'b231fa5';
const CACHE_NAME = `afinado-${VERSAO}`;
const CACHE_FONTES = 'afinado-fontes';

const ARQUIVOS_BASICOS = [
  './',
  // INICIO-LISTA
  './app.js',
  './assets/icone-180.png',
  './assets/icone-192.png',
  './assets/icone-512.png',
  './assets/icone.svg',
  './audio/dispositivo.js',
  './audio/fala.js',
  './audio/motor.js',
  './audio/notas.js',
  './audio/sintese.js',
  './audio/timbre.js',
  './audio/yin-worklet.js',
  './audio/yin.js',
  './dados/banco.js',
  './index.html',
  './manifest.json',
  './styles/estilo.css',
  './telas/afinador.js',
  './telas/aquecimento.js',
  './telas/checkin.js',
  './telas/deriva.js',
  './telas/diagnostico.js',
  './telas/inicio.js',
  './telas/resumo.js',
  './telas/tom.js',
  './telas/treino.js',
  './treino/aquecimento.js',
  './treino/checkin.js',
  './treino/deriva.js',
  './treino/exercicios/afinacao.js',
  './treino/guia.js',
  './treino/perfil.js',
  './treino/retorno.js',
  './treino/sessao.js',
  './treino/tolerancia.js',
  './treino/tom.js',
  './treino/vibrato.js',
  './treino/voz.js',
  './ui/painel-exercicio.js',
  './ui/rolagem.js',
  './ui/roteador.js',
  './ui/semmaos.js',
  // FIM-LISTA
];

// Os domínios das fontes. Elas não entram na lista de cima porque não estão no
// repositório — são guardadas na primeira visita com rede e reaproveitadas
// depois. Sem isso o app funciona offline mesmo assim, mas com as fontes do
// sistema no lugar das escolhidas.
const DOMINIOS_DE_FONTE = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll é tudo-ou-nada de propósito: se um arquivo da lista não existe,
      // é melhor a instalação falhar e a versão antiga continuar valendo do
      // que instalar um app que só quebra quando a rede sumir.
      cache.addAll(ARQUIVOS_BASICOS).catch((erro) => {
        console.error('[afinado] cache incompleto, instalação abortada:', erro);
        throw erro;
      })
    )
  );
  // sem skipWaiting aqui: a versão nova fica esperando. Quem decide a troca é
  // a pessoa, tocando no aviso de versão nova (ver app.js) — assim uma sessão
  // em andamento nunca troca de versão embaixo de quem está cantando.
  //
  // E não dá pra contar com "recarregar": com o app instalado, recarregar não
  // solta a versão velha — ela só sai quando todas as janelas do app fecham, o
  // que no celular quase nunca acontece. Sem o aviso, o app ficava semanas
  // numa versão antiga sem ninguém saber.
});

self.addEventListener('message', (evento) => {
  if (evento.data === 'assumir') self.skipWaiting();
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((chaves) =>
        Promise.all(
          chaves
            .filter((chave) => chave !== CACHE_NAME && chave !== CACHE_FONTES)
            .map((chave) => caches.delete(chave))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request;
  if (pedido.method !== 'GET') return;

  const url = new URL(pedido.url);

  if (DOMINIOS_DE_FONTE.includes(url.hostname)) {
    evento.respondWith(fonteDoCacheOuDaRede(pedido));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Em desenvolvimento (VERSAO ainda 'dev', sem o carimbo da CI) a rede vem
  // primeiro: cache primeiro servia o arquivo de antes da última edição e
  // fazia bug corrigido parecer bug vivo. O cache continua sendo preenchido,
  // então o teste offline local segue funcionando.
  if (VERSAO === 'dev') {
    evento.respondWith(
      fetch(pedido)
        .then((resposta) => {
          if (resposta && resposta.ok) {
            const copia = resposta.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(pedido, copia));
          }
          return resposta;
        })
        .catch(() =>
          caches.match(pedido).then((resposta) =>
            resposta || (pedido.mode === 'navigate' ? caches.match('./index.html') : Response.error())
          )
        )
    );
    return;
  }

  evento.respondWith(
    caches.match(pedido).then((resposta) => {
      if (resposta) return resposta;
      return fetch(pedido).catch(() => {
        // Recarregar numa rota qualquer (#/treino) sem rede tem que abrir o
        // app, não a tela de dinossauro.
        if (pedido.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      });
    })
  );
});

async function fonteDoCacheOuDaRede(pedido) {
  const cache = await caches.open(CACHE_FONTES);
  const guardada = await cache.match(pedido);
  if (guardada) return guardada;
  try {
    const resposta = await fetch(pedido);
    // opaque (type 'opaque') também serve: dá pra guardar e reusar, só não dá
    // pra inspecionar
    if (resposta && (resposta.ok || resposta.type === 'opaque')) {
      cache.put(pedido, resposta.clone());
    }
    return resposta;
  } catch {
    return Response.error();
  }
}
