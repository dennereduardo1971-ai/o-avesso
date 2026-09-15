// Detecção de pitch por autocorrelação (ACF2+), sem dependências externas.
// Recebe um buffer de áudio (Float32Array) e a taxa de amostragem, devolve
// a frequência fundamental em Hz, ou -1 se não achar um sinal confiável.

const NOMES_NOTAS = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];

export function autocorrelar(buffer, taxaAmostragem) {
  const tamanho = buffer.length;

  let rms = 0;
  for (let i = 0; i < tamanho; i++) rms += buffer[i] * buffer[i];
  rms = Math.sqrt(rms / tamanho);
  if (rms < 0.01) return -1; // silêncio ou ruído de fundo, não vale a pena tentar

  // corta as bordas onde o sinal está muito fraco, pra não confundir o autocorrelate
  let inicio = 0, fim = tamanho - 1;
  const limiar = 0.2;
  while (inicio < tamanho / 2 && Math.abs(buffer[inicio]) < limiar) inicio++;
  while (fim > tamanho / 2 && Math.abs(buffer[fim]) < limiar) fim--;
  const recorte = buffer.slice(inicio, fim);
  const n = recorte.length;
  if (n < 512) return -1;

  const c = new Array(n).fill(0);
  for (let defasagem = 0; defasagem < n; defasagem++) {
    for (let i = 0; i < n - defasagem; i++) {
      c[defasagem] += recorte[i] * recorte[i + defasagem];
    }
  }

  let d = 0;
  while (d < n - 1 && c[d] > c[d + 1]) d++;

  let posMax = -1, valorMax = -Infinity;
  for (let i = d; i < n; i++) {
    if (c[i] > valorMax) { valorMax = c[i]; posMax = i; }
  }
  let periodo = posMax;

  // interpolação parabólica pra refinar o pico entre amostras
  if (posMax > 0 && posMax < n - 1) {
    const [x0, x1, x2] = [c[posMax - 1], c[posMax], c[posMax + 1]];
    const ajuste = (x2 - x0) / (2 * (2 * x1 - x2 - x0));
    if (isFinite(ajuste)) periodo = posMax + ajuste;
  }

  if (periodo <= 0) return -1;
  return taxaAmostragem / periodo;
}

// Converte Hz em nota + oitava + desvio em cents a partir de A4 = 440Hz.
export function frequenciaParaNota(frequencia) {
  if (!frequencia || frequencia <= 0) return null;
  const semitonsDeA4 = 12 * Math.log2(frequencia / 440);
  const midi = Math.round(semitonsDeA4) + 69;
  const cents = Math.round((semitonsDeA4 - Math.round(semitonsDeA4)) * 100);
  const indiceNota = ((midi % 12) + 12) % 12;
  const oitava = Math.floor(midi / 12) - 1;
  return { nome: NOMES_NOTAS[indiceNota], oitava, midi, cents };
}

export function notaParaFrequencia(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export { NOMES_NOTAS };
