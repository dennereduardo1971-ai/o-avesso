// avisos.js — o Avesso batendo na porta de quem não está com o app aberto.
//
// Serve pra UMA coisa: quando o mestre vira a página e publica o que
// aconteceu entre as sessões, quem quiser recebe um aviso. Não é o mundo
// cutucando as pessoas às três da manhã — nada aqui dispara sozinho, é
// sempre o mestre apertando um botão depois de aprovar o que aconteceu.
//
// Onde cada peça mora:
//   este arquivo        -> pedir permissão, assinar, guardar a inscrição
//   service-worker.js   -> receber o empurrão e mostrar a notificação
//   supabase/functions/avisar-mesa -> quem de fato envia (assina com a chave
//                          privada VAPID, que nunca pode estar no navegador)
//
// As inscrições ficam em linha PESSOAL do avesso_kv: cada pessoa só enxerga
// os próprios aparelhos, e o RLS garante isso. Quem lê todas é a função no
// servidor, com a service_role — que também nunca vem parar aqui.

import { db, chamarFuncao } from './db.js';

const AVISOS_KEY = 'o-avesso-avisos';

// Chave pública VAPID. É pública mesmo — pode ficar no código do navegador.
// A privada é segredo da função (ver README do supabase/functions/avisar-mesa).
// Gere o par com: node gerar-chaves-push.js
export const VAPID_PUBLICA = '';

export function configurado() {
  return Boolean(VAPID_PUBLICA);
}

export function suportado() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

/**
 * Em que pé estão os avisos neste aparelho.
 * @returns {Promise<'sem-suporte'|'sem-chave'|'bloqueado'|'ligado'|'desligado'>}
 */
export async function estado() {
  if (!suportado()) return 'sem-suporte';
  if (!configurado()) return 'sem-chave';
  if (Notification.permission === 'denied') return 'bloqueado';

  try {
    const registro = await navigator.serviceWorker.getRegistration();
    const inscricao = registro && await registro.pushManager.getSubscription();
    return inscricao ? 'ligado' : 'desligado';
  } catch (e) {
    return 'desligado';
  }
}

// A chave VAPID viaja em base64url; o PushManager quer bytes crus.
function base64UrlParaBytes(base64) {
  const preenchido = (base64 + '='.repeat((4 - base64.length % 4) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/');
  const bruto = atob(preenchido);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

function chaveEmBase64(inscricao, nome) {
  const chave = inscricao.getKey(nome);
  if (!chave) return '';
  return btoa(String.fromCharCode.apply(null, new Uint8Array(chave)));
}

async function inscricoesGuardadas() {
  try {
    const guardado = await db.get(AVISOS_KEY, false);
    return (guardado && Array.isArray(guardado.inscricoes)) ? guardado.inscricoes : [];
  } catch (e) {
    return [];
  }
}

async function guardarInscricoes(inscricoes) {
  await db.set(AVISOS_KEY, { inscricoes: inscricoes }, false);
}

/**
 * Liga os avisos neste aparelho. Pede a permissão do navegador, assina no
 * serviço de push e guarda a inscrição na linha pessoal.
 *
 * Um detalhe que costuma pegar: no iPhone isto só funciona com o app
 * instalado na tela de início — o Safari não aceita push de site aberto na
 * aba. Em Android e no computador funciona dos dois jeitos.
 */
export async function ligar() {
  if (!suportado()) throw new Error('este aparelho não recebe avisos');
  if (!configurado()) throw new Error('os avisos ainda não foram configurados pelo mestre');

  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error('o aparelho não deixou avisar');

  const registro = await navigator.serviceWorker.ready;
  let inscricao = await registro.pushManager.getSubscription();
  if (!inscricao) {
    inscricao = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlParaBytes(VAPID_PUBLICA)
    });
  }

  const nova = {
    endpoint: inscricao.endpoint,
    p256dh: chaveEmBase64(inscricao, 'p256dh'),
    auth: chaveEmBase64(inscricao, 'auth'),
    aparelho: navigator.userAgent.slice(0, 120),
    em: new Date().toISOString()
  };

  const lista = await inscricoesGuardadas();
  await guardarInscricoes(
    lista.filter((i) => i.endpoint !== nova.endpoint).concat([nova])
  );
  return true;
}

/** Desliga os avisos neste aparelho (os outros continuam valendo). */
export async function desligar() {
  if (!suportado()) return true;

  const registro = await navigator.serviceWorker.getRegistration();
  const inscricao = registro && await registro.pushManager.getSubscription();
  const endpoint = inscricao ? inscricao.endpoint : null;

  if (inscricao) await inscricao.unsubscribe();

  const lista = await inscricoesGuardadas();
  await guardarInscricoes(endpoint ? lista.filter((i) => i.endpoint !== endpoint) : []);
  return true;
}

/**
 * Avisa a mesa. Só o mestre passa — quem confere é a função no servidor,
 * pelo mesmo `avesso_e_mestre()` que protege o elenco.
 *
 * @param {{titulo: string, texto: string}} recado
 * @returns {Promise<{enviados: number, limpos: number}>}
 */
export async function avisarMesa(recado) {
  return chamarFuncao('avisar-mesa', {
    titulo: recado.titulo || 'O Avesso se mexeu',
    texto: recado.texto || 'O mestre publicou o que aconteceu entre as sessões.',
    url: 'pages/diario.html'
  });
}
