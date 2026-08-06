// caso-duque.js — O Caso do Duque Desfiado, como conteúdo jogável.
//
// Aqui não mora regra nem tela: só o caso. O motor (motor.js) lê isto e não
// sabe nada sobre lã azul; a tela (cena.js) desenha isto e não sabe nada sobre
// quem é culpado. Escrever o segundo caso é escrever outro arquivo como este.
//
// A regra de ouro do Manual (§2) está codificada na forma dos dados: um ponto
// de interesse só pede dado quando tem `teste`, e nenhum ponto que entrega
// pista com `essencial: true` pode ter teste. O motor recusa carregar um caso
// que quebre isso — é barato demais deixar passar sem querer.

import { AREAS } from '../lugares.js';
import { pistasDeDialogo } from './dialogos-duque.js';

/* ---- pistas ---------------------------------------------------------------
   `essencial: true` = o caso não fecha sem ela, então nunca depende de dado.
   `tipo` casa com as cores do app: pista (azul-linha), suspeito (vermelho). */

export const PISTAS = [
  {
    id: 'porta-trancada',
    titulo: 'Trancada por dentro, com a chave na fechadura',
    tipo: 'pista',
    essencial: true,
    texto: 'A chave está do lado de dentro, ainda na fechadura, virada. Ninguém saiu por esta porta depois de trancá-la — e ninguém entrou.'
  },
  {
    id: 'sem-la-azul',
    titulo: 'Nenhum fio de lã azul na cena',
    tipo: 'pista',
    essencial: true,
    texto: 'O Duque foi esvaziado do próprio recheio, e não há um fio sequer de lã azul no chão, na cama, sob os móveis. O que sai de um corpo tem que ir para algum lugar.'
  },
  {
    id: 'costura-de-tres-voltas',
    titulo: 'A abertura foi costurada, não rasgada',
    tipo: 'pista',
    essencial: true,
    texto: 'A abertura no peito do Duque tem ponto de três voltas nas bordas — costura de quem fecha, não de quem arromba. Alguém abriu com cuidado e teve tempo de arrematar depois.'
  },
  {
    id: 'poeira-interrompida',
    titulo: 'A poeira para na metade do tapete',
    tipo: 'pista',
    essencial: false,
    texto: 'A camada de poeira cobre o quarto inteiro, menos uma faixa reta que atravessa o tapete até a parede — como se algo grande tivesse sido arrastado por ali, e depois a poeira reposta por cima, mal.'
  },
  {
    id: 'retrato-vazio',
    titulo: 'O retrato do Duque está vazio por dentro',
    tipo: 'pista',
    essencial: true,
    texto: 'O retrato do Duque na parede continua lá, e continua se mexendo. Mas atrás da tela não há tela: há um vão fundo, do tamanho de uma pessoa dobrada.'
  },
  {
    id: 'eco-de-duas-vozes',
    titulo: 'Duas vozes, e uma delas é a dele',
    tipo: 'pista',
    essencial: false,
    texto: 'O eco do quarto guarda duas vozes na noite passada. Uma é do Duque. A outra também.'
  },
  {
    id: 'agulha-de-osso',
    titulo: 'Uma agulha de osso, quente ainda',
    tipo: 'pista',
    essencial: true,
    texto: 'Sob a cômoda, uma agulha longa de osso, do tipo que só se usa em costura grossa. Está morna. Agulha de osso não guarda calor: quem a segurou, segurou por muito tempo.'
  },
  {
    id: 'criada-viu-a-ordem',
    titulo: 'A Criada limpou o retrato fora de hora',
    tipo: 'pista',
    essencial: true,
    texto: 'A Criada de Pano limpa um retrato por dia, sempre na mesma ordem. Ontem ela limpou o do Duque — e ontem não era o dia dele.'
  },
  {
    id: 'duque-fala-no-passado',
    titulo: 'O Duque fala de si no passado',
    tipo: 'suspeito',
    essencial: false,
    texto: 'Ele diz "eu era", "eu tinha", "eu costumava". Fala de si como quem já terminou de acontecer. A vítima está conversando com você.'
  }
];

export function pistaById(id) {
  return PISTAS.find((p) => p.id === id) || null;
}

/* ---- pontos de interesse --------------------------------------------------
   Cada ponto responde em três camadas:
     olhar      — de graça, sempre (movimento "observar" do Manual §8)
     ferramentas— cada ferramenta do Kit dá uma resposta diferente no mesmo
                  ponto; a errada não é punida, só não serve
     teste      — só onde o Manual mandaria: risco real, nunca pista essencial */

const APOSENTOS = {
  id: 'aposentos-duque',
  local: 'mansao',
  nome: 'Aposentos do Duque',
  tagline: 'Trancado por dentro. Vazio por fora.',
  abertura: [
    'A porta dos aposentos foi arrombada pela Guarda de Botões, e mesmo arrombada continua trancada — a chave segue do lado de dentro, virada, como quem termina uma frase.',
    'No centro da cama de porcelana, o Duque Desfiado está sentado. Esvaziado. O peito aberto num rasgo limpo, sem uma única fibra de lã azul à vista.',
    'Ele levanta a cabeça quando você entra. Vítimas, no Avesso, raramente têm a decência de ficar caladas.'
  ],
  moradores: ['duque-desfiado', 'criada-de-pano'],
  // o que a cena entrega só por você entrar e olhar: é a ausência mais
  // gritante do quarto, e ausência não se procura com lupa
  pistasDeAbertura: ['sem-la-azul'],
  pontos: [
    {
      id: 'porta',
      x: 12, y: 58,
      icone: '🚪',
      rotulo: 'A porta arrombada',
      olhar: 'A madeira cedeu perto da dobradiça, do lado de fora para dentro. A chave continua na fechadura, do lado de dentro, virada até o fim.',
      ferramentas: {
        lupa: {
          texto: 'Na guarda da fechadura, arranhões — todos do lado de dentro, todos recentes. Ninguém mexeu nesta fechadura por fora, nem com gazua, nem com chave cópia.',
          da: 'porta-trancada'
        },
        monoculo: {
          texto: 'O eco mostra a porta sendo trancada por dentro. A mão que gira a chave é a do próprio Duque. Depois disso, ela não abre mais até a Guarda chegar.',
          da: 'porta-trancada'
        },
        escala: {
          texto: 'Ampliada, a fresta sob a porta é um corredor de dois palmos de altura. Cabe poeira, cabe carta, cabe fio. Não cabe um corpo, e não cabe uma braçada de lã.'
        },
        dialetica: {
          texto: 'Você argumenta com a porta que, se ninguém entrou, então ninguém precisava entrar. A porta não discorda. É pior: ela concorda, e continua trancada, satisfeita consigo.',
          teste: { atributo: 'linha', motivo: 'discutir com uma porta é dar a ela a chance de discutir de volta' }
        }
      }
    },
    {
      id: 'corpo',
      x: 50, y: 46,
      icone: '🎩',
      rotulo: 'O Duque, esvaziado',
      olhar: 'A porcelana do rosto está inteira, o casaco impecável. Do esterno ao cós, uma abertura de dois palmos. Por dentro, o vazio tem eco.',
      ferramentas: {
        lupa: {
          texto: 'As bordas da abertura têm ponto de três voltas — costura de arremate, feita com calma, depois de esvaziar. Quem fez isso não estava com pressa nem com raiva.',
          da: 'costura-de-tres-voltas'
        },
        monoculo: {
          texto: 'O eco recente do corpo não mostra dor. Mostra o Duque parado, de pé, os braços abertos, esperando. Ele colaborou.',
          da: 'eco-de-duas-vozes'
        },
        escala: {
          texto: 'Reduzida ao tamanho de um dedal, você entra pela abertura. Lá dentro, o forro tem a marca de onde a lã encostava por anos — e a marca termina numa costura interna que não deveria existir: alguém já tinha entrado aqui antes, e saído.',
          teste: { atributo: 'dedal', motivo: 'entrar no vão de um corpo de porcelana é entrar em algo que pode se fechar' }
        },
        dialetica: {
          texto: 'Você propõe ao Duque que um homem esvaziado não pode estar sentado. Ele concorda inteiramente, e continua sentado. A contradição não o incomoda — o Avesso não exige que as coisas sejam possíveis, só que sejam costuradas.',
          teste: { atributo: 'linha', motivo: 'aceitar a lógica do Avesso é afrouxar a sua' }
        }
      }
    },
    {
      id: 'tapete',
      x: 33, y: 74,
      icone: '🧶',
      rotulo: 'O tapete e a poeira',
      olhar: 'Poeira uniforme no quarto inteiro. Menos numa faixa reta, do pé da cama até a parede do retrato.',
      ferramentas: {
        lupa: {
          texto: 'A faixa foi varrida e depois empoeirada de novo — a poeira de cima é grossa demais, jogada às pressas. E na borda, presa na trama do tapete: uma única fibra. Não é azul. É cinza.',
          da: 'poeira-interrompida'
        },
        monoculo: {
          texto: 'Algo volumoso e macio foi arrastado por aqui, na direção da parede. Não para fora do quarto: para dentro dela.',
          da: 'poeira-interrompida'
        },
        escala: {
          texto: 'Do tamanho de um alfinete, entre os fios do tapete, você anda pela faixa varrida como quem anda por uma estrada. Ela termina na parede — e não termina na parede. Ela continua.'
        }
      }
    },
    {
      id: 'retrato',
      x: 76, y: 34,
      icone: '🖼️',
      rotulo: 'O retrato na parede',
      olhar: 'Um retrato do Duque em melhores dias, e que insiste em não estar parado: o Duque pintado ajeita a gola, olha para o lado, evita você.',
      ferramentas: {
        lupa: {
          texto: 'A moldura foi tirada e recolocada recentemente — o verniz da parede atrás está limpo em volta, sujo no vinco antigo. E há um fio preso no canto inferior: cinza, grosso, de lã.'
        },
        monoculo: {
          texto: 'Na noite passada, o retrato se abriu. Não caiu, não foi arrancado: se abriu, como porta. E alguém empurrou alguma coisa grande para dentro dele.',
          da: 'retrato-vazio'
        },
        escala: {
          texto: 'Ampliando a parede até que o retrato fique do tamanho de um portão, o que era pintura vira vão: atrás da tela não existe tela nenhuma. Existe um espaço fundo, do tamanho de uma pessoa dobrada ao meio.',
          da: 'retrato-vazio'
        },
        dialetica: {
          texto: 'Você diz ao Duque pintado que ele não pode evitar seu olhar, porque foi pintado olhando para frente. Ele considera. Depois, com evidente má vontade, encara você — e o que há nos olhos dele é medo do que está atrás dele.',
          teste: { atributo: 'linha', motivo: 'obrigar uma pintura a obedecer à própria pintura' }
        }
      }
    },
    {
      id: 'comoda',
      x: 88, y: 66,
      icone: '🗄️',
      rotulo: 'A cômoda de porcelana',
      olhar: 'Gavetas fechadas, tampo vazio, tudo no lugar com uma exatidão que não combina com um quarto onde houve um crime.',
      ferramentas: {
        lupa: {
          texto: 'Sob a cômoda, no vão de três dedos, uma agulha longa de osso. Você a pega. Está morna.',
          da: 'agulha-de-osso'
        },
        monoculo: {
          texto: 'A cômoda foi limpa ontem à noite. Depois. Com um pano que já estava sujo de outra coisa.',
          da: 'criada-viu-a-ordem'
        }
      }
    },
    {
      id: 'espelho-quarto',
      x: 62, y: 22,
      icone: '🪞',
      rotulo: 'O espelho de vestir',
      olhar: 'Um espelho alto, de moldura simples, coberto por um pano — como se cobre espelho em casa de luto. O pano é cinza.',
      ferramentas: {
        lupa: {
          texto: 'O pano que cobre o espelho é feito de lã. Lã cinza, cardada e feltrada até virar tecido. Alguém transformou um monte de lã solta em um pano — e lã, quando cardada por tempo demais, perde a cor.'
        },
        monoculo: {
          texto: 'O espelho foi coberto na noite passada, e coberto pelo próprio Duque, pouco antes de trancar a porta. Ele não queria se ver acontecer.'
        },
        dialetica: {
          texto: 'Você pergunta ao espelho o que ele viu, já que foi cegado justamente para não ver. Ele responde que viu duas pessoas entrarem no quarto e uma sair — e que as duas eram o Duque.',
          da: 'eco-de-duas-vozes',
          teste: { atributo: 'linha', motivo: 'perguntar a um espelho coberto é perguntar ao próprio reflexo' }
        }
      }
    }
  ],
  // por onde se sai desta cena; regiões trancadas explicam por que
  saidas: [
    { local: 'ala', requer: 'retrato-vazio', trancada: 'Você ainda não tem motivo para atravessar a casa até a Ala Leste.' },
    { local: 'transicao', requer: null }
  ]
};

export const CENAS = [APOSENTOS];

export function cenaPorLocal(local) {
  return CENAS.find((c) => c.local === local) || null;
}

export function cenaById(id) {
  return CENAS.find((c) => c.id === id) || null;
}

/* ---- a acusação -----------------------------------------------------------
   O desfecho não é uma rolagem: é montar a ligação certa no Quadro. Cada
   solução exige um conjunto de pistas na mão — sem elas a opção nem aparece,
   porque acusar no escuro não é dedução, é sorteio. */

export const ACUSACAO = {
  pergunta: 'Quem esvaziou o Duque Desfiado?',
  exige: ['porta-trancada', 'sem-la-azul', 'costura-de-tres-voltas', 'retrato-vazio', 'agulha-de-osso'],
  opcoes: [
    {
      id: 'criada',
      alvo: 'criada-de-pano',
      titulo: 'A Criada de Pano',
      argumento: 'Ela limpou o retrato fora de hora, e passa em todos os cômodos sem que ninguém repare.',
      certa: false,
      desfecho: 'A Criada ouve a acusação, repete a última palavra baixinho — "hora" — e concorda com você. Concorda demais. Ela limpou o retrato fora de hora porque foi mandada, e a mão que mandou ainda está no quarto. A Guarda de Botões abre um formulário. O Avesso ri pelas frestas, e a sua Linha da Lógica sente.',
      custo: 1
    },
    {
      id: 'guarda',
      alvo: 'guarda-de-botoes',
      titulo: 'O Guarda de Botões',
      argumento: 'Foi ele quem arrombou a porta — e quem arromba escolhe o que se acha lá dentro.',
      certa: false,
      desfecho: 'O Guarda exige que você preencha a acusação em três vias. Enquanto você preenche, ele prova, com carimbo, que chegou depois. Você perdeu tempo, e o Avesso cobra o tempo em fio.',
      custo: 1
    },
    {
      id: 'duque',
      alvo: 'duque-desfiado',
      titulo: 'O próprio Duque',
      argumento: 'Porta trancada por dentro, pela mão dele. Espelho coberto por ele. Costura de arremate, feita com calma, por quem tinha o quarto só para si. E o retrato que se abre como porta, com a lã cinza empurrada para dentro.',
      certa: true,
      desfecho: 'O Duque escuta você até o fim, com a educação de quem já sabia. "Eu era", ele diz, "um homem cheio de lã azul. E ninguém me tirou nada." Ele mesmo se abriu, ele mesmo se esvaziou, ele mesmo cardou a própria lã até ela perder a cor e virar pano — e cobriu o espelho com ela, para não ter que assistir. O que ele empurrou para dentro do retrato não foi a lã. Foi o que sobrou dele por dentro, dobrado ao meio, ainda vivo. A abertura no peito ele arrematou sozinho, com uma agulha de osso que segurou por horas até ela esquentar na mão. Não houve crime. Houve alguém se desfazendo com método.',
      verdade: 'Um homem que se desfia por vontade própria ainda está pedindo socorro — só que na única língua que o Avesso escuta.'
    }
  ]
};

/* ---- o caso ---------------------------------------------------------------- */

export const CASO = {
  id: 'duque-desfiado',
  nome: 'O Caso do Duque Desfiado',
  tagline: 'Quarto fechado, corpo vazio, nenhum fio de lã azul.',
  briefing: [
    'O Duque de Porcelana foi encontrado em seus aposentos, trancados por dentro, com o recheio de lã azul arrancado do próprio corpo.',
    'Nenhuma entrada forçada. Nenhum suspeito óbvio. Nenhuma lã azul encontrada na cena.',
    'Um mistério de quarto fechado, no estilo mais clássico. Mas no Avesso, "fechado" nem sempre significa o que parece.'
  ],
  cenaInicial: 'aposentos-duque',
  cenas: CENAS,
  pistas: PISTAS,
  acusacao: ACUSACAO
};

/* ---- conferência da regra de ouro -----------------------------------------
   Roda uma vez, ao importar. Se alguém (eu, você, o Denner de daqui a seis
   meses) escrever um ponto que entrega pista essencial atrás de um dado, o
   app grita no console em vez de deixar o caso ficar injogável em silêncio. */

export function conferirRegraDeOuro(caso = CASO) {
  const problemas = [];
  const locais = AREAS.map((a) => a.id);

  caso.cenas.forEach((cena) => {
    if (!locais.includes(cena.local)) {
      problemas.push(`cena "${cena.id}" aponta para região inexistente: ${cena.local}`);
    }
    cena.pontos.forEach((ponto) => {
      Object.entries(ponto.ferramentas || {}).forEach(([chave, uso]) => {
        const pista = uso.da ? pistaById(uso.da) : null;
        if (uso.da && !pista) {
          problemas.push(`${cena.id}/${ponto.id}/${chave} entrega pista inexistente: ${uso.da}`);
        }
        if (pista && pista.essencial && uso.teste) {
          problemas.push(`${cena.id}/${ponto.id}/${chave} põe a pista essencial "${pista.id}" atrás de um dado (Manual §2)`);
        }
      });
    });
  });

  // Toda pista essencial precisa ter pelo menos um caminho sem dado. Ela pode
  // vir de três lugares, e qualquer um deles serve: a abertura da cena, uma
  // ferramenta sem teste, ou um tópico de conversa.
  const deGraca = new Set(pistasDeDialogo());
  caso.cenas.forEach((cena) => (cena.pistasDeAbertura || []).forEach((id) => deGraca.add(id)));
  caso.cenas.forEach((cena) => cena.pontos.forEach((ponto) => {
    Object.values(ponto.ferramentas || {}).forEach((uso) => {
      if (uso.da && !uso.teste) deGraca.add(uso.da);
    });
  }));

  caso.pistas.filter((p) => p.essencial).forEach((pista) => {
    if (!deGraca.has(pista.id)) {
      problemas.push(`pista essencial "${pista.id}" não tem nenhum caminho sem dado`);
    }
  });

  // acusar exige pistas que precisam existir de verdade
  (caso.acusacao.exige || []).forEach((id) => {
    if (!pistaById(id)) problemas.push(`a acusação exige pista inexistente: ${id}`);
  });

  return problemas;
}
