// Arma la hoja de una BOLA DE PODER del INFERNO (hielo, viento, rayo…) a partir de una hoja con FONDO TRANSPARENTE y
// los frames repartidos en filas (p. ej. 9 = 5 + 4, o 10 = 5 + 5).
//   node tools/build-power-ball.mjs [hoja.png] [frames=9] [salida.png]
//   hielo:  node tools/build-power-ball.mjs %USERPROFILE%/Downloads/inferno-ball-ice.png 9 public/assets/inferno-ball-ice.png
//   viento: node tools/build-power-ball.mjs %USERPROFILE%/Downloads/inferno-ball-wild.png 10 public/assets/inferno-ball-wind.png
//   rayo:   node tools/build-power-ball.mjs %USERPROFILE%/Downloads/inferno-ball-light.png 10 public/assets/inferno-ball-lightning.png
// - Cada frame se separa por las franjas vacías (sin alfa) entre filas y entre columnas, en orden de lectura.
// - Igual que la bola de fuego (tools/build-inferno-ball.mjs): cada frame se centra en SU cuerpo (la pieza conexa más
//   grande) y se escala con UN solo factor para que quepa entero (cristales, hojas, chispas) en una celda de 192 px.
// - Salida: celdas de 192x192 en una rejilla de 5 columnas (el juego lee los frames 0..N-1: ver BALL_ART en
//   fx/InfernoFx.ts).
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from './png-lite.mjs';
import { saveWebp } from './image-out.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || join(homedir(), 'Downloads', 'inferno-ball-ice.png');
const NF = Number(process.argv[3] || 9);
const OUT = process.argv[4] || join(ROOT, 'public', 'assets', 'inferno-ball-ice.webp');
const CELL = 192;
const COLS = 5;
const PAD = 3;
/** alfa a partir del cual un píxel cuenta como dibujo (para separar frames y piezas) */
const A = 16;
/** margen alrededor de cada frame para no cortar su resplandor suave (los huecos entre frames miden 28 px o más) */
const MARGIN = 12;

const { w, h, px } = decode(SRC);
// restos casi invisibles del fondo (alfa 1-2): fuera
for (let i = 3; i < px.length; i += 4) if (px[i] <= 2) px[i] = 0;
const solid = (x, y) => px[(y * w + x) * 4 + 3] > A;

/** Franjas [inicio, fin] de un eje con algo de dibujo (más de 8 px de largo). */
function bands(len, has) {
  const out = [];
  let s = -1;
  for (let i = 0; i <= len; i++) {
    const on = i < len && has(i);
    if (on && s < 0) s = i;
    if (!on && s >= 0) {
      if (i - s > 8) out.push([s, i - 1]);
      s = -1;
    }
  }
  return out;
}

// ---- cajas de los frames: filas con dibujo y, dentro de cada fila, columnas con dibujo
const boxes = [];
for (const [ry0, ry1] of bands(h, (y) => { for (let x = 0; x < w; x++) if (solid(x, y)) return true; return false; })) {
  for (const [cx0, cx1] of bands(w, (x) => { for (let y = ry0; y <= ry1; y++) if (solid(x, y)) return true; return false; })) {
    boxes.push({ x0: Math.max(0, cx0 - MARGIN), x1: Math.min(w, cx1 + 1 + MARGIN), y0: Math.max(0, ry0 - MARGIN), y1: Math.min(h, ry1 + 1 + MARGIN) });
  }
}
if (boxes.length !== NF) throw new Error(`se esperaban ${NF} frames y se encontraron ${boxes.length}: ${JSON.stringify(boxes)}`);

// ---- por frame: pieza principal (centro) y extensión total
const frames = boxes.map((b, k) => {
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  const lab = new Int32Array(bw * bh).fill(-1);
  const comps = [];
  for (let y = b.y0; y < b.y1; y++)
    for (let x = b.x0; x < b.x1; x++) {
      const s = (y - b.y0) * bw + (x - b.x0);
      if (lab[s] >= 0 || !solid(x, y)) continue;
      const c = { n: 0, minX: 1e9, maxX: -1, minY: 1e9, maxY: -1 };
      const st = [[x, y]];
      lab[s] = comps.length;
      while (st.length) {
        const [qx, qy] = st.pop();
        c.n++;
        if (qx < c.minX) c.minX = qx;
        if (qx > c.maxX) c.maxX = qx;
        if (qy < c.minY) c.minY = qy;
        if (qy > c.maxY) c.maxY = qy;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = qx + dx, ny = qy + dy;
            if (nx < b.x0 || nx >= b.x1 || ny < b.y0 || ny >= b.y1) continue;
            const ns = (ny - b.y0) * bw + (nx - b.x0);
            if (lab[ns] >= 0 || !solid(nx, ny)) continue;
            lab[ns] = comps.length;
            st.push([nx, ny]);
          }
      }
      comps.push(c);
    }
  if (!comps.length) throw new Error(`frame ${k + 1} vacío`);
  const body = comps.reduce((p, q) => (q.n > p.n ? q : p));
  // extensión total (todas las piezas con algo de tamaño: ignora polvo suelto)
  let tx0 = 1e9, tx1 = -1, ty0 = 1e9, ty1 = -1;
  for (const c of comps) {
    if (c.n < 12) continue;
    tx0 = Math.min(tx0, c.minX); tx1 = Math.max(tx1, c.maxX); ty0 = Math.min(ty0, c.minY); ty1 = Math.max(ty1, c.maxY);
  }
  const cx = (body.minX + body.maxX) / 2, cy = (body.minY + body.maxY) / 2;
  return { ...b, cx, cy, ext: Math.max(cx - tx0, tx1 - cx, cy - ty0, ty1 - cy), bodyW: body.maxX - body.minX + 1, bodyH: body.maxY - body.minY + 1 };
});
const maxExt = Math.max(...frames.map((f) => f.ext));
const scale = (CELL / 2 - PAD) / maxExt;
const bodies = frames.map((f) => Math.max(f.bodyW, f.bodyH) * scale);
console.log(`hoja ${w}x${h}  ${NF} frames  extensión máxima ${maxExt.toFixed(0)} px  escala ${scale.toFixed(3)}`);
console.log('cuerpo (ancho x alto) por frame:', frames.map((f) => `${Math.round(f.bodyW * scale)}x${Math.round(f.bodyH * scale)}`).join(' '));
console.log(`cuerpo medio / celda = ${(bodies.reduce((a, b) => a + b, 0) / bodies.length / CELL).toFixed(2)} (valor de "fill" si el cuerpo debe medir como la pelota)`);

// ---- empaquetar (promedio ponderado por alfa: los bordes quedan suaves)
const ROWS = Math.ceil(NF / COLS);
const SW = CELL * COLS, SH = CELL * ROWS;
const sheet = Buffer.alloc(SW * SH * 4, 0);
const step = 1 / scale;
frames.forEach((f, k) => {
  const ox = (k % COLS) * CELL, oy = Math.floor(k / COLS) * CELL;
  for (let dy = 0; dy < CELL; dy++)
    for (let dx = 0; dx < CELL; dx++) {
      const sx0 = f.cx + (dx - CELL / 2) / scale;
      const sy0 = f.cy + (dy - CELL / 2) / scale;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = 0; yy < step; yy += 1)
        for (let xx = 0; xx < step; xx += 1) {
          const sx = Math.floor(sx0 + xx), sy = Math.floor(sy0 + yy);
          n++;
          if (sx < f.x0 || sx >= f.x1 || sy < f.y0 || sy >= f.y1) continue;
          const o = (sy * w + sx) * 4;
          const pa = px[o + 3] / 255;
          r += px[o] * pa; g += px[o + 1] * pa; b += px[o + 2] * pa; a += pa;
        }
      if (!n || a <= 0) continue;
      const di = ((oy + dy) * SW + ox + dx) * 4;
      sheet[di] = Math.min(255, Math.round(r / a));
      sheet[di + 1] = Math.min(255, Math.round(g / a));
      sheet[di + 2] = Math.min(255, Math.round(b / a));
      sheet[di + 3] = Math.min(255, Math.round((a / n) * 255));
    }
});
saveWebp(OUT, SW, SH, sheet);
console.log('listo ->', OUT, `${SW}x${SH}`);
