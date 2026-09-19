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
import { notasDeDiagnostico, tessituraDe, EXTENSAO_PADRAO, VOZES, notasDeTreino, ehPassaggio, extensaoDoPerfil } from '../treino/voz.js';
import { ROTINAS, duracaoTotal, posicaoNoTempo, inicioDaEtapa } from '../treino/aquecimento.js';
import { avaliar, respostasVazias } from '../treino/checkin.js';
import { montarTomVocal } from '../audio/sintese.js';
import { validarCopia } from '../dados/banco.js';
import { modoEfetivo, linhaVisivelNoEnsaio } from '../treino/retorno.js';
import { sugerirTransposicao, descreverTransposicao } from '../treino/tom.js';
import { metricasDaSessao } from '../treino/perfil.js';
import { pareceBluetooth } from '../audio/dispositivo.js';
import { minimaDoNivel } from '../treino/tolerancia.js';
import { analisarVibrato } from '../treino/vibrato.js';
import { planoDaSessao } from '../treino/sessao.js';
import { avaliarDeriva, dobrarOitava } from '../treino/deriva.js';
import { analisarTomada, melhorQue, escolherGravacao, taxaDeReproducao } from '../treino/guia.js';

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

async function varredura(nome, opcoes, { limiteCents, passo = 11, de = 80, ate = 900 }) {
  const taxaAmostragem = opcoes.taxaAmostragem;
  const detector = criarDetectorYin({ taxaAmostragem, tamanho: TAMANHO });

  let pior = 0;
  let piorEm = 0;
  let oitavas = 0;
  let semDeteccao = 0;
  let soma = 0;
  let contagem = 0;

  for (let frequencia = de; frequencia <= ate; frequencia += passo) {
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

  // O agudo de cantora: de Lá5 até perto de Fá6, com a fundamental forte como
  // na voz de cabeça. É a faixa que o teto antigo (1100 Hz) cortava.
  await varredura(
    `Agudo de cantora (880–1350 Hz) a ${taxaAmostragem} Hz`,
    { taxaAmostragem, harmonicos: [1, 0.4, 0.15] },
    { limiteCents: 1, passo: 13, de: 880, ate: 1350 }
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

// O guia tem que soar com o mesmo volume do grave de barítono ao agudo de
// cantora. Antes da compensação (audio/timbre.js) a variação era de ~20 dB, e
// o guia sumia justamente na região de uma voz aguda.
async function testarVolumeDoTomVocal() {
  const taxa = 48000;
  const medidas = [];
  let piorPico = 0;
  for (let midi = 45; midi <= 84; midi += 3) {
    const contexto = new OfflineAudioContext(1, taxa * 1.2, taxa);
    montarTomVocal(contexto, contexto.destination, midi, { duracao: 1.1, volume: 0.32, inicio: 0 });
    const canal = (await contexto.startRendering()).getChannelData(0);
    let soma = 0;
    let n = 0;
    for (let i = Math.floor(taxa * 0.3); i < Math.floor(taxa * 0.8); i++) { soma += canal[i] * canal[i]; n++; }
    for (const v of canal) piorPico = Math.max(piorPico, Math.abs(v));
    medidas.push({ midi, db: 20 * Math.log10(Math.sqrt(soma / n)) });
  }
  const dbs = medidas.map((m) => m.db);
  const variacao = Math.max(...dbs) - Math.min(...dbs);
  afirmar(
    'Tom vocal com o mesmo volume de Lá2 a Dó6 (variação ≤ 2 dB)',
    variacao <= 2,
    `variação ${variacao.toFixed(2)} dB · ${medidas.map((m) => `${nomeDaNota(m.midi)} ${m.db.toFixed(1)}`).join(' · ')}`
  );
  afirmar('Tom vocal nunca satura (pico < 1)', piorPico < 1, `pico ${piorPico.toFixed(3)}`);
}

// Só a validação. Restaurar de verdade NÃO entra aqui: esta página roda na
// mesma origem do app, e um teste que apaga e regrava o banco apagaria o
// histórico real de quem abrir a verificação no próprio celular.
function testarCopiaDeSeguranca() {
  const boa = { formato: 'afinado-copia', versao: 1, perfil: { id: 'eu' }, sessoes: [{ data: 1, tipo: 'checkin' }] };
  const casos = [
    ['cópia boa passa', boa, true],
    ['JSON qualquer é recusado', { nome: 'outra coisa' }, false],
    ['versão futura é recusada', { ...boa, versao: 99 }, false],
    ['sem perfil é recusada', { ...boa, perfil: null }, false],
    ['sessão sem data é recusada', { ...boa, sessoes: [{ tipo: 'afinacao' }] }, false],
  ];
  const errados = casos.filter(([, copia, deveria]) => (validarCopia(copia) === null) !== deveria);
  afirmar(
    'Cópia de segurança: só aceita arquivo do Afinado, inteiro',
    errados.length === 0,
    errados.length ? `falhou: ${errados.map(([n]) => n).join(', ')}` : casos.map(([n]) => n).join(' · ')
  );
}

function testarRetorno() {
  const casos = [
    [modoEfetivo('auto', 50, 20), 'sempre', 'auto, longe do mínimo → sempre'],
    [modoEfetivo('auto', 35, 20), 'alternado', 'auto, perto do mínimo → alternado'],
    [modoEfetivo('auto', 20, 20), 'fim', 'auto, no mínimo → só no fim'],
    [modoEfetivo('auto', 25, 10), 'alternado', 'experiente em ±25 → alternado'],
    [modoEfetivo('sempre', 20, 20), 'sempre', 'escolha da pessoa vence o automático'],
    [modoEfetivo(undefined, 50, 20), 'sempre', 'sem preferência = automático'],
  ];
  const errados = casos.filter(([obtido, esperado]) => obtido !== esperado);
  afirmar('Retorno sai de cena conforme a barra aperta, e a escolha da pessoa manda',
    errados.length === 0, errados.length ? errados.map((c) => `${c[2]}: deu ${c[0]}`).join(' · ') : casos.map((c) => c[2]).join(' · '));

  const alternado = [0, 1, 2, 3].map((i) => linhaVisivelNoEnsaio('alternado', i));
  afirmar('Alternado começa com a linha e intercala; "só no fim" nunca mostra durante',
    alternado.join() === 'true,false,true,false' && !linhaVisivelNoEnsaio('fim', 0) && linhaVisivelNoEnsaio('sempre', 7),
    `alternado ${alternado.join(' ')}`);

  afirmar('Nível experiente desce a barra até ±10; o padrão fica em ±20',
    minimaDoNivel('experiente') === 10 && minimaDoNivel('padrao') === 20 && minimaDoNivel(undefined) === 20, '');
}

function testarTom() {
  const voz = { midiMinimo: 57, midiMaximo: 79 }; // Lá3–Sol5
  const cabe = sugerirTransposicao({ graveDaMusica: 62, agudoDaMusica: 74, extensao: voz });
  afirmar('Trecho que já cabe: tom original', cabe.cabe && cabe.semitons === 0 && descreverTransposicao(0) === 'Cante no tom original',
    `folga no agudo ${cabe.folgaNoAgudo}`);

  const alto = sugerirTransposicao({ graveDaMusica: 67, agudoDaMusica: 80, extensao: voz });
  afirmar('Trecho alto demais desce até o agudo ficar 2 semitons abaixo do teto',
    alto.cabe && alto.semitons === -3 && alto.agudo === 77 && descreverTransposicao(-3) === 'Desça 3 semitons',
    `${descreverTransposicao(alto.semitons)} · agudo em ${nomeDaNota(alto.agudo)}`);

  const grave = sugerirTransposicao({ graveDaMusica: 50, agudoDaMusica: 60, extensao: voz });
  afirmar('Trecho grave demais sobe o mínimo necessário',
    grave.cabe && grave.semitons === 7 && grave.grave === 57, descreverTransposicao(grave.semitons));

  const largo = sugerirTransposicao({ graveDaMusica: 50, agudoDaMusica: 80, extensao: voz });
  afirmar('Trecho mais largo que a voz: diz que não cabe e protege o agudo',
    !largo.cabe && largo.agudo === 77 && largo.faltamNoGrave > 0,
    `largura ${largo.larguraDaMusica} vs ${largo.larguraConfortavel} confortáveis · ${descreverTransposicao(largo.semitons)}`);

  const invertido = sugerirTransposicao({ graveDaMusica: 74, agudoDaMusica: 62, extensao: voz });
  afirmar('Grave e agudo trocados por engano dão a mesma resposta', invertido.semitons === cabe.semitons, '');
}

function testarMetricasDaSessao() {
  const t = (desvioCents, oscilacaoCents = 10) => ({ desvioCents, oscilacaoCents });
  const alto = metricasDaSessao([t(20), t(25), t(15), t(20)]);
  afirmar('Tendência: cantar sempre acima dá tendência positiva e boa precisão',
    Math.round(alto.tendenciaCents) === 20 && alto.precisaoCents < 5,
    `tendência ${alto.tendenciaCents.toFixed(1)} · precisão ±${alto.precisaoCents.toFixed(1)}`);

  const espalhado = metricasDaSessao([t(-40), t(40), t(-35), t(35)]);
  afirmar('Precisão: acertar na média mas espalhar é detectado',
    Math.abs(espalhado.tendenciaCents) < 1 && espalhado.precisaoCents > 30,
    `tendência ${espalhado.tendenciaCents.toFixed(1)} · precisão ±${espalhado.precisaoCents.toFixed(1)}`);

  const poucas = metricasDaSessao([t(10), t(12)]);
  const comOitava = metricasDaSessao([t(10), t(12), { desvioCents: null, oscilacaoCents: null }, t(14)]);
  afirmar('Com menos de 3 medidas não há número; nota de outra oitava fica de fora',
    poucas.precisaoCents === null && Math.round(comOitava.tendenciaCents) === 12 && comOitava.oscilacaoCents === 10, '');
}

function testarVibrato() {
  // ~94 leituras por segundo, como o worklet a 48 kHz com salto de 512
  const gerar = (duracaoS, f) => {
    const tempos = [];
    const cents = [];
    let semente = 7;
    const ruido = () => { semente = (semente * 16807) % 2147483647; return (semente / 2147483647 - 0.5) * 4; };
    for (let i = 0; i < duracaoS * 94; i++) {
      const t = (i / 94) * 1000;
      tempos.push(t);
      cents.push(f(t / 1000) + ruido());
    }
    return [tempos, cents];
  };
  const classico = analisarVibrato(...gerar(2.5, (s) => 40 * Math.sin(2 * Math.PI * 6 * s)));
  afirmar('Vibrato de 6 Hz e ±40 cents é reconhecido e medido',
    classico && Math.abs(classico.velocidadeHz - 6) < 0.4 && Math.abs(classico.amplitudeCents - 40) < 6,
    classico ? `${classico.velocidadeHz.toFixed(2)} Hz · ±${classico.amplitudeCents.toFixed(1)} cents` : 'não reconheceu');

  const leve = analisarVibrato(...gerar(2.5, (s) => 15 * Math.sin(2 * Math.PI * 5.2 * s)));
  afirmar('Vibrato leve de pop (±15 cents) também', leve && Math.abs(leve.velocidadeHz - 5.2) < 0.4,
    leve ? `${leve.velocidadeHz.toFixed(2)} Hz · ±${leve.amplitudeCents.toFixed(1)} cents` : 'não reconheceu');

  const reta = analisarVibrato(...gerar(2.5, () => 5));
  const subindo = analisarVibrato(...gerar(2.5, (s) => -60 + 40 * s));
  const tremor = analisarVibrato(...gerar(2.5, (s) => 30 * Math.sin(2 * Math.PI * 12 * s)));
  const curta = analisarVibrato(...gerar(0.5, (s) => 40 * Math.sin(2 * Math.PI * 6 * s)));
  afirmar('Nota reta, subida lenta, tremor de 12 Hz e nota curta não viram vibrato',
    !reta && !subindo && !tremor && !curta,
    `reta ${!!reta} · subindo ${!!subindo} · tremor ${!!tremor} · curta ${!!curta}`);
}

function testarPlanoDaSessao() {
  const verde = planoDaSessao('verde');
  const amarelo = planoDaSessao('amarelo');
  const vermelho = planoDaSessao('vermelho');
  afirmar('Sessão completa: verde aquece 5 e treina 10; amarelo aquece 10 e treina 5; vermelho para',
    verde.segue && verde.rotina === 'curta' && verde.minutosDeTreino === 10 &&
    amarelo.segue && amarelo.rotina === 'longa' && amarelo.minutosDeTreino === 5 &&
    !vermelho.segue, '');
}

function testarDeriva() {
  const segurou = avaliarDeriva({ inicioCents: 5, fimCents: -3, duracaoMs: 50000 });
  const desceu = avaliarDeriva({ inicioCents: 0, fimCents: -42, duracaoMs: 60000 });
  const muito = avaliarDeriva({ inicioCents: 10, fimCents: 80, duracaoMs: 90000 });
  const oitava = avaliarDeriva({ inicioCents: 0, fimCents: 1195, duracaoMs: 60000 });
  afirmar('Deriva: 8 cents segurou; 42 abaixo é moderada; 70 acima é perceptível; voltar uma oitava acima não conta',
    segurou.nivel === 'segurou' && desceu.nivel === 'moderada' && desceu.lado === 'abaixo' &&
    muito.nivel === 'perceptivel' && muito.lado === 'acima' && Math.round(oitava.derivaCents) === -5 &&
    Math.round(desceu.porMinuto) === -42,
    `${segurou.texto} · ${desceu.texto} (${desceu.lado}) · ${muito.texto} · oitava → ${Math.round(oitava.derivaCents)}`);
  afirmar('Dobrar a oitava mantém o desvio dentro de ±600', dobrarOitava(1250) === 50 && dobrarOitava(-700) === 500, '');
}

async function testarGuiaPropriaVoz() {
  const taxa = 48000;
  const tomada = async (hz, harmonicos = [1, 0.5, 0.25]) => {
    const c = new OfflineAudioContext(1, taxa * 1.5, taxa);
    harmonicos.forEach((a, i) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.frequency.value = hz * (i + 1); g.gain.value = a * 0.3; o.connect(g).connect(c.destination); o.start();
    });
    return (await c.startRendering()).getChannelData(0);
  };
  const afinada = analisarTomada(await tomada(440 * 2 ** (8 / 1200)), taxa, 69);
  const longe = analisarTomada(await tomada(440 * 2 ** (60 / 1200)), taxa, 69);
  const silencio = analisarTomada(new Float32Array(taxa * 1.5), taxa, 69);
  afirmar('Guia: tomada a 8 cents do alvo é aceita, com o desvio medido; 60 cents ou silêncio são recusados',
    afinada && Math.abs(afinada.desvioCents - 8) < 1.5 && !longe && !silencio,
    afinada ? `desvio medido ${afinada.desvioCents.toFixed(2)} cents` : 'recusou a boa');

  const mapa = new Map([[69, { midi: 69, desvioCents: 8 }], [72, { midi: 72, desvioCents: -5 }]]);
  const exata = escolherGravacao(mapa, 69);
  const vizinha = escolherGravacao(mapa, 70);
  const longeDemais = escolherGravacao(mapa, 76);
  afirmar('Guia: usa a gravação da nota, ou a vizinha até 2 semitons — mais longe, não',
    exata.semitons === 0 && vizinha.registro.midi === 69 && vizinha.semitons === 1 && longeDemais === null, '');

  const cents = (r) => 1200 * Math.log2(r);
  afirmar('Guia: a velocidade corrige o desvio e a distância da gravação',
    Math.abs(cents(taxaDeReproducao({ midi: 69, desvioCents: 8 }, 69)) + 8) < 0.01 &&
    Math.abs(cents(taxaDeReproducao({ midi: 69, desvioCents: 8 }, 70)) - 92) < 0.01,
    `mesma nota ${cents(taxaDeReproducao({ midi: 69, desvioCents: 8 }, 69)).toFixed(1)} cents · um semitom acima ${cents(taxaDeReproducao({ midi: 69, desvioCents: 8 }, 70)).toFixed(1)} cents`);

  const agora = Date.now();
  afirmar('Guia: troca a gravação guardada só por uma claramente melhor, ou quase igual e bem mais nova',
    melhorQue({ desvioCents: 2, data: agora }, { desvioCents: 12, data: agora }) &&
    !melhorQue({ desvioCents: 10, data: agora }, { desvioCents: 9, data: agora }) &&
    melhorQue({ desvioCents: 10, data: agora }, { desvioCents: 9, data: agora - 40 * 86400000 }) &&
    melhorQue({ desvioCents: 20, data: agora }, undefined), '');
}

function testarBluetooth() {
  const casos = [
    ['Galaxy Buds2 Pro', true], ['Fone Bluetooth JBL', true], ['Headset (Hands-Free)', true],
    ['Microfone padrão', false], ['Default', false], ['', false], ['Built-in Microphone', false],
  ];
  const errados = casos.filter(([rotulo, esperado]) => pareceBluetooth(rotulo) !== esperado);
  afirmar('Reconhece microfone de fone Bluetooth pelo nome', errados.length === 0,
    errados.length ? `errou: ${errados.map((c) => c[0]).join(', ')}` : casos.map((c) => `${c[0] || '(vazio)'} → ${c[1]}`).join(' · '));
}

function testarTipoDeVoz() {
  const aguda = VOZES.aguda.extensao;
  afirmar(
    'Voz aguda é o palpite de barítono uma oitava acima',
    aguda.midiMinimo === EXTENSAO_PADRAO.midiMinimo + 12 && aguda.midiMaximo === EXTENSAO_PADRAO.midiMaximo + 12,
    `${nomeDaNota(aguda.midiMinimo)}–${nomeDaNota(aguda.midiMaximo)}`
  );

  const semEscolha = extensaoDoPerfil({ preferencias: {} });
  const comAguda = extensaoDoPerfil({ preferencias: { voz: 'aguda' } });
  const medida = extensaoDoPerfil({ preferencias: { voz: 'aguda' }, extensao: { midiMinimo: 50, midiMaximo: 70 } });
  afirmar(
    'Sem escolha continua barítono; escolher aguda muda o palpite; medida sempre vence',
    semEscolha.midiMinimo === 45 && comAguda.midiMinimo === 57 && medida.midiMinimo === 50 && !medida.estimada,
    `sem escolha ${semEscolha.midiMinimo} · aguda ${comAguda.midiMinimo} · medida ${medida.midiMinimo}`
  );

  const notas = notasDeDiagnostico(aguda, 8);
  const tess = tessituraDe(aguda);
  afirmar(
    'Teste inicial da voz aguda fica dentro da tessitura aguda',
    notas.every((m) => m >= tess.midiMinimo && m <= tess.midiMaximo),
    notas.map(nomeDaNota).join(' ')
  );

  const fila = notasDeTreino(aguda, { quantidade: 30, voz: 'aguda' });
  const primeiraVolta = fila.slice(0, 20);
  const passagemNoFim = primeiraVolta.findIndex((m) => ehPassaggio(m, 'aguda'));
  afirmar(
    'Na voz aguda, a passagem Dó#5–Ré5 fica pro fim da primeira volta',
    ehPassaggio(73, 'aguda') && !ehPassaggio(73, 'grave') && passagemNoFim >= primeiraVolta.length - 4,
    `primeira nota de passagem na posição ${passagemNoFim} de ${primeiraVolta.length}`
  );

  const r = VOZES.aguda.referencias;
  afirmar(
    'Notas de partida da voz aguda caem dentro do palpite agudo',
    r.grave > aguda.midiMinimo && r.agudo < aguda.midiMaximo,
    `desce a partir de ${nomeDaNota(r.grave)}, sobe a partir de ${nomeDaNota(r.agudo)}`
  );
}

function testarAquecimento() {
  const duracoes = Object.values(ROTINAS).map((r) => `${r.id} ${duracaoTotal(r)}s`);
  afirmar(
    'As rotinas têm a duração que prometem (5 min, 10 min, 2 min)',
    duracaoTotal(ROTINAS.curta) === 300 && duracaoTotal(ROTINAS.longa) === 600 && duracaoTotal(ROTINAS.desaquecer) === 120,
    duracoes.join(' · ')
  );

  const todas = Object.values(ROTINAS).flatMap((r) => r.etapas);
  afirmar(
    'Toda etapa tem título, instrução e tempo positivo',
    todas.every((e) => e.titulo && e.instrucao && e.segundos > 0),
    `${todas.length} etapas`
  );

  const r = ROTINAS.curta;
  const inicio = posicaoNoTempo(r, 0);
  const naVirada = posicaoNoTempo(r, r.etapas[0].segundos);
  const fim = posicaoNoTempo(r, duracaoTotal(r));
  afirmar(
    'A contagem troca de etapa no segundo exato e termina no fim',
    inicio.indice === 0 && naVirada.indice === 1 && naVirada.restanteNaEtapa === r.etapas[1].segundos && fim.terminou,
    `0s → etapa ${inicio.indice}; ${r.etapas[0].segundos}s → etapa ${naVirada.indice}; ${duracaoTotal(r)}s → terminou ${fim.terminou}`
  );

  afirmar(
    'Pular etapa leva ao começo da seguinte',
    posicaoNoTempo(r, inicioDaEtapa(r, 3)).indice === 3,
    `início da etapa 3 = ${inicioDaEtapa(r, 3)}s`
  );
}

function testarCheckin() {
  const nada = respostasVazias();
  afirmar('Check-in sem nada marcado dá verde', avaliar(nada).nivel === 'verde', avaliar(nada).titulo);

  const leve = respostasVazias();
  leve.sintomas.secura = 1;
  leve.sintomas.coceira = 1;
  afirmar('Dois incômodos leves continuam verde', avaliar(leve).nivel === 'verde', avaliar(leve).titulo);

  const forte = respostasVazias();
  forte.sintomas.secura = 2;
  afirmar('Um sintoma forte dá amarelo (canta leve)', avaliar(forte).nivel === 'amarelo', avaliar(forte).titulo);

  const somados = respostasVazias();
  ['secura', 'ardor', 'aperto', 'coceira'].forEach((id) => { somados.sintomas[id] = 1; });
  afirmar('Quatro incômodos leves somados dão amarelo', avaliar(somados).nivel === 'amarelo', avaliar(somados).titulo);

  const dor = respostasVazias();
  dor.sintomas.dor = 2;
  afirmar('Garganta bem dolorida dá vermelho', avaliar(dor).nivel === 'vermelho', avaliar(dor).titulo);

  const vermelhos = ['dorAoCantar', 'roucaAoAcordar', 'perdeuAgudos', 'roucaHaSemanas'].map((id) => {
    const r = respostasVazias();
    r.alertas[id] = true;
    return [id, avaliar(r)];
  });
  afirmar(
    'Qualquer sinal de alerta sozinho dá vermelho',
    vermelhos.every(([, a]) => a.nivel === 'vermelho'),
    vermelhos.map(([id, a]) => `${id} → ${a.nivel}`).join(' · ')
  );

  const semanas = vermelhos.find(([id]) => id === 'roucaHaSemanas')[1];
  afirmar(
    'Rouquidão de semanas manda procurar otorrino',
    semanas.orientacoes.some((o) => o.includes('otorrino')),
    semanas.orientacoes[0]
  );
}

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
    testarTipoDeVoz();
    testarRetorno();
    testarTom();
    testarMetricasDaSessao();
    testarBluetooth();
    testarVibrato();
    testarPlanoDaSessao();
    testarDeriva();
    await testarGuiaPropriaVoz();
    testarCopiaDeSeguranca();
    await testarVolumeDoTomVocal();
    testarAquecimento();
    testarCheckin();
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
