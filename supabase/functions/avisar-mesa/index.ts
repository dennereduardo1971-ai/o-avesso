// avisar-mesa — a única parte do Avesso que roda no servidor.
//
// Existe porque o protocolo de Web Push exige assinar cada envio com a chave
// privada VAPID, e chave privada não pode existir dentro de um navegador.
// Fora isso, o app inteiro continua falando direto com a tabela.
//
// O que ela faz, na ordem:
//   1. confere quem pediu (o JWT vem do supabase-js, não é digitado)
//   2. confere se essa pessoa é o mestre — pelo mesmo avesso_e_mestre() que
//      protege o elenco de moradores; jogador que chamar isto leva 403
//   3. lê as inscrições de todo mundo (linhas pessoais 'user:<uid>:o-avesso-avisos')
//   4. empurra o recado, pulando os aparelhos do próprio mestre
//   5. limpa inscrição morta (aparelho que desinstalou o app, navegador que
//      expirou a assinatura) — senão a lista só cresce e o envio só piora
//
// Publicar:
//   supabase functions deploy avisar-mesa
//   supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:voce@exemplo.com
//
// O par de chaves sai de: node gerar-chaves-push.js (na raiz do projeto).

import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const AVISOS_SUFIXO = ':o-avesso-avisos';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function responder(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return responder({ erro: 'só POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const servico = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const vapidPublica = Deno.env.get('VAPID_PUBLIC_KEY');
  const vapidPrivada = Deno.env.get('VAPID_PRIVATE_KEY');
  const vapidAssunto = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:avesso@exemplo.com';

  if (!vapidPublica || !vapidPrivada) {
    return responder({ erro: 'as chaves VAPID não foram configuradas' }, 500);
  }

  // 1. quem está pedindo
  const autorizacao = req.headers.get('Authorization') ?? '';
  const comoUsuario = createClient(url, anon, {
    global: { headers: { Authorization: autorizacao } }
  });

  const { data: quem, error: erroAuth } = await comoUsuario.auth.getUser();
  if (erroAuth || !quem?.user) {
    return responder({ erro: 'sem sessão' }, 401);
  }

  // 2. e só o mestre pode acordar a mesa
  const { data: eMestre, error: erroMestre } = await comoUsuario.rpc('avesso_e_mestre');
  if (erroMestre || eMestre !== true) {
    return responder({ erro: 'esta porta é costurada por dentro' }, 403);
  }

  const recado = await req.json().catch(() => ({}));
  const carga = JSON.stringify({
    titulo: String(recado.titulo ?? 'O Avesso se mexeu'),
    texto: String(recado.texto ?? 'O mestre publicou o que aconteceu entre as sessões.'),
    url: String(recado.url ?? 'pages/diario.html')
  });

  webpush.setVapidDetails(vapidAssunto, vapidPublica, vapidPrivada);

  // 3. as inscrições de todo mundo — daqui pra frente, com service_role,
  //    porque o RLS (de propósito) esconde a linha de uma pessoa das outras
  const admin = createClient(url, servico);
  const { data: linhas, error: erroLinhas } = await admin
    .from('avesso_kv')
    .select('id, owner, value')
    .like('id', `user:%${AVISOS_SUFIXO}`);

  if (erroLinhas) return responder({ erro: erroLinhas.message }, 500);

  let enviados = 0;
  let limpos = 0;

  for (const linha of linhas ?? []) {
    if (linha.owner === quem.user.id) continue; // o mestre não avisa a si mesmo

    const inscricoes = Array.isArray(linha.value?.inscricoes) ? linha.value.inscricoes : [];
    const vivas: unknown[] = [];

    for (const inscricao of inscricoes) {
      try {
        await webpush.sendNotification({
          endpoint: inscricao.endpoint,
          keys: { p256dh: inscricao.p256dh, auth: inscricao.auth }
        }, carga);
        enviados++;
        vivas.push(inscricao);
      } catch (e) {
        // 404/410 = aquele aparelho não existe mais do lado do navegador.
        // Qualquer outro erro é passageiro: a inscrição fica.
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          limpos++;
        } else {
          vivas.push(inscricao);
        }
      }
    }

    if (vivas.length !== inscricoes.length) {
      await admin
        .from('avesso_kv')
        .update({ value: { inscricoes: vivas }, updated_at: new Date().toISOString() })
        .eq('id', linha.id);
    }
  }

  return responder({ enviados, limpos });
});
