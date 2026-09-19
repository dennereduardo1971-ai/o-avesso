// O check-in de conforto vocal: "como está a voz hoje?", em 30 segundos.
//
// Os sintomas são os da Escala de Desconforto do Trato Vocal, validada no
// Brasil e usada com professores e pacientes de voz. O app usa os NOMES dos
// sintomas, não o questionário validado — então isto é triagem pra decidir o
// dia, não diagnóstico. Quem diagnostica é fonoaudiólogo ou otorrino.
//
// A decisão tem três saídas, e a regra que desenha todas é a mesma do plano de
// gravação: voz rouca ou dolorida não grava. A voz se recupera em horas
// (90% em 4–6h, total em 12–18h depois de uso pesado — Hunter & Titze, 2009);
// a gravação pode esperar um dia.

export const SINTOMAS = [
  { id: 'secura', nome: 'Secura' },
  { id: 'ardor', nome: 'Ardor ou queimação' },
  { id: 'aperto', nome: 'Aperto' },
  { id: 'dor', nome: 'Garganta dolorida' },
  { id: 'coceira', nome: 'Coceira ou vontade de pigarrear' },
  { id: 'sensivel', nome: 'Garganta sensível ou irritada' },
  { id: 'bola', nome: 'Bola na garganta' },
];

// 0 = nada, 1 = um pouco, 2 = bastante
export const INTENSIDADES = ['nada', 'um pouco', 'bastante'];

export const ALERTAS = [
  { id: 'dorAoCantar', texto: 'Dói ao cantar ou ao engolir' },
  { id: 'roucaAoAcordar', texto: 'Acordei com a voz rouca depois de ter cantado' },
  { id: 'perdeuAgudos', texto: 'Sumiram notas agudas que eu tinha' },
  { id: 'roucaHaSemanas', texto: 'Estou com a voz rouca há mais de 2 semanas' },
];

export function respostasVazias() {
  return {
    sintomas: Object.fromEntries(SINTOMAS.map((s) => [s.id, 0])),
    alertas: Object.fromEntries(ALERTAS.map((a) => [a.id, false])),
  };
}

export function somaDeSintomas(sintomas) {
  return SINTOMAS.reduce((soma, s) => soma + (Number(sintomas[s.id]) || 0), 0);
}

// Devolve { nivel: 'verde' | 'amarelo' | 'vermelho', titulo, orientacoes[] }.
export function avaliar({ sintomas = {}, alertas = {} } = {}) {
  const orientacoes = [];

  // Rouquidão que não melhora: a diretriz de otorrino (AAO-HNS, 2018) pede
  // laringoscopia em 4 semanas; pra quem canta, a assessoria usa 2.
  if (alertas.roucaHaSemanas) {
    orientacoes.push('Rouquidão que não melhora em 2 semanas é caso de otorrino. Vale marcar.');
  }
  if (alertas.perdeuAgudos) {
    orientacoes.push('Se os agudos não voltarem em poucos dias, procure uma fonoaudióloga.');
  }
  if (alertas.dorAoCantar) {
    orientacoes.push('Dor é o sinal pra parar, não pra aquecer mais.');
  }
  if (alertas.roucaAoAcordar) {
    orientacoes.push('A voz ainda está se recuperando da última vez. Um dia sem canto resolve na maioria das vezes.');
  }

  const algumAlerta = ALERTAS.some((a) => alertas[a.id]);
  if (algumAlerta || Number(sintomas.dor) >= 2) {
    if (!algumAlerta) orientacoes.push('Garganta bem dolorida: hoje ela descansa.');
    orientacoes.push('Água ao longo do dia, e nada de gritar ou falar por cima de barulho.');
    return { nivel: 'vermelho', titulo: 'Hoje não canta', orientacoes };
  }

  const soma = somaDeSintomas(sintomas);
  const algumForte = SINTOMAS.some((s) => Number(sintomas[s.id]) >= 2);
  if (soma >= 4 || algumForte) {
    return {
      nivel: 'amarelo',
      titulo: 'Canta leve hoje',
      orientacoes: [
        'Aquecimento de 10 minutos, com calma.',
        'Nada de agudo forçado: transponha ou troque de trecho.',
        'Sessão curta, e para se piorar.',
        'Água ao longo do dia.',
      ],
    };
  }

  return {
    nivel: 'verde',
    titulo: 'Voz pronta',
    orientacoes: soma > 0
      ? ['Um incômodo leve — aqueça com calma e veja como a voz responde.']
      : ['Aqueça 5 minutos e bom canto.'],
  };
}
