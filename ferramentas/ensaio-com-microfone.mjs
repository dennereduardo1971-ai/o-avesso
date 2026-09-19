// Ensaio de ponta a ponta: uma sessão de treino inteira, com microfone falso.
//
// O Chromium aceita um arquivo WAV no lugar do microfone. O arquivo aqui é um
// Lá4 "cantado" (harmônicos e vibrato leve) em loop. Não acerta todas as notas
// — nem precisa: o ensaio confere que o caminho inteiro funciona (microfone →
// worklet → exercício → retorno às cegas → resumo com as métricas novas) sem
// ninguém cantar. Leva uns dois minutos, por isso não é o portão da CI.
//
// Uso (depois de `cd ferramentas && npm install --no-save playwright`):
//   CANAL=msedge node ferramentas/ensaio-com-microfone.mjs
// O WAV é gerado na primeira vez e fica fora do git.

import { createServer } from 'node:http';
import { readFile, writeFile, access } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const WAV = join(RAIZ, 'ferramentas', 'la4-cantado.wav');
// 20 s de Lá4 com harmônicos e vibrato de ±12 cents a 5,5 Hz. O desvio-padrão
// de um vibrato senoidal de ±12 é 12/√2 ≈ 8,5 cents — é contra isso que a
// oscilação medida é conferida lá embaixo.
async function garantirWav() {
  try { await access(WAV); return; } catch { /* gera */ }
  const taxa = 48000;
  const n = taxa * 20;
  const dados = Buffer.alloc(44 + n * 2);
  dados.write('RIFF', 0); dados.writeUInt32LE(36 + n * 2, 4); dados.write('WAVE', 8);
  dados.write('fmt ', 12); dados.writeUInt32LE(16, 16); dados.writeUInt16LE(1, 20); dados.writeUInt16LE(1, 22);
  dados.writeUInt32LE(taxa, 24); dados.writeUInt32LE(taxa * 2, 28); dados.writeUInt16LE(2, 32); dados.writeUInt16LE(16, 34);
  dados.write('data', 36); dados.writeUInt32LE(n * 2, 40);
  let fase = 0;
  for (let i = 0; i < n; i++) {
    const f = 440 * 2 ** ((12 * Math.sin((2 * Math.PI * 5.5 * i) / taxa)) / 1200);
    fase += (2 * Math.PI * f) / taxa;
    const v = 0.5 * Math.sin(fase) + 0.25 * Math.sin(2 * fase) + 0.12 * Math.sin(3 * fase);
    dados.writeInt16LE(Math.round(v * 0.6 * 32767), 44 + i * 2);
  }
  await writeFile(WAV, dados);
}
await garantirWav();

const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const servidor = createServer(async (pedido, resposta) => {
  try {
    const caminho = decodeURIComponent(new URL(pedido.url, 'http://x').pathname);
    const arquivo = normalize(join(RAIZ, caminho.endsWith('/') ? `${caminho}index.html` : caminho));
    if (!arquivo.startsWith(RAIZ + sep)) throw new Error('fora');
    const corpo = await readFile(arquivo); // lê antes de responder: se falhar, o 404 ainda pode sair
    resposta.writeHead(200, { 'content-type': TIPOS[extname(arquivo)] || 'application/octet-stream' });
    resposta.end(corpo);
  } catch { resposta.writeHead(404); resposta.end(); }
});
await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
const endereco = `http://127.0.0.1:${servidor.address().port}`;

const navegador = await chromium.launch({
  channel: process.env.CANAL || undefined,
  args: [
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    `--use-file-for-fake-audio-capture=${WAV}`,
    '--autoplay-policy=no-user-gesture-required',
  ],
});

const falhas = [];
const conferir = (nome, ok, detalhe = '') => { console.log(`${ok ? '✓' : '✗'} ${nome}${detalhe ? ` — ${detalhe}` : ''}`); if (!ok) falhas.push(nome); };

try {
  const contexto = await navegador.newContext({ permissions: ['microphone'] });
  const pagina = await contexto.newPage();
  const erros = [];
  pagina.on('pageerror', (e) => erros.push(e.message));

  // Migração do banco: quem já usa o app tem o banco na versão 1 (perfil e
  // sessões). O código novo abre na versão 2 e não pode perder nada. A página
  // aqui é uma que não abre o banco sozinha.
  await pagina.goto(`${endereco}/manifest.json`);
  const migracao = await pagina.evaluate(async () => {
    await new Promise((ok, erro) => {
      const p = indexedDB.open('afinado', 1);
      p.onupgradeneeded = () => {
        const b = p.result;
        b.createObjectStore('perfil', { keyPath: 'id' });
        b.createObjectStore('sessoes', { keyPath: 'id', autoIncrement: true }).createIndex('data', 'data');
      };
      p.onsuccess = () => {
        const b = p.result;
        const t = b.transaction(['perfil', 'sessoes'], 'readwrite');
        t.objectStore('perfil').put({ id: 'eu', tolerancia: 30, extensao: { midiMinimo: 50, midiMaximo: 72 }, preferencias: { fala: true } });
        t.objectStore('sessoes').add({ data: Date.now() - 86400000, tipo: 'afinacao', erroMedioCents: 31 });
        t.oncomplete = () => { b.close(); ok(); };
        t.onerror = () => erro(t.error);
      };
      p.onerror = () => erro(p.error);
    });
    const banco = await import('/dados/banco.js');
    const perfil = await banco.lerPerfil();
    const sessoes = await banco.listarSessoes();
    const vozes = await banco.lerVozes();
    return {
      perfil: perfil.tolerancia === 30 && perfil.extensao.midiMaximo === 72,
      sessoes: sessoes.length === 1 && sessoes[0].erroMedioCents === 31,
      lojaDeVozes: Array.isArray(vozes),
      confiavel: banco.guardaConfiavel(),
    };
  });
  conferir('Migração do banco v1 → v2 preserva perfil e sessões e cria a loja de vozes',
    migracao.perfil && migracao.sessoes && migracao.lojaDeVozes && migracao.confiavel, JSON.stringify(migracao));

  await pagina.goto(`${endereco}/index.html#/`);
  // Voz medida em volta do Lá4 (tessitura Fá4–Mi5): as notas-alvo ficam a
  // poucos semitons do tom do arquivo, então há acertos e erros medidos.
  await pagina.evaluate(async () => {
    const banco = await import('/dados/banco.js');
    await banco.apagarTudo();
    await banco.salvarPerfil({
      extensao: { midiMinimo: 64, midiMaximo: 80, medidoEm: Date.now() },
      diagnostico: { erroMedioCents: 30, acertos: 4, total: 8, feitoEm: Date.now() },
      preferencias: { fala: false, retorno: 'fim', voz: 'aguda', guiaPropriaVoz: true },
    });
  });

  // Gravações simultâneas do perfil não podem se apagar (bug achado em 19/09:
  // salvar o nível e o modo da linha em seguida perdia o nível).
  const preferencias = await pagina.evaluate(async () => {
    const banco = await import('/dados/banco.js');
    await Promise.all([
      banco.salvarPerfil({ preferencias: { nivel: 'experiente' } }),
      banco.salvarPerfil({ preferencias: { semMaos: true } }),
      banco.salvarPerfil({ preferencias: { semMaos: false, nivel: 'padrao' } }),
    ]);
    return (await banco.lerPerfil()).preferencias;
  });
  conferir('Gravações simultâneas do perfil não se apagam',
    preferencias.nivel === 'padrao' && preferencias.semMaos === false && preferencias.retorno === 'fim' && preferencias.voz === 'aguda',
    JSON.stringify(preferencias));

  await pagina.goto(`${endereco}/index.html#/treino?minutos=2`);
  await pagina.click('#comecar');
  await pagina.waitForSelector('#ex-instrucao');

  // Durante o canto às cegas: instrução diz "de ouvido" e a barra não anda.
  await pagina.waitForFunction(() => document.querySelector('#ex-instrucao')?.textContent.startsWith('Cante'), null, { timeout: 30000 });
  await pagina.waitForTimeout(2500);
  const duranteOCanto = await pagina.evaluate(() => ({
    instrucao: document.querySelector('#ex-instrucao').textContent,
    barra: document.querySelector('#ex-barra').style.width || '0%',
  }));
  conferir('Canto às cegas avisa "de ouvido"', duranteOCanto.instrucao.includes('de ouvido'), duranteOCanto.instrucao);
  conferir('Barra de sustentação parada às cegas', duranteOCanto.barra === '0%', duranteOCanto.barra);

  await pagina.waitForFunction(() => location.hash.startsWith('#/resumo'), null, { timeout: 300000 });
  await pagina.waitForTimeout(500);
  const resumo = await pagina.evaluate(async () => {
    const banco = await import('/dados/banco.js');
    const s = (await banco.listarSessoes({ limite: 5 })).find((x) => x.tipo === 'afinacao');
    return {
      texto: document.querySelector('.medidas')?.innerText || '',
      sessao: s && { total: s.total, acertos: s.acertos, erro: s.erroMedioCents, tendencia: s.tendenciaCents, precisao: s.precisaoCents, oscilacao: s.oscilacaoCents, vibrato: s.vibrato, modo: s.modoDeRetorno },
    };
  });
  const s = resumo.sessao || {};
  conferir('Sessão gravada no modo "só no fim"', s.modo === 'fim', JSON.stringify(s));
  conferir('Resumo mostra precisão e oscilação', /Precisão/.test(resumo.texto) && /Oscilação/.test(resumo.texto));
  // O arquivo tem vibrato de ±12 cents: a oscilação medida tem que refletir isso.
  conferir('Oscilação medida bate com o vibrato do arquivo (5–15 cents)', s.oscilacao >= 5 && s.oscilacao <= 15, `${s.oscilacao?.toFixed?.(1)} cents`);
  // O arquivo tem vibrato de 5,5 Hz e ±12 cents.
  conferir('Vibrato do arquivo reconhecido (5,5 Hz, ±12 cents)',
    s.vibrato && Math.abs(s.vibrato.velocidadeHz - 5.5) < 0.6 && Math.abs(s.vibrato.amplitudeCents - 12) < 5,
    s.vibrato ? `${s.vibrato.velocidadeHz.toFixed(2)} Hz · ±${s.vibrato.amplitudeCents.toFixed(1)} cents em ${s.vibrato.notas} de ${s.vibrato.de}` : 'não reconheceu');
  // Guia com a própria voz: a nota acertada (o Lá4 do arquivo) foi gravada, e
  // a apresentação passa a usar a gravação no Lá4 e nas vizinhas — não longe.
  const guia = await pagina.evaluate(async () => {
    const banco = await import('/dados/banco.js');
    const sintese = await import('/audio/sintese.js');
    const motor = await import('/audio/motor.js');
    const vozes = await banco.lerVozes();
    const mapa = new Map(vozes.map((v) => [v.midi, v]));
    sintese.definirGravacoesDoGuia(mapa);
    await motor.acordarContexto();
    const fontes = {};
    for (const midi of [69, 70, 76]) {
      await sintese.apresentarNota(midi, { duracaoPiano: 0.1, duracaoVocal: 0.3 });
      fontes[midi] = sintese.ultimaFonteDoGuia();
    }
    sintese.definirGravacoesDoGuia(null);
    return { gravadas: vozes.map((v) => `${v.midi} (${v.desvioCents.toFixed(1)} cents, ${(v.pcm.length / v.taxa).toFixed(2)} s)`), fontes };
  });
  conferir('Guia: a nota acertada foi gravada e conferida', guia.gravadas.some((g) => g.startsWith('69 ')), guia.gravadas.join(' · ') || 'nada gravado');
  conferir('Guia: Lá4 e vizinha usam a própria voz; nota longe usa o tom sintético',
    guia.fontes[69] === 'propria-voz' && guia.fontes[70] === 'propria-voz' && guia.fontes[76] === 'sintetico', JSON.stringify(guia.fontes));

  // Cantar sem base com o mesmo Lá4 o tempo todo: a deriva tem que dar ~0.
  await pagina.goto(`${endereco}/index.html#/deriva`);
  await pagina.selectOption('#referencia', '69');
  await pagina.click('#comecar');
  await pagina.waitForSelector('#terminei', { timeout: 30000 });
  await pagina.waitForTimeout(3000);
  await pagina.click('#terminei');
  await pagina.waitForSelector('#de-novo', { timeout: 30000 });
  const deriva = await pagina.evaluate(() => ({
    numero: document.querySelector('.numero-grande').textContent,
    texto: document.querySelector('.chamada').textContent,
  }));
  conferir('Cantar sem base: mesma nota do começo ao fim dá deriva ~0', /^[0-4]\s/.test(deriva.numero) && deriva.texto.startsWith('Segurou'),
    `${deriva.numero} — ${deriva.texto}`);

  conferir('Nenhum erro de JavaScript na página', erros.length === 0, erros.join(' | '));
} catch (erro) {
  conferir('O ensaio chegou ao fim', false, String(erro));
} finally {
  await navegador.close();
  servidor.close();
}

console.log(falhas.length ? `\n${falhas.length} falha(s)` : '\ntudo certo');
process.exit(falhas.length ? 1 : 0);
