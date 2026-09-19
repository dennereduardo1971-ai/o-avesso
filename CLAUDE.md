# Afinado — Contexto do Projeto

**Afinado** é um treinador de canto: um PWA estático que escuta a voz pelo microfone, diz onde ela está em relação à nota, e monta a sessão de treino a partir do tempo que a pessoa tem hoje. Sem build, sem backend, sem conta — tudo processado localmente no aparelho.

O objetivo que desenha o app: cantar afinado em karaokê, partindo de bagagem musical zero, em alguns meses. O que molda as decisões é a condição de uso, não o conteúdo: o tempo por dia varia de 5 a 40 minutos, o lugar varia (carro, casa cheia, casa vazia), o fone varia. Nada disso comporta um "programa de 30 dias" — por isso o app pergunta quanto tempo há agora e monta a sessão na hora.

## Estrutura do projeto

```
index.html          → a casca; o conteúdo é montado pelas telas
app.js              → entrada: liga o roteador e registra o service worker

audio/
  yin.js            → o algoritmo YIN puro (entra Float32Array, sai Hz)
  yin-worklet.js    → o YIN rodando dentro da thread de áudio
  motor.js          → contexto único, microfone, faixa de busca, estabilizador
  notas.js          → Hz ↔ MIDI ↔ nome de nota, em notação dupla (Dó4 · C4)
  sintese.js        → piano apresenta a nota, tom vocal com formantes sustenta
  timbre.js         → formantes que acompanham a nota no agudo + compensação de volume
  fala.js           → a voz do treinador (speechSynthesis, provisório)

dados/banco.js      → IndexedDB: perfil e sessões, só no aparelho

treino/
  aquecimento.js    → rotinas de aquecimento/desaquecimento (só dados + contagem pura)
  checkin.js        → check-in de conforto vocal e a decisão verde/amarelo/vermelho
  retorno.js        → quando a linha da voz aparece: sempre, alternado ou só no fim
  tom.js            → quantos semitons transpor um trecho pra caber na voz
  vibrato.js        → velocidade e amplitude do vibrato numa nota sustentada
  deriva.js         → quanto o tom escorrega num trecho à capela
  guia.js           → guia com a própria voz: conferir, guardar, escolher, corrigir
  sessao.js         → sessão completa (check-in → aquecimento → treino)
  voz.js            → extensão, tessitura, passaggio, escolha das notas
  tolerancia.js     → a barra adaptativa (±50 → ±20)
  perfil.js         → erro médio e notas fracas
  exercicios/afinacao.js → a máquina de estados de uma nota

ui/
  rolagem.js        → o mostrador de linha rolando (canvas)
  painel-exercicio.js → a tela de exercício, compartilhada por teste e treino
  roteador.js       → roteamento por hash
  semmaos.js        → Wake Lock e tipografia grande

telas/              → inicio, diagnostico, treino, resumo, afinador, aquecimento, checkin, tom, deriva
verificacao/        → página que roda o motor contra tons sintetizados
ferramentas/listar-arquivos.sh → gera a lista de precache do service worker
ferramentas/verificar.mjs → roda verificacao/ num navegador sem tela; é o portão da CI
ferramentas/ensaio-com-microfone.mjs → ponta a ponta com microfone falso (Lá4 com vibrato, WAV gerado sozinho), ~3 min: migração do banco v1→v2, gravações simultâneas do perfil, sessão às cegas, vibrato medido, guia com a própria voz, cantar sem base
audio/dispositivo.js → reconhece microfone de fone Bluetooth (qualidade de ligação no Android)
```

Como os módulos são ES, o app só roda servido por http(s) — abrir `index.html` do disco (`file://`) não funciona. Para rodar: `npx serve .`

## As três decisões que explicam o resto

**Retorno visual em tempo real é a aposta central.** A pesquisa (Frontiers, 2021; Wilson et al.) mede ganho significativo de afinação com retorno visual, e mais em iniciantes que em cantores avançados. Por isso o mostrador é uma linha rolando no tempo, e não um ponteiro: ponteiro responde "estou afinado agora?" tarde demais pra corrigir; a linha mostra onde o alvo está, onde a voz está e pra que lado ela vai.

**A linha em tempo real sai de cena.** A revisão sistemática de 2026 (36 estudos) mostra que retorno visual contínuo melhora o treino e não sobrevive à retirada — o grupo igualou o controle quando a tela sumiu —, e com cantor experiente pode até piorar a afinação (Wilson et al., 2008). Então há três modos (`treino/retorno.js`): sempre, alternado (um ensaio com a linha, um de ouvido) e só no fim. Às cegas a voz continua sendo gravada e o traçado inteiro aparece quando a nota acaba; a barra de sustentação também fica parada, porque ela também é retorno. No automático o modo acompanha a barra de tolerância: longe do mínimo, sempre; a até 15 cents do mínimo, alternado; no mínimo, só no fim. A pessoa pode fixar o modo nos Ajustes. O teste inicial continua sempre com a linha, pra seguir comparável com os testes antigos.

**Três números além do erro médio.** Tendência (desvio médio com sinal: canta alto ou baixo), precisão (quanto as tentativas se espalham — Pfordresher 2010: a maioria é mais exata que precisa) e oscilação (tremor dentro da nota, com o primeiro terço de fora por ser a entrada). Tendência ≥ 15 cents vira a ordem do dia no resumo, porque é um ajuste só que conserta todas as notas.

**Vibrato é descrito, não julgado.** `treino/vibrato.js` tira a tendência linear do miolo da nota e conta ciclos: 4–8 Hz com amplitude ≥ ±10 cents é vibrato (referência: média de 6,0 Hz, Prame 1994). O treinador não diz "está oscilando" quando o que há é vibrato.

**Guia com a própria voz (opcional, desligado por padrão).** Imitar gravações de si mesmo afina melhor que imitar outra pessoa (Pfordresher & Mantell, 2014). Quando a pessoa acerta uma nota, a tela de treino pede ao worklet os últimos 1,5 s de áudio cru (`capturarUltimos` — anel de 2 s dentro do worklet; não existe no caminho de reserva), o YIN confere o trecho (voz em ≥ 80%, desvio ≤ 30 cents, oscilação ≤ 40) e a melhor tomada por nota vai pra loja `vozes` (IndexedDB v2). Na apresentação, `apresentarNota` usa a gravação da nota ou de uma vizinha até 2 semitons, com a velocidade corrigindo desvio e distância; mais longe, tom sintético. As gravações ficam fora da cópia de segurança e fora do `apagarTudo`.

**Cantar sem base.** Âncora (o app toca, a pessoa segura), trecho à capela sem nada na tela, e a nota do começo de memória. A diferença, dobrada pra dentro da oitava, é a deriva (Mauch 2014: mediana de 11 cents em ~50 s, sem relação com experiência).

**A tolerância anda, não é fixa.** Até ~±25 cents o ouvinte comum considera afinado; acima de ±50 qualquer um percebe (Larrouy-Maestri). A versão v0 exigia ±15, o que só deixava a barra vermelha o tempo todo. Hoje começa em ±50 e aperta até ±20 conforme a pessoa acerta, afrouxando quando ela erra. No nível experiente (Ajustes → "Já canto bem") desce até ±10: o erro mediano por nota numa amostra de cantores variados foi 19 cents (Mauch 2014), então ±20 é frouxo pra quem canta de verdade.

**Todo exercício é gerado em torno da extensão medida.** Enquanto não há teste, o app parte do tipo de voz que a pessoa escolhe (`treino/voz.js`, `VOZES`): "mais grave" é barítono (A2–A4, passaggio Si3–Dó4 e Mi4–Fá4); "mais aguda" é A3–A5, com passaggio Mi4–Fá4 e Dó#5–Ré5. Sem escolha continua barítono, o comportamento de sempre. O tipo de voz também decide as notas de partida do teste inicial — começar o grave de uma voz feminina em Sol3 era começar no fundo dela. Depois do teste, a medida real substitui o palpite, inclusive apertando a faixa de busca do detector, que é a defesa mais barata contra erro de oitava.

**O tom vocal tem o mesmo volume em toda a extensão.** Formantes fixas de /a/ falado faziam o guia variar ~20 dB entre Lá2 e Dó6 e sumir no agudo feminino. `audio/timbre.js` sobe o F1 junto com a nota (sintonia de formante, o que cantora faz de verdade) e compensa o volume nota a nota a partir da resposta calculada dos filtros. A verificação mede isso renderizando o tom de verdade num OfflineAudioContext (≤ 2 dB de variação).

## Como funciona a detecção de pitch

`audio/yin.js` implementa YIN (de Cheveigné & Kawahara, 2002), com limiar absoluto 0,15, interpolação parabólica sobre a função de diferença e faixa travada em 65–1400 Hz (depois, na extensão medida).

**Por que não a autocorrelação de antes:** ela erra a oitava. O pico em 2·T é quase tão alto quanto o em T, e em voz masculina grave — onde o segundo harmônico costuma chegar mais forte que o fundamental — ela cai no dobro ou na metade com frequência incômoda. O YIN mede diferença em vez de semelhança e pega o *primeiro* vale abaixo do limiar, não o menor: como múltiplos do período só aparecem depois dele, essa ordem é o que mata o erro de oitava.

A função de diferença sai de uma correlação cruzada calculada por FFT (radix-2 própria, sem dependência) — por força bruta seriam quase um milhão de multiplicações a cada 10 ms dentro da thread de áudio.

O algoritmo mora separado do Web Audio API de propósito: o mesmo código roda no worklet e na página de verificação, alimentado por tons de frequência conhecida.

## Convenções

- Nomes de variáveis, funções e comentários em português
- Sem dependências externas de JS: Web Audio API + DOM puro, zero framework
- Telas separadas, roteamento por hash, cada tela devolve sua função de desmontar
- Fontes via Google Fonts (Fraunces pro display, Inter pro corpo), tema escuro
- Notação dupla em toda nota mostrada: `Dó4 · C4`

## Cuidar da voz

Aquecimento, desaquecimento e check-in **não são treino**: moram na mesma loja de sessões (`tipo: 'aquecimento'` e `'checkin'`), mas a tela inicial e o resumo filtram por `TIPOS_DE_TREINO` (em `dados/banco.js`). Sem esse filtro um check-in aparece como "última sessão" sem medida.

O check-in usa os **nomes** dos sintomas da Escala de Desconforto do Trato Vocal, não o questionário validado: é triagem pra decidir o dia, e a tela diz isso. Qualquer sinal de alerta (dor ao cantar, rouca ao acordar, perdeu agudos, rouca há semanas) dá vermelho sozinho — não mexer nisso pra "suavizar".

## Regras que não são negociáveis

- **Sem IA generativa em nenhuma parte do app.** Decisão deliberada, pro app funcionar sempre igual, offline e de graça. (Na Fase 2 esta regra vira "sem IA em tempo de execução": os áudios do treinador serão gerados antes e embutidos como arquivos; chamada de API em runtime, nunca.)
- **Escutar e tocar nunca ao mesmo tempo.** O som-guia sai pelo alto-falante e volta pelo microfone; com fone é pouco, sem fone é muito, e o app não tem como saber qual é o caso. Use `comEscutaPausada` de `audio/motor.js`.
- **Um AudioContext só,** em `audio/motor.js`. A versão v0 abria um por nota tocada e o app emudecia no meio da sessão.
- **Nada de backend, login ou storage remoto.** O app funciona inteiramente client-side, e isso é vantagem: grátis, offline, sem dado saindo do aparelho.
- **Nada de dependência pesada** pra algo que o Web Audio API já resolve.
- **Nada de streak, ofensiva ou cobrança de presença.** Quem treina três vezes numa semana e nenhuma na outra continua chegando lá.

## Versão nova, backup e armazenamento

- **Versão nova só entra quando a pessoa toca no aviso** (`app.js` → `aviso-versao`, e o service worker ouve a mensagem `'assumir'`). Não dá pra contar com "recarregar": com o PWA instalado, recarregar não solta a versão velha, e o app ficava semanas preso nela. Nunca trocar isto por `skipWaiting()` automático — trocar de versão no meio de uma sessão perde a sessão.
- **Em desenvolvimento (`VERSAO === 'dev'`) o service worker busca na rede primeiro.** Com cache primeiro, a edição de agora ficava escondida atrás do arquivo antigo.
- **Backup é arquivo**: `exportarTudo` / `importarTudo` / `validarCopia` em `dados/banco.js`, botões em Ajustes. A cópia é validada inteira antes de apagar qualquer coisa. **Restaurar nunca entra na verificação**: a página roda na mesma origem do app e apagaria o histórico real de quem a abrir no celular.
- **`salvarPerfil` grava em fila.** Mesclar é ler-e-escrever; duas gravações simultâneas liam o mesmo perfil e a segunda apagava a primeira. O ensaio com microfone confere isso.
- O app pede `navigator.storage.persist()` ao abrir, pra o navegador não apagar o IndexedDB quando faltar espaço.

## Publicação

- `.github/workflows/publicar.yml` sobe o site no **GitHub Pages** a cada push na `main`. Sem build — o app é estático.
- **Nada vai pro ar se a verificação falhar.** O primeiro passo da CI roda `ferramentas/verificar.mjs` num Chromium sem tela. Localmente: `cd ferramentas && npm install --no-save playwright`, depois `CANAL=msedge node ferramentas/verificar.mjs` (usa o Edge instalado, sem baixar navegador). O Playwright mora só em `ferramentas/`, que nunca vai pro ar.
- Ícones: SVG pra quem aceita e PNG 192/512 no manifesto; `apple-touch-icon` de 180 px porque o iPhone ignora SVG na tela de início.
- **A versão do cache é carimbada pela CI** com o hash do commit (o workflow troca `const VERSAO = 'dev'` em `service-worker.js`). Nunca voltar a numerar isso na mão.
- **A lista `ARQUIVOS_BASICOS` do service worker é gerada**, não escrita à mão (`ferramentas/listar-arquivos.sh`, rodado pela CI). Era manual, e essa era a armadilha mais cara do projeto: um arquivo esquecido não quebra nada em desenvolvimento — quebra só offline, só pra quem já instalou o app, e sem mensagem de erro. Rode o script localmente ao acrescentar arquivos.
- O service worker **não** chama `skipWaiting()` na instalação — a versão nova se instala calada e só assume quando a pessoa recarrega, pra não trocar de versão no meio de uma sessão.

## Verificação

`verificacao/index.html` alimenta o YIN com tons sintetizados num `OfflineAudioContext` e afirma **erro < 1 cent e zero erro de oitava** de 80 a 900 Hz — inclusive no caso da fundamental mais fraca que o segundo harmônico, que é o que derrubava a autocorrelação. Também confere que o caminho por FFT bate com a definição direta do artigo, e que a tolerância adaptativa caminha de ±50 a ±20 e volta.

Vale rodar essa página **no celular de verdade**, não só no computador: a taxa de amostragem do aparelho é a que importa.

O resto se verifica à mão: instalar o PWA, desligar a rede e fazer uma sessão inteira (é aí que um arquivo faltando no precache aparece); e usar o app com o celular a dois metros, sem fone e depois com fone bluetooth, conferindo que o guia nunca vaza pro microfone e que a tela não apaga.

## O que ainda não existe (fases seguintes)

Fase 2: ~~aquecimento SOVT guiado por tempo~~ ~~exportar/importar~~ (adiantado da Fase 4) (feito, junto com o check-in de conforto vocal — a pesquisa que sustenta as duas telas está no vault da Sara, `06 Pesquisa/04 — Saúde vocal e aquecimento.md`), planejador de sessão (pergunta tempo + se dá pra cantar alto), exercícios de sustentação/agudo/ritmo, modo silencioso de treino de ouvido, áudio do treinador pré-gerado. Fase 3: importar MIDI, transposição pra caber na voz, cantar melodias. Fase 4: gráfico de progresso, gravação da própria voz com comparação no tempo, exportar/importar tudo.

Riscos já registrados: a regra das 5 tentativas em nota inalcançável não trava nada (decisão consciente do usuário, mas é o padrão de esforço repetido que a literatura associa a lesão de prega vocal); fone bluetooth adiciona 100–300 ms de atraso, e o exercício de ritmo vai precisar de calibração de latência.
