// As rotinas de aquecimento e desaquecimento — só dados, nenhuma tela.
//
// O miolo é trato vocal semiocluído (canudo, lábios, "mmm"), que é o que a
// pesquisa de voz cantada mais usa pra aquecer e o que tem a melhor evidência
// (revisão de escopo do Journal of Voice, 2025; estudo brasileiro com cantores
// populares, 2026). A ideia é a mesma nos três: a saída de ar parcialmente
// fechada equilibra a pressão acima e abaixo das pregas, e elas vibram com
// menos impacto.
//
// Por que 5 minutos, e não os 20 dos estudos: não existe duração mínima
// estabelecida, e aquecer também cansa — num estudo com adultos sem treino,
// 5 minutos já subiram a sensação de esforço. Pra quem tem uma sessão semanal
// de 90 minutos, 20 de aquecimento seriam um quarto do tempo. A versão longa
// existe pro dia da gravação.
//
// Canudo na água rasa (2 a 5 cm) de propósito: com a ponta a 5 cm a vibração
// fica mais lisa; mais fundo pede mais esforço (estudo com imagem de alta
// velocidade, 2017).

const SOLTAR = {
  titulo: 'Soltar',
  instrucao: 'Ombros para trás, pescoço devagar de um lado para o outro, massageie a mandíbula perto da orelha.',
};

const CANUDO_U = {
  titulo: 'Canudo na água',
  instrucao: 'Um "uuu" confortável, fazendo bolhas contínuas. Sem pressa, sem força.',
  precisa: 'canudo',
};

const CANUDO_SIRENE = {
  titulo: 'Canudo: sirene',
  instrucao: 'Ainda no canudo: grave, sobe até o agudo e volta. Sem forçar a ponta de cima.',
  precisa: 'canudo',
};

const CANUDO_ESCALA = {
  titulo: 'Canudo: escala',
  instrucao: 'No canudo, cinco notas subindo e descendo. A cada volta, meio tom acima.',
  precisa: 'canudo',
};

const LABIOS = {
  titulo: 'Vibrar os lábios',
  instrucao: '"Brrr" de lábios, subindo e descendo. Se não sair, apoie as bochechas com os dedos.',
};

const HUMMING = {
  titulo: '"Mmm" para a frente',
  instrucao: 'Boca fechada, cantarole a escala sentindo vibrar nos lábios e no nariz.',
};

const VOGAIS = {
  titulo: 'Vogais',
  instrucao: '"Mi, mé, má, mó, mu" na região do meio da voz. Nada de agudo ainda.',
};

const TRECHO = {
  titulo: 'Um trecho da música',
  instrucao: 'Cante um pedaço do que vai gravar hoje, em volume médio. É só pra voz reconhecer o caminho.',
};

const SIRENE_DESCENDO = {
  titulo: 'Sirene descendo',
  instrucao: 'Canudo ou "mmm", bem suave, sempre de cima para baixo.',
};

const FALA = {
  titulo: 'Voltar a falar',
  instrucao: 'Conte de 1 a 20 em voz baixa, no seu tom normal de conversa.',
};

const RESPIRO = {
  titulo: 'Respirar',
  instrucao: 'Em silêncio. Solte o ar devagar pela boca. Um gole de água.',
};

function etapa(base, segundos) {
  return { ...base, segundos };
}

export const ROTINAS = {
  curta: {
    id: 'curta',
    nome: 'Aquecimento de 5 minutos',
    descricao: 'Antes de qualquer canto.',
    etapas: [
      etapa(SOLTAR, 30),
      etapa(CANUDO_U, 60),
      etapa(CANUDO_SIRENE, 60),
      etapa(LABIOS, 60),
      etapa(HUMMING, 60),
      etapa(TRECHO, 30),
    ],
  },
  longa: {
    id: 'longa',
    nome: 'Aquecimento de 10 minutos',
    descricao: 'No dia da gravação ou de sessão longa.',
    etapas: [
      etapa(SOLTAR, 60),
      etapa(CANUDO_U, 90),
      etapa(CANUDO_SIRENE, 90),
      etapa(CANUDO_ESCALA, 60),
      etapa(LABIOS, 90),
      etapa(HUMMING, 60),
      etapa(VOGAIS, 90),
      etapa(TRECHO, 60),
    ],
  },
  // Opcional de verdade: num estudo com 20 cantoras, 68–74% sentiram melhora
  // com o desaquecimento, mas quem ouvia não notou diferença. Custa 2 minutos.
  desaquecer: {
    id: 'desaquecer',
    nome: 'Desaquecimento de 2 minutos',
    descricao: 'Depois de cantar. Opcional.',
    etapas: [
      etapa(SIRENE_DESCENDO, 60),
      etapa(FALA, 30),
      etapa(RESPIRO, 30),
    ],
  },
};

export function duracaoTotal(rotina) {
  return rotina.etapas.reduce((soma, e) => soma + e.segundos, 0);
}

export function precisaDeCanudo(rotina) {
  return rotina.etapas.some((e) => e.precisa === 'canudo');
}

// Onde a rotina está num dado instante: qual etapa, quanto falta nela e
// quanto já foi do total. Função pura de propósito — a tela só pergunta
// "quanto tempo passou?", e a contagem não depende de setInterval pontual
// (aba em segundo plano atrasa timer, e o celular fica apoiado longe).
export function posicaoNoTempo(rotina, segundosDecorridos) {
  const total = duracaoTotal(rotina);
  let inicio = 0;
  for (let i = 0; i < rotina.etapas.length; i++) {
    const fim = inicio + rotina.etapas[i].segundos;
    if (segundosDecorridos < fim) {
      return {
        indice: i,
        restanteNaEtapa: fim - segundosDecorridos,
        fracaoTotal: segundosDecorridos / total,
        terminou: false,
      };
    }
    inicio = fim;
  }
  return { indice: rotina.etapas.length, restanteNaEtapa: 0, fracaoTotal: 1, terminou: true };
}

// Quantos segundos de rotina já passaram quando começa a etapa `indice` —
// é o que "pular etapa" usa pra saltar direto pro começo da seguinte.
export function inicioDaEtapa(rotina, indice) {
  return rotina.etapas.slice(0, indice).reduce((soma, e) => soma + e.segundos, 0);
}
