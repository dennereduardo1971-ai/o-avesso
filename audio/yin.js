// YIN — detecção de frequência fundamental (de Cheveigné & Kawahara, 2002).
//
// POR QUE NÃO AUTOCORRELAÇÃO SIMPLES
// A autocorrelação que o app usava antes erra a oitava: o pico em 2·T é quase
// tão alto quanto o pico em T, e em voz masculina grave — onde o primeiro
// harmônico costuma ser mais forte que o fundamental — ela cai no dobro ou na
// metade com frequência incômoda. Um afinador que anuncia Dó3 quando a pessoa
// cantou Dó2 não serve pra treinar ninguém.
//
// O YIN resolve isso com duas ideias. A primeira é medir *diferença* em vez de
// semelhança: d(τ) = Σ (x[j] − x[j+τ])², que vale zero no período verdadeiro.
// A segunda é o limiar absoluto: em vez de procurar o menor d(τ) — que pode
// estar num múltiplo do período —, pega-se o **primeiro** τ que desce abaixo do
// limiar. Como múltiplos do período só aparecem depois do período, essa ordem é
// o que mata o erro de oitava.
//
// O passo intermediário (a "diferença média cumulativa normalizada") é o que
// torna um limiar fixo possível: ele divide d(τ) pela média dos d até τ, o que
// tira do caminho a queda natural de energia e deixa a escala comparável entre
// vozes fortes e fracas.
//
// Este arquivo não fala com o Web Audio API: entra Float32Array, sai Hz. É de
// propósito — assim o mesmo código roda no AudioWorklet (audio/yin-worklet.js)
// e na página de verificação (verificacao/), alimentado por tons sintetizados
// de frequência conhecida.

export const LIMIAR_PADRAO = 0.15;
export const FREQUENCIA_MINIMA = 65;   // Dó2, um pouco abaixo do grave de barítono
export const FREQUENCIA_MAXIMA = 1100; // Dó6, acima de qualquer agudo cantado aqui

// --- FFT ---------------------------------------------------------------
//
// A diferença d(τ) sai de uma correlação cruzada, e correlação cruzada por
// força bruta custa W·τmáx multiplicações por quadro — com janela de 2048
// amostras isso dá quase um milhão de operações a cada 10 ms, dentro da thread
// de áudio. Via FFT cai para algo em torno de um quarto disso. Radix-2
// iterativa, sem dependência externa, com as tabelas de seno/cosseno
// calculadas uma vez por tamanho.

const tabelasPorTamanho = new Map();

function tabelasDeFft(n) {
  let tabelas = tabelasPorTamanho.get(n);
  if (tabelas) return tabelas;

  const cos = new Float64Array(n / 2);
  const sen = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) {
    cos[i] = Math.cos((-2 * Math.PI * i) / n);
    sen[i] = Math.sin((-2 * Math.PI * i) / n);
  }

  // ordem bit-reversa, pré-calculada
  const reversa = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i++) {
    let r = 0;
    for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b);
    reversa[i] = r;
  }

  tabelas = { cos, sen, reversa };
  tabelasPorTamanho.set(n, tabelas);
  return tabelas;
}

// FFT complexa no lugar. `inversa` só troca o sinal da parte imaginária na
// entrada e na saída — o fator 1/n fica por conta de quem chama.
function fft(re, im, inversa = false) {
  const n = re.length;
  const { cos, sen, reversa } = tabelasDeFft(n);

  if (inversa) for (let i = 0; i < n; i++) im[i] = -im[i];

  for (let i = 0; i < n; i++) {
    const j = reversa[i];
    if (j > i) {
      let t = re[i]; re[i] = re[j]; re[j] = t;
      t = im[i]; im[i] = im[j]; im[j] = t;
    }
  }

  for (let tamanho = 2; tamanho <= n; tamanho *= 2) {
    const meio = tamanho / 2;
    const passo = n / tamanho;
    for (let i = 0; i < n; i += tamanho) {
      for (let j = 0; j < meio; j++) {
        const k = j * passo;
        const c = cos[k];
        const s = sen[k];
        const a = i + j;
        const b = a + meio;
        const reB = re[b] * c - im[b] * s;
        const imB = re[b] * s + im[b] * c;
        re[b] = re[a] - reB;
        im[b] = im[a] - imB;
        re[a] += reB;
        im[a] += imB;
      }
    }
  }

  if (inversa) for (let i = 0; i < n; i++) im[i] = -im[i];
}

function proximaPotenciaDeDois(n) {
  let p = 1;
  while (p < n) p *= 2;
  return p;
}

// --- o detector --------------------------------------------------------

export function criarDetectorYin(opcoes = {}) {
  const taxaAmostragem = opcoes.taxaAmostragem || 48000;
  const tamanho = opcoes.tamanho || 2048;
  const limiar = opcoes.limiar ?? LIMIAR_PADRAO;
  const rmsMinimo = opcoes.rmsMinimo ?? 0.005;

  // Só faz sentido procurar período dentro da faixa de frequência que a voz
  // alcança. Travar a faixa é a segunda linha de defesa contra erro de oitava:
  // mesmo que o sinal engane o limiar, o dobro simplesmente não é procurado.
  let defasagemMinima = 0;
  let defasagemMaxima = 0;
  let janela = 0;

  const diferenca = new Float64Array(tamanho);
  const normalizada = new Float64Array(tamanho);
  const potenciaAcumulada = new Float64Array(tamanho + 1);

  let tamanhoFft = 0;
  let re1 = null, im1 = null, re2 = null, im2 = null;

  function definirFaixa(frequenciaMinima, frequenciaMaxima) {
    const fMin = Math.max(20, frequenciaMinima);
    const fMax = Math.min(taxaAmostragem / 2, frequenciaMaxima);

    defasagemMinima = Math.max(2, Math.floor(taxaAmostragem / fMax));
    // A janela precisa sobrar depois da maior defasagem — é o que garante que
    // d(τ) compara sempre o mesmo número de amostras, e não um pedaço cada vez
    // menor (o que enviesaria a comparação a favor dos τ grandes). Limitar a
    // defasagem a metade do buffer mantém a janela sempre maior que o maior
    // período procurado: comparar um período inteiro com menos de um período
    // de vizinhança não mede nada.
    defasagemMaxima = Math.min(Math.ceil(taxaAmostragem / fMin) + 1, Math.floor(tamanho / 2));
    if (defasagemMaxima <= defasagemMinima + 2) defasagemMaxima = defasagemMinima + 3;
    janela = tamanho - defasagemMaxima;

    const novoTamanhoFft = proximaPotenciaDeDois(tamanho + 1);
    if (novoTamanhoFft !== tamanhoFft) {
      tamanhoFft = novoTamanhoFft;
      re1 = new Float64Array(tamanhoFft);
      im1 = new Float64Array(tamanhoFft);
      re2 = new Float64Array(tamanhoFft);
      im2 = new Float64Array(tamanhoFft);
    }
  }

  definirFaixa(
    opcoes.frequenciaMinima ?? FREQUENCIA_MINIMA,
    opcoes.frequenciaMaxima ?? FREQUENCIA_MAXIMA
  );

  // Correlação cruzada r(τ) = Σ_{j<W} x[j]·x[j+τ], por FFT.
  //
  // O tamanho da FFT é maior que o buffer justamente para que a correlação
  // circular não dobre a cauda por cima dos τ que interessam: com
  // tamanhoFft > janela + defasagemMáxima, as defasagens negativas caem no topo
  // do vetor e nunca colidem com [0, defasagemMáxima].
  function correlacionar(buffer, saida) {
    re1.fill(0); im1.fill(0);
    re2.fill(0); im2.fill(0);
    for (let i = 0; i < janela; i++) re1[i] = buffer[i];
    for (let i = 0; i < tamanho; i++) re2[i] = buffer[i];

    fft(re1, im1);
    fft(re2, im2);

    // conj(A) · B
    for (let i = 0; i < tamanhoFft; i++) {
      const a = re1[i], b = im1[i], c = re2[i], d = im2[i];
      re1[i] = a * c + b * d;
      im1[i] = a * d - b * c;
    }

    fft(re1, im1, true);
    for (let tau = 0; tau <= defasagemMaxima; tau++) saida[tau] = re1[tau] / tamanhoFft;
  }

  function detectar(buffer) {
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += buffer[i] * buffer[i];
    const rms = Math.sqrt(soma / tamanho);
    if (rms < rmsMinimo) return { frequencia: -1, clareza: 0, rms };

    // Energia acumulada, pra tirar Σ x[j]² de qualquer trecho em O(1).
    potenciaAcumulada[0] = 0;
    for (let i = 0; i < tamanho; i++) {
      potenciaAcumulada[i + 1] = potenciaAcumulada[i] + buffer[i] * buffer[i];
    }

    correlacionar(buffer, diferenca);

    // d(τ) = Σx[j]² + Σx[j+τ]² − 2·r(τ), reaproveitando o vetor da correlação.
    const potenciaInicial = potenciaAcumulada[janela];
    for (let tau = defasagemMaxima; tau >= 0; tau--) {
      const potenciaDeslocada = potenciaAcumulada[tau + janela] - potenciaAcumulada[tau];
      const d = potenciaInicial + potenciaDeslocada - 2 * diferenca[tau];
      diferenca[tau] = d > 0 ? d : 0; // erro de ponto flutuante pode passar de zero
    }

    // Diferença média cumulativa normalizada.
    normalizada[0] = 1;
    let acumulado = 0;
    for (let tau = 1; tau <= defasagemMaxima; tau++) {
      acumulado += diferenca[tau];
      normalizada[tau] = acumulado > 0 ? (diferenca[tau] * tau) / acumulado : 1;
    }

    // Limiar absoluto: o **primeiro** vale abaixo do limiar, não o menor de
    // todos. Depois desce até o fundo desse vale — parar no primeiro ponto
    // abaixo do limiar daria um τ sistematicamente adiantado.
    let melhorTau = -1;
    for (let tau = defasagemMinima; tau <= defasagemMaxima; tau++) {
      if (normalizada[tau] < limiar) {
        while (tau + 1 <= defasagemMaxima && normalizada[tau + 1] < normalizada[tau]) tau++;
        melhorTau = tau;
        break;
      }
    }

    // Nenhum vale bom o bastante: devolve o menor mesmo assim, com a clareza
    // dizendo o quanto ele é ruim. Quem chama decide o que fazer — o afinador
    // livre aceita um sinal mais sujo que um exercício aceita.
    if (melhorTau === -1) {
      let menor = Infinity;
      for (let tau = defasagemMinima; tau <= defasagemMaxima; tau++) {
        if (normalizada[tau] < menor) { menor = normalizada[tau]; melhorTau = tau; }
      }
      if (melhorTau === -1 || menor > 1) return { frequencia: -1, clareza: 0, rms };
    }

    const periodo = refinarPorParabola(melhorTau);
    if (!(periodo > 0)) return { frequencia: -1, clareza: 0, rms };

    const frequencia = taxaAmostragem / periodo;
    const clareza = Math.max(0, Math.min(1, 1 - normalizada[melhorTau]));
    return { frequencia, clareza, rms };
  }

  // Interpolação parabólica: o mínimo verdadeiro quase nunca cai exatamente
  // sobre uma amostra. Sem este refino o erro no agudo passa de 20 cents —
  // em 900 Hz um período inteiro tem só ~53 amostras a 48 kHz, e errar meia
  // amostra já é quase 1 % de frequência.
  //
  // A parábola passa pelos três pontos da *diferença* d(τ), não da
  // normalizada: é o que o artigo original manda, e a divisão cumulativa
  // inclina o vale o bastante pra deslocar o vértice.
  function refinarPorParabola(tau) {
    if (tau <= 0 || tau >= defasagemMaxima) return tau;
    const y0 = diferenca[tau - 1];
    const y1 = diferenca[tau];
    const y2 = diferenca[tau + 1];
    const denominador = 2 * (2 * y1 - y2 - y0);
    if (denominador === 0 || !isFinite(denominador)) return tau;
    const ajuste = (y2 - y0) / denominador;
    // um vértice a mais de meia amostra do mínimo amostrado é sinal de vale
    // torto, não de precisão — nesse caso é mais seguro ficar com o inteiro
    if (!isFinite(ajuste) || Math.abs(ajuste) > 1) return tau;
    return tau + ajuste;
  }

  return {
    detectar,
    definirFaixa,
    get tamanho() { return tamanho; },
    get taxaAmostragem() { return taxaAmostragem; },
    get faixaDeDefasagem() { return [defasagemMinima, defasagemMaxima]; },
  };
}

// Versão direta da função de diferença, O(W·τmáx). Não é usada em tempo real:
// existe para a verificação conferir que o caminho por FFT devolve os mesmos
// números que a definição do artigo.
export function diferencaDireta(buffer, janela, defasagemMaxima) {
  const d = new Float64Array(defasagemMaxima + 1);
  for (let tau = 0; tau <= defasagemMaxima; tau++) {
    let soma = 0;
    for (let j = 0; j < janela; j++) {
      const delta = buffer[j] - buffer[j + tau];
      soma += delta * delta;
    }
    d[tau] = soma;
  }
  return d;
}
