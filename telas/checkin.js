// "Como está a voz hoje?" — o check-in de 30 segundos antes (e, se quiser,
// depois) de cantar.
//
// Tudo começa em "nada": só se toca no que incomoda. Um formulário que exige
// onze respostas toda vez é um formulário que para de ser preenchido na
// segunda semana.

import { gravarSessao, listarSessoes } from '../dados/banco.js';
import { SINTOMAS, INTENSIDADES, ALERTAS, respostasVazias, avaliar, somaDeSintomas } from '../treino/checkin.js';
import { FLUXO, planoDaSessao } from '../treino/sessao.js';

const UM_DIA = 86400000;

export async function montar(raiz, parametros = {}) {
  const momento = parametros.momento === 'depois' ? 'depois' : 'antes';
  const emFluxo = parametros.fluxo === FLUXO && momento === 'antes';
  const respostas = respostasVazias();

  raiz.innerHTML = `
    <section class="painel destaque-inicial">
      <h2>${momento === 'depois' ? 'Como ficou a voz?' : 'Como está a voz hoje?'}</h2>
      <p class="progresso-texto">Toque só no que você sente. O resto fica em "nada".</p>
      <div class="sintomas">
        ${SINTOMAS.map((s) => `
          <div class="sintoma" data-id="${s.id}">
            <span class="sintoma-nome">${s.nome}</span>
            <div class="escolha" role="group" aria-label="${s.nome}">
              ${INTENSIDADES.map((rotulo, valor) => `
                <button type="button" class="escolha-botao${valor === 0 ? ' marcado' : ''}"
                  data-valor="${valor}" aria-pressed="${valor === 0}">${rotulo}</button>`).join('')}
            </div>
          </div>`).join('')}
      </div>
    </section>

    <section class="painel">
      <h2>Algum destes?</h2>
      ${ALERTAS.map((a) => `
        <label class="opcao">
          <input type="checkbox" data-alerta="${a.id}">
          <span>${a.texto}</span>
        </label>`).join('')}
      <button id="ver" class="botao botao-primario largo">Ver resultado</button>
    </section>

    <a class="botao largo secundario" href="#/">Voltar ao início</a>`;

  raiz.querySelectorAll('.sintoma').forEach((linha) => {
    linha.addEventListener('click', (evento) => {
      const botao = evento.target.closest('.escolha-botao');
      if (!botao) return;
      respostas.sintomas[linha.dataset.id] = Number(botao.dataset.valor);
      linha.querySelectorAll('.escolha-botao').forEach((b) => {
        const marcado = b === botao;
        b.classList.toggle('marcado', marcado);
        b.setAttribute('aria-pressed', String(marcado));
      });
    });
  });

  raiz.querySelectorAll('[data-alerta]').forEach((caixa) => {
    caixa.addEventListener('change', () => { respostas.alertas[caixa.dataset.alerta] = caixa.checked; });
  });

  raiz.querySelector('#ver').addEventListener('click', async () => {
    const resultado = avaliar(respostas);
    const anterior = momento === 'depois' ? await checkinDeAntesDeHoje() : null;
    await gravarSessao({ tipo: 'checkin', momento, ...respostas, nivel: resultado.nivel });
    mostrarResultado(resultado, anterior);
  });

  async function checkinDeAntesDeHoje() {
    const sessoes = await listarSessoes({ limite: 20 });
    return sessoes.find(
      (s) => s.tipo === 'checkin' && s.momento === 'antes' && Date.now() - s.data < UM_DIA
    ) || null;
  }

  function mostrarResultado(resultado, anterior) {
    const comparacao = anterior
      ? `<p class="progresso-texto">Antes de cantar: ${somaDeSintomas(anterior.sintomas)} ponto(s) de incômodo.
           Agora: ${somaDeSintomas(respostas.sintomas)}.</p>`
      : '';

    let proximo;
    const plano = planoDaSessao(resultado.nivel);
    if (emFluxo && plano.segue) {
      proximo = `<a class="botao botao-primario largo" href="#/aquecimento?rotina=${plano.rotina}&fluxo=${FLUXO}&minutos=${plano.minutosDeTreino}">
        Seguir: aquecer ${plano.rotina === 'curta' ? 5 : 10} min e treinar ${plano.minutosDeTreino}</a>`;
    } else if (momento === 'depois') {
      proximo = '<a class="botao botao-primario largo" href="#/">Voltar ao início</a>';
    } else if (resultado.nivel === 'verde') {
      proximo = '<a class="botao botao-primario largo" href="#/aquecimento?rotina=curta">Aquecer 5 minutos</a>';
    } else if (resultado.nivel === 'amarelo') {
      proximo = '<a class="botao botao-primario largo" href="#/aquecimento?rotina=longa">Aquecer 10 minutos, com calma</a>';
    } else {
      proximo = '<a class="botao botao-primario largo" href="#/">Voltar ao início</a>';
    }

    raiz.innerHTML = `
      <section class="painel semaforo ${resultado.nivel}">
        <h2>${momento === 'depois' ? 'Depois de cantar' : 'Hoje'}</h2>
        <p class="semaforo-titulo">${resultado.titulo}</p>
        <ul class="lista-etapas">
          ${resultado.orientacoes.map((o) => `<li>${o}</li>`).join('')}
        </ul>
        ${comparacao}
        ${proximo}
        ${momento === 'depois' || resultado.nivel === 'vermelho' ? '' : '<a class="botao largo secundario" href="#/">Voltar ao início</a>'}
      </section>
      <p class="progresso-texto nota-rodape">
        Isto é triagem pra decidir o dia, não diagnóstico. Na dúvida, fonoaudióloga ou otorrino.
      </p>`;
  }

  return () => {};
}
