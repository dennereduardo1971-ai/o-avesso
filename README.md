# O Avesso — Jogo + App Companion

App instalável (PWA) que é duas coisas ao mesmo tempo:

- **O jogo** (`pages/jogo.html`) — a campanha jogável sozinha, sem mestre humano. É onde o ícone do app abre.
- **As telas da mesa** — Ficha, Quadro de Linhas, Mapa, Diário, Gerador de NPCs e Caderno do Mestre, pra quando vocês jogarem juntos.

Os dados da mesa ficam num banco de verdade (Supabase, plano gratuito), então acompanham a pessoa entre celular e computador. **O jogo, não:** ele abre sem login nenhum e guarda a partida no próprio aparelho — quem recebe o link instala e joga na hora. Se depois criar uma conta e entrar, a partida sobe junto (ver "A convidada", abaixo).

## Pra quem só quer jogar

1. Abrir o link do app no celular.
2. Instalar: **Android/Chrome** → menu → "Instalar app". **iPhone/Safari** → Compartilhar → "Adicionar à Tela de Início".
3. Tocar no ícone e atravessar o espelho. Funciona offline depois da primeira vez.

Não precisa de usuário, senha, nem de ninguém criar conta antes.

## O que cada pessoa enxerga

| Tela | Quem vê | Como funciona |
|---|---|---|
| **Atravessar** (o jogo) | qualquer pessoa, **sem login** | a campanha jogável sozinha; a partida fica no aparelho até ela criar conta |
| **Manual do Jogador** | a mesa inteira | regras do sistema; página estática, não salva nada |
| **Ficha da Visitante** | só quem preencheu | cada login tem a sua ficha e as suas anotações |
| **Dado Rolável** | a mesa inteira | 1d6 + atributo (cubo 3D) lendo a ficha de quem está logado, d10 solto (gema 3D), histórico de rolagens da mesa, anotações rápidas pessoais, e tabelas de improviso só pro mestre |
| **Quadro de Linhas** | a mesa inteira | mesmos cartões e mesmos fios pra todo mundo |
| **Mapa do Avesso** | a mesa inteira | as notas são de todos; **quem revela região é só o mestre** |
| **Diário do Avesso** | a mesa inteira | resumo das sessões, pra quem faltou não ficar perdida |
| **Caderno do Mestre** | **só o mestre** | não aparece no hub dos jogadores, a página não abre pra eles e o banco também não entrega |
| **Gerador de NPCs** | **só o mestre** | mesma trava do Caderno — ferramenta de improviso, não é dos jogadores |
| **Minha Conta** | a mesa inteira | cada pessoa escolhe o próprio nome de exibição e troca a própria senha |

O mestre é definido em uma linha só, no topo de `scripts/db.js`:

```js
export const MESTRE = 'denner';
```

Trocar de mestre é trocar esse nome (tem que bater com o nome de usuário do login).

## Passo 1 — Criar o banco (Supabase, gratuito)

1. Crie uma conta em **supabase.com** (o plano gratuito é suficiente pra esse uso).
2. Crie um novo projeto.
3. Vá em **SQL Editor** e rode o conteúdo de `supabase-schema.sql`.
4. Vá em **Project Settings → API** e copie a **Project URL** e a chave **anon public**.

> **Rodou uma versão anterior do app?** Rode o `supabase-schema.sql` de novo. Ele adiciona a coluna `owner` e troca a regra de acesso antiga (que deixava qualquer pessoa logada ler tudo) por quatro regras separadas — uma pra cada operação (ler/criar/editar/apagar) — que impedem inclusive gravar dado pessoal em nome de outra pessoa. Sem rodar isso, o app não consegue salvar nada: a tabela ainda não tem a coluna que o código espera.

Pra conferir se já está em dia, rode no SQL Editor:

```sql
select column_name from information_schema.columns
where table_name = 'avesso_kv' and column_name = 'owner';
```

Se vier vazio, o schema ainda está desatualizado.

## Passo 2 — Criar os usuários de login

Cada "usuário" vira, por baixo dos panos, um email fictício no formato `usuario@oavesso.local` — ninguém vê esse email na tela de login, é só um detalhe técnico do Supabase.

**Jeito rápido:** edite a lista de nomes/senhas em `create-users.js` e rode `node create-users.js`.
Esse arquivo usa a **service_role key** — ele roda só na sua máquina e **nunca** deve ir pro navegador nem pro deploy.

**Jeito manual:** no painel do Supabase, **Authentication → Users → Add user**, email `sara@oavesso.local`, senha à escolha, com **Auto Confirm User** marcado (senão o login não funciona, já que esse email não existe de verdade).

No app, a pessoa digita só `sara` — o `@oavesso.local` é colado atrás automaticamente.

Esse nome de login não muda depois de criado (trocar o email fictício no Supabase não funciona bem na prática). Quem quiser aparecer com outro nome pra mesa — na ficha, no histórico de rolagens, na barra de topo — troca isso sozinha em **Minha Conta**, que guarda um "nome de exibição" separado do login. A senha também se troca por lá, sem precisar mexer no Supabase.

## Passo 3 — Conectar o app ao banco

No topo de `scripts/db.js`:

```js
const SUPABASE_URL = '...';
const SUPABASE_ANON_KEY = '...';
```

A chave anon pode ficar aqui — ela sozinha não abre nada, porque quem manda é a regra de acesso do banco (RLS).

## Passo 4 — Publicar (GitHub Pages, automático)

O app precisa estar num endereço https real pra poder ser instalado — e também porque as telas usam módulos JavaScript, que não funcionam abrindo o arquivo direto do disco (`file://`).

A publicação é automática: **`.github/workflows/publicar.yml` sobe o site a cada push na `main`**. Não tem build, não tem painel pra visitar.

**Só na primeira vez**, ligue o Pages no repositório:

1. GitHub → o repositório → **Settings → Pages**
2. Em **Source**, escolha **GitHub Actions**

(O workflow tenta ligar isso sozinho, mas se a conta não permitir, é aqui que se faz na mão.)

Depois disso, publicar é:

```bash
git push origin main
```

Em cerca de um minuto o endereço fica no ar:

```
https://dennereduardo1971-ai.github.io/o-avesso/pages/jogo.html
```

Esse é o link pra mandar pra quem vai jogar. Pra acompanhar a publicação: aba **Actions** do repositório.

Pra testar na sua máquina antes de subir, sirva a pasta em vez de abrir o arquivo:

```bash
npx serve .
```

## Passo 5 — Instalar no celular/PC

- **Android/PC (Chrome/Edge):** ícone de instalação na barra de endereço, ou menu → "Instalar app"
- **iPhone (Safari):** Compartilhar → "Adicionar à Tela de Início"

O ícone abre direto no jogo. As telas da mesa continuam a um toque, no menu **telas ▾** da barra de cima (e no atalho de segurar o ícone do app).

## A convidada — jogar sem conta

Quem abre o app sem login vira **convidada**: joga normalmente, e a partida (mais a Ficha que o prólogo preenche) fica guardada **naquele aparelho**, não no banco.

O que a convidada **não** alcança: Diário, Quadro de Linhas, Mapa, Moradores, Dado compartilhado e Minha Conta. São telas da mesa — escrever nelas é escrever no material dos outros, e o banco recusaria de qualquer jeito. Elas simplesmente não aparecem no menu dela, e abrir por link direto leva pro login.

Se ela criar conta depois e entrar, a partida e a ficha do aparelho **sobem pra conta** — mas só se a conta ainda estiver vazia. Se já houver partida lá, a de cá não passa por cima: perder progresso ao fazer login seria pior do que não migrar nada.

## Estrutura dos arquivos

```
index.html            → redireciona pro hub (a raiz do site)
pages/                → uma tela por arquivo, só a casca (HTML + links)
scripts/db.js         → Supabase: login, leitura e escrita, e quem é o mestre
scripts/session.js    → portaria das páginas: exige login, monta a barra de topo, tranca o caderno
scripts/<tela>.js     → lógica de cada tela
styles/shared.css     → tokens visuais e peças comuns (barra de topo, selos, porta trancada)
styles/<tela>.css     → estilo de cada tela
manifest.json         → instalação (PWA)
service-worker.js     → abrir offline depois da primeira vez
supabase-schema.sql   → tabela e regras de acesso do banco
create-users.js       → cria os logins de uma vez (roda só local)
```

## Sobre as telas compartilhadas

Quadro, Mapa, Diário e o histórico do Dado Rolável salvam a página inteira de uma vez: se duas pessoas mexerem no mesmo lugar ao mesmo tempo, vale a última que salvou. Por isso cada uma dessas telas tem um botão **recarregar** na barra de topo — vale apertar antes de começar a escrever, se alguém mais estiver na mesa.

## Depois de publicar uma mudança

**Não precisa fazer nada.** O app guarda os arquivos pra abrir offline, e a versão do cache é carimbada na publicação com o hash do commit — cada push vira um cache novo sozinho. (Antes isso era um número que você tinha que lembrar de subir na mão, e esquecer disso deixava a mesa presa numa versão antiga sem ninguém perceber.)

No aparelho de quem já instalou, a versão nova se instala calada e **fica esperando**. Aparece uma placa discreta — *"puxaram um fio — o Avesso mudou"* — com um botão de recarregar. Ela troca quando quiser.

A versão nova nunca entra sozinha, de propósito: trocar o app no meio de uma cena perderia a cena.

## Nota sobre a pasta `o avesso app/`

É a versão antiga, de arquivo único, guardada como histórico. Não é usada pelo app atual — na hora de publicar, ela pode ficar de fora.
