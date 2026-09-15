// A sessão de treino: uma fila de notas montada agora, pro tempo que você tem
// agora.
//
// Não existe "programa de 30 dias" aqui, e isso é decisão de projeto, não
// preguiça: o tempo por dia varia de cinco a quarenta minutos, o lugar varia
// entre carro, casa cheia e casa vazia, e um plano fixo quebra no terceiro dia
// em que a vida não colabora. O que o app pergunta é só quanto tempo há hoje.
//
// Quais notas entram na fila vem do perfil: as que você mais erra primeiro, o
// resto espalhado pela sua tessitura, e o passaggio por último — quando a voz
// já está quente. (Na Fase 2 o planejador também vai perguntar se dá pra
// cantar alto agora, e trocar o exercício inteiro por um de ouvido quando não
// der.)

import { ligarEscuta, desligarEscuta, definirFaixaDeVoz, acordarContexto } from '../audio/motor.js';
import { silenciar } from '../audio/sintese.js';
import { lerPerfil, salvarPerfil, gravarSessao } from '../dados/banco.js';
import { criarPerfilDeTreino } from '../treino/perfil.js';
import { criarTolerancia } from '../treino/tolerancia.js';
import { criarExercicioDeAfinacao, notasQueCabemEm } from '../treino/exercicios/afinacao.js';
import { notasDeTreino, extensaoDoPerfil } from '../treino/voz.js';
import { criarPainelDeExercicio } from '../ui/painel-exercicio.js';
import * as semMaos from '../ui/semmaos.js';

const MINUTOS_PADRAO = 10;

export async function montar(raiz, parametros = {}, { ir } = {}) {
  const minutos = Math.max(2, Math.min(40, Number(parametros.minutos) || MINUTOS_PADRAO));
  const perfil = await lerPerfil();
  await semMaos.definir(!!perfil.preferencias.semMaos);

  let cancelado = false;
  let painel = null;
  let exercicio = null;

  function limpar() {
    if (exercicio) { exercicio.parar(); exercicio = null; }
    if (painel) { painel.destruir(); painel = null; }
    silenciar();
    desligarEscuta();
  }

  // --- pedir o microfone antes de qualquer outra coisa --------------------

  raiz.innerHTML = `
    <section class="painel">
      <h2>Sessão de ${minutos} minutos</h2>
      <p class="chamada" id="aviso">Preciso do microfone pra começar.</p>
      <p class="progresso-texto">
        Apoie o celular a um ou dois metros, de pé se der. Não precisa tocar em
        nada durante a sessão: o app avança sozinho.
      </p>
      <button id="comecar" class="botao botao-primario largo">Começar</button>
      <a class="botao largo secundario" href="#/">Voltar</a>
    </section>
  `;

  raiz.querySelector('#comecar').addEventListener('click', async () => {
    const botao = raiz.querySelector('#comecar');
    botao.disabled = true;
    await acordarContexto();
    const resultado = await ligarEscuta();
    if (!resultado.ok) {
      raiz.querySelector('#aviso').textContent = resultado.motivo;
      raiz.querySelector('#aviso').classList.add('aviso');
      botao.disabled = false;
      return;
    }
    if (!cancelado) comecar();
  });

  // --- a sessão -----------------------------------------------------------

  function comecar() {
    const extensao = extensaoDoPerfil(perfil);
    definirFaixaDeVoz(extensao.midiMinimo, extensao.midiMaximo);

    const perfilDeTreino = criarPerfilDeTreino(perfil);
    const fracas = perfilDeTreino.notasFracas(4).map((n) => n.midi);
    const notas = notasDeTreino(extensao, { notasFracas: fracas, quantidade: notasQueCabemEm(minutos) });

    // A barra retoma de onde parou na última sessão em vez de voltar pro
    // começo: quem já chegou a ±30 não precisa reconquistar isso toda vez.
    const tolerancia = criarTolerancia({ inicial: perfil.tolerancia });

    painel = criarPainelDeExercicio(raiz, { rotuloDeParar: 'Encerrar sessão' });
    painel.aoPararSessao(() => encerrar());

    exercicio = criarExercicioDeAfinacao({
      notas,
      tolerancia,
      perfil: perfilDeTreino,
      falaLigada: !!perfil.preferencias.fala,
      aoEvento: async (evento) => {
        if (cancelado) return;
        painel.aplicarEvento(evento);
        if (evento.tipo === 'fim') await guardar(perfilDeTreino, evento);
      },
    });

    exercicio.iniciar();
  }

  // Encerrar no meio ainda grava: quinze notas cantadas valem tanto quanto as
  // vinte planejadas, e perder isso porque o ônibus chegou seria bobagem.
  // `parar()` dispara o evento 'fim', e é o 'fim' que grava — um caminho só.
  function encerrar() {
    if (exercicio) exercicio.parar();
    else ir('#/');
  }

  async function guardar(perfilDeTreino, evento) {
    const resumo = evento.resumo;
    await salvarPerfil({
      tolerancia: evento.toleranciaFinal,
      ...perfilDeTreino.paraSalvar(),
    });
    await gravarSessao({
      tipo: 'afinacao',
      duracaoMs: evento.duracaoMs,
      minutosPedidos: minutos,
      erroMedioCents: resumo.erroMedioCents,
      acertos: resumo.acertos,
      total: resumo.total,
      notaMaisFraca: resumo.notaMaisFraca,
      forasDaNota: resumo.forasDaNota,
      toleranciaFinal: evento.toleranciaFinal,
      tentativas: perfilDeTreino.tentativas,
    });
    limpar();
    if (!cancelado) ir('#/resumo');
  }

  return () => {
    cancelado = true;
    limpar();
  };
}
