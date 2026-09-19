# Afinado

Um treinador de canto que roda direto no navegador: escuta a sua voz, mostra onde ela está em relação à nota, e monta a sessão a partir do tempo que você tem hoje. Sem instalar nada, sem conta, e sem nenhum áudio saindo do seu aparelho.

## O que tem

- **Teste inicial** — mede a sua nota mais grave, a mais aguda e o quanto você erra hoje, em cents. Esse número vira o ponto zero: é contra ele que as próximas semanas são comparadas. Vale refazer a cada 3–4 semanas.
- **Treino de afinação** — você diz quanto tempo tem (5, 10, 20 minutos) e o app monta a fila de notas: as que você mais erra primeiro, o resto espalhado pela sua tessitura. O piano apresenta a nota, um tom vocal a sustenta, e você canta por cima do bloco que atravessa a tela.
- **Barra que anda** — a tolerância começa em ±50 cents e aperta até ±20 conforme você acerta; erra seguido e ela afrouxa de volta. Você vê a faixa apertar na tela.
- **Treinador que diz o lado** — errou, ele diz se está alto ou baixo (ou se você foi parar em outra oitava) e toca o tom-alvo de novo. "Quase" não ensina ninguém a achar a nota.
- **Modo sem mãos** — celular apoiado a dois metros, letra grande, tela que não apaga, avanço automático. Cantar com o telefone na mão não dá certo.
- **Resumo de fim de sessão** — um número (erro médio em cents) e uma ordem (por qual nota começar amanhã).
- **Afinador livre** — o medidor sozinho, sem exercício, pra conferir uma nota solta ou afinar um instrumento.

Tudo em notação dupla: **Dó4 · C4**, lado a lado.

## Como rodar

É um PWA estático — HTML, CSS e JS puro, sem build. Como usa módulos ES, precisa ser servido por http(s):

```
npx serve .
```

Abrir `index.html` direto do disco (`file://`) não funciona.

Ao acrescentar arquivos ao projeto, rode `./ferramentas/listar-arquivos.sh` pra atualizar a lista de precache do service worker — senão o app quebra offline sem avisar.

## Como funciona a detecção de pitch

`audio/yin.js` implementa YIN (de Cheveigné & Kawahara, 2002): mede a *diferença* d(τ) = Σ (x[j] − x[j+τ])², normaliza pela média cumulativa, e pega o **primeiro** vale abaixo do limiar — não o menor.

Essa ordem é o ponto todo. A autocorrelação que o app usava antes erra a oitava: o pico em 2·T é quase tão alto quanto o em T, e em voz masculina grave, onde o segundo harmônico costuma chegar mais forte que o fundamental, ela cai no dobro ou na metade com frequência incômoda. Como múltiplos do período só aparecem *depois* do período, pegar o primeiro vale resolve isso.

O detector roda dentro de um `AudioWorklet`, longe da thread que desenha a tela, e a função de diferença sai de uma correlação cruzada por FFT — por força bruta seriam quase um milhão de multiplicações a cada 10 ms.

Medido em navegador, de 80 a 900 Hz: **erro abaixo de 0,1 cent e nenhum erro de oitava**, inclusive com a fundamental mais fraca que o segundo harmônico.

## Verificação

Abra `verificacao/index.html` — de preferência no celular, que é onde a taxa de amostragem importa. A página sintetiza tons de frequência conhecida num `OfflineAudioContext`, passa cada um pelo mesmo YIN que roda no app, e confere erro, erro de oitava, custo por detecção e a caminhada da tolerância adaptativa.

## Privacidade

Não há servidor. O microfone é lido, processado e descartado dentro do navegador; a extensão da sua voz, as notas em que você erra e o histórico de sessões ficam num IndexedDB local. Se você limpar os dados do navegador, some — é o preço de não ter cadastro, e o app compensa sendo grátis, offline e sem nada seu saindo do aparelho.

## Publicação

`.github/workflows/publicar.yml` sobe o site no GitHub Pages a cada push na `main`. A cada publicação a CI carimba a versão do cache com o hash do commit e regenera a lista de arquivos do service worker a partir do que existe no repositório — as duas coisas eram manuais e as duas quebravam em silêncio.

O service worker não chama `skipWaiting()`: a versão nova se instala calada e espera a próxima visita pra assumir, então uma sessão em andamento nunca troca de versão embaixo de quem está cantando.
