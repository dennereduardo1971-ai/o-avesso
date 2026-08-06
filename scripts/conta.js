// conta.js — Minha Conta. Nome de exibição (livre, self-service) e troca de
// senha. O login em si (o email fictício por baixo dos panos) não pode ser
// trocado por aqui — ver a nota na própria tela.

import { initPage, createSaver, escapeHtml, escapeAttr } from './session.js';
import { auth, setNomeExibicao } from './db.js';

let nomeExibicao = '';
const saveNome = createSaver('ct-nome-save');

const user = await initPage({ escopo: 'pessoal' });
if (user) {
  nomeExibicao = user.nomeExibicao || user.username;
  render();
}

function render() {
  const root = document.getElementById('conta-root');
  root.innerHTML = `
    <div class="ct-wrap">
      <div class="ct-frame">
        <div class="ct-header">
          <p class="ct-eyebrow">O Avesso</p>
          <h1 class="ct-title">Minha Conta</h1>
          <p class="ct-subtitle">Como você aparece pra mesa, e como você entra.</p>
        </div>

        <div class="ct-seam"></div>

        <section class="ct-section">
          <p class="ct-section-label">🪡 Nome de Exibição</p>
          <p class="ct-section-hint">como seu nome aparece na ficha, no histórico de rolagens e pro resto da mesa — troque à vontade</p>
          <input type="text" id="ct-nome" value="${escapeAttr(nomeExibicao)}" placeholder="${escapeAttr(user.username)}" maxlength="30">
          <p class="ct-footer-row">
            <span class="scope-note" style="margin:0;">deixe em branco pra voltar a usar "${escapeHtml(user.username)}"</span>
            <span class="ct-save-indicator" id="ct-nome-save">salvo ✓</span>
          </p>
        </section>

        <section class="ct-section">
          <p class="ct-section-label">🔒 Trocar Senha</p>
          <p class="ct-section-hint">precisa confirmar a senha atual antes de definir uma nova</p>
          <div class="ct-field">
            <label>Senha atual</label>
            <input type="password" id="ct-senha-atual" autocomplete="current-password">
          </div>
          <div class="ct-field">
            <label>Nova senha</label>
            <input type="password" id="ct-senha-nova" autocomplete="new-password">
          </div>
          <div class="ct-field">
            <label>Confirmar nova senha</label>
            <input type="password" id="ct-senha-confirma" autocomplete="new-password">
          </div>
          <button type="button" class="ct-btn" id="ct-trocar-senha">Trocar Senha</button>
          <p class="ct-msg" id="ct-senha-msg"></p>
        </section>

        <section class="ct-section info">
          <p class="ct-section-label">🧵 Sobre seu login</p>
          <p class="ct-info-text">Você entra no Avesso como <strong>${escapeHtml(user.username)}</strong>${user.isMestre ? ' <em>(mestre)</em>' : ''}. Esse nome é a chave da sua conta e não muda por aqui — só o nome de exibição acima. Se quiser um login realmente diferente, peça pro mestre trocar por você.</p>
        </section>
      </div>
    </div>
  `;

  attachHandlers();
}

function attachHandlers() {
  document.getElementById('ct-nome').addEventListener('input', e => {
    nomeExibicao = e.target.value;
    saveNome(() => setNomeExibicao(nomeExibicao));
  });

  document.getElementById('ct-trocar-senha').addEventListener('click', trocarSenha);
}

async function trocarSenha() {
  const atual = document.getElementById('ct-senha-atual').value;
  const nova = document.getElementById('ct-senha-nova').value;
  const confirma = document.getElementById('ct-senha-confirma').value;
  const msg = document.getElementById('ct-senha-msg');
  const btn = document.getElementById('ct-trocar-senha');

  msg.classList.remove('ok', 'erro');

  if (!atual || !nova) {
    msg.textContent = 'preencha a senha atual e a nova senha';
    msg.classList.add('erro');
    return;
  }
  if (nova !== confirma) {
    msg.textContent = 'a confirmação não bate com a nova senha';
    msg.classList.add('erro');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'trocando...';
  msg.textContent = '';

  try {
    await auth.updateOwnPassword(atual, nova);
    msg.textContent = 'senha trocada com sucesso ✓';
    msg.classList.add('ok');
    document.getElementById('ct-senha-atual').value = '';
    document.getElementById('ct-senha-nova').value = '';
    document.getElementById('ct-senha-confirma').value = '';
  } catch (e) {
    msg.textContent = e.message || 'não deu pra trocar a senha agora';
    msg.classList.add('erro');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Trocar Senha';
  }
}
