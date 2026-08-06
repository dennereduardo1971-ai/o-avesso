// caderno-mestre.js — só abre pra quem conduz o Avesso (ver MESTRE em db.js).
// Os dados são pessoais do mestre: nem aparecem pros jogadores, nem no banco.
//
// É daqui que o mundo se mexe. O botão "virar a página" fecha a sessão: olha
// o estado da mesa, propõe o que o Avesso faria entre um encontro e outro
// (pulso.js) e espera o sim de quem conduz. Nada acontece sem esse sim — não
// tem tarefa agendada, não tem servidor decidindo enredo de madrugada.

import { initPage, storage, createSaver, escapeHtml, escapeAttr, ambientar, seamHtml } from './session.js';
import { carregarElenco, salvarElenco, arco as arcoDe } from './elenco.js';
import { carregarVisitantes } from './visitantes.js';
import { proporVirada, aplicarProposta } from './pulso.js';
import { registrarEntreSessoes } from './diario-store.js';
import { configurado as avisosConfigurados, avisarMesa } from './avisos.js';

const STORAGE_KEY = 'o-avesso-caderno-mestre';
const COMPARTILHADO = false;
const MAPA_KEY = 'mapa-avesso';
const HISTORICO_KEY = 'o-avesso-historico-rolagens';

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

// o pulso do mundo vive fora do caderno: o elenco é compartilhado
let elenco = { moradores: [], bruto: { estado: {}, extras: [], relacoes: {}, pulso: {} } };
let propostas = [];
let pulsoOcupado = false;
let pulsoAviso = null;
let aprovadasAgora = []; // o que virou fato nesta virada, pra poder avisar a mesa

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
  try {
    elenco = await carregarElenco();
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

          <p class="section-label">Virar a Página</p>
          ${renderPulso()}

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

// ---- pulso do mundo --------------------------------------------------------

function renderPulso() {
  const virada = (elenco.bruto.pulso && elenco.bruto.pulso.virada) || 0;
  return `
    <div class="card pulso-card">
      <p class="pulso-explica">
        Ao fechar a sessão, o Avesso propõe o que faria enquanto ninguém está
        olhando. Nada aqui acontece sozinho: cada proposta espera o seu sim.
        O que você aprovar muda o estado do morador e vira página no Diário —
        o que você recusar fica quieto por duas viradas.
      </p>
      <div class="pulso-topo">
        <span class="pulso-contador">${virada === 0 ? 'nenhuma página virada ainda' : `${virada}ª virada`}</span>
        <button class="mini-btn pulso-btn" id="btn-virar" ${pulsoOcupado ? 'disabled' : ''}>
          ${pulsoOcupado ? 'ouvindo o Avesso...' : 'virar a página'}
        </button>
      </div>

      ${pulsoAviso ? `<p class="pulso-aviso ${pulsoAviso.tom}">${escapeHtml(pulsoAviso.texto)}</p>` : ''}

      ${renderAvisarMesa()}

      ${propostas.length > 0 ? `
        <div class="pulso-fila">
          ${propostas.map((p, i) => {
            const m = elenco.moradores.find((x) => x.id === p.moradorId);
            return `
              <div class="pulso-item">
                <p class="pulso-item-titulo">${escapeHtml(p.titulo)}</p>
                <p class="pulso-item-texto">${escapeHtml(p.texto)}</p>
                <p class="pulso-item-motivo">porque: ${escapeHtml(p.motivo)}</p>
                <p class="pulso-item-efeito">${escapeHtml(descreverEfeito(p, m))}</p>
                <div class="pulso-item-acoes">
                  <button class="mini-btn aprovar" data-aprovar="${i}">aprovar</button>
                  <button class="mini-btn" data-descartar="${i}">não aconteceu</button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

/**
 * Bater na porta de quem não está com o app aberto. Aparece só depois de
 * você aprovar alguma coisa: avisar que nada aconteceu não é aviso, é ruído.
 */
function renderAvisarMesa() {
  if (aprovadasAgora.length === 0) return '';

  if (!avisosConfigurados()) {
    return `
      <p class="pulso-aviso">
        ${aprovadasAgora.length} ${aprovadasAgora.length === 1 ? 'coisa aconteceu' : 'coisas aconteceram'}
        no Avesso e já ${aprovadasAgora.length === 1 ? 'está' : 'estão'} no Diário.
        Pra avisar quem não está com o app aberto, falta publicar os avisos
        (veja gerar-chaves-push.js).
      </p>
    `;
  }

  return `
    <div class="pulso-avisar">
      <span class="pulso-avisar-conta">
        ${aprovadasAgora.length} ${aprovadasAgora.length === 1 ? 'página escrita' : 'páginas escritas'} nesta virada
      </span>
      <button class="mini-btn pulso-btn" id="btn-avisar" ${pulsoOcupado ? 'disabled' : ''}>
        avisar a mesa
      </button>
    </div>
  `;
}

async function avisar() {
  pulsoOcupado = true;
  render();

  try {
    const quantas = aprovadasAgora.length;
    const resultado = await avisarMesa({
      titulo: 'O Avesso se mexeu',
      texto: quantas === 1
        ? aprovadasAgora[0]
        : `${quantas} coisas mudaram enquanto vocês não estavam olhando.`
    });
    pulsoAviso = {
      tom: 'calmo',
      texto: resultado && resultado.enviados > 0
        ? `a mesa foi avisada (${resultado.enviados} ${resultado.enviados === 1 ? 'aparelho' : 'aparelhos'})`
        : 'ninguém ligou os avisos ainda — o Diário continua lá pra quando abrirem'
    };
  } catch (e) {
    pulsoAviso = { tom: 'erro', texto: 'não deu pra avisar a mesa agora — o Diário já está escrito, de todo jeito' };
  }

  pulsoOcupado = false;
  render();
}

/** O que muda de fato, em português, pra decidir sem abrir o console. */
function descreverEfeito(proposta, morador) {
  const e = proposta.efeito || {};
  const partes = [];
  if (e.revelado) partes.push('passa a aparecer pra mesa');
  if (e.postura) partes.push(`postura geral vira ${e.postura}`);
  if (typeof e.arco === 'number') partes.push(`arco vai pra "${arcoDe(e.arco).nome}"`);
  if (e.humor) partes.push(`humor: "${e.humor}"`);
  const quem = morador ? morador.nome : proposta.moradorId;
  return partes.length ? `${quem}: ${partes.join(' · ')}` : `${quem}: só vira página no Diário`;
}

async function virarPagina() {
  pulsoOcupado = true;
  pulsoAviso = null;
  aprovadasAgora = [];
  render();

  try {
    const [mapa, historico, visitantes] = await Promise.all([
      storage.get(MAPA_KEY, true).catch(() => null),
      storage.get(HISTORICO_KEY, true).catch(() => null),
      carregarVisitantes()
    ]);

    elenco = await carregarElenco();
    propostas = proporVirada({
      moradores: elenco.moradores,
      relacoes: elenco.bruto.relacoes,
      pulso: elenco.bruto.pulso,
      mapa: mapa || {},
      historico: (historico && historico.entries) || [],
      visitantes: visitantes
    });

    // a virada conta mesmo quando não sai proposta nenhuma: é ela que marca
    // "daqui pra frente é outra sessão" pro histórico de rolagens
    elenco.bruto.pulso.virada = (elenco.bruto.pulso.virada || 0) + 1;
    elenco.bruto.pulso.ultima = new Date().toISOString();
    await salvarElenco(elenco.bruto);

    if (propostas.length === 0) {
      pulsoAviso = { tom: 'calmo', texto: 'o Avesso não mexeu em nada desta vez — a mesa deixou tudo no lugar' };
    }
  } catch (e) {
    pulsoAviso = { tom: 'erro', texto: 'não deu pra ouvir o Avesso agora — tente de novo daqui a pouco' };
  }

  pulsoOcupado = false;
  render();
}

async function aprovarProposta(indice) {
  const proposta = propostas[indice];
  if (!proposta) return;

  try {
    const morador = elenco.moradores.find((m) => m.id === proposta.moradorId);
    const atual = elenco.bruto.estado[proposta.moradorId] || {
      postura: morador ? morador.postura : 'reservado',
      humor: morador ? morador.humor : '',
      revelado: morador ? morador.revelado : false,
      arco: morador ? morador.arco : 0,
      arcoFechado: morador ? Boolean(morador.arcoFechado) : false
    };

    elenco.bruto.estado[proposta.moradorId] = aplicarProposta(proposta, atual);
    await salvarElenco(elenco.bruto);

    await registrarEntreSessoes({
      titulo: proposta.titulo,
      resumo: proposta.diario,
      virada: elenco.bruto.pulso.virada
    });

    // o mestre também fica com o registro no próprio caderno
    state.mundoLog.unshift({
      data: `virada ${elenco.bruto.pulso.virada}`,
      texto: `${proposta.titulo} — ${proposta.diario}`
    });
    scheduleSave();

    elenco = await carregarElenco();
    propostas.splice(indice, 1);
    aprovadasAgora.push(proposta.diario || proposta.titulo);
    pulsoAviso = { tom: 'calmo', texto: `aconteceu: ${proposta.titulo}. Já está no Diário da mesa.` };
  } catch (e) {
    pulsoAviso = { tom: 'erro', texto: 'a costura não pegou — nada foi aplicado' };
  }
  render();
}

async function descartarProposta(indice) {
  const proposta = propostas[indice];
  if (!proposta) return;

  try {
    elenco.bruto.pulso.descartados = elenco.bruto.pulso.descartados || {};
    elenco.bruto.pulso.descartados[proposta.chave] = elenco.bruto.pulso.virada;
    await salvarElenco(elenco.bruto);
    propostas.splice(indice, 1);
    pulsoAviso = { tom: 'calmo', texto: 'não aconteceu — o Avesso não insiste nisso nas próximas duas viradas' };
  } catch (e) {
    pulsoAviso = { tom: 'erro', texto: 'não deu pra guardar a recusa agora' };
  }
  render();
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
  document.getElementById('btn-virar').addEventListener('click', virarPagina);
  const btnAvisar = document.getElementById('btn-avisar');
  if (btnAvisar) btnAvisar.addEventListener('click', avisar);
  document.querySelectorAll('[data-aprovar]').forEach(btn => {
    btn.addEventListener('click', () => aprovarProposta(parseInt(btn.getAttribute('data-aprovar'), 10)));
  });
  document.querySelectorAll('[data-descartar]').forEach(btn => {
    btn.addEventListener('click', () => descartarProposta(parseInt(btn.getAttribute('data-descartar'), 10)));
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
