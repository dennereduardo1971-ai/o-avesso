import { autocorrelar, frequenciaParaNota, notaParaFrequencia, NOMES_NOTAS } from './pitch.js';

const elBotaoMic = document.getElementById('botao-mic');
const elStatus = document.getElementById('status');
const elNota = document.getElementById('nota');
const elOitava = document.getElementById('oitava');
const elFrequencia = document.getElementById('frequencia');
const elPonteiro = document.getElementById('ponteiro');
const elMostrador = document.getElementById('mostrador');
const elAlvoSelect = document.getElementById('alvo-nota');
const elOuvirAlvo = document.getElementById('ouvir-alvo');

const elExercicioRaiz = document.getElementById('exercicio-raiz');
const elExercicioIniciar = document.getElementById('exercicio-iniciar');
const elExercicioParar = document.getElementById('exercicio-parar');
const elExercicioAlvo = document.getElementById('exercicio-alvo');
const elExercicioProgresso = document.getElementById('exercicio-progresso');
const elExercicioBarra = document.getElementById('exercicio-barra');

let contextoAudio = null;
let analisador = null;
let streamMic = null;
let quadro = null;
let rodando = false;

function preencherSeletorDeNotas() {
  const opcoes = [];
  for (let midi = 36; midi <= 84; midi++) { // C2 a C6, cobre a maioria das vozes
    const indice = ((midi % 12) + 12) % 12;
    const oitava = Math.floor(midi / 12) - 1;
    opcoes.push({ midi, rotulo: `${NOMES_NOTAS[indice]}${oitava}` });
  }
  for (const { midi, rotulo } of opcoes) {
    const opt = document.createElement('option');
    opt.value = midi;
    opt.textContent = rotulo;
    if (rotulo === 'Dó4') opt.selected = true;
    elAlvoSelect.appendChild(opt);
    const opt2 = document.createElement('option');
    opt2.value = midi;
    opt2.textContent = rotulo;
    if (rotulo === 'Dó3') opt2.selected = true;
    elExercicioRaiz.appendChild(opt2);
  }
}

async function ligarMicrofone() {
  try {
    streamMic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
  } catch {
    elStatus.textContent = 'Não consegui acessar o microfone — verifique a permissão.';
    return false;
  }
  contextoAudio = new (window.AudioContext || window.webkitAudioContext)();
  const fonte = contextoAudio.createMediaStreamSource(streamMic);
  analisador = contextoAudio.createAnalyser();
  analisador.fftSize = 2048;
  fonte.connect(analisador);
  quadro = new Float32Array(analisador.fftSize);
  return true;
}

function desligarMicrofone() {
  if (streamMic) streamMic.getTracks().forEach((t) => t.stop());
  if (contextoAudio) contextoAudio.close();
  streamMic = null;
  contextoAudio = null;
  analisador = null;
}

let quadroSustentado = 0;

function loop() {
  if (!rodando) return;
  analisador.getFloatTimeDomainData(quadro);
  const frequencia = autocorrelar(quadro, contextoAudio.sampleRate);

  if (frequencia === -1) {
    elStatus.textContent = 'Escutando... cante ou toque uma nota perto do microfone.';
    elNota.textContent = '—';
    elOitava.textContent = '';
    elFrequencia.textContent = '';
    definirPonteiro(0);
    quadroSustentado = 0;
  } else {
    const nota = frequenciaParaNota(frequencia);
    elStatus.textContent = 'Ouvindo';
    elNota.textContent = nota.nome;
    elOitava.textContent = nota.oitava;
    elFrequencia.textContent = `${frequencia.toFixed(1)} Hz`;
    definirPonteiro(nota.cents);
    atualizarCorMostrador(nota.cents);
    avaliarExercicio(nota);
  }

  requestAnimationFrame(loop);
}

function definirPonteiro(cents) {
  const limitado = Math.max(-50, Math.min(50, cents));
  const graus = (limitado / 50) * 45; // -45deg a +45deg
  elPonteiro.style.transform = `rotate(${graus}deg)`;
}

function atualizarCorMostrador(cents) {
  const distancia = Math.abs(cents);
  elMostrador.classList.remove('afinado', 'perto', 'longe');
  if (distancia <= 5) elMostrador.classList.add('afinado');
  else if (distancia <= 20) elMostrador.classList.add('perto');
  else elMostrador.classList.add('longe');
}

elBotaoMic.addEventListener('click', async () => {
  if (rodando) {
    rodando = false;
    desligarMicrofone();
    elBotaoMic.textContent = 'Ligar microfone';
    elStatus.textContent = 'Parado.';
    elNota.textContent = '—';
    elOitava.textContent = '';
    elFrequencia.textContent = '';
    definirPonteiro(0);
    return;
  }
  elBotaoMic.disabled = true;
  const ok = await ligarMicrofone();
  elBotaoMic.disabled = false;
  if (!ok) return;
  rodando = true;
  elBotaoMic.textContent = 'Desligar microfone';
  loop();
});

// --- referência: ouvir a nota alvo ---

function tocarNota(midi, duracao = 1.2) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const ganho = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = notaParaFrequencia(Number(midi));
  ganho.gain.setValueAtTime(0.0001, ctx.currentTime);
  ganho.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.05);
  ganho.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duracao);
  osc.connect(ganho).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duracao + 0.1);
  osc.onended = () => ctx.close();
}

elOuvirAlvo.addEventListener('click', () => tocarNota(elAlvoSelect.value));

// --- exercício guiado: escala maior a partir de uma nota raiz ---

const INTERVALOS_MAIOR = [0, 2, 4, 5, 7, 9, 11, 12];
let sequenciaExercicio = [];
let passoExercicio = 0;
let exercicioAtivo = false;
let tempoNoAlvo = 0;
let ultimoQuadro = null;

function montarSequencia() {
  const raiz = Number(elExercicioRaiz.value);
  sequenciaExercicio = INTERVALOS_MAIOR.map((i) => raiz + i);
}

function iniciarExercicio() {
  montarSequencia();
  passoExercicio = 0;
  exercicioAtivo = true;
  tempoNoAlvo = 0;
  ultimoQuadro = performance.now();
  elExercicioIniciar.disabled = true;
  elExercicioParar.disabled = false;
  elExercicioRaiz.disabled = true;
  mostrarPassoAtual();
  if (!rodando) elBotaoMic.click();
}

function pararExercicio(mensagem) {
  exercicioAtivo = false;
  elExercicioIniciar.disabled = false;
  elExercicioParar.disabled = true;
  elExercicioRaiz.disabled = false;
  elExercicioBarra.style.width = '0%';
  elExercicioAlvo.textContent = '—';
  elExercicioProgresso.textContent = mensagem || 'Pronto para começar.';
}

function mostrarPassoAtual() {
  const midi = sequenciaExercicio[passoExercicio];
  const indice = ((midi % 12) + 12) % 12;
  const oitava = Math.floor(midi / 12) - 1;
  elExercicioAlvo.textContent = `${NOMES_NOTAS[indice]}${oitava}`;
  elExercicioProgresso.textContent = `Nota ${passoExercicio + 1} de ${sequenciaExercicio.length}`;
  tocarNota(midi, 0.8);
}

function avaliarExercicio(notaDetectada) {
  if (!exercicioAtivo) return;
  const agora = performance.now();
  const dt = agora - ultimoQuadro;
  ultimoQuadro = agora;

  const midiAlvo = sequenciaExercicio[passoExercicio];
  const emAfinacao = notaDetectada.midi === midiAlvo && Math.abs(notaDetectada.cents) <= 15;

  if (emAfinacao) {
    tempoNoAlvo += dt;
    elExercicioBarra.style.width = `${Math.min(100, (tempoNoAlvo / 800) * 100)}%`;
    if (tempoNoAlvo >= 800) {
      passoExercicio++;
      tempoNoAlvo = 0;
      elExercicioBarra.style.width = '0%';
      if (passoExercicio >= sequenciaExercicio.length) {
        pararExercicio('Escala completa! Você acertou todas as notas.');
      } else {
        mostrarPassoAtual();
      }
    }
  } else {
    tempoNoAlvo = 0;
    elExercicioBarra.style.width = '0%';
  }
}

elExercicioIniciar.addEventListener('click', iniciarExercicio);
elExercicioParar.addEventListener('click', () => pararExercicio('Exercício interrompido.'));

preencherSeletorDeNotas();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  });
}
