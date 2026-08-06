// util.js — peças pequenas que quase toda tela usa.
//
// Estas duas funções estavam copiadas em dez arquivos, sempre iguais.
// Morando aqui, uma correção futura vale pro app inteiro de uma vez.

/** Escapa texto que vai virar conteúdo dentro do HTML. */
export function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Escapa texto que vai dentro de um atributo entre aspas duplas. */
export function escapeAttr(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}
