// A verificação que importa: o detector alimentado por tons de frequência
// conhecida, gerados num OfflineAudioContext.
//
// Usar o próprio Web Audio API pra gerar o sinal (em vez de preencher um
// Float32Array com Math.sin) não é capricho: é assim que o áudio chega ao
// detector no app de verdade — com a mesma taxa de amostragem, a mesma
// quantização em float32, os mesmos oscilador e envelope. Um teste que gera o
// sinal por fora testaria matemática; este testa o caminho.
//
// Roda no navegador, inclusive no celular — e no celular é onde vale mais,
// porque a taxa de amostragem do aparelho é a única que realmente importa.

import { criarDetectorYin, diferencaDireta } from '../audio/yin.js';
import { criarTolerancia } from '../treino/tolerancia.js';
import {
  frequenciaParaNota,
  notaParaFrequencia,
  centsAteAlvo,
  nomeDaNota,
  cifraDaNota,
} from '../audio/notas.js';
import { notasDeDiagnostico, tessituraDe, EXTENSAO_PADRAO } from '../treino/voz.js';

const TAMANHO = 2048;
const resultados = [];

function afirmar(nome, condicao, detalhe) {
  resultados.push({ nome, passou: !!condicao, detalhe });
}

function cents(frequencia, alvo) {
  return 1200 * Math.log2(frequencia / alvo);
}

// --- geração do sinal --------------------------------------------------

// Um tom com harmônicos, como uma voz — e com a opção de fundamental fraca,
// que é o caso que derrubava a autocorrelação: no grave masculino captado por
// microfone de celular, o segundo harmônico costuma chegar mais forte que o
// primeiro, e um detector ingênuo anuncia a oitava acima.
async function gerarTom(frequencia, { taxaAmostragem, harmonicos = [1, 0.5, 0.25], ruido = 0 }) {
  const amostras = TAMANHO * 3;
  const contexto = new OfflineAudioContext(1, amostras, taxaAmostragem);
  const saida = contexto.createGain();
  saida.gain.value = 0.3;
  saida.connect(contexto.destination);

  harmonicos.forEach((amplitude, i) => {
    const osc = contexto.createOscillator();
    const ganho = contexto.createGain();
    osc.type = 'sine';
    osc.frequency.value = frequencia * (i + 1);
    ganho.gain.value = amplitude;
    osc.connect(ganho).connect(saida);
    osc.start(0);
    osc.stop(amostras / taxaAmostragem);
  });

  const renderizado = await contexto.startRendering();
  const canal = renderizado.getChannelData(0);
  // pega a janela do meio, longe do ataque
  const janela = new Float32Array(TAMANHO);
  janela.set(canal.subarray(TAMANHO, TAMANHO * 2));

  if (ruido) {
    for (let i = 0; i < TAMANHO; i++) janela[i] += ruido * (Math.random() * 2 - 1) * 0.3;
  }
  return janela;
}

// --- os testes ---------------------------------------------------------

async function varredura(nome, opcoes, { limiteCents, passo = 11 }) {
  const taxaAmostragem = opcoes.taxaAmostragem;
  const detector = criarDetectorYin({ taxaAmostragem, tamanho: TAMANHO });

  let pior = 0;
  let piorEm = 0;
  let oitavas = 0;
  let semDeteccao = 0;
  let soma = 0;
  let contagem = 0;

  for (let frequencia = 80; frequencia <= 900; frequencia += passo) {
    const janela = await gerarTom(frequencia, opcoes);
    const leitura = detector.detectar(janela);

    if (leitura.frequencia <= 0) { semDeteccao++; continue; }
    const erro = cents(leitura.frequencia, frequencia);
    // Meio tom já não é imprecisão, é outra nota; 600 cents é meia oitava e
    // serve de corte generoso pra separar as duas coisas.
    if (Math.abs(erro) > 600) { oitavas++; continue; }

    contagem++;
    soma += Math.abs(erro);
    if (Math.abs(erro) > Math.abs(pior)) { pior = erro; piorEm = frequencia; }
  }

  afirmar(
    nome,
    Math.abs(pior) < limiteCents && oitavas === 0 && semDeteccao === 0,
    `pior ${pior.toFixed(3)} cents em ${piorEm.toFixed(0)} Hz · médio ${(soma / Math.max(1, contagem)).toFixed(3)} · ` +
      `oitavas ${oitavas} · sem detecção ${semDeteccao} · limite ${limiteCents} cents`
  );
}

async function testarMotor(taxaAmostragem) {
  await varredura(
    `Precisão a ${taxaAmostragem} Hz — voz com harmônicos`,
    { taxaAmostragem, harmonicos: [1, 0.5, 0.25, 0.12] },
    { limiteCents: 1 }
  );

  await varredura(
    `Sem erro de oitava a ${taxaAmostragem} Hz — fundamental mais fraca que o 2º harmônico`,
    { taxaAmostragem, harmonicos: [0.25, 1, 0.8, 0.4, 0.2] },
    { limiteCents: 1 }
  );

  await varredura(
    `Senoide pura a ${taxaAmostragem} Hz`,
    { taxaAmostragem, harmonicos: [1] },
    { limiteCents: 1 }
  );

  await varredura(
    `Com ruído (10%) a ${taxaAmostragem} Hz`,
    { taxaAmostragem, harmonicos: [1, 0.5, 0.25], ruido: 0.1 },
    { limiteCents: 8, passo: 23 }
  );
}

async function testarSilencioERuido(taxaAmostragem) {
  const detector = criarDetectorYin({ taxaAmostragem, tamanho: TAMANHO });

  const silencio = new Float32Array(TAMANHO);
  afirmar(
    'Silêncio não vira nota',
    detector.detectar(silencio).frequencia === -1,
    'buffer zerado precisa devolver -1, senão o afinador mostra nota com ninguém cantando'
  );

  const ruido = new Float32Array(TAMANHO);
  for (let i = 0; i < TAMANHO; i++) ruido[i] = (Math.random() * 2 - 1) * 0.3;
  const leitura = detector.detectar(ruido);
  afirmar(
    'Ruído branco tem clareza baixa',
    leitura.clareza < 0.4,
    `clareza ${leitura.clareza.toFixed(3)} — o exercício corta em 0.6, então isto não entra na conta`
  );
}

function testarCaminhoDaFft(taxaAmostragem) {
  // O caminho rápido (FFT) tem que dar o mesmo número que a definição do
  // artigo. Se divergirem, é a FFT que está errada — e um erro aqui seria
  // invisível: o detector continuaria devolvendo *algum* número plausível.
  const detector = criarDetectorYin({ taxaAmostragem, tamanho: TAMANHO });
  const [, defasagemMaxima] = detector.faixaDeDefasagem;
  const janela = TAMANHO - defasagemMaxima;

  const buffer = new Float32Array(TAMANHO);
  for (let i = 0; i < TAMANHO; i++) {
    const t = i / taxaAmostragem;
    buffer[i] = 0.3 * (Math.sin(2 * Math.PI * 196 * t) + 0.5 * Math.sin(2 * Math.PI * 392 * t + 0.4));
  }

  const direta = diferencaDireta(buffer, janela, defasagemMaxima);
  const leitura = detector.detectar(buffer);

  // refaz o YIN por cima da diferença calculada por força bruta
  const normalizada = new Float64Array(defasagemMaxima + 1);
  normalizada[0] = 1;
  let acumulado = 0;
  for (let tau = 1; tau <= defasagemMaxima; tau++) {
    acumulado += direta[tau];
    normalizada[tau] = acumulado > 0 ? (direta[tau] * tau) / acumulado : 1;
  }
  const [defasagemMinima] = detector.faixaDeDefasagem;
  let tau = -1;
  for (let t = defasagemMinima; t <= defasagemMaxima; t++) {
    if (normalizada[t] < 0.15) {
      while (t + 1 <= defasagemMaxima && normalizada[t + 1] < normalizada[t]) t++;
      tau = t;
      break;
    }
  }
  const y0 = direta[tau - 1];
  const y1 = direta[tau];
  const y2 = direta[tau + 1];
  const periodo = tau + (y2 - y0) / (2 * (2 * y1 - y2 - y0));
  const porForcaBruta = taxaAmostragem / periodo;

  const diferencaEmCents = Math.abs(cents(leitura.frequencia, porForcaBruta));
  afirmar(
    'FFT dá o mesmo resultado que a definição direta',
    diferencaEmCents < 0.001,
    `fft ${leitura.frequencia.toFixed(4)} Hz · direta ${porForcaBruta.toFixed(4)} Hz · diferença ${diferencaEmCents.toFixed(6)} cents`
  );
}

function testarCusto(taxaAmostragem) {
  const detector = criarDetectorYin({ taxaAmostragem, tamanho: TAMANHO });
  const buffer = new Float32Array(TAMANHO);
  for (let i = 0; i < TAMANHO; i++) buffer[i] = 0.3 * Math.sin((2 * Math.PI * 147 * i) / taxaAmostragem);

  for (let i = 0; i < 30; i++) detector.detectar(buffer);
  const inicio = performance.now();
  const rodadas = 200;
  for (let i = 0; i < rodadas; i++) detector.detectar(buffer);
  const porDeteccao = (performance.now() - inicio) / rodadas;

  // O worklet detecta a cada 512 amostras, ~10,7 ms a 48 kHz. Passar disso
  // significa que a detecção não acompanha o áudio e vai acumulando atraso.
  const orcamento = (512 / taxaAmostragem) * 1000;
  afirmar(
    'Detecção cabe no intervalo entre duas detecções',
    porDeteccao < orcamento,
    `${porDeteccao.toFixed(3)} ms por detecção · orçamento ${orcamento.toFixed(1)} ms (neste aparelho)`
  );
}

function testarToleranciaAdaptativa() {
  const tolerancia = criarTolerancia();
  const caminho = [tolerancia.valor];
  for (let i = 0; i < 18; i++) caminho.push(tolerancia.registrar(true).valor);

  afirmar(
    'Tolerância aperta de ±50 até ±20 acertando',
    tolerancia.valor === 20 && caminho[0] === 50,
    `caminho ${caminho.join(' ')}`
  );

  const volta = [tolerancia.valor];
  for (let i = 0; i < 6; i++) volta.push(tolerancia.registrar(false).valor);
  afirmar(
    'E afrouxa de volta errando',
    tolerancia.valor === 35,
    `caminho ${volta.join(' ')} — dois erros seguidos afrouxam 5 cents`
  );

  const teto = criarTolerancia();
  for (let i = 0; i < 20; i++) teto.registrar(false);
  afirmar(
    'Nunca passa do teto de ±50',
    teto.valor === 50,
    `parou em ${teto.valor}`
  );

  const alternado = criarTolerancia();
  for (let i = 0; i < 30; i++) alternado.registrar(i % 2 === 0);
  afirmar(
    'Acerta-erra alternado não mexe na barra',
    alternado.valor === 50,
    `parou em ${alternado.valor} — a barra só anda com sequência, não com sorte`
  );
}

function testarNotas() {
  afirmar(
    'Lá4 = 440 Hz nos dois sentidos',
    Math.abs(notaParaFrequencia(69) - 440) < 1e-9 && frequenciaParaNota(440).midi === 69,
    `${notaParaFrequencia(69)} Hz · ${nomeDaNota(69)} / ${cifraDaNota(69)}`
  );

  afirmar(
    'Notação dupla bate',
    nomeDaNota(60) === 'Dó4' && cifraDaNota(60) === 'C4' && nomeDaNota(45) === 'Lá2' && cifraDaNota(45) === 'A2',
    `${nomeDaNota(60)}/${cifraDaNota(60)} · ${nomeDaNota(45)}/${cifraDaNota(45)}`
  );

  // A diferença entre "que nota é esta" e "quão longe do alvo estou" é o que
  // faz o exercício saber que um semitom abaixo é erro de 100 cents, e não
  // acerto de outra nota.
  const meioTomAbaixo = notaParaFrequencia(59);
  afirmar(
    'Cents até o alvo não arredondam para a nota vizinha',
    Math.abs(centsAteAlvo(meioTomAbaixo, 60) + 100) < 0.001,
    `${centsAteAlvo(meioTomAbaixo, 60).toFixed(3)} cents do alvo Dó4, e não 0 cents de Si3`
  );
}

function testarEscolhaDeNotas() {
  const notas = notasDeDiagnostico(EXTENSAO_PADRAO, 8);
  const tessitura = tessituraDe(EXTENSAO_PADRAO);
  const dentro = notas.every((m) => m >= tessitura.midiMinimo && m <= tessitura.midiMaximo);
  const distintas = new Set(notas).size === notas.length;
  const mesmasDeNovo = notasDeDiagnostico(EXTENSAO_PADRAO, 8).join(',') === notas.join(',');

  afirmar(
    'Teste inicial: 8 notas distintas, na tessitura, e sempre as mesmas',
    notas.length === 8 && dentro && distintas && mesmasDeNovo,
    `${notas.map(nomeDaNota).join(' ')} — repetíveis porque o reteste precisa medir a mesma coisa`
  );
}

// --- execução ----------------------------------------------------------

async function rodar() {
  resultados.length = 0;
  const saida = document.getElementById('saida');
  const placar = document.getElementById('placar');
  const botao = document.getElementById('rodar');
  botao.disabled = true;
  placar.textContent = 'Rodando…';
  saida.innerHTML = '<p class="progresso-texto">Sintetizando tons e medindo…</p>';

  // A taxa real do aparelho é a que importa; 44100 entra junto porque é a
  // outra que aparece no mundo, e a aritmética de defasagem muda com ela.
  const doAparelho = new (window.AudioContext || window.webkitAudioContext)();
  const taxaDoAparelho = doAparelho.sampleRate;
  doAparelho.close();

  const taxas = [...new Set([taxaDoAparelho, 44100, 48000])];

  try {
    testarNotas();
    testarEscolhaDeNotas();
    testarToleranciaAdaptativa();
    for (const taxa of taxas) {
      testarCaminhoDaFft(taxa);
      await testarMotor(taxa);
      await testarSilencioERuido(taxa);
    }
    testarCusto(taxaDoAparelho);
  } catch (erro) {
    afirmar('A verificação chegou ao fim', false, String(erro && erro.stack ? erro.stack : erro));
  }

  const falhas = resultados.filter((r) => !r.passou).length;
  saida.innerHTML = resultados
    .map(
      (r) => `<div class="teste ${r.passou ? 'passou' : 'falhou'}">
        <h3>${r.nome}</h3>
        <p>${r.detalhe}</p>
      </div>`
    )
    .join('');

  placar.className = `placar ${falhas ? 'tem-falha' : 'tudo-bem'}`;
  placar.textContent = falhas
    ? `${falhas} de ${resultados.length} falharam · taxa do aparelho: ${taxaDoAparelho} Hz`
    : `${resultados.length} de ${resultados.length} passaram · taxa do aparelho: ${taxaDoAparelho} Hz`;
  botao.disabled = false;

  // Pra rodar isto de um script de automação sem clicar no botão.
  window.__resultadoDaVerificacao = { total: resultados.length, falhas, resultados };
}

document.getElementById('rodar').addEventListener('click', rodar);
window.__rodarVerificacao = rodar;
