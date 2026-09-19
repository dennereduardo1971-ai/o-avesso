// A entrada do app: liga o roteador, registra o service worker, e sai da
// frente. Toda a lógica mora nos módulos.

import { criarRoteador } from './ui/roteador.js';
import * as inicio from './telas/inicio.js';
import * as diagnostico from './telas/diagnostico.js';
import * as treino from './telas/treino.js';
import * as resumo from './telas/resumo.js';
import * as afinador from './telas/afinador.js';
import * as aquecimento from './telas/aquecimento.js';
import * as checkin from './telas/checkin.js';
import * as tom from './telas/tom.js';
import * as deriva from './telas/deriva.js';

const raiz = document.getElementById('tela');

const roteador = criarRoteador({
  raiz,
  padrao: '#/',
  rotas: {
    '/': inicio.montar,
    '/teste': diagnostico.montar,
    '/treino': treino.montar,
    '/resumo': resumo.montar,
    '/afinador': afinador.montar,
    '/aquecimento': aquecimento.montar,
    '/checkin': checkin.montar,
    '/tom': tom.montar,
    '/deriva': deriva.montar,
  },
});

roteador.iniciar();

// Pedir armazenamento persistente: sem isso o navegador pode apagar o
// IndexedDB (perfil, histórico, check-ins) quando falta espaço. Não pergunta
// nada à pessoa — o navegador decide sozinho, e dizer não é inofensivo.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persisted()
    .then((jaE) => jaE || navigator.storage.persist())
    .catch(() => {});
}

// --- versão nova ---------------------------------------------------------
//
// A versão nova se instala calada e fica esperando. Este aviso é o único
// jeito de ela entrar: a pessoa toca, a versão nova assume, a página recarrega.
// Nunca sozinho — trocar de versão no meio de uma sessão perde a sessão.

function avisarVersaoNova(registro) {
  if (document.getElementById('aviso-versao')) return;
  const aviso = document.createElement('button');
  aviso.id = 'aviso-versao';
  aviso.className = 'aviso-versao';
  aviso.type = 'button';
  aviso.textContent = 'Tem uma versão nova do Afinado — tocar para atualizar';
  aviso.addEventListener('click', () => {
    aviso.disabled = true;
    aviso.textContent = 'Atualizando…';
    if (registro.waiting) registro.waiting.postMessage('assumir');
  });
  document.body.prepend(aviso);
}

if ('serviceWorker' in navigator) {
  let recarregando = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Só recarrega se foi a pessoa que pediu (o aviso existe e foi tocado).
    // Na primeira instalação também há controllerchange, e aí não há nada a
    // recarregar.
    const aviso = document.getElementById('aviso-versao');
    if (recarregando || !aviso || !aviso.disabled) return;
    recarregando = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    let registro;
    try {
      registro = await navigator.serviceWorker.register('./service-worker.js');
    } catch {
      return;
    }

    // Uma versão nova já baixada e esperando, de uma visita anterior.
    if (registro.waiting && navigator.serviceWorker.controller) avisarVersaoNova(registro);

    registro.addEventListener('updatefound', () => {
      const nova = registro.installing;
      if (!nova) return;
      nova.addEventListener('statechange', () => {
        // 'installed' com um controlador ativo = é atualização, não a
        // primeira instalação.
        if (nova.state === 'installed' && navigator.serviceWorker.controller) avisarVersaoNova(registro);
      });
    });

    // App instalado fica aberto por dias: procurar versão nova sempre que ele
    // volta pra frente, e não só quando abre do zero.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') registro.update().catch(() => {});
    });
  });
}
