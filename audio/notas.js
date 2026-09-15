// Conversões entre frequência, número MIDI e nome de nota — a régua que o app
// inteiro usa. Referência: Lá4 = 440 Hz.
//
// Toda nota tem dois nomes aqui. "Dó4" é como se fala em aula de canto no
// Brasil; "C4" é o que está escrito em cifra, em teclado e em arquivo MIDI.
// O app mostra os dois lado a lado justamente pra que aprender um não custe
// desaprender o outro.

export const NOMES_NOTAS = ['Dó', 'Dó#', 'Ré', 'Ré#', 'Mi', 'Fá', 'Fá#', 'Sol', 'Sol#', 'Lá', 'Lá#', 'Si'];
export const CIFRAS_NOTAS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const MIDI_LA4 = 69;
export const FREQUENCIA_LA4 = 440;

export function notaParaFrequencia(midi) {
  return FREQUENCIA_LA4 * Math.pow(2, (Number(midi) - MIDI_LA4) / 12);
}

// MIDI contínuo (com casas decimais): 60.5 é meio semitom acima do Dó4.
// É daqui que sai tanto o desvio em cents quanto a altura no mostrador rolante.
export function frequenciaParaMidiContinuo(frequencia) {
  if (!frequencia || frequencia <= 0) return null;
  return MIDI_LA4 + 12 * Math.log2(frequencia / FREQUENCIA_LA4);
}

export function indiceDaNota(midi) {
  return ((Math.round(midi) % 12) + 12) % 12;
}

export function oitavaDaNota(midi) {
  return Math.floor(Math.round(midi) / 12) - 1;
}

export function nomeDaNota(midi) {
  return `${NOMES_NOTAS[indiceDaNota(midi)]}${oitavaDaNota(midi)}`;
}

export function cifraDaNota(midi) {
  return `${CIFRAS_NOTAS[indiceDaNota(midi)]}${oitavaDaNota(midi)}`;
}

// "Dó4 · C4" — a notação dupla como ela aparece na tela.
export function rotuloDuplo(midi, separador = ' · ') {
  return `${nomeDaNota(midi)}${separador}${cifraDaNota(midi)}`;
}

// Converte Hz em nota + oitava + desvio em cents da nota mais próxima.
export function frequenciaParaNota(frequencia) {
  const continuo = frequenciaParaMidiContinuo(frequencia);
  if (continuo === null) return null;
  const midi = Math.round(continuo);
  return {
    nome: NOMES_NOTAS[indiceDaNota(midi)],
    cifra: CIFRAS_NOTAS[indiceDaNota(midi)],
    oitava: oitavaDaNota(midi),
    midi,
    midiContinuo: continuo,
    cents: Math.round((continuo - midi) * 100),
    frequencia,
  };
}

// Desvio em cents em relação a um alvo declarado, **sem** arredondar para a
// nota mais próxima. É a diferença entre as duas funções que importa num
// exercício: quem canta meio tom abaixo do alvo está a -100 cents do alvo,
// não a 0 cents de outra nota.
export function centsAteAlvo(frequencia, midiAlvo) {
  if (!frequencia || frequencia <= 0) return null;
  return 1200 * Math.log2(frequencia / notaParaFrequencia(midiAlvo));
}

// Lista de MIDI de min a max, inclusive — para preencher seletores e escalas.
export function notasEntre(midiMin, midiMax) {
  const lista = [];
  for (let midi = Math.ceil(midiMin); midi <= Math.floor(midiMax); midi++) lista.push(midi);
  return lista;
}
