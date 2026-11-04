// Vista previa (temporal): personajes estilo "Power Tour" GBA con nuestros colores.
// Rasteriza formas simples, las sombrea con una luz y añade contorno de color.
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const W = 40;
const H = 46;
const L = normalize([-0.45, -0.65, 0.62]);
function normalize(v) {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
}

// ---------------------------------------------------------------- rampas (luz, base, sombra, contorno)
const R = {
  skinP: [0xffe0c2, 0xffc58a, 0xe39a5e, 0x8a4a24],
  skinR: [0xffd2a6, 0xf2b27c, 0xd1834d, 0x7a3e1c],
  hairP: [0x8a5a34, 0x5a3416, 0x3a1e0a, 0x1a1033],
  hairR: [0xd4b4ff, 0x9b5cff, 0x5a2db3, 0x261050],
  yellow: [0xfff0a0, 0xffcc2e, 0xd9860a, 0x6a3a00],
  white: [0xffffff, 0xf0f2fa, 0xc6cde4, 0x4a5280],
  shirtP: [0x9ad6ff, 0x3aa6ff, 0x1b5fc2, 0x0c2a66],
  shirtR: [0xffa0a8, 0xff4f5e, 0xb3202f, 0x55101a],
  shortsP: [0x5d74e6, 0x2a3fa8, 0x1b2878, 0x0c1240],
  shortsR: [0x5a5a7a, 0x2b2b3d, 0x1b1b28, 0x0a0a12],
  grip: [0x7a6aa8, 0x4a3f78, 0x2e2650, 0x15102a],
  strings: [0xffffff, 0xe8ecf8, 0xb8c0dc, 0x6a7090],
};

// ---------------------------------------------------------------- formas
const ell = (cx, cy, rx, ry) => ({ t: 'ell', cx, cy, rx, ry });
const cap = (x0, y0, x1, y1, r) => ({ t: 'cap', x0, y0, x1, y1, r });
const rr = (x0, y0, x1, y1, r) => ({ t: 'rr', x0, y0, x1, y1, r });
const poly = (...p) => ({ t: 'poly', p });
const ring = (cx, cy, rx, ry, ix, iy) => ({ t: 'ring', cx, cy, rx, ry, ix, iy });

function inside(s, x, y) {
  switch (s.t) {
    case 'ell':
      return ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1;
    case 'ring':
      return ((x - s.cx) / s.rx) ** 2 + ((y - s.cy) / s.ry) ** 2 <= 1 && ((x - s.cx) / s.ix) ** 2 + ((y - s.cy) / s.iy) ** 2 > 1;
    case 'cap': {
      const [qx, qy] = closest(s, x, y);
      return Math.hypot(x - qx, y - qy) <= s.r;
    }
    case 'rr': {
      const cx = Math.max(s.x0 + s.r, Math.min(x, s.x1 - s.r));
      const cy = Math.max(s.y0 + s.r, Math.min(y, s.y1 - s.r));
      return x >= s.x0 && x <= s.x1 && y >= s.y0 && y <= s.y1 && Math.hypot(x - cx, y - cy) <= s.r;
    }
    case 'poly': {
      let c = false;
      const p = s.p;
      for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
        const [xi, yi] = p[i];
        const [xj, yj] = p[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
      }
      return c;
    }
  }
}
function closest(s, x, y) {
  const dx = s.x1 - s.x0;
  const dy = s.y1 - s.y0;
  const t = Math.max(0, Math.min(1, ((x - s.x0) * dx + (y - s.y0) * dy) / (dx * dx + dy * dy || 1)));
  return [s.x0 + dx * t, s.y0 + dy * t];
}
function bbox(s) {
  switch (s.t) {
    case 'ell':
    case 'ring':
      return [s.cx - s.rx, s.cy - s.ry, s.cx + s.rx, s.cy + s.ry];
    case 'cap':
      return [Math.min(s.x0, s.x1) - s.r, Math.min(s.y0, s.y1) - s.r, Math.max(s.x0, s.x1) + s.r, Math.max(s.y0, s.y1) + s.r];
    case 'rr':
      return [s.x0, s.y0, s.x1, s.y1];
    case 'poly': {
      const xs = s.p.map((q) => q[0]);
      const ys = s.p.map((q) => q[1]);
      return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    }
  }
}
/** normal aproximada (volumen redondeado) */
function normal(s, x, y) {
  let nx;
  let ny;
  if (s.t === 'cap') {
    const [qx, qy] = closest(s, x, y);
    nx = (x - qx) / s.r;
    ny = (y - qy) / s.r;
  } else {
    const [a, b, c, d] = bbox(s);
    nx = (x - (a + c) / 2) / ((c - a) / 2 || 1);
    ny = (y - (b + d) / 2) / ((d - b) / 2 || 1);
  }
  const k = Math.min(1, Math.hypot(nx, ny));
  const sc = Math.hypot(nx, ny) > 1 ? 1 / Math.hypot(nx, ny) : 1;
  nx *= sc * 0.85;
  ny *= sc * 0.85;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  void k;
  return [nx, ny, nz];
}

// ---------------------------------------------------------------- rasterizado
function rasterize(prims, stamps) {
  const id = new Int16Array(W * H).fill(-1);
  const tone = new Int8Array(W * H);
  const byName = {};
  prims.forEach((p, i) => p.name && (byName[p.name] = i));
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      for (let i = 0; i < prims.length; i++) {
        const p = prims[i];
        if (p.yMax !== undefined && py > p.yMax) continue;
        if (p.yMin !== undefined && py < p.yMin) continue;
        if (!inside(p.s, px, py)) continue;
        if (p.clip && !inside(prims[byName[p.clip]].s, px, py)) continue;
        id[y * W + x] = i;
      }
    }
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = id[y * W + x];
      if (i < 0) continue;
      const p = prims[i];
      const n = normal(p.s, x + 0.5, y + 0.5);
      const li = n[0] * L[0] + n[1] * L[1] + n[2] * L[2];
      let t = p.flat ?? (li > 0.8 ? 0 : li > 0.36 ? 1 : 2);
      // sombra proyectada bajo cabeza/pelo/gorra
      for (const dy of [1, 2]) {
        const j = y - dy >= 0 ? id[(y - dy) * W + x] : -1;
        if (j >= 0 && j !== i && prims[j].caster && prims[j].g !== p.g) t = Math.min(2, Math.max(t, 1) + 1);
      }
      tone[y * W + x] = t;
    }
  // contornos: exterior oscuro, interior (entre piezas) en tono sombra
  const out = tone.slice();
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = id[y * W + x];
      if (i < 0) continue;
      let ext = false;
      let int = false;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const X = x + dx;
        const Y = y + dy;
        const j = X < 0 || Y < 0 || X >= W || Y >= H ? -1 : id[Y * W + X];
        if (j < 0) ext = true;
        else if (j > i && prims[j].g !== prims[i].g) int = true;
      }
      if (ext) out[y * W + x] = 3;
      else if (int) out[y * W + x] = Math.max(out[y * W + x], prims[i].line ?? 2);
    }
  const col = new Int32Array(W * H).fill(-1);
  for (let k = 0; k < W * H; k++) {
    const i = id[k];
    if (i < 0) continue;
    const p = prims[i];
    let t = out[k];
    if (p.check && t < 3) t = ((k % W) + Math.floor(k / W)) % 2 ? 1 : 2;
    col[k] = p.m[t];
  }
  for (const [x, y, c] of stamps) if (x >= 0 && y >= 0 && x < W && y < H) col[y * W + x] = c;
  return col;
}

// ---------------------------------------------------------------- personajes (centro X = 18)
const INK = 0x1a1033;
const MOUTH = 0x8a2030;
const BLUSH = 0xff8a8a;
const mir = (x) => 35 - x;

function body(c) {
  const P = [];
  const add = (name, g, m, s, o = {}) => P.push({ name, g, m, s, ...o });
  // piernas, calcetines, zapatillas
  add('legL', 'legL', c.skin, cap(15.2, 34, 15.2, 41, 2.1));
  add('legR', 'legR', c.skin, cap(20.8, 34, 20.8, 41, 2.1));
  add('sockL', 'sockL', R.white, rr(13.1, 38.6, 17.3, 41.6, 1));
  add('sockR', 'sockR', R.white, rr(18.7, 38.6, 22.9, 41.6, 1));
  add('shoeL', 'shoeL', c.shoe, ell(14.4, 42.7, 4, 2.4));
  add('shoeR', 'shoeR', c.shoe, ell(21.6, 42.7, 4, 2.4));
  // shorts y torso
  add('shorts', 'shorts', c.shorts, rr(10.6, 29.4, 25.4, 35.2, 2.5));
  add('torso', 'torso', c.shirt, rr(10.2, 20.4, 25.8, 31, 4.2));
  // brazo libre (izquierda de la pantalla)
  add('slvL', 'slvL', c.shirt, ell(10.4, 22.9, 2.9, 2.7));
  add('armL', 'armL', c.skin, cap(9.3, 24.6, 8.6, 29.4, 1.7));
  add('bandL', 'bandL', R.white, rr(6.7, 27.4, 10.9, 29, 0.6));
  add('handL', 'armL', c.skin, ell(8.5, 30.5, 2.1, 2));
  // brazo de la raqueta (derecha) + raqueta
  add('slvR', 'slvR', c.shirt, ell(25.6, 22.9, 2.9, 2.7));
  add('armR', 'armR', c.skin, cap(26.6, 22.2, 29, 18.2, 1.7));
  add('grip', 'grip', R.grip, cap(29.8, 16.4, 31.8, 10.4, 0.95));
  add('handR', 'armR', c.skin, ell(29.4, 17, 2.1, 2.1));
  add('str', 'rk', R.strings, ell(33.2, 6.2, 3.5, 4.5), { check: true });
  add('frame', 'rk2', c.frame, ring(33.2, 6.2, 4.4, 5.4, 3.4, 4.4));
  return { P, add };
}

function face(c, smirk) {
  const st = [];
  const S = (x, y, col) => st.push([x, y, col]);
  const both = (x, y, col) => {
    S(x, y, col);
    S(mir(x), y, col);
  };
  // ojos grandes (2 de iris + 1 de blanco)
  for (const x of [12, 13, 14]) both(x, 12, INK);
  for (const y of [13, 14]) {
    both(12, y, 0xffffff);
    both(13, y, INK);
    both(14, y, INK);
  }
  both(13, 15, INK);
  both(14, 15, INK);
  S(13, 13, 0xffffff);
  S(21, 13, 0xffffff);
  // nariz, mejillas, boca
  S(18, 16, c.skin[2]);
  both(12, 16, BLUSH);
  if (smirk) {
    S(20, 17, INK);
    for (const x of [16, 17, 18, 19]) S(x, 18, INK);
  } else {
    both(15, 17, INK);
    both(16, 18, INK);
    S(17, 18, MOUTH);
    S(18, 18, MOUTH);
  }
  return st;
}

function chest(c, st, front) {
  // emblema: aro blanco con centro de color
  st.push([17, 25, c.emblem], [18, 25, c.emblem]);
  if (!front) st.push([17, 24, c.emblem], [18, 24, c.emblem], [17, 26, c.emblem], [18, 26, c.emblem]);
  // franja de color en las zapatillas y en el short
  for (const x of [12, 13, 14, 15]) st.push([x, 42, c.accent[1]], [mir(x), 42, c.accent[1]]);
  for (const y of [30, 31, 32, 33]) st.push([11, y, c.accent[1]], [24, y, c.accent[1]]);
  // separación de piernas del short
  st.push([17, 34, c.shorts[3]], [18, 34, c.shorts[3]]);
}

/** Jugador: gorra amarilla, pelo castaño, camiseta azul, short azul marino. */
function player(front) {
  const c = { skin: R.skinP, shirt: R.shirtP, shorts: R.shortsP, shoe: R.white, frame: R.yellow, emblem: 0xffcc2e, accent: R.shirtP };
  const { P, add } = body(c);
  add('neck', 'neck', c.skin, rr(15.8, 19, 20.2, 22.4, 1));
  if (front) {
    add('collar', 'collar', R.white, poly([14.4, 20.3], [21.6, 20.3], [18, 24.4]));
    add('vneck', 'neck', c.skin, poly([15.8, 20.3], [20.2, 20.3], [18, 23]));
  } else add('collar', 'collar', R.white, rr(14.6, 19.9, 21.4, 21.8, 0.8));
  add('emb', 'emb', R.white, ell(18, 25, front ? 2.4 : 3.2, front ? 2.2 : 3));
  add('hairB', 'hairB', R.hairP, ell(18, 10.4, 9.3, 6.8));
  add('earL', 'earL', c.skin, ell(9.6, 14.3, 1.7, 2.1));
  add('earR', 'earR', c.skin, ell(26.4, 14.3, 1.7, 2.1));
  add('head', 'head', c.skin, ell(18, 13, 8.6, 8.2), { caster: true });
  if (front) {
    add('tuftL', 'hair', R.hairP, ell(10.8, 12.6, 1.6, 2.8), { clip: 'head' });
    add('tuftR', 'hair', R.hairP, ell(25.2, 12.6, 1.6, 2.8), { clip: 'head' });
    add('bangs', 'hair', R.hairP,
      poly([10, 7], [26, 7], [25.8, 10.6], [23.6, 9.2], [21.8, 11.2], [19.8, 9.3], [17.6, 10.8], [15.4, 9.2], [13.3, 11], [11.4, 9.3], [10.2, 10.7]),
      { clip: 'head', caster: true });
  } else {
    add('hairF', 'hairF', R.hairP, ell(18, 13.2, 8.8, 8.2), { clip: 'head', yMax: 18.6, caster: true });
  }
  add('cap', 'cap', R.yellow, ell(18, 7.6, 8.9, 5.4), { yMax: front ? 8.5 : 9.6, caster: true });
  if (front) {
    add('logo', 'logo', R.white, ell(18, 5.4, 2.1, 1.8), { flat: 1 });
    add('brim', 'brim', R.yellow, ell(18, 8.9, 9.7, 1.9), { caster: true, line: 3 });
  }
  const st = front ? face(c, false) : [];
  if (front) st.push([17, 5, R.shirtP[1]], [18, 5, R.shirtP[1]]);
  else st.push([16, 8, R.yellow[3]], [17, 9, R.hairP[1]], [18, 9, R.hairP[1]], [19, 8, R.yellow[3]]);
  chest(c, st, front);
  return rasterize(P, st);
}

/** Rival: pelo morado de punta, cinta blanca, camiseta roja, zapatillas amarillas. */
function rival(front) {
  const c = { skin: R.skinR, shirt: R.shirtR, shorts: R.shortsR, shoe: R.yellow, frame: R.shirtR, emblem: 0xb3202f, accent: R.shirtR };
  const { P, add } = body(c);
  add('neck', 'neck', c.skin, rr(15.8, 19, 20.2, 22.4, 1));
  if (front) {
    add('collar', 'collar', R.white, poly([14.4, 20.3], [21.6, 20.3], [18, 24.4]));
    add('vneck', 'neck', c.skin, poly([15.8, 20.3], [20.2, 20.3], [18, 23]));
  } else add('collar', 'collar', R.white, rr(14.6, 19.9, 21.4, 21.8, 0.8));
  add('emb', 'emb', R.white, ell(18, 25, front ? 2.4 : 3.2, front ? 2.2 : 3));
  add('hairB', 'hairB', R.hairR, ell(18, 10, 9.5, 7.2));
  add('spk1', 'hairB', R.hairR, poly([9.6, 9.5], [8.4, 1.4], [14.4, 5.6]));
  add('spk2', 'hairB', R.hairR, poly([12.8, 6], [14.6, 0.4], [18.6, 4.6]));
  add('spk3', 'hairB', R.hairR, poly([17.4, 4.6], [21.8, 0.2], [23, 6]));
  add('spk4', 'hairB', R.hairR, poly([22.2, 5.8], [27.8, 1.6], [26.6, 9.6]));
  add('earL', 'earL', c.skin, ell(9.6, 14.3, 1.7, 2.1));
  add('earR', 'earR', c.skin, ell(26.4, 14.3, 1.7, 2.1));
  add('head', 'head', c.skin, ell(18, 13, 8.6, 8.2), { caster: true });
  if (front) {
    add('fringe', 'hair', R.hairR,
      poly([9, 7], [27, 7], [27, 9.8], [24.4, 8.6], [22.6, 11], [20, 8.8], [17.6, 11], [15, 8.8], [12.6, 10.8], [9, 9.4]),
      { clip: 'head', caster: true });
  } else {
    add('hairF', 'hairF', R.hairR, ell(18, 13.2, 8.8, 8.2), { clip: 'head', yMax: 18.6, caster: true });
  }
  add('dome', 'hairB', R.hairR, ell(18, 7.2, 8.8, 5.2), { yMax: 6.6 });
  add('band', 'band', R.white, rr(8.6, 6.3, 27.4, 8.3, 0.6), { clip: 'hairB', caster: true, line: 3 });
  add('tail', 'band', R.white, poly([9.4, 6.8], [5.2, 9.6], [6.4, 11.2], [9.8, 8.4]));
  const st = front ? face(c, true) : [];
  if (front) for (const x of [12, 13, 14]) st.push([x, 11, R.hairR[3]], [mir(x), 11, R.hairR[3]]);
  st.push([25, 7, R.shirtR[1]], [26, 7, R.shirtR[1]]);
  chest(c, st, front);
  return rasterize(P, st);
}

// ---------------------------------------------------------------- lienzo
const CW = 1120;
const CH = 600;
const img = new Uint8Array(CW * CH * 4);
const put = (x, y, col, a = 1) => {
  x = Math.floor(x);
  y = Math.floor(y);
  if (x < 0 || y < 0 || x >= CW || y >= CH) return;
  const i = (y * CW + x) * 4;
  img[i] = img[i] * (1 - a) + ((col >> 16) & 255) * a;
  img[i + 1] = img[i + 1] * (1 - a) + ((col >> 8) & 255) * a;
  img[i + 2] = img[i + 2] * (1 - a) + (col & 255) * a;
  img[i + 3] = 255;
};
const lerp = (a, b, t) => {
  const r = ((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * t);
  const g = ((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * t);
  const bl = (a & 255) + (((b & 255) - (a & 255)) * t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
};

// fondo: degradado de nuestro estadio + suelo de pista
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) put(x, y, lerp(0x0f1d52, 0x1f3a8f, y / CH));
for (let y = 300; y < CH; y++) for (let x = 0; x < 760; x++) put(x, y, lerp(0x4a9cff, 0x2f78dc, (y - 300) / 300));
for (let x = 0; x < 760; x++) for (let k = 0; k < 5; k++) put(x, 470 + k, 0xffffff);

function drawSprite(col, ox, oy, sc) {
  // sombra en el suelo
  const fx = ox + 18 * sc;
  const fy = oy + 44.6 * sc;
  for (let y = -3 * sc; y <= 3 * sc; y++)
    for (let x = -11 * sc; x <= 11 * sc; x++) if ((x * x) / (11 * sc) ** 2 + (y * y) / (3 * sc) ** 2 <= 1) put(fx + x, fy + y, 0x000000, 0.3);
  const w = Math.round(W * sc);
  const h = Math.round(H * sc);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = col[Math.floor(y / sc) * W + Math.floor(x / sc)];
      if (c >= 0) put(ox + x, oy + y, c);
    }
}

// fila grande: jugador frente, jugador espalda, rival frente
drawSprite(player(true), 10, 120, 5.5);
drawSprite(player(false), 255, 120, 5.5);
drawSprite(rival(true), 500, 120, 5.5);

// mini escena a tamaño de juego (perspectiva aproximada de nuestra cancha)
const X0 = 780;
const X1 = 1110;
for (let y = 20; y < 580; y++) for (let x = X0; x < X1; x++) put(x, y, 0x2a66cc);
const nearY = 540;
const farY = 160;
const cxm = (X0 + X1) / 2;
const halfAt = (y) => 70 + ((y - farY) / (nearY - farY)) * 90; // medio ancho de la pista
for (let y = farY; y <= nearY; y++) {
  const hw = halfAt(y) * 1.27;
  for (let x = Math.floor(cxm - hw); x <= cxm + hw; x++) put(x, y, lerp(0x2f78dc, 0x4a9cff, (y - farY) / (nearY - farY)));
}
const hline = (y, k = 1.27) => { const hw = halfAt(y) * k; for (let x = cxm - hw; x <= cxm + hw; x++) for (let t = 0; t < 3; t++) put(x, y + t, 0xffffff); };
const vline = (k) => { for (let y = farY; y <= nearY; y++) for (let t = 0; t < 3; t++) put(cxm + halfAt(y) * k + t - 1, y, 0xffffff); };
hline(farY); hline(nearY);
for (const k of [-1.27, -1, 1, 1.27]) vline(k);
const svc1 = farY + (nearY - farY) * 0.26;
const svc2 = farY + (nearY - farY) * 0.7;
hline(svc1, 1); hline(svc2, 1);
for (let y = svc1; y <= svc2; y++) for (let t = 0; t < 3; t++) put(cxm + t - 1, y, 0xffffff);
const netY = farY + (nearY - farY) * 0.45;
for (let x = cxm - halfAt(netY) * 1.35; x <= cxm + halfAt(netY) * 1.35; x++) {
  for (let t = 0; t < 22; t++) put(x, netY - t, 0x2b2b40, 0.55);
  for (let t = 0; t < 4; t++) put(x, netY - 22 + t, 0xffffff);
}
drawSprite(rival(true), cxm - 18 * 1.3, farY - 44 * 1.3, 1.3);
drawSprite(player(false), cxm - 18 * 3 - 30, nearY - 44 * 3 + 4, 3);

// ---------------------------------------------------------------- PNG
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((CW * 4 + 1) * CH);
for (let y = 0; y < CH; y++) { raw[y * (CW * 4 + 1)] = 0; Buffer.from(img.buffer, y * CW * 4, CW * 4).copy(raw, y * (CW * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(CW, 0); ihdr.writeUInt32BE(CH, 4); ihdr[8] = 8; ihdr[9] = 6;
writeFileSync(new URL('./preview-pt.png', import.meta.url), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('ok');
