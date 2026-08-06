// cenario.js — o fundo de cada cena, em camadas.
//
// Três camadas separadas de propósito: fundo, meio e frente andam em
// velocidades diferentes quando o ponteiro se move, e é isso que dá
// profundidade sem imagem nenhuma. Tudo é SVG, então escala em qualquer tela
// e pesa alguns kilobytes — importa num PWA que precisa funcionar offline.
//
// A poeira/fiapo que flutua é feita em CSS (styles/jogo.css), não aqui: são
// elementos que se movem sozinhos e não têm nada a ver com a geometria do
// lugar.

const CENARIOS = {

  /* Aposentos do Duque — quarto de porcelana, papel de parede floral que é
     quase teia, cama alta ao centro, retrato na parede da direita. */
  'aposentos-duque': {
    // o gradiente de ambiente, atrás de tudo
    clima: 'radial-gradient(ellipse at 50% 15%, rgba(182,138,78,0.16), transparent 62%), radial-gradient(ellipse at 15% 95%, rgba(63,95,127,0.14), transparent 55%)',
    fundo: `
      <!-- papel de parede: listras de tecido com um floral que insiste -->
      <rect x="0" y="0" width="400" height="180" fill="url(#cn-papel)"/>
      <g class="cn-floral" opacity="0.28">
        <path d="M40 40 q8 -12 16 0 q-8 12 -16 0Z M120 70 q8 -12 16 0 q-8 12 -16 0Z
                 M210 34 q8 -12 16 0 q-8 12 -16 0Z M300 62 q8 -12 16 0 q-8 12 -16 0Z
                 M360 30 q8 -12 16 0 q-8 12 -16 0Z M75 100 q8 -12 16 0 q-8 12 -16 0Z
                 M260 104 q8 -12 16 0 q-8 12 -16 0Z"/>
      </g>
      <!-- rodapé -->
      <rect x="0" y="176" width="400" height="6" fill="rgba(0,0,0,0.35)"/>`,
    meio: `
      <!-- a parede do retrato, à direita -->
      <rect x="272" y="30" width="70" height="88" rx="2" fill="rgba(20,16,26,0.55)" stroke="rgba(182,138,78,0.45)" stroke-width="2"/>
      <rect x="280" y="38" width="54" height="72" fill="rgba(63,95,127,0.20)"/>
      <!-- a cama de porcelana, ao centro -->
      <path d="M120 172 L120 96 q0 -10 10 -10 h100 q10 0 10 10 v76 Z" fill="rgba(41,31,52,0.92)"/>
      <path d="M120 132 h120" stroke="rgba(182,138,78,0.3)" stroke-width="1.5"/>
      <ellipse cx="180" cy="96" rx="60" ry="8" fill="rgba(237,226,208,0.10)"/>
      <!-- a cômoda, à direita baixa -->
      <rect x="330" y="120" width="54" height="52" rx="2" fill="rgba(32,26,40,0.95)" stroke="rgba(182,138,78,0.25)"/>
      <path d="M330 138 h54 M330 156 h54" stroke="rgba(182,138,78,0.22)"/>
      <!-- o espelho coberto, atrás e à esquerda da cama -->
      <path d="M84 60 h34 v78 h-34 Z" fill="rgba(20,16,26,0.8)" stroke="rgba(182,138,78,0.3)"/>
      <path d="M82 58 q18 -8 38 0 l-2 84 q-17 6 -34 0 Z" fill="rgba(202,191,174,0.16)"/>
      <!-- a porta, à esquerda -->
      <rect x="6" y="52" width="52" height="120" rx="2" fill="rgba(26,20,33,0.95)" stroke="rgba(182,138,78,0.3)" stroke-width="1.5"/>
      <path d="M6 96 l52 14" stroke="rgba(0,0,0,0.6)" stroke-width="3"/>
      <circle cx="50" cy="116" r="3" fill="var(--accent, #b68a4e)"/>`,
    frente: `
      <!-- chão e tapete, com a faixa varrida apontando pro retrato -->
      <rect x="0" y="172" width="400" height="52" fill="rgba(16,12,21,0.95)"/>
      <path d="M60 224 L110 176 H300 L360 224 Z" fill="rgba(63,95,127,0.14)" stroke="rgba(182,138,78,0.18)"/>
      <path class="cn-faixa" d="M186 224 L206 178 H250 L242 224 Z" fill="rgba(237,226,208,0.05)"/>`
  }
};

/**
 * O SVG de uma cena, pronto pro innerHTML. Sem cenário escrito, devolve um
 * fundo neutro em vez de tela branca — o jogo continua jogável.
 */
export function cenarioHtml(cenaId) {
  const c = CENARIOS[cenaId];
  if (!c) {
    return `<div class="cn-camadas cn-vazio" aria-hidden="true"><span class="cn-nevoa"></span></div>`;
  }

  return `
    <div class="cn-camadas" aria-hidden="true" style="--cn-clima: ${c.clima}">
      <span class="cn-clima"></span>
      <svg class="cn-camada cn-fundo" viewBox="0 0 400 224" preserveAspectRatio="xMidYMid slice">
        <defs>
          <pattern id="cn-papel" width="16" height="16" patternUnits="userSpaceOnUse">
            <rect width="16" height="16" fill="#1d1725"/>
            <path d="M0 0 V16" stroke="rgba(182,138,78,0.10)" stroke-width="1"/>
            <path d="M8 0 V16" stroke="rgba(63,95,127,0.08)" stroke-width="1"/>
          </pattern>
        </defs>
        ${c.fundo}
      </svg>
      <svg class="cn-camada cn-meio" viewBox="0 0 400 224" preserveAspectRatio="xMidYMid slice">${c.meio}</svg>
      <svg class="cn-camada cn-frente" viewBox="0 0 400 224" preserveAspectRatio="xMidYMid slice">${c.frente}</svg>
      <span class="cn-nevoa"></span>
      <span class="cn-fiapos">${fiaposHtml(14)}</span>
    </div>`;
}

/** Fiapos de lã flutuando. Posição e ritmo sorteados uma vez, na montagem. */
function fiaposHtml(quantos) {
  let html = '';
  for (let i = 0; i < quantos; i += 1) {
    const x = Math.round(Math.random() * 100);
    const atraso = (Math.random() * 18).toFixed(1);
    const duracao = (16 + Math.random() * 18).toFixed(1);
    const escala = (0.5 + Math.random() * 1.1).toFixed(2);
    html += `<i style="left:${x}%;animation-delay:-${atraso}s;animation-duration:${duracao}s;--fp:${escala}"></i>`;
  }
  return html;
}

/**
 * Liga o parallax: cada camada segue o ponteiro num tanto diferente.
 * Devolve a função que desliga — a tela chama ao trocar de cena, senão sobra
 * um listener por cena visitada.
 */
export function ligarParallax(container) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};

  const camadas = [
    { el: container.querySelector('.cn-fundo'), forca: 4 },
    { el: container.querySelector('.cn-meio'), forca: 10 },
    { el: container.querySelector('.cn-frente'), forca: 20 }
  ].filter((c) => c.el);
  if (!camadas.length) return () => {};

  let pendente = false;
  let px = 0;
  let py = 0;

  function aplicar() {
    pendente = false;
    camadas.forEach((c) => {
      c.el.style.transform = `translate3d(${(-px * c.forca).toFixed(2)}px, ${(-py * c.forca * 0.5).toFixed(2)}px, 0)`;
    });
  }

  function aoMover(event) {
    const r = container.getBoundingClientRect();
    px = (event.clientX - r.left) / r.width - 0.5;
    py = (event.clientY - r.top) / r.height - 0.5;
    if (!pendente) {
      pendente = true;
      requestAnimationFrame(aplicar);
    }
  }

  function aoSair() {
    px = 0;
    py = 0;
    if (!pendente) {
      pendente = true;
      requestAnimationFrame(aplicar);
    }
  }

  container.addEventListener('pointermove', aoMover);
  container.addEventListener('pointerleave', aoSair);

  return () => {
    container.removeEventListener('pointermove', aoMover);
    container.removeEventListener('pointerleave', aoSair);
  };
}
