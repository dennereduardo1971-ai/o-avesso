-- Schema completo do O Avesso. Rode isso inteiro, de uma vez, no SQL Editor
-- do projeto Supabase (iidgikkuzrcmtoobvkbm). Pode rodar de novo por cima
-- de um banco que já existe: nada aqui apaga dado.
--
-- Uma tabela de dados (avesso_kv), chave-valor: cada linha guarda o estado
-- inteiro de uma tela, como JSON. Não tem coluna por campo de ficha —
-- é a estrutura que o app espera.
--
-- E uma tabela de gente (avesso_perfis), que existe só pra o banco saber
-- quem é o mestre — necessária desde que passou a haver dado compartilhado
-- que a mesa lê e só ele escreve.

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
--   moradores-mestre     -> pessoal, mestre (segredos dos moradores)
--   o-avesso-avisos      -> pessoal        (aparelhos que recebem Web Push)
--   quadro-de-linhas     -> compartilhado  (Quadro de Linhas)
--   mapa-avesso          -> compartilhado  (Mapa do Avesso)
--   o-avesso-diario      -> compartilhado  (Diário do Avesso)
--   mestre:elenco-moradores -> a mesa lê, só o mestre escreve
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- Quem é o mestre — do lado do banco.
--
-- Até aqui, "mestre" era só uma constante no JavaScript (MESTRE em
-- scripts/db.js). Isso bastava enquanto o que era do mestre também era
-- pessoal dele: o RLS já barrava pelo dono da linha. Agora existe coisa que a
-- mesa inteira precisa LER e só o mestre pode ESCREVER (o elenco de
-- moradores) — e pra isso o Postgres precisa saber quem ele é. Sem isto,
-- qualquer pessoa logada poderia reescrever o elenco pela API.
--
-- A constante no JS continua valendo: ela decide o que a interface mostra
-- (e funciona offline). Esta tabela é a tranca de verdade.
-- ---------------------------------------------------------------------------

create table if not exists avesso_perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  e_mestre boolean not null default false
);

comment on table avesso_perfis is 'Quem conduz o Avesso, do ponto de vista do banco.';

alter table avesso_perfis enable row level security;
grant select on avesso_perfis to authenticated;

-- Leitura livre pra quem está logado (a interface pode perguntar "sou mestre?").
-- Escrita: ninguém, por app nenhum. Trocar de mestre é ato de administração,
-- feito aqui no SQL Editor — não é botão de tela.
drop policy if exists "avesso_perfis_select" on avesso_perfis;
create policy "avesso_perfis_select"
on avesso_perfis for select
to authenticated
using (true);

-- Marca o mestre atual pelo login (denner@oavesso.local). Se um dia mudar,
-- rode este insert de novo com o outro email — e um update zerando o antigo.
insert into avesso_perfis (id, e_mestre)
select id, true from auth.users where email = 'denner@oavesso.local'
on conflict (id) do update set e_mestre = true;

create or replace function avesso_e_mestre()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select e_mestre from avesso_perfis where id = auth.uid()), false);
$$;

comment on function avesso_e_mestre is
  'true se quem está logado é o mestre. Usada pelas políticas de avesso_kv.';

grant execute on function avesso_e_mestre() to authenticated;

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
--
-- E mais uma trava, nova: as chaves que começam com "shared:mestre:" são de
-- leitura da mesa e escrita do mestre. É o caso do elenco de moradores — todo
-- mundo precisa saber quem existe no Avesso, mas quem decide isso é quem
-- conduz. Sem esta cláusula, qualquer jogador poderia reescrever o elenco
-- direto pela API, sem passar pela tela.
create policy "avesso_kv_insert"
on avesso_kv for insert
to authenticated
with check (
  (
    (shared and owner is null)
    or (not shared and owner = auth.uid())
  )
  and (id not like 'shared:mestre:%' or avesso_e_mestre())
);

create policy "avesso_kv_update"
on avesso_kv for update
to authenticated
using (
  (shared or owner = auth.uid())
  and (id not like 'shared:mestre:%' or avesso_e_mestre())
)
with check (
  (
    (shared and owner is null)
    or (not shared and owner = auth.uid())
  )
  and (id not like 'shared:mestre:%' or avesso_e_mestre())
);

create policy "avesso_kv_delete"
on avesso_kv for delete
to authenticated
using (
  (shared or owner = auth.uid())
  and (id not like 'shared:mestre:%' or avesso_e_mestre())
);

-- ---------------------------------------------------------------------------
-- Sincronia ao vivo (Realtime).
--
-- Serve pra uma coisa só: enquanto a mesa joga, quem mexe numa tela
-- compartilhada acende a placa de "recarregar" nas outras pessoas. Antes
-- disso, duas pessoas mexendo no Quadro de Linhas se atropelavam em silêncio.
--
-- O app NÃO sobrescreve a tela de ninguém sozinho ao receber o aviso: quem
-- está com um cartão aberto não pode ter o texto puxado debaixo do dedo.
--
-- O RLS continua valendo aqui: quem não pode ler a linha também não recebe
-- o aviso dela.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'avesso_kv'
  ) then
    alter publication supabase_realtime add table avesso_kv;
  end if;
end $$;

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
--
-- 4) o mestre foi marcado?
--   select u.email, p.e_mestre from avesso_perfis p join auth.users u on u.id = p.id;
--
-- 5) estando logado como jogador, isto tem que devolver false:
--   select avesso_e_mestre();
--
-- 6) quem ligou os avisos (sem abrir o endereço de aparelho de ninguém):
--   select id, jsonb_array_length(value->'inscricoes') as aparelhos
--   from avesso_kv where id like 'user:%:o-avesso-avisos';
-- ---------------------------------------------------------------------------
--
-- Avisos (Web Push): não precisam de tabela nova. As inscrições de cada
-- pessoa ficam numa linha pessoal comum ('user:<uid>:o-avesso-avisos'), e o
-- RLS acima já faz o certo — ninguém enxerga os aparelhos de ninguém. Quem
-- lê todas é a função avisar-mesa, com a service_role, do lado do servidor
-- (ver supabase/functions/avisar-mesa/index.ts).
-- ---------------------------------------------------------------------------
