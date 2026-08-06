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
- O motor de regras mora em `scripts/regras.js` (atributos, faixas 6+/4-5/3-, kit, posturas). Nenhuma tela deve reimplementar regra: importa de lá.
- **Relação não vira bônus.** A escala é curta demais (1d6 + 1..4 contra alvo 6: cada ±1 são 16,7% de chance absoluta). A postura de um morador decide se *existe* dado — acolhedor entrega na conversa, reservado é regra normal, arredio transforma o pedido em "agir sob risco" (§8). Nunca somar afeto/humor ao resultado.
- Postura tem duas camadas: **geral** (morador × mesa) e **relação** (morador × uma visitante). Onde há relação, é ela que vale — a mesma pergunta pode não pedir dado de uma jogadora e virar risco para outra, sem que nenhum número mude
- Cada morador tem um **arco** de 4 estágios (Inteiro → Puxando fio → Desfiando → Do avesso), que só anda por decisão do mestre

## Estrutura do projeto

```
index.html    → redireciona pra pages/index.html (raiz do site publicado)
/pages/       → HTMLs de cada tela: só a casca (root div + <link> + <script type="module">), zero lógica inline
/scripts/     → JS de cada página, como módulo ES; db.js (Supabase) e session.js (portaria) são a base
              → módulos sem tela: regras.js (motor de regras), lugares.js (as 7 regiões), elenco.js (moradores + relações + arcos),
                pulso.js (o mundo entre sessões), visitantes.js (quem já atravessou), diario-store.js (acesso ao Diário),
                avisos.js (Web Push)
/supabase/functions/ → a única coisa que roda no servidor: avisar-mesa, que assina o Web Push
gerar-chaves-push.js → script local (como create-users.js) que gera o par de chaves VAPID
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

- Mestre definido em uma constante única: `MESTRE` em `scripts/db.js` (hoje `'denner'`). Isso é o que a **interface** usa (e funciona offline); a tranca de verdade é a tabela `avesso_perfis` + a função `avesso_e_mestre()` no Postgres
- **Compartilhado** (`shared: true`): Quadro de Linhas, Mapa do Avesso, Diário
- **Compartilhado, mas escrita só do mestre**: chaves com prefixo `mestre:` (id vira `shared:mestre:<chave>`) — a mesa lê, só o mestre grava, e é o RLS que garante. É o caso do elenco de moradores
- **Pessoal** (`shared: false`): Ficha da Visitante (com as anotações)
- **Só o mestre**: Caderno do Mestre e Gerador de NPCs — somem do hub dos jogadores, a página mostra "porta trancada" pra quem tenta abrir por link direto, e o RLS bloqueia no banco
- No mapa, quem revela região é só o mestre; as notas de cada lugar são da mesa inteira
- Toda página interna começa por `initPage()` de `scripts/session.js`, que exige sessão, monta a barra de topo, aplica a regra do mestre, carimba a presença da pessoa e liga a sincronia ao vivo das chaves passadas em `escutar`
- **Nada de mundo automático.** O pulso do mundo é disparado pelo mestre, nunca por agendamento: projeto Supabase gratuito hiberna, e — mais importante — evento gerado por máquina vira fato canônico que o mestre teria que reconciliar na mesa seguinte. O mundo propõe; quem aprova é ele
- **Realtime só avisa, não sobrescreve.** Mudança externa numa tela compartilhada acende a placa "puxaram um fio — recarregar" na barra de topo. Recarregar sozinho puxaria o texto debaixo do dedo de quem está digitando
- **Web Push só sai a pedido do mestre**, depois da virada de página ("avisar a mesa"). A chave privada VAPID vive como segredo da Edge Function, nunca no navegador. Sem as chaves publicadas, a tela de avisos explica isso e o resto do app funciona igual

## Áreas/telas existentes

- **Manual do Jogador** — premissa, filosofia do jogo, atributos, Linha da Lógica, quando rolar dados, Kit de Detetive, loucura do Avesso, estrutura de investigação e o caso inicial (O Caso do Duque Desfiado); página estática, sem storage, compartilhada
- **Ficha da Visitante** — atributos, Linha da Lógica, Kit de Detetive, Verdades Esquecidas
- **Dado Rolável** — testa 1d6 + atributo (Agulha/Dedal/Linha) lendo direto da própria Ficha, classifica o resultado pela regra do Manual (6+/4-5/3-), com o dado em cubo 3D (CSS); também tem um d10 solto (gema 3D), histórico de rolagens da mesa (compartilhado), tabelas rápidas de improviso — ambientação e complicação — visíveis só pro mestre, e um bloco de anotações rápidas pessoais; compartilhada
- **Caderno do Mestre** — NPCs, caso em andamento, mundo persistente, notas (visão só do mestre) e a **Virar a Página**: ao fechar a sessão, o app propõe o que o Avesso faria entre um encontro e outro, e o mestre aprova ou recusa uma por uma. O que ele aprova muda o estado do morador e vira página no Diário; o que recusa fica quieto por duas viradas
- **Quadro de Linhas** — corkboard de pistas/suspeitos conectados por fios, arrastável
- **Moradores do Avesso** — o elenco fixo: 7 moradores, uma âncora por região do mapa (os 4 que já eram cartão no Quadro migraram com identidade). Cada um tem postura com a mesa (acolhedor/reservado/arredio), humor, arco, relação por visitante e — só pro mestre — segredo e notas de bastidor. Os jogadores só veem quem já foi apresentado; a lista aparece também no detalhe de cada região do Mapa e no seletor "diante de quem" do Dado
- **Gerador de NPCs** — nome + traço marcante + segredo, temático; é a porta de entrada do elenco: quando a mesa esbarra duas vezes na mesma pessoa, o mestre "promove a morador" e ela ganha estado
- **Diário do Avesso** — resumo compartilhado de cada sessão, pra quem faltar não ficar perdido
- **Mapa do Avesso** — mapa estilo "mapa de detetive" com 7 áreas e névoa de descoberta
- **Minha Conta** — nome de exibição (separado do login, autosave), troca de senha (com reautenticação pela senha atual) e os **Avisos do Avesso** (Web Push, ligável por aparelho); compartilhada, cada pessoa só mexe na própria conta

## O que evitar

- Não introduzir elementos fora do tema (nada de sci-fi, neon, cyberpunk — isso é de outro projeto do usuário, o Hub Kuuhaku)
- Não expor chaves secretas (service_role) em nenhum arquivo que vá pro navegador
- Não quebrar a regra de ouro do sistema (pistas centrais não dependem de dado) ao sugerir novas mecânicas
