// PASEANTES del mapa del 2v2 (19-11-2026): recorta la hoja de ChatGPT (4 filas = 4 paseantes, 6 cuadros de caminata cada una, fondo
// verde croma, todos de perfil hacia la DERECHA) en UNA hoja de sprites WebP con celdas iguales, lista para Phaser.
//   node tools/build-paseantes.mjs [entrada.png]          (por defecto _temp/respaldo_oficial/ambientes/paseantes-parque.png: fuera de public)
// Salida: public/assets/ambientes/paseantes-parque.webp y src/view/paseantes-parque.json (celda, filas, cuadros, pies).
// Cada fila usa UNA misma ventana de recorte en sus 6 cuadros (los pies no saltan) y todas las filas se alinean por los pies.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from './png-lite.mjs';
import { fail, saveWebp } from './image-out.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] ?? join(ROOT, '..', '_temp', 'respaldo_oficial', 'ambientes', 'paseantes-parque.png');
const OUT = join(ROOT, 'public', 'assets', 'ambientes', 'paseantes-parque.webp');
const JSON_OUT = join(ROOT, 'src', 'view', 'paseantes-parque.json');
const ROWS = 4;
const COLS = 6;
/** alto final del paseante más alto (px): en la cancha se ven a ~70-90 px, así que 128 sobra para que se vean nítidos */
const TARGET_H = 128;
const PAD = 2;

if (!existsSync(SRC)) fail(`no existe ${SRC}`);
const im = decode(SRC);
const cw = Math.floor(im.w / COLS);
const ch = Math.floor(im.h / ROWS);

// 1) croma: el verde pasa a transparente; en los bordes se le quita el reflejo verde
const px = new Uint8ClampedArray(im.w * im.h * 4);
for (let i = 0; i < im.w * im.h; i++) {
  const r = im.px[i * 4];
  const g = im.px[i * 4 + 1];
  const b = im.px[i * 4 + 2];
  const m = Math.max(r, b);
  const green = g - m;
  let a = 255;
  if (green > 90) a = 0;
  else if (green > 40) a = Math.round(255 * (1 - (green - 40) / 50));
  px[i * 4] = r;
  px[i * 4 + 1] = green > 0 ? m + Math.min(green, 12) : g; // sin halo verde
  px[i * 4 + 2] = b;
  px[i * 4 + 3] = a;
}
const alpha = (x, y) => px[(y * im.w + x) * 4 + 3];

// 2) ventana de recorte de cada fila (unión de sus 6 cuadros, relativa a la casilla) y pies de la fila
const rows = [];
for (let r = 0; r < ROWS; r++) {
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  for (let c = 0; c < COLS; c++) {
    for (let y = r * ch; y < (r + 1) * ch; y++) for (let x = c * cw; x < (c + 1) * cw; x++) {
      if (alpha(x, y) < 40) continue;
      const lx = x - c * cw;
      const ly = y - r * ch;
      if (lx < x0) x0 = lx;
      if (lx > x1) x1 = lx;
      if (ly < y0) y0 = ly;
      if (ly > y1) y1 = ly;
    }
  }
  if (x1 < 0) fail(`la fila ${r + 1} está vacía`);
  rows.push({ x0, y0, x1, y1, w: x1 - x0 + 1, h: y1 - y0 + 1 });
}
const maxH = Math.max(...rows.map((q) => q.h));
const k = TARGET_H / maxH; // misma escala para todos: el niño queda más bajo que los adultos
const cellW = Math.ceil(Math.max(...rows.map((q) => q.w)) * k) + PAD * 2;
const cellH = TARGET_H + PAD * 2;

// 3) hoja final: ROWS × COLS celdas iguales; cada cuadro centrado en x y con los pies abajo; reducción por promedio de área
const W = cellW * COLS;
const H = cellH * ROWS;
const out = Buffer.alloc(W * H * 4); // Buffer: png-lite lo copia con .copy()
for (let r = 0; r < ROWS; r++) {
  const q = rows[r];
  const dw = Math.round(q.w * k);
  const dh = Math.round(q.h * k);
  for (let c = 0; c < COLS; c++) {
    const ox = c * cellW + Math.floor((cellW - dw) / 2);
    const oy = r * cellH + cellH - PAD - dh;
    for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
      // caja de la fuente que cae en este píxel
      const sx0 = c * cw + q.x0 + x / k;
      const sy0 = r * ch + q.y0 + y / k;
      const sx1 = sx0 + 1 / k;
      const sy1 = sy0 + 1 / k;
      let R = 0, G = 0, B = 0, A = 0, n = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy++) for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx++) {
        if (xx < 0 || yy < 0 || xx >= im.w || yy >= im.h) continue;
        const i = (yy * im.w + xx) * 4;
        const a = px[i + 3];
        R += px[i] * a;
        G += px[i + 1] * a;
        B += px[i + 2] * a;
        A += a;
        n++;
      }
      if (!n || !A) continue;
      const o = ((oy + y) * W + ox + x) * 4;
      out[o] = Math.round(R / A);
      out[o + 1] = Math.round(G / A);
      out[o + 2] = Math.round(B / A);
      out[o + 3] = Math.round(A / n);
    }
  }
}
mkdirSync(dirname(OUT), { recursive: true });
saveWebp(OUT, W, H, out);
const meta = { file: 'assets/ambientes/paseantes-parque.webp', cell: { w: cellW, h: cellH }, rows: ROWS, frames: COLS, feetPad: PAD, heights: rows.map((q) => Math.round(q.h * k)) };
writeFileSync(JSON_OUT, JSON.stringify(meta, null, 2) + '\n');
console.log(`listo: ${OUT} (${W}x${H}, celda ${cellW}x${cellH}, altos ${meta.heights.join(' / ')})`);
