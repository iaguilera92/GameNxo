// Miniaturas de los EMOTES (las caritas del partido, que también son premios del Pase de Batalla).
//   node tools/build-emote-thumbs.mjs
// Fuentes: public/personajes/Nxo/emojis/nxo-<nombre>.png (~1300 px, ~1,1 MB cada una)
// Salida:  public/assets/emotes/emote-<nombre>.png, cuadradas de SIZE px con el dibujo centrado (fondo transparente).
// El juego las muestra a 54-58 px: con 160 sobra nitidez y cada una pesa decenas de KB en vez de más de 1 MB.
import { mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'public', 'personajes', 'Nxo', 'emojis');
const OUT_DIR = join(ROOT, 'public', 'assets', 'emotes');
const SIZE = 160;
const PAD = 4;

mkdirSync(OUT_DIR, { recursive: true });
for (const f of readdirSync(SRC_DIR).filter((n) => /^nxo-.+\.png$/.test(n))) {
  const { w, h, px } = decode(join(SRC_DIR, f));
  // caja del dibujo (alfa > 8)
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (px[(y * w + x) * 4 + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  if (x1 < 0) throw new Error(`${f}: imagen vacía`);
  const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
  const scale = (SIZE - PAD * 2) / Math.max(bw, bh);
  const ow = bw * scale, oh = bh * scale;
  const ox = (SIZE - ow) / 2, oy = (SIZE - oh) / 2;
  const out = Buffer.alloc(SIZE * SIZE * 4, 0);
  const step = 1 / scale;
  for (let dy = 0; dy < SIZE; dy++)
    for (let dx = 0; dx < SIZE; dx++) {
      const sx0 = x0 + (dx - ox) / scale, sy0 = y0 + (dy - oy) / scale;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let yy = 0; yy < step; yy++)
        for (let xx = 0; xx < step; xx++) {
          const sx = Math.floor(sx0 + xx), sy = Math.floor(sy0 + yy);
          n++;
          if (sx < x0 || sx > x1 || sy < y0 || sy > y1) continue;
          const o = (sy * w + sx) * 4, pa = px[o + 3] / 255;
          r += px[o] * pa; g += px[o + 1] * pa; b += px[o + 2] * pa; a += pa;
        }
      if (!n || a <= 0) continue;
      const di = (dy * SIZE + dx) * 4;
      out[di] = Math.round(r / a); out[di + 1] = Math.round(g / a); out[di + 2] = Math.round(b / a);
      out[di + 3] = Math.min(255, Math.round((a / n) * 255));
    }
  const name = f.replace(/^nxo-/, 'emote-');
  save(join(OUT_DIR, name), SIZE, SIZE, out);
  console.log(`${f} (${w}x${h}) -> assets/emotes/${name} ${SIZE}x${SIZE}`);
}
