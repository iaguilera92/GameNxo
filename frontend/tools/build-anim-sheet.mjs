// Hoja ANIMADA genérica de 8 frames (2 filas x 4 sobre verde croma, 1536x1024) → celdas cuadradas en 4 x 2 (18-11-2026).
//   node tools/build-anim-sheet.mjs <fuente.png> <salida.webp> [celda=192]
// Usos: EMOTE LEGENDARIO animado (personajes/Nxo/emojis/animados/ → assets/emotes/emote-nxo-legendario-*.webp; ui/Emotes.ts).
// - Verde -> alfa (con despill), igual que tools/build-dragon-ball.mjs.
// - Todos los frames comparten el MISMO recorte (unión de lo ocupado en su casilla): el dibujo no salta entre frames.
// - El lado mayor del recorte cabe en la celda (con margen).
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from './png-lite.mjs';
import { saveWebp } from './image-out.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2];
const OUT = process.argv[3];
if (!SRC || !OUT) throw new Error('uso: node tools/build-anim-sheet.mjs <fuente.png> <salida.webp> [celda]');
const COLS = 4;
const ROWS = 2;
const NF = COLS * ROWS;
const CELL = Number(process.argv[4] || 192);
const PAD = 4;
const A = 30; // alfa mínimo que cuenta para el recorte (ignora el halo casi transparente)

const img = decode(SRC);
const { w, h } = img;
const px = Buffer.alloc(w * h * 4);
for (let i = 0; i < px.length; i += 4) {
  const r = img.px[i], g = img.px[i + 1], b = img.px[i + 2];
  const m = Math.max(r, b);
  const d = g - m;
  const a = d > 70 ? 0 : d < 25 ? 255 : Math.round((255 * (70 - d)) / 45);
  px[i] = r;
  px[i + 1] = a < 255 ? Math.min(g, m) : g;
  px[i + 2] = b;
  px[i + 3] = a;
}
const cw = w / COLS;
const ch = h / ROWS;
// unión de lo ocupado, en coordenadas de la casilla
let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
for (let k = 0; k < NF; k++) {
  const ox = Math.round((k % COLS) * cw), oy = Math.round(Math.floor(k / COLS) * ch);
  for (let y = 2; y < ch - 2; y++)
    for (let x = 2; x < cw - 2; x++) {
      if (px[((oy + y) * w + ox + x) * 4 + 3] <= A) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
}
if (x1 < 0) throw new Error('hoja vacía');
const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
const scale = (CELL - PAD * 2) / Math.max(bw, bh);
const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
console.log(`fuente ${w}x${h} · recorte ${bw}x${bh} · escala ${scale.toFixed(3)}`);
const SW = CELL * COLS, SH = CELL * ROWS;
const sheet = Buffer.alloc(SW * SH * 4, 0);
const step = Math.max(1, 1 / scale);
for (let k = 0; k < NF; k++) {
  const ox = Math.round((k % COLS) * cw), oy = Math.round(Math.floor(k / COLS) * ch);
  const dx0 = (k % COLS) * CELL, dy0 = Math.floor(k / COLS) * CELL;
  for (let dy = 0; dy < CELL; dy++)
    for (let dx = 0; dx < CELL; dx++) {
      const sx0 = ox + cx + (dx - CELL / 2) / scale;
      const sy0 = oy + cy + (dy - CELL / 2) / scale;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = 0; yy < step; yy++)
        for (let xx = 0; xx < step; xx++) {
          const sx = Math.floor(sx0 + xx), sy = Math.floor(sy0 + yy);
          n++;
          if (sx < ox || sx >= ox + cw || sy < oy || sy >= oy + ch) continue;
          const o = (sy * w + sx) * 4;
          const pa = px[o + 3] / 255;
          r += px[o] * pa; g += px[o + 1] * pa; b += px[o + 2] * pa; a += pa;
        }
      if (!n || a <= 0) continue;
      const di = ((dy0 + dy) * SW + dx0 + dx) * 4;
      sheet[di] = Math.min(255, Math.round(r / a));
      sheet[di + 1] = Math.min(255, Math.round(g / a));
      sheet[di + 2] = Math.min(255, Math.round(b / a));
      sheet[di + 3] = Math.min(255, Math.round((a / n) * 255));
    }
}
saveWebp(OUT, SW, SH, sheet);
console.log('listo ->', OUT, `${SW}x${SH} (celdas de ${CELL})`);
