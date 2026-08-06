// atualizacao.js — avisar que tem versão nova, sem puxar o tapete.
//
// O app fica guardado no aparelho pra abrir offline. Isso tem um preço: quando
// você publica uma mudança, quem já instalou continua com a versão antiga até
// alguma coisa avisar. Este módulo é esse alguma coisa.
//
// A regra é a mesma do resto do Avesso (ver "Realtime só avisa, não sobrescreve"
// no CLAUDE.md): a versão nova **nunca** entra sozinha. Trocar o app debaixo de
// quem está no meio de uma cena perderia a cena. O que aparece é uma placa; quem
// decide a hora é quem está jogando.
//
// Como funciona: o service-worker novo se instala em silêncio e fica esperando.
// A placa avisa. Ao tocar, mandamos ele assumir e recarregamos a página.

import { escapeHtml } from './util.js';

const CAMINHO_SW = '../service-worker.js';

/**
 * Registra o service worker e liga o aviso de versão nova.
 * Seguro de chamar em qualquer página: registrar duas vezes a mesma URL
 * devolve o mesmo registro, não cria outro.
 */
export function vigiarAtualizacao() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register(CAMINHO_SW).then((reg) => {
    // já tinha uma versão nova esperando de uma visita anterior
    if (reg.waiting && navigator.serviceWorker.controller) anunciar(reg.waiting);

    reg.addEventListener('updatefound', () => {
      const novo = reg.installing;
      if (!novo) return;
      novo.addEventListener('statechange', () => {
        // sem `controller` é a primeira instalação: não há "versão nova",
        // há só o app chegando pela primeira vez
        if (novo.state === 'installed' && navigator.serviceWorker.controller) {
          anunciar(novo);
        }
      });
    });

    // Voltar pro app é a hora mais provável de haver novidade — e é de graça
    // procurar, porque o navegador só baixa se o arquivo tiver mudado.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {
    // sem service worker o app funciona igual, só não abre offline
  });
}

let placa = null;

function anunciar(worker) {
  if (placa) return;

  placa = document.createElement('div');
  placa.className = 'atz-placa';
  placa.innerHTML = `
    <span class="atz-texto">${escapeHtml('puxaram um fio — o Avesso mudou')}</span>
    <button type="button" class="atz-btn">recarregar</button>
    <button type="button" class="atz-fechar" aria-label="agora não">✕</button>`;
  document.body.appendChild(placa);
  requestAnimationFrame(() => placa.classList.add('mostrando'));

  placa.querySelector('.atz-fechar').addEventListener('click', () => {
    placa.classList.remove('mostrando');
    setTimeout(() => { placa.remove(); placa = null; }, 400);
  });

  placa.querySelector('.atz-btn').addEventListener('click', () => {
    placa.querySelector('.atz-btn').disabled = true;
    placa.querySelector('.atz-btn').textContent = 'costurando...';

    // O worker novo só assume quando mandamos; aí a página recarrega já na
    // versão nova. `once` porque o evento pode disparar mais de uma vez.
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    }, { once: true });

    worker.postMessage({ tipo: 'assumir' });
  });
}
