// db.js — camada de armazenamento do app, usando Supabase quando configurado
// e caindo para localStorage para funcionar offline sem setup externo.

const SUPABASE_URL = 'COLOQUE_AQUI_SUA_URL_DO_SUPABASE';
const SUPABASE_ANON_KEY = 'COLOQUE_AQUI_SUA_CHAVE_ANON_DO_SUPABASE';

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

function usernameToEmail(username) {
  return username.trim().toLowerCase().replace(/\s+/g, '') + '@oavesso.local';
}

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

function getDeviceId() {
  let id = localStorage.getItem('avesso-device-id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('avesso-device-id', id);
  }
  return id;
}

function buildId(key, shared) {
  return shared ? `shared:${key}` : `local:${getDeviceId()}:${key}`;
}

function getLocalStorageKey(key, shared) {
  return `${shared ? 'shared:' : 'local:'}${key}`;
}

function getLocalData(key, shared) {
  try {
    const raw = localStorage.getItem(getLocalStorageKey(key, shared));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setLocalData(key, value, shared) {
  localStorage.setItem(getLocalStorageKey(key, shared), JSON.stringify(value));
}

function listSharedLocal(prefix) {
  const results = [];
  const prefixKey = `shared:${prefix}`;
  for (let i = 0; i < localStorage.length; i += 1) {
    const storageKey = localStorage.key(i);
    if (storageKey && storageKey.startsWith(prefixKey)) {
      try {
        const raw = localStorage.getItem(storageKey);
        results.push({ id: storageKey, value: raw ? JSON.parse(raw) : null });
      } catch {
        // ignora entradas inválidas
      }
    }
  }
  return results;
}

export const auth = {
  async signIn(username, password) {
    const user = (username || '').trim();
    const pass = String(password || '');

    if (!user || !pass) {
      throw new Error('Usuário e senha são obrigatórios');
    }

    if (!isSupabaseConfigured()) {
      const session = { user: { user_metadata: { username: user } }, mode: 'local' };
      saveLocalSession(session);
      return session;
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: usernameToEmail(user),
      password: pass
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
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

  onChange(callback) {
    if (!isSupabaseConfigured()) {
      callback(getLocalSession());
      return;
    }

    getSupabaseClient().then((supabase) => {
      supabase.auth.onAuthStateChange((_event, session) => callback(session));
    });
  }
};

export const db = {
  async get(key, shared = false) {
    if (!isSupabaseConfigured()) {
      return getLocalData(key, shared);
    }

    const supabase = await getSupabaseClient();
    const id = buildId(key, shared);
    const { data, error } = await supabase
      .from('avesso_kv')
      .select('value')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? data.value : null;
  },

  async set(key, value, shared = false) {
    if (!isSupabaseConfigured()) {
      setLocalData(key, value, shared);
      return true;
    }

    const supabase = await getSupabaseClient();
    const id = buildId(key, shared);
    const { error } = await supabase
      .from('avesso_kv')
      .upsert({ id, shared, value, updated_at: new Date().toISOString() });
    if (error) throw error;
    return true;
  },

  async listShared(prefix) {
    if (!isSupabaseConfigured()) {
      return listSharedLocal(prefix);
    }

    const supabase = await getSupabaseClient();
    const { data, error } = await supabase
      .from('avesso_kv')
      .select('id, value')
      .eq('shared', true)
      .like('id', `shared:${prefix}%`);
    if (error) throw error;
    return data || [];
  }
};
