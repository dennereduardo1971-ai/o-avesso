// O resumo de fim de sessão: um número e uma ordem.
//
// Um número — o erro médio em cents — porque é o único que significa a mesma
// coisa hoje e daqui a dois meses. Porcentagem de acerto não serve: ela sobe
// quando a tolerância afrouxa e desce quando aperta, então subir pode ser
// piora. Cents é régua fixa.
//
// E uma ordem, uma só: por qual nota começar da próxima vez. Uma lista de
// cinco recomendações no fim de um treino de dez minutos é uma lista que
// ninguém lê.

import { listarSessoes } from '../dados/banco.js';
import { nomeDaNota, rotuloDuplo } from '../audio/notas.js';
import { evolucaoDeErro } from '../treino/perfil.js';

function minutos(ms) {
  const total = Math.round((ms || 0) / 60000);
  return total <= 1 ? 'menos de um minuto' : `${total} minutos`;
}

export async function montar(raiz) {
  const sessoes = await listarSessoes({ limite: 30 });
  const sessao = sessoes[0];

  if (!sessao) {
    raiz.innerHTML = `
      <section class="painel">
        <h2>Nada pra mostrar ainda</h2>
        <p class="progresso-texto">Faça uma sessão e o resumo aparece aqui.</p>
        <a class="botao botao-primario largo" href="#/">Voltar ao início</a>
      </section>`;
    return () => {};
  }

  const ehTeste = sessao.tipo === 'diagnostico';
  const temNumero = Number.isFinite(sessao.erroMedioCents);
  const anterior = sessoes.slice(1).find((s) => Number.isFinite(s.erroMedioCents));

  raiz.innerHTML = `
    <section class="painel destaque-inicial">
      <h2>${ehTeste ? 'Teste inicial feito' : 'Sessão encerrada'}</h2>
      ${temNumero ? blocoNumero() : blocoSemNumero()}
      <p class="ordem">${ordemDoDia()}</p>
    </section>

    <section class="painel">
      <h2>O que aconteceu</h2>
      <dl class="medidas">
        <div><dt>Notas acertadas</dt><dd>${sessao.acertos ?? 0} de ${sessao.total ?? 0}</dd></div>
        ${sessao.forasDaNota ? `<div><dt>Saiu outra nota</dt><dd>${sessao.forasDaNota}×</dd></div>` : ''}
        <div><dt>Barra chegou em</dt><dd>±${sessao.toleranciaFinal ?? '—'} cents</dd></div>
        <div><dt>Duração</dt><dd>${minutos(sessao.duracaoMs)}</dd></div>
        ${sessao.extensao ? `<div><dt>Extensão medida</dt><dd>${rotuloDuplo(sessao.extensao.midiMinimo)} — ${rotuloDuplo(sessao.extensao.midiMaximo)}</dd></div>` : ''}
      </dl>
      ${blocoNotas()}
    </section>

    ${blocoHistorico()}

    <section class="painel">
      ${ehTeste
        ? '<a class="botao botao-primario largo" href="#/treino?minutos=10">Treinar agora, 10 minutos</a>'
        : '<a class="botao botao-primario largo" href="#/treino?minutos=10">Mais uma de 10 minutos</a>'}
      <a class="botao largo secundario" href="#/">Início</a>
    </section>
  `;

  function blocoNumero() {
    const erro = Math.round(sessao.erroMedioCents);
    let comparacao = '';
    if (anterior) {
      const diferenca = Math.round(anterior.erroMedioCents) - erro;
      if (Math.abs(diferenca) < 2) comparacao = 'igual à sessão anterior';
      else if (diferenca > 0) comparacao = `${diferenca} cents melhor que a anterior`;
      else comparacao = `${-diferenca} cents pior que a anterior`;
    }
    return `
      <p class="numero-grande">${erro}<span class="unidade"> cents</span></p>
      <p class="chamada">de erro médio${comparacao ? ` — ${comparacao}` : ''}</p>
    `;
  }

  function blocoSemNumero() {
    if (sessao.forasDaNota) {
      return `<p class="chamada">Sem erro médio hoje: as notas que saíram eram outras notas.</p>`;
    }
    return '<p class="chamada">Sessão curta demais pra medir.</p>';
  }

  // Uma ordem só, e ela tem que caber no que de fato aconteceu. A ordem errada
  // aqui é pior que ordem nenhuma: mandar cantar mais perto do celular quem
  // cantou alto a sessão inteira, só na oitava errada, ensina a coisa errada.
  function ordemDoDia() {
    const foras = sessao.forasDaNota || 0;
    const total = sessao.total || 0;

    // Errar a oitava não se corrige apertando a afinação; corrige-se esperando
    // o tom acabar e entrando na mesma altura dele.
    if (foras && foras >= total / 2) {
      return 'Você entrou em <strong>outra oitava</strong> na maior parte das notas. Ouça o tom até o fim e entre junto com ele, não antes.';
    }
    if (sessao.notaMaisFraca !== null && sessao.notaMaisFraca !== undefined) {
      return `Seu buraco é <strong>${nomeDaNota(sessao.notaMaisFraca)}</strong>. Amanhã começamos por ele.`;
    }
    if (foras) {
      return `Em ${foras === 1 ? 'uma nota' : `${foras} notas`} você foi parar em <strong>outra oitava</strong>. Repare onde o tom entra antes de entrar junto.`;
    }
    if (temNumero) return 'Nenhum buraco claro hoje. Na próxima a barra aperta.';
    return 'Da próxima vez, cante mais perto do celular — quase nada chegou aqui.';
  }

  function blocoNotas() {
    const tentativas = sessao.tentativas || [];
    if (!tentativas.length) return '';
    // Uma linha por nota, na ordem em que foram cantadas. É o mapa mais simples
    // que responde "onde eu errei" sem precisar de gráfico nenhum.
    const porNota = new Map();
    for (const t of tentativas) {
      const atual = porNota.get(t.midi) || { acertos: 0, total: 0, soma: 0, medidas: 0, foras: 0 };
      atual.total++;
      if (t.acertou) atual.acertos++;
      if (t.foraDaNota) atual.foras++;
      if (Number.isFinite(t.erroCents)) { atual.soma += Math.abs(t.erroCents); atual.medidas++; }
      porNota.set(t.midi, atual);
    }
    const linhas = [...porNota.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([midi, dados]) => {
        const media = dados.medidas ? Math.round(dados.soma / dados.medidas) : null;
        const classe = dados.acertos === dados.total ? 'boa' : dados.acertos === 0 ? 'ruim' : 'media';
        // Nota em que só saiu "outra nota" não tem erro em cents pra mostrar —
        // e mostrar 1200 ali só faria a linha parecer um erro de afinação
        // catastrófico, quando foi um erro de outra natureza.
        const valor = media === null ? 'outra nota' : `${media} cents`;
        const largura = media === null ? 100 : Math.min(100, media);
        return `<li class="linha-nota ${classe}">
          <span class="nome">${rotuloDuplo(midi)}</span>
          <span class="barra" style="--erro:${largura}%"></span>
          <span class="valor">${valor}</span>
        </li>`;
      })
      .join('');
    return `<ul class="mapa-notas">${linhas}</ul>`;
  }

  function blocoHistorico() {
    const evolucao = evolucaoDeErro(sessoes).slice(-8);
    if (evolucao.length < 2) return '';
    const maior = Math.max(...evolucao.map((e) => e.erroMedioCents));
    const barras = evolucao
      .map((e) => {
        const altura = Math.max(4, Math.round((e.erroMedioCents / maior) * 100));
        const dia = new Date(e.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        return `<li title="${Math.round(e.erroMedioCents)} cents">
          <span class="coluna" style="height:${altura}%"></span>
          <span class="rotulo">${dia}</span>
        </li>`;
      })
      .join('');
    return `
      <section class="painel">
        <h2>Erro médio, sessão a sessão</h2>
        <ul class="grafico-colunas">${barras}</ul>
        <p class="progresso-texto">Menor é melhor. O que importa é a linha descer ao longo das semanas, não de um dia pro outro.</p>
      </section>`;
  }

  return () => {};
}
