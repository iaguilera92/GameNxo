// Genera las versiones ligeras (256x256, recortadas al círculo) de los botones del partido.
//
//   node tools/make-button-sprites.mjs
//
// Entrada : public/assets/btn-dash.png, btn-smash.png, btn-saque.png, btn-saque-efecto.png (arte original, no se toca)
// Salida  : public/assets/ui/<mismo nombre>.png  (lo que carga MatchScene; el original pesa ~1 MB y 1312x1199)
// Si cambias el arte original, vuelve a ejecutar este script.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAMES = ['btn-dash', 'btn-smash', 'btn-saque', 'btn-saque-efecto'];
const SIZE = 256;
const PAD = 3; // margen transparente alrededor del círculo (px del original)

mkdirSync(join(ROOT, 'public', 'assets', 'ui'), { recursive: true });

for (const name of NAMES) {
  const { w, h, px } = decode(join(ROOT, 'public', 'assets', `${name}.png`));
  // caja del círculo visible (alfa > 20)
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (px[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD); x1 = Math.min(w - 1, x1 + PAD); y1 = Math.min(h - 1, y1 + PAD);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const k = SIZE / Math.max(cw, ch);
  const ow = Math.max(1, Math.round(cw * k)), oh = Math.max(1, Math.round(ch * k));
  const out = Buffer.alloc(SIZE * SIZE * 4);
  const offX = Math.floor((SIZE - ow) / 2), offY = Math.floor((SIZE - oh) / 2);
  // promedio por área con alfa premultiplicado (sin halos en los bordes)
  for (let oy = 0; oy < oh; oy++) for (let ox = 0; ox < ow; ox++) {
    const sx0 = x0 + ox / k, sx1 = x0 + (ox + 1) / k, sy0 = y0 + oy / k, sy1 = y0 + (oy + 1) / k;
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = Math.floor(sy0); sy < Math.ceil(sy1); sy++) for (let sx = Math.floor(sx0); sx < Math.ceil(sx1); sx++) {
      const i = (Math.min(h - 1, sy) * w + Math.min(w - 1, sx)) * 4;
      const al = px[i + 3] / 255;
      r += px[i] * al; g += px[i + 1] * al; b += px[i + 2] * al; a += al; n++;
    }
    const o = ((offY + oy) * SIZE + offX + ox) * 4;
    if (a > 0) { out[o] = Math.round(r / a); out[o + 1] = Math.round(g / a); out[o + 2] = Math.round(b / a); }
    out[o + 3] = Math.round((a / n) * 255);
  }
  save(join(ROOT, 'public', 'assets', 'ui', `${name}.png`), SIZE, SIZE, out);
  console.log(`${name}: ${w}x${h} -> círculo ${cw}x${ch} -> ${SIZE}x${SIZE}`);
}
