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
/scripts/jogo/ → o modo Jogo (ver seção abaixo): motor.js (estado da partida), caso-duque.js (o caso),
                dialogos-duque.js (as falas), retratos.js (silhuetas SVG), cenario.js (fundos em camadas)
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

## Publicação e atualização

- Publica sozinho: `.github/workflows/publicar.yml` sobe o site no **GitHub Pages** a cada push na `main`. Sem build — o app é estático
- **A versão do cache é carimbada pela CI** com o hash do commit (o workflow troca `const VERSAO = 'dev'` em `service-worker.js`). Nunca voltar a numerar isso na mão: esquecer prendia a mesa inteira numa versão antiga sem ninguém perceber
- O service worker **não** chama `skipWaiting()` na instalação. A versão nova se instala calada, fica esperando, e `scripts/atualizacao.js` acende a placa "puxaram um fio — o Avesso mudou". Quem manda ela assumir é a pessoa. É a mesma regra do Realtime: **avisa, não sobrescreve**
- O que fica de fora do deploy: `o avesso app/` (histórico), `create-users.js` e `gerar-chaves-push.js` (usam a service_role key), `token github.txt`, os PDFs e o schema

## Quem vê o quê (mestre × jogadores)

- **Convidada** (sem login): alcança só o jogo, o Manual e a Ficha (`semLogin: true` na lista `TELAS` de `session.js`, e `permiteConvidada: true` no `initPage` da página). O que é dela vai pro localStorage sob `user:convidada:`; nada dela sobe pro banco. Chave compartilhada com convidada **recusa** — não é só a interface: escrever ali seria escrever no material da mesa. Ao criar conta e entrar, `migrarDaConvidada()` sobe partida e ficha, mas só se a conta estiver vazia

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

## Modo Jogo (`pages/jogo.html` — "Atravessar")

O app deixou de ser só companion: dá pra **jogar a campanha sozinho**, sem mestre humano na mesa. As telas antigas continuam existindo e vão sendo absorvidas — Ficha, Quadro, Mapa e Diário passam a ser preenchidos pela jogatina em vez de digitados à mão.

Decisões que valem para tudo que for feito aqui:

- **Sem IA. Nenhuma.** O narrador é conteúdo autoral. A conversa tem três camadas: `topicos` (a espinha da investigação, destravados por pista), `assuntos` (campo de pergunta livre, casado por palavra-chave) e `desconversa` (quando nada casa — e desconversar em personagem é resposta, não mensagem de erro)
- O casamento do campo livre é por **palavra inteira**, nunca substring: chave de até 3 letras exige palavra idêntica, chave maior aceita prefixo (`costur` pega costura e costurar), chave com espaço tem que aparecer como frase. Substring cru fazia "você gosta de futebol?" cair num assunto por causa de "voce". Nunca usar palavra comum como chave
- **Loop:** point-and-click livre pelas regiões (observar → examinar com o Kit → deduzir) e o desfecho por acusação no Quadro. Acusar não tem dado: só aparece quando o jogador tem as pistas que sustentam a acusação
- **A regra de ouro é código, não convenção.** `conferirRegraDeOuro()` em `caso-duque.js` recusa em voz alta um caso onde pista essencial dependa de dado, e exige que toda essencial tenha pelo menos um caminho sem rolagem. Roda ao abrir o jogo. Escrever caso novo = escrever outro arquivo como esse e passar no validador
- Quem rola o dado é o **jogador**, no cubo 3D, e o jogo diz o que está em jogo antes — dá pra recuar sem rolar (e sem a informação)
- Zerar a Linha da Lógica **vira boneca**: fim daquela partida, com cena própria. Recomeçar guarda as pistas como `lembrancas` — o Avesso lembra, a Visitante não
- **Arte é silhueta em SVG**, gerada em `retratos.js` a partir de peças (cabeça + ombros + adereço). Morador novo ganha retrato automático pelo id, sem ninguém desenhar nada. Nada de PNG: pesa no cache offline e não anima
- **Solo primeiro.** O save é pessoal (`o-avesso-partida`) mas já nasce com `mesa` e `jogador` no formato — quando o co-op entrar, muda o dono do save, não a forma dele
- Jogar **preenche a Ficha da Visitante** do companion (chave `o-avesso-ficha-personagem`), em vez de manter ficha paralela. Os atributos vão como **texto**, porque é o que a Ficha guarda — mandar número faz a tela abrir com campo vazio, sem erro nenhum
- Movimento é contido e sempre respeita `prefers-reduced-motion`: transição de costura entre telas, parallax de três camadas, fiapos flutuando, silhueta que respira, ponto de interesse que pulsa até ser examinado

## O que evitar

- Não introduzir elementos fora do tema (nada de sci-fi, neon, cyberpunk — isso é de outro projeto do usuário, o Hub Kuuhaku)
- Não expor chaves secretas (service_role) em nenhum arquivo que vá pro navegador
- Não quebrar a regra de ouro do sistema (pistas centrais não dependem de dado) ao sugerir novas mecânicas
- Não colocar IA generativa no modo Jogo — foi decisão explícita, pra que o jogo funcione offline, de graça e sempre no tom
