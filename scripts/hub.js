// hub.js — splash do espelho, login de verdade e a porta certa pra cada pessoa.

import { auth, getNomeExibicao } from './db.js';
import { escapeHtml } from './util.js';
import { iniciarAtmosfera, entrarEmCascata, costurar } from './atmosfera.js';

async function showHub(user) {
  const screen = document.getElementById('splash-screen');
  if (screen) screen.classList.add('fade-out');

  setTimeout(() => {
    const splash = document.getElementById('splash-root');
    if (splash) splash.innerHTML = '';
    document.getElementById('hub-root').style.display = 'block';
    // a teia só entra depois do Hub aparecer: ela precisa saber onde os
    // retalhos estão pra conseguir se retesar em volta deles
    iniciarAtmosfera('.portal-card');
    costurar();
    entrarEmCascata('.portal-card', 260);
  }, screen ? 700 : 0);

  // O Caderno do Mestre simplesmente não existe pra quem não conduz.
  document.querySelectorAll('[data-somente-mestre]').forEach((el) => {
    el.style.display = user.isMestre ? '' : 'none';
  });

  const chip = document.getElementById('hub-user');
  if (chip) {
    let nome = user.username;
    try { nome = await getNomeExibicao(user); } catch (e) {}
    chip.innerHTML = `atravessou como <strong>${escapeHtml(nome)}</strong>${user.isMestre ? ' <em>· mestre</em>' : ''}`;
  }

  const sair = document.getElementById('hub-sair');
  if (sair) {
    sair.addEventListener('click', async (event) => {
      event.preventDefault();
      await auth.signOut();
      window.location.reload();
    });
  }
}

function renderSplash() {
  const root = document.getElementById('splash-root');
  root.innerHTML = `
    <div class="splash-screen" id="splash-screen">
      <div class="splash-content">
        <div class="mirror-frame"></div>
        <p class="splash-eyebrow">Mansão Brasswood</p>
        <h1 class="splash-title">O AVESSO</h1>
        <p class="splash-tagline">"Do outro lado do espelho, tudo tem costura."</p>
        <div class="splash-card">
          <div class="field"><label>Usuário</label><input type="text" id="splash-user" autocomplete="username"></div>
          <div class="field"><label>Senha</label><input type="password" id="splash-pass" autocomplete="current-password"></div>
          <button class="splash-btn" id="splash-enter">Atravessar o Espelho</button>
          <p class="splash-error" id="splash-error"></p>
        </div>
        <p class="splash-note">cada nome atravessa pro seu próprio lado do espelho</p>
      </div>
    </div>
  `;
  document.getElementById('splash-enter').addEventListener('click', trySplashLogin);
  document.getElementById('splash-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') trySplashLogin(); });
  document.getElementById('splash-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') trySplashLogin(); });
  document.getElementById('splash-user').focus();
}

async function trySplashLogin() {
  const user = document.getElementById('splash-user').value.trim();
  const pass = document.getElementById('splash-pass').value;
  const errEl = document.getElementById('splash-error');
  const btn = document.getElementById('splash-enter');

  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = 'atravessando...';

  try {
    await auth.signIn(user, pass);
    const logado = await auth.getUser();
    showHub(logado);
  } catch (error) {
    errEl.textContent = 'o espelho não reconhece esse nome ou essa senha';
    btn.disabled = false;
    btn.textContent = 'Atravessar o Espelho';
  }
}

async function boot() {
  let user = null;
  try {
    user = await auth.getUser();
  } catch (e) {
    user = null;
  }

  if (user) {
    showHub(user);
  } else {
    renderSplash();
  }
}

// ---- instalação do PWA -----------------------------------------------------

let deferredInstallPrompt = null;
const installLink = document.getElementById('install-link');

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  if (installLink) installLink.style.display = 'inline-block';
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  if (installLink) installLink.style.display = 'none';
});

if (installLink) {
  installLink.addEventListener('click', async (event) => {
    event.preventDefault();
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const choice = await deferredInstallPrompt.userChoice;
    if (choice.outcome === 'accepted') {
      deferredInstallPrompt = null;
      installLink.style.display = 'none';
    }
  });
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('../service-worker.js').catch(() => {});
  });
}

boot();
