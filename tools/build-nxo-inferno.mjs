// Procesa la hoja del INFERNO DRIVE de NXO (pj-nxo-sprite-inferno.png: 2 filas x 8 frames, con alfa).
//   node tools/build-nxo-inferno.mjs [hoja.png] [salida]
// Hace: separa los 16 frames (los de la fila 2 que se tocan por el fuego se cortan por la columna más vacía),
// escala TODO con un mismo factor (el guardia del frame 1 mide lo mismo que el idle: 140 px), alinea por los
// pies y el centro del cuerpo (píxeles oscuros: pelo y ropa) y empaqueta los 16 en una sola textura de 4 columnas.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || join(ROOT, 'public', 'personajes', 'Nxo', 'pj-nxo-sprite-inferno.png');
const OUT = process.argv[3] || join(ROOT, 'public', 'assets', 'characters', 'nxo-inferno');
const STAND_H = 140;
const COLS = 4;
const A = 12;
const FEATHER = 28; // px de la hoja original

const img = decode(SRC);
const { w, h, px } = img;
const al = (x, y) => px[(y * w + x) * 4 + 3];
const runs = (arr, min) => {
  const r = [];
  let s = -1;
  for (let i = 0; i <= arr.length; i++) {
    const on = i < arr.length && arr[i] > min;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { r.push([s, i - 1]); s = -1; }
  }
  return r;
};
const rowP = new Array(h).fill(0);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (al(x, y) > A) rowP[y]++;
const rows = runs(rowP, 0);
if (rows.length !== 2) throw new Error(`se esperaban 2 filas y hay ${rows.length}`);

const colsOf = (y0, y1) => {
  const c = new Array(w).fill(0);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) if (al(x, y) > A) c[x]++;
  return c;
};
const frames = [];
rows.forEach(([y0, y1], r) => {
  const c = colsOf(y0, y1);
  let pieces = runs(c, 0);
  // piezas que contienen varios frames (se tocan por el fuego): se cortan en la columna más vacía cerca de los límites esperados
  const cell = w / 8;
  const out = [];
  for (const [a, b] of pieces) {
    const n = Math.max(1, Math.round((b - a + 1) / (cell * 1.05)));
    if (n === 1) { out.push([a, b]); continue; }
    // cuerpos: tramos de píxeles oscuros (pelo y ropa); el corte va en la columna más vacía entre dos cuerpos
    const dark = new Array(w).fill(0);
    for (let y = y0; y <= y1; y++) for (let x = a; x <= b; x++) { const o = (y * w + x) * 4; if (px[o + 3] > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70) dark[x]++; }
    const bodies = runs(dark, 3).filter(([p, q]) => q - p > 20);
    if (bodies.length !== n) throw new Error(`fila ${r + 1}: ${n} frames esperados y ${bodies.length} cuerpos en ${a}-${b}`);
    let start = a;
    for (let i = 0; i < n - 1; i++) {
      // densidad de píxeles "sólidos" que NO son fuego (cuerpo, raqueta, manos): el corte pasa por el hueco entre
      // el cuerpo de uno y la raqueta del siguiente; el fuego se reparte a cada lado
      const solid = (x) => {
        let n2 = 0;
        for (let y = y0; y <= y1; y++) {
          const o = (y * w + x) * 4;
          if (px[o + 3] > 200 && !(px[o + 2] < 110 && px[o + 1] > 110 && px[o] > 230)) n2++;
        }
        return n2;
      };
      const lo = bodies[i][1] + 1, hi = bodies[i + 1][0] - 1;
      let bv = 1e9;
      for (let x = lo; x <= hi; x++) bv = Math.min(bv, solid(x));
      const ok = [];
      for (let x = lo; x <= hi; x++) if (solid(x) <= bv) ok.push(x);
      const best = ok[Math.floor(ok.length / 2)];
      console.log(`  corte ${i + 1}|${i + 2} en x=${best} (sólidos ${bv}, hueco ${ok.length}px)`);
      out.push([start, best - 1, i > 0 ? 'LR' : 'R']);
      start = best;
    }
    out.push([start, b, 'L']);
  }
  for (const [x0, x1, cut = ''] of out) frames.push({ row: r, x0, x1, y0, y1, cut });
});
if (frames.length !== 16) throw new Error(`se esperaban 16 frames y hay ${frames.length}: ${JSON.stringify(frames.map((f) => [f.x0, f.x1]))}`);

// métricas por frame: caja opaca, suelo (percentil de la base de los píxeles sólidos), centro del cuerpo (píxeles oscuros)
for (const f of frames) {
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, sx = 0, sn = 0;
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const o = (y * w + x) * 4, a = px[o + 3];
      if (a <= A) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (a > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70) { sx += x; sn++; }
    }
  f.bx0 = x0; f.bx1 = x1; f.by0 = y0; f.by1 = y1;
  f.cx = sn ? sx / sn : (x0 + x1) / 2;
}
// suelo de cada fila: mediana de las bases de sus frames (el pie apoyado no cambia aunque el otro se levante)
const med = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
for (const r of [0, 1]) {
  const g = med(frames.filter((f) => f.row === r).map((f) => f.by1));
  for (const f of frames) if (f.row === r) f.ground = g;
}
// escala única: el cuerpo del guardia (frame 1) de la base al pelo mide STAND_H
// la fila 2 está dibujada algo más grande: su guardia final (frame 16) se iguala al guardia del frame 1
const f1 = frames[0], f16 = frames[15];
const scale = STAND_H / (f1.ground - f1.by0);
const rowScale = [scale, (scale * (f1.ground - f1.by0)) / (f16.ground - f16.by0)];
for (const f of frames) f.sc = rowScale[f.row];
console.log(`hoja ${w}x${h}  escala fila1 ${rowScale[0].toFixed(4)}  fila2 ${rowScale[1].toFixed(4)}`);
frames.forEach((f, i) => console.log(`  frame ${i + 1}: x ${f.x0}-${f.x1}  caja ${f.bx1 - f.bx0 + 1}x${f.by1 - f.by0 + 1}  centro ${f.cx.toFixed(0)}  suelo ${f.ground}`));

// extensiones respecto al ancla (cx, suelo), ya escaladas
let L = 0, R = 0, T = 0, B = 0;
for (const f of frames) {
  L = Math.max(L, (f.cx - f.bx0) * f.sc);
  R = Math.max(R, (f.bx1 - f.cx) * f.sc);
  T = Math.max(T, (f.ground - f.by0) * f.sc);
  B = Math.max(B, (f.by1 - f.ground) * f.sc);
}
const PAD = 4;
const CW = Math.ceil(L + R) + PAD * 2, CH = Math.ceil(T + B) + PAD * 2;
const ax = Math.ceil(L) + PAD, ay = Math.ceil(T) + PAD; // ancla dentro de la celda
const ROWS = Math.ceil(16 / COLS);
const SW = CW * COLS, SH = CH * ROWS;
console.log(`celda ${CW}x${CH}  ancla (${ax}, ${ay})  textura ${SW}x${SH}`);

const sheet = Buffer.alloc(SW * SH * 4, 0);
// reescalado por promedio de área en alfa premultiplicado
function blit(f, idx) {
  const cellX = (idx % COLS) * CW, cellY = Math.floor(idx / COLS) * CH;
  for (let dy = 0; dy < CH; dy++) {
    for (let dx = 0; dx < CW; dx++) {
      // caja de origen que cubre este píxel destino
      const sx0 = f.cx + (dx - ax) / f.sc, sx1 = f.cx + (dx + 1 - ax) / f.sc;
      const sy0 = f.ground + (dy - ay) / f.sc, sy1 = f.ground + (dy + 1 - ay) / f.sc;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        if (y < f.y0 || y > f.y1) { n++; continue; }
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          n++;
          if (x < f.x0 || x > f.x1) continue;
          const o = (y * w + x) * 4;
          let pa = px[o + 3] / 255;
          // el desvanecido de los bordes de corte solo afecta al fuego (no a cuerpo, raqueta ni manos)
          if (f.cut && !(px[o + 3] > 200 && !(px[o + 2] < 110 && px[o + 1] > 110 && px[o] > 230))) {
            if (f.cut.includes('L')) pa *= Math.min(1, (x - f.x0) / FEATHER);
            if (f.cut.includes('R')) pa *= Math.min(1, (f.x1 - x) / FEATHER);
          }
          r += px[o] * pa; g += px[o + 1] * pa; b += px[o + 2] * pa; a += pa;
        }
      }
      if (!n || a <= 0) continue;
      const di = ((cellY + dy) * SW + cellX + dx) * 4;
      const al2 = a / n;
      sheet[di] = Math.min(255, Math.round(r / a)); sheet[di + 1] = Math.min(255, Math.round(g / a)); sheet[di + 2] = Math.min(255, Math.round(b / a));
      sheet[di + 3] = Math.min(255, Math.round(al2 * 255));
    }
  }
}
frames.forEach((f, i) => blit(f, i));
mkdirSync(OUT, { recursive: true });
save(join(OUT, 'inferno-swing.png'), SW, SH, sheet);

// fotogramas clave (0-based): espera = frame 8, contacto = frame 11
const cfg = {
  source: 'pj-nxo-sprite-inferno.png (2 filas x 8: INFERNO DRIVE)',
  view: 'back',
  cell: { w: CW, h: CH },
  origin: { x: +(ax / CW).toFixed(5), y: +(ay / CH).toFixed(5) },
  standHeight: STAND_H,
  cols: COLS,
  hold: 7,
  preStrike: 8,
  strikeFrom: 9,
  impact: 10,
  animations: { 'inferno-swing': { file: 'inferno-swing.png', frames: 16, fps: 15, loop: false, impact: 10 } },
};
writeFileSync(join(ROOT, 'src', 'characters', 'nxo-inferno.json'), JSON.stringify(cfg, null, 2) + '\n');
console.log('listo →', OUT);
