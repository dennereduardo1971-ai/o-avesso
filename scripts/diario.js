// diario.js — resumo de cada sessão. Compartilhado com a mesa inteira.

import { initPage, storage, createSaver, escapeHtml, escapeAttr, ambientar, seamHtml } from './session.js';

const STORAGE_KEY = 'o-avesso-diario';
const COMPARTILHADO = true;

let entries = [];
let idCounter = 1;
const save = createSaver('dv-save-indicator');

const user = await initPage({ escopo: 'compartilhado', onSync: loadState });
if (user) {
  await loadState();
  ambientar();
}

async function loadState() {
  try {
    const saved = await storage.get(STORAGE_KEY, COMPARTILHADO);
    entries = saved && Array.isArray(saved.entries) ? saved.entries : [];
    entries.forEach(e => { if (e.id >= idCounter) idCounter = e.id + 1; });
  } catch (e) {}
  render();
}

function scheduleSave() {
  save(() => storage.set(STORAGE_KEY, { entries: entries }, COMPARTILHADO));
}

function addEntry() {
  const nextNum = entries.length > 0 ? Math.max(...entries.map(e => parseInt(e.numero, 10) || 0)) + 1 : 1;
  entries.unshift({
    id: idCounter++,
    numero: String(nextNum),
    data: '',
    titulo: '',
    presentes: '',
    resumo: ''
  });
  render();
  scheduleSave();
}

function removeEntry(id) {
  entries = entries.filter(e => e.id !== id);
  render();
  scheduleSave();
}

function render() {
  const root = document.getElementById('diario-root');
  root.innerHTML = `
    <div class="dv-wrap">
      <div class="dv-frame">
        <div class="dv-header">
          <p class="dv-eyebrow">O Avesso</p>
          <h1 class="dv-title">Diário do Avesso</h1>
          <p class="dv-subtitle">Para quem esteve. E para quem vai chegar.</p>
          <p class="dv-notice">Este diário é da mesa inteira — todo mundo que atravessa o espelho lê e escreve aqui. Use-o pra registrar o resumo de cada sessão, pra quem faltou nunca ficar perdida.</p>
        </div>

        ${seamHtml()}

        <button class="dv-add-btn" id="add-entry">+ Nova Página</button>

        <div class="dv-entries" id="entries-list"></div>

        <div class="dv-footer">
          <span class="dv-save-indicator" id="dv-save-indicator">salvo ✓</span>
        </div>
      </div>
    </div>
  `;
  renderEntries();
  document.getElementById('add-entry').addEventListener('click', addEntry);
}

function renderEntries() {
  const wrap = document.getElementById('entries-list');
  if (entries.length === 0) {
    wrap.innerHTML = '<p class="dv-empty">nenhuma página escrita ainda — a primeira sessão está esperando por você</p>';
    return;
  }
  wrap.innerHTML = entries.map(e => `
    <div class="dv-entry">
      <button class="dv-remove" data-remove="${e.id}">✕</button>
      <div class="dv-entry-top">
        <div class="dv-field numero">
          <label>Nº</label>
          <input type="text" data-field="numero" data-id="${e.id}" value="${escapeAttr(e.numero)}">
        </div>
        <div class="dv-field data">
          <label>Data</label>
          <input type="text" data-field="data" data-id="${e.id}" value="${escapeAttr(e.data)}" placeholder="ex: 12/08">
        </div>
        <div class="dv-field titulo">
          <label>Título da sessão</label>
          <input type="text" data-field="titulo" data-id="${e.id}" value="${escapeAttr(e.titulo)}" placeholder="ex: O Caso do Duque Desfiado">
        </div>
      </div>
      <div class="dv-field dv-resumo">
        <label>O que aconteceu</label>
        <textarea data-field="resumo" data-id="${e.id}" placeholder="resumo da sessão, em linguagem simples, pra qualquer um entender mesmo sem ter jogado...">${escapeHtml(e.resumo)}</textarea>
      </div>
      <div class="dv-presentes">
        <label>Quem estava presente</label>
        <input type="text" data-field="presentes" data-id="${e.id}" value="${escapeAttr(e.presentes)}" placeholder="nomes separados por vírgula">
      </div>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-field]').forEach(el => {
    el.addEventListener('input', ev => {
      const id = parseInt(el.getAttribute('data-id'), 10);
      const field = el.getAttribute('data-field');
      const entry = entries.find(e => e.id === id);
      if (entry) { entry[field] = ev.target.value; scheduleSave(); }
    });
  });
  wrap.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removeEntry(parseInt(btn.getAttribute('data-remove'), 10)));
  });
}
