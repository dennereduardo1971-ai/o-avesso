// moradores.js — Moradores do Avesso. Quem vive de cada lado do mapa, e como
// cada um está com a mesa.
//
// A mesa lê; só o mestre escreve (o RLS confere isso no banco, não só aqui).
// Os jogadores enxergam apenas quem já foi apresentado — o resto é porta que
// ainda não bateram. Segredo e notas de bastidor são linha pessoal do mestre:
// nem aparecem nesta página pros outros, nem existem pra eles no banco.
//
// A postura de cada morador não soma nada em dado nenhum: ela decide se a
// informação sai na conversa, sai normal, ou vira "agir sob risco" (regras.js).
//
// Duas camadas de postura, e a de baixo é o piso:
//   geral   -> como ele está com a mesa inteira
//   relação -> como ele está com UMA visitante, quando o mestre marcou
// Onde existe relação, é ela que vale. É o que faz a mesma pergunta não pedir
// dado nenhum de quem ele gosta e virar risco pra quem ele não engoliu.

import { initPage, createSaver, escapeHtml, escapeAttr, ambientar, seamHtml } from './session.js';
import { AREAS, nomeDoLugar, iconeDoLugar } from './lugares.js';
import { POSTURAS, postura as posturaDe } from './regras.js';
import {
  ARCOS, arco as arcoDe, carregarElenco, salvarElenco,
  carregarSegredos, salvarSegredos, relacaoCom, chaveRelacao, ELENCO_KEY
} from './elenco.js';
import { carregarVisitantes } from './visitantes.js';

let moradores = [];
let bruto = { estado: {}, extras: [], relacoes: {}, pulso: {} };
let segredos = {};
let visitantes = [];
let aberto = null; // id do morador com a ficha expandida

const salvarPublico = createSaver('mr-save');
const salvarPrivado = createSaver('mr-save');

const user = await initPage({
  escopo: 'compartilhado',
  onSync: carregarTudo,
  escutar: [ELENCO_KEY]
});
if (user) {
  await carregarTudo();
  ambientar();
}

async function carregarTudo() {
  const elenco = await carregarElenco();
  moradores = elenco.moradores;
  bruto = elenco.bruto;
  segredos = user && user.isMestre ? await carregarSegredos() : {};
  visitantes = user && user.isMestre ? await carregarVisitantes() : [];
  render();
}

// Quem o mestre não apresentou ainda simplesmente não existe pros jogadores.
function visiveis() {
  return user.isMestre ? moradores : moradores.filter((m) => m.revelado);
}

function estadoDe(id) {
  if (!bruto.estado[id]) {
    const m = moradores.find((x) => x.id === id) || {};
    bruto.estado[id] = {
      postura: m.postura, humor: m.humor, revelado: m.revelado,
      arco: m.arco || 0, arcoFechado: Boolean(m.arcoFechado)
    };
  }
  return bruto.estado[id];
}

function relacaoPorChave(chave) {
  if (!bruto.relacoes[chave]) bruto.relacoes[chave] = { postura: '', nota: '' };
  return bruto.relacoes[chave];
}

// Relação sem postura e sem nota é relação que não existe — não vale ocupar
// espaço no que a mesa inteira baixa a cada tela.
function limparRelacoesVazias() {
  Object.keys(bruto.relacoes).forEach((chave) => {
    const r = bruto.relacoes[chave];
    if (!r || (!r.postura && !String(r.nota || '').trim())) delete bruto.relacoes[chave];
  });
}

function agendarSalvarPublico() {
  salvarPublico(() => {
    limparRelacoesVazias();
    return salvarElenco(bruto);
  });
}

function agendarSalvarPrivado() {
  salvarPrivado(() => salvarSegredos(segredos));
}

// ---- desenho ---------------------------------------------------------------

function render() {
  const lista = visiveis();
  const root = document.getElementById('moradores-root');
  root.innerHTML = `
    <div class="mr-wrap">
      <div class="mr-frame">
        <div class="mr-header">
          <p class="mr-eyebrow">O Avesso</p>
          <h1 class="mr-title">Moradores do Avesso</h1>
          <p class="mr-sub">Sete portas, e quem atende atrás de cada uma.</p>
          <p class="mr-note">${user.isMestre
            ? 'você vê o elenco inteiro — a mesa só conhece quem você já apresentou'
            : 'esta lista é da mesa: quem ainda não apareceu não está aqui'}</p>
        </div>

        ${seamHtml()}

        ${renderLegenda()}

        ${lista.length === 0
          ? '<p class="mr-empty">ninguém foi apresentado ainda — o Avesso está de portas fechadas</p>'
          : renderPorRegiao(lista)}

        <p class="mr-save-indicator" id="mr-save">salvo ✓</p>
      </div>
    </div>
  `;

  ligarHandlers();
}

function renderLegenda() {
  return `
    <div class="mr-legenda">
      <p class="mr-legenda-titulo">Como cada um está com vocês</p>
      ${POSTURAS.map((p) => `
        <p class="mr-legenda-linha">
          <span class="mr-postura ${p.chave}">${p.icone} ${p.nome}</span>
          <span class="mr-legenda-texto">${escapeHtml(p.naMesa)}</span>
        </p>
      `).join('')}
      <p class="mr-legenda-rodape">
        Nenhuma delas muda o número do dado — elas mudam se há dado.
      </p>
    </div>
  `;
}

function renderPorRegiao(lista) {
  const ordem = AREAS.map((a) => a.id).concat(['']);
  const grupos = ordem
    .map((areaId) => ({
      areaId: areaId,
      moradores: lista.filter((m) => (m.local || '') === areaId)
    }))
    .filter((g) => g.moradores.length > 0);

  return grupos.map((g) => `
    <section class="mr-regiao">
      <p class="mr-regiao-titulo">
        <span class="mr-regiao-icone">${iconeDoLugar(g.areaId)}</span>
        ${escapeHtml(nomeDoLugar(g.areaId))}
      </p>
      <div class="mr-lista">${g.moradores.map(cardHtml).join('')}</div>
    </section>
  `).join('');
}

function cardHtml(m) {
  // o mestre olha a postura geral (é o painel dele); cada visitante olha a
  // que vale pra ela
  const rel = relacaoCom(m, user.username, bruto.relacoes);
  const p = posturaDe(user.isMestre ? m.postura : rel.postura);
  const expandido = aberto === m.id;
  const arco = arcoDe(m.arco);

  return `
    <article class="mr-card ${m.revelado ? '' : 'oculto'} ${expandido ? 'aberto' : ''}" data-morador="${escapeAttr(m.id)}">
      <button type="button" class="mr-card-topo" data-abrir="${escapeAttr(m.id)}" aria-expanded="${expandido}">
        <span class="mr-icone">${m.icone}</span>
        <span class="mr-identidade">
          <span class="mr-nome">${escapeHtml(m.nome)}</span>
          <span class="mr-papel">${escapeHtml(m.papel)}</span>
        </span>
        <span class="mr-postura ${p.chave}">
          ${p.icone} ${p.nome}${!user.isMestre && rel.propria ? ' · com você' : ''}
        </span>
      </button>

      ${m.revelado ? '' : '<p class="mr-flag">ainda não apresentado à mesa</p>'}

      <div class="mr-corpo" ${expandido ? '' : 'hidden'}>
        <p class="mr-linha"><span class="mr-rot">traço</span> ${escapeHtml(m.traco)}</p>
        ${m.gancho ? `<p class="mr-linha"><span class="mr-rot">por onde puxar</span> ${escapeHtml(m.gancho)}</p>` : ''}
        ${m.humor ? `<p class="mr-humor">“${escapeHtml(m.humor)}”</p>` : ''}
        <p class="mr-conselho">${escapeHtml(p.naMesa)}</p>
        ${!user.isMestre && rel.propria
          ? '<p class="mr-conselho">isto é entre vocês dois — com o resto da mesa pode ser outra coisa.</p>'
          : ''}
        ${!user.isMestre && rel.nota ? `<p class="mr-humor">${escapeHtml(rel.nota)}</p>` : ''}
        ${user.isMestre ? `<p class="mr-arco-chip">🧶 ${escapeHtml(arco.nome)} — ${escapeHtml(arco.desc)}</p>` : ''}
        ${user.isMestre ? controlesMestreHtml(m) : ''}
      </div>
    </article>
  `;
}

/**
 * A grade de relações deste morador — uma linha por visitante que já
 * atravessou o espelho. Vazio = vale a postura geral; é de propósito que o
 * padrão seja não ter opinião sobre ninguém.
 */
function relacoesHtml(m) {
  const gente = visitantes.filter((v) => !v.mestre);
  if (gente.length === 0) {
    return `
      <div class="mr-campo">
        <label>Com cada visitante</label>
        <p class="mr-relacoes-vazio">ninguém atravessou o espelho ainda — a grade aparece quando as jogadoras entrarem pelo menos uma vez</p>
      </div>
    `;
  }

  return `
    <div class="mr-campo">
      <label>Com cada visitante (vazio = vale a postura geral)</label>
      <div class="mr-relacoes">
        ${gente.map((v) => {
          const chave = chaveRelacao(m.id, v.username);
          const r = bruto.relacoes[chave] || { postura: '', nota: '' };
          return `
            <div class="mr-relacao">
              <span class="mr-relacao-nome">${escapeHtml(v.nome)}</span>
              <select data-rel-postura="${escapeAttr(chave)}">
                <option value="">— como com a mesa —</option>
                ${POSTURAS.map((p) => `
                  <option value="${p.chave}" ${r.postura === p.chave ? 'selected' : ''}>${p.icone} ${p.nome}</option>
                `).join('')}
              </select>
              <input type="text" data-rel-nota="${escapeAttr(chave)}" value="${escapeAttr(r.nota)}"
                     placeholder="o que houve entre os dois (a visitante lê)">
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function controlesMestreHtml(m) {
  const seg = segredos[m.id] || { segredo: '', notas: '' };
  return `
    <div class="mr-mestre">
      <p class="mr-mestre-label">🔒 só o mestre daqui pra baixo</p>

      <label class="mr-toggle">
        <input type="checkbox" data-revelar="${escapeAttr(m.id)}" ${m.revelado ? 'checked' : ''}>
        apresentar à mesa
      </label>

      <div class="mr-campo">
        <label>Postura com a mesa</label>
        <select data-postura="${escapeAttr(m.id)}">
          ${POSTURAS.map((p) => `
            <option value="${p.chave}" ${m.postura === p.chave ? 'selected' : ''}>
              ${p.nome} — ${p.resumo}
            </option>
          `).join('')}
        </select>
      </div>

      <div class="mr-campo">
        <label>Humor de agora (a mesa lê isto)</label>
        <input type="text" data-humor="${escapeAttr(m.id)}" value="${escapeAttr(m.humor)}"
               placeholder="ex: não dorme desde a noite do Duque">
      </div>

      <div class="mr-campo">
        <label>Arco — onde a costura dele está</label>
        <select data-arco="${escapeAttr(m.id)}">
          ${ARCOS.map((a) => `
            <option value="${a.n}" ${m.arco === a.n ? 'selected' : ''}>${a.nome} — ${a.desc}</option>
          `).join('')}
        </select>
      </div>

      ${relacoesHtml(m)}

      ${m.promovido ? `
        <div class="mr-campo">
          <label>Posto no Avesso</label>
          <input type="text" data-papel="${escapeAttr(m.id)}" value="${escapeAttr(m.papel)}"
                 placeholder="o que essa pessoa faz por aqui">
        </div>
        <div class="mr-campo">
          <label>Onde mora</label>
          <select data-local="${escapeAttr(m.id)}">
            <option value="">à deriva pelo Avesso</option>
            ${AREAS.map((a) => `<option value="${a.id}" ${m.local === a.id ? 'selected' : ''}>${a.icone} ${escapeHtml(a.nome)}</option>`).join('')}
          </select>
        </div>
      ` : ''}

      <div class="mr-campo">
        <label>Segredo / motivação real</label>
        <textarea data-segredo="${escapeAttr(m.id)}"
                  placeholder="o que essa pessoa não conta, e o que ela quer de verdade...">${escapeHtml(seg.segredo)}</textarea>
      </div>

      <div class="mr-campo">
        <label>Notas de bastidor</label>
        <textarea data-notas="${escapeAttr(m.id)}"
                  placeholder="o que já rolou entre ela e a mesa, promessas feitas, dívidas...">${escapeHtml(seg.notas)}</textarea>
      </div>

      ${m.promovido ? `
        <button type="button" class="mr-remover" data-remover="${escapeAttr(m.id)}">
          devolver ao Gerador (tira do elenco)
        </button>
      ` : ''}
    </div>
  `;
}

// ---- eventos ---------------------------------------------------------------

function ligarHandlers() {
  const root = document.getElementById('moradores-root');

  root.querySelectorAll('[data-abrir]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-abrir');
      aberto = aberto === id ? null : id;
      render();
    });
  });

  if (!user.isMestre) return;

  root.querySelectorAll('[data-revelar]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      const id = cb.getAttribute('data-revelar');
      estadoDe(id).revelado = e.target.checked;
      const m = moradores.find((x) => x.id === id);
      if (m) m.revelado = e.target.checked;
      agendarSalvarPublico();
      render();
    });
  });

  root.querySelectorAll('[data-postura]').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const id = sel.getAttribute('data-postura');
      estadoDe(id).postura = e.target.value;
      const m = moradores.find((x) => x.id === id);
      if (m) m.postura = e.target.value;
      agendarSalvarPublico();
      render();
    });
  });

  root.querySelectorAll('[data-humor]').forEach((el) => {
    el.addEventListener('input', (e) => {
      const id = el.getAttribute('data-humor');
      estadoDe(id).humor = e.target.value;
      const m = moradores.find((x) => x.id === id);
      if (m) m.humor = e.target.value;
      agendarSalvarPublico();
    });
  });

  root.querySelectorAll('[data-arco]').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      const id = sel.getAttribute('data-arco');
      const n = parseInt(e.target.value, 10) || 0;
      estadoDe(id).arco = n;
      const m = moradores.find((x) => x.id === id);
      if (m) m.arco = n;
      agendarSalvarPublico();
      render();
    });
  });

  root.querySelectorAll('[data-rel-postura]').forEach((sel) => {
    sel.addEventListener('change', (e) => {
      relacaoPorChave(sel.getAttribute('data-rel-postura')).postura = e.target.value;
      agendarSalvarPublico();
      render();
    });
  });

  root.querySelectorAll('[data-rel-nota]').forEach((el) => {
    el.addEventListener('input', (e) => {
      relacaoPorChave(el.getAttribute('data-rel-nota')).nota = e.target.value;
      agendarSalvarPublico();
    });
  });

  root.querySelectorAll('[data-papel]').forEach((el) => {
    el.addEventListener('input', (e) => aplicarEmExtra(el.getAttribute('data-papel'), 'papel', e.target.value));
  });

  root.querySelectorAll('[data-local]').forEach((el) => {
    el.addEventListener('change', (e) => {
      aplicarEmExtra(el.getAttribute('data-local'), 'local', e.target.value);
      render();
    });
  });

  root.querySelectorAll('[data-segredo]').forEach((el) => {
    el.addEventListener('input', (e) => aplicarSegredo(el.getAttribute('data-segredo'), 'segredo', e.target.value));
  });

  root.querySelectorAll('[data-notas]').forEach((el) => {
    el.addEventListener('input', (e) => aplicarSegredo(el.getAttribute('data-notas'), 'notas', e.target.value));
  });

  root.querySelectorAll('[data-remover]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-remover');
      const m = moradores.find((x) => x.id === id);
      if (!m) return;
      if (!confirm(`Tirar ${m.nome} do elenco? As notas de bastidor dele somem junto.`)) return;
      bruto.extras = bruto.extras.filter((e) => e.id !== id);
      delete bruto.estado[id];
      delete segredos[id];
      moradores = moradores.filter((x) => x.id !== id);
      if (aberto === id) aberto = null;
      agendarSalvarPublico();
      agendarSalvarPrivado();
      render();
    });
  });
}

function aplicarEmExtra(id, campo, valor) {
  const extra = bruto.extras.find((e) => e.id === id);
  if (!extra) return;
  extra[campo] = valor;
  const m = moradores.find((x) => x.id === id);
  if (m) m[campo] = valor;
  agendarSalvarPublico();
}

function aplicarSegredo(id, campo, valor) {
  segredos[id] = Object.assign({ segredo: '', notas: '' }, segredos[id]);
  segredos[id][campo] = valor;
  agendarSalvarPrivado();
}
