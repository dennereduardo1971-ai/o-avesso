// O exercício de afinação: o app dá a nota, você canta, ele diz o que houve.
//
// COMO UMA NOTA ACONTECE
//   1. apresentando — o microfone desliga, o piano toca a nota e o tom vocal
//      a sustenta. Nada é medido aqui; é a hora de ouvir.
//   2. preparando  — o microfone volta e o bloco-alvo aparece à direita da
//      tela, vindo. Um segundo e pouco pra respirar e se posicionar.
//   3. cantando    — o bloco cruza a linha do agora. O que conta é o tempo
//      acumulado dentro da faixa de tolerância enquanto ele cruza.
//   4. resultado   — acertou, errou, ou não saiu som. Errando, o treinador diz
//      pra que lado e repete o tom-alvo, que é a única correção que serve:
//      "subiu demais" sem o tom de novo não ensina onde é.
//
// O bloco na tela e a nota no ouvido são a mesma coisa de propósito: o começo
// e o fim do bloco desenhado são os mesmos instantes que a medição usa. O que
// você vê ser acertado é exatamente o que foi medido — não há uma pontuação
// escondida rodando por trás do desenho.

import { centsAteAlvo, frequenciaParaMidiContinuo, nomeDaNota } from '../../audio/notas.js';
import { apresentarNota, tocarPiano, tocarSinal, silenciar } from '../../audio/sintese.js';
import { aoDetectar, comEscutaPausada } from '../../audio/motor.js';
import { falar } from '../../audio/fala.js';

export const PREPARO_MS = 1300;
export const BLOCO_MS = 3600;
export const SUSTENTAR_MS = 1100;
const RESULTADO_MS = 900;
const CLAREZA_MINIMA = 0.6;
const AMOSTRAS_MINIMAS = 12; // ~meio segundo de voz; menos que isso é "não saiu som"

export function criarExercicioDeAfinacao({
  notas,
  tolerancia,
  perfil,
  aoEvento = () => {},
  falaLigada = true,
  // Treinar é insistir: erra, ouve de novo, tenta de novo, até três vezes.
  // Medir é o contrário — no teste inicial cada nota vale uma tentativa só,
  // senão o número medido seria "quanto você acerta na terceira", que não é
  // o que se quer comparar com o de daqui a três semanas.
  tentativasPorNota = 3,
}) {
  let indice = 0;
  let tentativa = 1;
  let estado = 'parado';
  let inicioDoEstado = 0;
  let inicioDoBloco = 0;
  let fimDoBloco = 0;
  let tempoDentro = 0;
  let ultimaAmostra = 0;
  let amostrasDoBloco = [];
  let ultimoAcertou = false;
  let desinscrever = null;
  let laco = null;
  let parado = false;
  let ocupado = null; // promessa de som/fala em curso; o laço espera por ela
  const comecouEm = Date.now();

  function emitir(evento) {
    try { aoEvento(evento); } catch (erro) { console.error('tela do exercício quebrou', erro); }
  }

  function notaAtual() {
    return notas[indice];
  }

  function irPara(novoEstado) {
    estado = novoEstado;
    inicioDoEstado = performance.now();
    emitir({
      tipo: 'estado',
      estado,
      midi: notaAtual(),
      indice,
      total: notas.length,
      tentativa,
      toleranciaCents: tolerancia.valor,
      bloco: estado === 'preparando' || estado === 'cantando'
        ? { midi: notaAtual(), inicio: inicioDoBloco, fim: fimDoBloco, toleranciaCents: tolerancia.valor }
        : null,
    });
  }

  // --- amostras ----------------------------------------------------------

  function receberLeitura(leitura) {
    if (parado) return;
    const agora = leitura.tempo ?? performance.now();
    const boa = leitura.frequencia > 0 && leitura.clareza >= CLAREZA_MINIMA;
    const alvo = notaAtual();
    const cents = boa ? centsAteAlvo(leitura.frequencia, alvo) : null;
    const dentro = cents !== null && Math.abs(cents) <= tolerancia.valor;

    if (estado === 'cantando') {
      // Só conta o tempo entre duas leituras consecutivas, e no máximo 120 ms
      // por vez — assim uma pausa do detector (o app foi pro segundo plano,
      // o navegador engasgou) não vira crédito de nota sustentada.
      const dt = ultimaAmostra ? Math.min(agora - ultimaAmostra, 120) : 0;
      if (dentro) tempoDentro += dt;
      if (cents !== null) amostrasDoBloco.push(cents);
      ultimaAmostra = agora;
    }

    emitir({
      tipo: 'amostra',
      tempo: agora,
      frequencia: boa ? leitura.frequencia : null,
      midiContinuo: boa ? frequenciaParaMidiContinuo(leitura.frequencia) : null,
      centsDoAlvo: cents,
      dentro,
      progresso: Math.min(1, tempoDentro / SUSTENTAR_MS),
      clareza: leitura.clareza,
    });
  }

  // --- laço de estados ---------------------------------------------------

  function passo() {
    laco = requestAnimationFrame(passo);
    if (parado) return;
    const agora = performance.now();

    if (estado === 'preparando' && agora >= inicioDoBloco) {
      tempoDentro = 0;
      ultimaAmostra = 0;
      amostrasDoBloco = [];
      irPara('cantando');
    } else if (estado === 'cantando' && agora >= fimDoBloco) {
      concluirBloco();
    } else if (estado === 'resultado' && agora - inicioDoEstado >= RESULTADO_MS && !ocupado) {
      avancar();
    }
  }

  // --- avaliação ---------------------------------------------------------

  function mediana(valores) {
    if (!valores.length) return null;
    const ordenado = [...valores].sort((a, b) => a - b);
    const meio = Math.floor(ordenado.length / 2);
    return ordenado.length % 2 ? ordenado[meio] : (ordenado[meio - 1] + ordenado[meio]) / 2;
  }

  function concluirBloco() {
    const alvo = notaAtual();
    // Menos de meio segundo de som no bloco inteiro não é nota errada: é nota
    // que não saiu. Contar isso como desafinação sujaria o número do progresso,
    // que é justamente o que precisa significar alguma coisa daqui a um mês.
    const houveVoz = amostrasDoBloco.length >= AMOSTRAS_MINIMAS;
    const desvioTipico = mediana(amostrasDoBloco);
    const erroAbsoluto = mediana(amostrasDoBloco.map(Math.abs));
    ultimoAcertou = houveVoz && tempoDentro >= SUSTENTAR_MS;

    // O estado muda antes de qualquer som sair: o bipe e a fala saem pelo
    // alto-falante e voltam pelo microfone, e nada disso pode cair na conta.
    irPara('resultado');

    if (!houveVoz) {
      emitir({ tipo: 'resultado', midi: alvo, resultado: 'silencio', tentativa });
      dizer('Não ouvi nada. Cante mais perto do celular.');
      return;
    }

    // Mais de um trítono de distância não é desafinação, é outra nota — e na
    // prática é quase sempre a oitava errada, que é o erro mais comum de quem
    // está começando e ainda não sabe em que altura a própria voz entra.
    // Medir isso em cents e jogar na média destruiria o número: um deslize de
    // oitava vale 1200, e uma sessão inteira de afinação boa vale uns 25.
    const foraDaNota = !ultimoAcertou && erroAbsoluto > 600;

    const ajuste = tolerancia.registrar(ultimoAcertou);
    perfil.registrar(alvo, {
      acertou: ultimoAcertou,
      erroCents: foraDaNota ? null : erroAbsoluto,
      foraDaNota,
    });

    emitir({
      tipo: 'resultado',
      midi: alvo,
      resultado: ultimoAcertou ? 'acertou' : foraDaNota ? 'outra-nota' : 'errou',
      erroCents: foraDaNota ? null : erroAbsoluto,
      desvioCents: desvioTipico,
      tempoDentro,
      tentativa,
      toleranciaCents: tolerancia.valor,
      toleranciaMudou: ajuste.direcao,
    });

    tocarSinal(ultimoAcertou ? 'acerto' : 'erro');
    dizer(frasePara({ acertou: ultimoAcertou, foraDaNota, desvioTipico, amostras: amostrasDoBloco, ajuste, alvo }));
  }

  // O treinador é exigente mas não é vago: toda correção diz o lado. "Quase"
  // não ensina ninguém a achar a nota.
  function frasePara({ acertou, foraDaNota, desvioTipico, amostras, ajuste, alvo }) {
    if (acertou) {
      if (ajuste.direcao === 'apertou') return `Isso. Apertei a barra: agora ${ajuste.valor} cents.`;
      return ['Isso.', 'Essa é.', 'Boa.'][indice % 3];
    }

    // Quem canta a oitava errada não precisa ouvir "está alto": precisa ouvir
    // que errou de nota, senão vai corrigir alguns cents e continuar longe.
    if (foraDaNota) {
      const oitava = Math.abs(Math.abs(desvioTipico) - 1200) < 150;
      const lado = desvioTipico < 0 ? 'abaixo' : 'acima';
      return oitava
        ? `Essa é a oitava ${lado}. A nota é ${nomeDaNota(alvo)} — ouça de novo.`
        : `Essa é outra nota. A minha é ${nomeDaNota(alvo)} — ouça de novo.`;
    }

    const espalhamento = amostras.length ? Math.max(...amostras) - Math.min(...amostras) : 0;
    // Oscilar em torno do alvo é um problema diferente de estar parado no
    // lugar errado, e a correção também é diferente.
    if (Math.abs(desvioTipico) < 35 && espalhamento > 90) {
      return 'Está oscilando. Segure a nota parada.';
    }
    if (desvioTipico < 0) return `Está baixo. Suba. ${nomeDaNota(alvo)} é assim.`;
    return `Está alto. Desça. ${nomeDaNota(alvo)} é assim.`;
  }

  // A fala demora mais que os 900 ms do estado de resultado, e o laço espera
  // por ela: avançar por cima da própria voz faria o piano da nota seguinte
  // tocar em cima da correção da nota anterior.
  function dizer(texto) {
    emitir({ tipo: 'fala', texto });
    if (!falaLigada) return;
    ocupado = falar(texto).finally(() => { ocupado = null; });
  }

  // --- avanço ------------------------------------------------------------

  function avancar() {
    const alvo = notaAtual();

    if (!ultimoAcertou && tentativa < tentativasPorNota) {
      tentativa++;
      apresentarEEsperar(alvo, { repetindo: true });
      return;
    }

    indice++;
    tentativa = 1;
    if (indice >= notas.length) { terminar(); return; }
    apresentarEEsperar(notaAtual());
  }

  // Apresentar é assíncrono (o som leva tempo) e o laço de estados é síncrono.
  // `ocupado` é o que impede o laço de andar enquanto o piano ainda toca.
  function apresentarEEsperar(midi, { repetindo = false } = {}) {
    irPara('apresentando');
    ocupado = (repetindo ? repetirTomAlvo(midi) : apresentarNota(midi))
      .catch((erro) => console.error('som-guia falhou', erro))
      .then(() => {
        ocupado = null;
        if (parado) return;
        // O bloco é marcado no relógio agora, não quando ele começar a valer:
        // é isso que faz o alvo aparecer à direita e *vir vindo* na tela, em
        // vez de nascer já em cima da linha do agora.
        inicioDoBloco = performance.now() + PREPARO_MS;
        fimDoBloco = inicioDoBloco + BLOCO_MS;
        irPara('preparando');
      });
  }

  // Na repetição o tom-alvo volta mais curto: quem está tentando de novo já
  // ouviu a apresentação inteira e precisa é da referência, não da aula.
  function repetirTomAlvo(midi) {
    return comEscutaPausada(() => tocarPiano(midi, 0.7));
  }

  // --- ciclo de vida -----------------------------------------------------

  function iniciar() {
    if (!notas || !notas.length) { terminar(); return; }
    parado = false;
    indice = 0;
    tentativa = 1;
    ultimoAcertou = false;
    desinscrever = aoDetectar(receberLeitura);
    laco = requestAnimationFrame(passo);
    apresentarEEsperar(notas[0]);
  }

  function terminar() {
    if (parado) return;
    parado = true;
    if (laco) cancelAnimationFrame(laco);
    if (desinscrever) desinscrever();
    laco = null;
    desinscrever = null;
    estado = 'fim';
    silenciar();

    emitir({
      tipo: 'fim',
      resumo: perfil.resumoDaSessao(),
      duracaoMs: Date.now() - comecouEm,
      toleranciaFinal: tolerancia.valor,
    });
  }

  return {
    iniciar,
    parar: terminar,
    get estado() { return estado; },
    get indice() { return indice; },
    get total() { return notas.length; },
  };
}

// Quanto uma nota custa, em média: preparo, bloco, resultado e a apresentação
// (piano mais tom vocal, uns 3,4 s).
export const DURACAO_POR_NOTA_MS = PREPARO_MS + BLOCO_MS + RESULTADO_MS + 3400;

// De "tenho 10 minutos" para "então são tantas notas".
//
// A folga de 40 % existe porque nota errada é repetida, e quem está começando
// erra bastante — sem ela uma sessão de dez minutos pedida viraria quinze
// cantados, que é exatamente o tipo de coisa que faz a pessoa desistir de
// treinar no intervalo do almoço. Errar por baixo é melhor: sessão que acaba
// antes deixa a opção de fazer outra. (Na Fase 2 quem faz esta conta é o
// planejador, que também escolhe *quais* exercícios cabem no tempo.)
export function notasQueCabemEm(minutos) {
  const comRepeticoes = DURACAO_POR_NOTA_MS * 1.4;
  return Math.max(4, Math.round((minutos * 60000) / comRepeticoes));
}
