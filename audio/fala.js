// A voz do treinador.
//
// PROVISÓRIO — E ESTÁ ANOTADO QUE É
// Hoje isto usa `speechSynthesis`, que depende do TTS instalado no aparelho:
// em um Android pode sair uma voz boa em pt-BR, em outro uma voz de robô com
// sotaque de português de Portugal, e em um terceiro nada. Na Fase 2 estes
// mesmos textos viram arquivos de áudio gerados antes e embutidos no app —
// aí a voz é sempre a mesma e funciona offline sem depender do aparelho.
// A interface daqui (`falar`, `calar`) foi desenhada pra não mudar quando
// isso acontecer.
//
// Falar também sai pelo alto-falante, então vale a mesma regra do som-guia: o
// microfone não escuta enquanto o treinador fala.

import { comEscutaPausada } from './motor.js';

let ligada = true;
let vozEscolhida = null;
let vozesProcuradas = false;

export function disponivel() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function estaLigada() {
  return ligada && disponivel();
}

export function definirLigada(valor) {
  ligada = !!valor;
  if (!ligada) calar();
}

function escolherVoz() {
  if (vozesProcuradas && vozEscolhida) return vozEscolhida;
  const vozes = window.speechSynthesis.getVoices();
  if (!vozes.length) return null; // em alguns navegadores a lista só chega depois
  vozesProcuradas = true;
  vozEscolhida =
    vozes.find((v) => v.lang === 'pt-BR' && v.localService) ||
    vozes.find((v) => v.lang === 'pt-BR') ||
    vozes.find((v) => v.lang && v.lang.startsWith('pt')) ||
    null;
  return vozEscolhida;
}

if (disponivel() && typeof window.speechSynthesis.addEventListener === 'function') {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    vozesProcuradas = false;
    escolherVoz();
  });
}

export function calar() {
  if (disponivel()) {
    try { window.speechSynthesis.cancel(); } catch { /* nada a cancelar */ }
  }
}

// Fala e devolve uma promessa que resolve quando terminou.
//
// O `setTimeout` de segurança não é paranoia: `onend` falha em silêncio em
// mais de um navegador (aba em segundo plano, fala cancelada por outra), e um
// exercício sem mãos que espera por ele trava pra sempre. A estimativa é
// grosseira de propósito — ela só precisa ser maior que a fala real.
export function falar(texto, { taxa = 1, tom = 1 } = {}) {
  if (!estaLigada() || !texto) return Promise.resolve(false);

  return comEscutaPausada(
    () =>
      new Promise((resolver) => {
        let resolvido = false;
        const terminar = (valor) => {
          if (resolvido) return;
          resolvido = true;
          clearTimeout(rede);
          resolver(valor);
        };

        const fala = new SpeechSynthesisUtterance(texto);
        const voz = escolherVoz();
        if (voz) fala.voice = voz;
        fala.lang = (voz && voz.lang) || 'pt-BR';
        fala.rate = taxa;
        fala.pitch = tom;
        fala.onend = () => terminar(true);
        fala.onerror = () => terminar(false);

        const estimativaMs = 900 + (texto.length / 12) * 1000;
        const rede = setTimeout(() => terminar(false), estimativaMs + 2500);

        try {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(fala);
        } catch {
          terminar(false);
        }
      })
  );
}
