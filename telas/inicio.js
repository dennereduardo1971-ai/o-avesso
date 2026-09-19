// A tela de entrada. Ela tem uma pergunta só a responder: o que fazer agora?
//
// Sem sequência de dias, sem "você faltou ontem", sem chama de ofensiva. O app
// não cobra presença — quem treina três vezes numa semana e nenhuma na outra
// continua chegando lá, e um app que reclama disso é um app que se desinstala.
// O que aparece aqui é o estado da sua voz e o próximo passo, e nada mais.

import { lerPerfil, ultimaSessao, salvarPerfil, TIPOS_DE_TREINO, exportarTudo, importarTudo, lerVozes, apagarVozes } from '../dados/banco.js';
import { rotuloDuplo, nomeDaNota } from '../audio/notas.js';
import { extensaoDoPerfil, vozDoPerfil, VOZES } from '../treino/voz.js';
import * as semMaos from '../ui/semmaos.js';
import { disponivel as falaDisponivel } from '../audio/fala.js';
import { MODOS_DE_RETORNO } from '../treino/retorno.js';

const DIAS_ATE_RETESTE = 21;

function diasDesde(quando) {
  if (!quando) return null;
  return Math.floor((Date.now() - quando) / 86400000);
}

export async function montar(raiz) {
  const perfil = await lerPerfil();
  const extensao = extensaoDoPerfil(perfil);
  const ultima = await ultimaSessao(TIPOS_DE_TREINO);
  const ultimoCheckin = await ultimaSessao('checkin');
  const vozesGravadas = (await lerVozes()).length;
  const diasDoTeste = diasDesde(perfil.diagnostico && perfil.diagnostico.feitoEm);
  const temTeste = !!perfil.diagnostico;

  raiz.innerHTML = `
    <section class="painel">
      <h2>Cuidar da voz</h2>
      ${blocoCheckin(ultimoCheckin)}
      <a class="botao botao-primario largo" href="#/checkin?fluxo=completo">Sessão completa · uns 15 min</a>
      <p class="progresso-texto">Check-in, aquecimento e treino, nessa ordem. O check-in decide o tamanho de cada parte.</p>
      <a class="botao largo" href="#/checkin">Como está a voz hoje?</a>
      <div class="linha tempos">
        <a class="botao" href="#/aquecimento?rotina=curta">Aquecer 5 min</a>
        <a class="botao" href="#/aquecimento?rotina=longa">Aquecer 10 min</a>
      </div>
      <a class="botao largo secundario" href="#/aquecimento?rotina=desaquecer">Desaquecer depois de cantar</a>
    </section>

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
      <p class="chamada">Sua voz é…</p>
      <div class="escolha" role="group" aria-label="Tipo de voz">
        ${Object.values(VOZES).map((v) => `
          <button type="button" class="escolha-botao${v.id === vozDoPerfil(perfil) ? ' marcado' : ''}"
            data-voz="${v.id}" aria-pressed="${v.id === vozDoPerfil(perfil)}">${v.nome}</button>`).join('')}
      </div>
      <label class="opcao">
        <input type="checkbox" id="op-fala" ${perfil.preferencias.fala ? 'checked' : ''} ${falaDisponivel() ? '' : 'disabled'}>
        <span>Voz do treinador${falaDisponivel() ? '' : ' <em>(este aparelho não tem)</em>'}</span>
      </label>
      <label class="opcao">
        <input type="checkbox" id="op-semmaos" ${perfil.preferencias.semMaos ? 'checked' : ''}>
        <span>Modo sem mãos — letra grande e tela que não apaga</span>
      </label>
      <label class="opcao">
        <input type="checkbox" id="op-experiente" ${perfil.preferencias.nivel === 'experiente' ? 'checked' : ''}>
        <span>Já canto bem — a barra aperta até ±10 cents, não só até ±20</span>
      </label>
      <label class="opcao">
        <input type="checkbox" id="op-guia" ${perfil.preferencias.guiaPropriaVoz ? 'checked' : ''}>
        <span>Guia com a sua própria voz — o app grava as notas que você acerta e usa como referência
          <em>(${vozesGravadas ? `${vozesGravadas} nota${vozesGravadas === 1 ? '' : 's'} gravada${vozesGravadas === 1 ? '' : 's'}` : 'nenhuma nota ainda'}; fica só neste aparelho)</em></span>
      </label>
      ${vozesGravadas ? '<button id="apagar-vozes" class="botao largo secundario">Apagar as gravações da minha voz</button>' : ''}
      <label class="campo">
        <span>A linha da voz enquanto você canta</span>
        <select id="op-retorno">
          ${Object.entries(MODOS_DE_RETORNO).map(([id, texto]) =>
            `<option value="${id}"${(perfil.preferencias.retorno || 'auto') === id ? ' selected' : ''}>${texto}</option>`).join('')}
        </select>
      </label>
      <p class="progresso-texto">
        Tudo fica neste aparelho. Nenhum áudio e nenhum dado seu sai daqui.
      </p>
    </section>

    <section class="painel">
      <h2>Cópia de segurança</h2>
      <p class="progresso-texto">
        Seus dados moram só neste aparelho. Uma cópia salva é o que os traz de
        volta se o celular for trocado ou o navegador limpar a memória.
      </p>
      <button id="exportar" class="botao largo">Salvar uma cópia</button>
      <label class="botao largo secundario rotulo-arquivo">
        Restaurar de uma cópia
        <input id="importar" type="file" accept="application/json,.json" hidden>
      </label>
      <p id="copia-status" class="progresso-texto" role="status"></p>
    </section>

    <section class="painel">
      <h2>Ferramentas</h2>
      <a class="botao largo" href="#/tom">Tom da música</a>
      <p class="progresso-texto">Quantos semitons subir ou descer pra um trecho caber firme na sua voz.</p>
      <a class="botao largo" href="#/deriva">Cantar sem base</a>
      <p class="progresso-texto">Quanto o seu tom escorrega num trecho à capela.</p>
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
        Sem medida ainda — por enquanto o app trabalha com o palpite de uma voz
        ${VOZES[vozDoPerfil(perfil)].nome} (${rotuloDuplo(extensao.midiMinimo)} a ${rotuloDuplo(extensao.midiMaximo)}).
        O teste troca o palpite pela sua voz de verdade.
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

  // Só mostra o último check-in se for recente: o de semana passada não diz
  // nada sobre a voz de hoje.
  function blocoCheckin(sessao) {
    const dias = sessao ? diasDesde(sessao.data) : null;
    if (dias === null || dias > 2) return '';
    const quando = dias === 0 ? 'Hoje' : dias === 1 ? 'Ontem' : 'Anteontem';
    const texto = { verde: 'voz pronta', amarelo: 'cantar leve', vermelho: 'dia de descanso' }[sessao.nivel] || '';
    return `<p class="progresso-texto"><span class="ponto ${sessao.nivel}"></span>${quando}: ${texto}.</p>`;
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

  raiz.querySelector('#op-experiente').addEventListener('change', async (evento) => {
    await salvarPerfil({ preferencias: { nivel: evento.target.checked ? 'experiente' : 'padrao' } });
  });
  raiz.querySelector('#op-guia').addEventListener('change', async (evento) => {
    await salvarPerfil({ preferencias: { guiaPropriaVoz: evento.target.checked } });
  });
  const botaoApagarVozes = raiz.querySelector('#apagar-vozes');
  if (botaoApagarVozes) {
    botaoApagarVozes.addEventListener('click', async () => {
      if (!window.confirm('Apagar todas as gravações da sua voz? O guia volta a ser o tom sintético até você acertar notas de novo.')) return;
      await apagarVozes();
      montar(raiz);
    });
  }
  raiz.querySelector('#op-retorno').addEventListener('change', async (evento) => {
    await salvarPerfil({ preferencias: { retorno: evento.target.value } });
  });

  // Trocar o tipo de voz só muda o palpite de quem ainda não fez o teste — por
  // isso remonta a tela: o texto de "Sua voz" tem que acompanhar na hora.
  raiz.querySelectorAll('[data-voz]').forEach((botao) => {
    botao.addEventListener('click', async () => {
      await salvarPerfil({ preferencias: { voz: botao.dataset.voz } });
      montar(raiz);
    });
  });
  opSemMaos.addEventListener('change', async () => {
    await semMaos.definir(opSemMaos.checked);
    await guardarPreferencias();
  });

  const elCopia = raiz.querySelector('#copia-status');

  raiz.querySelector('#exportar').addEventListener('click', async () => {
    const copia = await exportarTudo();
    const dia = new Date().toISOString().slice(0, 10);
    const arquivo = new Blob([JSON.stringify(copia, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(arquivo);
    link.download = `afinado-copia-${dia}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    elCopia.textContent = `Cópia salva com ${copia.sessoes.length} sessões.`;
  });

  raiz.querySelector('#importar').addEventListener('change', async (evento) => {
    const arquivo = evento.target.files && evento.target.files[0];
    evento.target.value = '';
    if (!arquivo) return;
    let copia;
    try {
      copia = JSON.parse(await arquivo.text());
    } catch {
      elCopia.textContent = 'Não consegui ler esse arquivo.';
      return;
    }
    const n = Array.isArray(copia && copia.sessoes) ? copia.sessoes.length : 0;
    if (!window.confirm(`Restaurar esta cópia (${n} sessões)? O que está neste aparelho agora será substituído.`)) return;
    try {
      const resultado = await importarTudo(copia);
      elCopia.textContent = `Restaurado: ${resultado.sessoes} sessões.`;
      montar(raiz);
    } catch (erro) {
      elCopia.textContent = erro.message;
    }
  });

  // O modo sem mãos é preferência guardada: se estava ligado, já entra ligado.
  await semMaos.definir(!!perfil.preferencias.semMaos);

  return () => {};
}
