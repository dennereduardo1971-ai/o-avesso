// A sessão completa: check-in → aquecimento → treino, num toque.
//
// É o ritual de antes de cantar, na ordem que a pesquisa de saúde vocal manda
// (ver o dossiê 04 no vault da Sara): primeiro saber como a voz está, depois
// aquecer, depois cantar. Quem decide o tamanho de cada parte é o check-in —
// voz boa aquece 5 minutos e treina 10; voz "canta leve" aquece 10 e treina
// só 5; voz vermelha não segue. O fluxo viaja de tela em tela pelo parâmetro
// `fluxo=completo` no endereço, então cada tela continua funcionando sozinha.

export const FLUXO = 'completo';

export function planoDaSessao(nivel) {
  if (nivel === 'verde') return { segue: true, rotina: 'curta', minutosDeTreino: 10 };
  if (nivel === 'amarelo') return { segue: true, rotina: 'longa', minutosDeTreino: 5 };
  return { segue: false, rotina: null, minutosDeTreino: 0 };
}
