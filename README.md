# Afinado

Ferramenta de auxílio ao canto: um afinador vocal em tempo real que roda direto no navegador, sem instalar nada e sem enviar áudio a lugar nenhum.

## O que tem

- **Afinador**: escuta o microfone, detecta a nota mais próxima do que está sendo cantado e mostra o desvio em cents num mostrador visual.
- **Nota de referência**: escolha qualquer nota (Dó2 a Dó6) e ouça o tom pra comparar com a própria voz.
- **Exercício guiado**: pratica a escala maior a partir de uma nota raiz — o app toca cada nota e espera você sustentar a afinação por um instante antes de avançar pra próxima.

## Como rodar

É um PWA estático — HTML, CSS e JS puro, sem build. Como usa módulos ES, precisa ser servido por http(s):

```
npx serve .
```

Ou qualquer outro servidor estático. Abrir `index.html` direto do disco (`file://`) não funciona.

## Como funciona a detecção de pitch

`scripts/pitch.js` implementa autocorrelação (ACF2+) sobre o buffer de áudio do `AnalyserNode`, com interpolação parabólica pra refinar a frequência fundamental. `frequenciaParaNota` converte a frequência pra nota + oitava + cents de desvio, usando Lá4 = 440Hz como referência.

## Publicação

`.github/workflows/publicar.yml` sobe o site no GitHub Pages a cada push na `main`, carimbando a versão do cache (`service-worker.js`) com o hash do commit — cada publicação vira um cache novo sozinha.

O service worker não chama `skipWaiting()`: a versão nova se instala calada e espera até a próxima visita/recarregamento pra assumir, então uma sessão em andamento nunca troca de versão embaixo do usuário.
