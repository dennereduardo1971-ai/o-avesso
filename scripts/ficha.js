// ficha.js — Ficha da Visitante. Pessoal: cada login tem a sua, e ninguém mais lê.

import { initPage, storage, createSaver } from './session.js';

const STORAGE_KEY = 'o-avesso-ficha-personagem';
const COMPARTILHADO = false;

const defaultState = {
  nome: '',
  sessao: '1',
  agulha: '2',
  dedal: '2',
  linha: '2',
  logica: 5,
  kit: { lupa: false, monoculo: false, escala: false, dialetica: false },
  verdades: [
    { feito: false, texto: '' },
    { feito: false, texto: '' },
    { feito: false, texto: '' }
  ],
  notas: ''
};

let state = JSON.parse(JSON.stringify(defaultState));
const save = createSaver('save-indicator');

const user = await initPage({ escopo: 'pessoal' });
if (user) {
  await loadState();
}

async function loadState() {
  try {
    const saved = await storage.get(STORAGE_KEY, COMPARTILHADO);
    if (saved) {
      state = Object.assign({}, defaultState, saved);
      if (!Array.isArray(state.verdades) || state.verdades.length !== 3) {
        state.verdades = JSON.parse(JSON.stringify(defaultState.verdades));
      }
      state.kit = Object.assign({}, defaultState.kit, state.kit || {});
    }
  } catch (e) {
    // nada guardado ainda, ou o espelho está sem sinal: segue com os padrões
  }
  render();
}

function scheduleSave() {
  save(() => storage.set(STORAGE_KEY, state, COMPARTILHADO));
}

function clamp14(v) {
  let n = parseInt(v, 10);
  if (isNaN(n)) n = 1;
  return Math.max(1, Math.min(4, n));
}

function render() {
  const root = document.getElementById('ficha-root');
  root.innerHTML = `
    <div class="avesso-wrap">
      <div class="sheet">
        <div class="sheet-inner">
          <div class="header">
            <p class="eyebrow">O Avesso</p>
            <h1 class="title">Ficha da Visitante</h1>
            <p class="subtitle">A ficha de ${escapeHtml(user.nomeExibicao || user.username)} — cada fio conta uma sessão.</p>
          </div>

          <div class="seam"></div>

          <div class="row-2">
            <div class="field">
              <label>Nome</label>
              <input type="text" id="f-nome" value="${escapeAttr(state.nome)}" placeholder="Como você se chama, do outro lado do espelho?">
            </div>
            <div class="field small">
              <label>Sessão</label>
              <input type="text" id="f-sessao" value="${escapeAttr(state.sessao)}">
            </div>
          </div>

          <p class="section-label">Atributos</p>
          <div class="attrs">
            <div class="attr-card">
              <div class="attr-icon">🪡</div>
              <p class="attr-name">Agulha</p>
              <p class="attr-desc">precisão</p>
              <input class="attr-input" type="text" id="f-agulha" value="${escapeAttr(state.agulha)}">
            </div>
            <div class="attr-card">
              <div class="attr-icon">🧵</div>
              <p class="attr-name">Dedal</p>
              <p class="attr-desc">resistência</p>
              <input class="attr-input" type="text" id="f-dedal" value="${escapeAttr(state.dedal)}">
            </div>
            <div class="attr-card">
              <div class="attr-icon">🧶</div>
              <p class="attr-name">Linha</p>
              <p class="attr-desc">lógica</p>
              <input class="attr-input" type="text" id="f-linha" value="${escapeAttr(state.linha)}">
            </div>
          </div>

          <div class="logica-box">
            <div class="logica-top">
              <p class="section-label" style="margin:0;">Linha da Lógica</p>
              <p class="logica-count"><strong>${state.logica}</strong> / 5</p>
            </div>
            <div class="spools">
              ${[0,1,2,3,4].map(i => `<div class="spool ${i < state.logica ? 'filled' : ''}" data-idx="${i}">${i < state.logica ? '●' : '○'}</div>`).join('')}
            </div>
            <p class="logica-hint">clique nos carretéis para marcar o que já se perdeu</p>
          </div>

          <div class="seam"></div>

          <p class="section-label">Kit de Detetive</p>
          <div class="kit-list">
            ${kitItem('lupa', '🔍', 'Lupa de Pedra Furada')}
            ${kitItem('monoculo', '⏳', 'Monóculo do Tempo')}
            ${kitItem('escala', '🪞', 'Mudança de Escala')}
            ${kitItem('dialetica', '🎭', 'Dialética do Absurdo')}
          </div>

          <p class="section-label">Verdades Esquecidas</p>
          <div class="verdades">
            ${[0,1,2].map(i => `
              <div class="verdade-row">
                <input type="checkbox" data-idx="${i}" id="v-check-${i}" ${state.verdades[i].feito ? 'checked' : ''}>
                <span class="ord">${['Primeira','Segunda','Terceira'][i]}</span>
                <input type="text" id="v-texto-${i}" placeholder="o que foi descoberto..." value="${escapeAttr(state.verdades[i].texto)}">
              </div>
            `).join('')}
          </div>

          <div class="seam"></div>

          <p class="section-label">Anotações Pessoais</p>
          <div class="field notas">
            <textarea id="f-notas" placeholder="Anotações, teorias em aberto, coisas para lembrar na próxima sessão...">${escapeHtml(state.notas)}</textarea>
          </div>
          <p class="scope-note">só você lê estas anotações — nem o mestre, nem o resto da mesa</p>

          <div class="footer-bar">
            <span class="save-indicator" id="save-indicator">salvo ✓</span>
            <button class="reset-btn" id="reset-btn">reiniciar ficha</button>
          </div>
        </div>
      </div>
    </div>
  `;
  attachHandlers();
}

function kitItem(key, icon, name) {
  const checked = state.kit[key];
  return `<label class="kit-item ${checked ? 'checked' : ''}" data-kit="${key}">
    <input type="checkbox" data-kit-check="${key}" ${checked ? 'checked' : ''}>
    <span class="kit-icon">${icon}</span>
    <span class="kit-name">${name}</span>
  </label>`;
}

function escapeAttr(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}
function escapeHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function attachHandlers() {
  document.getElementById('f-nome').addEventListener('input', e => { state.nome = e.target.value; scheduleSave(); });
  document.getElementById('f-sessao').addEventListener('input', e => { state.sessao = e.target.value; scheduleSave(); });

  ['agulha','dedal','linha'].forEach(attr => {
    const el = document.getElementById('f-' + attr);
    el.addEventListener('input', e => { state[attr] = e.target.value; scheduleSave(); });
    el.addEventListener('blur', e => { state[attr] = String(clamp14(e.target.value)); render(); scheduleSave(); });
  });

  document.querySelectorAll('.spool').forEach(spool => {
    spool.addEventListener('click', () => {
      const idx = parseInt(spool.getAttribute('data-idx'), 10);
      state.logica = (idx + 1 === state.logica) ? idx : idx + 1;
      render();
      scheduleSave();
    });
  });

  document.querySelectorAll('[data-kit-check]').forEach(cb => {
    cb.addEventListener('change', e => {
      const key = cb.getAttribute('data-kit-check');
      state.kit[key] = e.target.checked;
      render();
      scheduleSave();
    });
  });

  [0,1,2].forEach(i => {
    document.getElementById('v-check-' + i).addEventListener('change', e => {
      state.verdades[i].feito = e.target.checked;
      scheduleSave();
    });
    document.getElementById('v-texto-' + i).addEventListener('input', e => {
      state.verdades[i].texto = e.target.value;
      scheduleSave();
    });
  });

  document.getElementById('f-notas').addEventListener('input', e => { state.notas = e.target.value; scheduleSave(); });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reiniciar a ficha inteira? Isso apaga tudo que foi preenchido.')) {
      state = JSON.parse(JSON.stringify(defaultState));
      render();
      scheduleSave();
    }
  });
}
