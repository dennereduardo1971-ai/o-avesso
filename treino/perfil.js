// O que o app aprende sobre a sua voz ao longo das sessões.
//
// Duas perguntas, só. "Quanto você está errando, em média?" — que é o número
// do progresso, o que deve cair semana a semana. E "em que notas você erra
// mais?" — que é o que decide o exercício de amanhã.
//
// Erro em cents, e não porcentagem de acerto, porque porcentagem de acerto
// depende da tolerância, e a tolerância anda. Cents é a mesma régua sempre:
// 22 cents hoje contra 35 cents há três semanas quer dizer alguma coisa.

import { nomeDaNota } from '../audio/notas.js';

export function criarPerfilDeTreino(perfilGuardado = {}) {
  // cópia rasa por nota, pra não escrever no objeto que veio do banco
  const notas = {};
  for (const [midi, dados] of Object.entries(perfilGuardado.notas || {})) {
    notas[midi] = { ...dados };
  }
  const daSessao = [];

  // `foraDaNota` marca a tentativa em que a pessoa cantou *outra* nota — quase
  // sempre a oitava errada — em vez de errar a afinação desta. As duas coisas
  // precisam ser contadas separado: cantar Lá3 quando o alvo era Lá2 é um erro
  // de 1200 cents, e um único desses joga a média da sessão pra um número que
  // não quer dizer nada. O erro médio mede afinação; nota errada é contada à
  // parte, e some da média.
  function registrar(midi, { acertou, erroCents, foraDaNota = false, desvioCents = null, oscilacaoCents = null, vibrato = null }) {
    const chave = String(midi);
    const atual = notas[chave] || { tentativas: 0, acertos: 0, somaErroAbs: 0, medidas: 0, forasDaNota: 0, ultimoEm: 0 };

    atual.tentativas++;
    if (acertou) atual.acertos++;
    if (foraDaNota) atual.forasDaNota = (atual.forasDaNota || 0) + 1;
    if (Number.isFinite(erroCents)) {
      atual.somaErroAbs += Math.abs(erroCents);
      atual.medidas = (atual.medidas || 0) + 1;
    }
    atual.ultimoEm = Date.now();
    notas[chave] = atual;

    daSessao.push({
      midi: Number(midi),
      acertou: !!acertou,
      erroCents: Number.isFinite(erroCents) ? erroCents : null,
      foraDaNota: !!foraDaNota,
      desvioCents: !foraDaNota && Number.isFinite(desvioCents) ? desvioCents : null,
      oscilacaoCents: !foraDaNota && Number.isFinite(oscilacaoCents) ? oscilacaoCents : null,
      vibrato: !foraDaNota && vibrato ? { velocidadeHz: vibrato.velocidadeHz, amplitudeCents: vibrato.amplitudeCents } : null,
    });
  }

  function erroMedioDaNota(midi) {
    const dados = notas[String(midi)];
    const medidas = dados && (dados.medidas ?? dados.tentativas);
    if (!medidas) return null;
    return dados.somaErroAbs / medidas;
  }

  // Erro médio da sessão que está acontecendo agora — é este que vira o
  // número do resumo e o ponto do gráfico.
  function erroMedioDaSessao() {
    const comErro = daSessao.filter((t) => t.erroCents !== null);
    if (!comErro.length) return null;
    return comErro.reduce((soma, t) => soma + Math.abs(t.erroCents), 0) / comErro.length;
  }

  function acertosDaSessao() {
    return {
      acertos: daSessao.filter((t) => t.acertou).length,
      total: daSessao.length,
    };
  }

  // As notas onde a voz tropeça. Ordena por erro médio, mas só considera nota
  // tentada mais de uma vez: uma tentativa ruim é azar, três são um buraco.
  function notasFracas(quantas = 3, { minimoTentativas = 2 } = {}) {
    return Object.entries(notas)
      .filter(([, dados]) => dados.tentativas >= minimoTentativas)
      .map(([midi, dados]) => ({
        midi: Number(midi),
        erroMedio: dados.somaErroAbs / Math.max(1, dados.medidas ?? dados.tentativas),
        taxaAcerto: dados.acertos / dados.tentativas,
        tentativas: dados.tentativas,
        forasDaNota: dados.forasDaNota || 0,
      }))
      .sort((a, b) => a.taxaAcerto - b.taxaAcerto || b.erroMedio - a.erroMedio)
      .slice(0, quantas);
  }

  // O resumo de fim de sessão, que o brief pediu que fosse "um número e uma
  // ordem". O número é o erro médio. A ordem é a nota por onde começar amanhã.
  function resumoDaSessao() {
    const erroMedio = erroMedioDaSessao();
    const { acertos, total } = acertosDaSessao();
    const forasDaNota = daSessao.filter((t) => t.foraDaNota).length;
    const fracas = notasFracas(1);
    const pior = fracas.length ? fracas[0] : null;

    let frase;
    if (erroMedio === null && forasDaNota) {
      frase = `Você cantou outra nota ${forasDaNota === 1 ? 'uma vez' : `${forasDaNota} vezes`} — quase sempre é a oitava. Ouça o tom até o fim antes de entrar.`;
    } else if (erroMedio === null) {
      frase = 'Sessão curta demais pra medir. Amanhã a gente mede.';
    } else if (pior && pior.taxaAcerto < 1) {
      frase = `Erro médio ${Math.round(erroMedio)} cents. Seu buraco é ${nomeDaNota(pior.midi)} — amanhã começamos por ele.`;
    } else {
      frase = `Erro médio ${Math.round(erroMedio)} cents. Nenhum buraco claro hoje: amanhã a barra aperta.`;
    }

    return {
      erroMedioCents: erroMedio,
      acertos,
      total,
      forasDaNota,
      notaMaisFraca: pior ? pior.midi : null,
      frase,
      ...metricasDaSessao(daSessao),
    };
  }

  return {
    registrar,
    notasFracas,
    erroMedioDaNota,
    erroMedioDaSessao,
    acertosDaSessao,
    resumoDaSessao,
    get tentativas() { return [...daSessao]; },
    // o formato que vai pro banco
    paraSalvar() { return { notas }; },
  };
}

// Três números além do erro médio, porque erro médio sozinho esconde o
// principal (Pfordresher et al., 2010: a maioria das pessoas é mais exata na
// média do que consistente entre tentativas).
//
//   tendência — o desvio médio COM sinal: canta sistematicamente alto (+) ou
//               baixo (−). É a correção mais barata que existe: "você tende a
//               entrar 12 cents baixo" se conserta em uma sessão.
//   precisão  — o desvio-padrão desses desvios: o quanto as tentativas se
//               espalham. Menor é mais consistente.
//   oscilação — a mediana do tremor dentro de cada nota sustentada. Vibrato
//               entra aqui também; ele é medido à parte quando existir.
//
// Só entram tentativas com medida de verdade (nota errada de oitava fica de
// fora, como no erro médio) e só com pelo menos três delas: com menos, o
// número é sorte.
export function metricasDaSessao(tentativas, { minimo = 3 } = {}) {
  const desvios = tentativas.map((t) => t.desvioCents).filter(Number.isFinite);
  const oscilacoes = tentativas.map((t) => t.oscilacaoCents).filter(Number.isFinite);
  const resultado = { tendenciaCents: null, precisaoCents: null, oscilacaoCents: null, vibrato: null };

  // Vibrato: mediana de velocidade e amplitude entre as notas em que ele
  // apareceu, e em quantas apareceu — "em 2 de 10 notas" é outra informação
  // que "em 9 de 10".
  const comVibrato = tentativas.filter((t) => t.vibrato);
  const medidas = tentativas.filter((t) => Number.isFinite(t.desvioCents)).length;
  if (comVibrato.length >= 2) {
    const mediana = (lista) => {
      const o = [...lista].sort((a, b) => a - b);
      const m = Math.floor(o.length / 2);
      return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
    };
    resultado.vibrato = {
      velocidadeHz: mediana(comVibrato.map((t) => t.vibrato.velocidadeHz)),
      amplitudeCents: mediana(comVibrato.map((t) => t.vibrato.amplitudeCents)),
      notas: comVibrato.length,
      de: medidas,
    };
  }

  if (desvios.length >= minimo) {
    const media = desvios.reduce((s, d) => s + d, 0) / desvios.length;
    const variancia = desvios.reduce((s, d) => s + (d - media) ** 2, 0) / (desvios.length - 1);
    resultado.tendenciaCents = media;
    resultado.precisaoCents = Math.sqrt(variancia);
  }
  if (oscilacoes.length >= minimo) {
    const ordenadas = [...oscilacoes].sort((a, b) => a - b);
    const meio = Math.floor(ordenadas.length / 2);
    resultado.oscilacaoCents = ordenadas.length % 2 ? ordenadas[meio] : (ordenadas[meio - 1] + ordenadas[meio]) / 2;
  }
  return resultado;
}

// Erro médio de uma lista de sessões guardadas — a linha do gráfico da Fase 4,
// já útil aqui pra dizer "faz três semanas que você não refaz o teste".
export function evolucaoDeErro(sessoes) {
  return sessoes
    .filter((s) => Number.isFinite(s.erroMedioCents))
    .map((s) => ({ data: s.data, erroMedioCents: s.erroMedioCents, tipo: s.tipo }))
    .sort((a, b) => a.data - b.data);
}
