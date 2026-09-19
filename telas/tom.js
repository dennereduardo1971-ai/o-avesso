// "Em que tom eu canto esta música?" — a ferramenta de antes da gravação.
//
// Pede só duas notas: a mais grave e a mais aguda do trecho que vai ser
// cantado (pro vídeo curto é um trecho de 8 a 15 segundos, não a música
// inteira — e o trecho quase sempre cabe onde a música inteira não caberia).
// A conta mora em treino/tom.js; esta tela só pergunta e responde.

import { lerPerfil } from '../dados/banco.js';
import { rotuloDuplo, notasEntre } from '../audio/notas.js';
import { extensaoDoPerfil } from '../treino/voz.js';
import { sugerirTransposicao, descreverTransposicao, FOLGA_DO_TETO } from '../treino/tom.js';
import { tocarPiano, silenciar } from '../audio/sintese.js';
import { acordarContexto } from '../audio/motor.js';

const MIDI_MINIMO = 36; // Dó2
const MIDI_MAXIMO = 96; // Dó7

export async function montar(raiz) {
  const perfil = await lerPerfil();
  const extensao = extensaoDoPerfil(perfil);

  const opcoes = (selecionado) => notasEntre(MIDI_MINIMO, MIDI_MAXIMO)
    .map((m) => `<option value="${m}"${m === selecionado ? ' selected' : ''}>${rotuloDuplo(m)}</option>`)
    .join('');

  // Ponto de partida: uma oitava no meio da voz da pessoa, que é o formato
  // mais comum de refrão. Ela troca pelas notas da música.
  const centro = Math.round((extensao.midiMinimo + extensao.midiMaximo) / 2);

  raiz.innerHTML = `
    <section class="painel destaque-inicial">
      <h2>Tom da música</h2>
      <p class="progresso-texto">
        Diga a nota mais grave e a mais aguda do trecho que você vai cantar.
        O app acha o tom em que a nota mais alta fica ${FOLGA_DO_TETO} semitons
        abaixo do seu teto — firme, sem apertar.
      </p>
      <label class="campo">
        <span>Nota mais grave do trecho</span>
        <div class="linha">
          <select id="grave">${opcoes(centro - 6)}</select>
          <button type="button" class="botao" data-ouvir="grave" aria-label="Ouvir a nota mais grave">Ouvir</button>
        </div>
      </label>
      <label class="campo">
        <span>Nota mais aguda do trecho</span>
        <div class="linha">
          <select id="agudo">${opcoes(centro + 6)}</select>
          <button type="button" class="botao" data-ouvir="agudo" aria-label="Ouvir a nota mais aguda">Ouvir</button>
        </div>
      </label>
      <p class="progresso-texto">
        Não sabe as notas? Abra o <a href="#/afinador">afinador</a>, cante o
        ponto mais grave e o mais agudo do trecho e veja o nome.
      </p>
    </section>

    <section class="painel" id="resposta" aria-live="polite"></section>

    <section class="painel">
      <h2>Sua voz nesta conta</h2>
      <p class="progresso-texto">
        ${rotuloDuplo(extensao.midiMinimo)} a ${rotuloDuplo(extensao.midiMaximo)}${
          extensao.estimada
            ? ' — <strong>um palpite</strong>. Com o <a href="#/teste">teste inicial</a> a conta passa a usar a sua voz de verdade.'
            : ', medida no teste inicial.'}
      </p>
    </section>

    <a class="botao largo secundario" href="#/">Voltar</a>
  `;

  const elGrave = raiz.querySelector('#grave');
  const elAgudo = raiz.querySelector('#agudo');
  const elResposta = raiz.querySelector('#resposta');

  function responder() {
    const r = sugerirTransposicao({
      graveDaMusica: Number(elGrave.value),
      agudoDaMusica: Number(elAgudo.value),
      extensao,
    });
    const faixa = `${rotuloDuplo(r.grave)} a ${rotuloDuplo(r.agudo)}`;
    const conselho = r.semitons === 0
      ? ''
      : `<p class="progresso-texto">No karaokê, no app de base ou no teclado: tom <strong>${r.semitons > 0 ? '+' : ''}${r.semitons}</strong>.</p>`;

    if (r.cabe) {
      elResposta.innerHTML = `
        <h2>Resposta</h2>
        <p class="semaforo-titulo resposta-tom">${descreverTransposicao(r.semitons)}</p>
        <p class="chamada">O trecho fica entre ${faixa}.</p>
        ${conselho}
        <p class="progresso-texto">Sobram ${r.folgaNoAgudo} semitons até o seu teto no agudo.</p>`;
      return;
    }
    elResposta.innerHTML = `
      <h2>Resposta</h2>
      <p class="semaforo-titulo resposta-tom">Não cabe inteiro</p>
      <p class="chamada">
        O trecho tem ${r.larguraDaMusica} semitons, e a sua faixa confortável tem ${r.larguraConfortavel}.
      </p>
      <p class="progresso-texto">
        O melhor é proteger o agudo: <strong>${descreverTransposicao(r.semitons).toLowerCase()}</strong>
        e o grave fica ${r.faltamNoGrave} semiton${r.faltamNoGrave === 1 ? '' : 's'} abaixo do seu mais grave —
        vai sair mais soprado lá embaixo. Ou escolha um trecho menor.
      </p>
      ${conselho}`;
  }

  elGrave.addEventListener('change', responder);
  elAgudo.addEventListener('change', responder);
  raiz.querySelectorAll('[data-ouvir]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      await acordarContexto();
      const midi = Number((botao.dataset.ouvir === 'grave' ? elGrave : elAgudo).value);
      tocarPiano(midi, 1.2, 0.45);
    });
  });
  responder();

  return () => { silenciar(); };
}
