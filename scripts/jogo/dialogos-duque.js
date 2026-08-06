// dialogos-duque.js — o que cada morador diz, e quando.
//
// Sem IA nenhuma. Uma conversa aqui tem três camadas, da mais firme pra mais
// solta:
//
//   topicos    — a espinha da investigação. Aparecem conforme você descobre
//                coisas (`requer`), e é por aqui que sai toda pista essencial:
//                escolher o tópico certo basta, nunca tem dado no caminho.
//   assuntos   — o campo de pergunta livre. Casa palavras-chave do que você
//                digitou com um assunto que o morador tem opinião sobre.
//   desconversa— quando nada casa. Não é mensagem de erro: é caracterização.
//                O Duque desconversa no passado, a Criada repetindo você.
//
// Por isso o campo livre nunca frustra de verdade — errar o assunto ainda
// devolve personagem. E por isso ele nunca trava a investigação: o que o caso
// precisa está nos tópicos, à vista.

/* Cada assunto: `chaves` são radicais sem acento, comparados por inclusão.
   "lã", "lã azul", "a lã dele" e "lazul" caem todos em `la`. */

export const DIALOGOS = {

  /* ---- Duque Desfiado ---------------------------------------------------- */
  'duque-desfiado': {
    saudacao: [
      'Ah. Uma visitante. Eu recebia visitantes, sabe. Recebia muito bem.',
      'Sente-se, se encontrar onde. Eu tinha cadeiras. Tinha várias.'
    ],
    // o que ele diz quando você volta a falar com ele
    saudacaoRepetida: [
      'Você voltou. Eu também voltava, quando ainda havia de onde.',
      'Pergunte. Eu respondia bem a perguntas.'
    ],
    topicos: [
      {
        id: 'quem-fez',
        pergunta: 'Quem fez isso com o senhor?',
        resposta: 'Ele abre um sorriso de porcelana rachada. "Que pergunta bem-educada. Você presume que alguém fez, e presume que fizeram *comigo*. Duas presunções numa frase só — o Avesso adora quando vocês fazem isso."',
        da: 'duque-fala-no-passado'
      },
      {
        id: 'quem-entrava',
        pergunta: 'Quem tinha permissão de entrar nestes aposentos?',
        resposta: '"Havia uma lista." Ele olha para o lado. "Havia uma lista, e ela tinha um nome, e o nome era o meu. É um quarto, minha cara, não uma praça."'
      },
      {
        id: 'porta-por-dentro',
        pergunta: 'A chave está do lado de dentro. O senhor mesmo trancou a porta.',
        requer: 'porta-trancada',
        resposta: '"Eu trancava a porta todas as noites. Trancar a porta é uma coisa que eu fazia." Ele nota o que disse, e não retira. "Sim. Fui eu."',
        abre: ['por-que-trancou']
      },
      {
        id: 'por-que-trancou',
        pergunta: 'Por que trancar a porta, se o senhor esperava alguém?',
        oculto: true,
        resposta: '"Eu não esperava ninguém." Uma pausa exatamente do tamanho errado. "Eu esperava terminar."'
      },
      {
        id: 'la-azul',
        pergunta: 'Onde está a sua lã azul?',
        requer: 'sem-la-azul',
        resposta: '"Foi embora." Ele diz isso como quem fala de um empregado antigo. "Não tinha mais o que fazer aqui. Passou tempo demais dentro de mim ficando azul. Você faria diferente?"'
      },
      {
        id: 'costura',
        pergunta: 'A abertura no seu peito foi arrematada com calma. Por quem?',
        requer: 'costura-de-tres-voltas',
        resposta: 'Ele passa o dedo pela borda costurada, quase com carinho. "Ponto de três voltas. É o único que segura em porcelana." E, mais baixo: "Eu sempre costurei melhor do que falei."',
        da: 'agulha-de-osso'
      },
      {
        id: 'espelho-coberto',
        pergunta: 'Por que o espelho está coberto?',
        resposta: '"Luto", ele diz, satisfeito com a palavra. "É o que se faz. Cobre-se o espelho na casa de quem morreu." Ele espera você perguntar quem morreu. Não pergunte ainda.'
      },
      {
        id: 'retrato',
        pergunta: 'O que o senhor guardou atrás do retrato?',
        requer: 'retrato-vazio',
        resposta: 'Pela primeira vez ele não responde de imediato. Quando responde, é para o chão. "O que sobrava. Eu não ia deixar aquilo andando pela casa. Uma pessoa tem responsabilidades."'
      },
      {
        id: 'criada',
        pergunta: 'A Criada de Pano limpou seu retrato fora de hora. A pedido de quem?',
        requer: 'criada-viu-a-ordem',
        resposta: '"Meu." Nenhuma hesitação. "Eu queria que a moldura estivesse limpa. Ia ser usada."'
      }
    ],
    assuntos: [
      { chaves: ['la', 'lan', 'recheio', 'azul'], resposta: '"Azul", ele repete, como quem prova uma palavra. "Ficou azul de ficar guardada. Cor de coisa que nunca tomou ar."' },
      { chaves: ['morte', 'morrer', 'morto', 'matar', 'assassin'], resposta: '"Morto é um exagero de vocês do outro lado. Aqui a gente se desfaz. É mais lento e dá mais trabalho, mas é mais honesto."' },
      { chaves: ['espelho', 'moldura', 'reflexo'], resposta: '"Ah, o Espelho. Você veio por ele, não veio? Todo mundo vem, e todo mundo acha que é a primeira." Ele ajeita a gola. "Dona Ourela viu você chegar. Ela vê todo mundo chegar."' },
      { chaves: ['criada', 'pano', 'empregad'], resposta: '"A Criada é excelente. Repete o que você diz antes de responder — dizem que é defeito. Eu sempre achei prudência."' },
      { chaves: ['guarda', 'botao', 'botoes', 'polic'], resposta: '"A Guarda arrombou minha porta e me perguntou se eu tinha visto quem tinha feito isso comigo." Uma pausa. "Eles arquivam bem. Pensam mal, mas arquivam bem."' },
      { chaves: ['retros', 'bibliotec', 'verdade'], resposta: '"A Senhora Retrós guarda as Verdades que ninguém mais quis. Se você tem algo que não quer mais lembrar, ela compra. O preço é sempre a lembrança de ter vendido."' },
      { chaves: ['jardim', 'cardo', 'alfinete', 'flor'], resposta: '"Madame Cardo serve um chá magnífico e nunca bebe o próprio. Já reparou que ninguém pergunta por quê?"' },
      { chaves: ['cerzidor', 'transic', 'remendo'], resposta: '"Seu Cerzidor conserta o que chega rasgado. Eu não cheguei rasgado. Eu me rasguei aqui, com hora marcada — não é a mesma coisa, e ele sabe."' },
      { chaves: ['visitante', 'quem sou eu', 'forasteira'], resposta: 'Ele te examina com atenção pela primeira vez. "Você ainda tem cor. Aproveite. Aqui a cor sai primeiro, e a gente só repara quando já saiu."' },
      { chaves: ['ajuda', 'ajudar', 'socorro', 'salvar'], resposta: 'Ele ri, e o riso range. "Ajudar. Que palavra. Onde é que você estava antes de eu já ter acontecido?"' },
      { chaves: ['agulha', 'osso', 'costur', 'linha'], resposta: '"Agulha de osso segura ponto em porcelana e não escorrega. É a única que serve. Também é a única que esquenta na mão — as de metal roubam o calor, as de osso guardam."' },
      { chaves: ['retrato', 'quadro', 'pintur', 'tela'], resposta: '"Aquele retrato é de quando eu ainda estava inteiro. É por isso que ele se mexe e eu não."' },
      { chaves: ['porta', 'chave', 'tranc', 'fechad'], resposta: '"Trancada por dentro", ele confirma, quase orgulhoso. "É o melhor tipo de trancada. Não protege de ninguém, e explica tudo."' },
      { chaves: ['duque', 'titulo', 'seu nome'], resposta: '"Duque Desfiado. O título veio primeiro; o sobrenome, a gente ganha."' },
      { chaves: ['motiv', 'razao'], resposta: '"Por quê." Ele saboreia. "Vocês do outro lado sempre chegam no *por quê* como se ele resolvesse alguma coisa. Aqui a gente costuma ficar no *como*. É mais gentil."' }
    ],
    desconversa: [
      '"Eu saberia responder isso", ele diz. "Eu sabia várias coisas."',
      'Ele olha para o próprio peito aberto, como quem consulta uma agenda. "Não. Isso eu não tenho mais aqui dentro."',
      '"Que pergunta interessante. Eu tinha opiniões interessantes."',
      'Ele ajeita uma gola impecável, demoradamente, até você desistir de esperar a resposta.'
    ]
  },

  /* ---- Criada de Pano ---------------------------------------------------- */
  'criada-de-pano': {
    saudacao: [
      'Ela para de esfregar o retrato, mas não se vira. "…visita", ela repete baixinho, antes de dizer: "Boa noite, visita."'
    ],
    saudacaoRepetida: [
      '"…de novo", ela murmura. "De novo. Pois não."'
    ],
    topicos: [
      {
        id: 'o-que-viu',
        pergunta: 'Você viu alguma coisa ontem à noite?',
        resposta: '"…noite." Ela dobra o pano em quatro. "Eu vi a porta fechada. É o que se vê de uma porta fechada: a porta."'
      },
      {
        id: 'rotina',
        pergunta: 'Você limpa um retrato por dia. Em que ordem?',
        resposta: '"…ordem." Ela recita sem hesitar: "Segunda a Duquesa, terça o Cavalo, quarta a Menina Sem Boca, quinta o Corredor Todo, sexta o Duque." Uma pausa. "Ontem era quarta."',
        da: 'criada-viu-a-ordem',
        abre: ['por-que-fora-de-hora']
      },
      {
        id: 'por-que-fora-de-hora',
        pergunta: 'Ontem era quarta, e você limpou o retrato do Duque.',
        oculto: true,
        resposta: '"…Duque." O pano para. "Ele pediu. Ele nunca pede. Ele mandou limpar a moldura, não o retrato. Eu achei estranho e limpei os dois, porque a gente limpa os dois."'
      },
      {
        id: 'moldura',
        pergunta: 'A moldura estava suja de quê?',
        requer: 'criada-viu-a-ordem',
        resposta: '"…quê." Ela pensa. "De cinza. Fiapo cinza, muito fiapo, no canto de baixo. Eu tirei tudo. Eu não devia ter tirado?"'
      },
      {
        id: 'la-azul-criada',
        pergunta: 'Você viu lã azul em algum lugar da casa?',
        requer: 'sem-la-azul',
        resposta: '"…azul." Ela balança a cabeça devagar. "Faz semanas que não tem azul nesta casa. Eu ia reparar. Eu reparo no que muda de lugar — é o que eu faço."'
      },
      {
        id: 'som',
        pergunta: 'Você ouviu alguma coisa vindo do quarto?',
        resposta: '"…coisa." Ela hesita pela primeira vez. "Conversa. A noite toda. Duas vozes." Ela aperta o pano. "Ele mora sozinho, visita."',
        da: 'eco-de-duas-vozes'
      },
      {
        id: 'medo',
        pergunta: 'Você tem medo dele?',
        requer: 'retrato-vazio',
        resposta: '"…dele." O pano volta a esfregar, rápido demais. "Eu tenho medo do que ele guardou. Não é a mesma coisa. Ainda se mexe lá dentro, visita. Eu ouço quando limpo."'
      }
    ],
    assuntos: [
      { chaves: ['pano', 'limpar', 'limpeza', 'esfrega'], resposta: '"…limpar." Ela mostra o pano. "É o que sobra pra fazer numa casa onde nada suja de verdade."' },
      { chaves: ['duque'], resposta: '"…Duque." Ela olha para o retrato. "Ele era educado comigo. Educado demais, do jeito de quem já decidiu ir embora."' },
      { chaves: ['retrato', 'quadro', 'moldura'], resposta: '"…retrato." Ela abaixa a voz. "Eles fingem que não estão vivos. É gentileza deles fingir."' },
      { chaves: ['la', 'lan', 'azul', 'cinza', 'fiapo'], resposta: '"…cinza." Ela mostra a palma da mão, e há um resto de fiapo grudado nela. "Isso não sai. Faz três dias que não sai."' },
      { chaves: ['guarda', 'botao', 'botoes'], resposta: '"…Guarda." Ela quase sorri. "Eles me deram um formulário pra dizer que eu não vi nada. Levei duas horas pra escrever que não vi nada."' },
      { chaves: ['ala', 'leste', 'esquecid'], resposta: '"…Leste." O pano para. "Lá os retratos se desfiam de memória. Eu não limpo lá. Não adianta limpar quem está esquecendo."' },
      { chaves: ['nome', 'como te chamam'], resposta: '"…nome." Ela dá de ombros. "Criada de Pano. Nunca precisei de outro. Ninguém chama a gente duas vezes seguidas."' },
      { chaves: ['repete', 'repetir', 'palavra'], resposta: '"…repetir." Ela fica muito quieta. "É pra ter certeza de que a palavra é sua mesmo, e não do Avesso falando pela sua boca. Já aconteceu, visita."' },
      { chaves: ['ajuda', 'ajudar', 'medo', 'sair', 'fugir'], resposta: '"…sair." Ela volta a esfregar. "Todo mundo pergunta isso. Eu limpo um retrato por dia. É o que eu tenho."' }
    ],
    desconversa: [
      'Ela repete sua última palavra baixinho, considera, e volta a esfregar o retrato sem responder.',
      '"…" Ela abre a boca, repete a palavra, e fecha. "Não é comigo, visita."',
      'Ela repete a palavra três vezes, cada vez mais baixo, até virar só o barulho do pano.'
    ]
  }
};

export function dialogoDe(moradorId) {
  return DIALOGOS[moradorId] || null;
}

/** Todas as pistas que saem de conversa — o validador da regra de ouro usa. */
export function pistasDeDialogo() {
  const ids = [];
  Object.values(DIALOGOS).forEach((d) => {
    (d.topicos || []).forEach((t) => {
      if (t.da && !t.teste) ids.push(t.da);
    });
  });
  return ids;
}

/* ---- casar a pergunta livre com um assunto -------------------------------
   Comparação sem acento, sem pontuação, por inclusão de radical. Não é
   busca inteligente: é um índice remissivo. Quando não acha, quem responde
   é a desconversa — e a desconversa é resposta, não falha. */

const ACENTOS = /[̀-ͯ]/g;

export function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(ACENTOS, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Uma chave casa com o texto?
 *
 * A comparação é por palavra inteira, não por pedaço de palavra: buscar
 * substring cru fazia "você gosta de futebol?" cair no assunto do Duque,
 * porque "voce" aparecia lá dentro. As regras:
 *
 *   chave curta (até 3 letras)  — só palavra idêntica. Assim "la" pega "lã",
 *                                 e não pega "lado" nem "falar".
 *   chave maior                 — a palavra pode começar pela chave, que é o
 *                                 que faz "costur" pegar costura e costurar.
 *   chave com espaço            — tem que aparecer como frase inteira.
 */
function chaveCasa(chave, texto, palavras) {
  if (chave.includes(' ')) return (' ' + texto + ' ').includes(' ' + chave + ' ');
  if (chave.length <= 3) return palavras.includes(chave);
  return palavras.some((p) => p.startsWith(chave));
}

/**
 * Acha o assunto que melhor casa com o que a pessoa digitou.
 * Ganha a chave mais longa que casar — assim "lã azul" vence "azul" quando os
 * dois servem, e a resposta sai mais específica.
 *
 * @returns {{resposta: string}|null}
 */
export function acharAssunto(dialogo, pergunta) {
  const texto = normalizar(pergunta);
  if (!texto) return null;
  const palavras = texto.split(' ');

  let melhor = null;
  let tamanho = 0;

  (dialogo.assuntos || []).forEach((assunto) => {
    assunto.chaves.forEach((chave) => {
      const k = normalizar(chave);
      if (k && k.length > tamanho && chaveCasa(k, texto, palavras)) {
        melhor = assunto;
        tamanho = k.length;
      }
    });
  });

  return melhor;
}
