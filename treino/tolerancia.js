// Quanto de desafinação o app aceita — e como isso muda ao longo da sessão.
//
// A VERSÃO ANTERIOR EXIGIA ±15 CENTS, E ISSO ESTAVA ERRADO
// A pesquisa sobre percepção de afinação (Larrouy-Maestri) diz duas coisas
// úteis: até cerca de ±25 cents o ouvinte comum considera a nota afinada, e
// acima de ±50 cents qualquer pessoa percebe que está errado. Exigir ±15 de
// quem está começando não deixa ninguém mais afinado — deixa a barra vermelha
// o tempo todo, o que ensina a desistir, não a cantar.
//
// Então a barra anda. Começa em ±50, que é "dá pra reconhecer a melodia", e
// aperta até ±20, que já é melhor que a maioria das pessoas canta em karaokê.
// Aperta quando você acerta seguido; afrouxa quando erra seguido. Quem decide
// a dificuldade é o seu desempenho de agora, não um número fixo escolhido por
// alguém que nunca ouviu você cantar.

export const TOLERANCIA_INICIAL = 50;
export const TOLERANCIA_MINIMA = 20;

export function criarTolerancia({
  inicial = TOLERANCIA_INICIAL,
  minima = TOLERANCIA_MINIMA,
  maxima = TOLERANCIA_INICIAL,
  passo = 5,
  acertosParaApertar = 3,
  errosParaAfrouxar = 2,
} = {}) {
  let valor = Math.min(maxima, Math.max(minima, inicial));
  let acertosSeguidos = 0;
  let errosSeguidos = 0;

  function registrar(acertou) {
    const anterior = valor;

    if (acertou) {
      errosSeguidos = 0;
      acertosSeguidos++;
      if (acertosSeguidos >= acertosParaApertar) {
        valor = Math.max(minima, valor - passo);
        acertosSeguidos = 0;
      }
    } else {
      acertosSeguidos = 0;
      errosSeguidos++;
      if (errosSeguidos >= errosParaAfrouxar) {
        valor = Math.min(maxima, valor + passo);
        errosSeguidos = 0;
      }
    }

    return {
      valor,
      mudou: valor !== anterior,
      direcao: valor === anterior ? 'igual' : valor < anterior ? 'apertou' : 'afrouxou',
    };
  }

  return {
    registrar,
    get valor() { return valor; },
    get noMinimo() { return valor <= minima; },
    reiniciar(novoValor = inicial) {
      valor = Math.min(maxima, Math.max(minima, novoValor));
      acertosSeguidos = 0;
      errosSeguidos = 0;
    },
  };
}
