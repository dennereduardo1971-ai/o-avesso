// Roda a página de verificação num navegador sem tela e falha se algum teste
// falhar. É o portão da publicação: a CI roda isto antes de empurrar pro ar.
//
// POR QUE UM NAVEGADOR DE VERDADE, E NÃO NODE PURO
// Os testes que mais importam passam tons sintetizados pelo detector dentro
// de um OfflineAudioContext — é o caminho do áudio de verdade, com a mesma
// taxa de amostragem e a mesma quantização. Node não tem Web Audio; simular
// isso testaria matemática, não o app.
//
// Uso:
//   cd ferramentas && npm install --no-save playwright   (uma vez)
//   node ferramentas/verificar.mjs                        (Chromium do Playwright)
//   CANAL=msedge node ferramentas/verificar.mjs          (Edge já instalado, sem baixar navegador)

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

// Servidor estático mínimo — os módulos ES só carregam por http(s).
function servir() {
  const servidor = createServer(async (pedido, resposta) => {
    try {
      const caminho = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
      const arquivo = normalize(join(RAIZ, caminho.endsWith('/') ? `${caminho}index.html` : caminho));
      if (!arquivo.startsWith(RAIZ + sep)) throw new Error('fora da raiz');
      const corpo = await readFile(arquivo);
      resposta.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
      resposta.end(corpo);
    } catch {
      resposta.writeHead(404);
      resposta.end();
    }
  });
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor)));
}

const servidor = await servir();
const endereco = `http://127.0.0.1:${servidor.address().port}`;
const navegador = await chromium.launch({
  channel: process.env.CANAL || undefined,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

let codigo = 1;
try {
  const pagina = await navegador.newPage();
  const errosDaPagina = [];
  pagina.on('pageerror', (erro) => errosDaPagina.push(erro.message));

  await pagina.goto(`${endereco}/verificacao/index.html`);
  await pagina.waitForFunction(() => typeof window.__rodarVerificacao === 'function');
  const resultado = await pagina.evaluate(async () => {
    await window.__rodarVerificacao();
    return window.__resultadoDaVerificacao;
  });

  for (const r of resultado.resultados) {
    console.log(`${r.passou ? '✓' : '✗'} ${r.nome}`);
    if (!r.passou) console.log(`    ${r.detalhe}`);
  }
  for (const erro of errosDaPagina) console.log(`✗ erro na página: ${erro}`);

  const falhas = resultado.falhas + errosDaPagina.length;
  console.log(`\n${resultado.total - resultado.falhas} de ${resultado.total} passaram`);
  if (resultado.total === 0) console.log('nenhum teste rodou — isso é falha, não sucesso');
  codigo = falhas === 0 && resultado.total > 0 ? 0 : 1;
} catch (erro) {
  console.error('a verificação não chegou ao fim:', erro);
} finally {
  await navegador.close();
  servidor.close();
}

process.exit(codigo);
