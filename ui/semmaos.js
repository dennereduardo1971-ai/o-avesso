// Modo sem mãos: o celular apoiado longe, você de pé, cantando.
//
// A restrição que desenhou isto: cantar com o celular na mão não dá certo. A
// postura muda, o microfone encosta na roupa, e a mão ocupada não deixa você
// respirar direito. Então o telefone fica a dois metros e o app tem que
// funcionar sem receber nenhum toque durante a sessão inteira — o que exige
// três coisas: tela que não apaga, letra que se lê de longe, e avanço
// automático (esse último é do próprio exercício).
//
// Wake Lock não existe em todo navegador e é perdido toda vez que a aba sai de
// foco; por isso o pedido é refeito quando a aba volta.

let trava = null;
let ligado = false;

export function suportaTravaDeTela() {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

async function pedirTrava() {
  if (!ligado || !suportaTravaDeTela()) return;
  if (trava && !trava.released) return;
  try {
    trava = await navigator.wakeLock.request('screen');
    trava.addEventListener('release', () => { trava = null; });
  } catch {
    // negada (aba em segundo plano, bateria baixa, navegador sem suporte).
    // Não é erro fatal: a tela apaga e a pessoa toca nela, só isso.
    trava = null;
  }
}

async function soltarTrava() {
  if (!trava) return;
  try { await trava.release(); } catch { /* já solta */ }
  trava = null;
}

function aoVoltarPraTela() {
  if (document.visibilityState === 'visible') pedirTrava();
}

export async function ativar() {
  if (ligado) return;
  ligado = true;
  document.body.classList.add('sem-maos');
  document.addEventListener('visibilitychange', aoVoltarPraTela);
  await pedirTrava();
}

export async function desativar() {
  if (!ligado) return;
  ligado = false;
  document.body.classList.remove('sem-maos');
  document.removeEventListener('visibilitychange', aoVoltarPraTela);
  await soltarTrava();
}

export function estaAtivo() {
  return ligado;
}

export async function definir(valor) {
  if (valor) await ativar();
  else await desativar();
}
