// session.js — portaria das páginas internas.
// Confere quem atravessou o espelho, monta a barra de topo e decide
// se a porta abre (o Caderno do Mestre só abre pra uma pessoa).

import { auth, db, MESTRE, getNomeExibicao } from './db.js';
import { escapeHtml } from './util.js';
import { iniciarAtmosfera, costurar } from './atmosfera.js';

export { db as storage, MESTRE };
export { escapeHtml, escapeAttr } from './util.js';

const ESCOPOS = {
  pessoal: { icone: '🪡', rotulo: 'só você', dica: 'esta página é sua — ninguém mais lê o que você escreve aqui' },
  compartilhado: { icone: '🧵', rotulo: 'compartilhado', dica: 'todo mundo do grupo lê e edita esta página' },
  mestre: { icone: '🔒', rotulo: 'só o mestre', dica: 'esta página não existe para os jogadores' }
};

// Todas as telas do app, na mesma ordem do Hub. É daqui que sai o menu
// de navegação — antes só dava pra ir de uma tela a outra passando pelo Hub.
const TELAS = [
  { arquivo: 'index.html', icone: '🚪', nome: 'Hub', tipo: 'neutro' },
  { arquivo: 'manual.html', icone: '📖', nome: 'Manual do Jogador', tipo: 'pista' },
  { arquivo: 'ficha.html', icone: '🪡', nome: 'Ficha da Visitante', tipo: 'neutro' },
  { arquivo: 'dado.html', icone: '🎲', nome: 'Dado Rolável', tipo: 'pista' },
  { arquivo: 'quadro-de-linhas.html', icone: '🧵', nome: 'Quadro de Linhas', tipo: 'pista' },
  { arquivo: 'mapa.html', icone: '🗺️', nome: 'Mapa do Avesso', tipo: 'neutro' },
  { arquivo: 'diario.html', icone: '📰', nome: 'Diário do Avesso', tipo: 'neutro' },
  { arquivo: 'caderno-mestre.html', icone: '📓', nome: 'Caderno do Mestre', tipo: 'suspeito', somenteMestre: true },
  { arquivo: 'gerador-npcs.html', icone: '🎭', nome: 'Gerador de NPCs', tipo: 'suspeito', somenteMestre: true },
  { arquivo: 'conta.html', icone: '🪞', nome: 'Minha Conta', tipo: 'neutro' }
];

function paginaAtual() {
  const partes = window.location.pathname.split('/');
  return partes[partes.length - 1] || 'index.html';
}

function navHtml(user) {
  const atual = paginaAtual();
  const itens = TELAS
    .filter((tela) => !tela.somenteMestre || user.isMestre)
    .map((tela) => {
      const aqui = tela.arquivo === atual;
      return `
        <a class="nav-item ${tela.tipo}" href="${tela.arquivo}"${aqui ? ' aria-current="page"' : ''}>
          <span class="nav-icon" aria-hidden="true">${tela.icone}</span>
          <span>${escapeHtml(tela.nome)}</span>
          ${aqui ? '<span class="nav-here">você está aqui</span>' : ''}
        </a>`;
    })
    .join('');

  return `
    <span class="nav-wrap">
      <button type="button" class="topbar-btn" id="topbar-telas"
              aria-haspopup="true" aria-expanded="false" aria-controls="topbar-nav">telas ▾</button>
      <nav class="nav-panel" id="topbar-nav" hidden aria-label="Todas as telas">${itens}</nav>
    </span>
  `;
}

function ligarNav() {
  const botao = document.getElementById('topbar-telas');
  const painel = document.getElementById('topbar-nav');
  if (!botao || !painel) return;

  const fechar = () => {
    painel.hidden = true;
    botao.setAttribute('aria-expanded', 'false');
  };

  botao.addEventListener('click', (event) => {
    event.stopPropagation();
    const abrindo = painel.hidden;
    painel.hidden = !abrindo;
    botao.setAttribute('aria-expanded', String(abrindo));
  });

  // clicar fora ou apertar Esc fecha o menu
  document.addEventListener('click', (event) => {
    if (!painel.hidden && !painel.contains(event.target)) fechar();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !painel.hidden) {
      fechar();
      botao.focus();
    }
  });
}

function mountTopbar(user, escopo, onSync) {
  const info = ESCOPOS[escopo] || ESCOPOS.pessoal;
  const bar = document.createElement('div');
  bar.className = 'topbar';
  bar.innerHTML = `
    <a class="topbar-back" href="index.html">← Hub</a>
    ${navHtml(user)}
    <span class="scope-tag ${escopo}" title="${escapeHtml(info.dica)}">${info.icone} ${info.rotulo}</span>
    <span class="topbar-spacer"></span>
    ${onSync ? '<button type="button" class="topbar-btn" id="topbar-sync">recarregar</button>' : ''}
    <span class="user-chip">${escapeHtml(user.nomeExibicao || user.username)}${user.isMestre ? ' <em>mestre</em>' : ''}</span>
    <button type="button" class="topbar-btn" id="topbar-sair">sair</button>
  `;
  document.body.insertBefore(bar, document.body.firstChild);

  ligarNav();

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

/** Devolve a costura que separa seções — a mesma em todas as telas. */
export function seamHtml() {
  return `
    <div class="seam" aria-hidden="true">
      <svg viewBox="0 0 700 16" preserveAspectRatio="none">
        <path d="M0 8 Q 17.5 5, 35 8 T 70 8 T 105 8 T 140 8 T 175 8 T 210 8 T 245 8 T 280 8 T 315 8 T 350 8 T 385 8 T 420 8 T 455 8 T 490 8 T 525 8 T 560 8 T 595 8 T 630 8 T 665 8 T 700 8"/>
      </svg>
    </div>`;
}

/**
 * Liga a atmosfera da página: o campo de linhas ao fundo e a costura dos
 * divisores. Cada tela chama isto depois de desenhar o próprio conteúdo,
 * já que a teia precisa saber onde os cartões estão.
 */
export function ambientar(focoSeletor = '.patch') {
  iniciarAtmosfera(focoSeletor);
  costurar();
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
