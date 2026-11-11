// Vista previa (sin juego) de los ESTILOS DE COLOR de fx/CharColorFx.ts: aplica en CPU la misma fórmula del shader al
// primer frame del reposo de NXO y de MAI (de frente) y guarda una tira por personaje con todos los estilos.
//   node tools/preview-char-colors.mjs  -> _tmp/char-colors-nxo.png, _tmp/char-colors-mai.png
// Si se cambian CHAR_COLORS o SOURCE en CharColorFx.ts, copiar aquí los mismos valores.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '..', '_tmp');
const COLORS = [
  { id: 'classic', to: null, sat: 1, bright: 1, skip: true },
  { id: 'azul', to: 0.6, sat: 1, bright: 1.05 },
  { id: 'verde', to: 0.36, sat: 0.95, bright: 1 },
  { id: 'morado', to: 0.78, sat: 1, bright: 1 },
  { id: 'dorado', to: 0.12, sat: 1.05, bright: 1.2 },
  { id: 'sombra', to: null, sat: 0.12, bright: 0.5 },
];
const SOURCE = { nxo: { from: 0.9875, range: 0.045, minSat: 0.5 }, mai: { from: 0.925, range: 0.07, minSat: 0.45 } };
const SHEETS = {
  nxo: { file: 'public/assets/characters/nxo-front-v2/idle.png', cw: 250 },
  mai: { file: 'public/assets/characters/mai-front-end/idle.png', cw: 192 },
};
// retrato de la vitrina (PERSONALIZACIÓN): webp, no se puede leer aquí sin dependencias; se prueba la hoja

const fract = (x) => x - Math.floor(x);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function rgb2hsv(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 1e-6) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [fract(h / 6), mx > 0 ? d / mx : 0, mx];
}
function hsv2rgb(h, s, v) {
  const f = (n) => { const k = (n + h * 6) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}

mkdirSync(OUT, { recursive: true });
for (const [skin, sh] of Object.entries(SHEETS)) {
  let img;
  try { img = decode(join(ROOT, sh.file)); } catch { console.log('sin hoja', sh.file); continue; }
  const cw = Math.min(sh.cw, img.w), ch = img.h;
  const src = SOURCE[skin];
  const W = cw * COLORS.length;
  const out = Buffer.alloc(W * ch * 4);
  COLORS.forEach((c, k) => {
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const i = (y * img.w + x) * 4, o = (y * W + k * cw + x) * 4;
      let r = img.px[i] / 255, g = img.px[i + 1] / 255, b = img.px[i + 2] / 255; const a = img.px[i + 3];
      if (!c.skip && a > 1) {
        const [h, s, v] = rgb2hsv(r, g, b);
        const d = Math.abs(fract(h - src.from + 0.5) - 0.5);
        const w = (1 - smooth(src.range * 0.6, src.range, d)) * smooth(src.minSat * 0.7, src.minSat, s) * smooth(0.08, 0.2, v);
        if (w > 0) {
          // igual que el shader: color cambiado del todo y mezcla en RGB con el original según el peso
          const nh = c.to === null ? h : fract(h - src.from + c.to);
          const [fr, fg, fb] = hsv2rgb(nh, Math.min(1, s * c.sat), Math.min(1, v * c.bright));
          r += (fr - r) * w;
          g += (fg - g) * w;
          b += (fb - b) * w;
        }
      }
      out[o] = Math.round(r * 255); out[o + 1] = Math.round(g * 255); out[o + 2] = Math.round(b * 255); out[o + 3] = a;
    }
  });
  save(join(OUT, `char-colors-${skin}.png`), W, ch, out);
  console.log(`_tmp/char-colors-${skin}.png  (${COLORS.map((c) => c.id).join(' · ')})`);
}
