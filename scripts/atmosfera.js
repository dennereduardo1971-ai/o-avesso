// atmosfera.js — o campo de linhas que vive atrás de todas as telas.
//
// Cada fio é uma corda de verdade: o deslocamento obedece a um oscilador
// harmônico amortecido (a = -k·x - c·v, mola mais atrito), integrado quadro
// a quadro. Nada aqui é animação gravada — o movimento sai da física, então
// dedilhar com o cursor devolve uma vibração diferente a cada vez.
//
// Quem não quer movimento (prefers-reduced-motion) recebe a teia parada,
// desenhada e imóvel.

const CALMO = matchMedia('(prefers-reduced-motion: reduce)').matches;

let ctx = null;
let cv = null;
let W = 0;
let H = 0;
let pins = [];
let fios = [];
let rodando = false;

const rnd = (a, b) => a + Math.random() * (b - a);

// ---- construção da teia ----------------------------------------------------

function construir() {
  pins = [];
  fios = [];
  const colunas = W < 620 ? 3 : 5;
  const linhas = W < 620 ? 5 : 4;

  for (let c = 0; c <= colunas; c++) {
    for (let l = 0; l <= linhas; l++) {
      pins.push({
        x: (c / colunas) * W + rnd(-38, 38),
        y: (l / linhas) * H + rnd(-34, 34),
        r: rnd(1.4, 2.6),
        brilho: Math.random() < 0.25
      });
    }
  }

  // liga cada alfinete a um ou dois vizinhos: vira teia de investigação
  pins.forEach((p, i) => {
    const perto = pins
      .map((q, j) => ({ j, d: Math.hypot(q.x - p.x, q.y - p.y) }))
      .filter((o) => o.j !== i && o.d > 40)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);

    const quantos = Math.random() < 0.55 ? 1 : 2;
    for (let k = 0; k < quantos && k < perto.length; k++) {
      const j = perto[k].j;
      if (j < i) continue;
      fios.push({
        a: i,
        b: j,
        x: 0,                       // deslocamento perpendicular
        v: 0,                       // velocidade
        k: rnd(0.014, 0.030),       // rigidez da mola
        c: rnd(0.016, 0.032),       // atrito
        sag: rnd(6, 20),            // barriga do fio parado
        fase: rnd(0, Math.PI * 2),
        resp: rnd(0.10, 0.30),      // amplitude do respiro
        desenho: CALMO ? 1 : 0,     // 0..1 — quanto já foi costurado
        cor: Math.random() < 0.18 ? 'brass' : 'thread'
      });
    }
  });
}

function medir() {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  W = innerWidth;
  H = innerHeight;
  cv.width = Math.round(W * dpr);
  cv.height = Math.round(H * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  construir();
}

// ---- cursor ----------------------------------------------------------------

const ponteiro = { x: -999, y: -999, px: -999, py: -999, ativo: false };

function mover(x, y) {
  ponteiro.px = ponteiro.ativo ? ponteiro.x : x;
  ponteiro.py = ponteiro.ativo ? ponteiro.y : y;
  ponteiro.x = x;
  ponteiro.y = y;
  ponteiro.ativo = true;
}

/** Onda de choque: empurra os fios por perto. Serve pra clique e pra entrada. */
export function pulso(cx, cy, ganho = 3) {
  fios.forEach((f) => {
    const A = pins[f.a];
    const B = pins[f.b];
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;
    const d = Math.hypot(mx - cx, my - cy);
    if (d < 420) f.v += (1 - d / 420) * ganho * (Math.random() < 0.5 ? -1 : 1);
  });
}

/** Distância de um ponto ao segmento — pra saber se o cursor cruzou o fio. */
function distSeg(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const L = vx * vx + vy * vy || 1;
  let t = (wx * vx + wy * vy) / L;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(ax + t * vx - px, ay + t * vy - py);
}

// ---- foco: um cartão em destaque reteza os fios em volta ---------------------

let foco = null;

function ligarFoco(seletor) {
  document.querySelectorAll(seletor).forEach((el) => {
    const entrar = () => {
      const r = el.getBoundingClientRect();
      foco = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    };
    const sair = () => { foco = null; };
    el.addEventListener('pointerenter', entrar);
    el.addEventListener('focus', entrar);
    el.addEventListener('pointerleave', sair);
    el.addEventListener('blur', sair);
    el.addEventListener('click', () => {
      const r = el.getBoundingClientRect();
      pulso(r.left + r.width / 2, r.top + r.height / 2, 5.5);
    });
  });
}

// ---- laço de animação -------------------------------------------------------

let t0 = 0;
let relogio = 0;

function quadro(agora) {
  const dt = Math.min((agora - t0) / 16.667, 3);   // em "quadros de 60fps"
  t0 = agora;
  relogio += dt;

  ctx.clearRect(0, 0, W, H);

  for (const f of fios) {
    const A = pins[f.a];
    const B = pins[f.b];

    if (f.desenho < 1) f.desenho = Math.min(1, f.desenho + dt * 0.022);

    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const comp = Math.hypot(dx, dy) || 1;
    const nx = -dy / comp;
    const ny = dx / comp;
    const mx = (A.x + B.x) / 2;
    const my = (A.y + B.y) / 2;

    // respiro: o fio nunca fica totalmente parado
    const respiro = Math.sin(relogio * 0.012 + f.fase) * f.resp * (comp / 90);

    // dedilhado: o cursor cruzou o fio?
    if (ponteiro.ativo) {
      const d = distSeg(ponteiro.x, ponteiro.y, A.x, A.y, B.x, B.y);
      if (d < 26) {
        const vel = Math.hypot(ponteiro.x - ponteiro.px, ponteiro.y - ponteiro.py);
        const lado = ((ponteiro.x - mx) * nx + (ponteiro.y - my) * ny) >= 0 ? 1 : -1;
        f.v += lado * Math.min(vel, 44) * 0.05 * (1 - d / 26);
      }
    }

    // um cartão em foco puxa os fios vizinhos até ele
    let alvo = 0;
    if (foco) {
      const d = Math.hypot(mx - foco.x, my - foco.y);
      if (d < 300) {
        const lado = ((foco.x - mx) * nx + (foco.y - my) * ny) >= 0 ? 1 : -1;
        alvo = lado * (1 - d / 300) * 15;
      }
    }

    // mola + atrito rumo ao alvo. Os limites são bom gosto: sem eles,
    // dedilhar sem parar joga o fio uns 130px pra fora — vira chicote.
    f.v += (-(f.x - alvo) * f.k - f.v * f.c) * dt;
    if (f.v > 6) f.v = 6; else if (f.v < -6) f.v = -6;
    f.x += f.v * dt;
    if (f.x > 62) f.x = 62; else if (f.x < -62) f.x = -62;

    const desloc = f.sag + f.x + respiro;
    const cx = mx + nx * desloc;
    const cy = my + ny * desloc;

    // ponta do traço enquanto está sendo costurado
    const p = f.desenho < 1 ? f.desenho * f.desenho * (3 - 2 * f.desenho) : 1;
    const ex = A.x + (B.x - A.x) * p;
    const ey = A.y + (B.y - A.y) * p;
    const ccx = A.x + (cx - A.x) * p;
    const ccy = A.y + (cy - A.y) * p;

    const tensao = Math.min(Math.abs(f.x) / 16, 1);
    const base = f.cor === 'brass' ? [150, 116, 70] : [96, 133, 170];
    const alfa = (0.42 + tensao * 0.5) * f.desenho;

    ctx.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},${alfa.toFixed(3)})`;
    ctx.lineWidth = 0.9 + tensao * 1.1;
    ctx.beginPath();
    ctx.moveTo(A.x, A.y);
    ctx.quadraticCurveTo(ccx, ccy, ex, ey);
    ctx.stroke();

    // fio retesado ganha um halo, como linha pegando luz
    if (tensao > 0.25) {
      ctx.strokeStyle = `rgba(${base[0]},${base[1]},${base[2]},${(tensao * 0.16).toFixed(3)})`;
      ctx.lineWidth = 4 + tensao * 4;
      ctx.stroke();
    }
  }

  for (const p of pins) {
    const brilho = p.brilho ? 0.62 + Math.sin(relogio * 0.02 + p.x) * 0.22 : 0.40;
    ctx.fillStyle = `rgba(182,138,78,${brilho.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  if (CALMO) return;          // parado: desenha uma vez e para
  requestAnimationFrame(quadro);
}

// ---- entrada -----------------------------------------------------------------

/**
 * Liga o campo de linhas atrás da página.
 * @param {string} [focoSeletor] elementos que retesam a teia ao receber foco
 */
export function iniciarAtmosfera(focoSeletor = '.patch') {
  if (rodando) return;
  rodando = true;

  cv = document.createElement('canvas');
  cv.className = 'campo-de-linhas';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  ctx = cv.getContext('2d');

  medir();
  ligarFoco(focoSeletor);

  let redim;
  addEventListener('resize', () => {
    clearTimeout(redim);
    redim = setTimeout(medir, 180);
  });

  addEventListener('pointermove', (e) => mover(e.clientX, e.clientY), { passive: true });
  addEventListener('pointerdown', (e) => { mover(e.clientX, e.clientY); pulso(e.clientX, e.clientY, 3.4); }, { passive: true });
  addEventListener('pointerleave', () => { ponteiro.ativo = false; ponteiro.x = ponteiro.y = -999; }, { passive: true });

  t0 = performance.now();
  requestAnimationFrame(quadro);

  if (!CALMO) setTimeout(() => pulso(W / 2, H * 0.35, 2.6), 700);
}

/**
 * Faz os elementos entrarem em cascata, cada um empurrando a teia ao assentar.
 * @param {string} seletor   o que entra
 * @param {number} atraso    espera antes do primeiro
 */
export function entrarEmCascata(seletor, atraso = 220) {
  const itens = [...document.querySelectorAll(seletor)];
  if (CALMO) {
    itens.forEach((el) => { el.style.opacity = '1'; el.style.transform = 'none'; });
    return;
  }

  itens.forEach((el, i) => {
    const espera = atraso + i * 85;
    // esconde só agora, por JS: se o CSS já nascesse invisível e o script
    // falhasse, a página inteira sumia
    el.style.opacity = '0';

    const anim = el.animate(
      [
        { opacity: 0, transform: 'translateY(26px) rotate(-1.2deg)' },
        { opacity: 1, transform: 'none' }
      ],
      { duration: 820, delay: espera, fill: 'forwards', easing: 'cubic-bezier(.16,1.1,.3,1)' }
    );
    anim.finished.then(() => { el.style.opacity = ''; }).catch(() => {});

    setTimeout(() => {
      const r = el.getBoundingClientRect();
      pulso(r.left + r.width / 2, r.top + r.height / 2, 1.5);
    }, espera + 180);
  });
}

/**
 * Costura o divisor de seção: o fio é puxado inteiro e depois assenta
 * como ponto de agulha — as duas fases de costurar de verdade.
 */
export function costurar(seletor = '.seam path', atraso = 150) {
  document.querySelectorAll(seletor).forEach((path) => {
    if (CALMO) {
      path.style.strokeDasharray = '7 5';
      path.style.strokeDashoffset = '0';
      return;
    }
    path.animate(
      [{ strokeDashoffset: 1000 }, { strokeDashoffset: 0 }],
      { duration: 1400, delay: atraso, fill: 'forwards', easing: 'cubic-bezier(.4,0,.2,1)' }
    );
    setTimeout(() => {
      path.style.transition = 'stroke-dasharray .5s ease';
      path.style.strokeDasharray = '7 5';
      path.style.strokeDashoffset = '0';
    }, atraso + 1500);
  });
}
