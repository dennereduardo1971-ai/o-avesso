// Quando mostrar a linha da voz — e quando esconder.
//
// O PROBLEMA QUE A PESQUISA APONTOU
// A linha em tempo real é a aposta central do app, e ela funciona: melhora a
// afinação enquanto está na tela. Mas a revisão sistemática de 2026
// (Frontiers in Psychology, 36 estudos) mostra o padrão que a pesquisa de
// aprendizado motor chama de hipótese da orientação: retorno contínuo guia
// bem e cria dependência. Num dos estudos, 10 semanas com retorno contínuo
// deram desempenho melhor no treino e, sem o retorno, o grupo igualou o
// controle. E pra quem já canta bem, retorno demais atrapalha: a afinação de
// cantores experientes piorou com a tela (Wilson et al., 2008), por excesso de
// coisa pra prestar atenção.
//
// O QUE O APP FAZ
// Três modos. "sempre" é a linha de sempre. "alternado" intercala um ensaio
// com a linha e um às cegas — a linha é gravada do mesmo jeito e aparece
// depois da nota, que é retorno terminal. "fim" canta tudo às cegas e revela
// depois. No automático, o modo acompanha a competência que a própria barra
// de tolerância já mede: quem ainda está longe do mínimo vê sempre; quem
// chegou perto passa a alternar; quem está no mínimo canta de ouvido. A
// pessoa pode fixar um modo — retorno escolhido por quem aprende rende mais
// que retorno imposto (estudos de 2002 e 2015).

export const MODOS_DE_RETORNO = {
  auto: 'Automático — vai saindo de cena conforme você acerta',
  sempre: 'Sempre — a linha aparece enquanto você canta',
  alternado: 'Alternado — uma nota com a linha, uma de ouvido',
  fim: 'Só depois — canta de ouvido e vê a linha no fim',
};

// Folga acima do mínimo em que o automático passa a alternar. Com mínimo 20,
// alterna a partir de ±35; com mínimo 10 (nível experiente), a partir de ±25.
const FOLGA_PARA_ALTERNAR = 15;

export function modoEfetivo(preferencia, toleranciaAtual, toleranciaMinima) {
  if (preferencia && preferencia !== 'auto' && MODOS_DE_RETORNO[preferencia]) return preferencia;
  if (toleranciaAtual <= toleranciaMinima) return 'fim';
  if (toleranciaAtual <= toleranciaMinima + FOLGA_PARA_ALTERNAR) return 'alternado';
  return 'sempre';
}

// `ensaio` conta a partir de 0 dentro da sessão. No alternado o primeiro é
// com linha: a sessão começa mostrando onde as coisas estão.
export function linhaVisivelNoEnsaio(modo, ensaio) {
  if (modo === 'sempre') return true;
  if (modo === 'fim') return false;
  return ensaio % 2 === 0;
}
