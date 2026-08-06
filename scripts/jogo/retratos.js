// retratos.js — a cara dos moradores, em SVG.
//
// Não é ilustração pintada: é silhueta em moldura, com um detalhe que só
// aquela pessoa tem — a cartola rachada do Duque, o pano dobrado da Criada,
// os olhos de botão do Guarda. É o mínimo que faz um morador ser reconhecível
// de longe, e é o que escala: NPC promovido pelo Gerador ganha retrato
// automático a partir do id, sem ninguém precisar desenhar nada.
//
// Tudo é vetor e tudo herda `currentColor` ou as variáveis do shared.css, então
// o retrato acompanha a paleta do app e anima em CSS (ver styles/jogo.css):
// a silhueta respira, e o detalhe reage à postura do morador.

const VIEWBOX = '0 0 120 150';

/* ---- peças ---------------------------------------------------------------
   Cada morador é uma combinação de cabeça, ombros e adereço. Separar assim
   evita sete SVGs copiados, e é o que permite gerar retrato pra quem entrar
   no elenco depois. */

const CABECAS = {
  // porcelana: oval liso, com a rachadura de sempre
  porcelana: `
    <ellipse class="rt-cabeca" cx="60" cy="52" rx="25" ry="30"/>
    <path class="rt-rachadura" d="M52 30 L56 44 L50 52 L57 62 L54 74"/>`,
  // pano: cabeça mais mole, costurada de lado
  pano: `
    <path class="rt-cabeca" d="M60 22 C78 22 86 36 86 54 C86 72 76 84 60 84 C44 84 34 72 34 54 C34 36 42 22 60 22 Z"/>
    <path class="rt-costura-cabeca" d="M76 34 L80 40 M74 42 L79 47 M73 50 L78 54"/>`,
  // botão: cabeça redonda e chapada, quase um botão grande
  botao: `
    <circle class="rt-cabeca" cx="60" cy="54" r="28"/>
    <circle class="rt-furo" cx="52" cy="48" r="3"/>
    <circle class="rt-furo" cx="68" cy="48" r="3"/>`,
  // carretel: alta e estreita, de quem só fala de pé
  carretel: `
    <path class="rt-cabeca" d="M60 20 C74 20 82 34 82 54 C82 74 72 86 60 86 C48 86 38 74 38 54 C38 34 46 20 60 20 Z"/>
    <path class="rt-costura-cabeca" d="M42 44 H78 M42 62 H78"/>`
};

const OMBROS = {
  // casaco de gala: lapela marcada
  casaco: `
    <path class="rt-corpo" d="M22 150 C22 116 38 100 60 100 C82 100 98 116 98 150 Z"/>
    <path class="rt-lapela" d="M60 100 L46 150 M60 100 L74 150"/>`,
  // avental: linha reta e cordão no pescoço
  avental: `
    <path class="rt-corpo" d="M26 150 C26 118 40 102 60 102 C80 102 94 118 94 150 Z"/>
    <path class="rt-lapela" d="M44 106 C52 118 68 118 76 106"/>`,
  // farda: ombros quadrados, com fileira de botões
  farda: `
    <path class="rt-corpo" d="M20 150 L20 118 C20 108 34 100 60 100 C86 100 100 108 100 118 L100 150 Z"/>
    <circle class="rt-botao-farda" cx="60" cy="116" r="3.5"/>
    <circle class="rt-botao-farda" cx="60" cy="130" r="3.5"/>
    <circle class="rt-botao-farda" cx="60" cy="144" r="3.5"/>`,
  // xale: silhueta larga e caída
  xale: `
    <path class="rt-corpo" d="M16 150 C20 116 38 100 60 100 C82 100 100 116 104 150 Z"/>
    <path class="rt-lapela" d="M32 122 C46 134 74 134 88 122"/>`
};

/* ---- os moradores --------------------------------------------------------
   `detalhe` é o que a pessoa reconhece antes do nome. `humor` é o eixo em que
   a silhueta se move quando a postura muda (ver classe .rt-postura-* no CSS). */

const RETRATOS = {
  'duque-desfiado': {
    cabeca: 'porcelana',
    ombros: 'casaco',
    // cartola inclinada e o peito aberto, esvaziado
    detalhe: `
      <g class="rt-adereco">
        <path class="rt-linha" d="M36 24 H84"/>
        <path class="rt-massa" d="M42 24 L45 4 H75 L78 24 Z"/>
        <path class="rt-linha rt-fio-solto" d="M78 12 C90 14 92 26 84 32"/>
      </g>
      <g class="rt-ferida">
        <path class="rt-vazio" d="M52 112 C56 106 64 106 68 112 C70 126 66 140 60 142 C54 140 50 126 52 112 Z"/>
        <path class="rt-ponto" d="M52 114 L48 110 M54 122 L49 119 M56 130 L51 128 M68 114 L72 110 M66 122 L71 119 M64 130 L69 128"/>
      </g>`
  },
  'criada-de-pano': {
    cabeca: 'pano',
    ombros: 'avental',
    // touca e o pano dobrado na mão, sempre
    detalhe: `
      <g class="rt-adereco">
        <path class="rt-massa" d="M36 44 C36 24 46 16 60 16 C74 16 84 24 84 44 C74 34 46 34 36 44 Z"/>
        <path class="rt-linha" d="M34 44 H86"/>
      </g>
      <g class="rt-mao">
        <rect class="rt-massa" x="76" y="120" width="26" height="18" rx="2"/>
        <path class="rt-linha" d="M76 126 H102 M76 132 H102"/>
      </g>`
  },
  'guarda-de-botoes': {
    cabeca: 'botao',
    ombros: 'farda',
    detalhe: `
      <g class="rt-adereco">
        <path class="rt-massa" d="M34 34 H86 L82 22 H38 Z"/>
        <circle class="rt-botao-farda" cx="60" cy="28" r="4"/>
      </g>`
  },
  'senhora-retros': {
    cabeca: 'carretel',
    ombros: 'xale',
    detalhe: `
      <g class="rt-adereco">
        <path class="rt-linha rt-fio-solto" d="M38 30 C24 40 24 62 38 72"/>
        <path class="rt-linha rt-fio-solto" d="M82 30 C96 40 96 62 82 72"/>
        <rect class="rt-massa" x="46" y="6" width="28" height="12" rx="2"/>
      </g>`
  },
  'dona-ourela': {
    cabeca: 'pano',
    ombros: 'xale',
    // não olha ninguém de frente: a cabeça vem virada, e há um reflexo atrás
    detalhe: `
      <g class="rt-adereco rt-de-lado">
        <ellipse class="rt-vazio" cx="86" cy="46" rx="14" ry="20"/>
        <path class="rt-linha" d="M74 30 C86 24 98 34 98 46"/>
      </g>`
  },
  'seu-cerzidor': {
    cabeca: 'pano',
    ombros: 'avental',
    detalhe: `
      <g class="rt-adereco">
        <path class="rt-linha rt-agulha" d="M84 108 L104 96"/>
        <path class="rt-linha rt-fio-solto" d="M104 96 C112 104 106 118 96 118"/>
      </g>`
  },
  'madame-cardo': {
    cabeca: 'carretel',
    ombros: 'xale',
    detalhe: `
      <g class="rt-adereco">
        <circle class="rt-massa" cx="82" cy="26" r="9"/>
        <path class="rt-linha" d="M82 35 L86 52"/>
        <path class="rt-linha rt-agulha" d="M30 116 L30 100 M26 104 L30 98 L34 104"/>
      </g>`
  }
};

// quem entrou no elenco pelo Gerador não tem retrato escrito à mão; ganha um
// a partir do próprio id, sempre o mesmo para o mesmo id
const CABECAS_LISTA = Object.keys(CABECAS);
const OMBROS_LISTA = Object.keys(OMBROS);

function somaDoId(id) {
  let n = 0;
  for (let i = 0; i < id.length; i += 1) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return n;
}

function retratoDe(moradorId) {
  if (RETRATOS[moradorId]) return RETRATOS[moradorId];
  const n = somaDoId(String(moradorId || 'morador'));
  return {
    cabeca: CABECAS_LISTA[n % CABECAS_LISTA.length],
    ombros: OMBROS_LISTA[(n >> 3) % OMBROS_LISTA.length],
    detalhe: `<g class="rt-adereco"><path class="rt-linha rt-fio-solto" d="M${34 + (n % 40)} 20 C24 40 96 40 86 72"/></g>`
  };
}

/**
 * O retrato de um morador, pronto pra jogar no innerHTML.
 *
 * @param {string} moradorId
 * @param {object} opts
 * @param {string} [opts.postura]  'acolhedor' | 'reservado' | 'arredio' — muda como a silhueta se porta
 * @param {boolean} [opts.moldura] desenha a moldura de retrato em volta (padrão: sim)
 * @param {string}  [opts.classe]  classes extras no <figure>
 */
export function retratoHtml(moradorId, opts = {}) {
  const r = retratoDe(moradorId);
  const postura = opts.postura || 'reservado';
  const moldura = opts.moldura !== false;

  const svg = `
    <svg class="rt-svg" viewBox="${VIEWBOX}" role="img" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
      <g class="rt-silhueta">
        ${OMBROS[r.ombros] || ''}
        ${CABECAS[r.cabeca] || ''}
        ${r.detalhe || ''}
      </g>
    </svg>`;

  return `
    <figure class="rt-retrato rt-postura-${postura} ${moldura ? 'rt-com-moldura' : ''} ${opts.classe || ''}"
            data-morador="${moradorId}">
      ${moldura ? '<span class="rt-moldura" aria-hidden="true"></span>' : ''}
      <span class="rt-fundo" aria-hidden="true"></span>
      ${svg}
    </figure>`;
}

/**
 * Retrato pequeno, pra lista e para o seletor de "com quem falar".
 */
export function miniaturaHtml(moradorId, postura) {
  return retratoHtml(moradorId, { postura: postura, moldura: false, classe: 'rt-mini' });
}
