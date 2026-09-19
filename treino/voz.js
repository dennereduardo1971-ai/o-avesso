// Onde a voz mora — e onde ela trabalha confortável.
//
// Extensão é da nota mais grave até a mais aguda que você consegue emitir.
// Tessitura é a parte de dentro dessa faixa onde a voz sai sem esforço e
// aguenta ficar. Exercício bom acontece na tessitura; o extremo agudo é meta,
// não lugar de morar.
//
// Enquanto não há medida, o app parte de um palpite pelo tipo de voz que a
// pessoa diz ter: "mais grave" é barítono (A2–A4), "mais aguda" é a mesma
// faixa uma oitava acima (A3–A5), que é onde a maioria das vozes femininas
// mora. Assim que o teste inicial roda, a medida real substitui o palpite —
// todo exercício é gerado em torno da voz que existe, não de uma faixa de
// catálogo.

import { notasEntre } from '../audio/notas.js';

// Passaggio: as duas passagens onde o registro troca e a afinação costuma
// escorregar. São aproximadas — variam de pessoa pra pessoa — e o app só as
// usa pra *adiar* essas notas nos primeiros exercícios, nunca pra proibir
// nada. Na voz aguda não é o barítono uma oitava acima: a primeira passagem
// feminina fica perto de Mi4–Fá4 e a segunda perto de Dó#5–Ré5.
//
// `referencias` são as notas de partida do teste inicial: de onde começar a
// descer e de onde começar a subir. Começar o grave de uma voz feminina em
// Sol3 é começar perto do fundo dela.
export const VOZES = {
  grave: {
    id: 'grave',
    nome: 'mais grave',
    extensao: { midiMinimo: 45, midiMaximo: 69 }, // A2–A4
    passaggio: [
      { midiMinimo: 59, midiMaximo: 60 }, // Si3–Dó4
      { midiMinimo: 64, midiMaximo: 65 }, // Mi4–Fá4
    ],
    referencias: { grave: 55, agudo: 64 }, // Sol3, Mi4
  },
  aguda: {
    id: 'aguda',
    nome: 'mais aguda',
    extensao: { midiMinimo: 57, midiMaximo: 81 }, // A3–A5
    passaggio: [
      { midiMinimo: 64, midiMaximo: 65 }, // Mi4–Fá4
      { midiMinimo: 73, midiMaximo: 74 }, // Dó#5–Ré5
    ],
    referencias: { grave: 67, agudo: 76 }, // Sol4, Mi5
  },
};

// O palpite de antes de haver escolha nenhuma continua sendo barítono — é o
// que o app sempre fez, e quem já usa não vê nada mudar.
export const EXTENSAO_PADRAO = VOZES.grave.extensao;
export const PASSAGGIO = VOZES.grave.passaggio;

export function vozDoPerfil(perfil) {
  const escolhida = perfil && perfil.preferencias && perfil.preferencias.voz;
  return VOZES[escolhida] ? escolhida : 'grave';
}

export function ehPassaggio(midi, voz = 'grave') {
  const faixas = (VOZES[voz] || VOZES.grave).passaggio;
  return faixas.some((faixa) => midi >= faixa.midiMinimo && midi <= faixa.midiMaximo);
}

export function extensaoDoPerfil(perfil) {
  const medida = perfil && perfil.extensao;
  if (!medida || !Number.isFinite(medida.midiMinimo) || !Number.isFinite(medida.midiMaximo)) {
    return { ...VOZES[vozDoPerfil(perfil)].extensao, estimada: true };
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
// Uma tessitura tem umas vinte notas, e uma sessão de vinte
// minutos pede mais que isso. Então a fila repete: volta ao começo e passa de
// novo, o que é o que um exercício de canto faz mesmo — ninguém aprende uma
// nota vendo ela uma vez. O que não pode é a sessão acabar cedo porque a lista
// acabou, que é o que acontecia antes desta função repetir.
export function notasDeTreino(extensao, { notasFracas = [], quantidade = 12, voz = 'grave' } = {}) {
  const disponiveis = notasDaTessitura(extensao);
  if (!disponiveis.length) return [];

  const primeiraVolta = [];

  for (const midi of notasFracas) {
    if (disponiveis.includes(midi) && !primeiraVolta.includes(midi)) primeiraVolta.push(midi);
    if (primeiraVolta.length >= Math.ceil(Math.min(quantidade, disponiveis.length) / 2)) break;
  }

  const restantes = disponiveis
    .filter((midi) => !primeiraVolta.includes(midi))
    .sort((a, b) => Number(ehPassaggio(a, voz)) - Number(ehPassaggio(b, voz)));

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
