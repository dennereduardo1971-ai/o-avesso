// db.js — camada de armazenamento do app, usando Supabase quando configurado
// e caindo para localStorage para funcionar offline sem setup externo.
//
// Cada valor guardado tem um dono:
//   compartilhado (shared: true)  -> id "shared:<chave>"        — todo mundo lê e escreve
//   pessoal       (shared: false) -> id "user:<uid>:<chave>"    — só quem gravou enxerga
//
// O caderno do mestre é pessoal e a página só abre pro MESTRE, então ninguém
// mais lê o que está lá — nem pelo app, nem direto no banco (ver supabase-schema.sql).

const SUPABASE_URL = 'https://xxyxvwyidghjspxqgekr.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_OM6UoYvqSMJ6tEwv5ZQRdA_s2dDbvE3';

// quem enxerga o Caderno do Mestre (nome de usuário do login, em minúsculas)
export const MESTRE = 'denner';

const isSupabaseConfigured = () => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_URL.includes('COLOQUE_AQUI') &&
    !SUPABASE_ANON_KEY.includes('COLOQUE_AQUI')
  );
};

let supabaseClient = null;

async function getSupabaseClient() {
  if (supabaseClient) return supabaseClient;
  if (!isSupabaseConfigured()) return null;

  const mod = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  supabaseClient = mod.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return supabaseClient;
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase().replace(/\s+/g, '');
}

function usernameToEmail(username) {
  return normalizeUsername(username) + '@oavesso.local';
}

function emailToUsername(email) {
  return normalizeUsername(String(email || '').split('@')[0]);
}

function makeUser(id, username) {
  const nome = normalizeUsername(username) || 'visitante';
  return { id: id, username: nome, isMestre: nome === MESTRE };
}

// ---- a convidada -----------------------------------------------------------
// Quem abre o app pra jogar e ainda não tem conta. Ela existe só neste
// aparelho: o que é dela fica no localStorage e nunca sobe pro banco.
//
// A regra é estreita de propósito. Convidada lê e escreve o que é **pessoal**
// (a partida, a ficha). Tudo que é compartilhado — Diário, Quadro, Mapa,
// elenco — continua exigindo login, porque escrever ali é escrever na mesa dos
// outros, e o RLS recusaria de qualquer jeito. Sem isso, jogar exigia que o
// mestre criasse uma conta antes de a pessoa poder começar.

export const CONVIDADA = { id: 'convidada', username: 'convidada', isMestre: false, convidada: true };

/** Quem está usando o app agora: a pessoa logada, ou a convidada local. */
export async function usuarioAtual() {
  let user = null;
  try {
    user = await auth.getUser();
  } catch (e) {
    user = null;
  }
  return user || CONVIDADA;
}

// O que a convidada leva junto quando finalmente cria conta e entra. Só
// pessoal, e só o que representa progresso — nada de preferência de aparelho.
const CHAVES_DA_CONVIDADA = ['o-avesso-partida', 'o-avesso-ficha-personagem'];

/**
 * Sobe o que a convidada jogou neste aparelho para a conta que acabou de
 * entrar. Só preenche o que estiver vazio do outro lado: se ela já tinha
 * partida na conta, a do aparelho não passa por cima — perder progresso ao
 * fazer login seria pior do que não migrar nada.
 *
 * @returns {Promise<string[]>} as chaves que subiram
 */
export async function migrarDaConvidada() {
  const subiram = [];
  for (const chave of CHAVES_DA_CONVIDADA) {
    const local = getLocalData(chave, false, CONVIDADA);
    if (!local) continue;
    try {
      const remoto = await db.get(chave, false);
      if (remoto) continue;
      await db.set(chave, local, false);
      localStorage.removeItem(getLocalStorageKey(chave, false, CONVIDADA));
      subiram.push(chave);
    } catch (e) {
      // sem espelho não tem migração; o que é dela continua aqui, intacto
    }
  }
  return subiram;
}

// ---- sessão local (modo sem Supabase) --------------------------------------

function getLocalSession() {
  try {
    const raw = localStorage.getItem('avesso-session');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveLocalSession(session) {
  localStorage.setItem('avesso-session', JSON.stringify(session));
}

function clearLocalSession() {
  localStorage.removeItem('avesso-session');
}

function getLocalUser() {
  const session = getLocalSession();
  if (!session || !session.username) return null;
  return makeUser('local:' + session.username, session.username);
}

// ---- chaves ----------------------------------------------------------------

function buildId(key, shared, user) {
  if (shared) return `shared:${key}`;
  return `user:${user.id}:${key}`;
}

function getLocalStorageKey(key, shared, user) {
  if (shared) return `shared:${key}`;
  return `user:${user ? user.username : 'visitante'}:${key}`;
}

function getLocalData(key, shared, user) {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(key, shared, user));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalData(key, value, shared, user) {
  localStorage.setItem(getLocalStorageKey(key, shared, user), JSON.stringify(value));
}

// ---- autenticação ----------------------------------------------------------

let cachedUser = null;

export const auth = {
  async signIn(username, password) {
    const user = normalizeUsername(username);
    const pass = String(password || '');

    if (!user || !pass) {
      throw new Error('Usuário e senha são obrigatórios');
    }

    if (!isSupabaseConfigured()) {
      const session = { username: user, mode: 'local' };
      saveLocalSession(session);
      cachedUser = makeUser('local:' + user, user);
      return session;
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(user),
      password: pass
    });
    if (error) throw error;
    cachedUser = makeUser(data.user.id, emailToUsername(data.user.email));
    // jogou como convidada e agora tem conta: o progresso sobe junto, senão
    // criar login pareceria começar do zero
    try { await migrarDaConvidada(); } catch (e) {}
    return data;
  },

  async signOut() {
    cachedUser = null;
    if (!isSupabaseConfigured()) {
      clearLocalSession();
      return;
    }

    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
  },

  async getSession() {
    if (!isSupabaseConfigured()) {
      return getLocalSession();
    }

    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  // Quem está logado agora: { id, username, isMestre } — ou null.
  async getUser() {
    if (cachedUser) return cachedUser;

    if (!isSupabaseConfigured()) {
      cachedUser = getLocalUser();
      return cachedUser;
    }

    const session = await auth.getSession();
    if (!session || !session.user) return null;
    cachedUser = makeUser(session.user.id, emailToUsername(session.user.email));
    return cachedUser;
  },

  onChange(callback) {
    if (!isSupabaseConfigured()) {
      callback(getLocalSession());
      return;
    }

    getSupabaseClient().then((supabase) => {
      supabase.auth.onAuthStateChange((_event, session) => {
        cachedUser = session && session.user
          ? makeUser(session.user.id, emailToUsername(session.user.email))
          : null;
        callback(session);
      });
    });
  },

  // Troca a própria senha. Pede a senha atual antes, pra confirmar que é
  // mesmo a pessoa (e não alguém que achou a sessão aberta num aparelho).
  // O login (nome de usuário) não pode ser trocado por aqui — é o email por
  // baixo dos panos, e o Supabase não confirma troca de email fictício.
  async updateOwnPassword(currentPassword, newPassword) {
    if (!isSupabaseConfigured()) {
      throw new Error('a senha só pode ser trocada com o banco configurado');
    }
    const current = await auth.getUser();
    if (!current) throw new Error('sem sessão');

    const supabase = await getSupabaseClient();
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(current.username),
      password: String(currentPassword || '')
    });
    if (authErr) throw new Error('senha atual incorreta');

    const { error } = await supabase.auth.updateUser({ password: String(newPassword || '') });
    if (error) throw error;
  }
};

// ---- funções no servidor ---------------------------------------------------

/**
 * Chama uma Edge Function do projeto levando junto o login de quem está
 * logado — é assim que a função sabe quem pediu, e pode recusar quem não é
 * o mestre. Usada só pelos avisos (ver scripts/avisos.js): o resto do app
 * fala direto com a tabela.
 */
export async function chamarFuncao(nome, corpo) {
  if (!isSupabaseConfigured()) {
    throw new Error('sem banco configurado');
  }
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase.functions.invoke(nome, { body: corpo });
  if (error) throw error;
  return data;
}

// ---- nome de exibição --------------------------------------------------
// Separado do login: cada pessoa escolhe como quer aparecer pra mesa
// (ficha, histórico de rolagens...) sem precisar trocar a conta em si.

const NOME_EXIBICAO_KEY = 'o-avesso-nome-exibicao';

export async function getNomeExibicao(user) {
  try {
    const saved = await db.get(NOME_EXIBICAO_KEY, false);
    const nome = saved && typeof saved.nome === 'string' ? saved.nome.trim() : '';
    return nome || user.username;
  } catch (e) {
    return user.username;
  }
}

export async function setNomeExibicao(nome) {
  const limpo = String(nome || '').trim().slice(0, 30);
  await db.set(NOME_EXIBICAO_KEY, { nome: limpo }, false);
  return limpo || null;
}

// ---- dados -----------------------------------------------------------------

// Quando cada linha foi gravada por este aparelho. Serve pra não avisar a
// pessoa de que "alguém mexeu" quando quem mexeu foi ela mesma: o Realtime
// devolve o próprio evento junto com o dos outros.
const ultimaEscrita = {};
const JANELA_ECO_MS = 3000;

export const db = {
  // Devolve o objeto guardado (já desserializado) ou null.
  async get(key, shared = false) {
    const user = await auth.getUser();
    if (!user) {
      // convidada: o que é dela mora neste aparelho; o que é da mesa, não é dela
      if (shared) throw new Error('esta tela precisa de login');
      return getLocalData(key, false, CONVIDADA);
    }

    if (!isSupabaseConfigured()) {
      return getLocalData(key, shared, user);
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('avesso_kv')
      .select('value')
      .eq('id', buildId(key, shared, user))
      .maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  },

  async set(key, value, shared = false) {
    const user = await auth.getUser();
    if (!user) {
      if (shared) throw new Error('esta tela precisa de login');
      setLocalData(key, value, false, CONVIDADA);
      return true;
    }

    if (!isSupabaseConfigured()) {
      setLocalData(key, value, shared, user);
      return true;
    }

    const supabase = await getSupabaseClient();
    ultimaEscrita[buildId(key, shared, user)] = Date.now();
    const { error } = await supabase
      .from('avesso_kv')
      .upsert({
        id: buildId(key, shared, user),
        shared: shared,
        owner: shared ? null : user.id,
        value: value,
        updated_at: new Date().toISOString()
      });
    if (error) throw error;
    return true;
  },

  async remove(key, shared = false) {
    const user = await auth.getUser();
    if (!user) {
      if (shared) throw new Error('esta tela precisa de login');
      localStorage.removeItem(getLocalStorageKey(key, false, CONVIDADA));
      return true;
    }

    if (!isSupabaseConfigured()) {
      localStorage.removeItem(getLocalStorageKey(key, shared, user));
      return true;
    }

    const supabase = await getSupabaseClient();
    const { error } = await supabase
      .from('avesso_kv')
      .delete()
      .eq('id', buildId(key, shared, user));
    if (error) throw error;
    return true;
  },

  /**
   * Avisa quando outra pessoa mexer nesta chave, ao vivo.
   *
   * É pra sessão acontecendo: até aqui, duas pessoas mexendo no Quadro de
   * Linhas se atropelavam em silêncio até alguém apertar "recarregar". O
   * aviso não sobrescreve nada sozinho — quem está com um cartão aberto não
   * pode ter o texto puxado debaixo do dedo. Ele só acende a placa.
   *
   * Sem Supabase configurado (modo local), não há outra pessoa: devolve um
   * cancelador que não faz nada.
   *
   * @param {string} key
   * @param {boolean} shared
   * @param {function} aoMudar
   * @returns {function} chame para parar de escutar
   */
  escutar(key, shared, aoMudar) {
    if (!isSupabaseConfigured()) return () => {};

    let canal = null;
    let vivo = true;

    (async () => {
      try {
        const user = await auth.getUser();
        if (!user || !vivo) return;
        const supabase = await getSupabaseClient();
        const id = buildId(key, shared, user);
        canal = supabase
          .channel('avesso:' + id)
          .on('postgres_changes',
            { event: '*', schema: 'public', table: 'avesso_kv', filter: 'id=eq.' + id },
            () => {
              const meu = ultimaEscrita[id] || 0;
              if (Date.now() - meu < JANELA_ECO_MS) return; // eco da própria gravação
              aoMudar(key);
            })
          .subscribe();
      } catch (e) {
        // sem Realtime disponível o app continua igual, só sem o aviso
      }
    })();

    return () => {
      vivo = false;
      if (canal) canal.unsubscribe();
    };
  }
};
