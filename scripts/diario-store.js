// diario-store.js — o Diário do Avesso visto por quem não é a tela do Diário.
//
// Existe porque o pulso do mundo (a virada de página, no Caderno do Mestre)
// precisa escrever no Diário, e duas telas conhecerem o formato do mesmo dado
// é como se perde a compatibilidade entre elas sem ninguém perceber.

import { db } from './db.js';

export const DIARIO_KEY = 'o-avesso-diario';
export const DIARIO_COMPARTILHADO = true;

export async function carregarDiario() {
  try {
    const guardado = await db.get(DIARIO_KEY, DIARIO_COMPARTILHADO);
    return (guardado && Array.isArray(guardado.entries)) ? guardado.entries : [];
  } catch (e) {
    return [];
  }
}

export async function salvarDiario(entries) {
  await db.set(DIARIO_KEY, { entries: entries }, DIARIO_COMPARTILHADO);
}

function proximoId(entries) {
  return entries.reduce((maior, e) => Math.max(maior, parseInt(e.id, 10) || 0), 0) + 1;
}

/**
 * Escreve uma página de entre-sessões: o que o Avesso fez enquanto a mesa
 * não estava olhando. Vai pro topo, marcada como `tipo: 'pulso'` — a tela do
 * Diário desenha essas diferente das sessões jogadas.
 *
 * @param {{titulo: string, resumo: string, virada: number}} dados
 */
export async function registrarEntreSessoes(dados) {
  const entries = await carregarDiario();
  entries.unshift({
    id: proximoId(entries),
    tipo: 'pulso',
    numero: '·',
    data: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
    titulo: dados.titulo || 'O Avesso se mexeu',
    presentes: 'ninguém — foi entre uma sessão e outra',
    resumo: dados.resumo || ''
  });
  await salvarDiario(entries);
  return entries;
}
