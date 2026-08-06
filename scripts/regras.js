// regras.js — o motor de regras do Avesso, num lugar só.
//
// Isto não inventa mecânica nenhuma: é o que o Manual do Jogador já diz,
// tirado de dentro da tela do Dado pra poder ser usado por qualquer outra
// (Moradores, Ficha, e o que vier depois). Nada aqui toca em DOM nem em banco.
//
// A regra que não pode ser quebrada (Manual §2): pista essencial não depende
// de dado. Por isso nenhuma função daqui soma bônus de relação, humor ou
// simpatia ao resultado — a escala é 1d6 + 1..4 contra alvo 6, e cada ±1
// mexeria em 16,7% de chance absoluta. O que a relação com um morador muda
// é se *existe* rolagem, não o número dela (ver POSTURAS).

export const ATRIBUTOS = [
  { chave: 'agulha', nome: 'Agulha', icone: '🪡', resumo: 'precisão, percepção fina' },
  { chave: 'dedal', nome: 'Dedal', icone: '🧵', resumo: 'resistência, proteção' },
  { chave: 'linha', nome: 'Linha', icone: '🧶', resumo: 'lógica, raciocínio' }
];

export const ATRIBUTO_MIN = 1;
export const ATRIBUTO_MAX = 4;

/** Valor de atributo sempre entre 1 e 4 (Manual §3). */
export function clampAtributo(v) {
  let n = parseInt(v, 10);
  if (isNaN(n)) n = ATRIBUTO_MIN;
  return Math.max(ATRIBUTO_MIN, Math.min(ATRIBUTO_MAX, n));
}

export function nomeAtributo(chave) {
  const a = ATRIBUTOS.find((x) => x.chave === chave);
  return a ? a.nome : String(chave || '');
}

export function rolarD6() {
  return 1 + Math.floor(Math.random() * 6);
}

export function rolarD10() {
  return 1 + Math.floor(Math.random() * 10);
}

/** Faixas do Manual §5: 6+ / 4–5 / 3–. */
export function veredito(total) {
  if (total >= 6) {
    return { classe: 'sucesso', rotulo: 'sucesso limpo', desc: 'a pista, a ação ou a resposta vêm sem preço.' };
  }
  if (total >= 4) {
    return { classe: 'custo', rotulo: 'sucesso com custo', desc: 'o mestre narra uma complicação.' };
  }
  return { classe: 'falha', rotulo: 'falha', desc: 'se era teste de Linha, perde 1 ponto de Linha da Lógica.' };
}

/**
 * Um teste de atributo inteiro: 1d6 + atributo, já classificado.
 * @param {string} atributo  'agulha' | 'dedal' | 'linha'
 * @param {number} valor     o que está na Ficha da Visitante
 */
export function testarAtributo(atributo, valor) {
  const dado = rolarD6();
  const total = dado + valor;
  return {
    atributo: atributo,
    valor: valor,
    dado: dado,
    total: total,
    veredito: veredito(total),
    formula: `1d6 (${dado}) + ${nomeAtributo(atributo)} (+${valor}) = ${total}`
  };
}

// ---- Kit de Detetive (Manual §6) -------------------------------------------
// Cada ferramenta responde a um tipo de pista, e cada uma tem uma condição
// própria pra pedir dado. Fora dessa condição, o uso é livre.

export const KIT = [
  {
    chave: 'lupa',
    icone: '🔍',
    nome: 'Lupa de Pedra Furada',
    para: 'o que está pequeno ou escondido demais para ver a olho nu',
    atributo: 'agulha',
    quandoTesta: 'só quando o detalhe está deliberadamente disfarçado'
  },
  {
    chave: 'monoculo',
    icone: '⏳',
    nome: 'Monóculo do Tempo',
    para: 'o que já não está mais lá — o eco recente de um lugar',
    atributo: 'linha',
    quandoTesta: 'só para ecos antigos ou apagados; cenas recentes são de graça'
  },
  {
    chave: 'escala',
    icone: '🪞',
    nome: 'Mudança de Escala',
    para: 'o que é grande ou pequeno demais pra ser entendido no tamanho errado',
    atributo: 'dedal',
    quandoTesta: 'só quando mudar de escala ali é fisicamente arriscado'
  },
  {
    chave: 'dialetica',
    icone: '🎭',
    nome: 'Dialética do Absurdo',
    para: 'quando a lógica normal não serve e é preciso discutir com a do Avesso',
    atributo: 'linha',
    quandoTesta: 'sempre — folhear a lógica do Avesso arrisca a sua própria'
  }
];

export function ferramenta(chave) {
  return KIT.find((f) => f.chave === chave) || null;
}

// ---- Postura dos moradores -------------------------------------------------
// Como um morador do Avesso está com a mesa. Não é bônus: é o que decide se
// aquela informação sai na conversa, sai normal, ou vira "agir sob risco"
// (Manual §8, quarto movimento). Assim a relação pesa de verdade na mesa sem
// reescrever a matemática do sistema.

export const POSTURAS = [
  {
    chave: 'acolhedor',
    icone: '🤲',
    nome: 'acolhedor',
    exigencia: 'entrega',
    resumo: 'conta o que sabe sem que ninguém precise arriscar nada',
    naMesa: 'sem dado: ele responde porque quer responder.'
  },
  {
    chave: 'reservado',
    icone: '🪡',
    nome: 'reservado',
    exigencia: 'comum',
    resumo: 'responde o que for perguntado direito, e nada além',
    naMesa: 'regra normal: dado só se houver risco real na cena.'
  },
  {
    chave: 'arredio',
    icone: '🔪',
    nome: 'arredio',
    exigencia: 'risco',
    resumo: 'não entrega nada de graça — tirar algo dele é se expor',
    naMesa: 'arrancar isso dele é agir sob risco: aí sim entra o dado.'
  }
];

export const POSTURA_PADRAO = 'reservado';

export function postura(chave) {
  return POSTURAS.find((p) => p.chave === chave) || POSTURAS.find((p) => p.chave === POSTURA_PADRAO);
}

/**
 * O que a postura de um morador faz com a rolagem.
 * @returns {'entrega'|'comum'|'risco'}
 */
export function exigenciaDePostura(chave) {
  return postura(chave).exigencia;
}
