# O Avesso — Contexto do Projeto

Este é o companion app da campanha de RPG solo/em grupo **"O Avesso"**, criada originalmente para a Sara e depois expandida para um grupo de jogadores. O app é um PWA (instalável, offline-first) que serve de apoio às sessões — fichas, diário, mapa, geração de NPCs etc.

## Tema e tom (importante pra qualquer conteúdo/UI gerado)

- Mistura de **Coraline**, **Alice no País das Maravilhas** e **Sherlock Holmes**
- Estética: fantasia sombria / gótica-nonsense — tudo no mundo do Avesso é feito de **tecido, botão, porcelana e linha**
- A Visitante atravessa o **Espelho de Moldura de Linha** na Mansão Brasswood e cai no Avesso
- Frase-âncora do universo: *"Do outro lado do espelho, tudo tem costura."*
- Qualquer texto, nome ou ícone novo deve soar como parte desse mundo (nomes tipo "Senhor Alfinete", "Dona Retalho"; lugares tipo "Ala Leste", "Jardim de Alfinetes")

## Sistema de regras (pra qualquer lógica de jogo)

- Atributos: **Agulha** (precisão), **Dedal** (resistência), **Linha** (lógica)
- Recurso vital: **Linha da Lógica**, começa em 5. Perder tudo = virar boneca.
- Regra de ouro: pistas centrais de um mistério **nunca** dependem de dado — só de usar a ferramenta certa. Dado (1d6 + atributo) só entra em momentos de tensão real.
- Kit de Detetive: Lupa de Pedra Furada, Monóculo do Tempo, Mudança de Escala, Dialética do Absurdo

## Estrutura do projeto

```
index.html    → redireciona pra pages/index.html (raiz do site publicado)
/pages/       → HTMLs de cada tela: só a casca (root div + <link> + <script type="module">), zero lógica inline
/scripts/     → JS de cada página, como módulo ES; db.js (Supabase) e session.js (portaria) são a base
/styles/      → CSS; shared.css tem os tokens visuais comuns (cores, fontes, componentes reutilizados como ".seam", ".topbar", ".scope-tag" etc.)
manifest.json → configuração do PWA
service-worker.js → cache offline (subir CACHE_NAME a cada publicação)
```

Como as páginas usam módulos ES, o app só roda servido por http(s) — abrir o HTML direto do disco (`file://`) não funciona.

## Convenções visuais (shared.css)

- Fontes: **Cormorant Garamond** (títulos/display) + **EB Garamond** (corpo de texto), via Google Fonts
- Paleta escura por padrão: fundo `#14101a`, painéis `#201a28`, dourado `#b68a4e` como destaque, parchment `#ede2d0` como texto claro
- Cor por tipo de elemento: azul-linha (`#3f5f7f`) = pistas; vermelho-tinta (`#a5453f`) = suspeitos/mestre; dourado = neutro/local
- Divisores de seção usam um padrão de "costura" (linha tracejada com ✕ repetidos) — classe `.seam`
- Cartões geralmente têm cantos levemente arredondados, borda superior colorida por tipo, sombra sutil

## Backend

- **Supabase** (plano gratuito), projeto separado do outro app do usuário (Hub Kuuhaku) — não mexer nas credenciais/tabelas do Kuuhaku
- Tabela `avesso_kv`: armazenamento chave-valor simples (`id`, `shared`, `owner`, `value jsonb`, `updated_at`)
- Login via Supabase Auth, mapeando usuário → `usuario@oavesso.local` (sem exigir email real)
- Ids: compartilhado → `shared:<chave>`; pessoal → `user:<uid>:<chave>`
- RLS separa os dois: linha compartilhada é de qualquer pessoa logada, linha pessoal só do `owner`
- **Nunca** colocar a `service_role key` em código que roda no navegador — só em scripts locais de administração (ex: `create-users.js`)
- O login (`usuario@oavesso.local`) é fixo depois de criado — trocar o email fictício no Supabase não é viável na prática (`.local` é rejeitado, domínio real trava em confirmação por email que nunca chega). Quem quer aparecer com outro nome usa o "nome de exibição" pessoal (tela Minha Conta, `getNomeExibicao`/`setNomeExibicao` em `scripts/db.js`), separado do login

## Quem vê o quê (mestre × jogadores)

- Mestre definido em uma constante única: `MESTRE` em `scripts/db.js` (hoje `'denner'`)
- **Compartilhado** (`shared: true`): Quadro de Linhas, Mapa do Avesso, Diário
- **Pessoal** (`shared: false`): Ficha da Visitante (com as anotações)
- **Só o mestre**: Caderno do Mestre e Gerador de NPCs — somem do hub dos jogadores, a página mostra "porta trancada" pra quem tenta abrir por link direto, e o RLS bloqueia no banco
- No mapa, quem revela região é só o mestre; as notas de cada lugar são da mesa inteira
- Toda página interna começa por `initPage()` de `scripts/session.js`, que exige sessão, monta a barra de topo e aplica a regra do mestre

## Áreas/telas existentes

- **Manual do Jogador** — premissa, filosofia do jogo, atributos, Linha da Lógica, quando rolar dados, Kit de Detetive, loucura do Avesso, estrutura de investigação e o caso inicial (O Caso do Duque Desfiado); página estática, sem storage, compartilhada
- **Ficha da Visitante** — atributos, Linha da Lógica, Kit de Detetive, Verdades Esquecidas
- **Dado Rolável** — testa 1d6 + atributo (Agulha/Dedal/Linha) lendo direto da própria Ficha, classifica o resultado pela regra do Manual (6+/4-5/3-), com o dado em cubo 3D (CSS); também tem um d10 solto (gema 3D), histórico de rolagens da mesa (compartilhado), tabelas rápidas de improviso — ambientação e complicação — visíveis só pro mestre, e um bloco de anotações rápidas pessoais; compartilhada
- **Caderno do Mestre** — NPCs, caso em andamento, mundo persistente, notas (visão só do mestre)
- **Quadro de Linhas** — corkboard de pistas/suspeitos conectados por fios, arrastável
- **Gerador de NPCs** — nome + traço marcante + segredo, temático
- **Diário do Avesso** — resumo compartilhado de cada sessão, pra quem faltar não ficar perdido
- **Mapa do Avesso** — mapa estilo "mapa de detetive" com 7 áreas e névoa de descoberta
- **Minha Conta** — nome de exibição (separado do login, autosave) e troca de senha (com reautenticação pela senha atual); compartilhada, cada pessoa só mexe na própria conta

## O que evitar

- Não introduzir elementos fora do tema (nada de sci-fi, neon, cyberpunk — isso é de outro projeto do usuário, o Hub Kuuhaku)
- Não expor chaves secretas (service_role) em nenhum arquivo que vá pro navegador
- Não quebrar a regra de ouro do sistema (pistas centrais não dependem de dado) ao sugerir novas mecânicas
