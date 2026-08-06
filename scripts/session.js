// session.js — portaria das páginas internas.
// Confere quem atravessou o espelho, monta a barra de topo e decide
// se a porta abre (o Caderno do Mestre só abre pra uma pessoa).

import { auth, db, MESTRE, getNomeExibicao } from './db.js';

export { db as storage, MESTRE };

const ESCOPOS = {
  pessoal: { icone: '🪡', rotulo: 'só você', dica: 'esta página é sua — ninguém mais lê o que você escreve aqui' },
  compartilhado: { icone: '🧵', rotulo: 'compartilhado', dica: 'todo mundo do grupo lê e edita esta página' },
  mestre: { icone: '🔒', rotulo: 'só o mestre', dica: 'esta página não existe para os jogadores' }
};

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function mountTopbar(user, escopo, onSync) {
  const info = ESCOPOS[escopo] || ESCOPOS.pessoal;
  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.innerHTML = `
    <a class="topbar-back" href="index.html">← Hub</a>
    <span class="scope-tag ${escopo}" title="${escapeHtml(info.dica)}">${info.icone} ${info.rotulo}</span>
    <span class="topbar-spacer"></span>
    ${onSync ? '<button type="button" class="topbar-btn" id="topbar-sync">recarregar</button>' : ''}
    <span class="user-chip">${escapeHtml(user.nomeExibicao || user.username)}${user.isMestre ? ' <em>mestre</em>' : ''}</span>
    <button type="button" class="topbar-btn" id="topbar-sair">sair</button>
  `;
  document.body.insertBefore(bar, document.body.firstChild);

  document.getElementById('topbar-sair').addEventListener('click', async () => {
    await auth.signOut();
    window.location.replace('index.html');
  });

  const syncBtn = document.getElementById('topbar-sync');
  if (syncBtn) {
    syncBtn.addEventListener('click', async () => {
      syncBtn.disabled = true;
      syncBtn.textContent = 'puxando o fio...';
      try {
        await onSync();
      } finally {
        syncBtn.disabled = false;
        syncBtn.textContent = 'recarregar';
      }
    });
  }
}

function renderPortaTrancada() {
  document.body.innerHTML = `
    <div class="locked-wrap">
      <div class="locked-card">
        <div class="locked-icon">🔒</div>
        <h1 class="locked-title">Porta costurada por dentro</h1>
        <p class="locked-text">
          Este caderno pertence a quem conduz o Avesso. De onde você está,
          ele é só mais uma parede com papel de parede floral.
        </p>
        <a class="locked-link" href="index.html">← voltar ao Hub</a>
      </div>
    </div>
  `;
}

/**
 * Prepara a página: exige sessão, aplica a regra do mestre e monta a barra.
 * Devolve { id, username, isMestre } ou null quando a página não deve seguir.
 *
 * @param {object} opts
 * @param {'pessoal'|'compartilhado'|'mestre'} opts.escopo  o que a etiqueta do topo mostra
 * @param {boolean} opts.somenteMestre                      trava a página pros jogadores
 * @param {function} [opts.onSync]                          liga o botão "recarregar" (páginas compartilhadas)
 */
export async function initPage({ escopo = 'pessoal', somenteMestre = false, onSync = null } = {}) {
  let user = null;
  try {
    user = await auth.getUser();
  } catch (e) {
    user = null;
  }

  if (!user) {
    window.location.replace('index.html');
    return null;
  }

  if (somenteMestre && !user.isMestre) {
    renderPortaTrancada();
    return null;
  }

  try {
    user.nomeExibicao = await getNomeExibicao(user);
  } catch (e) {
    user.nomeExibicao = user.username;
  }

  mountTopbar(user, escopo, onSync);
  return user;
}

/**
 * Salvamento com atraso + aviso visual, igual em todas as páginas.
 * @param {string} indicatorId id do elemento que mostra "salvo ✓"
 */
export function createSaver(indicatorId, delay = 500) {
  let timer = null;
  return function save(fn) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const indicator = document.getElementById(indicatorId);
      try {
        await fn();
        if (indicator) {
          indicator.classList.add('show');
          indicator.textContent = 'salvo ✓';
          setTimeout(() => indicator.classList.remove('show'), 1400);
        }
      } catch (e) {
        if (indicator) {
          indicator.classList.add('show');
          indicator.textContent = 'erro ao salvar';
        }
      }
    }, delay);
  };
}
