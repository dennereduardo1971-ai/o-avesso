// visitantes.js — quem já atravessou o espelho.
//
// O app nunca teve uma lista de jogadores: o nome de cada pessoa só existia
// dentro da sessão dela. Isso bastava até as relações existirem — mas relação
// é morador × visitante, e pra montar essa grade o mestre precisa saber quem
// são as visitantes sem ter que digitar isso na mão.
//
// Então cada pessoa se anuncia sozinha, ao atravessar: a portaria (session.js)
// carimba nome e data aqui. É lista compartilhada comum, não do mestre — quem
// escreve é a própria visitante, sobre si mesma.
//
// Pra não virar uma escrita a cada tela aberta, o carimbo só sai de novo
// quando o nome muda ou quando passa meio dia. O controle disso é local: o
// aparelho lembra quando carimbou pela última vez.

import { db } from './db.js';

const VISITANTES_KEY = 'visitantes-do-avesso';
const MARCA_LOCAL = 'avesso-ultimo-carimbo';
const INTERVALO_MS = 12 * 60 * 60 * 1000;

/** Lista de quem já atravessou, mais recente primeiro. */
export async function carregarVisitantes() {
  try {
    const guardado = await db.get(VISITANTES_KEY, true);
    const lista = (guardado && Array.isArray(guardado.lista)) ? guardado.lista : [];
    return lista.slice().sort((a, b) => String(b.visto || '').localeCompare(String(a.visto || '')));
  } catch (e) {
    return [];
  }
}

function precisaCarimbar(user) {
  try {
    const bruto = localStorage.getItem(MARCA_LOCAL);
    if (!bruto) return true;
    const marca = JSON.parse(bruto);
    if (marca.username !== user.username) return true;
    if (marca.nome !== (user.nomeExibicao || user.username)) return true;
    return (Date.now() - (marca.em || 0)) > INTERVALO_MS;
  } catch (e) {
    return true;
  }
}

function anotarCarimbo(user) {
  try {
    localStorage.setItem(MARCA_LOCAL, JSON.stringify({
      username: user.username,
      nome: user.nomeExibicao || user.username,
      em: Date.now()
    }));
  } catch (e) {
    // aparelho sem localStorage: carimba de novo na próxima, sem drama
  }
}

/**
 * Registra que esta pessoa esteve aqui. Lê antes de gravar e só mexe na
 * própria linha — duas pessoas entrando ao mesmo tempo não se apagam.
 * Falha em silêncio: ninguém deve ficar sem abrir uma tela porque a lista
 * de presença não subiu.
 */
export async function registrarPresenca(user) {
  if (!user || !precisaCarimbar(user)) return;

  try {
    const guardado = await db.get(VISITANTES_KEY, true);
    const lista = (guardado && Array.isArray(guardado.lista)) ? guardado.lista : [];
    const eu = {
      username: user.username,
      nome: user.nomeExibicao || user.username,
      mestre: Boolean(user.isMestre),
      visto: new Date().toISOString()
    };
    const nova = lista.filter((v) => v.username !== user.username).concat([eu]);
    await db.set(VISITANTES_KEY, { lista: nova }, true);
    anotarCarimbo(user);
  } catch (e) {
    // sem sinal do outro lado do espelho — segue a vida
  }
}
