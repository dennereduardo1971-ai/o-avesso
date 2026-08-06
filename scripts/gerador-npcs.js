// gerador-npcs.js — personagens de improviso, só pro mestre. A lista de
// guardados é dele; não abre pros jogadores nem aparece no hub deles.
//
// Esta tela é a porta de entrada do elenco: personagem gerado é descartável
// até a mesa mexer com ele de novo. Aí o mestre promove, e ele vira morador
// de verdade (com lugar no mapa, postura e estado) na tela de Moradores.
// O elenco cresce pelo que a mesa usou, não por um número escolhido de véspera.

import { initPage, storage, createSaver, escapeHtml, ambientar, seamHtml } from './session.js';
import { promoverNpc } from './elenco.js';

const STORAGE_KEY = 'o-avesso-gerador-npcs';
const COMPARTILHADO = false;

const nomes = [
  'Senhor Alfinete', 'Dona Retalho', 'Mestre Verniz', 'Madame Costura',
  'Seu Botão-de-Osso', 'Dona Renda', 'Senhor Fivela', 'Madame Percalina',
  'Seu Fio-Solto', 'Dona Sarja', 'Senhor Colchete', 'Madame Tricô',
  'Seu Chumaço', 'Dona Debrum', 'Senhor Passamane', 'Madame Organza',
  'Seu Cetim', 'Dona Musselina', 'Senhor Veludo', 'Madame Tafetá',
  'Seu Ilhós', 'Dona Franja', 'Senhor Godê', 'Madame Bainha'
];

const tracos = [
  'fala sempre em rimas que nunca terminam',
  'tem um olho de vidro que gira sozinho quando mente',
  'cheira permanentemente a naftalina e cravo',
  'nunca pisca, e isso incomoda todo mundo ao redor',
  'carrega um novelo de linha que nunca parece acabar',
  'tem os dedos manchados de tinta azul, sempre',
  'fala com a voz de outra pessoa quando fica nervoso',
  'as costuras do rosto se abrem um pouco quando ri demais',
  'guarda todas as agulhas que já usou na vida, numeradas',
  'deixa cair um botão no chão toda vez que mente',
  'anda sempre um passo atrasado do próprio corpo',
  'só responde perguntas na terceira vez que são feitas',
  'tem a voz baixa demais, como se falasse de dentro de um armário',
  'conta os próprios dedos em voz alta antes de decidir algo',
  'sua sombra se move um instante depois dele'
];

const segredos = [
  'deve um favor a alguém importante que nunca conseguiu pagar',
  'sabe onde fica uma emenda na realidade que ninguém mais lembra',
  'já trocou de lugar com o próprio reflexo, uma vez, e não voltou tudo',
  'guarda uma verdade que não sabe o que fazer com ela',
  'foi quem trancou uma porta importante, por engano, e nunca contou',
  'tem medo mortal de tesouras, por um motivo que não conta a ninguém',
  'viu a Visitante chegar ao Avesso, mas fingiu que não',
  'colecionava pedaços de lã azul muito antes de qualquer roubo acontecer',
  'sabe costurar de volta o que foi rasgado, mas cobra um preço estranho por isso',
  'não envelhece, e isso o assusta mais do que qualquer coisa no Avesso',
  'está fugindo de alguém que também atravessou o espelho, há muito tempo',
  'sabe o nome verdadeiro de outra personagem importante, e não vai dizer de graça'
];

let saved = [];
let current = null;
let aviso = null; // { texto, tom } — resposta da última promoção
const save = createSaver('gn-save-indicator', 400);

const user = await initPage({ escopo: 'mestre', somenteMestre: true });
if (user) {
  await loadState();
  ambientar();
}

async function loadState() {
  try {
    const guardado = await storage.get(STORAGE_KEY, COMPARTILHADO);
    if (guardado && Array.isArray(guardado.saved)) saved = guardado.saved;
  } catch (e) {}
  render();
}

function scheduleSave() {
  save(() => storage.set(STORAGE_KEY, { saved: saved }, COMPARTILHADO));
}

function pick(arr, excludeVal) {
  let choice;
  do {
    choice = arr[Math.floor(Math.random() * arr.length)];
  } while (arr.length > 1 && choice === excludeVal);
  return choice;
}

function gerar() {
  aviso = null;
  current = {
    nome: pick(nomes, current ? current.nome : null),
    traco: pick(tracos, current ? current.traco : null),
    segredo: pick(segredos, current ? current.segredo : null)
  };
  render();
}

function salvarAtual() {
  if (!current) return;
  saved.unshift(Object.assign({}, current));
  scheduleSave();
  render();
}

function removerSalvo(idx) {
  saved.splice(idx, 1);
  scheduleSave();
  render();
}

/**
 * Sobe um personagem gerado pro elenco fixo. Ele sai da lista de improviso
 * (o lugar de quem ainda é descartável) e passa a existir no Avesso: o
 * segredo vai pro bloco de bastidor, e a mesa só o conhece quando você
 * apresentar, lá na tela de Moradores.
 */
async function promover(npc, idxNaLista) {
  try {
    await promoverNpc(npc);
    if (typeof idxNaLista === 'number') saved.splice(idxNaLista, 1);
    else current = null;
    scheduleSave();
    aviso = {
      tom: 'ok',
      texto: `${npc.nome} entrou no elenco. Dê um posto e um lugar a ele em Moradores do Avesso.`
    };
  } catch (e) {
    aviso = { tom: 'erro', texto: 'o elenco não aceitou a costura agora — tente de novo daqui a pouco' };
  }
  render();
}

function render() {
  const root = document.getElementById('gerador-root');
  root.innerHTML = `
    <div class="gn-wrap">
      <div class="gn-frame">
        <div class="gn-header">
          <p class="gn-eyebrow">O Avesso</p>
          <h1 class="gn-title">Gerador de NPCs</h1>
          <p class="gn-subtitle">Pra quando a conversa vai pra onde você não planejou.</p>
        </div>

        <button class="gn-roll-btn" id="btn-gerar">🎲 Gerar Personagem</button>

        ${current ? `
          <div class="gn-card">
            <p class="npc-name">${escapeHtml(current.nome)}</p>
            <div class="gn-field">
              <div class="label">Traço Marcante</div>
              <div class="value">${escapeHtml(current.traco)}</div>
            </div>
            <div class="gn-field" style="margin-bottom:0;">
              <div class="label">Segredo</div>
              <div class="value">${escapeHtml(current.segredo)}</div>
            </div>
            <div class="gn-actions">
              <button class="gn-mini-btn save" id="btn-salvar">guardar na lista</button>
              <button class="gn-mini-btn promover" id="btn-promover">promover a morador</button>
              <button class="gn-mini-btn" id="btn-outro">gerar outro</button>
            </div>
          </div>
        ` : ''}

        ${aviso ? `<p class="gn-aviso ${aviso.tom}">${escapeHtml(aviso.texto)}</p>` : ''}

        ${seamHtml()}
        <p class="gn-section-label">Guardados para usar depois</p>
        <p class="gn-section-hint">quando a mesa esbarrar duas vezes na mesma pessoa, promova: ela vira morador de verdade</p>
        <div class="gn-saved-list">
          ${saved.length === 0 ? '<p class="gn-empty">nenhum personagem guardado ainda</p>' : saved.map((n, i) => `
            <div class="gn-saved-item">
              <button class="remove-x" data-remove="${i}">✕</button>
              <div class="sv-name">${escapeHtml(n.nome)}</div>
              <div class="sv-line">${escapeHtml(n.traco)}</div>
              <div class="sv-line">${escapeHtml(n.segredo)}</div>
              <button class="gn-mini-btn promover" data-promover="${i}">promover a morador</button>
            </div>
          `).join('')}
        </div>

        <p class="gn-save-indicator" id="gn-save-indicator">salvo ✓</p>
      </div>
    </div>
  `;

  document.getElementById('btn-gerar').addEventListener('click', gerar);
  if (current) {
    document.getElementById('btn-salvar').addEventListener('click', salvarAtual);
    document.getElementById('btn-outro').addEventListener('click', gerar);
    document.getElementById('btn-promover').addEventListener('click', () => promover(current, null));
  }
  root.querySelectorAll('[data-remove]').forEach(btn => {
    btn.addEventListener('click', () => removerSalvo(parseInt(btn.getAttribute('data-remove'), 10)));
  });
  root.querySelectorAll('[data-promover]').forEach(btn => {
    btn.addEventListener('click', () => {
      const i = parseInt(btn.getAttribute('data-promover'), 10);
      promover(saved[i], i);
    });
  });
}
