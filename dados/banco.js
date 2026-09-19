// Tudo que o app sabe sobre você mora aqui, e aqui é o seu aparelho.
//
// Não há conta, não há servidor, não há sincronização. A extensão que você
// mediu, as notas em que você erra e o histórico das sessões ficam num
// IndexedDB local — se você limpar os dados do navegador, some. Isso é o
// preço de não ter cadastro, e é um preço que vale: o app é de graça, funciona
// offline e nenhuma gravação sua sai do aparelho. O backup é um arquivo que a
// própria pessoa salva e restaura (`exportarTudo` / `importarTudo`) — o jeito
// honesto de fazer backup sem servidor.

const NOME_BANCO = 'afinado';
// Versão 2 acrescenta a loja 'vozes' (o guia com a própria voz). A migração só
// CRIA o que falta — perfil e sessões de quem já usa o app passam intactos.
const VERSAO_BANCO = 2;
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
      if (!banco.objectStoreNames.contains('vozes')) {
        banco.createObjectStore('vozes', { keyPath: 'midi' });
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
//
// E as gravações vão em FILA. Mesclar é ler-e-depois-escrever: duas gravações
// ao mesmo tempo liam o mesmo perfil antigo, e a segunda apagava o que a
// primeira tinha acabado de salvar (marcar "já canto bem" e trocar o modo da
// linha em seguida perdia o nível). Com a fila, cada uma lê o que a anterior
// escreveu.
let filaDeGravacao = Promise.resolve();

export function salvarPerfil(parcial) {
  const vez = filaDeGravacao.then(() => gravarPerfilAgora(parcial));
  // a fila segue mesmo se uma gravação falhar
  filaDeGravacao = vez.catch(() => {});
  return vez;
}

async function gravarPerfilAgora(parcial) {
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

// Afinação e teste são sessões de treino; aquecimento e check-in moram na
// mesma loja mas não são treino — quem mostra "última sessão" ou resumo filtra
// por estes tipos, senão um check-in apareceria como treino sem medida.
export const TIPOS_DE_TREINO = ['afinacao', 'diagnostico'];

// `tipo` pode ser um tipo só ou uma lista deles.
export async function ultimaSessao(tipo) {
  const aceitos = tipo ? [].concat(tipo) : null;
  const sessoes = await listarSessoes({ limite: 30 });
  return sessoes.find((s) => !aceitos || aceitos.includes(s.tipo)) || null;
}

// --- a própria voz (guia) ----------------------------------------------
//
// Uma gravação por nota: a melhor que a pessoa já cantou. Fica FORA da cópia
// de segurança (é áudio, e pesado) e fora do `apagarTudo` — restaurar uma
// cópia não deve apagar as gravações que estão aqui.

export async function lerVozes() {
  try {
    return await transacionar('vozes', 'readonly', (loja) => loja.getAll());
  } catch {
    return [];
  }
}

export async function guardarVoz(registro) {
  try {
    await transacionar('vozes', 'readwrite', (loja) => loja.put(registro));
    return true;
  } catch {
    return false;
  }
}

export async function apagarVozes() {
  try { await transacionar('vozes', 'readwrite', (loja) => loja.clear()); } catch { /* não havia */ }
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

// --- cópia de segurança -------------------------------------------------

const FORMATO_DA_COPIA = 'afinado-copia';
const VERSAO_DA_COPIA = 1;

export async function exportarTudo() {
  return {
    formato: FORMATO_DA_COPIA,
    versao: VERSAO_DA_COPIA,
    exportadoEm: new Date().toISOString(),
    perfil: await lerPerfil(),
    sessoes: await listarSessoes({ limite: Infinity }),
  };
}

// Confere a cópia inteira antes de apagar qualquer coisa: um arquivo errado
// escolhido por engano não pode custar o histórico que já estava aqui.
export function validarCopia(copia) {
  if (!copia || typeof copia !== 'object') return 'Esse arquivo não é uma cópia do Afinado.';
  if (copia.formato !== FORMATO_DA_COPIA) return 'Esse arquivo não é uma cópia do Afinado.';
  if (!(copia.versao <= VERSAO_DA_COPIA)) return 'Essa cópia é de uma versão mais nova do app. Atualize o app antes.';
  if (!copia.perfil || typeof copia.perfil !== 'object') return 'A cópia está sem o perfil — o arquivo pode estar corrompido.';
  if (!Array.isArray(copia.sessoes)) return 'A cópia está sem as sessões — o arquivo pode estar corrompido.';
  if (copia.sessoes.some((s) => !s || !Number.isFinite(s.data))) return 'Há sessões sem data na cópia — o arquivo pode estar corrompido.';
  return null;
}

// Substitui tudo que há no aparelho pelo que está na cópia.
export async function importarTudo(copia) {
  const problema = validarCopia(copia);
  if (problema) throw new Error(problema);

  await apagarTudo();
  await salvarPerfil({ ...copia.perfil, id: CHAVE_PERFIL });
  // Em ordem de data, e sem o id antigo: o banco numera de novo, e a ordem é
  // o que as telas usam.
  const ordenadas = [...copia.sessoes].sort((a, b) => a.data - b.data);
  for (const { id, ...sessao } of ordenadas) {
    try {
      await transacionar('sessoes', 'readwrite', (loja) => loja.add(sessao));
    } catch {
      memoria.sessoes.push({ id: memoria.sessoes.length + 1, ...sessao });
    }
  }
  return { sessoes: ordenadas.length };
}

export function guardaConfiavel() {
  return !semIndexedDb;
}
