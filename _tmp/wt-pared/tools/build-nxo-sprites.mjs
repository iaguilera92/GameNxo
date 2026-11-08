// Genera los sprites de NXO (vista de espaldas) a partir de la hoja de animaciones.
//
//   node tools/build-nxo-sprites.mjs [ruta-a-la-hoja.png]
//
// Salida: public/assets/characters/nxo-sprites/{idle,run,runstop,forehand,backhand,serve,smash,victory}.png
//         src/characters/nxo-sprites.json   (celda, ancla, fps, frames y fotograma de impacto)
//
// Qué hace (la hoja NO tiene 8 frames por fila ni celdas fijas, así que todo se mide):
//  1. Separa las 8 filas por los valles de la proyección vertical (las filas se tocan casi).
//  2. Detecta cada frame como componente conexa; borra la pelota dibujada (la del juego es otra).
//  3. Normaliza el tamaño por fila (ancho de la cabeza + altura) sin deformar: escala uniforme.
//  4. Alinea por los pies (suelo) y por el centro del cuerpo; conserva los saltos (despegue del suelo).
//  5. Empaqueta cada animación en una tira de celdas iguales con el ancla en (centro, suelo).
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// personaje: node tools/build-nxo-sprites.mjs [hoja.png] [nxo|mai]   (por defecto nxo)
const CHAR = process.argv[3] || 'nxo';
const DEFAULT_ORDER = ['idle', 'run', 'runstop', 'forehand', 'backhand', 'serve', 'smash', 'victory'];
const CHARS = {
  nxo: { file: 'pj-nxo-sprite.png', view: 'back', rows: [155, 296, 428, 544, 663, 775, 897], hold: 2, serveWait: 3, smashStart: 3 },
  mai: { file: 'pj-mai-sprite.png', view: 'front', rows: [156, 298, 428, 548, 660, 784, 904], standHeight: 140, hold: 2, serveWait: 3, smashStart: 3 },
  // mujer (vista frontal): 5 filas; runstop, backhand y smash se derivan de las que hay
  'mai-front': {
    file: 'pj-mai-rival.png', view: 'front', rows: [206, 420, 634, 854], standHeight: 182, serveImpact: 3, hold: 1, serveWait: 2, smashStart: 1, softBalls: true, skip: { serve: 2 }, // saque: sin los 2 frames con la pelota en la mano (el juego ya la lanza)
    order: ['idle', 'run', 'forehand', 'serve', 'victory'],
    derived: [
      { name: 'runstop', parts: [['run', 6], ['idle', 0]], fps: 12, loop: false },
      { name: 'backhand', parts: 'forehand', flip: true, fps: 15, loop: false, impact: 3 },
      { name: 'smash', parts: [['serve', 0], ['serve', 1], ['serve', 2], ['serve', 3], ['serve', 4], ['serve', 5]], fps: 14, loop: false, impact: 3 },
    ],
  },
  // NXO (vista frontal): 6 filas; runstop y smash se derivan
  'nxo-front': {
    file: 'pj-nxo-rival.png', view: 'front', rows: [184, 349, 514, 670, 836], serveImpact: 3, hold: 1, serveWait: 2, smashStart: 1, softBalls: true, skip: { serve: 2 },
    order: ['idle', 'run', 'forehand', 'backhand', 'serve', 'victory'],
    derived: [
      { name: 'runstop', parts: [['run', 7], ['idle', 0]], fps: 12, loop: false },
      { name: 'smash', parts: [['serve', 0], ['serve', 1], ['serve', 2], ['serve', 3], ['serve', 4], ['serve', 5]], fps: 14, loop: false, impact: 3 },
    ],
  },
};
const CC = CHARS[CHAR];
const SRC = process.argv[2] || join(homedir(), 'Downloads', CC.file);
const OUT = join(ROOT, 'public', 'assets', 'characters', `${CHAR}-sprites`);

// Parámetros de reproducción por animación (el orden de filas de la hoja es CC.order)
const PLAY = {
  idle: { fps: 9, loop: true },
  run: { fps: 14, loop: true },
  runstop: { fps: 14, loop: false },
  forehand: { fps: 15, loop: false, impact: 4 },
  backhand: { fps: 15, loop: false, impact: 4 },
  serve: { fps: 12, loop: false, impact: 5 },
  smash: { fps: 14, loop: false, impact: 5 },
  victory: { fps: 10, loop: false },
};
const ANIMS = (CC.order || DEFAULT_ORDER).map((name) => ({ name, ...PLAY[name], ...(name === 'serve' && CC.serveImpact !== undefined ? { impact: CC.serveImpact } : {}) }));
const { w, h, px: src } = decode(SRC);
const px = Buffer.from(src);
const A = 10;
const P = (x, y) => (y * w + x) * 4;

// ---------------------------------------------------------------- 1) filas
const proj = new Int32Array(h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[P(x, y) + 3] > A) proj[y]++;
const expected = CC.rows;
const bounds = expected.map((e) => {
  let best = e, bv = 1e9;
  for (let y = e - 14; y <= e + 14; y++) if (proj[y] < bv || (proj[y] === bv && Math.abs(y - e) < Math.abs(best - e))) { bv = proj[y]; best = y; }
  return best;
});
const bandTop = [0, ...bounds], bandBot = [...bounds, h];

// ---------------------------------------------------------------- 2) pelota dibujada fuera
// núcleo amarillo de la pelota; luego se borra un círculo
// que cubre también el contorno oscuro de la pelota
const core = new Uint8Array(w * h);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  const i = P(x, y), r = px[i], g = px[i + 1], b = px[i + 2];
  // amarillo puro: r≈g y azul casi nulo (piel y encordado: r-g ≥ 40 o azul > 90)
  if (px[i + 3] > 200 && r > 150 && g > 130 && r - g < 26 && b < 70) core[y * w + x] = 1;
}
const ballSeen = new Uint8Array(w * h);
let balls = 0;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (!core[y * w + x] || ballSeen[y * w + x]) continue;
  const st = [[x, y]]; ballSeen[y * w + x] = 1;
  let n = 0, sx = 0, sy = 0; const pts = [];
  while (st.length) {
    const [cx, cy] = st.pop(); n++; sx += cx; sy += cy; pts.push([cx, cy]);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || ballSeen[ny * w + nx] || !core[ny * w + nx]) continue;
      ballSeen[ny * w + nx] = 1; st.push([nx, ny]);
    }
  }
  if (n < 60) continue; // ruido (la pelota real tiene ~250 px)
  const bx = sx / n, by = sy / n, rad = Math.sqrt(n / Math.PI) + 4.5;
  balls++;
  if (CC.softBalls) {
    // pelota aislada: borrar con holgura (resto del contorno/sombra); pelota sobre la raqueta o la mano:
    // borrar solo la pelota (+ su contorno) y rellenar el hueco con el color de alrededor
    const r0 = Math.sqrt(n / Math.PI);
    let ring = 0, tot = 0;
    for (let yy = Math.floor(by - r0 - 14); yy <= Math.ceil(by + r0 + 14); yy++) for (let xx = Math.floor(bx - r0 - 14); xx <= Math.ceil(bx + r0 + 14); xx++) {
      const d2 = (xx - bx) ** 2 + (yy - by) ** 2;
      if (d2 < (r0 + 6) ** 2 || d2 > (r0 + 14) ** 2 || xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      tot++; if (px[P(xx, yy) + 3] > A) ring++;
    }
    const touching = ring / Math.max(1, tot) > 0.08;
    const R = touching ? r0 + 3 : r0 + 10;
    const erased = [];
    for (let yy = Math.floor(by - R); yy <= Math.ceil(by + R); yy++) for (let xx = Math.floor(bx - R); xx <= Math.ceil(bx + R); xx++) {
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || (xx - bx) ** 2 + (yy - by) ** 2 > R * R) continue;
      if (px[P(xx, yy) + 3] > 0) { px[P(xx, yy) + 3] = 0; erased.push([xx, yy]); }
    }
    if (touching) {
      for (let pass = 0; pass < 5; pass++) {
        const fill = [];
        for (const [xx, yy] of erased) {
          const i = P(xx, yy); if (px[i + 3]) continue;
          let c = 0, sr = 0, sg = 0, sb = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
            const j = P(xx + dx, yy + dy); if (!dx && !dy) continue;
            if (xx + dx < 0 || yy + dy < 0 || xx + dx >= w || yy + dy >= h || px[j + 3] < 200) continue;
            c++; sr += px[j]; sg += px[j + 1]; sb += px[j + 2];
          }
          if (c >= 9) fill.push([i, sr / c, sg / c, sb / c]); // rodeado: es un hueco, no un borde
        }
        for (const [i, r, g, b] of fill) { px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255; }
        if (!fill.length) break;
      }
    }
    continue;
  }
  for (let yy = Math.floor(by - rad); yy <= Math.ceil(by + rad); yy++) for (let xx = Math.floor(bx - rad); xx <= Math.ceil(bx + rad); xx++) {
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    if ((xx - bx) ** 2 + (yy - by) ** 2 <= rad * rad) px[P(xx, yy) + 3] = 0;
  }
}
console.log(`pelotas dibujadas eliminadas: ${balls}`);

if (CC.softBalls) {
  // restos sueltos (arcos del contorno/sombra de la pelota): componentes pequeños fuera de los frames
  const seenS = new Uint8Array(w * h);
  let cleaned = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (seenS[y * w + x] || px[P(x, y) + 3] <= A) continue;
    const st = [[x, y]], pts = [];
    seenS[y * w + x] = 1;
    while (st.length) {
      const [cx, cy] = st.pop(); pts.push(P(cx, cy));
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seenS[ny * w + nx] || px[P(nx, ny) + 3] <= A) continue;
        seenS[ny * w + nx] = 1; st.push([nx, ny]);
      }
    }
    if (pts.length < 1500) { for (const i of pts) px[i + 3] = 0; cleaned++; }
  }
  console.log(`restos eliminados: ${cleaned}`);
}

// ---------------------------------------------------------------- 3) frames por fila
const frameRows = ANIMS.map((_, r) => {
  const y0 = bandTop[r], y1 = bandBot[r];
  const seen = new Uint8Array(w * (y1 - y0));
  const comps = [];
  const GAP = 4;
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const k = (y - y0) * w + x;
    if (seen[k] || px[P(x, y) + 3] <= A) continue;
    let bx0 = x, bx1 = x, by0 = y, by1 = y, n = 0; const st = [[x, y]]; seen[k] = 1;
    while (st.length) {
      const [cx, cy] = st.pop(); n++;
      if (cx < bx0) bx0 = cx; if (cx > bx1) bx1 = cx; if (cy < by0) by0 = cy; if (cy > by1) by1 = cy;
      for (let dy = -GAP; dy <= GAP; dy++) for (let dx = -GAP; dx <= GAP; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < y0 || nx >= w || ny >= y1) continue;
        const kk = (ny - y0) * w + nx;
        if (seen[kk] || px[P(nx, ny) + 3] <= A) continue;
        seen[kk] = 1; st.push([nx, ny]);
      }
    }
    comps.push({ x0: bx0, x1: bx1, y0: by0, y1: by1, n });
  }
  return { y0, y1, frames: comps.filter((c) => c.n >= 1500).sort((p, q) => p.x0 - q.x0) };
});

// ---------------------------------------------------------------- 4) métricas por frame
const dark = (x, y) => { const i = P(x, y); return px[i + 3] > 200 && px[i] < 95 && px[i + 1] < 95 && px[i + 2] < 95; };
const solid = (x, y) => {
  const i = P(x, y), r = px[i], g = px[i + 1], b = px[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return px[i + 3] > 200 && !(mn > 165 && mx - mn < 45); // fuera polvo/estela (claros y translúcidos)
};
function measure(f) {
  let gy = f.y0;
  for (let y = f.y1; y >= f.y0 && gy === f.y0; y--) for (let x = f.x0; x <= f.x1; x++) if (solid(x, y)) { gy = y; break; }
  let top = f.y0;
  for (let y = f.y0; y <= f.y1; y++) { let c = 0; for (let x = f.x0; x <= f.x1; x++) if (dark(x, y)) c++; if (c >= 12) { top = y; break; } }
  // cabeza: tramo oscuro más ancho en el 30 % superior; centro del pelo
  let headW = 0, headC = (f.x0 + f.x1) / 2;
  const zone = Math.round((gy - top) * 0.3);
  for (let y = top; y <= top + zone; y++) {
    let s = -1, last = -9;
    for (let x = f.x0; x <= f.x1 + 1; x++) {
      const d = x <= f.x1 && dark(x, y);
      if (d) { if (s < 0) s = x; last = x; }
      else if (s >= 0 && x - last > 4) { if (last - s + 1 > headW) { headW = last - s + 1; headC = (s + last) / 2; } s = -1; }
    }
  }
  // pies: centro de los píxeles sólidos de la franja inferior
  const band = Math.max(6, Math.round((gy - top) * 0.18));
  let fx0 = 1e9, fx1 = -1;
  for (let y = gy - band; y <= gy; y++) for (let x = f.x0; x <= f.x1; x++) if (solid(x, y)) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; }
  const feetC = fx1 >= fx0 ? (fx0 + fx1) / 2 : (f.x0 + f.x1) / 2;
  return { gy, top, headW, height: gy - top, headC, feetC, ax: (headC + feetC) / 2 };
}
const median = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
const pct = (a, p) => [...a].sort((q, r) => q - r)[Math.min(a.length - 1, Math.floor(a.length * p))];

frameRows.forEach((row) => { row.m = row.frames.map(measure); });
const REF_HEAD = median(frameRows[0].m.map((m) => m.headW));
const REF_H = median(frameRows[0].m.map((m) => m.height));
frameRows.forEach((row) => {
  const sH = REF_HEAD / median(row.m.map((m) => m.headW));
  const sV = REF_H / median(row.m.map((m) => m.height));
  row.scale = Math.sqrt(sH * sV); // mitad cabeza / mitad altura: reparte la diferencia sin deformar
  row.ground = pct(row.m.map((m) => m.gy), 0.75); // suelo de la fila (frames apoyados)
});

// ---------------------------------------------------------------- 5) reescalado (Catmull-Rom, alfa premultiplicado)
function cubic(t) { const a = Math.abs(t); return a < 1 ? 1.5 * a * a * a - 2.5 * a * a + 1 : a < 2 ? -0.5 * a * a * a + 2.5 * a * a - 4 * a + 2 : 0; }
function crop(f, pad) {
  const x0 = Math.max(0, f.x0 - pad), x1 = Math.min(w - 1, f.x1 + pad);
  const y0 = Math.max(0, f.y0 - pad), y1 = Math.min(h - 1, f.y1 + pad);
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function resample(c, bandY0, bandY1, s) {
  const ow = Math.round(c.w * s), oh = Math.round(c.h * s);
  const pre = new Float32Array(c.w * c.h * 4);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const gx = c.x0 + x, gyy = c.y0 + y, i = P(gx, gyy);
    const inBand = gyy >= bandY0 && gyy < bandY1; // no arrastra la fila vecina
    const a = inBand ? px[i + 3] / 255 : 0, o = (y * c.w + x) * 4;
    pre[o] = px[i] * a; pre[o + 1] = px[i + 1] * a; pre[o + 2] = px[i + 2] * a; pre[o + 3] = a;
  }
  const out = Buffer.alloc(ow * oh * 4);
  const taps = (o, n, sn) => { // tabla de taps para una dimensión
    const t = [];
    for (let i = 0; i < o; i++) {
      const sc = (i + 0.5) / s - 0.5, f = Math.floor(sc), arr = [];
      let sum = 0;
      for (let k = -1; k <= 2; k++) { const idx = Math.min(sn - 1, Math.max(0, f + k)), wt = cubic(sc - (f + k)); arr.push([idx, wt]); sum += wt; }
      t.push(arr.map(([idx, wt]) => [idx, wt / sum]));
    }
    return t;
  };
  const tx = taps(ow, c.w, c.w), ty = taps(oh, c.h, c.h);
  const tmp = new Float32Array(ow * c.h * 4);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < ow; x++) for (let k = 0; k < 4; k++) {
    let v = 0; for (const [idx, wt] of tx[x]) v += pre[(y * c.w + idx) * 4 + k] * wt; tmp[(y * ow + x) * 4 + k] = v;
  }
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const v = [0, 0, 0, 0];
    for (const [idx, wt] of ty[y]) for (let k = 0; k < 4; k++) v[k] += tmp[(idx * ow + x) * 4 + k] * wt;
    const a = Math.min(1, Math.max(0, v[3])), o = (y * ow + x) * 4;
    if (a > 0.004) { out[o] = Math.min(255, Math.max(0, Math.round(v[0] / a))); out[o + 1] = Math.min(255, Math.max(0, Math.round(v[1] / a))); out[o + 2] = Math.min(255, Math.max(0, Math.round(v[2] / a))); }
    out[o + 3] = Math.round(a * 255);
  }
  return { w: ow, h: oh, px: out };
}

// ---------------------------------------------------------------- 6) frames escalados + anclas
const items = [];
frameRows.forEach((row, r) => {
  const skip = (CC.skip && CC.skip[ANIMS[r].name]) || 0; // frames iniciales que no se usan
  row.frames.forEach((f, i) => {
    if (i < skip) return;
    const m = row.m[i], s = row.scale, c = crop(f, 3);
    const img = resample(c, row.y0, row.y1, s);
    let lift = (row.ground - m.gy) * s; // >0: en el aire (salto / zancada)
    if (lift < 5.5) lift = 0; // ruido de la hoja (3-5 px): el frame apoya
    items.push({
      anim: r, idx: i - skip, img, lift: Math.round(lift),
      ax: (m.ax - c.x0) * s, gy: (m.gy - c.y0 + 0.5) * s,
    });
  });
});
// animaciones derivadas (copias de frames de otras filas, opcionalmente en espejo)
const flipImg = (img) => {
  const o = Buffer.alloc(img.px.length);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) img.px.copy(o, (y * img.w + x) * 4, (y * img.w + (img.w - 1 - x)) * 4, (y * img.w + (img.w - x)) * 4);
  return { w: img.w, h: img.h, px: o };
};
const ALL = [...ANIMS];
const scaleOf = ANIMS.map((_, r) => frameRows[r].scale);
for (const d of CC.derived || []) {
  const r = ALL.length;
  ALL.push({ name: d.name, fps: d.fps, loop: d.loop, ...(d.impact !== undefined ? { impact: d.impact } : {}) });
  const parts = typeof d.parts === 'string' ? items.filter((it) => ALL[it.anim].name === d.parts).map((it) => [d.parts, it.idx]) : d.parts;
  scaleOf.push(scaleOf[ANIMS.findIndex((a) => a.name === parts[0][0])]);
  parts.forEach(([nm, idx], k) => {
    const srcIt = items.find((it) => ALL[it.anim].name === nm && it.idx === idx);
    if (!srcIt) throw new Error(`falta ${nm}[${idx}]`);
    items.push(d.flip
      ? { ...srcIt, anim: r, idx: k, img: flipImg(srcIt.img), ax: srcIt.img.w - srcIt.ax }
      : { ...srcIt, anim: r, idx: k });
  });
}
const PAD = 2;
let left = 0, right = 0, up = 0, down = 0;
for (const it of items) {
  left = Math.max(left, it.ax);
  right = Math.max(right, it.img.w - it.ax);
  up = Math.max(up, it.gy + it.lift);
  down = Math.max(down, it.img.h - it.gy);
}
// celda asimétrica: la estela del golpe de derecha ocupa mucho más a la derecha del cuerpo
const LEFT = Math.ceil(left) + PAD, CW = LEFT + Math.ceil(right) + PAD;
const UP = Math.ceil(up) + PAD, CH = UP + Math.ceil(down) + PAD;
if (process.env.DEBUG_SPRITES) {
  for (const it of items) console.log(`  ${ALL[it.anim].name}[${it.idx}] ancho=${it.img.w} alto=${it.img.h} ax=${it.ax.toFixed(1)} izq=${it.ax.toFixed(0)} der=${(it.img.w - it.ax).toFixed(0)} arriba=${(it.gy + it.lift).toFixed(0)} abajo=${(it.img.h - it.gy).toFixed(0)}`);
}

// ---------------------------------------------------------------- 7) tiras + JSON
mkdirSync(OUT, { recursive: true });
const cfg = { source: CC.file, view: CC.view, cell: { w: CW, h: CH }, origin: { x: +(LEFT / CW).toFixed(5), y: +(UP / CH).toFixed(5) }, standHeight: 0, hold: CC.hold, serveWait: CC.serveWait, smashStart: CC.smashStart, animations: {} };
ALL.forEach((an, r) => {
  const list = items.filter((it) => it.anim === r);
  const sw = CW * list.length, strip = Buffer.alloc(sw * CH * 4);
  list.forEach((it, k) => {
    const ox = k * CW + Math.round(LEFT - it.ax), oy = Math.round(UP - it.lift - it.gy);
    for (let y = 0; y < it.img.h; y++) {
      const dy = oy + y; if (dy < 0 || dy >= CH) continue;
      for (let x = 0; x < it.img.w; x++) {
        const dx = ox + x; if (dx < k * CW || dx >= (k + 1) * CW) continue;
        const si = (y * it.img.w + x) * 4; if (!it.img.px[si + 3]) continue;
        it.img.px.copy(strip, (dy * sw + dx) * 4, si, si + 4);
      }
    }
  });
  save(join(OUT, `${an.name}.png`), sw, CH, strip);
  cfg.animations[an.name] = { file: `${an.name}.png`, frames: list.length, fps: an.fps, loop: an.loop, ...(an.impact !== undefined ? { impact: an.impact } : {}), scale: +scaleOf[r].toFixed(3) };
});
cfg.standHeight = CC.standHeight ?? Math.round(REF_H); // alto (cabeza→suelo) del idle en px de celda
// el JSON va en src/ (se importa desde el código; Vite no permite importar desde public/)
writeFileSync(join(ROOT, 'src', 'characters', `${CHAR}-sprites.json`), JSON.stringify(cfg, null, 2));

console.log(`celda ${CW}x${CH}, suelo en y=${UP}, alto idle=${cfg.standHeight}px`);
ALL.forEach((an, r) => console.log(`  ${an.name.padEnd(9)} frames=${items.filter((i) => i.anim === r).length} escala=${scaleOf[r].toFixed(3)} saltos=[${items.filter((i) => i.anim === r).map((i) => i.lift).join(',')}]`));





