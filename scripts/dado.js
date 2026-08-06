// dado.js — Dado Rolável. Teste de atributo (1d6 + Agulha/Dedal/Linha, lendo
// a própria Ficha da Visitante), um d10 solto, histórico de rolagens da mesa,
// tabelas rápidas de improviso (só o mestre) e um bloco de anotações rápidas
// pessoais. Os dados são exibidos em cubo/gema 3D via CSS.

import { initPage, storage, createSaver } from './session.js';

const FICHA_KEY = 'o-avesso-ficha-personagem';
const HISTORICO_KEY = 'o-avesso-historico-rolagens';
const NOTAS_KEY = 'o-avesso-notas-rapidas';
const MAX_HISTORICO = 30;

const ATRIBUTOS = [
  { chave: 'agulha', nome: 'Agulha', icone: '🪡' },
  { chave: 'dedal', nome: 'Dedal', icone: '🧵' },
  { chave: 'linha', nome: 'Linha', icone: '🧶' }
];

const TABELA_MESTRE_D6 = [
  'Um retrato na parede pisca — ou foi impressão sua.',
  'As cortinas estão costuradas ao contrário, do lado de fora pra dentro.',
  'Um botão solto no chão, ainda quente, como se tivesse acabado de cair.',
  'O silêncio aqui tem textura, como se alguém tivesse abafado o cômodo com algodão.',
  'Uma linha vermelha atravessa o rodapé inteiro, puxada até este ponto exato.',
  'Um relógio de porcelana marca uma hora que ainda não aconteceu.'
];

const TABELA_MESTRE_D10 = [
  'Passos de linha e agulha se aproximam pelo corredor — a Guarda de Botões.',
  'A luz pisca e, por um instante, o cômodo parece outro completamente.',
  'Uma das Verdades Esquecidas sussurra algo, mas só uma pessoa do grupo ouve.',
  'O NPC presente esconde algo às pressas atrás das costas.',
  'Um fio invisível se rompe em algum lugar da Mansão — algo mudou, e ninguém sabe o quê.',
  'A Linha da Lógica de uma Visitante estica sozinha: ela perde 1 ponto, sem rolar nada.',
  'Uma peça do Kit de Detetive falha, só dessa vez, bem na hora errada.',
  'Alguém que não deveria estar ali aparece na porta, como se sempre tivesse estado.',
  'O tempo pula — minutos se passam sem que ninguém perceba.',
  'Um retalho de tecido cai do teto com um nome costurado nele.'
];

// rotação própria de cada face do cubo (como ela fica presa ao dado)
const FACE_PROPRIA = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 90, y: 0 },
  4: { x: -90, y: 0 },
  5: { x: 0, y: 90 },
  6: { x: 0, y: 180 }
};
// rotação do cubo inteiro pra trazer a face até a frente (inverso da própria)
const FACE_FRENTE = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: 90 },
  3: { x: -90, y: 0 },
  4: { x: 90, y: 0 },
  5: { x: 0, y: -90 },
  6: { x: 0, y: 180 }
};

let ficha = null;
let atributoEscolhido = 'agulha';
let ultimoResultadoD6 = null;
let ultimoResultadoD10 = null;
let historico = [];
let notasRapidas = '';
let rolagemMestre = null; // { tipo: 'ambientacao'|'complicacao', dado, texto }

let spinCuboX = 0, spinCuboY = 0;
let cuboRest = { x: 0, y: 0 };
let cuboPendingAnim = null;

let gemRest = { x: 12, y: 18 };
let gemPendingAnim = null;

const saveNotas = createSaver('dd-notas-save');

const user = await initPage({ escopo: 'compartilhado', onSync: sincronizarTudo });
if (user) {
  await sincronizarTudo();
}

async function sincronizarTudo() {
  await Promise.all([carregarFicha(), carregarHistorico(), carregarNotas()]);
  render();
}

async function carregarFicha() {
  try {
    ficha = await storage.get(FICHA_KEY, false);
  } catch (e) {
    ficha = null;
  }
}

async function carregarHistorico() {
  try {
    const saved = await storage.get(HISTORICO_KEY, true);
    historico = saved && Array.isArray(saved.entries) ? saved.entries : [];
  } catch (e) {
    historico = [];
  }
}

async function carregarNotas() {
  try {
    const saved = await storage.get(NOTAS_KEY, false);
    notasRapidas = saved && typeof saved.texto === 'string' ? saved.texto : '';
  } catch (e) {
    notasRapidas = '';
  }
}

function registrarHistorico(entry) {
  historico = [entry, ...historico].slice(0, MAX_HISTORICO);
  storage.set(HISTORICO_KEY, { entries: historico }, true).catch(() => {});
}

function valorAtributo(chave) {
  const bruto = ficha ? parseInt(ficha[chave], 10) : NaN;
  return isNaN(bruto) ? null : bruto;
}

function rolarD6() {
  return 1 + Math.floor(Math.random() * 6);
}

function rolarD10() {
  return 1 + Math.floor(Math.random() * 10);
}

function veredito(total) {
  if (total >= 6) return { classe: 'sucesso', rotulo: 'sucesso limpo', desc: 'a pista, a ação ou a resposta vêm sem preço.' };
  if (total >= 4) return { classe: 'custo', rotulo: 'sucesso com custo', desc: 'o mestre narra uma complicação.' };
  return { classe: 'falha', rotulo: 'falha', desc: 'se era teste de Linha, perde 1 ponto de Linha da Lógica.' };
}

function armarGiroCubo(valor) {
  spinCuboX += 360 * (2 + Math.floor(Math.random() * 2));
  spinCuboY += 360 * (2 + Math.floor(Math.random() * 2));
  const alvo = FACE_FRENTE[valor];
  const to = { x: spinCuboX + alvo.x, y: spinCuboY + alvo.y };
  cuboPendingAnim = { from: Object.assign({}, cuboRest), to };
  cuboRest = to;
}

function armarGiroGema() {
  const from = Object.assign({}, gemRest);
  const extraX = 360 * (2 + Math.floor(Math.random() * 2));
  const extraY = 360 * (2 + Math.floor(Math.random() * 2));
  const to = { x: from.x + extraX, y: from.y + extraY };
  gemPendingAnim = { from, to };
  gemRest = { x: to.x % 360, y: to.y % 360 };
}

function testarAtributo() {
  const valor = valorAtributo(atributoEscolhido);
  if (valor === null) return;
  const dado = rolarD6();
  const total = dado + valor;
  ultimoResultadoD6 = { dado: dado, atributo: atributoEscolhido, valor: valor, total: total };
  armarGiroCubo(dado);
  render();

  const nomeAttr = ATRIBUTOS.find(a => a.chave === atributoEscolhido).nome;
  const v = veredito(total);
  registrarHistorico({
    usuario: user.nomeExibicao || user.username,
    tipo: 'atributo',
    label: `1d6 (${dado}) + ${nomeAttr} (+${valor}) = ${total}`,
    veredito: v.rotulo
  });
}

function rolarD10Solto() {
  const dado = rolarD10();
  ultimoResultadoD10 = dado;
  armarGiroGema();
  render();

  registrarHistorico({
    usuario: user.nomeExibicao || user.username,
    tipo: 'd10',
    label: `1d10 = ${dado}`,
    veredito: null
  });
}

function rolarMestreD6() {
  const dado = rolarD6();
  rolagemMestre = { tipo: 'ambientacao', dado: dado, texto: TABELA_MESTRE_D6[dado - 1] };
  render();
}

function rolarMestreD10() {
  const dado = rolarD10();
  rolagemMestre = { tipo: 'complicacao', dado: dado, texto: TABELA_MESTRE_D10[dado - 1] };
  render();
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function pipsFaceHtml(n) {
  const pips = Array.from({ length: 9 }, () => '<span class="pip"></span>').join('');
  return `<div class="face face-${n}"><div class="pips-grid">${pips}</div></div>`;
}

function render() {
  const root = document.getElementById('dado-root');
  const temFicha = ficha && ATRIBUTOS.some(a => valorAtributo(a.chave) !== null);

  const cuboFrom = cuboPendingAnim ? cuboPendingAnim.from : cuboRest;
  const gemFrom = gemPendingAnim ? gemPendingAnim.from : gemRest;

  root.innerHTML = `
    <div class="dd-wrap">
      <div class="dd-frame">
        <div class="dd-header">
          <p class="dd-eyebrow">O Avesso</p>
          <h1 class="dd-title">Dado Rolável</h1>
          <p class="dd-subtitle">O risco entra só quando você decide agir.</p>
        </div>

        <div class="dd-seam"></div>

        <section class="dd-section">
          <p class="dd-section-label">🎲 Teste de Atributo (1d6 + atributo)</p>
          <p class="dd-section-hint">escolha o atributo, role, e veja o veredito segundo o Manual do Jogador</p>

          ${temFicha ? `
            <div class="dd-attr-picker">
              ${ATRIBUTOS.map(a => {
                const valor = valorAtributo(a.chave);
                const disponivel = valor !== null;
                return `<button type="button" class="dd-attr-btn ${atributoEscolhido === a.chave ? 'selected' : ''}"
                  data-attr="${a.chave}" ${disponivel ? '' : 'disabled'}>
                  <span class="nome">${a.icone} ${a.nome}</span>
                  <span class="valor">${disponivel ? '+' + valor : 'sem valor'}</span>
                </button>`;
              }).join('')}
            </div>

            <div class="dd-dice-stage">
              <div class="dice3d-wrap">
                <div class="cubo" id="cubo-d6" style="transform: rotateX(${cuboFrom.x}deg) rotateY(${cuboFrom.y}deg);">
                  ${[1,2,3,4,5,6].map(pipsFaceHtml).join('')}
                </div>
              </div>
            </div>

            <button type="button" class="dd-roll-btn" id="btn-rolar-d6">Rolar 1d6 + ${ATRIBUTOS.find(a => a.chave === atributoEscolhido).nome}</button>
          ` : `
            <p class="dd-no-ficha">preencha os atributos na <a href="ficha.html">Ficha da Visitante</a> pra rolar aqui</p>
          `}

          ${ultimoResultadoD6 ? renderResultadoD6() : ''}
        </section>

        <section class="dd-section d10">
          <p class="dd-section-label">🔟 D10 Solto</p>
          <p class="dd-section-hint">sem tabela fixa — use pra sorteios, eventos aleatórios ou qualquer rolagem avulsa da mesa</p>

          <div class="dd-dice-stage">
            <div class="dice3d-wrap gem-wrap">
              <div class="gema" id="gema-d10" style="transform: rotateX(${gemFrom.x}deg) rotateY(${gemFrom.y}deg);">
                <span class="gema-numero">${ultimoResultadoD10 !== null ? ultimoResultadoD10 : '–'}</span>
              </div>
            </div>
          </div>

          <button type="button" class="dd-roll-btn d10" id="btn-rolar-d10">Rolar 1d10</button>
        </section>

        ${user.isMestre ? renderTabelasMestre() : ''}

        <section class="dd-section notas">
          <p class="dd-section-label">🪡 Anotações Rápidas</p>
          <p class="dd-section-hint">um rascunho só seu — observações de cena, suspeitas, o que não quer esquecer até o fim da sessão</p>
          <textarea id="dd-notas" placeholder="anote rápido, sem compromisso...">${escapeHtml(notasRapidas)}</textarea>
          <p class="dd-notas-footer">
            <span class="scope-note" style="margin:0;">só você lê isto — nem o mestre, nem o resto da mesa</span>
            <span class="dd-save-indicator" id="dd-notas-save">salvo ✓</span>
          </p>
        </section>

        <section class="dd-section historico">
          <p class="dd-section-label">🧵 Histórico de Rolagens</p>
          <p class="dd-section-hint">os testes de atributo e os d10 soltos de toda a mesa, mais recentes primeiro</p>
          ${renderHistorico()}
        </section>
      </div>
    </div>
  `;

  attachHandlers();
  animarCuboSePreciso();
  animarGemaSePreciso();
}

function renderResultadoD6() {
  const r = ultimoResultadoD6;
  const v = veredito(r.total);
  const nomeAttr = ATRIBUTOS.find(a => a.chave === r.atributo).nome;
  return `
    <div class="dd-result">
      <p class="dd-formula">1d6 (${r.dado}) + ${escapeHtml(nomeAttr)} (+${r.valor})</p>
      <p class="dd-total">${r.total}</p>
      <span class="dd-veredito ${v.classe}">${v.rotulo}</span>
      <p class="dd-veredito-desc">${v.desc}</p>
    </div>
  `;
}

function renderTabelasMestre() {
  return `
    <section class="dd-section mestre">
      <p class="dd-section-label">🔒 Tabelas Rápidas do Mestre</p>
      <p class="dd-section-hint">improviso de mesa — só aparece pra você, ninguém mais vê este resultado</p>
      <div class="dd-mestre-botoes">
        <button type="button" class="dd-roll-btn mestre" id="btn-mestre-d6">Ambientação (1d6)</button>
        <button type="button" class="dd-roll-btn mestre" id="btn-mestre-d10">Complicação (1d10)</button>
      </div>
      ${rolagemMestre ? `
        <div class="dd-mestre-resultado">
          <span class="dd-mestre-dado">${rolagemMestre.tipo === 'ambientacao' ? '1d6' : '1d10'} → ${rolagemMestre.dado}</span>
          <p class="dd-mestre-texto">${escapeHtml(rolagemMestre.texto)}</p>
        </div>
      ` : ''}
    </section>
  `;
}

function renderHistorico() {
  if (historico.length === 0) {
    return '<p class="dd-history-empty">nenhuma rolagem ainda — o primeiro dado da mesa está esperando</p>';
  }
  return `
    <div class="dd-history">
      ${historico.map(h => `
        <div class="dd-history-item">
          <span class="dd-history-user">${escapeHtml(h.usuario)}</span>
          <span class="dd-history-label">${escapeHtml(h.label)}</span>
          ${h.veredito ? `<span class="dd-history-veredito">${escapeHtml(h.veredito)}</span>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function animarCuboSePreciso() {
  if (!cuboPendingAnim) return;
  const el = document.getElementById('cubo-d6');
  const alvo = cuboPendingAnim.to;
  cuboPendingAnim = null;
  if (!el) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = `rotateX(${alvo.x}deg) rotateY(${alvo.y}deg)`;
    });
  });
}

function animarGemaSePreciso() {
  if (!gemPendingAnim) return;
  const el = document.getElementById('gema-d10');
  const alvo = gemPendingAnim.to;
  gemPendingAnim = null;
  if (!el) return;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.9s cubic-bezier(0.34, 1.56, 0.64, 1)';
      el.style.transform = `rotateX(${alvo.x}deg) rotateY(${alvo.y}deg)`;
    });
  });
}

function attachHandlers() {
  document.querySelectorAll('[data-attr]').forEach(btn => {
    btn.addEventListener('click', () => {
      atributoEscolhido = btn.getAttribute('data-attr');
      ultimoResultadoD6 = null;
      render();
    });
  });

  const btnD6 = document.getElementById('btn-rolar-d6');
  if (btnD6) btnD6.addEventListener('click', testarAtributo);

  const btnD10 = document.getElementById('btn-rolar-d10');
  if (btnD10) btnD10.addEventListener('click', rolarD10Solto);

  const btnMestreD6 = document.getElementById('btn-mestre-d6');
  if (btnMestreD6) btnMestreD6.addEventListener('click', rolarMestreD6);

  const btnMestreD10 = document.getElementById('btn-mestre-d10');
  if (btnMestreD10) btnMestreD10.addEventListener('click', rolarMestreD10);

  const notasEl = document.getElementById('dd-notas');
  if (notasEl) {
    notasEl.addEventListener('input', e => {
      notasRapidas = e.target.value;
      saveNotas(() => storage.set(NOTAS_KEY, { texto: notasRapidas }, false));
    });
  }
}
