// Vibrato: quantas vezes por segundo a nota ondula, e quanto.
//
// O que é normal: a média de dez cantores gravados foi 6,0 Hz (Prame, 1994),
// subindo uns 15% no fim da nota; aquecimento deixa o vibrato mais regular
// (2012). Amplitude varia muito com o estilo — lírico ondula meio tom pra
// cada lado, pop e sertanejo bem menos. Por isso o app só descreve, não dá nota
// pro vibrato: "5,8 Hz, ±35 cents" é informação; "vibrato ruim" seria opinião.
//
// COMO É MEDIDO
// Só no miolo da nota (o primeiro terço é a entrada). Tira-se a tendência
// linear — uma nota que sobe devagar não é vibrato — e contam-se as passagens
// pelo centro, com uma folga pra que o tremor fino do detector não conte como
// ciclo. Ciclos por segundo é a velocidade; a amplitude sai do valor eficaz
// (numa onda senoidal, pico = eficaz × √2). Só é chamado de vibrato se a
// velocidade cair entre 4 e 8 Hz e a amplitude passar de ±10 cents: fora
// disso é oscilação, não vibrato.

const VELOCIDADE_MINIMA = 4;
const VELOCIDADE_MAXIMA = 8;
const AMPLITUDE_MINIMA = 10;   // cents, pra cada lado
const FOLGA_DE_CRUZAMENTO = 3; // cents
const DURACAO_MINIMA_MS = 600;

export function analisarVibrato(tempos, cents) {
  const n = Math.min(tempos.length, cents.length);
  const inicio = Math.floor(n / 3);
  const t = tempos.slice(inicio, n);
  const c = cents.slice(inicio, n);
  if (t.length < 20) return null;
  const duracaoMs = t[t.length - 1] - t[0];
  if (duracaoMs < DURACAO_MINIMA_MS) return null;

  // tendência linear por mínimos quadrados
  const mediaT = t.reduce((s, v) => s + v, 0) / t.length;
  const mediaC = c.reduce((s, v) => s + v, 0) / c.length;
  let cov = 0;
  let varT = 0;
  for (let i = 0; i < t.length; i++) {
    cov += (t[i] - mediaT) * (c[i] - mediaC);
    varT += (t[i] - mediaT) ** 2;
  }
  const inclinacao = varT ? cov / varT : 0;
  const resto = c.map((v, i) => v - (mediaC + inclinacao * (t[i] - mediaT)));

  // passagens pelo centro, com histerese
  let lado = 0;
  let cruzamentos = 0;
  let primeiro = null;
  let ultimo = null;
  for (let i = 0; i < resto.length; i++) {
    const novo = resto[i] > FOLGA_DE_CRUZAMENTO ? 1 : resto[i] < -FOLGA_DE_CRUZAMENTO ? -1 : 0;
    if (novo === 0) continue;
    if (lado !== 0 && novo !== lado) {
      cruzamentos++;
      if (primeiro === null) primeiro = t[i];
      ultimo = t[i];
    }
    lado = novo;
  }
  if (cruzamentos < 3 || ultimo === primeiro) return null;

  // entre o primeiro e o último cruzamento há (cruzamentos − 1) meios-ciclos
  const velocidadeHz = ((cruzamentos - 1) / 2) / ((ultimo - primeiro) / 1000);
  const eficaz = Math.sqrt(resto.reduce((s, v) => s + v * v, 0) / resto.length);
  const amplitudeCents = eficaz * Math.SQRT2;

  const ehVibrato =
    velocidadeHz >= VELOCIDADE_MINIMA && velocidadeHz <= VELOCIDADE_MAXIMA && amplitudeCents >= AMPLITUDE_MINIMA;
  return ehVibrato ? { velocidadeHz, amplitudeCents } : null;
}
