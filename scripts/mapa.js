// mapa.js — Mapa do Avesso. Compartilhado: é o mesmo mapa pra mesa inteira.
// A névoa, porém, é do mestre: só ele revela (ou volta a esconder) uma região.

import { initPage, storage, createSaver, escapeHtml, ambientar, seamHtml } from './session.js';
import { AREAS, TRILHAS, areaById } from './lugares.js';
import { carregarElenco, ELENCO_KEY } from './elenco.js';

const STORAGE_KEY = 'mapa-avesso';
const COMPARTILHADO = true;

let estado = {};
let selecionado = null;
let moradores = [];
const save = createSaver('mp-save');

const user = await initPage({
  escopo: 'compartilhado',
  onSync: loadState,
  escutar: [STORAGE_KEY, ELENCO_KEY]
});
if (user) {
  await loadState();
  ambientar();
}

function defaultEstado() {
  const e = {};
  AREAS.forEach((a, i) => { e[a.id] = { descoberta: i === 0, notas: '' }; });
  return e;
}

async function loadState() {
  try {
    const saved = await storage.get(STORAGE_KEY, COMPARTILHADO);
    estado = saved || defaultEstado();
  } catch (e) {
    estado = defaultEstado();
  }
  AREAS.forEach(a => { if (!estado[a.id]) estado[a.id] = { descoberta: false, notas: '' }; });
  await carregarMoradores();
  render();
}

// Cada região tem uma âncora: alguém que mora ali e a mesa pode procurar.
// Quem o mestre ainda não apresentou não aparece pros jogadores.
async function carregarMoradores() {
  try {
    const elenco = await carregarElenco();
    moradores = elenco.moradores.filter(m => user.isMestre || m.revelado);
  } catch (e) {
    moradores = [];
  }
}

function scheduleSave() {
  save(() => storage.set(STORAGE_KEY, estado, COMPARTILHADO));
}

// O mestre enxerga o mapa inteiro; os jogadores, só o que já foi revelado.
function visivel(areaId) {
  return user.isMestre || Boolean(estado[areaId] && estado[areaId].descoberta);
}

function render() {
  const root = document.getElementById('mapa-root');
  root.innerHTML = `
    <div class="mp-wrap">
      <div class="mp-frame">
        <div class="mp-header">
          <p class="mp-eyebrow">O Avesso</p>
          <h1 class="mp-title">Mapa do Avesso</h1>
          <p class="mp-sub">Sete retalhos costurados num só mundo.</p>
          <p class="mp-shared-note">${user.isMestre
            ? 'você enxerga o mapa inteiro — a mesa só vê o que você revelar'
            : 'mapa da mesa: as regiões na névoa aparecem quando o mestre as revelar'}</p>
        </div>
        ${seamHtml()}

        <div class="map-stage" id="map-stage">
          <div class="map-border-note"></div>
          <svg class="map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" id="map-svg"></svg>
          <span class="compass">🧭</span>
          <span class="map-caption">— território do Avesso, tal como se conhece —</span>
          <div id="pins-layer"></div>
        </div>

        <div class="mp-legend">
          <span><span class="legend-dot revelado"></span>região revelada</span>
          <span><span class="legend-dot enevoado"></span>na névoa</span>
        </div>

        <div id="detail-area"></div>
        <p class="mp-save-indicator" id="mp-save">salvo ✓</p>
      </div>
    </div>
  `;
  renderPaths();
  renderPins();
  renderDetail();
}

function renderPaths() {
  const svg = document.getElementById('map-svg');
  svg.innerHTML = TRILHAS.map(([aId, bId]) => {
    const a = areaById(aId), b = areaById(bId);
    // curva levemente torta, mas sempre igual: o mesmo traçado pra mesa inteira
    const desvio = ((a.x + b.y) % 7) / 2 - 1.5;
    const midX = (a.x + b.x) / 2 + desvio;
    const midY = (a.y + b.y) / 2 - desvio;
    const enevoado = !visivel(aId) || !visivel(bId);
    return `<path class="${enevoado ? 'fog-path' : ''}" d="M ${a.x},${a.y} Q ${midX},${midY} ${b.x},${b.y}"/>`;
  }).join('');
}

function renderPins() {
  const layer = document.getElementById('pins-layer');
  layer.innerHTML = AREAS.map(a => {
    const revelada = estado[a.id].descoberta;
    const mostra = visivel(a.id);
    const classes = ['pin'];
    if (!mostra) classes.push('fog');
    if (mostra && !revelada) classes.push('so-mestre');
    if (selecionado === a.id) classes.push('selected');
    return `<div class="${classes.join(' ')}" data-area="${a.id}" style="left:${a.x}%; top:${a.y}%;">
      <div class="pin-icon-wrap">${mostra ? a.icone : '❔'}</div>
      <div class="pin-label">${mostra ? a.nome : '???'}</div>
    </div>`;
  }).join('');
  layer.querySelectorAll('[data-area]').forEach(el => {
    el.addEventListener('click', () => {
      selecionado = el.getAttribute('data-area');
      renderPins();
      renderDetail();
    });
  });
}

function renderMoradoresDaArea(areaId) {
  const daqui = moradores.filter(m => m.local === areaId);
  if (daqui.length === 0) return '';
  return `
    <div class="detail-moradores">
      <p class="detail-moradores-label">quem vive aqui</p>
      ${daqui.map(m => `
        <a class="detail-morador" href="moradores.html">
          <span class="detail-morador-icone">${m.icone}</span>
          <span>
            <strong>${escapeHtml(m.nome)}</strong>
            <em>${escapeHtml(m.papel)}</em>
          </span>
        </a>
      `).join('')}
    </div>
  `;
}

function renderDetail() {
  const wrap = document.getElementById('detail-area');
  if (!selecionado) {
    wrap.innerHTML = '<p class="detail-empty">toque num ponto do mapa pra ver os detalhes</p>';
    return;
  }
  const area = areaById(selecionado);
  const st = estado[selecionado];
  const mostra = visivel(selecionado);

  if (!mostra) {
    wrap.innerHTML = `
      <div class="detail-card">
        <div class="detail-top">
          <span class="detail-icon">❔</span>
          <p class="detail-name">Névoa</p>
        </div>
        <p class="detail-desc">Este pedaço do mapa ainda não foi costurado pra vocês. Ele aparece quando o mestre revelar.</p>
      </div>
    `;
    return;
  }

  wrap.innerHTML = `
    <div class="detail-card">
      <div class="detail-top">
        <span class="detail-icon">${area.icone}</span>
        <p class="detail-name">${area.nome}</p>
        ${!st.descoberta ? '<span class="detail-flag">na névoa pros jogadores</span>' : ''}
      </div>
      <p class="detail-desc">${escapeHtml(area.desc)}</p>
      ${renderMoradoresDaArea(selecionado)}
      ${user.isMestre ? `
        <label class="detail-toggle">
          <input type="checkbox" id="det-descoberta" ${st.descoberta ? 'checked' : ''}>
          revelar esta região pra mesa
        </label>
      ` : ''}
      <div class="detail-notes">
        <label>Notas da mesa (pistas, eventos, o que aconteceu aqui)</label>
        <textarea id="det-notas" placeholder="anote o que rolou nesse lugar...">${escapeHtml(st.notas)}</textarea>
      </div>
    </div>
  `;

  const toggle = document.getElementById('det-descoberta');
  // (o bloco de moradores é só leitura — quem edita é a tela de Moradores)
  if (toggle) {
    toggle.addEventListener('change', e => {
      estado[selecionado].descoberta = e.target.checked;
      renderPaths();
      renderPins();
      renderDetail();
      scheduleSave();
    });
  }
  document.getElementById('det-notas').addEventListener('input', e => {
    estado[selecionado].notas = e.target.value;
    scheduleSave();
  });
}
