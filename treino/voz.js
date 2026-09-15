// Onde a voz mora — e onde ela trabalha confortável.
//
// Extensão é da nota mais grave até a mais aguda que você consegue emitir.
// Tessitura é a parte de dentro dessa faixa onde a voz sai sem esforço e
// aguenta ficar. Exercício bom acontece na tessitura; o extremo agudo é meta,
// não lugar de morar.
//
// Enquanto não há medida, o app assume barítono (A2–A4 de extensão, A2–F4 de
// tessitura), que é a referência mais provável aqui. Assim que o teste inicial
// roda, a medida real substitui o palpite — todo exercício é gerado em torno
// da voz que existe, não de uma faixa de catálogo.

import { notasEntre } from '../audio/notas.js';

// A2 = 45, F4 = 65, A4 = 69.
export const EXTENSAO_PADRAO = { midiMinimo: 45, midiMaximo: 69 };
export const TESSITURA_PADRAO = { midiMinimo: 45, midiMaximo: 65 };

// Passaggio de barítono: as duas passagens onde o registro troca e a afinação
// costuma escorregar. São aproximadas — variam de pessoa pra pessoa — e o app
// só as usa pra *adiar* essas notas nos primeiros exercícios, nunca pra
// proibir nada.
export const PASSAGGIO = [
  { midiMinimo: 59, midiMaximo: 60 }, // Si3–Dó4
  { midiMinimo: 64, midiMaximo: 65 }, // Mi4–Fá4
];

export function ehPassaggio(midi) {
  return PASSAGGIO.some((faixa) => midi >= faixa.midiMinimo && midi <= faixa.midiMaximo);
}

export function extensaoDoPerfil(perfil) {
  const medida = perfil && perfil.extensao;
  if (!medida || !Number.isFinite(medida.midiMinimo) || !Number.isFinite(medida.midiMaximo)) {
    return { ...EXTENSAO_PADRAO, estimada: true };
  }
  return { midiMinimo: medida.midiMinimo, midiMaximo: medida.midiMaximo, estimada: false };
}

// A tessitura sai da extensão cortando as pontas: o grave extremo sai sem
// apoio e o agudo extremo sai com esforço. Quatro semitons em cima e um
// embaixo é um corte conservador, e nunca devolve menos de uma oitava — um
// exercício precisa de espaço pra andar.
export function tessituraDe(extensao) {
  const bruto = {
    midiMinimo: extensao.midiMinimo + 1,
    midiMaximo: extensao.midiMaximo - 4,
  };
  if (bruto.midiMaximo - bruto.midiMinimo < 12) {
    const centro = (extensao.midiMinimo + extensao.midiMaximo) / 2;
    return {
      midiMinimo: Math.round(centro - 6),
      midiMaximo: Math.round(centro + 6),
    };
  }
  return bruto;
}

export function notasDaTessitura(extensao) {
  const tessitura = tessituraDe(extensao);
  return notasEntre(tessitura.midiMinimo, tessitura.midiMaximo);
}

// As notas do teste de precisão: `quantidade` alturas espalhadas pela
// tessitura, sem repetir e sem subir em linha reta. Subir em linha reta mede
// outra coisa — depois de três notas a pessoa acerta a quarta por inércia, não
// por ouvido. O embaralhado aqui é fixo (não é aleatório) pra que o reteste de
// daqui a três semanas meça exatamente as mesmas notas que hoje.
export function notasDeDiagnostico(extensao, quantidade = 8) {
  const tessitura = tessituraDe(extensao);
  const vao = tessitura.midiMaximo - tessitura.midiMinimo;
  const escada = [];
  for (let i = 0; i < quantidade; i++) {
    escada.push(Math.round(tessitura.midiMinimo + (vao * i) / (quantidade - 1)));
  }
  // ordem de salto: baixo, meio, alto, ... — mede leitura de intervalo, não de escala
  const ordem = [0, 4, 2, 6, 1, 5, 3, 7].filter((i) => i < quantidade);
  const escolhidas = ordem.map((i) => escada[i]);
  return escolhidas;
}

// As notas de uma sessão de afinação. Notas fracas primeiro (é pra isso que o
// perfil serve), completadas com notas confortáveis da tessitura, e o
// passaggio deixado para o fim — quando a voz já está aquecida.
//
// Uma tessitura de barítono tem umas vinte notas, e uma sessão de vinte
// minutos pede mais que isso. Então a fila repete: volta ao começo e passa de
// novo, o que é o que um exercício de canto faz mesmo — ninguém aprende uma
// nota vendo ela uma vez. O que não pode é a sessão acabar cedo porque a lista
// acabou, que é o que acontecia antes desta função repetir.
export function notasDeTreino(extensao, { notasFracas = [], quantidade = 12 } = {}) {
  const disponiveis = notasDaTessitura(extensao);
  if (!disponiveis.length) return [];

  const primeiraVolta = [];

  for (const midi of notasFracas) {
    if (disponiveis.includes(midi) && !primeiraVolta.includes(midi)) primeiraVolta.push(midi);
    if (primeiraVolta.length >= Math.ceil(Math.min(quantidade, disponiveis.length) / 2)) break;
  }

  const restantes = disponiveis
    .filter((midi) => !primeiraVolta.includes(midi))
    .sort((a, b) => Number(ehPassaggio(a)) - Number(ehPassaggio(b)));

  primeiraVolta.push(...restantes);

  const escolhidas = [];
  let volta = 0;
  while (escolhidas.length < quantidade) {
    // A cada volta a ordem desloca uma casa, pra que a segunda passagem não
    // seja a repetição exata da primeira — o ouvido decora sequência.
    const deslocada = primeiraVolta.slice(volta % primeiraVolta.length)
      .concat(primeiraVolta.slice(0, volta % primeiraVolta.length));
    for (const midi of deslocada) {
      if (escolhidas.length >= quantidade) break;
      escolhidas.push(midi);
    }
    volta++;
  }

  return escolhidas;
}
