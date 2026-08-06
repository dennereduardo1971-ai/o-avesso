// motor.js — o estado de uma partida, e o que pode acontecer com ele.
//
// Este arquivo não sabe nada sobre o Duque: recebe um caso (caso-duque.js) e
// opera em cima dele. Também não toca em DOM. Quem desenha é a tela; quem
// decide se cabe dado é regras.js. Aqui mora só a memória do jogo.
//
// ONDE FICA O SAVE
// Pessoal (`shared: false`), chave `o-avesso-partida`. O formato já nasce com
// `mesa` e `jogador` preenchidos mesmo em partida solo — quando o co-op entrar,
// o que muda é o lugar de gravar, não a forma do save.
//
// LIGAÇÃO COM O COMPANION
// A partida não inventa uma ficha paralela: ao criar a Visitante, ela grava na
// mesma chave que a tela Ficha da Visitante lê. Jogar preenche a ficha.

import { db } from '../db.js';
import { clampAtributo, testarAtributo, ferramenta } from '../regras.js';
import { pistaById, cenaById, conferirRegraDeOuro } from './caso-duque.js';
import { dialogoDe, acharAssunto } from './dialogos-duque.js';

export const PARTIDA_KEY = 'o-avesso-partida';
// exatamente a chave que scripts/ficha.js lê — se as duas divergirem, jogar
// deixa de preencher a ficha e ninguém percebe, porque nada quebra
export const FICHA_KEY = 'o-avesso-ficha-personagem';

export const LINHA_MAX = 5;
export const VERSAO_SAVE = 1;

/* ---- criação da Visitante --------------------------------------------------
   Três perguntas em vez de três campos numéricos. Cada resposta dá +1 a um
   atributo; todos começam em 1, então a distribuição final soma 6 dentro da
   faixa 1–4 do Manual §3 — e ninguém precisa entender a matemática pra
   escolher quem é. */

export const PERGUNTAS_PROLOGO = [
  {
    id: 'infancia',
    pergunta: 'Quando criança, o que te metia em encrenca?',
    opcoes: [
      { texto: 'Reparar em coisas que os adultos preferiam que eu não reparasse.', atributo: 'agulha' },
      { texto: 'Não largar o osso, mesmo quando doía.', atributo: 'dedal' },
      { texto: 'Perguntar "por quê" até alguém perder a paciência.', atributo: 'linha' }
    ]
  },
  {
    id: 'medo',
    pergunta: 'Do que você tem mais medo, de verdade?',
    opcoes: [
      { texto: 'De deixar passar o detalhe que mudava tudo.', atributo: 'agulha' },
      { texto: 'De não aguentar até o fim.', atributo: 'dedal' },
      { texto: 'De descobrir que eu estava errada o tempo todo.', atributo: 'linha' }
    ]
  },
  {
    id: 'espelho',
    pergunta: 'Você está diante do Espelho de Moldura de Linha. Por que atravessa?',
    opcoes: [
      { texto: 'Porque tem alguma coisa errada nele, e eu preciso ver o quê.', atributo: 'agulha' },
      { texto: 'Porque não voltar atrás é a única coisa que eu sei fazer.', atributo: 'dedal' },
      { texto: 'Porque um espelho que dá passagem é um problema, e problemas se resolvem.', atributo: 'linha' }
    ]
  }
];

/** Monta a Visitante a partir das escolhas do prólogo. */
export function montarVisitante(nome, escolhas) {
  const attrs = { agulha: 1, dedal: 1, linha: 1 };
  (escolhas || []).forEach((chave) => {
    if (attrs[chave] !== undefined) attrs[chave] += 1;
  });
  return {
    nome: String(nome || '').trim().slice(0, 40) || 'Visitante',
    agulha: clampAtributo(attrs.agulha),
    dedal: clampAtributo(attrs.dedal),
    linha: clampAtributo(attrs.linha)
  };
}

/* ---- o save ---------------------------------------------------------------- */

function partidaVazia() {
  return {
    versao: VERSAO_SAVE,
    mesa: 'solo',
    jogador: null,
    visitante: null,
    caso: 'duque-desfiado',
    cena: null,
    linha: LINHA_MAX,
    pistas: [],
    // "ponto:ferramenta" que já foram usados — o que você já viu não some
    examinados: [],
    // moradorId -> ids de tópicos já perguntados
    topicos: {},
    // tópicos ocultos que foram destravados
    abertos: [],
    // quem você já encontrou em cena
    conhecidos: [],
    // pistas que sobrevivem a virar boneca: o Avesso lembra, você não
    lembrancas: [],
    desfecho: null,
    registro: [],
    atualizado: null
  };
}

/** Preenche o que faltar num save antigo, sem apagar o que já existe. */
function normalizarPartida(bruto) {
  const base = partidaVazia();
  if (!bruto || typeof bruto !== 'object') return base;
  const p = Object.assign(base, bruto);
  ['pistas', 'examinados', 'abertos', 'conhecidos', 'lembrancas', 'registro'].forEach((k) => {
    if (!Array.isArray(p[k])) p[k] = [];
  });
  if (!p.topicos || typeof p.topicos !== 'object') p.topicos = {};
  p.linha = Math.max(0, Math.min(LINHA_MAX, parseInt(p.linha, 10) || 0));
  return p;
}

export async function carregarPartida() {
  let guardado = null;
  try {
    guardado = await db.get(PARTIDA_KEY, false);
  } catch (e) {
    guardado = null;
  }
  return guardado ? normalizarPartida(guardado) : null;
}

// o que a Ficha já sabe. Sem isto, toda ação do jogo gravaria a ficha de novo
// só pra reescrever os mesmos números — duas escritas no banco por clique.
let linhaEspelhada = null;

export async function salvarPartida(partida) {
  partida.atualizado = new Date().toISOString();
  await db.set(PARTIDA_KEY, partida, false);

  if (partida.visitante && partida.linha !== linhaEspelhada) {
    linhaEspelhada = partida.linha;
    await espelharNaFicha(partida);
  }
  return partida;
}

/**
 * Começa uma partida. `lembrancas` vem de uma partida anterior perdida: quem
 * virou boneca recomeça o caso, mas as pistas que já tinha descoberto voltam
 * marcadas — o Avesso lembra, você não.
 */
export async function novaPartida(visitante, caso, lembrancas = []) {
  const p = partidaVazia();
  p.visitante = visitante;
  p.caso = caso.id;
  p.cena = caso.cenaInicial;
  p.lembrancas = Array.from(new Set(lembrancas));
  registrar(p, `${visitante.nome} atravessou o Espelho de Moldura de Linha.`);

  linhaEspelhada = null;   // partida nova: a Ficha precisa ser reescrita
  await salvarPartida(p);
  return p;
}

/**
 * A partida escreve na Ficha da Visitante do companion, em vez de manter uma
 * cópia própria: quem jogar chega na Ficha e encontra a personagem já lá.
 *
 * Os atributos vão como **texto**, que é o formato que a Ficha guarda (os
 * campos dela são `<input type="text">`). Mandar número faz a tela abrir com
 * campo vazio, sem erro nenhum — o tipo de bug que só aparece olhando.
 *
 * Falhar aqui não pode derrubar o jogo: a ficha é conveniência, o save é a
 * verdade.
 *
 * @param {object} visitante
 * @param {number} [logica]  Linha da Lógica atual, quando houver partida
 */
async function gravarFicha(visitante, logica = LINHA_MAX) {
  try {
    const atual = (await db.get(FICHA_KEY, false)) || {};
    await db.set(FICHA_KEY, Object.assign({}, atual, {
      nome: visitante.nome,
      agulha: String(visitante.agulha),
      dedal: String(visitante.dedal),
      linha: String(visitante.linha),
      logica: logica
    }), false);
  } catch (e) {
    /* sem espelho não tem ficha, e tudo bem */
  }
}

/**
 * Mantém a Ficha em dia com a partida. Chamado quando a Linha da Lógica muda:
 * quem abre a Ficha depois de perder um ponto tem que ver o ponto perdido.
 */
export async function espelharNaFicha(partida) {
  if (!partida || !partida.visitante) return;
  await gravarFicha(partida.visitante, partida.linha);
}

export function registrar(partida, texto) {
  partida.registro.push({ t: Date.now(), texto: String(texto) });
  if (partida.registro.length > 200) partida.registro.shift();
}

/* ---- pistas ---------------------------------------------------------------- */

export function temPista(partida, id) {
  return partida.pistas.includes(id);
}

/** @returns {object|null} a pista, se ela é nova; null se já estava na mão. */
export function darPista(partida, id) {
  if (!id || temPista(partida, id)) return null;
  const pista = pistaById(id);
  if (!pista) return null;
  partida.pistas.push(id);
  registrar(partida, `Pista: ${pista.titulo}`);
  return pista;
}

export function pistasNaMao(partida) {
  return partida.pistas.map(pistaById).filter(Boolean);
}

/* ---- Linha da Lógica --------------------------------------------------------
   Zerar não mata: vira boneca (Manual §4). É o desfecho ruim, e é definitivo
   para aquela partida — mas as pistas viram lembrança para a próxima. */

export function perderLinha(partida, quanto = 1) {
  partida.linha = Math.max(0, partida.linha - quanto);
  if (partida.linha === 0 && !partida.desfecho) {
    partida.desfecho = { tipo: 'boneca', em: Date.now() };
    registrar(partida, 'A Linha da Lógica acabou. A costura te alcançou.');
  }
  return partida.linha;
}

export function recuperarLinha(partida, quanto = 1) {
  partida.linha = Math.min(LINHA_MAX, partida.linha + quanto);
  return partida.linha;
}

/* ---- examinar --------------------------------------------------------------
   O coração do loop. Devolve o que a tela precisa mostrar e nada mais:
   quem grava é quem chamou, depois de mostrar. */

function marcaExame(pontoId, chave) {
  return pontoId + ':' + chave;
}

export function jaExaminou(partida, pontoId, chave) {
  return partida.examinados.includes(marcaExame(pontoId, chave));
}

/**
 * Olhar é de graça e não gasta nada: é o movimento "observar" do Manual §8.
 */
export function olhar(partida, ponto) {
  const marca = marcaExame(ponto.id, 'olhar');
  const primeira = !partida.examinados.includes(marca);
  if (primeira) partida.examinados.push(marca);
  return { texto: ponto.olhar, primeira: primeira };
}

/**
 * Usar uma ferramenta do Kit num ponto.
 *
 * Três respostas possíveis:
 *   'nada'    — a ferramenta não serve aqui. Não é erro nem punição: o Manual
 *               §6 manda pensar antes de escolher, e o preço de errar é só a
 *               resposta seca do próprio mundo.
 *   'teste'   — há risco real. A tela abre o dado; quem rola é o jogador, e
 *               depois chama `resolverTeste`.
 *   'revela'  — a resposta sai direto, com ou sem pista junto.
 */
export function usar(partida, ponto, chaveFerramenta) {
  const uso = (ponto.ferramentas || {})[chaveFerramenta];
  const f = ferramenta(chaveFerramenta);

  if (!uso) {
    return { tipo: 'nada', texto: naoServe(f, ponto) };
  }

  if (uso.teste && !jaExaminou(partida, ponto.id, chaveFerramenta)) {
    return {
      tipo: 'teste',
      atributo: uso.teste.atributo,
      motivo: uso.teste.motivo,
      ferramenta: f,
      ponto: ponto
    };
  }

  return concluirUso(partida, ponto, chaveFerramenta, uso);
}

function concluirUso(partida, ponto, chave, uso) {
  const marca = marcaExame(ponto.id, chave);
  const primeira = !partida.examinados.includes(marca);
  if (primeira) partida.examinados.push(marca);

  const pista = primeira ? darPista(partida, uso.da) : null;
  return { tipo: 'revela', texto: uso.texto, pista: pista, primeira: primeira };
}

/**
 * Rola o dado de um exame arriscado e aplica o veredito.
 *
 * A informação sai nas três faixas — a regra de ouro proíbe esconder pista
 * essencial atrás de dado, e nenhum ponto com `teste` entrega pista essencial
 * (conferirRegraDeOuro garante). O que o dado decide é o *preço*: sucesso limpo
 * não cobra nada, custo cobra uma complicação, falha em teste de Linha cobra
 * um ponto de Linha da Lógica.
 */
export function resolverTeste(partida, ponto, chaveFerramenta) {
  const uso = (ponto.ferramentas || {})[chaveFerramenta];
  const atributo = uso.teste.atributo;
  const rolagem = testarAtributo(atributo, partida.visitante[atributo]);
  const classe = rolagem.veredito.classe;

  const resultado = concluirUso(partida, ponto, chaveFerramenta, uso);
  resultado.rolagem = rolagem;

  if (classe === 'falha' && atributo === 'linha') {
    perderLinha(partida, 1);
    resultado.perdeuLinha = true;
  }
  if (classe !== 'sucesso') {
    resultado.complicacao = complicacaoDe(atributo, classe);
  }

  registrar(partida, `${rolagem.formula} — ${rolagem.veredito.rotulo}`);
  return resultado;
}

const COMPLICACOES = {
  agulha: {
    custo: 'Você vê o que precisava ver, mas cutuca o que não devia: alguma coisa no quarto agora sabe que você está olhando.',
    falha: 'Seus olhos ardem de forçar. A imagem vem, torta, e você vai levar um tempo até confiar nela.'
  },
  dedal: {
    custo: 'Funciona — e cobra. Você volta ao seu tamanho com a sensação de que voltou um pouco menos.',
    falha: 'O corpo cede antes da curiosidade. Você consegue, mas passa a cena seguinte com as mãos tremendo.'
  },
  linha: {
    custo: 'A resposta vem, e vem certa. O problema é que ela agora faz sentido — e ela não devia fazer.',
    falha: 'A lógica do Avesso ganha a discussão. Você perde o fio, e perde a cena: o Avesso segue sem esperar.'
  }
};

function complicacaoDe(atributo, classe) {
  const c = COMPLICACOES[atributo] || COMPLICACOES.linha;
  return classe === 'falha' ? c.falha : c.custo;
}

/** Resposta seca do mundo quando a ferramenta não tem nada a fazer ali. */
function naoServe(f, ponto) {
  const nome = f ? f.nome : 'a ferramenta';
  return `Você usa ${nome} sobre ${ponto.rotulo.toLowerCase()} e não acontece nada de útil. ` +
    'A ferramenta certa responde sozinha; esta só fica pesada na mão.';
}

/* ---- conversa --------------------------------------------------------------- */

export function conhecer(partida, moradorId) {
  if (!partida.conhecidos.includes(moradorId)) {
    partida.conhecidos.push(moradorId);
    return true;
  }
  return false;
}

export function jaPerguntou(partida, moradorId, topicoId) {
  return (partida.topicos[moradorId] || []).includes(topicoId);
}

/**
 * Que tópicos aparecem agora para este morador.
 * Um tópico oculto só entra depois que outro o abriu; um tópico com `requer`
 * só entra depois que a pista chegou. É assim que a conversa acompanha a
 * investigação em vez de despejar tudo de uma vez.
 */
export function topicosDisponiveis(partida, moradorId) {
  const d = dialogoDe(moradorId);
  if (!d) return [];
  return (d.topicos || []).filter((t) => {
    if (t.oculto && !partida.abertos.includes(t.id)) return false;
    if (t.requer && !temPista(partida, t.requer)) return false;
    return true;
  }).map((t) => Object.assign({}, t, { respondido: jaPerguntou(partida, moradorId, t.id) }));
}

export function perguntarTopico(partida, moradorId, topicoId) {
  const d = dialogoDe(moradorId);
  const topico = (d.topicos || []).find((t) => t.id === topicoId);
  if (!topico) return null;

  const nova = !jaPerguntou(partida, moradorId, topicoId);
  if (nova) {
    if (!partida.topicos[moradorId]) partida.topicos[moradorId] = [];
    partida.topicos[moradorId].push(topicoId);
  }

  (topico.abre || []).forEach((id) => {
    if (!partida.abertos.includes(id)) partida.abertos.push(id);
  });

  return {
    texto: topico.resposta,
    pista: nova ? darPista(partida, topico.da) : null,
    primeira: nova
  };
}

/**
 * A pergunta livre. Sem IA: casa palavra-chave contra os assuntos escritos.
 * Sem casar, quem responde é a desconversa do morador — e desconversar em
 * personagem é resposta, não falha.
 */
export function perguntarLivre(partida, moradorId, pergunta) {
  const d = dialogoDe(moradorId);
  if (!d) return null;

  const assunto = acharAssunto(d, pergunta);
  if (assunto) return { texto: assunto.resposta, casou: true };

  const opcoes = d.desconversa || ['O silêncio responde por ele.'];
  return { texto: opcoes[Math.floor(Math.random() * opcoes.length)], casou: false };
}

export function saudacaoDe(partida, moradorId) {
  const d = dialogoDe(moradorId);
  if (!d) return '';
  const lista = partida.conhecidos.includes(moradorId)
    ? (d.saudacaoRepetida || d.saudacao)
    : d.saudacao;
  return lista[Math.floor(Math.random() * lista.length)];
}

/* ---- acusação ---------------------------------------------------------------
   Não tem dado. É o quarto movimento do Manual §8 levado a sério: você só pode
   acusar quando tem o que sustente a acusação, e errar custa Linha, não a
   partida. Acertar fecha o caso e devolve a Linha inteira (uma Verdade
   Esquecida recupera tudo — Manual §4). */

export function podeAcusar(partida, acusacao) {
  const faltam = (acusacao.exige || []).filter((id) => !temPista(partida, id));
  return { pode: faltam.length === 0, faltam: faltam.length };
}

export function acusar(partida, acusacao, opcaoId) {
  const opcao = acusacao.opcoes.find((o) => o.id === opcaoId);
  if (!opcao) return null;

  if (opcao.certa) {
    recuperarLinha(partida, LINHA_MAX);
    partida.desfecho = { tipo: 'resolvido', opcao: opcao.id, em: Date.now() };
    registrar(partida, `Caso encerrado: ${opcao.titulo}.`);
    return { certa: true, texto: opcao.desfecho, verdade: opcao.verdade };
  }

  perderLinha(partida, opcao.custo || 1);
  registrar(partida, `Acusação recusada: ${opcao.titulo}.`);
  return { certa: false, texto: opcao.desfecho, virouBoneca: partida.linha === 0 };
}

/* ---- conferência ao carregar ------------------------------------------------
   O caso passa pelo validador da regra de ouro na hora que o jogo abre. Se
   quebrou, o console avisa em voz alta — melhor descobrir no primeiro clique
   do que numa sessão travada. */

export function conferirCaso(caso) {
  const problemas = conferirRegraDeOuro(caso);
  if (problemas.length) {
    console.warn('[O Avesso] o caso quebra a regra de ouro:\n- ' + problemas.join('\n- '));
  }
  return problemas;
}

export { cenaById };
