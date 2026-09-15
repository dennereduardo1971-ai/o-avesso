// O teste inicial: onde a sua voz começa, onde ela acaba, e o quanto ela erra.
//
// É o único lugar do app onde nada é treinado — só medido. Por isso a
// tolerância aqui não anda (fica travada em ±50, a barra do "qualquer ouvinte
// aceita") e cada nota vale uma tentativa só. O que sai daqui é um número
// comparável: "35 cents em setembro, 22 em novembro" só quer dizer alguma
// coisa se as duas medidas tiverem sido feitas do mesmo jeito.
//
// COMO A EXTENSÃO É MEDIDA
// Não pela nota mais extrema que apareceu — um estalo de garganta no fim de um
// grave registraria uma nota que você não canta. O app conta *tempo* por nota:
// só entra na conta a altura que você conseguiu segurar por pelo menos meio
// segundo. É a diferença entre a nota que saiu e a nota que você tem.

import { ligarEscuta, desligarEscuta, aoDetectar, definirFaixa, definirFaixaDeVoz, acordarContexto } from '../audio/motor.js';
import { FREQUENCIA_MINIMA, FREQUENCIA_MAXIMA } from '../audio/yin.js';
import { frequenciaParaMidiContinuo, rotuloDuplo } from '../audio/notas.js';
import { apresentarNota, silenciar } from '../audio/sintese.js';
import { falar } from '../audio/fala.js';
import { lerPerfil, salvarPerfil, gravarSessao } from '../dados/banco.js';
import { criarPerfilDeTreino } from '../treino/perfil.js';
import { criarTolerancia } from '../treino/tolerancia.js';
import { criarExercicioDeAfinacao } from '../treino/exercicios/afinacao.js';
import { notasDeDiagnostico, extensaoDoPerfil, EXTENSAO_PADRAO } from '../treino/voz.js';
import { criarPainelDeExercicio } from '../ui/painel-exercicio.js';
import * as semMaos from '../ui/semmaos.js';

const SEGUNDOS_POR_EXTREMO = 14;
const MS_MINIMOS_NA_NOTA = 500;
const CLAREZA_MINIMA = 0.6;
const TOLERANCIA_DO_TESTE = 50;

export async function montar(raiz, parametros, { ir } = {}) {
  const perfil = await lerPerfil();
  await semMaos.definir(!!perfil.preferencias.semMaos);
  const falaLigada = !!perfil.preferencias.fala;

  let cancelado = false;
  let desinscrever = null;
  let painel = null;
  let exercicio = null;
  // Cada etapa da medida recebe um número. A etapa toca uma nota de
  // referência antes de começar a escutar, e tocar leva uns dois segundos —
  // se a pessoa apertar "já cheguei no meu limite" nesse meio-tempo (e quem
  // treina sem as mãos aperta cedo), a etapa velha voltaria do `await` depois
  // que a nova já começou, roubaria o ouvinte do microfone e, catorze segundos
  // depois, reiniciaria a etapa seguinte por cima dela mesma. O número é o que
  // deixa a etapa velha perceber que já não é a da vez e sair de fininho.
  let etapaAtual = 0;
  const medido = { grave: null, agudo: null };

  function limpar() {
    if (desinscrever) { desinscrever(); desinscrever = null; }
    if (exercicio) { exercicio.parar(); exercicio = null; }
    if (painel) { painel.destruir(); painel = null; }
    silenciar();
    desligarEscuta();
  }

  // --- etapa 0: apresentação ---------------------------------------------

  function mostrarIntro() {
    raiz.innerHTML = `
      <section class="painel">
        <h2>Teste inicial</h2>
        <p class="chamada">Quatro minutos, três partes.</p>
        <ol class="lista-etapas">
          <li><strong>Grave.</strong> Você desce até onde a voz aguentar e segura.</li>
          <li><strong>Agudo.</strong> Mesma coisa, pra cima — sem forçar; o que sai, sai.</li>
          <li><strong>Precisão.</strong> Oito notas: o app toca, você repete.</li>
        </ol>
        <p class="progresso-texto">
          Faça num lugar razoavelmente quieto, com o celular a um ou dois metros.
          Não precisa acertar nada — é medida, não prova.
        </p>
        <button id="comecar" class="botao botao-primario largo">Começar</button>
        <a class="botao largo secundario" href="#/">Agora não</a>
      </section>
    `;
    raiz.querySelector('#comecar').addEventListener('click', async () => {
      await acordarContexto();
      const resultado = await ligarEscuta();
      if (!resultado.ok) {
        raiz.querySelector('#comecar').insertAdjacentHTML(
          'afterend',
          `<p class="aviso">${resultado.motivo}</p>`
        );
        return;
      }
      // A busca fica larga durante a medida: travá-la na faixa de barítono
      // seria decidir de antemão a resposta da pergunta que está sendo feita.
      definirFaixa(FREQUENCIA_MINIMA, FREQUENCIA_MAXIMA);
      medirExtremo('grave');
    });
  }

  // --- etapas 1 e 2: extensão --------------------------------------------

  function medirExtremo(qual) {
    if (cancelado) return;
    const minhaEtapa = ++etapaAtual;
    const grave = qual === 'grave';
    const referencia = grave ? 55 : 64; // Sol3 e Mi4: pontos de partida confortáveis

    raiz.innerHTML = `
      <section class="painel">
        <h2>${grave ? '1 de 3 — sua nota mais grave' : '2 de 3 — sua nota mais aguda'}</h2>
        <p class="chamada" id="instrucao">Ouça a nota de partida…</p>
        <div class="alvo-grande">
          <strong id="atual" class="alvo">—</strong>
          <span class="instrucao">agora</span>
        </div>
        <dl class="medidas">
          <div><dt>${grave ? 'Mais grave que segurou' : 'Mais agudo que segurou'}</dt><dd id="extremo">—</dd></div>
        </dl>
        <div class="barra-progresso"><div id="tempo" class="barra-preenchimento"></div></div>
        <p class="progresso-texto">
          ${grave
            ? 'Cante “ó” e vá descendo devagar. Quando não descer mais, segure a última que sair limpa.'
            : 'Cante “ó” e vá subindo devagar. Pare quando começar a apertar — agudo forçado machuca e não mede nada.'}
        </p>
        <button id="pronto" class="botao largo">Já cheguei no meu limite</button>
      </section>
    `;

    const elAtual = raiz.querySelector('#atual');
    const elExtremo = raiz.querySelector('#extremo');
    const elTempo = raiz.querySelector('#tempo');
    const elInstrucao = raiz.querySelector('#instrucao');

    const tempoPorNota = new Map(); // midi arredondado -> ms segurados
    let ultimoInstante = 0;
    let comecou = 0;
    let laco = null;

    function melhorAteAgora() {
      const validos = [...tempoPorNota.entries()]
        .filter(([, ms]) => ms >= MS_MINIMOS_NA_NOTA)
        .map(([midi]) => midi);
      if (!validos.length) return null;
      return grave ? Math.min(...validos) : Math.max(...validos);
    }

    function receber(leitura) {
      if (leitura.frequencia <= 0 || leitura.clareza < CLAREZA_MINIMA) {
        elAtual.textContent = '—';
        ultimoInstante = 0;
        return;
      }
      const agora = leitura.tempo ?? performance.now();
      const midi = Math.round(frequenciaParaMidiContinuo(leitura.frequencia));
      if (midi < 30 || midi > 90) return;

      const dt = ultimoInstante ? Math.min(agora - ultimoInstante, 120) : 0;
      ultimoInstante = agora;
      tempoPorNota.set(midi, (tempoPorNota.get(midi) || 0) + dt);

      elAtual.textContent = rotuloDuplo(midi);
      const melhor = melhorAteAgora();
      elExtremo.textContent = melhor === null ? '—' : rotuloDuplo(melhor);
    }

    function encerrar() {
      // Só a etapa da vez encerra, e só uma vez: o botão e o fim do tempo
      // podem chegar juntos.
      if (minhaEtapa !== etapaAtual || cancelado) return;
      if (laco) { clearInterval(laco); laco = null; }
      if (desinscrever) { desinscrever(); desinscrever = null; }
      medido[qual] = melhorAteAgora();
      if (grave) medirExtremo('agudo');
      else medirPrecisao();
    }

    (async () => {
      await apresentarNota(referencia, { duracaoPiano: 0.7, duracaoVocal: 1.2 });
      if (cancelado || minhaEtapa !== etapaAtual) return;
      if (falaLigada) {
        falar(grave ? 'Agora desça, devagar, até onde der.' : 'Agora suba, devagar, sem forçar.');
      }
      elInstrucao.textContent = grave ? 'Desça devagar e segure' : 'Suba devagar e segure';

      comecou = performance.now();
      desinscrever = aoDetectar(receber);
      laco = setInterval(() => {
        const fracao = (performance.now() - comecou) / (SEGUNDOS_POR_EXTREMO * 1000);
        elTempo.style.width = `${Math.min(100, fracao * 100)}%`;
        if (fracao >= 1) encerrar();
      }, 100);
    })();

    raiz.querySelector('#pronto').addEventListener('click', encerrar);
  }

  // --- etapa 3: precisão --------------------------------------------------

  function extensaoMedida() {
    const grave = medido.grave;
    const agudo = medido.agudo;
    // Se uma das pontas não saiu (ninguém cantou, ambiente barulhento), cai no
    // padrão de barítono em vez de inventar uma extensão de uma nota só.
    if (!Number.isFinite(grave) || !Number.isFinite(agudo) || agudo - grave < 7) {
      return { ...EXTENSAO_PADRAO, incompleta: true };
    }
    return { midiMinimo: grave, midiMaximo: agudo, incompleta: false };
  }

  async function medirPrecisao() {
    if (cancelado) return;
    etapaAtual++; // qualquer etapa de extensão ainda pendente perde a vez aqui
    const extensao = extensaoMedida();
    definirFaixaDeVoz(extensao.midiMinimo, extensao.midiMaximo);

    const notas = notasDeDiagnostico(extensao, 8);
    const perfilDeTreino = criarPerfilDeTreino(perfil);
    // Travada: mínimo igual ao máximo, então `registrar` nunca move a barra.
    const tolerancia = criarTolerancia({
      inicial: TOLERANCIA_DO_TESTE,
      minima: TOLERANCIA_DO_TESTE,
      maxima: TOLERANCIA_DO_TESTE,
    });

    painel = criarPainelDeExercicio(raiz, { rotuloDeParar: 'Parar o teste' });
    painel.aoPararSessao(() => { ir('#/'); });
    painel.dizerNaTela('3 de 3 — o app toca, você repete.');

    exercicio = criarExercicioDeAfinacao({
      notas,
      tolerancia,
      perfil: perfilDeTreino,
      falaLigada,
      tentativasPorNota: 1,
      aoEvento: async (evento) => {
        painel.aplicarEvento(evento);
        if (evento.tipo === 'fim') await concluir(extensao, perfilDeTreino, evento);
      },
    });
    exercicio.iniciar();
  }

  async function concluir(extensao, perfilDeTreino, evento) {
    const resumo = evento.resumo;
    const agora = Date.now();

    await salvarPerfil({
      extensao: extensao.incompleta
        ? null
        : { midiMinimo: extensao.midiMinimo, midiMaximo: extensao.midiMaximo, medidoEm: agora },
      diagnostico: {
        erroMedioCents: resumo.erroMedioCents,
        acertos: resumo.acertos,
        total: resumo.total,
        feitoEm: agora,
      },
      tolerancia: TOLERANCIA_DO_TESTE,
      ...perfilDeTreino.paraSalvar(),
    });

    await gravarSessao({
      tipo: 'diagnostico',
      duracaoMs: evento.duracaoMs,
      erroMedioCents: resumo.erroMedioCents,
      acertos: resumo.acertos,
      total: resumo.total,
      notaMaisFraca: resumo.notaMaisFraca,
      forasDaNota: resumo.forasDaNota,
      toleranciaFinal: TOLERANCIA_DO_TESTE,
      extensao: extensao.incompleta ? null : { midiMinimo: extensao.midiMinimo, midiMaximo: extensao.midiMaximo },
      tentativas: perfilDeTreino.tentativas,
    });

    limpar();
    if (!cancelado) ir('#/resumo');
  }

  mostrarIntro();

  return () => {
    cancelado = true;
    limpar();
  };
}
