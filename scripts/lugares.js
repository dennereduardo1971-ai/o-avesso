// lugares.js — as sete regiões do Avesso, num lugar só.
//
// Isto morava dentro de mapa.js. Saiu de lá porque agora o elenco de
// moradores também precisa saber onde cada um mora — e ter duas listas de
// regiões no app é ter duas listas que um dia vão discordar.

export const AREAS = [
  { id: 'espelho', icone: '🪞', nome: 'Espelho de Moldura de Linha', x: 50, y: 90,
    desc: 'A passagem entre os dois lados. Poucos atravessam de volta pelo mesmo caminho que vieram.' },
  { id: 'transicao', icone: '🧵', nome: 'Sala de Transição', x: 36, y: 76,
    desc: 'Corredor de armários de costura onde toda visitante cai pela primeira vez no Avesso.' },
  { id: 'mansao', icone: '🏛️', nome: 'Mansão de Porcelana', x: 52, y: 52,
    desc: 'Residência do Duque Desfiado, cheia de retratos que fingem não estar vivos.' },
  { id: 'ala', icone: '🖼️', nome: 'Ala Leste', x: 74, y: 42,
    desc: 'Onde os retratos esquecidos vão se desfiando, memória por memória, até sumirem de vez.' },
  { id: 'guarda', icone: '🔘', nome: 'Salão da Guarda de Botões', x: 28, y: 34,
    desc: 'Sede burocrática de quem deveria proteger o Avesso — e raramente sabe como.' },
  { id: 'jardim', icone: '🌹', nome: 'Jardim de Alfinetes', x: 16, y: 58,
    desc: 'Um jardim onde as flores picam antes de florescer de verdade.' },
  { id: 'biblioteca', icone: '📚', nome: 'Biblioteca de Linhas Perdidas', x: 80, y: 18,
    desc: 'Onde ficam guardadas as Verdades que ninguém mais quis lembrar.' }
];

export const TRILHAS = [
  ['espelho','transicao'], ['transicao','mansao'],
  ['mansao','ala'], ['mansao','guarda'], ['mansao','jardim'],
  ['guarda','biblioteca']
];

export function areaById(id) {
  return AREAS.find((a) => a.id === id) || null;
}

/** Nome da região pra exibir; devolve algo legível mesmo pra id vazio. */
export function nomeDoLugar(id) {
  const a = areaById(id);
  return a ? a.nome : 'à deriva pelo Avesso';
}

export function iconeDoLugar(id) {
  const a = areaById(id);
  return a ? a.icone : '🌫️';
}
