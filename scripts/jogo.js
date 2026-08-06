// jogo.js — a tela do jogo.
//
// Esta é a única peça que toca o DOM. Ela não decide nada: pergunta ao motor
// (jogo/motor.js) o que pode acontecer, pede o conteúdo ao caso
// (jogo/caso-duque.js), desenha, e devolve a escolha da pessoa pro motor.
//
// A partida é pessoal (cada um tem a sua) e mora na chave `o-avesso-partida`.
// Quando o co-op entrar, o que muda é o dono do save — o resto daqui fica.

import { initPage, ambientar, escapeHtml } from './session.js';
import { KIT, ferramenta, nomeAtributo } from './regras.js';
import { MORADORES_BASE } from './elenco.js';
import { CASO, cenaById } from './jogo/caso-duque.js';
import * as motor from './jogo/motor.js';
import { retratoHtml, miniaturaHtml } from './jogo/retratos.js';
import { cenarioHtml, ligarParallax } from './jogo/cenario.js';

const root = document.getElementById('jogo-root');
// O jogo abre sem conta: quem recebeu o link instala e joga na hora, e a
// partida fica no aparelho até ela decidir entrar (ver `migrarDaConvidada`).
const eu = await initPage({ escopo: 'pessoal', permiteConvidada: true });
motor.conferirCaso(CASO);

/* ---- estado da tela ------------------------------------------------------
   `partida` é a verdade e mora no banco; o resto daqui é só o que está aberto
   na tela agora. */

const tela = {
  partida: null,
  cena: null,
  falandoCom: null,
  ferramentaAtiva: null,
  desligarParallax: null,
  // prólogo
  passo: 0,
  nome: '',
  escolhas: []
};

/* ---- transição de costura -------------------------------------------------
   Trocar de tela no Avesso é passar por uma costura: a cortina fecha com
   pontos de agulha, o conteúdo troca atrás dela, e ela abre. Sem isso, cada
   clique dava um corte seco que estragava o ritmo. */

function cortina() {
  let el = document.querySelector('.jg-cortina');
  if (!el) {
    el = document.createElement('div');
    el.className = 'jg-cortina';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <svg viewBox="0 0 100 20" preserveAspectRatio="none">
        <path d="M0 10 Q 5 4, 10 10 T 20 10 T 30 10 T 40 10 T 50 10 T 60 10 T 70 10 T 80 10 T 90 10 T 100 10"/>
      </svg>`;
    document.body.appendChild(el);
  }
  return el;
}

const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Troca o que está na tela por trás da cortina. Quem chama passa a função que
 * desenha — assim o conteúdo novo só aparece com a costura já fechada.
 */
async function transicao(desenhar) {
  if (semMovimento()) {
    desenhar();
    return;
  }
  const c = cortina();
  c.classList.add('fechando');
  await espera(340);
  desenhar();
  c.classList.remove('fechando');
  c.classList.add('abrindo');
  await espera(380);
  c.classList.remove('abrindo');
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- prólogo --------------------------------------------------------------
   Ninguém distribui pontos: responde três perguntas e atravessa. Os números
   existem (Manual §3), mas quem escolhe escolhe uma pessoa, não uma planilha. */

function desenharPrologo() {
  const total = motor.PERGUNTAS_PROLOGO.length;

  if (tela.passo === 0) {
    root.innerHTML = `
      <div class="jg-prologo">
        <div class="jg-espelho" aria-hidden="true"><span></span><span></span><span></span></div>
        <p class="page-eyebrow">Mansão Brasswood, tarde demais da noite</p>
        <h1 class="page-title">O Espelho de Moldura de Linha</h1>
        <p class="jg-prologo-texto">
          Ele está no fim do corredor, e não devia estar. A moldura não é de madeira:
          é de linha, enrolada em voltas apertadas, e as voltas se mexem quando
          você não olha direto.
        </p>
        <p class="jg-prologo-texto">Antes de atravessar, o espelho quer saber quem está atravessando.</p>
        <label class="jg-campo">
          <span>Seu nome</span>
          <input type="text" id="jg-nome" maxlength="40" placeholder="como te chamam do outro lado" autocomplete="off">
        </label>
        <button class="jg-btn jg-btn-forte" id="jg-comecar">encostar a mão no espelho</button>
      </div>`;

    const input = document.getElementById('jg-nome');
    const seguir = () => {
      tela.nome = input.value.trim();
      if (!tela.nome) {
        input.focus();
        input.classList.add('jg-treme');
        setTimeout(() => input.classList.remove('jg-treme'), 500);
        return;
      }
      tela.passo = 1;
      transicao(desenharPrologo);
    };
    document.getElementById('jg-comecar').addEventListener('click', seguir);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') seguir(); });
    input.focus();
    return;
  }

  if (tela.passo <= total) {
    const p = motor.PERGUNTAS_PROLOGO[tela.passo - 1];
    root.innerHTML = `
      <div class="jg-prologo">
        <p class="page-eyebrow">${tela.passo} de ${total}</p>
        <h1 class="jg-pergunta">${escapeHtml(p.pergunta)}</h1>
        <div class="jg-opcoes">
          ${p.opcoes.map((o, i) => `
            <button class="jg-opcao" data-i="${i}">
              <span class="jg-opcao-texto">${escapeHtml(o.texto)}</span>
            </button>`).join('')}
        </div>
      </div>`;

    root.querySelectorAll('.jg-opcao').forEach((btn) => {
      btn.addEventListener('click', () => {
        tela.escolhas.push(p.opcoes[Number(btn.dataset.i)].atributo);
        tela.passo += 1;
        transicao(desenharPrologo);
      });
    });
    return;
  }

  // travessia
  const v = motor.montarVisitante(tela.nome, tela.escolhas);
  root.innerHTML = `
    <div class="jg-prologo">
      <p class="page-eyebrow">Do outro lado do espelho</p>
      <h1 class="page-title">${escapeHtml(v.nome)}</h1>
      <div class="jg-attrs">
        ${['agulha', 'dedal', 'linha'].map((k) => `
          <div class="jg-attr">
            <span class="jg-attr-nome">${nomeAtributo(k)}</span>
            <span class="jg-attr-valor">${v[k]}</span>
          </div>`).join('')}
      </div>
      <p class="jg-prologo-texto">
        Você atravessa. Do lado de cá o ar é mais grosso, cheira a tecido guardado,
        e o corredor da Mansão Brasswood virou outra coisa — algo com paredes
        de porcelana e um alvoroço na direção dos aposentos do anfitrião.
      </p>
      <p class="jg-prologo-texto jg-lema">"Do outro lado do espelho, tudo tem costura."</p>
      <button class="jg-btn jg-btn-forte" id="jg-entrar">seguir o alvoroço</button>
    </div>`;

  document.getElementById('jg-entrar').addEventListener('click', async () => {
    tela.partida = await motor.novaPartida(v, CASO);
    abrirCena(CASO.cenaInicial, true);
  });
}

/* ---- cena ------------------------------------------------------------------ */

async function abrirCena(cenaId, primeira = false) {
  const cena = cenaById(cenaId);
  if (!cena) return;
  tela.cena = cena;
  tela.partida.cena = cenaId;

  // a abertura entrega o que se vê só por estar no quarto
  const novas = (cena.pistasDeAbertura || [])
    .map((id) => motor.darPista(tela.partida, id))
    .filter(Boolean);

  await motor.salvarPartida(tela.partida);
  await transicao(() => desenharCena(primeira));
  novas.forEach((p) => avisarPista(p));
}

function desenharCena(comAbertura) {
  const cena = tela.cena;
  const p = tela.partida;

  if (tela.desligarParallax) tela.desligarParallax();

  root.innerHTML = `
    <div class="jg-cena">
      ${hudHtml()}
      <div class="jg-palco" id="jg-palco">
        ${cenarioHtml(cena.id)}
        <div class="jg-pontos">
          ${cena.pontos.map((ponto) => pontoHtml(ponto)).join('')}
        </div>
        <div class="jg-figurantes">
          ${cena.moradores.map((id) => figuranteHtml(id)).join('')}
        </div>
      </div>
      <div class="jg-kit" role="toolbar" aria-label="Kit de Detetive">
        <span class="jg-kit-label">Kit</span>
        ${KIT.map((f) => `
          <button class="jg-kit-btn" data-f="${f.chave}" title="${escapeHtml(f.para)}">
            <span class="jg-kit-icone" aria-hidden="true">${f.icone}</span>
            <span class="jg-kit-nome">${escapeHtml(f.nome)}</span>
          </button>`).join('')}
        <button class="jg-kit-btn jg-kit-limpar" data-f="" hidden>largar ferramenta</button>
      </div>
      <div class="jg-narracao" id="jg-narracao">
        ${comAbertura ? cena.abertura.map((l) => `<p>${escapeHtml(l)}</p>`).join('') : `<p class="jg-dica">Escolha um ponto da cena para observar. Para examinar de perto, pegue uma ferramenta do Kit primeiro.</p>`}
      </div>
      <div class="jg-acoes">
        <button class="jg-btn" id="jg-caderno">caderno de pistas <span class="jg-contador">${p.pistas.length}</span></button>
        <button class="jg-btn jg-btn-acusar" id="jg-acusar">acusar</button>
      </div>
    </div>`;

  tela.desligarParallax = ligarParallax(document.getElementById('jg-palco'));
  ligarCena();
  ambientar('.jg-ponto, .jg-figurante');
}

function pontoHtml(ponto) {
  const visto = tela.partida.examinados.some((m) => m.startsWith(ponto.id + ':'));
  return `
    <button class="jg-ponto ${visto ? 'visto' : ''}" data-ponto="${ponto.id}"
            style="left:${ponto.x}%;top:${ponto.y}%" aria-label="${escapeHtml(ponto.rotulo)}">
      <span class="jg-ponto-halo" aria-hidden="true"></span>
      <span class="jg-ponto-icone" aria-hidden="true">${ponto.icone}</span>
      <span class="jg-ponto-rotulo">${escapeHtml(ponto.rotulo)}</span>
    </button>`;
}

function moradorPorId(id) {
  return MORADORES_BASE.find((m) => m.id === id) || { id: id, nome: id, postura: 'reservado' };
}

function figuranteHtml(id) {
  const m = moradorPorId(id);
  return `
    <button class="jg-figurante" data-morador="${id}" aria-label="Falar com ${escapeHtml(m.nome)}">
      ${miniaturaHtml(id, m.postura)}
      <span class="jg-figurante-nome">${escapeHtml(m.nome)}</span>
    </button>`;
}

function hudHtml() {
  const p = tela.partida;
  return `
    <div class="jg-hud">
      <span class="jg-hud-nome">${escapeHtml(p.visitante.nome)}</span>
      <span class="jg-linha" title="Linha da Lógica: ${p.linha} de ${motor.LINHA_MAX}">
        ${Array.from({ length: motor.LINHA_MAX }, (_, i) =>
          `<i class="${i < p.linha ? 'cheia' : 'rompida'}"></i>`).join('')}
        <span class="jg-linha-rotulo">Linha da Lógica</span>
      </span>
      <span class="jg-hud-local">${escapeHtml(tela.cena.nome)}</span>
    </div>`;
}

function atualizarHud() {
  const hud = root.querySelector('.jg-hud');
  if (hud) hud.outerHTML = hudHtml();
  const contador = root.querySelector('.jg-contador');
  if (contador) contador.textContent = tela.partida.pistas.length;
}

function ligarCena() {
  root.querySelectorAll('.jg-kit-btn').forEach((btn) => {
    btn.addEventListener('click', () => escolherFerramenta(btn.dataset.f || null));
  });
  root.querySelectorAll('.jg-ponto').forEach((btn) => {
    btn.addEventListener('click', () => tocarPonto(btn.dataset.ponto));
  });
  root.querySelectorAll('.jg-figurante').forEach((btn) => {
    btn.addEventListener('click', () => abrirConversa(btn.dataset.morador));
  });
  document.getElementById('jg-caderno').addEventListener('click', abrirCaderno);
  document.getElementById('jg-acusar').addEventListener('click', abrirAcusacao);
}

function escolherFerramenta(chave) {
  tela.ferramentaAtiva = chave || null;
  root.querySelectorAll('.jg-kit-btn').forEach((b) => {
    b.classList.toggle('ativa', Boolean(chave) && b.dataset.f === chave);
  });
  const limpar = root.querySelector('.jg-kit-limpar');
  if (limpar) limpar.hidden = !chave;
  document.querySelector('.jg-palco').classList.toggle('jg-com-ferramenta', Boolean(chave));

  const f = chave ? ferramenta(chave) : null;
  narrar(f
    ? [`Você tira ${f.nome} do bolso. Ela serve para ${f.para}. Agora escolha onde usá-la.`]
    : ['Você guarda a ferramenta.'], 'jg-dica');
}

async function tocarPonto(pontoId) {
  const ponto = tela.cena.pontos.find((x) => x.id === pontoId);
  if (!ponto) return;

  // sem ferramenta na mão, tocar num ponto é olhar — e olhar é de graça
  if (!tela.ferramentaAtiva) {
    const r = motor.olhar(tela.partida, ponto);
    narrar([r.texto]);
    await motor.salvarPartida(tela.partida);
    marcarVisto(pontoId);
    return;
  }

  const r = motor.usar(tela.partida, ponto, tela.ferramentaAtiva);

  if (r.tipo === 'nada') {
    narrar([r.texto], 'jg-seco');
    return;
  }

  if (r.tipo === 'teste') {
    abrirTeste(ponto, tela.ferramentaAtiva, r);
    return;
  }

  mostrarRevelacao(r);
  marcarVisto(pontoId);
  await motor.salvarPartida(tela.partida);
}

function marcarVisto(pontoId) {
  const el = root.querySelector(`.jg-ponto[data-ponto="${pontoId}"]`);
  if (el) el.classList.add('visto');
}

function mostrarRevelacao(r) {
  const linhas = [r.texto];
  if (r.rolagem) {
    linhas.unshift(`<em class="jg-rolagem">${escapeHtml(r.rolagem.formula)} — ${r.rolagem.veredito.rotulo}</em>`);
  }
  if (r.complicacao) linhas.push(`<em class="jg-complicacao">${escapeHtml(r.complicacao)}</em>`);
  narrar(linhas, '', true);

  if (r.pista) avisarPista(r.pista);
  if (r.perdeuLinha) piscarLinha();
  atualizarHud();
  if (tela.partida.desfecho && tela.partida.desfecho.tipo === 'boneca') {
    setTimeout(() => abrirDesfecho(), 1600);
  }
}

function narrar(linhas, classe = '', jaEscapado = false) {
  const alvo = document.getElementById('jg-narracao');
  if (!alvo) return;
  alvo.classList.remove('jg-entrando');
  void alvo.offsetWidth; // reinicia a animação
  alvo.className = 'jg-narracao jg-entrando ' + classe;
  alvo.innerHTML = linhas.map((l) => `<p>${jaEscapado ? l : escapeHtml(l)}</p>`).join('');
}

/* ---- avisos ---------------------------------------------------------------- */

function avisarPista(pista) {
  const el = document.createElement('div');
  el.className = 'jg-aviso-pista';
  el.innerHTML = `
    <span class="jg-aviso-tipo">nova pista</span>
    <strong>${escapeHtml(pista.titulo)}</strong>
    <p>${escapeHtml(pista.texto)}</p>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('mostrando'));
  setTimeout(() => {
    el.classList.remove('mostrando');
    setTimeout(() => el.remove(), 400);
  }, 5200);
  atualizarHud();
}

function piscarLinha() {
  const el = root.querySelector('.jg-linha');
  if (!el) return;
  el.classList.add('jg-rompendo');
  setTimeout(() => el.classList.remove('jg-rompendo'), 900);
}

/* ---- o dado ----------------------------------------------------------------
   O jogador rola. O jogo diz antes o que está em jogo, e a pessoa pode recuar
   — recuar não custa nada além da informação que ela não vai ter. */

function abrirTeste(ponto, chave, info) {
  const v = tela.partida.visitante[info.atributo];
  abrirModal('teste', `
    <p class="page-eyebrow">agir sob risco</p>
    <h2 class="jg-modal-titulo">${escapeHtml(info.ferramenta.nome)}</h2>
    <p class="jg-modal-texto">${escapeHtml(info.motivo)}.</p>
    <div class="jg-dado-palco">
      <div class="dice3d-wrap"><div class="cubo" id="jg-cubo">
        ${[1, 2, 3, 4, 5, 6].map((n) => `<div class="face face-${n}">${'<span class="pip"></span>'.repeat(9)}</div>`).join('')}
      </div></div>
    </div>
    <p class="jg-modal-formula">1d6 + ${nomeAtributo(info.atributo)} (+${v})</p>
    <div class="jg-modal-acoes">
      <button class="jg-btn" id="jg-recuar">recuar</button>
      <button class="jg-btn jg-btn-forte" id="jg-rolar">rolar</button>
    </div>`);

  document.getElementById('jg-recuar').addEventListener('click', () => {
    fecharModal();
    narrar(['Você pensa melhor e recolhe a ferramenta. O que quer que estivesse ali continua ali, esperando alguém com mais estômago.'], 'jg-seco');
  });

  document.getElementById('jg-rolar').addEventListener('click', async () => {
    const btn = document.getElementById('jg-rolar');
    btn.disabled = true;
    document.getElementById('jg-recuar').disabled = true;

    const resultado = motor.resolverTeste(tela.partida, ponto, chave);
    await girarCubo(document.getElementById('jg-cubo'), resultado.rolagem.dado);
    await espera(500);

    fecharModal();
    mostrarRevelacao(resultado);
    marcarVisto(ponto.id);
    await motor.salvarPartida(tela.partida);
  });
}

// ângulo que deixa cada face virada pra frente (mesmo mapa de faces do dado.css)
const FACES = {
  1: [0, 0], 2: [0, 90], 3: [-90, 0], 4: [90, 0], 5: [0, -90], 6: [0, 180]
};

function girarCubo(cubo, valor) {
  const [rx, ry] = FACES[valor] || FACES[1];
  if (semMovimento()) {
    cubo.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;
    return Promise.resolve();
  }
  cubo.style.transition = 'transform 1.15s cubic-bezier(.2,.9,.25,1)';
  cubo.style.transform = `rotateX(${rx + 720}deg) rotateY(${ry + 1080}deg)`;
  return espera(1200);
}

/* ---- conversa --------------------------------------------------------------- */

function abrirConversa(moradorId) {
  const m = moradorPorId(moradorId);
  tela.falandoCom = moradorId;
  const nova = motor.conhecer(tela.partida, moradorId);
  motor.salvarPartida(tela.partida);

  abrirModal('conversa', `
    <div class="jg-conversa">
      <div class="jg-conversa-quem">
        ${retratoHtml(moradorId, { postura: m.postura })}
        <div>
          <h2 class="jg-modal-titulo">${escapeHtml(m.nome)}</h2>
          <p class="jg-conversa-papel">${escapeHtml(m.papel || '')}</p>
          <p class="jg-conversa-traco">${escapeHtml(m.traco || '')}</p>
        </div>
      </div>
      <div class="jg-fala" id="jg-fala"><p>${escapeHtml(motor.saudacaoDe(tela.partida, moradorId))}</p></div>
      <div class="jg-topicos" id="jg-topicos"></div>
      <form class="jg-livre" id="jg-livre">
        <input type="text" id="jg-livre-campo" maxlength="120" autocomplete="off"
               placeholder="perguntar outra coisa…" aria-label="Perguntar outra coisa">
        <button class="jg-btn" type="submit">perguntar</button>
      </form>
      <button class="jg-btn jg-conversa-sair" id="jg-sair-conversa">encerrar a conversa</button>
    </div>`, { largo: true });

  if (nova) marcarConhecido(moradorId);
  desenharTopicos();

  document.getElementById('jg-livre').addEventListener('submit', async (e) => {
    e.preventDefault();
    const campo = document.getElementById('jg-livre-campo');
    const texto = campo.value.trim();
    if (!texto) return;
    campo.value = '';
    const r = motor.perguntarLivre(tela.partida, moradorId, texto);
    dizer(`— ${texto}`, 'jg-fala-sua');
    await espera(340);
    dizer(r.texto, r.casou ? '' : 'jg-fala-desconversa');
  });

  document.getElementById('jg-sair-conversa').addEventListener('click', () => {
    fecharModal();
    tela.falandoCom = null;
  });
}

function marcarConhecido(moradorId) {
  const el = root.querySelector(`.jg-figurante[data-morador="${moradorId}"]`);
  if (el) el.classList.add('conhecido');
}

function desenharTopicos() {
  const alvo = document.getElementById('jg-topicos');
  const lista = motor.topicosDisponiveis(tela.partida, tela.falandoCom);

  alvo.innerHTML = lista.length
    ? lista.map((t) => `
        <button class="jg-topico ${t.respondido ? 'feito' : ''}" data-t="${t.id}">
          ${escapeHtml(t.pergunta)}
        </button>`).join('')
    : '<p class="jg-dica">Não há nada que você saiba perguntar ainda. Investigue a cena e volte.</p>';

  alvo.querySelectorAll('.jg-topico').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = motor.perguntarTopico(tela.partida, tela.falandoCom, btn.dataset.t);
      dizer('— ' + btn.textContent.trim(), 'jg-fala-sua');
      await espera(360);
      dizer(r.texto);
      if (r.pista) avisarPista(r.pista);
      await motor.salvarPartida(tela.partida);
      desenharTopicos();
    });
  });
}

function dizer(texto, classe = '') {
  const alvo = document.getElementById('jg-fala');
  const p = document.createElement('p');
  p.className = classe;
  p.innerHTML = escapeHtml(texto);
  alvo.appendChild(p);
  alvo.scrollTop = alvo.scrollHeight;
  // a conversa não cresce pra sempre: as três últimas falas bastam na tela
  while (alvo.children.length > 8) alvo.removeChild(alvo.firstChild);
}

/* ---- caderno de pistas ------------------------------------------------------ */

function abrirCaderno() {
  const pistas = motor.pistasNaMao(tela.partida);
  const lembradas = tela.partida.lembrancas.filter((id) => !tela.partida.pistas.includes(id));

  abrirModal('caderno', `
    <p class="page-eyebrow">o que você tem na mão</p>
    <h2 class="jg-modal-titulo">Caderno de Pistas</h2>
    ${pistas.length ? `
      <ul class="jg-pistas">
        ${pistas.map((p) => `
          <li class="jg-pista ${p.tipo}">
            <strong>${escapeHtml(p.titulo)}</strong>
            <p>${escapeHtml(p.texto)}</p>
          </li>`).join('')}
      </ul>` : '<p class="jg-dica">Nada ainda. Observe a cena; use o Kit onde o olhar não alcança.</p>'}
    ${lembradas.length ? `<p class="jg-dica jg-lembranca">Você tem a sensação incômoda de já ter sabido mais ${lembradas.length} coisa(s) sobre este caso.</p>` : ''}
    <button class="jg-btn" id="jg-fechar-caderno">fechar</button>`, { largo: true });

  document.getElementById('jg-fechar-caderno').addEventListener('click', fecharModal);
}

/* ---- acusação ---------------------------------------------------------------
   Sem dado: é dedução. Só aparece o que você pode sustentar. */

function abrirAcusacao() {
  const { pode, faltam } = motor.podeAcusar(tela.partida, CASO.acusacao);

  if (!pode) {
    abrirModal('acusacao', `
      <p class="page-eyebrow">ainda não</p>
      <h2 class="jg-modal-titulo">${escapeHtml(CASO.acusacao.pergunta)}</h2>
      <p class="jg-modal-texto">
        Você consegue montar uma história, mas ela tem ${faltam} buraco(s) por onde
        um bom advogado do Avesso passaria de carruagem. Acusar assim não é deduzir:
        é apostar. Volte quando o quarto tiver contado o resto.
      </p>
      <button class="jg-btn" id="jg-fechar-acusacao">voltar à cena</button>`);
    document.getElementById('jg-fechar-acusacao').addEventListener('click', fecharModal);
    return;
  }

  abrirModal('acusacao', `
    <p class="page-eyebrow">quarto movimento — agir</p>
    <h2 class="jg-modal-titulo">${escapeHtml(CASO.acusacao.pergunta)}</h2>
    <p class="jg-modal-texto">Não há dado aqui. Só o que você conseguir sustentar.</p>
    <div class="jg-acusados">
      ${CASO.acusacao.opcoes.map((o) => `
        <button class="jg-acusado" data-o="${o.id}">
          ${miniaturaHtml(o.alvo, 'reservado')}
          <span class="jg-acusado-nome">${escapeHtml(o.titulo)}</span>
          <span class="jg-acusado-arg">${escapeHtml(o.argumento)}</span>
        </button>`).join('')}
    </div>
    <button class="jg-btn" id="jg-fechar-acusacao">pensar mais um pouco</button>`, { largo: true });

  document.getElementById('jg-fechar-acusacao').addEventListener('click', fecharModal);
  document.querySelectorAll('.jg-acusado').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const r = motor.acusar(tela.partida, CASO.acusacao, btn.dataset.o);
      await motor.salvarPartida(tela.partida);
      fecharModal();
      await espera(200);
      if (r.certa) {
        abrirDesfecho(r);
      } else {
        atualizarHud();
        piscarLinha();
        abrirModal('acusacao', `
          <p class="page-eyebrow">não foi ele</p>
          <p class="jg-modal-texto">${escapeHtml(r.texto)}</p>
          <button class="jg-btn" id="jg-fechar-erro">voltar à cena</button>`);
        document.getElementById('jg-fechar-erro').addEventListener('click', () => {
          fecharModal();
          if (r.virouBoneca) abrirDesfecho();
        });
      }
    });
  });
}

/* ---- desfecho ---------------------------------------------------------------- */

async function abrirDesfecho(resolucao = null) {
  fecharModal();
  const boneca = !resolucao;

  await transicao(() => {
    root.innerHTML = boneca ? `
      <div class="jg-desfecho jg-desfecho-boneca">
        <div class="jg-boneca" aria-hidden="true">${retratoHtml('duque-desfiado', { postura: 'arredio', moldura: false })}</div>
        <p class="page-eyebrow">a costura te alcançou</p>
        <h1 class="page-title">Você virou boneca</h1>
        <p class="jg-desfecho-texto">
          Você não morreu — o Avesso não faz isso. Você continua aqui, consciente,
          com os olhos abertos e as mãos que não obedecem mais. Alguém vai te
          arrumar numa prateleira, e você vai ver tudo dali.
        </p>
        <p class="jg-desfecho-texto">
          O caso continua sem você. Mas o Avesso guarda o que você descobriu —
          ele lembra por você, e é isso que sobra.
        </p>
        <button class="jg-btn jg-btn-forte" id="jg-recomecar">atravessar de novo</button>
      </div>` : `
      <div class="jg-desfecho jg-desfecho-resolvido">
        <p class="page-eyebrow">caso encerrado</p>
        <h1 class="page-title">${escapeHtml(CASO.nome)}</h1>
        <div class="jg-desfecho-texto jg-desfecho-longo">${escapeHtml(resolucao.texto)}</div>
        <div class="jg-verdade">
          <span class="page-eyebrow">Verdade Esquecida</span>
          <p>${escapeHtml(resolucao.verdade)}</p>
        </div>
        <p class="jg-desfecho-texto">Sua Linha da Lógica voltou inteira. Uma Verdade faz isso.</p>
        <div class="jg-modal-acoes">
          <a class="jg-btn" href="diario.html">registrar no Diário</a>
          <button class="jg-btn jg-btn-forte" id="jg-recomecar">jogar de novo</button>
        </div>
      </div>`;

    document.getElementById('jg-recomecar').addEventListener('click', async () => {
      const lembrancas = tela.partida.pistas.slice();
      const v = tela.partida.visitante;
      tela.partida = await motor.novaPartida(v, CASO, boneca ? lembrancas : []);
      abrirCena(CASO.cenaInicial, true);
    });
  });
}

/* ---- modal ------------------------------------------------------------------
   Um só, reaproveitado. Fecha no Esc e no clique fora, e devolve o foco
   pra cena — senão quem navega por teclado fica preso atrás do painel. */

let focoAnterior = null;

function abrirModal(tipo, html, opts = {}) {
  fecharModal();
  focoAnterior = document.activeElement;

  const back = document.createElement('div');
  back.className = 'jg-modal-fundo';
  back.innerHTML = `<div class="jg-modal jg-modal-${tipo} ${opts.largo ? 'largo' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(back);
  requestAnimationFrame(() => back.classList.add('aberto'));

  back.addEventListener('click', (e) => { if (e.target === back) fecharModal(); });
  document.addEventListener('keydown', aoEsc);

  const focavel = back.querySelector('input, button');
  if (focavel) focavel.focus();
}

function aoEsc(e) {
  if (e.key === 'Escape') fecharModal();
}

function fecharModal() {
  const back = document.querySelector('.jg-modal-fundo');
  if (!back) return;
  document.removeEventListener('keydown', aoEsc);
  back.classList.remove('aberto');
  setTimeout(() => back.remove(), 260);
  if (focoAnterior && focoAnterior.isConnected) focoAnterior.focus();
  focoAnterior = null;
}

/* ---- entrada ---------------------------------------------------------------- */

async function comecar() {
  const salva = await motor.carregarPartida();

  if (!salva || !salva.visitante) {
    desenharPrologo();
    ambientar('.jg-opcao, .jg-attr');
    return;
  }

  tela.partida = salva;

  if (salva.desfecho) {
    tela.cena = cenaById(salva.cena) || CASO.cenas[0];
    abrirDesfecho(salva.desfecho.tipo === 'resolvido'
      ? { texto: CASO.acusacao.opcoes.find((o) => o.certa).desfecho,
          verdade: CASO.acusacao.opcoes.find((o) => o.certa).verdade }
      : null);
    return;
  }

  abrirCena(salva.cena || CASO.cenaInicial, false);
}

await comecar();
