// Roteamento por hash — o suficiente pra ter telas de verdade sem framework.
//
// Cada tela é um módulo com uma função `montar(raiz, parametros)` que devolve
// uma função de desmontar. O roteador garante que a de sair rode antes da de
// entrar: exercício é coisa que faz barulho e segura o microfone, e uma tela
// que sai sem se desmontar deixa o app cantando sozinho na tela seguinte.
//
// Hash e não History API porque o app é servido de um subcaminho no GitHub
// Pages e é instalável como PWA: com hash, recarregar em qualquer tela
// funciona sem precisar de nada configurado no servidor.

export function criarRoteador({ raiz, rotas, padrao = '#/' }) {
  // O que toda tela recebe além da raiz e dos parâmetros: por enquanto só o
  // `ir`, que é como uma tela manda ir pra outra sem escrever no location à mão.
  const contexto = { ir: (hash) => api.ir(hash) };
  let desmontarAtual = null;
  let caminhoAtual = null;
  let hashAtual = null;
  let trocando = false;

  function separar(hash) {
    const limpo = (hash || padrao).replace(/^#/, '') || '/';
    const [caminho, consulta] = limpo.split('?');
    const parametros = Object.fromEntries(new URLSearchParams(consulta || ''));
    return { caminho: caminho.startsWith('/') ? caminho : `/${caminho}`, parametros };
  }

  async function aplicar({ forcar = false } = {}) {
    if (trocando) return;
    const hash = window.location.hash || padrao;
    const { caminho, parametros } = separar(hash);
    // Compara o hash inteiro, e não só o caminho: `#/treino?minutos=20` é
    // outra sessão que `#/treino?minutos=5`, e tem que remontar.
    if (!forcar && hash === hashAtual) return;

    trocando = true;
    hashAtual = hash;
    try {
      if (desmontarAtual) {
        try { await desmontarAtual(); } catch (erro) { console.error('desmontar falhou', erro); }
        desmontarAtual = null;
      }

      const rota = rotas[caminho] || rotas['/'];
      caminhoAtual = caminho;
      raiz.replaceChildren();
      raiz.scrollTop = 0;
      window.scrollTo(0, 0);
      document.body.dataset.tela = caminho.replace(/\//g, '') || 'inicio';

      desmontarAtual = (await rota(raiz, parametros, contexto)) || null;
    } catch (erro) {
      console.error('tela falhou ao montar', erro);
      raiz.innerHTML = `
        <section class="painel">
          <h2>Deu ruim nesta tela</h2>
          <p class="progresso-texto">${String(erro && erro.message ? erro.message : erro)}</p>
          <a class="botao" href="#/">Voltar ao início</a>
        </section>`;
    } finally {
      trocando = false;
    }
  }

  const api = {
    iniciar() {
      window.addEventListener('hashchange', () => aplicar());
      if (!window.location.hash) window.location.hash = padrao;
      else aplicar();
    },
    // Ir pra tela em que já se está remonta de propósito: é assim que
    // "treinar de novo" começa uma sessão nova em vez de não fazer nada.
    ir(hash) {
      if (window.location.hash === hash) aplicar({ forcar: true });
      else window.location.hash = hash;
    },
    get caminho() { return caminhoAtual; },
  };

  return api;
}
