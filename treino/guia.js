// O guia com a própria voz.
//
// POR QUE
// Imitar uma gravação de si mesmo sai mais afinado do que imitar a de outra
// pessoa — e o efeito não vem de reconhecer a própria voz nem do timbre
// (Pfordresher & Mantell, 2014, três experimentos). A explicação dos autores:
// o cérebro já sabe fazer aquele som, porque já o fez. É o guia mais fácil de
// imitar que existe, e o app pode construí-lo de graça: toda nota acertada e
// sustentada vira candidata.
//
// O QUE GUARDA
// Uma gravação por nota, a melhor. Antes de guardar, o próprio YIN confere o
// trecho: tem que ter voz em quase todo ele, estar a menos de 30 cents do alvo
// e não tremer demais — senão não é guia, é ruído. O desvio medido é guardado
// junto, e na hora de tocar a velocidade de reprodução corrige esse desvio
// (15 cents de desvio viram 0,9% de velocidade — inaudível no timbre).
//
// Nota sem gravação pode usar a vizinha até 2 semitons de distância, com a
// velocidade ajustada. Mais longe que isso a voz começa a soar de esquilo ou de
// monstro, e aí o tom sintético é melhor guia.

import { criarDetectorYin } from '../audio/yin.js';
import { centsAteAlvo } from '../audio/notas.js';

const CLAREZA_MINIMA = 0.6;
const FRACAO_COM_VOZ = 0.8;
const DESVIO_MAXIMO = 30;     // cents
const OSCILACAO_MAXIMA = 40;  // cents (vibrato de pop cabe; grito não)
export const DISTANCIA_MAXIMA = 2; // semitons

function mediana(valores) {
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

// Confere um trecho gravado. Devolve null se ele não serve de guia.
export function analisarTomada(dados, taxa, alvoMidi) {
  const tamanho = 2048;
  if (!dados || dados.length < tamanho * 4) return null;
  const detector = criarDetectorYin({ taxaAmostragem: taxa, tamanho });
  const desvios = [];
  let quadros = 0;
  for (let i = 0; i + tamanho <= dados.length; i += tamanho / 2) {
    quadros++;
    const leitura = detector.detectar(dados.subarray(i, i + tamanho));
    if (leitura.frequencia > 0 && leitura.clareza >= CLAREZA_MINIMA) {
      desvios.push(centsAteAlvo(leitura.frequencia, alvoMidi));
    }
  }
  if (!quadros || desvios.length / quadros < FRACAO_COM_VOZ) return null;
  const desvioCents = mediana(desvios);
  const media = desvios.reduce((s, d) => s + d, 0) / desvios.length;
  const oscilacaoCents = Math.sqrt(desvios.reduce((s, d) => s + (d - media) ** 2, 0) / desvios.length);
  if (Math.abs(desvioCents) > DESVIO_MAXIMO || oscilacaoCents > OSCILACAO_MAXIMA) return null;

  let energia = 0;
  for (let i = 0; i < dados.length; i++) energia += dados[i] * dados[i];
  return { desvioCents, oscilacaoCents, rms: Math.sqrt(energia / dados.length) };
}

// A nova tomada substitui a guardada se for claramente mais afinada — ou quase
// tão afinada e bem mais recente (a voz muda; o guia deve acompanhar).
const MARGEM = 3;
const UM_MES = 30 * 86400000;
export function melhorQue(nova, antiga) {
  if (!antiga) return true;
  const a = Math.abs(nova.desvioCents);
  const b = Math.abs(antiga.desvioCents);
  if (a < b - MARGEM) return true;
  return a <= b + MARGEM && nova.data - antiga.data > UM_MES;
}

// A gravação mais próxima da nota pedida, até DISTANCIA_MAXIMA semitons.
export function escolherGravacao(gravacoes, alvoMidi) {
  if (!gravacoes) return null;
  for (let d = 0; d <= DISTANCIA_MAXIMA; d++) {
    for (const candidata of d === 0 ? [alvoMidi] : [alvoMidi - d, alvoMidi + d]) {
      const registro = gravacoes.get(candidata);
      if (registro) return { registro, semitons: alvoMidi - candidata };
    }
  }
  return null;
}

// Velocidade de reprodução que leva a gravação exatamente ao alvo: desloca os
// semitons de distância e desfaz o desvio que ela tinha.
export function taxaDeReproducao(registro, alvoMidi) {
  const cents = (alvoMidi - registro.midi) * 100 - registro.desvioCents;
  return Math.pow(2, cents / 1200);
}

export function paraInt16(dados) {
  const saida = new Int16Array(dados.length);
  for (let i = 0; i < dados.length; i++) {
    const v = Math.max(-1, Math.min(1, dados[i]));
    saida[i] = Math.round(v * 32767);
  }
  return saida;
}
