// "Cantar sem base": quanto o tom escorrega num trecho à capela.
//
// Três passos: sustentar a nota que o app toca (a âncora), cantar o trecho sem
// base e sem nada na tela, e no fim cantar de memória a nota do começo. Nada
// de linha nem de ponteiro durante o canto — qualquer retorno ali corrigiria a
// deriva que se quer medir. A conta mora em treino/deriva.js.

import { ligarEscuta, desligarEscuta, aoDetectar, definirFaixaDeVoz, acordarContexto } from '../audio/motor.js';
import { apresentarNota, silenciar } from '../audio/sintese.js';
import { centsAteAlvo, rotuloDuplo, notasEntre } from '../audio/notas.js';
import { lerPerfil, gravarSessao } from '../dados/banco.js';
import { extensaoDoPerfil, tessituraDe } from '../treino/voz.js';
import { avaliarDeriva, dobrarOitava, mediana } from '../treino/deriva.js';
import * as semMaos from '../ui/semmaos.js';

const CLAREZA_MINIMA = 0.6;
const SEGURAR_MS = 1500;       // voz firme necessária pra valer a medida
const DESISTIR_MS = 15000;     // sem voz por tanto tempo, a medida falha

export async function montar(raiz) {
  const perfil = await lerPerfil();
  const extensao = extensaoDoPerfil(perfil);
  const tessitura = tessituraDe(extensao);
  const semMaosAntes = !!perfil.preferencias.semMaos;

  let cancelado = false;
  let desinscrever = null;
  let referencia = Math.round((tessitura.midiMinimo + tessitura.midiMaximo) / 2);
  let inicioCents = null;
  let comecouACantar = 0;

  function limpar() {
    if (desinscrever) { desinscrever(); desinscrever = null; }
    silenciar();
    desligarEscuta();
  }

  // Espera a pessoa segurar a nota por 1,5 s e devolve a mediana do desvio em
  // cents (dobrado pra dentro da oitava). Só mostra quanto falta — nunca onde
  // a voz está.
  function medirNotaSegurada(barra) {
    return new Promise((resolver) => {
      const leituras = [];
      let ultimo = 0;
      let firme = 0;
      const comeco = performance.now();
      const vigia = setInterval(() => {
        if (cancelado || performance.now() - comeco > DESISTIR_MS) { terminar(null); }
      }, 250);

      function terminar(valor) {
        clearInterval(vigia);
        if (desinscrever) { desinscrever(); desinscrever = null; }
        resolver(valor);
      }

      desinscrever = aoDetectar((leitura) => {
        const agora = leitura.tempo ?? performance.now();
        const boa = leitura.frequencia > 0 && leitura.clareza >= CLAREZA_MINIMA;
        const dt = ultimo ? Math.min(agora - ultimo, 120) : 0;
        ultimo = agora;
        if (!boa) return;
        firme += dt;
        leituras.push(dobrarOitava(centsAteAlvo(leitura.frequencia, referencia)));
        if (barra) barra.style.width = `${Math.min(100, (firme / SEGURAR_MS) * 100)}%`;
        // a entrada da nota fica de fora: só o último 1 s de voz firme conta
        if (firme >= SEGURAR_MS) terminar(mediana(leituras.slice(-Math.round(leituras.length * 0.66))));
      });
    });
  }

  function mostrarIntro() {
    const opcoes = notasEntre(tessitura.midiMinimo, tessitura.midiMaximo)
      .map((m) => `<option value="${m}"${m === referencia ? ' selected' : ''}>${rotuloDuplo(m)}</option>`)
      .join('');
    raiz.innerHTML = `
      <section class="painel destaque-inicial">
        <h2>Cantar sem base</h2>
        <p class="chamada">Quanto o seu tom escorrega num trecho à capela?</p>
        <ol class="lista-etapas">
          <li><strong>Âncora.</strong> O app toca uma nota; você segura.</li>
          <li><strong>O trecho.</strong> Cante sem base, do jeito que gravaria. A tela não mostra nada.</li>
          <li><strong>De volta.</strong> Cante de memória a nota do começo.</li>
        </ol>
        <label class="campo">
          <span>Nota de referência — de preferência a primeira nota ou a tônica do trecho</span>
          <select id="referencia">${opcoes}</select>
        </label>
        <p class="progresso-texto">
          Todo mundo deriva um pouco: numa pesquisa com 24 cantores a mediana foi
          11 cents em uns 50 segundos, e a experiência de quem cantava não
          mudava isso.
        </p>
        <button id="comecar" class="botao botao-primario largo">Começar</button>
        <p id="aviso" class="aviso" hidden></p>
        <a class="botao largo secundario" href="#/">Voltar</a>
      </section>`;
    raiz.querySelector('#referencia').addEventListener('change', (e) => { referencia = Number(e.target.value); });
    raiz.querySelector('#comecar').addEventListener('click', comecar);
  }

  function telaDeMedida(titulo, instrucao) {
    raiz.innerHTML = `
      <section class="painel aquecimento">
        <h2 class="etapa-titulo">${titulo}</h2>
        <p class="etapa-instrucao">${instrucao}</p>
        <div class="barra-progresso"><div id="barra" class="barra-preenchimento"></div></div>
      </section>`;
    return raiz.querySelector('#barra');
  }

  async function comecar() {
    await acordarContexto();
    const resultado = await ligarEscuta();
    const aviso = raiz.querySelector('#aviso');
    if (!resultado.ok) { aviso.textContent = resultado.motivo; aviso.hidden = false; return; }
    definirFaixaDeVoz(extensao.midiMinimo, extensao.midiMaximo);
    await semMaos.ativar();

    const barra = telaDeMedida('Âncora', `Ouça ${rotuloDuplo(referencia)} e segure.`);
    await apresentarNota(referencia);
    if (cancelado) return;
    inicioCents = await medirNotaSegurada(barra);
    if (cancelado) return;
    if (inicioCents === null) { falhou('Não ouvi a nota da âncora. Cante mais perto do celular e tente de novo.'); return; }
    mostrarTrecho();
  }

  function mostrarTrecho() {
    comecouACantar = Date.now();
    raiz.innerHTML = `
      <section class="painel aquecimento">
        <h2 class="etapa-titulo">Agora o trecho</h2>
        <p id="relogio" class="numero-grande contagem">0:00</p>
        <p class="etapa-instrucao">Sem base, sem olhar a tela. Quando acabar, toque em "Terminei".</p>
        <button id="terminei" class="botao botao-primario largo">Terminei</button>
      </section>`;
    const relogio = raiz.querySelector('#relogio');
    const laco = setInterval(() => {
      if (cancelado) { clearInterval(laco); return; }
      const s = Math.floor((Date.now() - comecouACantar) / 1000);
      relogio.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    }, 500);
    raiz.querySelector('#terminei').addEventListener('click', async () => {
      clearInterval(laco);
      const duracaoMs = Date.now() - comecouACantar;
      const barra = telaDeMedida('De volta', 'Cante de memória a nota do começo e segure. Sem ouvir de novo.');
      const fimCents = await medirNotaSegurada(barra);
      if (cancelado) return;
      if (fimCents === null) { falhou('Não ouvi a nota do fim. Tente de novo — a âncora é rápida.'); return; }
      await mostrarResultado(avaliarDeriva({ inicioCents, fimCents, duracaoMs }), duracaoMs);
    });
  }

  async function mostrarResultado(r, duracaoMs) {
    limpar();
    await semMaos.definir(semMaosAntes);
    await gravarSessao({
      tipo: 'deriva',
      referencia,
      inicioCents,
      derivaCents: r.derivaCents,
      duracaoMs,
    });
    const n = Math.round(Math.abs(r.derivaCents));
    const segundos = Math.round(duracaoMs / 1000);
    raiz.innerHTML = `
      <section class="painel destaque-inicial">
        <h2>Cantar sem base</h2>
        <p class="numero-grande">${n}<span class="unidade"> cents</span></p>
        <p class="chamada">${r.texto}${r.lado === 'nenhum' ? '' : ` — pra ${r.lado === 'acima' ? 'cima' : 'baixo'}`}, em ${segundos} segundos.</p>
        <p class="progresso-texto">${conselho(r)}</p>
        <button id="de-novo" class="botao botao-primario largo">De novo</button>
        <a class="botao largo secundario" href="#/">Início</a>
      </section>`;
    raiz.querySelector('#de-novo').addEventListener('click', () => { mostrarIntro(); });
  }

  function conselho(r) {
    if (r.nivel === 'segurou') return 'Dá pra gravar sem base com tranquilidade.';
    // A pesquisa mede quanto deriva, não por quê — então o conselho é o que dá
    // pra fazer com o número, não um diagnóstico da causa.
    if (r.nivel === 'perceptivel') {
      return 'Pra gravar este trecho, use uma base ou pelo menos um acorde de referência no começo de cada parte. E repita o teste: se o lado se repetir, é padrão, não acaso.';
    }
    return 'Repita o teste mais duas vezes. Se a deriva for sempre pro mesmo lado, é um padrão seu — e padrão se corrige mirando de leve pro lado oposto nas notas longas.';
  }

  function falhou(texto) {
    limpar();
    semMaos.definir(semMaosAntes);
    mostrarIntro();
    const aviso = raiz.querySelector('#aviso');
    aviso.textContent = texto;
    aviso.hidden = false;
  }

  mostrarIntro();

  return async () => {
    cancelado = true;
    limpar();
    await semMaos.definir(semMaosAntes);
  };
}
