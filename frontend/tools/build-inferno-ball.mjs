// Arma la hoja de la BOLA DE FUEGO del INFERNO (public/assets/inferno-ball.png) a partir de una fila de frames sobre verde.
//   node tools/build-inferno-ball.mjs [fila.png] [frames=9] [salida.png]
// - Fondo verde -> alfa (con despill en los bordes).
// - Cada frame se corta de su celda (ancho/frames), se centra en SU cuerpo (la pieza conexa mas grande, sin chispas sueltas)
//   y se escala con UN solo factor para que quepa entera (chispas incluidas) en una celda de 192 px.
// - Salida: celdas de 192x192 en una rejilla de 5 columnas (el juego lee los frames 0..N-1: ver FIREBALL_ART en fx/InfernoFx.ts).
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || join(homedir(), 'Downloads', 'bola-fuego.png');
const NF = Number(process.argv[3] || 9);
const OUT = process.argv[4] || join(ROOT, 'public', 'assets', 'inferno-ball.png');
const CELL = 192;
const COLS = 5;
const PAD = 3;
const img = decode(SRC);
const { w, h } = img;
// ---- verde -> alfa
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
const A = 40;
const fw = w / NF;
// ---- por frame: pieza principal (centro) y extension total
const frames = [];
for (let k = 0; k < NF; k++) {
  const x0 = Math.round(k * fw), x1 = Math.round((k + 1) * fw);
  const lab = new Int32Array((x1 - x0) * h).fill(-1);
  const comps = [];
  for (let y = 0; y < h; y++)
    for (let x = x0; x < x1; x++) {
      const s = y * (x1 - x0) + (x - x0);
      if (lab[s] >= 0 || px[(y * w + x) * 4 + 3] <= A) continue;
      const c = { n: 0, minX: 1e9, maxX: -1, minY: 1e9, maxY: -1 };
      const st = [[x, y]];
      lab[s] = comps.length;
      while (st.length) {
        const [cx, cy] = st.pop();
        c.n++;
        if (cx < c.minX) c.minX = cx;
        if (cx > c.maxX) c.maxX = cx;
        if (cy < c.minY) c.minY = cy;
        if (cy > c.maxY) c.maxY = cy;
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < x0 || nx >= x1 || ny < 0 || ny >= h) continue;
            const ns = ny * (x1 - x0) + (nx - x0);
            if (lab[ns] >= 0 || px[(ny * w + nx) * 4 + 3] <= A) continue;
            lab[ns] = comps.length;
            st.push([nx, ny]);
          }
      }
      comps.push(c);
    }
  if (!comps.length) throw new Error(`frame ${k + 1} vacio`);
  const body = comps.reduce((p, q) => (q.n > p.n ? q : p));
  // extension total (todas las piezas con algo de tamano: ignora polvo suelto)
  let tx0 = 1e9, tx1 = -1, ty0 = 1e9, ty1 = -1;
  for (const c of comps) {
    if (c.n < 12) continue;
    tx0 = Math.min(tx0, c.minX); tx1 = Math.max(tx1, c.maxX); ty0 = Math.min(ty0, c.minY); ty1 = Math.max(ty1, c.maxY);
  }
  const cx = (body.minX + body.maxX) / 2, cy = (body.minY + body.maxY) / 2;
  frames.push({ x0, x1, cx, cy, ext: Math.max(cx - tx0, tx1 - cx, cy - ty0, ty1 - cy), bodyW: body.maxX - body.minX + 1, bodyH: body.maxY - body.minY + 1 });
}
const maxExt = Math.max(...frames.map((f) => f.ext));
const scale = (CELL / 2 - PAD) / maxExt;
console.log(`hoja ${w}x${h}  ${NF} frames  extension maxima ${maxExt.toFixed(0)} px  escala ${scale.toFixed(3)}`);
console.log('cuerpo (ancho x alto) por frame:', frames.map((f) => `${Math.round(f.bodyW * scale)}x${Math.round(f.bodyH * scale)}`).join(' '));
// ---- empaquetar
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
          if (sx < f.x0 || sx >= f.x1 || sy < 0 || sy >= h) continue;
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
save(OUT, SW, SH, sheet);
console.log('listo ->', OUT, `${SW}x${SH}`);
