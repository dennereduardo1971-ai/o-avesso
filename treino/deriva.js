// Deriva: quanto o tom escorrega quando se canta sem base.
//
// Cantando à capela, a afinação anda aos poucos pra cima ou pra baixo sem a
// pessoa perceber. Medido em 24 cantores de habilidade variada (Mauch et al.,
// 2014): deriva mediana de 11 cents em uns 50 segundos, significativa em 22%
// das gravações, e — o mais importante — sem relação com a experiência de
// quem cantava. Ou seja: cantora boa também deriva, e só descobre ouvindo a
// gravação.
//
// COMO O APP MEDE
// Começa com uma âncora: o app toca uma nota e a pessoa a sustenta. Depois ela
// canta o trecho sem base e sem nada na tela. No fim, canta de memória a nota
// do começo. A diferença entre as duas é a deriva. Oitava não importa aqui —
// voltar à tônica uma oitava acima é voltar à tônica —, então os desvios são
// dobrados pra dentro de ±600 cents antes da conta.

// Até ±25 cents o ouvinte comum ainda ouve como afinado; acima de ±50 qualquer
// pessoa percebe (Larrouy-Maestri — a mesma régua da tolerância do treino).
const LIMIARES = [
  { ate: 15, nivel: 'segurou', texto: 'Segurou o tom' },
  { ate: 30, nivel: 'leve', texto: 'Escorregou um pouco' },
  { ate: 50, nivel: 'moderada', texto: 'Escorregou' },
  { ate: Infinity, nivel: 'perceptivel', texto: 'Escorregou o bastante pra qualquer um ouvir' },
];

export function dobrarOitava(cents) {
  let c = cents % 1200;
  if (c > 600) c -= 1200;
  if (c < -600) c += 1200;
  return c;
}

export function mediana(valores) {
  if (!valores.length) return null;
  const o = [...valores].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}

export function avaliarDeriva({ inicioCents, fimCents, duracaoMs }) {
  const deriva = dobrarOitava(fimCents - inicioCents);
  const faixa = LIMIARES.find((l) => Math.abs(deriva) <= l.ate);
  const minutos = duracaoMs / 60000;
  return {
    derivaCents: deriva,
    lado: Math.abs(deriva) < 5 ? 'nenhum' : deriva > 0 ? 'acima' : 'abaixo',
    nivel: faixa.nivel,
    texto: faixa.texto,
    // cents por minuto, pra comparar trechos de tamanhos diferentes
    porMinuto: minutos > 0 ? deriva / minutos : null,
  };
}
