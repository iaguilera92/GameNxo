// Procesa la hoja EXTRA de NXO (espalda) con fondo verde: pj-nxo-sprite-2.png
//
//   node tools/build-nxo-extra.mjs [hoja2.png] [hoja-original.png] [carpeta-salida]
//
// NO toca las tiras ni los JSON actuales. Por defecto escribe en _tmp/nxo-extra/ para revisarlas
// antes de integrarlas. Hace:
//  1. Quita el fondo verde (croma con tolerancia) y limpia el halo verde de los bordes.
//  2. Separa las 8 filas y los frames de cada una (los "fantasmas" de raqueta se unen al cuerpo).
//  3. Escala cada fila para que el personaje de pie mida lo mismo que el idle de la hoja original.
//  4. Alinea por los pies y el centro del cuerpo y empaqueta cada animación en una tira.
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// 5º argumento (o por el nombre del archivo): hoja '2' o '3'
const SHEET = process.argv[5] || ((/sprite-(\d[a-z]?)/.exec(process.argv[2] || '') || [])[1] || '2');
const SRC = process.argv[2] || join(homedir(), 'Downloads', `pj-nxo-sprite-${SHEET}.png`);
const OLD = process.argv[3] || join(homedir(), 'Downloads', 'pj-nxo-sprite.png');
const OUT = process.argv[4] || join(ROOT, '_tmp', SHEET === '2' ? 'nxo-extra' : `nxo-extra${SHEET}`);

// orden de filas (de arriba abajo). impact es 0-based. Los nombres de la hoja 3 son PROVISIONALES
// hasta recibir la tabla definitiva.
const PRESETS = {
  // hoja 1b (pj-nxo-sprite-1b.png): golpes rehechos con swing completo, impacto en la columna 5
  '1b': [
    { name: 'forehand', frames: 9, fps: 15, loop: false, impact: 4 },
    { name: 'backhand', frames: 9, fps: 15, loop: false, impact: 4 },
    { name: 'forehand-power', frames: 9, fps: 15, loop: false, impact: 4 },
    { name: 'backhand-power', frames: 9, fps: 15, loop: false, impact: 4 },
    { name: 'serve', frames: 9, fps: 12, loop: false, impact: 4 },
    { name: 'smash', frames: 9, fps: 14, loop: false, impact: 4 },
  ],
  // hoja 2b: nombres PROVISIONALES hasta recibir la tabla
  '2b': [
    { name: 'r1-forehand-charged', frames: 8, fps: 14, loop: false, impact: 4 },
    { name: 'r2-backhand-charged', frames: 8, fps: 14, loop: false, impact: 4 },
    { name: 'r3-forehand-max', frames: 8, fps: 13, loop: false, impact: 4 },
    { name: 'r4-backhand-max', frames: 8, fps: 13, loop: false, impact: 3 },
    { name: 'r5', frames: 8, fps: 13, loop: false },
    { name: 'r6', frames: 8, fps: 13, loop: false },
    { name: 'r7', frames: 8, fps: 10, loop: false },
  ],
  2: [
    { name: 'forehand-charged', frames: 8, fps: 14, loop: false, impact: 4 },
    { name: 'backhand-charged', frames: 8, fps: 14, loop: false, impact: 4 },
    { name: 'forehand-max', frames: 8, fps: 13, loop: false, impact: 4 },
    { name: 'backhand-max', frames: 8, fps: 13, loop: false, impact: 4 },
    { name: 'serve-spin', frames: 9, fps: 12, loop: false, impact: 4 },
    { name: 'run-left', frames: 8, fps: 14, loop: true },
    { name: 'dash', frames: 7, fps: 14, loop: false },
    { name: 'defeat', frames: 8, fps: 9, loop: false },
  ],
  3: [
    { name: 'serve-ready', frames: 8, fps: 9, loop: true },
    { name: 'serve-bounce', frames: 8, fps: 10, loop: false },
    { name: 'dive', frames: 8, fps: 12, loop: false },
    { name: 'stunned', frames: 7, fps: 8, loop: true },
    { name: 'dash-sprint', frames: 8, fps: 14, loop: true },
    { name: 'forehand-v2', frames: 9, fps: 15, loop: false, impact: 4 },
    { name: 'backhand-v2', frames: 9, fps: 15, loop: false, impact: 4 },
    { name: 'serve-v2', frames: 9, fps: 12, loop: false, impact: 4 },
    { name: 'special-front', frames: 9, fps: 12, loop: false, impact: 4 },
  ],
  4: [
    { name: 'charge-prep', frames: 8, fps: 10, loop: false },
    { name: 'lob', frames: 8, fps: 13, loop: false, impact: 4 },
    { name: 'smash-power', frames: 8, fps: 14, loop: false, impact: 4 },
    { name: 'emergency', frames: 8, fps: 14, loop: false, impact: 3 },
    { name: 'dive-recover', frames: 8, fps: 12, loop: false, stand: 7 },
    { name: 'brake-turn', frames: 8, fps: 14, loop: false },
    { name: 'hit-reaction', frames: 8, fps: 11, loop: false },
    { name: 'turn-front', frames: 8, fps: 10, loop: false },
  ],
};
const ANIMS = PRESETS[SHEET];
if (!ANIMS) throw new Error(`hoja desconocida: ${SHEET}`);

const A = 10;
const P = (img, x, y) => (y * img.w + x) * 4;
const median = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
const pct = (a, p) => [...a].sort((q, r) => q - r)[Math.min(a.length - 1, Math.floor(a.length * p))];

// ---------------------------------------------------------------- 1) croma verde -> alfa
function chromaKey(img) {
  const px = img.px;
  const T0 = 30, T1 = 110; // d = verde - max(rojo, azul): por debajo de T0 es personaje, por encima de T1 es fondo
  let cleared = 0, partial = 0;
  for (let i = 0; i < img.w * img.h; i++) {
    const o = i * 4, r = px[o], g = px[o + 1], b = px[o + 2];
    const d = g - Math.max(r, b);
    if (d <= T0) {
      if (d > 0) px[o + 1] = Math.max(r, b); // quita el tinte verde residual (cordaje, bordes claros)
      continue;
    }
    if (d >= T1) { px[o + 3] = 0; px[o] = px[o + 1] = px[o + 2] = 0; cleared++; continue; }
    const a = (T1 - d) / (T1 - T0); // 0..1: cuánto es personaje
    // desmezclar: color = (observado - (1-a)*verde) / a
    px[o] = Math.max(0, Math.min(255, Math.round(r / a)));
    px[o + 1] = Math.max(0, Math.min(255, Math.round((g - (1 - a) * 255) / a)));
    px[o + 2] = Math.max(0, Math.min(255, Math.round(b / a)));
    px[o + 1] = Math.min(px[o + 1], Math.max(px[o], px[o + 2])); // sin verde residual
    px[o + 3] = Math.round(a * 255);
    partial++;
  }
  console.log(`croma: ${cleared} px de fondo, ${partial} px de borde desmezclados`);
}

// ---------------------------------------------------------------- 2) filas y frames
function rowBounds(img, n) {
  const proj = new Int32Array(img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) if (img.px[P(img, x, y) + 3] > A) proj[y]++;
  const out = [];
  for (let k = 1; k < n; k++) {
    const e = Math.round((k * img.h) / n);
    let best = e, bv = 1e9;
    for (let y = e - 30; y <= e + 30; y++) if (proj[y] < bv || (proj[y] === bv && Math.abs(y - e) < Math.abs(best - e))) { bv = proj[y]; best = y; }
    out.push(best);
  }
  return out;
}

function components(img, y0, y1, minN, GAP = 4) {
  const { w, px } = img;
  const seen = new Uint8Array(w * (y1 - y0));
  const out = [];
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const k = (y - y0) * w + x;
    if (seen[k] || px[P(img, x, y) + 3] <= A) continue;
    let bx0 = x, bx1 = x, by0 = y, by1 = y, n = 0;
    const st = [[x, y]];
    seen[k] = 1;
    while (st.length) {
      const [cx, cy] = st.pop();
      n++;
      if (cx < bx0) bx0 = cx; if (cx > bx1) bx1 = cx; if (cy < by0) by0 = cy; if (cy > by1) by1 = cy;
      for (let dy = -GAP; dy <= GAP; dy++) for (let dx = -GAP; dx <= GAP; dx++) {
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < y0 || nx >= w || ny >= y1) continue;
        const kk = (ny - y0) * w + nx;
        if (seen[kk] || px[P(img, nx, ny) + 3] <= A) continue;
        seen[kk] = 1;
        st.push([nx, ny]);
      }
    }
    if (n >= minN) out.push({ x0: bx0, x1: bx1, y0: by0, y1: by1, n });
  }
  return out;
}

/** Une componentes en exactamente N frames cortando por los N-1 huecos horizontales más grandes. */
function cluster(list, N) {
  list = [...list].sort((a, b) => a.x0 - b.x0);
  if (list.length < N) throw new Error(`solo ${list.length} piezas para ${N} frames`);
  const gaps = [];
  let maxX = list[0].x1;
  for (let i = 0; i < list.length - 1; i++) {
    gaps.push({ i, g: list[i + 1].x0 - maxX });
    maxX = Math.max(maxX, list[i + 1].x1);
  }
  const sorted = [...gaps].sort((a, b) => b.g - a.g);
  const cuts = sorted.slice(0, N - 1).map((c) => c.i).sort((a, b) => a - b);
  const margin = { cut: sorted[N - 2]?.g ?? 0, next: sorted[N - 1]?.g ?? -999 };
  const frames = [];
  let start = 0;
  for (const c of [...cuts, list.length - 1]) {
    const part = list.slice(start, c + 1);
    frames.push({
      x0: Math.min(...part.map((p) => p.x0)), x1: Math.max(...part.map((p) => p.x1)),
      y0: Math.min(...part.map((p) => p.y0)), y1: Math.max(...part.map((p) => p.y1)),
      n: part.reduce((s, p) => s + p.n, 0), parts: part.length,
    });
    start = c + 1;
  }
  return { frames, margin };
}

// ---------------------------------------------------------------- 3) métricas por frame
function metrics(img) {
  const { px } = img;
  const dark = (x, y) => { const i = P(img, x, y); return px[i + 3] > 200 && px[i] < 95 && px[i + 1] < 95 && px[i + 2] < 95; };
  const solid = (x, y) => {
    const i = P(img, x, y), r = px[i], g = px[i + 1], b = px[i + 2], mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    return px[i + 3] > 200 && !(mn > 165 && mx - mn < 45);
  };
  return (f) => {
    let gy = f.y0;
    for (let y = f.y1; y >= f.y0 && gy === f.y0; y--) for (let x = f.x0; x <= f.x1; x++) if (solid(x, y)) { gy = y; break; }
    let top = f.y0;
    for (let y = f.y0; y <= f.y1; y++) { let c = 0; for (let x = f.x0; x <= f.x1; x++) if (dark(x, y)) c++; if (c >= 12) { top = y; break; } }
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
    const band = Math.max(6, Math.round((gy - top) * 0.18));
    let fx0 = 1e9, fx1 = -1;
    for (let y = gy - band; y <= gy; y++) for (let x = f.x0; x <= f.x1; x++) if (solid(x, y)) { if (x < fx0) fx0 = x; if (x > fx1) fx1 = x; }
    const feetC = fx1 >= fx0 ? (fx0 + fx1) / 2 : (f.x0 + f.x1) / 2;
    return { gy, top, headW, height: gy - top, headC, feetC, ax: (headC + feetC) / 2 };
  };
}

// ---------------------------------------------------------------- referencia: idle de la hoja original
const old = decode(OLD);
{
  const hasAlpha = old.px.some((_, i) => i % 4 === 3 && old.px[i] < 255);
  if (!hasAlpha) throw new Error('la hoja original debería tener transparencia');
}
const oldIdle = cluster(components(old, 0, 155, 1500), 9).frames;
const mOld = metrics(old);
const idleM = oldIdle.map(mOld);
const REF_H = median(idleM.map((m) => m.height));
const REF_HEAD = median(idleM.map((m) => m.headW));
console.log(`referencia (idle original): alto=${REF_H}px cabeza=${REF_HEAD}px`);

// ---------------------------------------------------------------- hoja nueva
const img = decode(SRC);
console.log(`hoja: ${img.w}x${img.h}`);
chromaKey(img);
// líneas blancas separadoras entre filas (las trae la hoja 3): se borran y sirven de límite exacto
function wipeSeparators(im) {
  const rowsSep = [];
  for (let y = 0; y < im.h; y++) {
    let o = 0;
    for (let x = 0; x < im.w; x += 2) if (im.px[P(im, x, y) + 3] > A) o++;
    if (o / (im.w / 2) > 0.8) rowsSep.push(y);
  }
  const groups = [];
  for (const y of rowsSep) {
    const g = groups[groups.length - 1];
    if (g && y - g[1] <= 1) g[1] = y; else groups.push([y, y]);
  }
  for (const [a, b] of groups) for (let y = a; y <= b; y++) for (let x = 0; x < im.w; x++) im.px[P(im, x, y) + 3] = 0;
  return groups;
}
const seps = wipeSeparators(img);
const bounds = seps.length ? seps.map(([a, b]) => Math.round((a + b) / 2)) : rowBounds(img, ANIMS.length);
if (bounds.length !== ANIMS.length - 1) throw new Error(`se esperaban ${ANIMS.length} filas y se encontraron ${bounds.length + 1}`);
console.log(`separadores: ${seps.length}  límites de fila:`, bounds.join(', '));
const bandTop = [0, ...bounds], bandBot = [...bounds, img.h];
const mNew = metrics(img);

const rows = ANIMS.map((an, r) => {
  const y0 = bandTop[r], y1 = bandBot[r];
  let frames, margin;
  try {
    ({ frames, margin } = cluster(components(img, y0, y1, 250), an.frames));
  } catch {
    // menos piezas que frames (p. ej. un destello une dos frames): se fuerza la cuadrícula de abajo
    frames = [{ x0: 0, x1: img.w - 1, y0, y1: y1 - 1, n: 0, parts: 1 }];
  }
  // frames que se tocan (p. ej. tumbado en el suelo): respaldo por cuadrícula de columnas iguales
  if (Math.max(...frames.map((f) => f.x1 - f.x0)) > (1.5 * img.w) / an.frames) {
    const cw = img.w / an.frames;
    frames = [];
    for (let k = 0; k < an.frames; k++) {
      const cx0 = Math.round(k * cw), cx1 = Math.round((k + 1) * cw) - 1;
      // piezas conectadas dentro de la columna; las que tocan el borde y no son la mayor son restos del vecino
      const W = cx1 - cx0 + 1, seen = new Uint8Array(W * (y1 - y0)), pieces = [];
      for (let y = y0; y < y1; y++) for (let x = cx0; x <= cx1; x++) {
        const k0 = (y - y0) * W + (x - cx0);
        if (seen[k0] || img.px[P(img, x, y) + 3] <= A) continue;
        const pc = { x0: x, x1: x, y0: y, y1: y, n: 0, edge: false }, st = [[x, y]];
        seen[k0] = 1;
        while (st.length) {
          const [qx, qy] = st.pop();
          pc.n++;
          if (qx < pc.x0) pc.x0 = qx; if (qx > pc.x1) pc.x1 = qx; if (qy < pc.y0) pc.y0 = qy; if (qy > pc.y1) pc.y1 = qy;
          if (qx === cx0 || qx === cx1) pc.edge = true;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = qx + dx, ny = qy + dy;
            if (nx < cx0 || nx > cx1 || ny < y0 || ny >= y1) continue;
            const kk = (ny - y0) * W + (nx - cx0);
            if (seen[kk] || img.px[P(img, nx, ny) + 3] <= A) continue;
            seen[kk] = 1; st.push([nx, ny]);
          }
        }
        pieces.push(pc);
      }
      const big = pieces.reduce((a, b) => (b.n > a.n ? b : a));
      const keep = pieces.filter((pc) => pc === big || (!pc.edge && pc.n >= 30));
      frames.push({
        x0: Math.min(...keep.map((p) => p.x0)), x1: Math.max(...keep.map((p) => p.x1)),
        y0: Math.min(...keep.map((p) => p.y0)), y1: Math.max(...keep.map((p) => p.y1)),
        n: keep.reduce((t, p) => t + p.n, 0), parts: 1,
      });
    }
    margin = { cut: 'cuadricula', next: '-' };
  }
  const m = frames.map(mNew);
  const sV = REF_H / m[an.stand ?? 0].height; // el primer frame de cada fila es la postura de pie
  const sH = REF_HEAD / median(m.map((q) => q.headW));
  // media geométrica de ambas escalas (reparte la diferencia sin deformar), como la herramienta original
  return { an, y0, y1, frames, m, margin, scale: Math.sqrt(sV * sH), sV, sH, ground: pct(m.map((q) => q.gy), 0.75) };
});
for (const row of rows) {
  const solo = row.frames.filter((f) => f.parts > 1).length;
  console.log(
    `${row.an.name.padEnd(17)} frames=${row.frames.length} escala=${row.scale.toFixed(3)} (alto ${row.sV.toFixed(3)}, cabeza ${row.sH.toFixed(3)}) ` +
      `huecos: corte=${row.margin.cut} siguiente=${row.margin.next} uniones=${solo}`,
  );
}

// ---------------------------------------------------------------- 4) reescalado
function cubic(t) { const a = Math.abs(t); return a < 1 ? 1.5 * a * a * a - 2.5 * a * a + 1 : a < 2 ? -0.5 * a * a * a + 2.5 * a * a - 4 * a + 2 : 0; }
function resample(c, bandY0, bandY1, s) {
  const ow = Math.round(c.w * s), oh = Math.round(c.h * s);
  const pre = new Float32Array(c.w * c.h * 4);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const gx = c.x0 + x, gyy = c.y0 + y, i = P(img, gx, gyy);
    const inBand = gyy >= bandY0 && gyy < bandY1;
    const a = inBand ? img.px[i + 3] / 255 : 0, o = (y * c.w + x) * 4;
    pre[o] = img.px[i] * a; pre[o + 1] = img.px[i + 1] * a; pre[o + 2] = img.px[i + 2] * a; pre[o + 3] = a;
  }
  const out = Buffer.alloc(ow * oh * 4);
  const taps = (o, sn) => {
    const t = [];
    for (let i = 0; i < o; i++) {
      const sc = (i + 0.5) / s - 0.5, f = Math.floor(sc), arr = [];
      let sum = 0;
      for (let k = -1; k <= 2; k++) { const idx = Math.min(sn - 1, Math.max(0, f + k)), wt = cubic(sc - (f + k)); arr.push([idx, wt]); sum += wt; }
      t.push(arr.map(([idx, wt]) => [idx, wt / sum]));
    }
    return t;
  };
  const tx = taps(ow, c.w), ty = taps(oh, c.h);
  const tmp = new Float32Array(ow * c.h * 4);
  for (let y = 0; y < c.h; y++) for (let x = 0; x < ow; x++) for (let k = 0; k < 4; k++) {
    let v = 0; for (const [idx, wt] of tx[x]) v += pre[(y * c.w + idx) * 4 + k] * wt; tmp[(y * ow + x) * 4 + k] = v;
  }
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    const v = [0, 0, 0, 0];
    for (const [idx, wt] of ty[y]) for (let k = 0; k < 4; k++) v[k] += tmp[(idx * ow + x) * 4 + k] * wt;
    const a = Math.min(1, Math.max(0, v[3])), o = (y * ow + x) * 4;
    if (a > 0.004) for (let k = 0; k < 3; k++) out[o + k] = Math.min(255, Math.max(0, Math.round(v[k] / a)));
    out[o + 3] = Math.round(a * 255);
  }
  return { w: ow, h: oh, px: out };
}
const crop = (f, pad) => {
  const x0 = Math.max(0, f.x0 - pad), x1 = Math.min(img.w - 1, f.x1 + pad), y0 = Math.max(0, f.y0 - pad), y1 = Math.min(img.h - 1, f.y1 + pad);
  return { x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
};

const items = [];
rows.forEach((row, r) => {
  row.frames.forEach((f, i) => {
    const m = row.m[i], s = row.scale, c = crop(f, 3);
    const out = resample(c, row.y0, row.y1, s);
    let lift = (row.ground - m.gy) * s;
    if (lift < 5.5) lift = 0;
    items.push({ anim: r, idx: i, img: out, lift: Math.round(lift), ax: (m.ax - c.x0) * s, gy: (m.gy - c.y0 + 0.5) * s });
  });
});

// ---------------------------------------------------------------- 5) celda y tiras
const PAD = 2;
let left = 0, right = 0, up = 0, down = 0;
for (const it of items) {
  left = Math.max(left, it.ax);
  right = Math.max(right, it.img.w - it.ax);
  up = Math.max(up, it.gy + it.lift);
  down = Math.max(down, it.img.h - it.gy);
}
const LEFT = Math.ceil(left) + PAD, CW = LEFT + Math.ceil(right) + PAD;
const UP = Math.ceil(up) + PAD, CH = UP + Math.ceil(down) + PAD;
console.log(`celda necesaria: ${CW}x${CH} (ancla x=${LEFT}, suelo y=${UP})  | hoja original: 222x161 (ancla x=91, suelo y=150)`);
if (process.env.DEBUG_SPRITES) {
  for (const it of items) console.log(`  ${ANIMS[it.anim].name}[${it.idx}] ${it.img.w}x${it.img.h} izq=${it.ax.toFixed(0)} der=${(it.img.w - it.ax).toFixed(0)} arriba=${(it.gy + it.lift).toFixed(0)} abajo=${(it.img.h - it.gy).toFixed(0)} lift=${it.lift}`);
}

mkdirSync(OUT, { recursive: true });
const cfg = { source: `pj-nxo-sprite-${SHEET}.png`, view: 'back', cell: { w: CW, h: CH }, origin: { x: +(LEFT / CW).toFixed(5), y: +(UP / CH).toFixed(5) }, standHeight: REF_H, animations: {} };
ANIMS.forEach((an, r) => {
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
  cfg.animations[an.name] = { file: `${an.name}.png`, frames: list.length, fps: an.fps, loop: an.loop, ...(an.impact !== undefined ? { impact: an.impact } : {}), scale: +rows[r].scale.toFixed(3) };
});
writeFileSync(join(OUT, SHEET === '2' ? 'nxo-extra-sprites.json' : `nxo-extra${SHEET}-sprites.json`), JSON.stringify(cfg, null, 2));
console.log(`listo -> ${OUT}`);

