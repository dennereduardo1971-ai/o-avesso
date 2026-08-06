-- Schema completo do O Avesso. Rode isso inteiro, de uma vez, no SQL Editor
-- do projeto Supabase (iidgikkuzrcmtoobvkbm). Pode rodar de novo por cima
-- de um banco que já existe: nada aqui apaga dado.
--
-- Uma tabela só (avesso_kv), chave-valor: cada linha guarda o estado
-- inteiro de uma tela, como JSON. Não tem coluna por campo de ficha —
-- é a estrutura que o app espera.

create table if not exists avesso_kv (
  id text primary key,
  shared boolean not null default false,
  owner uuid references auth.users(id) default auth.uid(),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Se a tabela já existia de uma versão anterior sem a coluna owner:
alter table avesso_kv add column if not exists owner uuid references auth.users(id) default auth.uid();

create index if not exists avesso_kv_owner_idx on avesso_kv (owner);
create index if not exists avesso_kv_shared_idx on avesso_kv (shared);

comment on table avesso_kv is 'Armazenamento chave-valor do O Avesso. Uma linha por tela/usuário.';
comment on column avesso_kv.id is
  'shared:<chave>              -> dado da mesa inteira
   user:<uuid-do-dono>:<chave> -> dado pessoal, só do dono';
comment on column avesso_kv.shared is 'true = a mesa inteira lê e escreve; false = só o dono.';
comment on column avesso_kv.owner is 'Dono da linha pessoal. Nulo nas linhas compartilhadas.';
comment on column avesso_kv.value is 'Estado da tela inteira, como JSON.';
comment on column avesso_kv.updated_at is 'Atualizado pelo app a cada gravação (scripts/db.js).';

-- ---------------------------------------------------------------------------
-- Chaves que o app grava hoje (id sem o prefixo shared:/user:<uuid>:) —
-- útil só como referência, não precisa existir nada previamente.
--
--   ficha-personagem     -> pessoal        (Ficha da Visitante)
--   gerador-npcs         -> pessoal, mestre (Gerador de NPCs)
--   caderno-mestre       -> pessoal, mestre (Caderno do Mestre)
--   quadro-de-linhas     -> compartilhado  (Quadro de Linhas)
--   mapa-avesso          -> compartilhado  (Mapa do Avesso)
--   o-avesso-diario      -> compartilhado  (Diário do Avesso)
-- ---------------------------------------------------------------------------

alter table avesso_kv enable row level security;

grant select, insert, update, delete on avesso_kv to authenticated;

-- Regras antigas — saem de cena antes de recriar a de verdade, inclusive
-- se você rodar este arquivo mais de uma vez.
drop policy if exists "somente usuarios logados" on avesso_kv;
drop policy if exists "avesso — compartilhado é de todos, pessoal é de cada um" on avesso_kv;
drop policy if exists "avesso_kv_select" on avesso_kv;
drop policy if exists "avesso_kv_insert" on avesso_kv;
drop policy if exists "avesso_kv_update" on avesso_kv;
drop policy if exists "avesso_kv_delete" on avesso_kv;

-- Leitura: linha compartilhada é de qualquer pessoa logada; linha pessoal só do dono.
-- (é isso que faz o Caderno do Mestre e o Gerador de NPCs ficarem invisíveis
-- pros jogadores, mesmo que alguém tente ler direto pela API)
create policy "avesso_kv_select"
on avesso_kv for select
to authenticated
using (shared or owner = auth.uid());

-- Escrita: só é permitido criar linha compartilhada com owner nulo, ou linha
-- pessoal com owner = você mesmo — ninguém grava em nome de outra pessoa.
create policy "avesso_kv_insert"
on avesso_kv for insert
to authenticated
with check (
  (shared and owner is null)
  or (not shared and owner = auth.uid())
);

create policy "avesso_kv_update"
on avesso_kv for update
to authenticated
using (shared or owner = auth.uid())
with check (
  (shared and owner is null)
  or (not shared and owner = auth.uid())
);

create policy "avesso_kv_delete"
on avesso_kv for delete
to authenticated
using (shared or owner = auth.uid());

notify pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- Conferir depois de rodar (cole e rode separado, se quiser):
--
-- 1) as colunas ficaram certas?
--   select column_name, data_type from information_schema.columns
--   where table_name = 'avesso_kv';
--
-- 2) as 4 políticas existem?
--   select policyname, cmd from pg_policies where tablename = 'avesso_kv';
--
-- 3) o que já foi salvo (sem abrir o conteúdo de ninguém):
--   select id, shared, updated_at from avesso_kv order by updated_at desc;
-- ---------------------------------------------------------------------------
