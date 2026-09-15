// A tela de entrada. Ela tem uma pergunta só a responder: o que fazer agora?
//
// Sem sequência de dias, sem "você faltou ontem", sem chama de ofensiva. O app
// não cobra presença — quem treina três vezes numa semana e nenhuma na outra
// continua chegando lá, e um app que reclama disso é um app que se desinstala.
// O que aparece aqui é o estado da sua voz e o próximo passo, e nada mais.

import { lerPerfil, ultimaSessao, salvarPerfil } from '../dados/banco.js';
import { rotuloDuplo, nomeDaNota } from '../audio/notas.js';
import { extensaoDoPerfil } from '../treino/voz.js';
import * as semMaos from '../ui/semmaos.js';
import { disponivel as falaDisponivel } from '../audio/fala.js';

const DIAS_ATE_RETESTE = 21;

function diasDesde(quando) {
  if (!quando) return null;
  return Math.floor((Date.now() - quando) / 86400000);
}

export async function montar(raiz) {
  const perfil = await lerPerfil();
  const extensao = extensaoDoPerfil(perfil);
  const ultima = await ultimaSessao();
  const diasDoTeste = diasDesde(perfil.diagnostico && perfil.diagnostico.feitoEm);
  const temTeste = !!perfil.diagnostico;

  raiz.innerHTML = `
    <section class="painel destaque-inicial">
      ${temTeste ? blocoTreinar() : blocoPrimeiraVez()}
    </section>

    <section class="painel">
      <h2>Sua voz</h2>
      ${blocoVoz(perfil, extensao, diasDoTeste)}
    </section>

    ${ultima ? `<section class="painel"><h2>Última sessão</h2>${blocoUltima(ultima)}</section>` : ''}

    <section class="painel">
      <h2>Ajustes</h2>
      <label class="opcao">
        <input type="checkbox" id="op-fala" ${perfil.preferencias.fala ? 'checked' : ''} ${falaDisponivel() ? '' : 'disabled'}>
        <span>Voz do treinador${falaDisponivel() ? '' : ' <em>(este aparelho não tem)</em>'}</span>
      </label>
      <label class="opcao">
        <input type="checkbox" id="op-semmaos" ${perfil.preferencias.semMaos ? 'checked' : ''}>
        <span>Modo sem mãos — letra grande e tela que não apaga</span>
      </label>
      <p class="progresso-texto">
        Tudo fica neste aparelho. Nenhum áudio e nenhum dado seu sai daqui.
      </p>
    </section>

    <section class="painel">
      <h2>Ferramentas</h2>
      <a class="botao largo" href="#/afinador">Afinador livre</a>
      <p class="progresso-texto">Só o medidor, sem exercício — pra conferir uma nota solta.</p>
    </section>
  `;

  function blocoPrimeiraVez() {
    return `
      <h2>Comece por aqui</h2>
      <p class="chamada">O app ainda não conhece a sua voz.</p>
      <p class="progresso-texto">
        O teste inicial leva uns quatro minutos: acha a sua nota mais grave, a mais
        aguda, e mede o quanto você erra hoje. Esse número vira o ponto zero — é
        contra ele que as próximas semanas vão ser comparadas.
      </p>
      <a class="botao botao-primario largo" href="#/teste">Fazer o teste inicial</a>
      <a class="botao largo secundario" href="#/treino">Pular e treinar assim mesmo</a>
    `;
  }

  function blocoTreinar() {
    const aviso =
      diasDoTeste !== null && diasDoTeste >= DIAS_ATE_RETESTE
        ? `<p class="aviso">Faz ${diasDoTeste} dias que você fez o teste. Vale refazer pra ver o que mudou.</p>`
        : '';
    return `
      <h2>Treinar agora</h2>
      <p class="chamada">Quanto tempo você tem hoje?</p>
      <div class="linha tempos">
        <a class="botao botao-primario" href="#/treino?minutos=5">5 min</a>
        <a class="botao botao-primario" href="#/treino?minutos=10">10 min</a>
        <a class="botao botao-primario" href="#/treino?minutos=20">20 min</a>
      </div>
      ${aviso}
      <a class="botao largo secundario" href="#/teste">Refazer o teste inicial</a>
    `;
  }

  function blocoVoz(perfil, extensao, dias) {
    if (!temTeste) {
      return `<p class="progresso-texto">
        Sem medida ainda — por enquanto o app trabalha com uma extensão de
        barítono (${rotuloDuplo(extensao.midiMinimo)} a ${rotuloDuplo(extensao.midiMaximo)}), que é o palpite
        mais provável. O teste troca o palpite pela sua voz de verdade.
      </p>`;
    }
    const erro = perfil.diagnostico.erroMedioCents;
    return `
      <dl class="medidas">
        <div><dt>Extensão</dt><dd>${rotuloDuplo(extensao.midiMinimo)} — ${rotuloDuplo(extensao.midiMaximo)}</dd></div>
        <div><dt>Erro médio no teste</dt><dd>${Math.round(erro)} cents</dd></div>
        <div><dt>Medido</dt><dd>${dias === 0 ? 'hoje' : `há ${dias} dia${dias === 1 ? '' : 's'}`}</dd></div>
      </dl>
    `;
  }

  function blocoUltima(sessao) {
    const dias = diasDesde(sessao.data);
    const quando = dias === 0 ? 'hoje' : dias === 1 ? 'ontem' : `há ${dias} dias`;
    const numero = Number.isFinite(sessao.erroMedioCents)
      ? `${Math.round(sessao.erroMedioCents)} cents de erro médio`
      : 'sem medida';
    const buraco = sessao.notaMaisFraca !== null && sessao.notaMaisFraca !== undefined
      ? ` Ponto fraco: ${nomeDaNota(sessao.notaMaisFraca)}.`
      : '';
    return `<p class="progresso-texto">${quando.charAt(0).toUpperCase()}${quando.slice(1)}, ${numero}.${buraco}</p>`;
  }

  const opFala = raiz.querySelector('#op-fala');
  const opSemMaos = raiz.querySelector('#op-semmaos');

  async function guardarPreferencias() {
    await salvarPerfil({
      preferencias: { fala: opFala.checked, semMaos: opSemMaos.checked },
    });
  }

  opFala.addEventListener('change', guardarPreferencias);
  opSemMaos.addEventListener('change', async () => {
    await semMaos.definir(opSemMaos.checked);
    await guardarPreferencias();
  });

  // O modo sem mãos é preferência guardada: se estava ligado, já entra ligado.
  await semMaos.definir(!!perfil.preferencias.semMaos);

  return () => {};
}
