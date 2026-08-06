// quadro-de-linhas.js — corkboard da mesa inteira. Compartilhado: todo mundo
// vê os mesmos cartões e os mesmos fios, em qualquer aparelho.

import { initPage, storage, createSaver, escapeHtml, escapeAttr, ambientar } from './session.js';

const STORAGE_KEY = 'o-avesso-quadro-de-linhas';
const COMPARTILHADO = true;
const CARD_W = 190;
const CARD_H_EST = 120;
const CANVAS_W = 1400;
const CANVAS_H = 950;

const defaultState = {
  cards: [
    { id: 1, tipo: 'pista', titulo: 'Fio azul na janela', notas: '', x: 40, y: 40 },
    { id: 2, tipo: 'pista', titulo: 'Resíduo de giz na emenda', notas: '', x: 260, y: 40 },
    { id: 3, tipo: 'pista', titulo: 'Eco na parede (Monóculo)', notas: '', x: 480, y: 40 },
    { id: 4, tipo: 'pista', titulo: 'Bilhete da escrivaninha', notas: '', x: 700, y: 40 },
    { id: 5, tipo: 'suspeito', titulo: 'Duque Desfiado', notas: '', x: 40, y: 230 },
    { id: 6, tipo: 'suspeito', titulo: 'Criada de Pano', notas: '', x: 260, y: 230 },
    { id: 7, tipo: 'suspeito', titulo: 'Guarda de Botões', notas: '', x: 480, y: 230 },
    { id: 8, tipo: 'suspeito', titulo: 'Senhora Retrós', notas: '', x: 700, y: 230 },
    { id: 9, tipo: 'local', titulo: 'Câmara do Duque', notas: '', x: 40, y: 420 },
    { id: 10, tipo: 'local', titulo: 'Ala Leste (retrato)', notas: '', x: 260, y: 420 }
  ],
  connections: []
};

let state = JSON.parse(JSON.stringify(defaultState));
let connectMode = false;
let pendingSelect = null;
let idCounter = 11;
let dragging = null; // {id, offsetX, offsetY}

const save = createSaver('save-indicator');

const user = await initPage({
  escopo: 'compartilhado',
  onSync: loadState,
  escutar: [STORAGE_KEY]
});
if (user) {
  await loadState();
  ambientar();
}

async function loadState() {
  try {
    const saved = await storage.get(STORAGE_KEY, COMPARTILHADO);
    if (saved) {
      state = Object.assign({}, defaultState, saved);
      if (!Array.isArray(state.cards)) state.cards = [];
      if (!Array.isArray(state.connections)) state.connections = [];
      state.cards.forEach(c => { if (c.id >= idCounter) idCounter = c.id + 1; });
    }
  } catch (e) {}
  pendingSelect = null;
  render();
}

function scheduleSave() {
  save(() => storage.set(STORAGE_KEY, state, COMPARTILHADO));
}

function addCard(tipo) {
  const n = state.cards.length;
  const baseX = 40 + (n % 5) * 60;
  const baseY = 40 + Math.floor(n / 5) * 50;
  state.cards.push({
    id: idCounter++,
    tipo: tipo,
    titulo: tipo === 'pista' ? 'Nova pista' : tipo === 'suspeito' ? 'Novo suspeito' : 'Novo local',
    notas: '',
    x: Math.min(baseX, CANVAS_W - CARD_W - 20),
    y: Math.min(baseY, CANVAS_H - CARD_H_EST - 20)
  });
  render();
  scheduleSave();
}

function removeCard(id) {
  state.cards = state.cards.filter(c => c.id !== id);
  state.connections = state.connections.filter(conn => conn[0] !== id && conn[1] !== id);
  if (pendingSelect === id) pendingSelect = null;
  render();
  scheduleSave();
}

function toggleConnection(idA, idB) {
  const exists = state.connections.findIndex(c => (c[0] === idA && c[1] === idB) || (c[0] === idB && c[1] === idA));
  if (exists >= 0) {
    state.connections.splice(exists, 1);
  } else {
    state.connections.push([idA, idB]);
  }
  scheduleSave();
}

function removeConnectionAt(idA, idB) {
  const idx = state.connections.findIndex(c => (c[0] === idA && c[1] === idB) || (c[0] === idB && c[1] === idA));
  if (idx >= 0) { state.connections.splice(idx, 1); scheduleSave(); }
}

function anchorOf(card) {
  return { x: card.x + CARD_W / 2, y: card.y + 16 };
}

function render() {
  const root = document.getElementById('quadro-root');
  root.innerHTML = `
    <div class="qw-wrap">
      <div class="qw-frame">
        <div class="qw-header">
          <p class="qw-eyebrow">O Avesso</p>
          <h1 class="qw-title">Quadro de Linhas</h1>
          <p class="qw-hint">arraste pelas alças coloridas · ative "conectar" e clique em dois cartões pra ligar um fio · clique num fio pra cortá-lo</p>
          <p class="scope-note">este quadro é da mesa inteira — o que você prega aqui, todo mundo vê</p>
        </div>

        <div class="qw-toolbar">
          <button class="qw-btn pista" id="add-pista">+ Pista</button>
          <button class="qw-btn suspeito" id="add-suspeito">+ Suspeito / NPC</button>
          <button class="qw-btn local" id="add-local">+ Local</button>
          <button class="qw-btn ${connectMode ? 'connect-mode' : ''}" id="toggle-connect">${connectMode ? '● conectando...' : 'Conectar'}</button>
        </div>

        <div class="board-outer">
          <div class="board-canvas" id="board-canvas">
            <svg class="board-svg" id="board-svg"></svg>
            <div id="cards-layer"></div>
          </div>
        </div>

        <div class="footer-bar">
          <span class="save-indicator" id="save-indicator">salvo ✓</span>
        </div>
      </div>
    </div>
  `;
  renderCards();
  drawConnections();
  attachHandlers();
}

function renderCards() {
  const layer = document.getElementById('cards-layer');
  layer.innerHTML = state.cards.map(c => `
    <div class="pin-card ${c.tipo} ${pendingSelect === c.id ? 'selected' : ''}" data-card-id="${c.id}" style="left:${c.x}px; top:${c.y}px;">
      <div class="card-handle" data-handle="${c.id}">
        <span class="pin-dot"></span>
        <span class="card-type-label">${c.tipo}</span>
        <button class="remove-x" data-remove-card="${c.id}">✕</button>
      </div>
      <div class="card-body">
        <input class="card-title" data-title="${c.id}" value="${escapeAttr(c.titulo)}">
        <textarea class="card-notes" data-notes="${c.id}" placeholder="detalhes...">${escapeHtml(c.notas)}</textarea>
      </div>
    </div>
  `).join('');

  layer.querySelectorAll('[data-title]').forEach(el => {
    el.addEventListener('input', e => {
      const id = parseInt(el.getAttribute('data-title'), 10);
      const card = state.cards.find(c => c.id === id);
      if (card) { card.titulo = e.target.value; scheduleSave(); }
    });
  });
  layer.querySelectorAll('[data-notes]').forEach(el => {
    el.addEventListener('input', e => {
      const id = parseInt(el.getAttribute('data-notes'), 10);
      const card = state.cards.find(c => c.id === id);
      if (card) { card.notas = e.target.value; scheduleSave(); }
    });
  });
  layer.querySelectorAll('[data-remove-card]').forEach(btn => {
    btn.addEventListener('click', () => removeCard(parseInt(btn.getAttribute('data-remove-card'), 10)));
  });
  layer.querySelectorAll('[data-handle]').forEach(handle => {
    const id = parseInt(handle.getAttribute('data-handle'), 10);
    if (connectMode) {
      handle.addEventListener('click', () => {
        if (pendingSelect === null) {
          pendingSelect = id;
          renderCards();
        } else if (pendingSelect === id) {
          pendingSelect = null;
          renderCards();
        } else {
          toggleConnection(pendingSelect, id);
          pendingSelect = null;
          renderCards();
          drawConnections();
        }
      });
    } else {
      handle.addEventListener('pointerdown', e => startDrag(e, id));
    }
  });
}

function startDrag(e, id) {
  const card = state.cards.find(c => c.id === id);
  if (!card) return;
  const canvas = document.getElementById('board-canvas');
  const canvasRect = canvas.getBoundingClientRect();
  dragging = {
    id: id,
    offsetX: e.clientX - canvasRect.left - card.x,
    offsetY: e.clientY - canvasRect.top - card.y
  };
  document.addEventListener('pointermove', onDrag);
  document.addEventListener('pointerup', endDrag);
}

function onDrag(e) {
  if (!dragging) return;
  const canvas = document.getElementById('board-canvas');
  const canvasRect = canvas.getBoundingClientRect();
  const card = state.cards.find(c => c.id === dragging.id);
  if (!card) return;
  let newX = e.clientX - canvasRect.left - dragging.offsetX;
  let newY = e.clientY - canvasRect.top - dragging.offsetY;
  newX = Math.max(0, Math.min(CANVAS_W - CARD_W, newX));
  newY = Math.max(0, Math.min(CANVAS_H - 40, newY));
  card.x = newX;
  card.y = newY;
  const el = document.querySelector('[data-card-id="' + card.id + '"]');
  if (el) { el.style.left = newX + 'px'; el.style.top = newY + 'px'; }
  drawConnections();
}

function endDrag() {
  document.removeEventListener('pointermove', onDrag);
  document.removeEventListener('pointerup', endDrag);
  if (dragging) scheduleSave();
  dragging = null;
}

function drawConnections() {
  const svg = document.getElementById('board-svg');
  if (!svg) return;
  svg.innerHTML = state.connections.map(conn => {
    const a = state.cards.find(c => c.id === conn[0]);
    const b = state.cards.find(c => c.id === conn[1]);
    if (!a || !b) return '';
    const pA = anchorOf(a);
    const pB = anchorOf(b);
    const midX = (pA.x + pB.x) / 2;
    const midY = (pA.y + pB.y) / 2 + 45;
    return `<path d="M ${pA.x},${pA.y} Q ${midX},${midY} ${pB.x},${pB.y}"
              fill="none" stroke="#a5453f" stroke-width="2" opacity="0.75"
              data-conn-a="${a.id}" data-conn-b="${b.id}"
              style="filter: drop-shadow(1px 2px 1px rgba(0,0,0,0.4));"/>`;
  }).join('');

  svg.querySelectorAll('path').forEach(path => {
    path.addEventListener('click', () => {
      const idA = parseInt(path.getAttribute('data-conn-a'), 10);
      const idB = parseInt(path.getAttribute('data-conn-b'), 10);
      removeConnectionAt(idA, idB);
      drawConnections();
    });
  });
}

function attachHandlers() {
  document.getElementById('add-pista').addEventListener('click', () => addCard('pista'));
  document.getElementById('add-suspeito').addEventListener('click', () => addCard('suspeito'));
  document.getElementById('add-local').addEventListener('click', () => addCard('local'));
  document.getElementById('toggle-connect').addEventListener('click', () => {
    connectMode = !connectMode;
    pendingSelect = null;
    render();
  });
}
