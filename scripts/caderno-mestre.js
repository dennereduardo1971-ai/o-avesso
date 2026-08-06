// caderno-mestre.js — só abre pra quem conduz o Avesso (ver MESTRE em db.js).
// Os dados são pessoais do mestre: nem aparecem pros jogadores, nem no banco.

import { initPage, storage, createSaver, escapeHtml, escapeAttr, ambientar, seamHtml } from './session.js';

const STORAGE_KEY = 'o-avesso-caderno-mestre';
const COMPARTILHADO = false;

const defaultState = {
  sessaoAtual: '2',
  dataUltima: '',
  casoAtual: '',
  statusCaso: '',
  fiosSoltos: '',
  npcs: [],
  verdades: [
    { feita: false, nota: '' },
    { feita: false, nota: '' },
    { feita: false, nota: '' }
  ],
  mundoLog: [],
  notasGerais: ''
};

let state = JSON.parse(JSON.stringify(defaultState));
const save = createSaver('save-indicator');

const user = await initPage({ escopo: 'mestre', somenteMestre: true });
if (user) {
  await loadState();
  ambientar();
}

async function loadState() {
  try {
    const saved = await storage.get(STORAGE_KEY, COMPARTILHADO);
    if (saved) {
      state = Object.assign({}, defaultState, saved);
      if (!Array.isArray(state.npcs)) state.npcs = [];
      if (!Array.isArray(state.mundoLog)) state.mundoLog = [];
      if (!Array.isArray(state.verdades) || state.verdades.length !== 3) {
        state.verdades = JSON.parse(JSON.stringify(defaultState.verdades));
      }
    }
  } catch (e) {}
  render();
}

function scheduleSave() {
  save(() => storage.set(STORAGE_KEY, state, COMPARTILHADO));
}

function render() {
  const root = document.getElementById('caderno-root');
  root.innerHTML = `
    <div class="mestre-wrap">
      <div class="book">
        <div class="book-inner">
          <div class="header">
            <p class="eyebrow">O Avesso</p>
            <h1 class="title">Caderno do Mestre</h1>
            <p class="subtitle">O que só você precisa lembrar.</p>
          </div>

          ${seamHtml()}

          <div class="row-2">
            <div class="field">
              <label>Última sessão jogada</label>
              <input type="text" id="f-data" value="${escapeAttr(state.dataUltima)}" placeholder="ex: 22/07">
            </div>
            <div class="field small">
              <label>Próxima sessão nº</label>
              <input type="text" id="f-sessao" value="${escapeAttr(state.sessaoAtual)}">
            </div>
          </div>

          <p class="section-label">Caso em Andamento</p>
          <div class="card">
            <div class="field" style="margin-bottom:10px;">
              <label>Nome do caso</label>
              <input type="text" id="f-caso" value="${escapeAttr(state.casoAtual)}" placeholder="ex: O Caso do Duque Desfiado">
            </div>
            <div class="field" style="margin-bottom:10px;">
              <label>Status / onde o grupo parou</label>
              <input type="text" id="f-status" value="${escapeAttr(state.statusCaso)}" placeholder="ex: já encontraram a emenda da parede, ainda não confrontaram">
            </div>
            <div class="field">
              <label>Fios soltos / o que ainda não foi resolvido</label>
              <textarea id="f-fios" placeholder="pistas ainda não usadas, NPCs que ainda vão aparecer, coisas que você plantou e não pagou ainda...">${escapeHtml(state.fiosSoltos)}</textarea>
            </div>
          </div>

          ${seamHtml()}

          <p class="section-label">
            <span>Personagens (NPCs)</span>
          </p>
          <div id="npc-list"></div>
          <div class="add-btn-row"><button class="mini-btn" id="add-npc">+ novo personagem</button></div>

          ${seamHtml()}

          <p class="section-label">Verdades Esquecidas — notas reais</p>
          <div id="verdades-list"></div>

          ${seamHtml()}

          <p class="section-label">
            <span>Mundo Persistente</span>
          </p>
          <div id="log-list"></div>
          <div class="add-btn-row"><button class="mini-btn" id="add-log">+ novo registro</button></div>

          ${seamHtml()}

          <p class="section-label">Notas Gerais / Ideias Futuras</p>
          <div class="field notas">
            <textarea id="f-notas" placeholder="ideias soltas pros próximos casos, coisas que a mesa disse que você quer aproveitar depois...">${escapeHtml(state.notasGerais)}</textarea>
          </div>

          <div class="footer-bar">
            <span class="save-indicator" id="save-indicator">salvo ✓</span>
            <button class="reset-btn" id="reset-btn">reiniciar caderno</button>
          </div>
        </div>
      </div>
    </div>
  `;
  renderNpcs();
  renderVerdades();
  renderLog();
  attachStaticHandlers();
}

function renderNpcs() {
  const wrap = document.getElementById('npc-list');
  wrap.innerHTML = state.npcs.map((npc, i) => `
    <div class="card npc-card">
      <button class="remove-x" data-remove-npc="${i}" title="remover">✕</button>
      <div class="npc-grid">
        <div class="field"><label>Nome</label><input type="text" data-npc="${i}" data-field="nome" value="${escapeAttr(npc.nome)}"></div>
        <div class="field"><label>Papel</label><input type="text" data-npc="${i}" data-field="papel" value="${escapeAttr(npc.papel)}"></div>
        <div class="field full"><label>Segredo / motivação real</label><input type="text" data-npc="${i}" data-field="segredo" value="${escapeAttr(npc.segredo)}"></div>
        <div class="field full"><label>Status atual</label><input type="text" data-npc="${i}" data-field="status" value="${escapeAttr(npc.status)}"></div>
      </div>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-npc]').forEach(el => {
    el.addEventListener('input', e => {
      const idx = parseInt(el.getAttribute('data-npc'), 10);
      const field = el.getAttribute('data-field');
      state.npcs[idx][field] = e.target.value;
      scheduleSave();
    });
  });
  wrap.querySelectorAll('[data-remove-npc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-remove-npc'), 10);
      state.npcs.splice(idx, 1);
      render();
      scheduleSave();
    });
  });
}

function renderVerdades() {
  const wrap = document.getElementById('verdades-list');
  const nomes = ['Primeira', 'Segunda', 'Terceira'];
  wrap.innerHTML = state.verdades.map((v, i) => `
    <div class="card verdade-card">
      <div class="verdade-top">
        <input type="checkbox" data-verdade-check="${i}" ${v.feita ? 'checked' : ''}>
        <span class="ord">${nomes[i]} Verdade</span>
      </div>
      <textarea data-verdade-nota="${i}" placeholder="o que ela realmente significa, e como ela se conecta ao fim da campanha...">${escapeHtml(v.nota)}</textarea>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-verdade-check]').forEach(cb => {
    cb.addEventListener('change', e => {
      const idx = parseInt(cb.getAttribute('data-verdade-check'), 10);
      state.verdades[idx].feita = e.target.checked;
      scheduleSave();
    });
  });
  wrap.querySelectorAll('[data-verdade-nota]').forEach(ta => {
    ta.addEventListener('input', e => {
      const idx = parseInt(ta.getAttribute('data-verdade-nota'), 10);
      state.verdades[idx].nota = e.target.value;
      scheduleSave();
    });
  });
}

function renderLog() {
  const wrap = document.getElementById('log-list');
  wrap.innerHTML = state.mundoLog.map((entry, i) => `
    <div class="card log-card">
      <button class="remove-x" data-remove-log="${i}" title="remover">✕</button>
      <div class="log-head">
        <input type="text" data-log="${i}" data-field="data" value="${escapeAttr(entry.data)}" placeholder="quando">
      </div>
      <textarea data-log="${i}" data-field="texto" placeholder="o que aconteceu no Avesso enquanto elas estavam fora...">${escapeHtml(entry.texto)}</textarea>
    </div>
  `).join('');

  wrap.querySelectorAll('[data-log]').forEach(el => {
    el.addEventListener('input', e => {
      const idx = parseInt(el.getAttribute('data-log'), 10);
      const field = el.getAttribute('data-field');
      state.mundoLog[idx][field] = e.target.value;
      scheduleSave();
    });
  });
  wrap.querySelectorAll('[data-remove-log]').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-remove-log'), 10);
      state.mundoLog.splice(idx, 1);
      render();
      scheduleSave();
    });
  });
}

function attachStaticHandlers() {
  document.getElementById('f-data').addEventListener('input', e => { state.dataUltima = e.target.value; scheduleSave(); });
  document.getElementById('f-sessao').addEventListener('input', e => { state.sessaoAtual = e.target.value; scheduleSave(); });
  document.getElementById('f-caso').addEventListener('input', e => { state.casoAtual = e.target.value; scheduleSave(); });
  document.getElementById('f-status').addEventListener('input', e => { state.statusCaso = e.target.value; scheduleSave(); });
  document.getElementById('f-fios').addEventListener('input', e => { state.fiosSoltos = e.target.value; scheduleSave(); });
  document.getElementById('f-notas').addEventListener('input', e => { state.notasGerais = e.target.value; scheduleSave(); });

  document.getElementById('add-npc').addEventListener('click', () => {
    state.npcs.push({ nome: '', papel: '', segredo: '', status: '' });
    render();
    scheduleSave();
  });
  document.getElementById('add-log').addEventListener('click', () => {
    state.mundoLog.push({ data: '', texto: '' });
    render();
    scheduleSave();
  });

  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('Reiniciar o caderno inteiro? Isso apaga tudo que foi anotado.')) {
      state = JSON.parse(JSON.stringify(defaultState));
      render();
      scheduleSave();
    }
  });
}
