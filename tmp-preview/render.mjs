// Vista previa de sprites pixel art (temporal). Genera preview.png sin dependencias.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const GW = 20; // ancho del sprite (con 1 px de margen a cada lado)
const HY = 3; // fila donde empieza el cráneo (deja sitio para pelo de punta)

const BODY_HALF = [
  '......OSS',
  '....OOUSS',
  '...OUUUUS',
  '...OUUUUU',
  '...OTTTTT',
  '...OVVVVV',
  '...OTTTTT',
  '...OTTTTT',
  '...Ottttt',
  '...ONNNNN',
  '...ONNNNN',
  '...ONNNOO',
  '....OSSO.',
  '....OSSO.',
  '....OSSO.',
  '....OssO.',
  '....OWWO.',
  '....OWWO.',
  '...OHHHO.',
  '...OOOOO.',
];
const B = HY + 14; // primera fila del cuerpo (cuello)
const GH = B + BODY_HALF.length;

function makeGrid(hair) {
  const g = Array.from({ length: GH }, () => Array(GW).fill('.'));
  /** pinta simétrico; c en coords locales 0..8 (mitad izquierda), -1 = margen */
  const P = (L, c0, c1, ch, row = HY + L) => {
    for (let c = c0; c <= c1; c++) { g[row][c + 1] = ch; g[row][GW - 2 - c] = ch; }
  };
  /** pinta una celda suelta en coords absolutas */
  const Q = (L, col, ch) => { g[HY + L][col] = ch; };

  // cuerpo
  BODY_HALF.forEach((half, i) => [...half].forEach((ch, c) => ch !== '.' && P(0, c, c, ch, B + i)));
  // brazo libre (lado izquierdo de la pantalla)
  const A = (r, c, ch) => { g[B + r][c + 1] = ch; };
  A(2, 2, 'O'); A(3, 1, 'O'); A(3, 2, 'U'); A(4, 0, 'O'); A(4, 1, 'U'); A(4, 2, 'U');
  for (let r = 5; r <= 8; r++) { A(r, 0, 'O'); A(r, 1, 'S'); A(r, 2, 'S'); }
  A(9, 0, 'O'); A(9, 1, 'X'); A(9, 2, 'X'); A(10, 0, 'O'); A(10, 1, 'S'); A(10, 2, 'S'); A(11, 0, 'O'); A(11, 1, 'O'); A(11, 2, 'O');

  // cabeza
  P(0, 5, 8, 'O');
  P(1, 3, 4, 'O'); P(1, 5, 8, 'S');
  P(2, 2, 2, 'O'); P(2, 3, 8, 'S');
  for (let L = 3; L <= 10; L++) { P(L, 1, 1, 'O'); P(L, 2, 8, 'S'); }
  P(11, 2, 2, 'O'); P(11, 3, 8, 'S');
  P(12, 3, 4, 'O'); P(12, 5, 8, 'S');
  P(13, 5, 6, 'O'); P(13, 7, 8, 'S');
  // orejas
  for (const L of [8, 9]) { P(L, 0, 0, 'O'); P(L, 1, 1, 'S'); }
  // cara
  P(6, 4, 6, 'K');
  for (const L of [7, 8, 9]) P(L, 5, 6, 'E');
  Q(7, 6, 'h'); Q(7, 12, 'h');
  P(10, 3, 3, 'p');
  P(11, 8, 8, 'm');
  P(12, 5, 8, 's');

  hair(P, Q);
  return g;
}

// ---------------------------------------------------------------- peinados
const HAIR = {
  spiky(P) {
    P(-3, 4, 4, 'O'); P(-3, 7, 7, 'O');
    P(-2, 3, 3, 'O'); P(-2, 4, 4, 'K'); P(-2, 5, 6, 'O'); P(-2, 7, 7, 'K'); P(-2, 8, 8, 'O');
    P(-1, 2, 2, 'O'); P(-1, 3, 8, 'K');
    P(0, 1, 1, 'O'); P(0, 2, 8, 'K');
    for (const L of [1, 2, 3, 4]) { P(L, 0, 0, 'O'); P(L, 1, 8, 'K'); }
    P(2, 3, 4, 'k'); P(1, 6, 6, 'k');
    P(5, 0, 0, 'O'); P(5, 1, 3, 'K'); P(5, 5, 6, 'K'); P(5, 8, 8, 'K');
    P(6, 0, 0, 'O'); P(6, 1, 2, 'K'); P(7, 1, 1, 'K');
  },
  headband(P, Q) {
    P(-1, 3, 4, 'O'); P(-1, 6, 7, 'O');
    P(0, 2, 2, 'O'); P(0, 3, 8, 'K');
    P(1, 1, 1, 'O'); P(1, 2, 8, 'K');
    P(2, 0, 0, 'O'); P(2, 1, 8, 'K'); P(2, 3, 5, 'k');
    P(3, 0, 0, 'O'); P(3, 1, 8, 'A');
    P(4, 0, 0, 'O'); P(4, 1, 8, 'a');
    P(5, 1, 2, 'K'); P(5, 4, 4, 'K'); P(5, 7, 7, 'K');
    P(6, 1, 1, 'K');
    // colas de la cinta
    Q(3, 0, 'A'); Q(4, 0, 'a'); Q(5, 0, 'A'); Q(6, 0, 'O');
  },
  ponytail(P, Q) {
    P(0, 2, 2, 'O'); P(0, 3, 8, 'K');
    P(1, 1, 1, 'O'); P(1, 2, 8, 'K'); P(1, 3, 4, 'k');
    P(2, 0, 0, 'O'); P(2, 1, 8, 'K');
    P(3, 0, 0, 'O'); P(3, 1, 8, 'A');
    P(4, -1, -1, 'O'); P(4, 0, 8, 'a');
    P(5, 0, 8, 'O');
    for (let L = 5; L <= 12; L++) { P(L, 0, 0, 'O'); P(L, 1, 1, 'K'); }
    P(6, 2, 3, 'K');
    P(7, 4, 4, 'E'); // pestañas
    // coleta
    Q(1, 18, 'O'); Q(2, 17, 'A'); Q(2, 18, 'K'); Q(2, 19, 'O');
    for (let L = 3; L <= 8; L++) { Q(L, 18, 'K'); Q(L, 19, 'O'); }
    Q(5, 18, 'k'); Q(9, 18, 'O');
  },
  backcap(P) {
    P(-1, 4, 8, 'O');
    P(0, 2, 3, 'O'); P(0, 4, 8, 'A');
    P(1, 1, 1, 'O'); P(1, 2, 8, 'A'); P(1, 3, 4, 'w');
    P(2, 1, 1, 'O'); P(2, 2, 8, 'A');
    P(3, 0, 0, 'O'); P(3, 1, 8, 'a');
    P(2, 6, 6, 'O'); P(2, 7, 8, 'K'); P(3, 7, 8, 'K');
    P(4, 0, 0, 'O'); P(4, 1, 8, 'K'); P(4, 3, 3, 'S'); P(4, 6, 6, 'S');
    P(5, 1, 2, 'K'); P(5, 5, 5, 'K');
    P(3, -1, -1, 'O'); P(4, -1, -1, 'O'); P(5, 0, 0, 'K'); P(5, -1, -1, 'O');
  },
  afro(P) {
    P(-3, 4, 8, 'O');
    P(-2, 2, 3, 'O'); P(-2, 4, 8, 'K');
    P(-1, 1, 1, 'O'); P(-1, 2, 8, 'K'); P(-1, 4, 4, 'k'); P(-1, 7, 7, 'k');
    P(0, 0, 0, 'O'); P(0, 1, 8, 'K'); P(0, 2, 2, 'k'); P(0, 5, 5, 'k');
    P(1, -1, -1, 'O'); P(1, 0, 8, 'K'); P(1, 3, 3, 'k'); P(1, 6, 6, 'k');
    P(2, -1, -1, 'O'); P(2, 0, 8, 'K'); P(2, 1, 1, 'k'); P(2, 8, 8, 'k');
    P(3, -1, -1, 'O'); P(3, 0, 0, 'K'); P(3, 1, 8, 'A');
    P(4, -1, -1, 'O'); P(4, 0, 0, 'K'); P(4, 1, 8, 'a');
    P(5, 0, 0, 'O'); P(5, 1, 1, 'K'); P(6, 0, 0, 'O'); P(6, 1, 1, 'K');
  },
  prince(P, Q) {
    P(-1, 4, 8, 'O');
    P(0, 2, 3, 'O'); P(0, 4, 8, 'K');
    P(1, 1, 1, 'O'); P(1, 2, 8, 'K'); P(1, 4, 6, 'k');
    P(2, 0, 0, 'O'); P(2, 1, 8, 'K');
    P(3, 0, 0, 'O'); P(3, 1, 8, 'K');
    P(4, 0, 0, 'O'); P(4, 1, 8, 'K');
    // flequillo de lado (asimétrico)
    for (let c = 10; c <= 16; c++) Q(5, c, 'K');
    for (let c = 13; c <= 16; c++) Q(6, c, 'K');
    Q(7, 16, 'K'); Q(5, 2, 'K'); Q(5, 3, 'K'); Q(6, 2, 'K');
    Q(4, 12, 'k'); Q(4, 13, 'k');
  },
};

/** brazo + raqueta en horizontal; pivote (hombro) en x=1, y=5 */
function racket() {
  const W = 27, H = 10;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const p = (r, c0, c1, ch) => { for (let c = c0; c <= c1; c++) g[r][c] = ch; };
  const h = 16;
  p(0, h + 3, h + 7, 'O'); p(9, h + 3, h + 7, 'O');
  for (const r of [1, 8]) { p(r, h + 1, h + 2, 'O'); p(r, h + 8, h + 9, 'O'); p(r, h + 3, h + 7, 'F'); }
  for (const r of [2, 7]) { p(r, h, h, 'O'); p(r, h + 10, h + 10, 'O'); p(r, h + 1, h + 2, 'F'); p(r, h + 8, h + 9, 'F'); p(r, h + 3, h + 7, 'i'); }
  for (let r = 3; r <= 6; r++) { p(r, h, h, 'O'); p(r, h + 10, h + 10, 'O'); p(r, h + 1, h + 1, 'F'); p(r, h + 9, h + 9, 'F'); p(r, h + 2, h + 8, 'i'); }
  p(3, 0, 6, 'O'); p(6, 0, 6, 'O'); p(2, 6, 9, 'O'); p(7, 6, 9, 'O');
  for (const r of [4, 5]) { p(r, 0, 0, 'O'); p(r, 1, 1, 'U'); p(r, 2, 4, 'S'); p(r, 5, 6, 'X'); }
  for (let r = 3; r <= 6; r++) p(r, 7, 8, 'S');
  p(3, 9, 15, 'O'); p(6, 9, 15, 'O'); p(4, 9, 16, 'G'); p(5, 9, 16, 'G');
  return g;
}

// ---------------------------------------------------------------- paletas
const BASE = {
  O: 0x1a1428, E: 0x1a1428, h: 0xffffff, m: 0x9a2a3a, p: 0xff9a9a, w: 0xffffff,
  S: 0xffd3a6, s: 0xf0bc8c, W: 0xf4f6ff, H: 0xffffff, G: 0x5a4a7a, i: 0xf4f6ff, j: 0xb8c0dc,
  T: 0xf4f6ff, t: 0xc8d0e8, N: 0x24305e,
};
const CHARS = [
  ['spiky', { K: 0x2a3a8a, k: 0x4a62c8, U: 0x2f6fe0, V: 0xe8344a, X: 0xe8344a, F: 0xffd23f }],
  ['headband', { K: 0x6b3b1a, k: 0x9a5a2a, A: 0xf6f6fa, a: 0xc4c8dc, T: 0x4cc94a, t: 0x2f9a34, U: 0xffffff, V: 0xffd23f, N: 0xf0f0f8, X: 0xffffff, F: 0x4cc94a }],
  ['ponytail', { K: 0xff7a2e, k: 0xffb066, A: 0xff5fb0, a: 0xc23a85, U: 0xff5fb0, V: 0xff5fb0, N: 0xf0f0f8, X: 0xff5fb0, F: 0xff5fb0, S: 0xffdcbc, s: 0xf5c6a0 }],
  ['backcap', { K: 0x1e1e2a, k: 0x3a3a50, A: 0xe8344a, a: 0xa8202f, S: 0xc98a5a, s: 0xb07448, T: 0x2b2b3d, t: 0x1f1f2e, U: 0xe8344a, V: 0xffffff, N: 0x4a4a70, X: 0xe8344a, F: 0xe8344a }],
  ['afro', { K: 0x2b1d14, k: 0x55392a, A: 0xffd23f, a: 0xd9a010, S: 0x8a5230, s: 0x74422a, T: 0x9b5cff, t: 0x6f3ad0, U: 0xffd23f, V: 0xffffff, N: 0x2b2b3d, X: 0xffd23f, F: 0x9b5cff }],
  ['prince', { K: 0xffd84a, k: 0xfff0a0, S: 0xffe0c0, s: 0xf5c9a6, U: 0xffffff, V: 0x1d4aa8, X: 0x1d4aa8, F: 0x1d4aa8, N: 0x1d4aa8 }],
];

// ---------------------------------------------------------------- render
const SC = 6;
const CW = 1120, CH = 440;
const img = new Uint8Array(CW * CH * 4);
const put = (x, y, col) => {
  if (x < 0 || y < 0 || x >= CW || y >= CH) return;
  const i = (y * CW + x) * 4;
  img[i] = (col >> 16) & 255; img[i + 1] = (col >> 8) & 255; img[i + 2] = col & 255; img[i + 3] = 255;
};
const colorOf = (grid, r, c, pal) => {
  const ch = grid[r]?.[c];
  if (!ch || ch === '.') return null;
  if (ch === 'i') return (r + c) % 2 ? pal.i : pal.j;
  return pal[ch] ?? 0xff00ff;
};
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) put(x, y, Math.floor(y / 24) % 2 ? 0x3f9e4a : 0x48ad54);

function drawGrid(grid, ox, oy, pal) {
  grid.forEach((row, r) => row.forEach((_, c) => {
    const col = colorOf(grid, r, c, pal);
    if (col == null) return;
    for (let yy = 0; yy < SC; yy++) for (let xx = 0; xx < SC; xx++) put(ox + c * SC + xx, oy + r * SC + yy, col);
  }));
}
function drawRotated(grid, px, py, ax, ay, deg, pal) {
  const a = (deg * Math.PI) / 180, ca = Math.cos(a), sa = Math.sin(a);
  const R = 30 * SC;
  for (let y = ay - R; y < ay + R; y++) for (let x = ax - R; x < ax + R; x++) {
    const dx = (x + 0.5 - ax) / SC, dy = (y + 0.5 - ay) / SC;
    const u = ca * dx + sa * dy + px, v = -sa * dx + ca * dy + py;
    const col = colorOf(grid, Math.floor(v), Math.floor(u), pal);
    if (col != null) put(x, y, col);
  }
}
function sprite(style, pal, ox, oy) {
  const g = makeGrid(HAIR[style]);
  for (let y = -5; y <= 5; y++) for (let x = -60; x <= 60; x++) if ((x * x) / 3600 + (y * y) / 25 <= 1) {
    const X = ox + 10 * SC + x, Y = oy + (GH - 0.5) * SC + y; const i = (Y * CW + X) * 4; img[i] *= 0.65; img[i + 1] *= 0.65; img[i + 2] *= 0.65;
  }
  drawGrid(g, ox, oy, pal);
  drawRotated(racket(), 1, 5, ox + 16.5 * SC, oy + (B + 3.5) * SC, -60, pal);
}
CHARS.forEach(([style, pal], i) => sprite(style, { ...BASE, ...pal }, 20 + i * 182, 170));

// ---------------------------------------------------------------- PNG
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((CW * 4 + 1) * CH);
for (let y = 0; y < CH; y++) { raw[y * (CW * 4 + 1)] = 0; Buffer.from(img.buffer, y * CW * 4, CW * 4).copy(raw, y * (CW * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(CW, 0); ihdr.writeUInt32BE(CH, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(new URL('./preview2.png', import.meta.url), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('ok');
