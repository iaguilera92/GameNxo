// PASEANTES del mapa del 2v2 (19-11-2026): recorta la hoja de ChatGPT (4 filas = 4 paseantes, 6 cuadros de caminata cada una, fondo
// verde croma, todos de perfil hacia la DERECHA) en UNA hoja de sprites WebP con celdas iguales, lista para Phaser.
//   node tools/build-paseantes.mjs [entrada.png] [nombre] [filas] [columnas]   (fondo croma verde o ya transparente)          (por defecto _temp/respaldo_oficial/ambientes/paseantes-parque.png: fuera de public)
// Salida: public/assets/ambientes/paseantes-parque.webp y src/view/paseantes-parque.json (celda, filas, cuadros, pies).
// Cada fila usa UNA misma ventana de recorte en sus 6 cuadros (los pies no saltan) y todas las filas se alinean por los pies.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from './png-lite.mjs';
import { fail, saveWebp } from './image-out.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] ?? join(ROOT, '..', '_temp', 'respaldo_oficial', 'ambientes', 'paseantes-parque.png');
const NAME = process.argv[3] ?? 'paseantes-parque'; // (21-11-2026) 2.º argumento: nombre de la hoja (p. ej. paseantes-nieve)
const OUT = join(ROOT, 'public', 'assets', 'ambientes', NAME + '.webp');
const JSON_OUT = join(ROOT, 'src', 'view', NAME + '.json');
const ROWS = Number(process.argv[4] ?? 4); // (21-11-2026) 3.er argumento: filas de la hoja (los espectadores traen 3)
const COLS = Number(process.argv[5] ?? 6); // (22-11-2026) 4.º argumento: cuadros por fila (la hoja nueva del parque trae 8)
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
  px[i * 4 + 3] = Math.round((a * im.px[i * 4 + 3]) / 255); // (22-11-2026) respeta la transparencia de la hoja (las que ya vienen sin fondo)
}
const alpha = (x, y) => px[(y * im.w + x) * 4 + 3];

// (22-11-2026) filas REALES (por los huecos vacíos entre ellas): una figura que asoma sobre su casilla ya no queda cortada
const RY = (() => {
  const runs = [];
  let start = -1;
  for (let y = 0; y <= im.h; y++) {
    let on = false;
    if (y < im.h) for (let x = 0; x < im.w; x += 2) if (alpha(x, y) >= 40) { on = true; break; }
    if (on && start < 0) start = y;
    if (!on && start >= 0) { runs.push([start, y - 1]); start = -1; }
  }
  const big = runs.filter((q) => q[1] - q[0] >= 12);
  if (big.length === ROWS) return big;
  console.warn(`filas: ${big.length} (se esperaban ${ROWS}): rejilla fija`);
  return Array.from({ length: ROWS }, (_, r) => [r * ch, (r + 1) * ch - 1]);
})();

// (22-11-2026) columnas REALES de cada fila: las hojas de ChatGPT no siempre caen en una rejilla exacta (en la del parque de 8 columnas
// cada figura invadía la casilla de al lado). Se buscan las figuras por los huecos vacíos entre ellas; si no salen COLS, rejilla fija.
const segs = [];
for (let r = 0; r < ROWS; r++) {
  const runs = [];
  let start = -1;
  for (let x = 0; x <= im.w; x++) {
    let on = false;
    if (x < im.w) for (let y = RY[r][0]; y < (RY[r][1] + 1); y += 2) if (alpha(x, y) >= 40) { on = true; break; }
    if (on && start < 0) start = x;
    if (!on && start >= 0) { runs.push([start, x - 1]); start = -1; }
  }
  // une trozos separados por huecos de menos de 4 px y quita motas sueltas
  const merged = [];
  for (const q of runs) { const l = merged[merged.length - 1]; if (l && q[0] - l[1] < 4) l[1] = q[1]; else merged.push([...q]); }
  const big = merged.filter((q) => q[1] - q[0] >= 12);
  if (big.length === COLS) segs.push(big);
  else { console.warn(`fila ${r + 1}: ${big.length} figuras (se esperaban ${COLS}): rejilla fija`); segs.push(null); }
}
/** origen (x de la fuente) y tramo propio del cuadro c de la fila r */
const cellX = (r, c, w) => (segs[r] ? Math.round((segs[r][c][0] + segs[r][c][1]) / 2 - w / 2) : c * cw);
const inCell = (r, c, x) => (segs[r] ? x >= segs[r][c][0] && x <= segs[r][c][1] : true);

// 2) ventana de recorte de cada fila (unión de sus 6 cuadros, relativa a la casilla) y pies de la fila
const rows = [];
for (let r = 0; r < ROWS; r++) {
  let x0 = cw, y0 = ch, x1 = -1, y1 = -1;
  if (segs[r]) {
    // ventana = la figura más ancha de la fila; cada cuadro se centra en la suya
    const wMax = Math.max(...segs[r].map((q) => q[1] - q[0] + 1));
    for (let c = 0; c < COLS; c++) for (let y = RY[r][0]; y < (RY[r][1] + 1); y++) for (let x = segs[r][c][0]; x <= segs[r][c][1]; x++) {
      if (alpha(x, y) < 40) continue;
      const ly = y - RY[r][0];
      if (ly < y0) y0 = ly;
      if (ly > y1) y1 = ly;
    }
    rows.push({ x0: 0, y0, x1: wMax - 1, y1, w: wMax, h: y1 - y0 + 1 });
    continue;
  }
  for (let c = 0; c < COLS; c++) {
    for (let y = RY[r][0]; y < (RY[r][1] + 1); y++) for (let x = c * cw; x < (c + 1) * cw; x++) {
      if (alpha(x, y) < 40) continue;
      const lx = x - c * cw;
      const ly = y - RY[r][0];
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
      const sx0 = cellX(r, c, q.w) + q.x0 + x / k;
      const sy0 = RY[r][0] + q.y0 + y / k;
      const sx1 = sx0 + 1 / k;
      const sy1 = sy0 + 1 / k;
      let R = 0, G = 0, B = 0, A = 0, n = 0;
      for (let yy = Math.floor(sy0); yy < Math.ceil(sy1); yy++) for (let xx = Math.floor(sx0); xx < Math.ceil(sx1); xx++) {
        if (xx < 0 || yy < 0 || xx >= im.w || yy >= im.h || !inCell(r, c, xx)) continue;
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
const meta = { file: `assets/ambientes/${NAME}.webp`, cell: { w: cellW, h: cellH }, rows: ROWS, frames: COLS, feetPad: PAD, heights: rows.map((q) => Math.round(q.h * k)) };
writeFileSync(JSON_OUT, JSON.stringify(meta, null, 2) + '\n');
console.log(`listo: ${OUT} (${W}x${H}, celda ${cellW}x${cellH}, altos ${meta.heights.join(' / ')})`);
