// gerar-chaves-push.js
// Gera o par de chaves VAPID que os avisos (Web Push) usam.
// Rode com: node gerar-chaves-push.js
// Precisa de Node 18 ou mais novo. Não instala nada — usa o crypto do próprio Node.
//
// O par é uma chave só, em duas metades:
//   PÚBLICA  -> vai pro navegador, em scripts/avisos.js (VAPID_PUBLICA)
//   PRIVADA  -> vai pro Supabase como segredo da função, e NUNCA pro código
//
// Gere uma vez e guarde. Trocar o par depois derruba todas as inscrições
// que já existiam: cada aparelho teria que ligar os avisos de novo.

const { generateKeyPairSync } = require('crypto');

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });

const jwkPublica = publicKey.export({ format: 'jwk' });
const jwkPrivada = privateKey.export({ format: 'jwk' });

// A pública do VAPID é o ponto não comprimido: 0x04 seguido de X e Y.
const x = Buffer.from(jwkPublica.x, 'base64url');
const y = Buffer.from(jwkPublica.y, 'base64url');
const publicaVapid = Buffer.concat([Buffer.from([0x04]), x, y]).toString('base64url');
const privadaVapid = jwkPrivada.d;

console.log(`
Par de chaves VAPID do O Avesso
================================

1) Cole a PÚBLICA em scripts/avisos.js, na constante VAPID_PUBLICA:

   export const VAPID_PUBLICA = '${publicaVapid}';

2) Guarde a PRIVADA no Supabase (nunca no código, nunca no git):

   supabase secrets set \\
     VAPID_PUBLIC_KEY=${publicaVapid} \\
     VAPID_PRIVATE_KEY=${privadaVapid} \\
     VAPID_SUBJECT=mailto:seu-email@exemplo.com

3) Publique a função:

   supabase functions deploy avisar-mesa

A partir daí, "Avisos do Avesso" aparece ligável na tela Minha Conta.
`);
