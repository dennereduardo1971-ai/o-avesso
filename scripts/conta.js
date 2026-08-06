// conta.js — Minha Conta. Nome de exibição (livre, self-service) e troca de
// senha. O login em si (o email fictício por baixo dos panos) não pode ser
// trocado por aqui — ver a nota na própria tela.

import { initPage, createSaver, escapeHtml, escapeAttr, ambientar, seamHtml } from './session.js';
import { auth, setNomeExibicao } from './db.js';
import { estado as estadoDosAvisos, ligar as ligarAvisos, desligar as desligarAvisos } from './avisos.js';

let nomeExibicao = '';
let avisos = 'sem-suporte';
let avisosMsg = null;
const saveNome = createSaver('ct-nome-save');

const user = await initPage({ escopo: 'pessoal' });
if (user) {
  nomeExibicao = user.nomeExibicao || user.username;
  avisos = await estadoDosAvisos();
  render();
  ambientar();
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

        ${seamHtml()}

        <section class="ct-section">
          <p class="ct-section-label">🪡 Nome de Exibição</p>
          <p class="ct-section-hint">como seu nome aparece na ficha, no histórico de rolagens e pro resto da mesa — troque à vontade</p>
          <input type="text" id="ct-nome" value="${escapeAttr(nomeExibicao)}" placeholder="${escapeAttr(user.username)}" maxlength="30">
          <p class="ct-footer-row">
            <span class="scope-note" style="margin:0;">deixe em branco pra voltar a usar "${escapeHtml(user.username)}"</span>
            <span class="ct-save-indicator" id="ct-nome-save">salvo ✓</span>
          </p>
        </section>

        ${renderAvisos()}

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

/**
 * Avisos do Avesso. Vale só pra este aparelho — ligar no celular não liga no
 * computador, e é assim mesmo: a inscrição é do navegador, não da conta.
 */
function renderAvisos() {
  const textos = {
    'sem-suporte': {
      estado: 'este aparelho não recebe avisos',
      hint: 'no iPhone, os avisos só funcionam com o app instalado na tela de início — pelo Safari em aba, o sistema não deixa'
    },
    'sem-chave': {
      estado: 'os avisos ainda não foram ligados nesta mesa',
      hint: 'falta o mestre publicar a função de avisos (ver gerar-chaves-push.js)'
    },
    'bloqueado': {
      estado: 'este aparelho recusou as notificações',
      hint: 'pra voltar atrás, libere as notificações deste site nas configurações do navegador'
    },
    'ligado': {
      estado: 'ligado neste aparelho',
      hint: 'você recebe um aviso quando o mestre publicar o que aconteceu entre as sessões — e nada além disso'
    },
    'desligado': {
      estado: 'desligado neste aparelho',
      hint: 'ligue pra saber quando o mestre publicar o entre-sessões, sem precisar abrir o app pra conferir'
    }
  };
  const t = textos[avisos] || textos['sem-suporte'];
  const podeMexer = avisos === 'ligado' || avisos === 'desligado';

  return `
    <section class="ct-section">
      <p class="ct-section-label">🔔 Avisos do Avesso</p>
      <p class="ct-section-hint">${escapeHtml(t.hint)}</p>
      <div class="ct-avisos-linha">
        <span class="ct-avisos-estado ${avisos}">${escapeHtml(t.estado)}</span>
        ${podeMexer ? `
          <button type="button" class="ct-btn pequeno" id="ct-avisos-btn">
            ${avisos === 'ligado' ? 'desligar aqui' : 'ligar neste aparelho'}
          </button>
        ` : ''}
      </div>
      ${avisosMsg ? `<p class="ct-msg ${avisosMsg.tom}">${escapeHtml(avisosMsg.texto)}</p>` : ''}
      <p class="scope-note" style="margin-top:10px;">o Avesso só chama quando o mestre chama — nada aqui dispara sozinho</p>
    </section>
  `;
}

async function alternarAvisos() {
  const btn = document.getElementById('ct-avisos-btn');
  btn.disabled = true;
  btn.textContent = 'costurando...';
  avisosMsg = null;

  try {
    if (avisos === 'ligado') {
      await desligarAvisos();
      avisosMsg = { tom: 'ok', texto: 'este aparelho não será mais avisado' };
    } else {
      await ligarAvisos();
      avisosMsg = { tom: 'ok', texto: 'pronto — o Avesso sabe onde te achar' };
    }
  } catch (e) {
    avisosMsg = { tom: 'erro', texto: e.message || 'não deu pra mexer nos avisos agora' };
  }

  avisos = await estadoDosAvisos();
  render();
}

function attachHandlers() {
  document.getElementById('ct-nome').addEventListener('input', e => {
    nomeExibicao = e.target.value;
    saveNome(() => setNomeExibicao(nomeExibicao));
  });

  document.getElementById('ct-trocar-senha').addEventListener('click', trocarSenha);

  const avisosBtn = document.getElementById('ct-avisos-btn');
  if (avisosBtn) avisosBtn.addEventListener('click', alternarAvisos);
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
