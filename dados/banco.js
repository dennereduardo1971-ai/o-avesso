// Tudo que o app sabe sobre você mora aqui, e aqui é o seu aparelho.
//
// Não há conta, não há servidor, não há sincronização. A extensão que você
// mediu, as notas em que você erra e o histórico das sessões ficam num
// IndexedDB local — se você limpar os dados do navegador, some. Isso é o
// preço de não ter cadastro, e é um preço que vale: o app é de graça, funciona
// offline e nenhuma gravação sua sai do aparelho. (A Fase 4 acrescenta
// exportar/importar num arquivo, que é o jeito honesto de fazer backup sem
// servidor.)

const NOME_BANCO = 'afinado';
const VERSAO_BANCO = 1;
const CHAVE_PERFIL = 'eu';
const CHAVE_LOCAL = 'afinado:perfil';

let promessaDeAbertura = null;
let semIndexedDb = false;

// Se o IndexedDB não abrir — navegação privada em alguns navegadores, política
// de armazenamento, cota — o app não pode simplesmente parar: ele continua com
// o perfil na memória, e tenta salvar no localStorage pra pelo menos
// sobreviver a um recarregamento.
const memoria = { perfil: null, sessoes: [] };

export function perfilPadrao() {
  const agora = Date.now();
  return {
    id: CHAVE_PERFIL,
    criadoEm: agora,
    atualizadoEm: agora,
    // extensão medida no teste inicial; null enquanto não há teste
    extensao: null,
    // ponto zero do gráfico de progresso
    diagnostico: null,
    // onde a tolerância adaptativa parou na última sessão
    tolerancia: 50,
    // estatística por nota: { tentativas, acertos, somaErroAbs, ultimoEm }
    notas: {},
    preferencias: { fala: true, semMaos: false, notacao: 'dupla' },
  };
}

function abrir() {
  if (semIndexedDb) return Promise.reject(new Error('sem IndexedDB'));
  if (promessaDeAbertura) return promessaDeAbertura;

  promessaDeAbertura = new Promise((resolver, rejeitar) => {
    if (typeof indexedDB === 'undefined') {
      semIndexedDb = true;
      rejeitar(new Error('sem IndexedDB'));
      return;
    }
    let pedido;
    try {
      pedido = indexedDB.open(NOME_BANCO, VERSAO_BANCO);
    } catch (erro) {
      semIndexedDb = true;
      rejeitar(erro);
      return;
    }
    pedido.onupgradeneeded = () => {
      const banco = pedido.result;
      if (!banco.objectStoreNames.contains('perfil')) {
        banco.createObjectStore('perfil', { keyPath: 'id' });
      }
      if (!banco.objectStoreNames.contains('sessoes')) {
        const sessoes = banco.createObjectStore('sessoes', { keyPath: 'id', autoIncrement: true });
        sessoes.createIndex('data', 'data');
      }
    };
    pedido.onsuccess = () => resolver(pedido.result);
    pedido.onerror = () => { semIndexedDb = true; rejeitar(pedido.error); };
    pedido.onblocked = () => rejeitar(new Error('banco bloqueado por outra aba'));
  }).catch((erro) => {
    semIndexedDb = true;
    throw erro;
  });

  return promessaDeAbertura;
}

function transacionar(loja, modo, tarefa) {
  return abrir().then(
    (banco) =>
      new Promise((resolver, rejeitar) => {
        const transacao = banco.transaction(loja, modo);
        const pedido = tarefa(transacao.objectStore(loja));
        transacao.oncomplete = () => resolver(pedido ? pedido.result : undefined);
        transacao.onerror = () => rejeitar(transacao.error);
        transacao.onabort = () => rejeitar(transacao.error);
      })
  );
}

// --- perfil ------------------------------------------------------------

function lerPerfilLocal() {
  try {
    const bruto = localStorage.getItem(CHAVE_LOCAL);
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function salvarPerfilLocal(perfil) {
  try {
    localStorage.setItem(CHAVE_LOCAL, JSON.stringify(perfil));
  } catch { /* cota cheia ou armazenamento bloqueado: paciência */ }
}

export async function lerPerfil() {
  try {
    const guardado = await transacionar('perfil', 'readonly', (loja) => loja.get(CHAVE_PERFIL));
    if (guardado) return { ...perfilPadrao(), ...guardado };
  } catch { /* cai no plano B */ }

  if (!memoria.perfil) memoria.perfil = lerPerfilLocal() || perfilPadrao();
  return { ...perfilPadrao(), ...memoria.perfil };
}

// Mescla um pedaço por cima do perfil guardado. Mesclar em vez de substituir
// evita a classe de bug mais chata aqui: uma tela salvar o que sabe e apagar
// sem querer o que ela não sabe.
export async function salvarPerfil(parcial) {
  const atual = await lerPerfil();
  const novo = {
    ...atual,
    ...parcial,
    id: CHAVE_PERFIL,
    atualizadoEm: Date.now(),
    preferencias: { ...atual.preferencias, ...(parcial.preferencias || {}) },
    notas: parcial.notas ? { ...atual.notas, ...parcial.notas } : atual.notas,
  };

  memoria.perfil = novo;
  salvarPerfilLocal(novo);
  try {
    await transacionar('perfil', 'readwrite', (loja) => loja.put(novo));
  } catch { /* já está na memória e no localStorage */ }
  return novo;
}

// --- sessões -----------------------------------------------------------

export async function gravarSessao(sessao) {
  const registro = { data: Date.now(), ...sessao };
  try {
    return await transacionar('sessoes', 'readwrite', (loja) => loja.add(registro));
  } catch {
    memoria.sessoes.push({ id: memoria.sessoes.length + 1, ...registro });
    return registro.data;
  }
}

export async function listarSessoes({ limite = 50 } = {}) {
  try {
    const banco = await abrir();
    return await new Promise((resolver, rejeitar) => {
      const transacao = banco.transaction('sessoes', 'readonly');
      const indice = transacao.objectStore('sessoes').index('data');
      const encontradas = [];
      // 'prev' porque o que interessa na tela é sempre o mais recente
      const cursor = indice.openCursor(null, 'prev');
      cursor.onsuccess = () => {
        const atual = cursor.result;
        if (!atual || encontradas.length >= limite) { resolver(encontradas); return; }
        encontradas.push(atual.value);
        atual.continue();
      };
      cursor.onerror = () => rejeitar(cursor.error);
    });
  } catch {
    return [...memoria.sessoes].sort((a, b) => b.data - a.data).slice(0, limite);
  }
}

export async function ultimaSessao(tipo) {
  const sessoes = await listarSessoes({ limite: 30 });
  return sessoes.find((s) => !tipo || s.tipo === tipo) || null;
}

export async function apagarTudo() {
  memoria.perfil = null;
  memoria.sessoes = [];
  try { localStorage.removeItem(CHAVE_LOCAL); } catch { /* nada a remover */ }
  try {
    await transacionar('perfil', 'readwrite', (loja) => loja.clear());
    await transacionar('sessoes', 'readwrite', (loja) => loja.clear());
  } catch { /* não havia banco */ }
}

export function guardaConfiavel() {
  return !semIndexedDb;
}
