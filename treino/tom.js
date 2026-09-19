// O tom da música: quanto transpor pra ela caber na sua voz.
//
// A regra vem do plano de gravação da Sara (e do protocolo de cover que a
// pesquisa de vídeo curto levantou): a nota mais alta do trecho tem que ficar
// 2 a 3 semitons abaixo do teto — estabilidade vale mais que fidelidade ao tom
// original, e forçar o agudo é o padrão de esforço que machuca. O teto aqui é
// a nota mais aguda medida no teste inicial, que já é medida "até começar a
// apertar", não o grito.
//
// Entre as transposições que cabem, a escolhida é a MENOR (a que mexe menos na
// música). Quando a música é mais larga que a voz confortável, não há
// transposição que resolva — aí o app diz isso, e sugere a que protege o
// agudo, porque é lá que a voz sofre.

export const FOLGA_DO_TETO = 2;   // semitons abaixo da nota mais aguda medida
const MAIOR_TRANSPOSICAO = 12;

export function sugerirTransposicao({ graveDaMusica, agudoDaMusica, extensao }) {
  const grave = Math.min(graveDaMusica, agudoDaMusica);
  const agudo = Math.max(graveDaMusica, agudoDaMusica);
  const teto = extensao.midiMaximo - FOLGA_DO_TETO;
  const chao = extensao.midiMinimo;

  const cabem = [];
  for (let s = -MAIOR_TRANSPOSICAO; s <= MAIOR_TRANSPOSICAO; s++) {
    if (agudo + s <= teto && grave + s >= chao) cabem.push(s);
  }

  if (cabem.length) {
    const escolhida = cabem.reduce((melhor, s) => (Math.abs(s) < Math.abs(melhor) ? s : melhor));
    return {
      cabe: true,
      semitons: escolhida,
      grave: grave + escolhida,
      agudo: agudo + escolhida,
      folgaNoAgudo: extensao.midiMaximo - (agudo + escolhida),
      opcoes: cabem,
    };
  }

  // Não cabe inteira: põe o agudo no limite seguro e aceita o grave abafado.
  const protegeAgudo = Math.max(-MAIOR_TRANSPOSICAO, Math.min(MAIOR_TRANSPOSICAO, teto - agudo));
  return {
    cabe: false,
    semitons: protegeAgudo,
    grave: grave + protegeAgudo,
    agudo: agudo + protegeAgudo,
    faltamNoGrave: chao - (grave + protegeAgudo),
    larguraDaMusica: agudo - grave,
    larguraConfortavel: teto - chao,
    opcoes: [],
  };
}

export function descreverTransposicao(semitons) {
  if (semitons === 0) return 'Cante no tom original';
  const n = Math.abs(semitons);
  const unidade = n === 1 ? 'semitom' : 'semitons';
  return semitons > 0 ? `Suba ${n} ${unidade}` : `Desça ${n} ${unidade}`;
}
