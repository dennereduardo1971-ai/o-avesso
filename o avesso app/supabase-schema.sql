-- Rode isso no SQL Editor do seu projeto Supabase (plano gratuito é suficiente)

create table if not exists avesso_kv (
  id text primary key,
  shared boolean not null default false,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- Habilita Row Level Security
alter table avesso_kv enable row level security;

-- Só quem estiver logado (usuário e senha corretos) pode ler ou escrever.
create policy "somente usuarios logados"
on avesso_kv
for all
using (auth.role() = 'authenticated')
with check (auth.role() = 'authenticated');
