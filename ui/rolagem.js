// O mostrador que rola no tempo: os blocos-alvo andam da direita pra esquerda
// e a sua voz desenha uma linha por cima deles.
//
// POR QUE ISTO SUBSTITUI O PONTEIRO
// Ponteiro de afinador responde a uma pergunta só — "agora estou afinado?" —
// e responde tarde demais pra corrigir. A linha rolando responde a três de
// uma vez: onde a nota que vem está, onde a sua voz está, e pra que lado ela
// está indo. É a forma de retorno visual que a pesquisa de 2021 (Frontiers,
// Wilson et al.) mediu como mais eficaz justamente com iniciantes — e a
// aposta central deste app.
//
// A faixa de tolerância é desenhada, não escondida: dá pra ver a barra
// apertando de ±50 pra ±20 conforme você acerta, e ver isso é metade do
// progresso.

import { nomeDaNota, cifraDaNota, frequenciaParaMidiContinuo } from '../audio/notas.js';

const AGORA_EM = 0.32;      // a linha do "agora" fica a 32% da largura
const MS_VISIVEIS = 6000;   // quanto tempo cabe na tela de uma vez
const CALHA = 68;           // faixa da esquerda onde ficam os nomes das notas
const ALTURA_MINIMA_DO_ROTULO = 13; // abaixo disso os nomes se atropelam

export function criarRolagem(canvas) {
  const ctx = canvas.getContext('2d');
  let largura = 0;
  let altura = 0;
  let escala = 1;

  let centroMidi = 60;
  let faixaSemitons = 11;
  let toleranciaCents = 50;
  let blocos = [];
  const rastro = [];
  let rodando = false;
  // Ensaio às cegas: a voz continua sendo gravada no rastro, só não é
  // desenhada. Quando o ensaio acaba o rastro inteiro aparece de uma vez —
  // é o retorno depois da nota (ver treino/retorno.js).
  let vozVisivel = true;
  let obterTempo = () => performance.now();
  let cores = lerCores();

  function lerCores() {
    const estilo = getComputedStyle(document.documentElement);
    const pega = (nome, padrao) => (estilo.getPropertyValue(nome) || padrao).trim();
    return {
      grade: pega('--borda', '#2a323d'),
      texto: pega('--texto-fraco', '#8b949e'),
      destaque: pega('--destaque', '#e8b04b'),
      afinado: pega('--afinado', '#4fd1a5'),
      longe: pega('--longe', '#e0605a'),
      painel: pega('--painel', '#161b22'),
    };
  }

  function redimensionar() {
    const caixa = canvas.getBoundingClientRect();
    escala = Math.min(window.devicePixelRatio || 1, 2);
    largura = Math.max(1, Math.round(caixa.width));
    altura = Math.max(1, Math.round(caixa.height));
    canvas.width = Math.round(largura * escala);
    canvas.height = Math.round(altura * escala);
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    cores = lerCores();
  }

  function configurar(opcoes = {}) {
    if (Number.isFinite(opcoes.centroMidi)) centroMidi = opcoes.centroMidi;
    if (Number.isFinite(opcoes.faixaSemitons)) faixaSemitons = opcoes.faixaSemitons;
    if (Number.isFinite(opcoes.toleranciaCents)) toleranciaCents = opcoes.toleranciaCents;
  }

  function definirBlocos(novos) {
    blocos = novos || [];
  }

  function limpar() {
    rastro.length = 0;
  }

  // --- conversões --------------------------------------------------------

  function midiParaY(midi) {
    const desvio = midi - centroMidi;
    return altura / 2 - (desvio / faixaSemitons) * altura;
  }

  function centsParaAltura(cents) {
    return (cents / 100 / faixaSemitons) * altura;
  }

  function tempoParaX(t, agora) {
    const pixelsPorMs = largura / MS_VISIVEIS;
    return largura * AGORA_EM + (t - agora) * pixelsPorMs;
  }

  // --- entrada -----------------------------------------------------------

  // Aceita Hz ou MIDI contínuo; null é silêncio, e silêncio corta a linha em
  // vez de ligar dois pedaços que não têm nada a ver um com o outro.
  function amostrar(t, valor, { emHz = true } = {}) {
    let midi = null;
    if (valor !== null && valor !== undefined && valor > 0) {
      midi = emHz ? frequenciaParaMidiContinuo(valor) : valor;
    }
    rastro.push({ t, midi });
    const limite = t - MS_VISIVEIS;
    while (rastro.length && rastro[0].t < limite) rastro.shift();
  }

  // --- desenho -----------------------------------------------------------

  function desenhar() {
    const agora = obterTempo();
    ctx.clearRect(0, 0, largura, altura);

    desenharGrade();
    desenharBlocos(agora);
    if (vozVisivel) desenharRastro(agora);
    desenharAgora();
  }

  function desenharGrade() {
    const primeira = Math.ceil(centroMidi - faixaSemitons / 2);
    const ultima = Math.floor(centroMidi + faixaSemitons / 2);
    const alturaDaLinha = altura / faixaSemitons;

    // Com a tela apertada os nomes se atropelam — a versão anterior empilhava
    // "Dó3" e "C3" em doze linhas de dezessete pixels e virava um borrão. Aqui
    // eles ficam lado a lado numa linha só, e quando nem isso cabe só as
    // naturais são nomeadas: melhor menos rótulos legíveis que todos ilegíveis.
    const cabemTodos = alturaDaLinha >= ALTURA_MINIMA_DO_ROTULO;

    ctx.lineWidth = 1;
    ctx.textBaseline = 'middle';

    for (let midi = primeira; midi <= ultima; midi++) {
      const y = midiParaY(midi);
      // Dó ganha linha mais forte: é a âncora pra achar onde se está
      const ehDo = ((midi % 12) + 12) % 12 === 0;
      const ehAcidente = nomeDaNota(midi).includes('#');

      ctx.strokeStyle = cores.grade;
      ctx.globalAlpha = ehDo ? 0.85 : 0.3;
      ctx.beginPath();
      ctx.moveTo(CALHA, y);
      ctx.lineTo(largura, y);
      ctx.stroke();

      if (!cabemTodos && ehAcidente) continue;

      const alfa = ehDo ? 0.95 : 0.6;
      ctx.fillStyle = ehDo ? cores.destaque : cores.texto;
      ctx.textAlign = 'left';
      ctx.font = '600 11px Inter, system-ui, sans-serif';
      const nome = nomeDaNota(midi);
      const largoDoNome = ctx.measureText(nome).width;
      ctx.globalAlpha = alfa;
      ctx.fillText(nome, 2, y);
      // A cifra vem junto, menor: aprender uma notação não deve custar
      // desaprender a outra, e ver as duas no mesmo lugar é o que ensina.
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.globalAlpha = alfa * 0.6;
      ctx.fillText(cifraDaNota(midi), 6 + largoDoNome, y);
    }
    ctx.globalAlpha = 1;
  }

  function desenharBlocos(agora) {
    for (const bloco of blocos) {
      const x1 = tempoParaX(bloco.inicio, agora);
      const x2 = tempoParaX(bloco.fim, agora);
      if (x2 < CALHA || x1 > largura) continue;

      const y = midiParaY(bloco.midi);
      const meiaFaixa = Math.max(3, centsParaAltura(bloco.toleranciaCents ?? toleranciaCents));
      const corte = Math.max(CALHA, x1);
      const largoVisivel = Math.min(largura, x2) - corte;
      if (largoVisivel <= 0) continue;

      // a faixa de tolerância, que é o que de fato precisa ser acertado
      ctx.fillStyle = bloco.estado === 'errou' ? cores.longe : cores.afinado;
      ctx.globalAlpha = bloco.estado === 'acertou' ? 0.3 : 0.16;
      ctx.fillRect(corte, y - meiaFaixa, largoVisivel, meiaFaixa * 2);

      // a nota exata no meio da faixa
      ctx.globalAlpha = bloco.estado === 'esperando' ? 0.55 : 0.9;
      ctx.fillRect(corte, y - 1.5, largoVisivel, 3);

      ctx.globalAlpha = 1;
      if (x1 > CALHA && x1 < largura - 40) {
        ctx.fillStyle = cores.texto;
        ctx.textAlign = 'left';
        ctx.font = '600 11px Inter, system-ui, sans-serif';
        ctx.fillText(nomeDaNota(bloco.midi), x1 + 4, y - meiaFaixa - 10);
      }
    }
  }

  // Quando a voz sai da janela desenhada — e ela sai justamente no erro mais
  // comum de quem começa, que é entrar na oitava errada — a tela não pode
  // simplesmente ficar vazia. Tela vazia é indistinguível de "não estou
  // ouvindo você", e manda a pessoa cantar mais alto quando o problema é
  // outro. Então a linha encosta na borda e uma seta diz pra que lado, com a
  // distância em semitons.
  function desenharForaDaJanela(midi) {
    const acima = midi > centroMidi;
    const y = acima ? 12 : altura - 12;
    const x = largura * AGORA_EM;
    const distancia = Math.round(Math.abs(midi - centroMidi));

    ctx.fillStyle = cores.longe;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.moveTo(x, acima ? y - 8 : y + 8);
    ctx.lineTo(x - 7, acima ? y + 3 : y - 3);
    ctx.lineTo(x + 7, acima ? y + 3 : y - 3);
    ctx.closePath();
    ctx.fill();

    ctx.font = '600 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${distancia} semitons ${acima ? 'acima' : 'abaixo'}`, x + 14, y);
    ctx.globalAlpha = 1;
  }

  function desenharRastro(agora) {
    if (rastro.length < 2) return;

    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    const meia = faixaSemitons / 2;
    const limitar = (midi) => Math.max(centroMidi - meia, Math.min(centroMidi + meia, midi));

    let desenhando = false;
    ctx.beginPath();
    for (const ponto of rastro) {
      if (ponto.midi === null) { desenhando = false; continue; }
      const x = tempoParaX(ponto.t, agora);
      // Grampeado na borda em vez de sumir: assim dá pra ver *quando* a voz
      // saiu da janela, e não só que ela não está aqui.
      const y = midiParaY(limitar(ponto.midi));
      if (!desenhando) { ctx.moveTo(x, y); desenhando = true; }
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = cores.destaque;
    ctx.stroke();

    // a cabeça da linha: onde a voz está exatamente agora
    const ultimo = rastro[rastro.length - 1];
    if (ultimo && ultimo.midi !== null) {
      const foraDaJanela = Math.abs(ultimo.midi - centroMidi) > meia;
      const x = tempoParaX(ultimo.t, agora);
      const y = midiParaY(limitar(ultimo.midi));
      ctx.fillStyle = foraDaJanela ? cores.longe : corDaCabeca(ultimo.midi, agora);
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fill();
      if (foraDaJanela) desenharForaDaJanela(ultimo.midi);
    }
  }

  // Verde quando a voz está dentro da faixa do bloco que vale agora; âmbar
  // quando está cantando fora de qualquer alvo. É a mesma informação da
  // posição, dita de novo em cor — quem está a dois metros lê a cor antes de
  // ler a posição.
  function corDaCabeca(midi, agora) {
    const ativo = blocos.find((b) => agora >= b.inicio && agora <= b.fim);
    if (!ativo) return cores.destaque;
    const desvioCents = Math.abs(midi - ativo.midi) * 100;
    return desvioCents <= (ativo.toleranciaCents ?? toleranciaCents) ? cores.afinado : cores.longe;
  }

  function desenharAgora() {
    const x = largura * AGORA_EM;
    ctx.strokeStyle = cores.texto;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, altura);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // --- laço --------------------------------------------------------------

  function quadro() {
    if (!rodando) return;
    desenhar();
    requestAnimationFrame(quadro);
  }

  function iniciar(relogio) {
    if (relogio) obterTempo = relogio;
    if (rodando) return;
    rodando = true;
    redimensionar();
    requestAnimationFrame(quadro);
  }

  function parar() {
    rodando = false;
  }

  const aoRedimensionar = () => redimensionar();
  window.addEventListener('resize', aoRedimensionar);
  window.addEventListener('orientationchange', aoRedimensionar);
  redimensionar();

  return {
    configurar,
    definirBlocos,
    amostrar,
    desenhar,
    iniciar,
    parar,
    limpar,
    redimensionar,
    definirVozVisivel(valor) { vozVisivel = !!valor; },
    destruir() {
      parar();
      window.removeEventListener('resize', aoRedimensionar);
      window.removeEventListener('orientationchange', aoRedimensionar);
    },
  };
}
