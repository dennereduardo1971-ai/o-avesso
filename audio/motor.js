// O motor de áudio: um único AudioContext para o app inteiro, o microfone, e
// o caminho até o detector.
//
// UM CONTEXTO SÓ
// A versão anterior abria um `new AudioContext()` a cada nota tocada. Cada
// contexto desses segura um dispositivo de áudio do sistema, e navegador
// nenhum dá mais que algumas dezenas deles — depois de uma sessão de
// exercício o app simplesmente emudecia. Aqui existe um contexto, criado no
// primeiro toque da pessoa (é exigência do navegador) e reaproveitado até o
// fim.
//
// ESCUTAR E TOCAR NUNCA AO MESMO TEMPO
// O som-guia sai pelo alto-falante e volta pelo microfone. Com fone é pouco,
// sem fone é muito, e o app não tem como saber qual dos dois é o caso agora —
// então nunca escuta enquanto toca. `comEscutaPausada` é o jeito de fazer isso
// sem esquecer de religar: o detector para, o som toca, o detector volta com o
// buffer limpo.

import { criarDetectorYin, FREQUENCIA_MINIMA, FREQUENCIA_MAXIMA } from './yin.js';
import { notaParaFrequencia } from './notas.js';
import { rotuloDoMicrofone, pareceBluetooth, AVISO_BLUETOOTH } from './dispositivo.js';

const TAMANHO_JANELA = 2048;
const SALTO = 512;

let contexto = null;
let mestre = null;
let stream = null;
let fonte = null;
let no = null;           // AudioWorkletNode ou AnalyserNode, conforme o caminho
let relogioFallback = null;
let detectorFallback = null;
let quadroFallback = null;
let descartarFallbackAte = 0;

let escutando = false;
let pausas = 0;          // pausas empilham: fala dentro de síntese não religa cedo
let ouvintes = new Set();
let ultima = { frequencia: -1, clareza: 0, rms: 0, tempo: 0 };
let faixa = { minima: FREQUENCIA_MINIMA, maxima: FREQUENCIA_MAXIMA };

export function obterContexto() {
  if (!contexto) {
    const Contexto = window.AudioContext || window.webkitAudioContext;
    contexto = new Contexto();
    mestre = contexto.createGain();
    mestre.gain.value = 0.9;
    mestre.connect(contexto.destination);
  }
  return contexto;
}

// Toda síntese passa por aqui. Quem quiser abaixar o volume do app inteiro
// mexe num lugar só.
export function saidaMestre() {
  obterContexto();
  return mestre;
}

export async function acordarContexto() {
  const ctx = obterContexto();
  // 'interrupted' é o estado do Safari depois de uma ligação, da Siri ou de
  // outro app tomar o áudio — sem tratar ele junto, o app ficava mudo até
  // recarregar.
  if (ctx.state !== 'running') {
    try { await ctx.resume(); } catch { /* o navegador dirá não até haver um toque */ }
  }
  return ctx.state === 'running';
}

export function estaEscutando() {
  return escutando;
}

export function ultimaLeitura() {
  return ultima;
}

export function aoDetectar(ouvinte) {
  ouvintes.add(ouvinte);
  return () => ouvintes.delete(ouvinte);
}

function anunciar(leitura) {
  ultima = leitura;
  for (const ouvinte of ouvintes) {
    try { ouvinte(leitura); } catch (erro) { console.error('ouvinte de pitch quebrou', erro); }
  }
}

// --- microfone ---------------------------------------------------------

export async function ligarEscuta() {
  if (escutando) return { ok: true };

  const ctx = obterContexto();
  await acordarContexto();

  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // Os três tratamentos que o navegador faria por conta própria atrapalham
      // aqui: cancelamento de eco recorta o sinal, supressão de ruído come o
      // grave, e ganho automático mexe na amplitude no meio de uma nota
      // sustentada. O detector prefere o sinal cru.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  } catch (erro) {
    return { ok: false, motivo: motivoDoErroDeMicrofone(erro) };
  }

  fonte = ctx.createMediaStreamSource(stream);

  const viaWorklet = await tentarWorklet(ctx);
  if (!viaWorklet) ligarFallback(ctx);

  escutando = true;
  pausas = 0;
  const microfone = await rotuloDoMicrofone(stream);
  return {
    ok: true,
    caminho: viaWorklet ? 'worklet' : 'thread-principal',
    microfone,
    aviso: pareceBluetooth(microfone) ? AVISO_BLUETOOTH : null,
  };
}

function motivoDoErroDeMicrofone(erro) {
  const nome = erro && erro.name;
  if (nome === 'NotAllowedError' || nome === 'SecurityError') {
    return 'Você precisa permitir o microfone. Toque no cadeado ao lado do endereço e libere.';
  }
  if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
    return 'Não encontrei nenhum microfone neste aparelho.';
  }
  if (nome === 'NotReadableError') {
    return 'O microfone está ocupado por outro app. Feche o outro app e tente de novo.';
  }
  return 'Não consegui abrir o microfone.';
}

async function tentarWorklet(ctx) {
  if (!ctx.audioWorklet) return false;
  try {
    await ctx.audioWorklet.addModule('./audio/yin-worklet.js');
    no = new AudioWorkletNode(ctx, 'detector-yin', {
      numberOfInputs: 1,
      numberOfOutputs: 0,
      processorOptions: {
        tamanho: TAMANHO_JANELA,
        salto: SALTO,
        frequenciaMinima: faixa.minima,
        frequenciaMaxima: faixa.maxima,
      },
    });
    no.port.onmessage = ({ data }) => {
      if (data && data.tipo === 'captura') {
        const pendente = capturasPendentes.get(data.pedido);
        if (pendente) { capturasPendentes.delete(data.pedido); pendente({ dados: data.dados, taxa: data.taxa }); }
        return;
      }
      anunciar({
        frequencia: data.frequencia,
        clareza: data.clareza,
        rms: data.rms,
        tempo: performance.now(),
      });
    };
    fonte.connect(no);
    return true;
  } catch (erro) {
    // Dois motivos conhecidos caem aqui: navegador sem AudioWorklet, e
    // navegador cujo worklet ainda não aceita `import`. Nos dois casos o app
    // continua funcionando — só com a detecção na thread principal, que é
    // pior mas não é quebrado.
    console.warn('AudioWorklet indisponível, detectando na thread principal:', erro);
    no = null;
    return false;
  }
}

function ligarFallback(ctx) {
  const analisador = ctx.createAnalyser();
  analisador.fftSize = TAMANHO_JANELA;
  fonte.connect(analisador);
  no = analisador;
  quadroFallback = new Float32Array(TAMANHO_JANELA);
  detectorFallback = criarDetectorYin({
    taxaAmostragem: ctx.sampleRate,
    tamanho: TAMANHO_JANELA,
    frequenciaMinima: faixa.minima,
    frequenciaMaxima: faixa.maxima,
  });

  // setInterval e não requestAnimationFrame: a leitura não pode parar só
  // porque a aba perdeu o foco no meio de um exercício sem mãos.
  relogioFallback = setInterval(() => {
    if (pausas > 0) return;
    // Logo depois de uma pausa o analisador ainda guarda o rabo do som-guia
    // (uma janela inteira). O worklet descarta o anel ao retomar; aqui o
    // equivalente é esperar a janela passar.
    if (performance.now() < descartarFallbackAte) return;
    analisador.getFloatTimeDomainData(quadroFallback);
    const leitura = detectorFallback.detectar(quadroFallback);
    anunciar({
      frequencia: leitura.frequencia,
      clareza: leitura.clareza,
      rms: leitura.rms,
      tempo: performance.now(),
    });
  }, Math.round((SALTO / ctx.sampleRate) * 1000));
}

export function desligarEscuta() {
  if (relogioFallback) { clearInterval(relogioFallback); relogioFallback = null; }
  if (no && no.port) no.port.onmessage = null;
  if (fonte) { try { fonte.disconnect(); } catch { /* já desconectado */ } }
  if (no) { try { no.disconnect(); } catch { /* nó sem saída */ } }
  if (stream) stream.getTracks().forEach((faixaDeAudio) => faixaDeAudio.stop());
  stream = null;
  fonte = null;
  no = null;
  detectorFallback = null;
  escutando = false;
  pausas = 0;
  anunciar({ frequencia: -1, clareza: 0, rms: 0, tempo: performance.now() });
}

// --- captura de áudio cru ----------------------------------------------

const capturasPendentes = new Map();
let proximoPedido = 1;

// Os últimos `ms` milissegundos do microfone, como Float32Array + taxa. Só
// existe no caminho do worklet: no caminho de reserva não há anel longo, e o
// guia com a própria voz simplesmente não grava nada.
export function capturarUltimos(ms) {
  if (!no || !no.port || relogioFallback) return Promise.resolve(null);
  const pedido = proximoPedido++;
  return new Promise((resolver) => {
    capturasPendentes.set(pedido, resolver);
    no.port.postMessage({ tipo: 'capturar', ms, pedido });
    // sem resposta em 1 s, desiste — não pode travar a sessão
    setTimeout(() => {
      if (capturasPendentes.has(pedido)) { capturasPendentes.delete(pedido); resolver(null); }
    }, 1000);
  });
}

// --- pausar para tocar -------------------------------------------------

function avisarWorklet(valor) {
  if (no && no.port) no.port.postMessage({ tipo: 'escutar', valor });
}

export function pausarEscuta() {
  pausas++;
  if (pausas === 1) {
    avisarWorklet(false);
    anunciar({ frequencia: -1, clareza: 0, rms: 0, tempo: performance.now() });
  }
}

export function retomarEscuta() {
  if (pausas === 0) return;
  pausas--;
  if (pausas === 0) {
    avisarWorklet(true);
    if (relogioFallback && contexto) {
      descartarFallbackAte = performance.now() + (TAMANHO_JANELA / contexto.sampleRate) * 1000 + 20;
    }
  }
}

export function escutaPausada() {
  return pausas > 0;
}

// Roda `tarefa` com o detector desligado e religa no fim, mesmo se der erro.
export async function comEscutaPausada(tarefa) {
  pausarEscuta();
  try {
    return await tarefa();
  } finally {
    retomarEscuta();
  }
}

// --- faixa de busca ----------------------------------------------------

// Depois do teste inicial o app sabe onde a voz da pessoa mora. Apertar a
// faixa de busca em torno disso é a defesa mais barata que existe contra erro
// de oitava: a frequência errada deixa de ser procurada. A folga de uma quinta
// para cada lado existe pra que a extensão possa crescer sem o app cegar.
export function definirFaixaDeVoz(midiMinimo, midiMaximo) {
  const minima = Math.max(FREQUENCIA_MINIMA, notaParaFrequencia(midiMinimo - 7));
  const maxima = Math.min(FREQUENCIA_MAXIMA, notaParaFrequencia(midiMaximo + 7));
  definirFaixa(minima, maxima);
}

export function definirFaixa(minima, maxima) {
  faixa = { minima, maxima };
  if (no && no.port) no.port.postMessage({ tipo: 'faixa', minima, maxima });
  if (detectorFallback) detectorFallback.definirFaixa(minima, maxima);
}

export function faixaAtual() {
  return { ...faixa };
}

// --- estabilizador -----------------------------------------------------

// A leitura crua treme: um quadro isolado pode pular meio tom por causa de uma
// consoante, de um estalo de boca ou de um pico de ruído. A mediana de três
// mata o pulo isolado sem atrasar a resposta como uma média faria; a média
// exponencial que vem depois só tira o serrilhado do desenho.
export function criarEstabilizador({ suavizacao = 0.35, clarezaMinima = 0.6, memoriaMs = 250 } = {}) {
  const recentes = [];
  let valor = null;
  let ultimoBom = 0;

  return {
    empurrar(leitura) {
      const agora = leitura.tempo ?? performance.now();
      const bom = leitura.frequencia > 0 && leitura.clareza >= clarezaMinima;

      if (!bom) {
        // Um silêncio curto entre duas sílabas não deve apagar a leitura da
        // tela; um silêncio de verdade deve.
        if (agora - ultimoBom > memoriaMs) { recentes.length = 0; valor = null; }
        return valor;
      }

      ultimoBom = agora;
      recentes.push(leitura.frequencia);
      if (recentes.length > 3) recentes.shift();

      const mediana = [...recentes].sort((a, b) => a - b)[Math.floor(recentes.length / 2)];
      valor = valor === null ? mediana : valor + (mediana - valor) * suavizacao;
      return valor;
    },
    get valor() { return valor; },
    limpar() { recentes.length = 0; valor = null; ultimoBom = 0; },
  };
}
