#!/usr/bin/env bash
# Reescreve ARQUIVOS_BASICOS em service-worker.js com tudo que o site serve.
#
# A lista de precache era mantida à mão e isso não sobrevive a um app dividido
# em dezenas de módulos: o arquivo esquecido não quebra nada em desenvolvimento
# (a rede está lá), só quebra offline, só pra quem já instalou o app, e sem
# mensagem de erro nenhuma. Aqui ela é derivada do repositório.
#
# A CI roda isto a cada publicação. Rodar localmente também vale — é o que
# mantém o offline funcionando em `npx serve .` antes de publicar.
#
#   ./ferramentas/listar-arquivos.sh            reescreve a lista
#   ./ferramentas/listar-arquivos.sh --conferir  só checa se está em dia (CI)

set -euo pipefail

cd "$(dirname "$0")/.."

ALVO="service-worker.js"
CONFERIR=0
[[ "${1:-}" == "--conferir" ]] && CONFERIR=1

# O que é do site: html, css, js, svg, json, e os áudios que a Fase 2 vai
# trazer. O que não é: o próprio service worker (que nunca deve cachear a si
# mesmo), a página de verificação (ferramenta de desenvolvimento) e tudo que
# não vai pro ar.
lista=$(
  find . \
    \( -path ./.git -o -path ./.github -o -path ./.claude -o -path ./node_modules \
       -o -path ./_site -o -path ./ferramentas -o -path ./verificacao \) -prune -o \
    -type f \
    \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.svg' \
       -o -name '*.json' -o -name '*.mp3' -o -name '*.ogg' -o -name '*.webp' -o -name '*.png' \) \
    -print |
    sed 's|^\./|./|' |
    grep -v '^./service-worker.js$' |
    LC_ALL=C sort |
    sed "s|.*|  '&',|"
)

novo=$(
  awk -v lista="$lista" '
    /INICIO-LISTA/ { print; print lista; dentro = 1; next }
    /FIM-LISTA/    { dentro = 0 }
    !dentro        { print }
  ' "$ALVO"
)

if ! grep -q 'INICIO-LISTA' "$ALVO" || ! grep -q 'FIM-LISTA' "$ALVO"; then
  echo "::error::os marcadores INICIO-LISTA/FIM-LISTA sumiram de $ALVO" >&2
  exit 1
fi

if [[ "$CONFERIR" == 1 ]]; then
  if [[ "$novo" == "$(cat "$ALVO")" ]]; then
    echo "lista de precache em dia"
  else
    echo "::error::ARQUIVOS_BASICOS está desatualizada — rode ./ferramentas/listar-arquivos.sh" >&2
    diff <(echo "$novo") "$ALVO" || true
    exit 1
  fi
else
  printf '%s\n' "$novo" > "$ALVO"
  echo "lista de precache atualizada com $(printf '%s\n' "$lista" | grep -c . ) arquivos"
fi
