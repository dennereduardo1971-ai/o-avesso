// Os sons que o app produz: um piano pra apresentar a nota e um tom vocal pra
// sustentá-la.
//
// POR QUE DOIS TIMBRES, E NESTA ORDEM
// O piano tem ataque duro e decaimento rápido — ele diz *qual* é a nota, sem
// deixar dúvida sobre onde ela começa. O tom vocal, com formantes, é o que dá
// pra imitar: a pessoa canta junto de algo que soa como voz, não como
// telefone tocando. Apresentar com piano e sustentar com tom vocal é a ordem
// que uma aula de canto usa, e é a ordem que o app usa.
//
// Nada disso toca enquanto o microfone escuta (ver audio/motor.js): o
// som-guia sairia pelo alto-falante e voltaria pelo microfone como se fosse a
// pessoa cantando afinado.

import { obterContexto, saidaMestre, comEscutaPausada } from './motor.js';
import { notaParaFrequencia } from './notas.js';

const emAndamento = new Set();

function esperar(ms) {
  return new Promise((resolver) => setTimeout(resolver, ms));
}

function registrar(nos, duracaoMs) {
  const grupo = { nos };
  emAndamento.add(grupo);
  setTimeout(() => emAndamento.delete(grupo), duracaoMs + 200);
  return grupo;
}

// Corta tudo que está soando. Usado ao sair de uma tela no meio de um
// exercício — sem isto o guia continua cantando sozinho na tela seguinte.
export function silenciar() {
  const ctx = obterContexto();
  for (const grupo of emAndamento) {
    for (const no of grupo.nos) {
      try { no.stop ? no.stop(ctx.currentTime) : no.disconnect(); } catch { /* já parou */ }
    }
  }
  emAndamento.clear();
}

// --- piano -------------------------------------------------------------

// Parciais de um piano: o fundamental manda, os agudos somem antes. O múltiplo
// quebrado no quarto parcial é inarmonicidade — corda real não vibra em
// múltiplos exatos, e sem esse desvio o som fica de órgão.
const PARCIAIS_PIANO = [
  { multiplo: 1, ganho: 1.0, decaimento: 1.0 },
  { multiplo: 2, ganho: 0.42, decaimento: 0.55 },
  { multiplo: 3, ganho: 0.16, decaimento: 0.38 },
  { multiplo: 4.02, ganho: 0.07, decaimento: 0.28 },
];

export function tocarPiano(midi, duracao = 0.9, volume = 0.5) {
  const ctx = obterContexto();
  const agora = ctx.currentTime;
  const frequencia = notaParaFrequencia(midi);
  const nos = [];

  for (const parcial of PARCIAIS_PIANO) {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequencia * parcial.multiplo;

    const pico = volume * parcial.ganho;
    const fim = agora + duracao * parcial.decaimento;
    ganho.gain.setValueAtTime(0.0001, agora);
    ganho.gain.exponentialRampToValueAtTime(pico, agora + 0.006);
    ganho.gain.exponentialRampToValueAtTime(0.0001, fim);

    osc.connect(ganho).connect(saidaMestre());
    osc.start(agora);
    osc.stop(fim + 0.05);
    nos.push(osc);
  }

  registrar(nos, duracao * 1000);
  return esperar(duracao * 1000);
}

// --- tom vocal ---------------------------------------------------------

// Formantes de um /a/ neutro. São eles que fazem o ouvido reconhecer "voz" em
// vez de "sintetizador": a fonte é a mesma serra, o que muda é quais faixas do
// espectro passam.
const FORMANTES = [
  { frequencia: 700, q: 9, ganho: 1.0 },
  { frequencia: 1220, q: 11, ganho: 0.5 },
  { frequencia: 2600, q: 13, ganho: 0.22 },
];

export function tocarTomVocal(midi, duracao = 1.4, volume = 0.32) {
  const ctx = obterContexto();
  const agora = ctx.currentTime;
  const frequencia = notaParaFrequencia(midi);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = frequencia;

  // Vibrato que só entra depois que a nota firmou — é assim que uma voz faz, e
  // entrar de cara atrapalharia quem está tentando achar a altura.
  const lfo = ctx.createOscillator();
  const profundidade = ctx.createGain();
  lfo.type = 'sine';
  lfo.frequency.value = 5.2;
  profundidade.gain.setValueAtTime(0, agora);
  profundidade.gain.setValueAtTime(0, agora + Math.min(0.4, duracao * 0.35));
  profundidade.gain.linearRampToValueAtTime(14, agora + Math.min(0.9, duracao * 0.7)); // cents
  lfo.connect(profundidade).connect(osc.detune);

  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, agora);
  envelope.gain.exponentialRampToValueAtTime(volume, agora + 0.09);
  envelope.gain.setValueAtTime(volume, agora + duracao - 0.18);
  envelope.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);

  const soma = ctx.createGain();
  soma.gain.value = 1;
  for (const formante of FORMANTES) {
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = formante.frequencia;
    filtro.Q.value = formante.q;
    const ganhoFormante = ctx.createGain();
    ganhoFormante.gain.value = formante.ganho;
    osc.connect(filtro).connect(ganhoFormante).connect(soma);
  }
  soma.connect(envelope).connect(saidaMestre());

  osc.start(agora);
  lfo.start(agora);
  osc.stop(agora + duracao + 0.05);
  lfo.stop(agora + duracao + 0.05);

  registrar([osc, lfo], duracao * 1000);
  return esperar(duracao * 1000);
}

// --- sinais curtos -----------------------------------------------------

// Um bipe de acerto e um de erro, pra quem está a dois metros do celular e não
// consegue ler a tela. Curtos de propósito: o app fala pouco e toca menos.
export function tocarSinal(tipo) {
  const ctx = obterContexto();
  const agora = ctx.currentTime;
  const notas = tipo === 'acerto' ? [880, 1320] : [400, 330];
  const nos = [];

  notas.forEach((frequencia, i) => {
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    const inicio = agora + i * 0.09;
    osc.type = 'triangle';
    osc.frequency.value = frequencia;
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(0.16, inicio + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.12);
    osc.connect(ganho).connect(saidaMestre());
    osc.start(inicio);
    osc.stop(inicio + 0.15);
    nos.push(osc);
  });

  registrar(nos, 300);
  return esperar(280);
}

// --- apresentação da nota ----------------------------------------------

// A sequência completa: piano diz qual é a nota, tom vocal mostra como ela
// soa cantada, e só então o microfone volta a escutar.
export async function apresentarNota(midi, { duracaoPiano = 0.75, duracaoVocal = 1.5 } = {}) {
  return comEscutaPausada(async () => {
    await tocarPiano(midi, duracaoPiano);
    await esperar(80);
    await tocarTomVocal(midi, duracaoVocal);
    // um respiro antes de religar o microfone, pra deixar a sala calar
    await esperar(120);
  });
}

export async function tocarComEscutaPausada(tarefa) {
  return comEscutaPausada(tarefa);
}
