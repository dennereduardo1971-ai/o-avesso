// Qual microfone está ouvindo — e se ele vai atrapalhar.
//
// No Android, fone Bluetooth COM microfone entra no perfil de telefone (HFP):
// o áudio cai pra 8–16 kHz, qualidade de ligação, nos dois sentidos — a voz
// chega abafada e o som-guia sai abafado também. O detector ainda acha a nota
// (a fundamental está bem abaixo disso), mas a experiência piora e o treino de
// ouvido fica com um guia de telefone. O app não impede nada: avisa, e diz o
// que resolve.

const PARECE_BLUETOOTH = /bluetooth|hands[- ]?free|headset|\bbt\b|airpods|buds|sco\b/i;

export function pareceBluetooth(rotulo) {
  return !!rotulo && PARECE_BLUETOOTH.test(rotulo);
}

export const AVISO_BLUETOOTH =
  'O microfone em uso parece ser de um fone Bluetooth. Eles gravam com qualidade de ligação e deixam o guia abafado. ' +
  'Pra treinar, use o microfone do celular ou um fone com fio.';

// O nome do microfone só aparece depois da permissão — por isso isto roda
// depois de ligar a escuta, com a faixa de áudio já aberta.
export async function rotuloDoMicrofone(stream) {
  try {
    const faixa = stream && stream.getAudioTracks()[0];
    if (!faixa) return '';
    if (faixa.label) return faixa.label;
    const { deviceId } = faixa.getSettings ? faixa.getSettings() : {};
    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const achado = dispositivos.find((d) => d.kind === 'audioinput' && d.deviceId === deviceId);
    return achado ? achado.label : '';
  } catch {
    return '';
  }
}
