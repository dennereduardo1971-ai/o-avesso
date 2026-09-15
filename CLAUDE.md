# Afinado — Contexto do Projeto

**Afinado** é uma ferramenta de auxílio ao canto: um PWA estático que roda um afinador vocal em tempo real no navegador, além de uma nota de referência e um exercício guiado de escala. Sem build, sem backend, sem IA — tudo processado localmente no aparelho da pessoa.

## Estrutura do projeto

```
index.html         → a página única do app (afinador, nota de referência, exercício)
/styles/estilo.css → todo o CSS
/scripts/pitch.js   → motor de detecção de pitch (autocorrelação) e conversão Hz ↔ nota
/scripts/app.js     → UI: captura de microfone, loop de detecção, exercício guiado
manifest.json       → configuração do PWA
service-worker.js   → cache offline (subir VERSAO a cada publicação — feito pela CI)
assets/icone.svg    → ícone do app
```

Como `scripts/app.js` é um módulo ES, o app só roda servido por http(s) — abrir `index.html` direto do disco (`file://`) não funciona.

## Como funciona a detecção de pitch

`scripts/pitch.js` faz autocorrelação (ACF2+) sobre o buffer de tempo do `AnalyserNode` do Web Audio API, com interpolação parabólica pra refinar o período entre amostras. `frequenciaParaNota()` converte a frequência detectada em nota + oitava + desvio em cents, usando Lá4 = 440Hz como referência. Abaixo de um RMS mínimo o sinal é descartado como silêncio/ruído, pra não mostrar nota errada quando ninguém está cantando.

## Convenções

- Nomes de variáveis, funções e comentários em português — mesma convenção do projeto anterior neste repositório
- Sem dependências externas de JS: tudo é Web Audio API + DOM puro
- Sem IA generativa em lugar nenhum do app — decisão deliberada, pro app funcionar sempre igual, offline e de graça
- Fontes via Google Fonts (Fraunces pro display, Inter pro corpo), tema escuro por padrão

## Publicação

- `.github/workflows/publicar.yml` sobe o site no **GitHub Pages** a cada push na `main`. Sem build — o app é estático
- **A versão do cache é carimbada pela CI** com o hash do commit (o workflow troca `const VERSAO = 'dev'` em `service-worker.js`). Nunca voltar a numerar isso na mão
- O service worker **não** chama `skipWaiting()` na instalação — a versão nova se instala calada e só assume quando a pessoa recarrega

## O que evitar

- Não adicionar backend, login ou storage remoto sem necessidade real — o app funciona inteiramente client-side hoje, e isso é uma vantagem (grátis, offline, sem dado saindo do aparelho)
- Não introduzir dependências pesadas de JS pra algo que o Web Audio API já resolve
- Não colocar IA generativa em nenhuma parte do app
