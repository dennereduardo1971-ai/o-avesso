// A entrada do app: liga o roteador, registra o service worker, e sai da
// frente. Toda a lógica mora nos módulos.

import { criarRoteador } from './ui/roteador.js';
import * as inicio from './telas/inicio.js';
import * as diagnostico from './telas/diagnostico.js';
import * as treino from './telas/treino.js';
import * as resumo from './telas/resumo.js';
import * as afinador from './telas/afinador.js';

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
  },
});

roteador.iniciar();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
