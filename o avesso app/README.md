# O Avesso — App Companion

Hub instalável (PWA) com Diário, Ficha, Quadro de Linhas, Gerador de NPCs, Caderno do Mestre e Relatório de Sessão. Todos os dados ficam num banco de verdade (Supabase, plano gratuito), então funcionam entre dispositivos diferentes — não só no navegador de quem preencheu.

## Passo 1 — Criar o banco (Supabase, gratuito)

1. Crie uma conta em **supabase.com** (o plano gratuito é suficiente pra esse uso).
2. Crie um novo projeto.
3. Vá em **SQL Editor** e rode o conteúdo do arquivo `supabase-schema.sql` (cria a tabela que guarda tudo).
4. Vá em **Project Settings → API** e copie:
   - a **Project URL**
   - a chave **anon public**

## Passo 2 — Criar os usuários de login

O app agora pede usuário e senha antes de liberar o acesso. Cada "usuário" vira, por baixo dos panos, um email fictício no formato `usuario@oavesso.local` — isso é só um detalhe técnico do Supabase, ninguém vê esse email na tela de login.

1. No painel do Supabase, vá em **Authentication → Users → Add user**
2. Preencha:
   - **Email:** `rudra@oavesso.local`
   - **Password:** `1971`
   - Marque a opção **Auto Confirm User** (senão o login não funciona até confirmar o email, que nesse caso nem existe de verdade)
3. Repita esse processo pra cada novo jogador que for entrar (ex: `sara@oavesso.local`), sempre com "Auto Confirm User" marcado.

No app, a pessoa digita só `rudra` (ou `sara`) como usuário — o `@oavesso.local` é adicionado automaticamente por trás.

## Passo 3 — Conectar o app ao banco

Abra o arquivo `db.js` e substitua:

```
const SUPABASE_URL = 'COLOQUE_AQUI_SUA_URL_DO_SUPABASE';
const SUPABASE_ANON_KEY = 'COLOQUE_AQUI_SUA_CHAVE_ANON_DO_SUPABASE';
```

pelos valores que você copiou no Passo 1.

## Passo 4 — Publicar (hospedagem gratuita)

O app precisa estar num endereço https real pra poder ser "instalado" no celular/PC. Duas opções gratuitas simples:

**Netlify (mais fácil):**
1. Crie uma conta em netlify.com
2. Arraste a pasta inteira (`o-avesso-app`) pra área de deploy manual do Netlify
3. Pronto — você recebe um link tipo `https://seu-app.netlify.app`

**Vercel (alternativa):**
1. Crie uma conta em vercel.com
2. Importe a pasta como um novo projeto (não precisa de build, é só HTML/JS estático)

## Passo 5 — Instalar no celular/PC

Abra o link publicado no navegador (Chrome no Android, Safari no iPhone, Chrome/Edge no PC):
- **Android/PC (Chrome/Edge):** vai aparecer um ícone de instalação na barra de endereço, ou o menu tem "Instalar app"
- **iPhone (Safari):** toque em Compartilhar → "Adicionar à Tela de Início"

## Importante sobre segurança

Agora o banco só libera acesso pra quem estiver logado (usuário e senha certos) — quem não tiver uma conta criada no Passo 2 não consegue ler nem escrever nada. Ainda assim, todos os usuários logados enxergam os mesmos dados compartilhados (o Diário), então trate as senhas com o mesmo cuidado que trataria qualquer login pessoal, e só crie contas pra quem realmente vai jogar.

## Estrutura dos arquivos

- `index.html` — o app inteiro (todas as abas)
- `db.js` — conexão com o Supabase
- `manifest.json` — configuração de instalação (PWA)
- `service-worker.js` — permite abrir offline depois da primeira vez
- `supabase-schema.sql` — comando pra criar a tabela no banco
- `icons/` — ícones do app
