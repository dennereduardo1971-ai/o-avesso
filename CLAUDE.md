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
  fala.js           → a voz do treinador (speechSynthesis, provisório)

dados/banco.js      → IndexedDB: perfil e sessões, só no aparelho

treino/
  voz.js            → extensão, tessitura, passaggio, escolha das notas
  tolerancia.js     → a barra adaptativa (±50 → ±20)
  perfil.js         → erro médio e notas fracas
  exercicios/afinacao.js → a máquina de estados de uma nota

ui/
  rolagem.js        → o mostrador de linha rolando (canvas)
  painel-exercicio.js → a tela de exercício, compartilhada por teste e treino
  roteador.js       → roteamento por hash
  semmaos.js        → Wake Lock e tipografia grande

telas/              → inicio, diagnostico, treino, resumo, afinador
verificacao/        → página que roda o motor contra tons sintetizados
ferramentas/listar-arquivos.sh → gera a lista de precache do service worker
```

Como os módulos são ES, o app só roda servido por http(s) — abrir `index.html` do disco (`file://`) não funciona. Para rodar: `npx serve .`

## As três decisões que explicam o resto

**Retorno visual em tempo real é a aposta central.** A pesquisa (Frontiers, 2021; Wilson et al.) mede ganho significativo de afinação com retorno visual, e mais em iniciantes que em cantores avançados. Por isso o mostrador é uma linha rolando no tempo, e não um ponteiro: ponteiro responde "estou afinado agora?" tarde demais pra corrigir; a linha mostra onde o alvo está, onde a voz está e pra que lado ela vai.

**A tolerância anda, não é fixa.** Até ~±25 cents o ouvinte comum considera afinado; acima de ±50 qualquer um percebe (Larrouy-Maestri). A versão v0 exigia ±15, o que só deixava a barra vermelha o tempo todo. Hoje começa em ±50 e aperta até ±20 conforme a pessoa acerta, afrouxando quando ela erra.

**Todo exercício é gerado em torno da extensão medida.** Enquanto não há teste, o app assume barítono (A2–A4, tessitura A2–F4, passaggio Si3–Dó4 e Mi4–Fá4). Depois do teste inicial, a medida real substitui o palpite — inclusive apertando a faixa de busca do detector, que é a defesa mais barata contra erro de oitava.

## Como funciona a detecção de pitch

`audio/yin.js` implementa YIN (de Cheveigné & Kawahara, 2002), com limiar absoluto 0,15, interpolação parabólica sobre a função de diferença e faixa travada em 65–1100 Hz (depois, na extensão medida).

**Por que não a autocorrelação de antes:** ela erra a oitava. O pico em 2·T é quase tão alto quanto o em T, e em voz masculina grave — onde o segundo harmônico costuma chegar mais forte que o fundamental — ela cai no dobro ou na metade com frequência incômoda. O YIN mede diferença em vez de semelhança e pega o *primeiro* vale abaixo do limiar, não o menor: como múltiplos do período só aparecem depois dele, essa ordem é o que mata o erro de oitava.

A função de diferença sai de uma correlação cruzada calculada por FFT (radix-2 própria, sem dependência) — por força bruta seriam quase um milhão de multiplicações a cada 10 ms dentro da thread de áudio.

O algoritmo mora separado do Web Audio API de propósito: o mesmo código roda no worklet e na página de verificação, alimentado por tons de frequência conhecida.

## Convenções

- Nomes de variáveis, funções e comentários em português
- Sem dependências externas de JS: Web Audio API + DOM puro, zero framework
- Telas separadas, roteamento por hash, cada tela devolve sua função de desmontar
- Fontes via Google Fonts (Fraunces pro display, Inter pro corpo), tema escuro
- Notação dupla em toda nota mostrada: `Dó4 · C4`

## Regras que não são negociáveis

- **Sem IA generativa em nenhuma parte do app.** Decisão deliberada, pro app funcionar sempre igual, offline e de graça. (Na Fase 2 esta regra vira "sem IA em tempo de execução": os áudios do treinador serão gerados antes e embutidos como arquivos; chamada de API em runtime, nunca.)
- **Escutar e tocar nunca ao mesmo tempo.** O som-guia sai pelo alto-falante e volta pelo microfone; com fone é pouco, sem fone é muito, e o app não tem como saber qual é o caso. Use `comEscutaPausada` de `audio/motor.js`.
- **Um AudioContext só,** em `audio/motor.js`. A versão v0 abria um por nota tocada e o app emudecia no meio da sessão.
- **Nada de backend, login ou storage remoto.** O app funciona inteiramente client-side, e isso é vantagem: grátis, offline, sem dado saindo do aparelho.
- **Nada de dependência pesada** pra algo que o Web Audio API já resolve.
- **Nada de streak, ofensiva ou cobrança de presença.** Quem treina três vezes numa semana e nenhuma na outra continua chegando lá.

## Publicação

- `.github/workflows/publicar.yml` sobe o site no **GitHub Pages** a cada push na `main`. Sem build — o app é estático.
- **A versão do cache é carimbada pela CI** com o hash do commit (o workflow troca `const VERSAO = 'dev'` em `service-worker.js`). Nunca voltar a numerar isso na mão.
- **A lista `ARQUIVOS_BASICOS` do service worker é gerada**, não escrita à mão (`ferramentas/listar-arquivos.sh`, rodado pela CI). Era manual, e essa era a armadilha mais cara do projeto: um arquivo esquecido não quebra nada em desenvolvimento — quebra só offline, só pra quem já instalou o app, e sem mensagem de erro. Rode o script localmente ao acrescentar arquivos.
- O service worker **não** chama `skipWaiting()` na instalação — a versão nova se instala calada e só assume quando a pessoa recarrega, pra não trocar de versão no meio de uma sessão.

## Verificação

`verificacao/index.html` alimenta o YIN com tons sintetizados num `OfflineAudioContext` e afirma **erro < 1 cent e zero erro de oitava** de 80 a 900 Hz — inclusive no caso da fundamental mais fraca que o segundo harmônico, que é o que derrubava a autocorrelação. Também confere que o caminho por FFT bate com a definição direta do artigo, e que a tolerância adaptativa caminha de ±50 a ±20 e volta.

Vale rodar essa página **no celular de verdade**, não só no computador: a taxa de amostragem do aparelho é a que importa.

O resto se verifica à mão: instalar o PWA, desligar a rede e fazer uma sessão inteira (é aí que um arquivo faltando no precache aparece); e usar o app com o celular a dois metros, sem fone e depois com fone bluetooth, conferindo que o guia nunca vaza pro microfone e que a tela não apaga.

## O que ainda não existe (fases seguintes)

Fase 2: planejador de sessão (pergunta tempo + se dá pra cantar alto), aquecimento SOVT guiado por tempo, exercícios de sustentação/agudo/ritmo, modo silencioso de treino de ouvido, áudio do treinador pré-gerado. Fase 3: importar MIDI, transposição pra caber na voz, cantar melodias. Fase 4: gráfico de progresso, gravação da própria voz com comparação no tempo, exportar/importar tudo.

Riscos já registrados: a regra das 5 tentativas em nota inalcançável não trava nada (decisão consciente do usuário, mas é o padrão de esforço repetido que a literatura associa a lesão de prega vocal); fone bluetooth adiciona 100–300 ms de atraso, e o exercício de ritmo vai precisar de calibração de latência.
