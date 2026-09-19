// O timbre do tom vocal — só números, nenhum nó de áudio.
//
// O PROBLEMA QUE ISTO RESOLVE
// O tom vocal é uma onda dente-de-serra passada por três filtros nas
// formantes de um /a/ falado (700, 1220 e 2600 Hz). Isso soa como voz no grave
// e no meio, mas quebra no agudo: numa nota de 880 Hz a própria fundamental
// cai fora do filtro de 700, e o som afina e some. Medido, o volume variava
// ~20 dB entre Lá2 e Dó6 — 12 dB mais alto em Mi5 que em Lá2, 8 dB mais baixo
// em Dó6. Pra uma voz aguda o guia pulava de volume e sumia justamente onde
// ela canta.
//
// DUAS CORREÇÕES
//   1. A primeira formante acompanha a nota quando a nota passa dela. É o que
//      cantora faz de verdade no agudo (sintonia de formante: abre a boca e
//      sobe o F1 pra ficar em cima da fundamental), então o guia continua
//      soando como voz em vez de virar apito filtrado.
//   2. O volume é compensado nota a nota. O ganho sai da resposta dos filtros
//      calculada aqui — a soma, harmônico por harmônico, do que passa pelos
//      três passa-faixas — e é escalado pra que toda nota saia com a mesma
//      energia que um Lá3.

const FORMANTES_BASE = [
  { frequencia: 700, q: 9, ganho: 1.0 },
  { frequencia: 1220, q: 11, ganho: 0.5 },
  { frequencia: 2600, q: 13, ganho: 0.22 },
];

// Folga entre a fundamental e o F1 sintonizado, e entre F1 e F2 — sem ela as
// duas primeiras formantes se fundem num pico só quando a nota sobe.
const FOLGA_F1 = 1.15;
const DISTANCIA_MINIMA_F2 = 500;

// A nota de referência do volume (Lá3) e o limite de reforço. Sem o limite, uma
// nota fora de qualquer voz receberia +20 dB e estouraria o alto-falante.
const MIDI_REFERENCIA = 57;
const REFORCO_MAXIMO = 4;   // +12 dB
const ATENUACAO_MAXIMA = 0.25;
const TAXA_PADRAO = 48000;

function hz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function formantesPara(frequencia) {
  const f1 = Math.max(FORMANTES_BASE[0].frequencia, frequencia * FOLGA_F1);
  const f2 = Math.max(FORMANTES_BASE[1].frequencia, f1 + DISTANCIA_MINIMA_F2);
  const f3 = Math.max(FORMANTES_BASE[2].frequencia, f2 + DISTANCIA_MINIMA_F2);
  return [
    { ...FORMANTES_BASE[0], frequencia: f1 },
    { ...FORMANTES_BASE[1], frequencia: f2 },
    { ...FORMANTES_BASE[2], frequencia: f3 },
  ];
}

// Resposta complexa de um passa-faixa de ganho de pico 0 dB (o BiquadFilter
// 'bandpass' do Web Audio) no protótipo analógico: H(jΩ) = (jΩ/Q) / (1 − Ω² + jΩ/Q),
// com Ω = f/fc. A distorção da transformação bilinear é desprezível abaixo de
// ~8 kHz a 48 kHz, que é onde está a energia que importa.
function respostaDoPassaFaixa(f, fc, q) {
  const w = f / fc;
  const reDen = 1 - w * w;
  const imDen = w / q;
  const imNum = w / q;
  const den = reDen * reDen + imDen * imDen;
  // (j·imNum) / (reDen + j·imDen)
  return { re: (imNum * imDen) / den, im: (imNum * reDen) / den };
}

// Energia relativa do tom vocal numa frequência: dente-de-serra (harmônico n
// com amplitude 1/n) passando pelos três filtros em paralelo.
export function energiaDoTom(frequencia, { taxaAmostragem = TAXA_PADRAO } = {}) {
  const formantes = formantesPara(frequencia);
  const teto = Math.min(taxaAmostragem / 2, 9000);
  let energia = 0;
  for (let n = 1; n * frequencia < teto; n++) {
    const f = n * frequencia;
    let re = 0;
    let im = 0;
    for (const formante of formantes) {
      const h = respostaDoPassaFaixa(f, formante.frequencia, formante.q);
      re += h.re * formante.ganho;
      im += h.im * formante.ganho;
    }
    energia += (re * re + im * im) / (n * n);
  }
  return energia;
}

let energiaDeReferencia = null;

// Quanto multiplicar o volume desta nota pra ela sair com a energia de um Lá3.
export function ganhoDeCompensacao(frequencia) {
  if (energiaDeReferencia === null) energiaDeReferencia = energiaDoTom(hz(MIDI_REFERENCIA));
  const energia = energiaDoTom(frequencia);
  if (!(energia > 0)) return 1;
  const ganho = Math.sqrt(energiaDeReferencia / energia);
  return Math.min(REFORCO_MAXIMO, Math.max(ATENUACAO_MAXIMA, ganho));
}
