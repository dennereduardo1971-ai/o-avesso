// O aquecimento guiado: o celular apoiado ao lado, a contagem andando sozinha,
// e um bipe mais o nome da etapa quando ela troca. Com o canudo na boca não dá
// pra tocar na tela, então nada aqui exige toque depois do "começar".
//
// Não há microfone nesta tela — o app só fala e toca, então a regra de nunca
// escutar e tocar ao mesmo tempo não entra em jogo.

import { acordarContexto } from '../audio/motor.js';
import { tocarSinal, silenciar } from '../audio/sintese.js';
import { falar, calar, definirLigada } from '../audio/fala.js';
import { lerPerfil, gravarSessao } from '../dados/banco.js';
import {
  ROTINAS,
  duracaoTotal,
  precisaDeCanudo,
  posicaoNoTempo,
  inicioDaEtapa,
} from '../treino/aquecimento.js';
import * as semMaos from '../ui/semmaos.js';
import { FLUXO } from '../treino/sessao.js';

function relogio(segundos) {
  const s = Math.max(0, Math.ceil(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export async function montar(raiz, parametros = {}) {
  const perfil = await lerPerfil();
  definirLigada(!!perfil.preferencias.fala);
  const rotina = ROTINAS[parametros.rotina];
  const emFluxo = parametros.fluxo === FLUXO;
  const minutosDoFluxo = Math.max(2, Math.min(40, Number(parametros.minutos) || 10));

  if (!rotina) {
    mostrarEscolha();
    return () => {};
  }

  // O modo sem mãos aqui é obrigatório, não preferência: sem a trava de tela o
  // celular apaga no meio do canudo. Ao sair, volta ao que a pessoa escolheu.
  const semMaosAntes = !!perfil.preferencias.semMaos;
  let intervalo = null;
  let inicioEm = 0;          // Date.now() do último "continuar"
  let acumulado = 0;         // segundos já cumpridos antes da última pausa
  let pausado = false;
  let etapaAnunciada = -1;
  let encerrado = false;
  let gravado = false;

  mostrarPreparo();

  function mostrarEscolha() {
    const cartao = (r) => `
      <a class="botao largo ${r.id === 'curta' ? 'botao-primario' : ''}" href="#/aquecimento?rotina=${r.id}">
        ${r.nome}
      </a>
      <p class="progresso-texto">${r.descricao}</p>`;
    raiz.innerHTML = `
      <section class="painel destaque-inicial">
        <h2>Aquecer a voz</h2>
        ${cartao(ROTINAS.curta)}
        ${cartao(ROTINAS.longa)}
      </section>
      <section class="painel">
        <h2>Depois de cantar</h2>
        ${cartao(ROTINAS.desaquecer)}
      </section>
      <a class="botao largo secundario" href="#/">Voltar ao início</a>`;
  }

  function mostrarPreparo() {
    const canudo = precisaDeCanudo(rotina)
      ? `<p class="chamada">Separe um <strong>canudo comum</strong> (não o fininho de café) e um
           <strong>copo com 2 a 5 cm de água</strong>.</p>`
      : '';
    raiz.innerHTML = `
      <section class="painel destaque-inicial">
        <h2>${rotina.nome}</h2>
        ${canudo}
        <ol class="lista-etapas">
          ${rotina.etapas.map((e) => `<li><strong>${e.titulo}</strong> · ${relogio(e.segundos)}</li>`).join('')}
        </ol>
        <p class="progresso-texto">
          Apoie o celular onde dê pra ver. A contagem anda sozinha, e um bipe
          avisa a troca de etapa.
        </p>
        <button id="comecar" class="botao botao-primario largo">Começar</button>
        <a class="botao largo secundario" href="#/aquecimento">Outra rotina</a>
      </section>`;
    raiz.querySelector('#comecar').addEventListener('click', comecar);
  }

  async function comecar() {
    // o toque do "começar" é o gesto que o navegador exige pra liberar o som
    await acordarContexto();
    await semMaos.ativar();

    raiz.innerHTML = `
      <section class="painel painel-exercicio aquecimento">
        <div class="cabeca-exercicio">
          <span id="contador-etapa"></span>
          <span id="restante-total"></span>
        </div>
        <h2 id="titulo-etapa" class="etapa-titulo"></h2>
        <p id="contagem" class="numero-grande contagem"></p>
        <p id="instrucao" class="etapa-instrucao"></p>
        <p id="proxima" class="progresso-texto proxima-etapa"></p>
        <div class="barra-progresso"><div id="barra" class="barra-preenchimento"></div></div>
        <div class="linha controles-aquecimento">
          <button id="pausar" class="botao">Pausar</button>
          <button id="pular" class="botao">Pular etapa</button>
          <button id="parar" class="botao secundario">Encerrar</button>
        </div>
      </section>`;

    raiz.querySelector('#pausar').addEventListener('click', alternarPausa);
    raiz.querySelector('#pular').addEventListener('click', pular);
    raiz.querySelector('#parar').addEventListener('click', () => terminar(false));

    inicioEm = Date.now();
    intervalo = setInterval(atualizar, 200);
    atualizar();
  }

  function decorrido() {
    return acumulado + (pausado ? 0 : (Date.now() - inicioEm) / 1000);
  }

  function atualizar() {
    if (encerrado) return;
    const pos = posicaoNoTempo(rotina, decorrido());
    if (pos.terminou) { terminar(true); return; }

    const etapa = rotina.etapas[pos.indice];
    const seguinte = rotina.etapas[pos.indice + 1];
    const q = (id) => raiz.querySelector(id);

    q('#contador-etapa').textContent = `Etapa ${pos.indice + 1} de ${rotina.etapas.length}`;
    q('#restante-total').textContent = `faltam ${relogio(duracaoTotal(rotina) - decorrido())}`;
    q('#contagem').textContent = relogio(pos.restanteNaEtapa);
    q('#barra').style.width = `${(pos.fracaoTotal * 100).toFixed(1)}%`;

    if (pos.indice !== etapaAnunciada) {
      etapaAnunciada = pos.indice;
      q('#titulo-etapa').textContent = etapa.titulo;
      q('#instrucao').textContent = etapa.instrucao;
      q('#proxima').textContent = seguinte ? `Depois: ${seguinte.titulo}` : 'Última etapa';
      anunciar(etapa, pos.indice === 0);
    }
  }

  async function anunciar(etapa, primeira) {
    if (!primeira) await tocarSinal('acerto');
    await falar(etapa.titulo);
  }

  function alternarPausa() {
    const botao = raiz.querySelector('#pausar');
    if (pausado) {
      pausado = false;
      inicioEm = Date.now();
      botao.textContent = 'Pausar';
    } else {
      acumulado = decorrido();
      pausado = true;
      calar();
      botao.textContent = 'Continuar';
    }
  }

  function pular() {
    const pos = posicaoNoTempo(rotina, decorrido());
    acumulado = inicioDaEtapa(rotina, pos.indice + 1);
    inicioEm = Date.now();
    atualizar();
  }

  async function guardar(completa) {
    if (gravado) return;
    gravado = true;
    await gravarSessao({
      tipo: 'aquecimento',
      rotina: rotina.id,
      completa,
      segundos: Math.round(Math.min(decorrido(), duracaoTotal(rotina))),
    });
  }

  async function terminar(completa) {
    if (encerrado) return;
    encerrado = true;
    clearInterval(intervalo);
    intervalo = null;
    calar();
    await guardar(completa);
    // A contagem acabou: a tela de "pronto" é lida de perto, com o celular na
    // mão — volta a letra e a trava de tela ao que a pessoa escolheu.
    await semMaos.definir(semMaosAntes);

    const depois = rotina.id === 'desaquecer';
    if (completa) {
      tocarSinal('acerto');
      falar(depois ? 'Pronto. Descanse a voz.' : 'Voz aquecida. Bom canto.');
    }

    raiz.innerHTML = `
      <section class="painel destaque-inicial">
        <h2>${completa ? 'Pronto' : 'Encerrado'}</h2>
        <p class="chamada">${
          depois
            ? 'Voz desaquecida. Um gole de água, e silêncio por uns minutos se der.'
            : completa
              ? 'Voz aquecida. Pode cantar.'
              : 'Tudo bem parar no meio: o que foi feito já conta.'
        }</p>
        ${depois
          ? '<a class="botao botao-primario largo" href="#/checkin?momento=depois">Como ficou a voz?</a>'
          : emFluxo
            ? `<a class="botao botao-primario largo" href="#/treino?minutos=${minutosDoFluxo}">Seguir: treinar ${minutosDoFluxo} minutos</a>`
            : '<a class="botao botao-primario largo" href="#/treino">Treinar afinação</a>'}
        <a class="botao largo secundario" href="#/">Voltar ao início</a>
      </section>`;
  }

  return async () => {
    encerrado = true;
    if (intervalo) clearInterval(intervalo);
    calar();
    silenciar();
    // saiu no meio (voltou pelo navegador, trocou de tela): registra o que deu
    if (etapaAnunciada >= 0 && !gravado) await guardar(false);
    await semMaos.definir(semMaosAntes);
  };
}
