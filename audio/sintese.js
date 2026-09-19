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
import { formantesPara, ganhoDeCompensacao } from './timbre.js';
import { escolherGravacao, taxaDeReproducao } from '../treino/guia.js';

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

// As formantes de um /a/ neutro são o que faz o ouvido reconhecer "voz" em
// vez de "sintetizador": a fonte é a mesma serra, o que muda é quais faixas do
// espectro passam. No agudo a primeira formante sobe junto com a nota e o
// volume é compensado nota a nota — ver audio/timbre.js.

export function tocarTomVocal(midi, duracao = 1.4, volume = 0.32) {
  const ctx = obterContexto();
  const nos = montarTomVocal(ctx, saidaMestre(), midi, { duracao, volume, inicio: ctx.currentTime });
  registrar(nos, duracao * 1000);
  return esperar(duracao * 1000);
}

// Monta o grafo do tom vocal em qualquer contexto — o do app ou um
// OfflineAudioContext da verificação, que mede o volume nota a nota com este
// mesmo código.
export function montarTomVocal(ctx, destino, midi, { duracao = 1.4, volume = 0.32, inicio = 0 } = {}) {
  const agora = inicio;
  const frequencia = notaParaFrequencia(midi);
  const volumeDaNota = volume * ganhoDeCompensacao(frequencia);

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
  envelope.gain.exponentialRampToValueAtTime(volumeDaNota, agora + 0.09);
  envelope.gain.setValueAtTime(volumeDaNota, agora + duracao - 0.18);
  envelope.gain.exponentialRampToValueAtTime(0.0001, agora + duracao);

  const soma = ctx.createGain();
  soma.gain.value = 1;
  for (const formante of formantesPara(frequencia)) {
    const filtro = ctx.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.frequency.value = formante.frequencia;
    filtro.Q.value = formante.q;
    const ganhoFormante = ctx.createGain();
    ganhoFormante.gain.value = formante.ganho;
    osc.connect(filtro).connect(ganhoFormante).connect(soma);
  }
  soma.connect(envelope).connect(destino);

  osc.start(agora);
  lfo.start(agora);
  osc.stop(agora + duracao + 0.05);
  lfo.stop(agora + duracao + 0.05);

  return [osc, lfo];
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

// --- guia com a própria voz ------------------------------------------
//
// Quando a pessoa ligou o guia com a própria voz, a tela de treino entrega
// aqui as gravações (midi → registro guardado). A apresentação da nota passa
// a usar a gravação mais próxima no lugar do tom sintético — ver
// treino/guia.js pro porquê.

let gravacoesDoGuia = null;
const buffersDoGuia = new Map();
let fonteDoUltimoGuia = null;   // 'propria-voz' | 'sintetico' — pra verificação

export function definirGravacoesDoGuia(mapa) {
  gravacoesDoGuia = mapa && mapa.size ? mapa : null;
  buffersDoGuia.clear();
}

export function ultimaFonteDoGuia() {
  return fonteDoUltimoGuia;
}

// O mesmo nível de energia do tom vocal (−30 dB eficaz), pra trocar de guia
// não mudar o volume.
const RMS_DO_GUIA = 0.032;

function bufferDe(registro) {
  let buffer = buffersDoGuia.get(registro.midi);
  if (buffer) return buffer;
  const ctx = obterContexto();
  const pcm = registro.pcm instanceof Int16Array ? registro.pcm : new Int16Array(registro.pcm);
  buffer = ctx.createBuffer(1, pcm.length, registro.taxa);
  const canal = buffer.getChannelData(0);
  for (let i = 0; i < pcm.length; i++) canal[i] = pcm[i] / 32767;
  buffersDoGuia.set(registro.midi, buffer);
  return buffer;
}

function tocarGravacao(escolha, midi, duracao) {
  const ctx = obterContexto();
  const agora = ctx.currentTime;
  const fonte = ctx.createBufferSource();
  fonte.buffer = bufferDe(escolha.registro);
  fonte.playbackRate.value = taxaDeReproducao(escolha.registro, midi);

  const volume = Math.min(8, RMS_DO_GUIA / Math.max(1e-4, escolha.registro.rms));
  const dur = Math.min(duracao, fonte.buffer.duration / fonte.playbackRate.value);
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0.0001, agora);
  envelope.gain.exponentialRampToValueAtTime(volume, agora + 0.06);
  envelope.gain.setValueAtTime(volume, agora + Math.max(0.07, dur - 0.12));
  envelope.gain.exponentialRampToValueAtTime(0.0001, agora + dur);

  fonte.connect(envelope).connect(saidaMestre());
  fonte.start(agora);
  fonte.stop(agora + dur + 0.02);
  registrar([fonte], dur * 1000);
  return esperar(dur * 1000);
}

// --- apresentação da nota ----------------------------------------------

// A sequência completa: piano diz qual é a nota, a voz (a própria, se houver
// gravação; senão o tom vocal) mostra como ela soa cantada, e só então o
// microfone volta a escutar.
export async function apresentarNota(midi, { duracaoPiano = 0.75, duracaoVocal = 1.5 } = {}) {
  return comEscutaPausada(async () => {
    await tocarPiano(midi, duracaoPiano);
    await esperar(80);
    const escolha = escolherGravacao(gravacoesDoGuia, midi);
    fonteDoUltimoGuia = escolha ? 'propria-voz' : 'sintetico';
    if (escolha) await tocarGravacao(escolha, midi, duracaoVocal);
    else await tocarTomVocal(midi, duracaoVocal);
    // um respiro antes de religar o microfone, pra deixar a sala calar
    await esperar(120);
  });
}

export async function tocarComEscutaPausada(tarefa) {
  return comEscutaPausada(tarefa);
}
