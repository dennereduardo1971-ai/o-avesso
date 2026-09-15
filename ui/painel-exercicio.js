// A parte visual de um exercício: o mostrador rolante, o alvo em letra grande,
// a barra de sustentação e a linha do treinador.
//
// Existe como peça separada porque o teste inicial e o treino mostram a mesma
// coisa — muda o que está sendo medido, não como se vê. Duplicar isto nas duas
// telas seria a forma mais garantida de elas divergirem na terceira alteração.

import { criarRolagem } from './rolagem.js';
import { rotuloDuplo, nomeDaNota } from '../audio/notas.js';

const TEXTO_POR_ESTADO = {
  apresentando: 'Ouça',
  preparando: 'Prepare',
  cantando: 'Cante',
  resultado: '',
  fim: 'Fim',
};

export function criarPainelDeExercicio(raiz, { rotuloDeParar = 'Parar sessão' } = {}) {
  raiz.innerHTML = `
    <section class="painel painel-exercicio">
      <div class="cabeca-exercicio">
        <span id="ex-passo" class="passo">—</span>
        <span id="ex-tolerancia" class="tolerancia" title="Quanto de desvio ainda conta como afinado">±— cents</span>
      </div>

      <div class="alvo-grande">
        <span id="ex-instrucao" class="instrucao">Preparando…</span>
        <strong id="ex-alvo" class="alvo">—</strong>
      </div>

      <div class="moldura-rolagem">
        <canvas id="ex-canvas" class="rolagem"></canvas>
      </div>

      <div class="barra-progresso" aria-hidden="true">
        <div id="ex-barra" class="barra-preenchimento"></div>
      </div>

      <p id="ex-treinador" class="treinador">&nbsp;</p>
      <button id="ex-parar" class="botao largo secundario">${rotuloDeParar}</button>
    </section>
  `;

  const elPasso = raiz.querySelector('#ex-passo');
  const elTolerancia = raiz.querySelector('#ex-tolerancia');
  const elInstrucao = raiz.querySelector('#ex-instrucao');
  const elAlvo = raiz.querySelector('#ex-alvo');
  const elBarra = raiz.querySelector('#ex-barra');
  const elTreinador = raiz.querySelector('#ex-treinador');
  const elParar = raiz.querySelector('#ex-parar');
  const canvas = raiz.querySelector('#ex-canvas');

  const rolagem = criarRolagem(canvas);
  let blocos = [];
  let aoParar = () => {};

  rolagem.iniciar();

  // Um bloco vira histórico assim que sai da tela; guardar todos faria o
  // desenho ficar mais lento a cada nota de uma sessão de vinte minutos.
  function podarBlocos() {
    const limite = performance.now() - 8000;
    blocos = blocos.filter((b) => b.fim > limite);
  }

  function aplicarEvento(evento) {
    if (evento.tipo === 'estado') {
      elPasso.textContent = `Nota ${Math.min(evento.indice + 1, evento.total)} de ${evento.total}` +
        (evento.tentativa > 1 ? ` · tentativa ${evento.tentativa}` : '');
      elTolerancia.textContent = `±${evento.toleranciaCents} cents`;
      elInstrucao.textContent = TEXTO_POR_ESTADO[evento.estado] ?? '';
      if (Number.isFinite(evento.midi)) {
        elAlvo.textContent = rotuloDuplo(evento.midi);
        rolagem.configurar({ centroMidi: evento.midi, toleranciaCents: evento.toleranciaCents });
      }
      if (evento.bloco) {
        // Substitui o bloco da mesma nota em vez de empilhar: ao repetir uma
        // tentativa, o alvo é o mesmo — o que muda é quando ele passa.
        blocos = blocos.filter((b) => b.inicio !== evento.bloco.inicio);
        blocos.push({ ...evento.bloco, estado: 'esperando' });
        podarBlocos();
        rolagem.definirBlocos(blocos);
      }
      if (evento.estado === 'apresentando') {
        elBarra.style.width = '0%';
        rolagem.limpar();
      }
    } else if (evento.tipo === 'amostra') {
      rolagem.amostrar(evento.tempo, evento.frequencia);
      elBarra.style.width = `${Math.round(evento.progresso * 100)}%`;
    } else if (evento.tipo === 'resultado') {
      const ultimo = blocos[blocos.length - 1];
      if (ultimo) ultimo.estado = evento.resultado === 'acertou' ? 'acertou' : 'errou';
      elBarra.style.width = evento.resultado === 'acertou' ? '100%' : '0%';
    } else if (evento.tipo === 'fala') {
      // A linha do treinador é legenda, não decoração: o TTS pode não existir
      // no aparelho, e quem treina de fone com música precisa poder ler.
      elTreinador.textContent = evento.texto;
    } else if (evento.tipo === 'fim') {
      elInstrucao.textContent = 'Fim';
      elAlvo.textContent = '—';
      elBarra.style.width = '0%';
      rolagem.parar();
    }
  }

  elParar.addEventListener('click', () => aoParar());

  return {
    aplicarEvento,
    definirFaixaVisivel(faixaSemitons) { rolagem.configurar({ faixaSemitons }); },
    dizerNaTela(texto) { elTreinador.textContent = texto; },
    definirAlvoManual(midi) { elAlvo.textContent = Number.isFinite(midi) ? rotuloDuplo(midi) : '—'; },
    definirInstrucao(texto) { elInstrucao.textContent = texto; },
    nomeDoAlvo: nomeDaNota,
    aoPararSessao(callback) { aoParar = callback; },
    destruir() { rolagem.destruir(); },
  };
}
