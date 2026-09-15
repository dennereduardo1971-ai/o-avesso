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

const VERSAO = 'dev';
const CACHE_NAME = `afinado-${VERSAO}`;
const CACHE_FONTES = 'afinado-fontes';

const ARQUIVOS_BASICOS = [
  './',
  // INICIO-LISTA
  './app.js',
  './assets/icone.svg',
  './audio/fala.js',
  './audio/motor.js',
  './audio/notas.js',
  './audio/sintese.js',
  './audio/yin-worklet.js',
  './audio/yin.js',
  './dados/banco.js',
  './index.html',
  './manifest.json',
  './styles/estilo.css',
  './telas/afinador.js',
  './telas/diagnostico.js',
  './telas/inicio.js',
  './telas/resumo.js',
  './telas/treino.js',
  './treino/exercicios/afinacao.js',
  './treino/perfil.js',
  './treino/tolerancia.js',
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
  // sem skipWaiting: a versão nova espera a pessoa recarregar, pra que uma
  // sessão em andamento nunca troque de versão embaixo de quem está cantando
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
