// elenco.js — quem mora no Avesso.
//
// Sete moradores fixos, uma âncora por região do mapa. Quatro deles já
// existiam como cartão no Quadro de Linhas (Duque, Criada, Guarda, Retrós):
// aqui eles ganham identidade e estado, em vez de virarem cartão repetido.
//
// O texto de cada morador mora no código (não muda de mesa pra mesa); o que
// muda com o jogo — postura, humor, se já foi apresentado à mesa — mora no
// banco. Por isso o estado é guardado por id, e não como cópia da lista:
// assim dá pra ajustar um traço aqui sem sobrescrever a sessão de ninguém.
//
// Onde cada coisa fica:
//   shared:mestre:elenco-moradores  -> a mesa lê, só o mestre escreve (ver RLS)
//   user:<mestre>:o-avesso-moradores-mestre -> segredos e notas, só dele
//
// O elenco cresce pelo Gerador de NPCs: personagem gerado é descartável até
// a mesa mexer com ele duas vezes — aí o mestre promove, e ele entra aqui.

import { db } from './db.js';
import { POSTURA_PADRAO } from './regras.js';

export const ELENCO_KEY = 'mestre:elenco-moradores';
export const ELENCO_COMPARTILHADO = true;

const SEGREDOS_KEY = 'o-avesso-moradores-mestre';

export const MORADORES_BASE = [
  {
    id: 'duque-desfiado',
    nome: 'Duque Desfiado',
    icone: '🎩',
    papel: 'Anfitrião da Mansão de Porcelana',
    local: 'mansao',
    traco: 'fala de si mesmo no passado, como se já tivesse terminado de acontecer',
    gancho: 'sabe quem tinha permissão pra entrar nos próprios aposentos — e evita a lista',
    revelado: true
  },
  {
    id: 'criada-de-pano',
    nome: 'Criada de Pano',
    icone: '🧹',
    papel: 'Limpa os retratos da Ala Leste, um por dia',
    local: 'ala',
    traco: 'repete a última palavra de quem fala com ela, baixinho, antes de responder',
    gancho: 'passa em todos os cômodos da Mansão e repara no que mudou de lugar',
    revelado: true
  },
  {
    id: 'guarda-de-botoes',
    nome: 'Guarda de Botões',
    icone: '🔘',
    papel: 'Autoridade do Avesso — no papel',
    local: 'guarda',
    traco: 'exige formulário pra tudo, inclusive pra ouvir uma confissão',
    gancho: 'tem arquivado o registro de toda travessia feita pelo Espelho',
    revelado: true
  },
  {
    id: 'senhora-retros',
    nome: 'Senhora Retrós',
    icone: '📚',
    papel: 'Guardiã da Biblioteca de Linhas Perdidas',
    local: 'biblioteca',
    traco: 'só fala de pé, e nunca do mesmo lado da mesa duas vezes',
    gancho: 'guarda as Verdades que ninguém mais quis lembrar, e cobra caro por cada uma',
    revelado: true
  },
  {
    id: 'dona-ourela',
    nome: 'Dona Ourela',
    icone: '🪞',
    papel: 'Vigia da moldura, do lado de cá',
    local: 'espelho',
    traco: 'não olha ninguém de frente — só o reflexo da pessoa, por cima do ombro',
    gancho: 'viu quem atravessou o Espelho, e em que ordem',
    revelado: false
  },
  {
    id: 'seu-cerzidor',
    nome: 'Seu Cerzidor',
    icone: '🪢',
    papel: 'Conserta o que chega rasgado à Sala de Transição',
    local: 'transicao',
    traco: 'cerze enquanto conversa, e para de costurar exatamente quando mente',
    gancho: 'conhece pela costura a mão de quem fez cada remendo do Avesso',
    revelado: false
  },
  {
    id: 'madame-cardo',
    nome: 'Madame Cardo',
    icone: '🌹',
    papel: 'Jardineira do Jardim de Alfinetes',
    local: 'jardim',
    traco: 'oferece chá a todo mundo e nunca serve o próprio',
    gancho: 'sabe o que foi enterrado no jardim, porque foi ela quem regou por cima',
    revelado: false
  }
];

// ---- arco de cada morador --------------------------------------------------
// Ninguém no Avesso fica igual até o fim. O arco é onde a costura da pessoa
// está: quatro estágios, sempre pra frente, e sempre por decisão do mestre
// (ver pulso.js — o mundo propõe, quem aprova é ele).

export const ARCOS = [
  { n: 0, nome: 'Inteiro', desc: 'a costura está firme — é quem diz ser, e por enquanto basta' },
  { n: 1, nome: 'Puxando fio', desc: 'alguma coisa começou a ceder, e ele sabe disso antes da mesa' },
  { n: 2, nome: 'Desfiando', desc: 'já não consegue esconder — o que era segredo virou comportamento' },
  { n: 3, nome: 'Do avesso', desc: 'virou outra coisa; o que sobrou dele cabe numa frase só' }
];

export const ARCO_MAX = ARCOS.length - 1;

export function arco(n) {
  const i = Math.max(0, Math.min(ARCO_MAX, parseInt(n, 10) || 0));
  return ARCOS[i];
}

function estadoPadrao(morador) {
  return {
    postura: POSTURA_PADRAO,
    humor: '',
    revelado: Boolean(morador.revelado),
    arco: 0,
    // o evento de fim de arco só acontece uma vez por morador
    arcoFechado: false
  };
}

function elencoVazio() {
  return { estado: {}, extras: [], relacoes: {}, pulso: pulsoVazio() };
}

function pulsoVazio() {
  return { virada: 0, descartados: {}, ultima: null };
}

/** Chave de uma relação: um morador × uma visitante. */
export function chaveRelacao(moradorId, username) {
  return `${moradorId}::${String(username || '').toLowerCase()}`;
}

/**
 * Junta a lista fixa com os promovidos e aplica o estado guardado.
 * @returns {{ moradores: Array, bruto: object }}
 */
function montar(bruto) {
  const estado = (bruto && bruto.estado) || {};
  const extras = (bruto && Array.isArray(bruto.extras)) ? bruto.extras : [];
  const relacoes = (bruto && bruto.relacoes) || {};
  const pulso = Object.assign(pulsoVazio(), (bruto && bruto.pulso) || {});

  const moradores = MORADORES_BASE.concat(extras).map((m) => {
    const guardado = estado[m.id] || {};
    const base = estadoPadrao(m);
    return Object.assign({}, m, {
      postura: guardado.postura || base.postura,
      humor: typeof guardado.humor === 'string' ? guardado.humor : base.humor,
      revelado: typeof guardado.revelado === 'boolean' ? guardado.revelado : base.revelado,
      arco: typeof guardado.arco === 'number' ? guardado.arco : base.arco,
      arcoFechado: Boolean(guardado.arcoFechado),
      promovido: extras.some((e) => e.id === m.id)
    });
  });

  return {
    moradores: moradores,
    bruto: { estado: estado, extras: extras, relacoes: relacoes, pulso: pulso }
  };
}

/**
 * Como um morador está com UMA visitante em particular.
 *
 * A postura geral (morador × mesa) é o piso; a relação, quando existe, fala
 * mais alto. É por isso que a mesma pergunta pode não pedir dado nenhum da
 * Sara e virar risco pro resto do grupo — sem que nenhum número mude.
 *
 * @returns {{ postura: string, propria: boolean, nota: string }}
 */
export function relacaoCom(morador, username, relacoes) {
  const r = (relacoes || {})[chaveRelacao(morador.id, username)];
  if (r && r.postura) {
    return { postura: r.postura, propria: true, nota: r.nota || '' };
  }
  return { postura: morador.postura, propria: false, nota: r ? (r.nota || '') : '' };
}

/** Lê o elenco inteiro. Qualquer pessoa logada pode ler. */
export async function carregarElenco() {
  let guardado = null;
  try {
    guardado = await db.get(ELENCO_KEY, ELENCO_COMPARTILHADO);
  } catch (e) {
    guardado = null;
  }
  return montar(guardado || elencoVazio());
}

/** Grava o elenco. Só o mestre passa pelo RLS — ver supabase-schema.sql. */
export async function salvarElenco(bruto) {
  await db.set(ELENCO_KEY, {
    estado: (bruto && bruto.estado) || {},
    extras: (bruto && Array.isArray(bruto.extras)) ? bruto.extras : [],
    relacoes: (bruto && bruto.relacoes) || {},
    pulso: Object.assign(pulsoVazio(), (bruto && bruto.pulso) || {})
  }, ELENCO_COMPARTILHADO);
}

/** Segredos e notas de bastidor: linha pessoal do mestre, invisível pro resto. */
export async function carregarSegredos() {
  try {
    const guardado = await db.get(SEGREDOS_KEY, false);
    return (guardado && guardado.porMorador) || {};
  } catch (e) {
    return {};
  }
}

export async function salvarSegredos(porMorador) {
  await db.set(SEGREDOS_KEY, { porMorador: porMorador || {} }, false);
}

// acentos combinantes, pra "Percalina" e "Tafetá" virarem id do mesmo jeito
const ACENTOS = /[̀-ͯ]/g;

function idDisponivel(nome, existentes) {
  const base = String(nome || 'morador')
    .toLowerCase()
    .normalize('NFD').replace(ACENTOS, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'morador';
  let id = base;
  let n = 2;
  while (existentes.some((m) => m.id === id)) {
    id = base + '-' + n;
    n += 1;
  }
  return id;
}

/**
 * Promove um personagem do Gerador a morador de verdade: ele passa a ter
 * lugar no mapa, postura e estado. O segredo gerado vai pro bloco do mestre,
 * não pro que a mesa lê.
 *
 * @param {{nome:string, traco:string, segredo:string}} npc
 * @returns {Promise<{id:string, nome:string}>}
 */
export async function promoverNpc(npc) {
  const { bruto } = await carregarElenco();
  const todos = MORADORES_BASE.concat(bruto.extras);
  const id = idDisponivel(npc.nome, todos);

  bruto.extras.push({
    id: id,
    nome: String(npc.nome || 'Sem nome'),
    icone: '🎭',
    papel: 'ainda sem posto certo no Avesso',
    local: '',
    traco: String(npc.traco || ''),
    gancho: '',
    revelado: false
  });
  bruto.estado[id] = { postura: POSTURA_PADRAO, humor: '', revelado: false, arco: 0 };

  await salvarElenco(bruto);

  if (npc.segredo) {
    const segredos = await carregarSegredos();
    segredos[id] = Object.assign({ segredo: '', notas: '' }, segredos[id], { segredo: String(npc.segredo) });
    await salvarSegredos(segredos);
  }

  return { id: id, nome: npc.nome };
}
