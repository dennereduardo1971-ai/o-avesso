// O afinador livre — a ferramenta que o app era antes de virar treinador.
//
// Ele continua aqui, e continua por fora do treino de propósito: às vezes o
// que se quer não é uma sessão, é conferir uma nota solta, achar o tom de uma
// música ou afinar um violão. Exercício com objetivo e medidor sem objetivo
// são coisas diferentes, e misturar as duas deixaria as duas piores.
//
// O que mudou por dentro: o ponteiro agora é alimentado pelo YIN, então ele
// para de pular oitava no grave. O mostrador em arco é o mesmo.

import { ligarEscuta, desligarEscuta, aoDetectar, criarEstabilizador, definirFaixa, acordarContexto } from '../audio/motor.js';
import { FREQUENCIA_MINIMA, FREQUENCIA_MAXIMA } from '../audio/yin.js';
import { frequenciaParaNota, notasEntre, rotuloDuplo } from '../audio/notas.js';
import { tocarPiano, silenciar } from '../audio/sintese.js';
import { comEscutaPausada } from '../audio/motor.js';

export async function montar(raiz) {
  raiz.innerHTML = `
    <section class="painel" aria-label="Afinador">
      <div id="mostrador" class="mostrador">
        <div class="escala"><span>-50</span><span>0</span><span>+50</span></div>
        <div class="arco"><div id="ponteiro" class="ponteiro"></div></div>
        <div class="leitura">
          <span id="nota" class="nota">—</span><span id="oitava" class="oitava"></span>
        </div>
        <div id="cifra" class="cifra"></div>
        <div id="frequencia" class="frequencia"></div>
      </div>
      <p id="status" class="status">Toque em "Ligar microfone" para começar.</p>
      <button id="botao-mic" class="botao botao-primario largo">Ligar microfone</button>
    </section>

    <section class="painel" aria-label="Nota de referência">
      <h2>Ouvir uma nota</h2>
      <div class="linha">
        <select id="alvo-nota" aria-label="Nota de referência"></select>
        <button id="ouvir-alvo" class="botao">Tocar</button>
      </div>
      <p class="progresso-texto">O microfone pausa enquanto a nota toca, pra que o som do celular não seja lido como se fosse você.</p>
    </section>

    <a class="botao largo secundario" href="#/">Voltar</a>
  `;

  const elStatus = raiz.querySelector('#status');
  const elNota = raiz.querySelector('#nota');
  const elOitava = raiz.querySelector('#oitava');
  const elCifra = raiz.querySelector('#cifra');
  const elFrequencia = raiz.querySelector('#frequencia');
  const elPonteiro = raiz.querySelector('#ponteiro');
  const elMostrador = raiz.querySelector('#mostrador');
  const elBotaoMic = raiz.querySelector('#botao-mic');
  const elAlvo = raiz.querySelector('#alvo-nota');
  const elOuvir = raiz.querySelector('#ouvir-alvo');

  for (const midi of notasEntre(36, 84)) {
    const opcao = document.createElement('option');
    opcao.value = String(midi);
    opcao.textContent = rotuloDuplo(midi);
    if (midi === 60) opcao.selected = true;
    elAlvo.appendChild(opcao);
  }

  // O afinador livre aceita qualquer coisa que se ponha na frente do
  // microfone — voz, violão, apito —, então a faixa fica aberta aqui, ao
  // contrário do treino, que a aperta em volta da voz medida.
  definirFaixa(FREQUENCIA_MINIMA, FREQUENCIA_MAXIMA);

  // Clareza mais frouxa que a do exercício: aqui um sinal meia-boca ainda é
  // informação útil, e não há nota sendo contada como certa ou errada.
  const estabilizador = criarEstabilizador({ clarezaMinima: 0.45, suavizacao: 0.4 });
  let ligado = false;
  let desinscrever = null;
  let ultimoDesenho = 0;

  function mostrarVazio() {
    elNota.textContent = '—';
    elOitava.textContent = '';
    elCifra.textContent = '';
    elFrequencia.textContent = '';
    elPonteiro.style.transform = 'rotate(0deg)';
    elMostrador.classList.remove('afinado', 'perto', 'longe');
  }

  function receber(leitura) {
    const frequencia = estabilizador.empurrar(leitura);
    // O ponteiro é redesenhado no máximo a cada 33 ms. O detector entrega
    // mais que isso e o olho não aproveita — e escrever no DOM a 90 Hz é
    // justamente o tipo de coisa que faz o celular esquentar à toa.
    const agora = leitura.tempo ?? performance.now();
    if (agora - ultimoDesenho < 33) return;
    ultimoDesenho = agora;

    if (!frequencia) {
      elStatus.textContent = 'Escutando… cante ou toque uma nota perto do microfone.';
      mostrarVazio();
      return;
    }

    const nota = frequenciaParaNota(frequencia);
    elStatus.textContent = 'Ouvindo';
    elNota.textContent = nota.nome;
    elOitava.textContent = String(nota.oitava);
    elCifra.textContent = `${nota.cifra}${nota.oitava}`;
    elFrequencia.textContent = `${frequencia.toFixed(1)} Hz · ${nota.cents > 0 ? '+' : ''}${nota.cents} cents`;

    const limitado = Math.max(-50, Math.min(50, nota.cents));
    elPonteiro.style.transform = `rotate(${(limitado / 50) * 45}deg)`;

    const distancia = Math.abs(nota.cents);
    elMostrador.classList.remove('afinado', 'perto', 'longe');
    elMostrador.classList.add(distancia <= 5 ? 'afinado' : distancia <= 20 ? 'perto' : 'longe');
  }

  async function ligar() {
    elBotaoMic.disabled = true;
    elStatus.textContent = 'Pedindo o microfone…';
    const resultado = await ligarEscuta();
    elBotaoMic.disabled = false;
    if (!resultado.ok) {
      elStatus.textContent = resultado.motivo;
      return;
    }
    ligado = true;
    desinscrever = aoDetectar(receber);
    elBotaoMic.textContent = 'Desligar microfone';
    elStatus.textContent = 'Escutando…';
  }

  function desligar() {
    if (desinscrever) { desinscrever(); desinscrever = null; }
    desligarEscuta();
    estabilizador.limpar();
    ligado = false;
    elBotaoMic.textContent = 'Ligar microfone';
    elStatus.textContent = 'Parado.';
    mostrarVazio();
  }

  elBotaoMic.addEventListener('click', () => (ligado ? desligar() : ligar()));

  elOuvir.addEventListener('click', async () => {
    await acordarContexto();
    elOuvir.disabled = true;
    await comEscutaPausada(() => tocarPiano(Number(elAlvo.value), 1.6, 0.45));
    elOuvir.disabled = false;
  });

  return () => {
    if (desinscrever) desinscrever();
    silenciar();
    desligarEscuta();
  };
}
