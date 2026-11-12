// Genera los iconos de la app Android a partir del logo oficial (art/nxo-logo-prev.png: logo sobre negro; fuera de
// public/ para que no vaya al APK).
//   node tools/make-android-icons.mjs
// Escribe en android/app/src/main/res:
//   mipmap-*/ic_launcher_foreground.png  capa frontal del icono adaptativo (logo con transparencia, zona segura)
//   mipmap-*/ic_launcher_monochrome.png  silueta para iconos tematizados (Android 13+)
//   mipmap-*/ic_launcher.png, ic_launcher_round.png   iconos clásicos (Android < 8 y lanzadores sin icono adaptativo)
// El fondo del icono adaptativo es el color values/ic_launcher_background.xml (negro, como el logo).
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RES = join(ROOT, 'android', 'app', 'src', 'main', 'res');
const SRC = join(ROOT, 'art', 'nxo-logo-prev.png');

// --- logo: el fondo es negro puro, así que alpha = canal máximo y el color se des-premultiplica
const src = decode(SRC);
const W = src.w;
const H = src.h;
const logo = new Float32Array(W * H * 4); // RGBA premultiplicado 0..1
let x0 = W, y0 = H, x1 = 0, y1 = 0;
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    const r = src.px[i] / 255, g = src.px[i + 1] / 255, b = src.px[i + 2] / 255;
    const a = Math.max(r, g, b) < 0.06 ? 0 : Math.max(r, g, b); // ruido de compresión del fondo = transparente
    logo[i] = r * (a > 0 ? 1 : 0);
    logo[i + 1] = g * (a > 0 ? 1 : 0);
    logo[i + 2] = b * (a > 0 ? 1 : 0);
    logo[i + 3] = a;
    if (a > 0.3) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
const cw = x1 - x0 + 1;
const ch = y1 - y0 + 1;
console.log(`logo: ${cw}x${ch} px (recorte de ${W}x${H})`);

/** Reduce el recorte del logo a tw x th con promedio por área (premultiplicado). */
function scaleLogo(tw, th) {
  const out = new Float32Array(tw * th * 4);
  const sx = cw / tw, sy = ch / th;
  for (let y = 0; y < th; y++) {
    const ya = y0 + y * sy, yb = ya + sy;
    for (let x = 0; x < tw; x++) {
      const xa = x0 + x * sx, xb = xa + sx;
      let r = 0, g = 0, b = 0, a = 0, wsum = 0;
      for (let yy = Math.floor(ya); yy < Math.ceil(yb); yy++) {
        const wy = Math.min(yy + 1, yb) - Math.max(yy, ya);
        for (let xx = Math.floor(xa); xx < Math.ceil(xb); xx++) {
          const w = wy * (Math.min(xx + 1, xb) - Math.max(xx, xa));
          const i = (yy * W + xx) * 4;
          r += logo[i] * w; g += logo[i + 1] * w; b += logo[i + 2] * w; a += logo[i + 3] * w;
          wsum += w;
        }
      }
      const o = (y * tw + x) * 4;
      out[o] = r / wsum; out[o + 1] = g / wsum; out[o + 2] = b / wsum; out[o + 3] = a / wsum;
    }
  }
  return out;
}

/**
 * Lienzo size x size con el logo centrado ocupando `frac` del ancho.
 * mode: 'fg' = transparente · 'mono' = silueta blanca · 'bg' = sobre negro · 'round' = sobre negro con máscara circular
 */
function render(size, frac, mode) {
  const lw = Math.round(size * frac);
  const lh = Math.round((lw * ch) / cw);
  const sc = scaleLogo(lw, lh);
  const ox = Math.round((size - lw) / 2);
  const oy = Math.round((size - lh) / 2);
  const px = Buffer.alloc(size * size * 4);
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const lx = x - ox, ly = y - oy;
      let r = 0, g = 0, b = 0, a = 0; // premultiplicado
      if (lx >= 0 && ly >= 0 && lx < lw && ly < lh) {
        const i = (ly * lw + lx) * 4;
        r = sc[i]; g = sc[i + 1]; b = sc[i + 2]; a = sc[i + 3];
      }
      let outA = a, oR = r, oG = g, oB = b;
      if (mode === 'mono') {
        oR = oG = oB = a;
      } else if (mode === 'bg' || mode === 'round') {
        outA = 1; // negro debajo: el premultiplicado ya es el color final
        if (mode === 'round') {
          const d = Math.hypot(x - c, y - c);
          const edge = size / 2;
          outA = Math.min(1, Math.max(0, edge - d + 0.5)); // borde suave de 1 px
          oR *= outA; oG *= outA; oB *= outA;
        }
      }
      const o = (y * size + x) * 4;
      const un = outA > 0 ? 1 / outA : 0;
      px[o] = Math.round(Math.min(1, oR * un) * 255);
      px[o + 1] = Math.round(Math.min(1, oG * un) * 255);
      px[o + 2] = Math.round(Math.min(1, oB * un) * 255);
      px[o + 3] = Math.round(outA * 255);
    }
  return px;
}

// densidad -> [lado del icono adaptativo (108 dp), lado del icono clásico (48 dp)]
const DENS = { mdpi: [108, 48], hdpi: [162, 72], xhdpi: [216, 96], xxhdpi: [324, 144], xxxhdpi: [432, 192] };
// Zona segura del icono adaptativo: círculo de 66 dp sobre 108 dp. El logo (≈3,2:1) cabe con un ancho del 58 %.
const FG = 0.58;
const LEGACY = 0.8;
const ROUND = 0.68;

for (const [d, [ad, lg]] of Object.entries(DENS)) {
  const dir = join(RES, `mipmap-${d}`);
  mkdirSync(dir, { recursive: true });
  save(join(dir, 'ic_launcher_foreground.png'), ad, ad, render(ad, FG, 'fg'));
  save(join(dir, 'ic_launcher_monochrome.png'), ad, ad, render(ad, FG, 'mono'));
  save(join(dir, 'ic_launcher.png'), lg, lg, render(lg, LEGACY, 'bg'));
  save(join(dir, 'ic_launcher_round.png'), lg, lg, render(lg, ROUND, 'round'));
}

// fondo del icono adaptativo
writeFileSync(
  join(RES, 'values', 'ic_launcher_background.xml'),
  '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#000000</color>\n</resources>\n',
);
// icono adaptativo (y redondo) con capa monocroma para iconos tematizados (Android 13+)
const adaptive =
  '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n' +
  '    <background android:drawable="@color/ic_launcher_background"/>\n' +
  '    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n' +
  '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n</adaptive-icon>\n';
writeFileSync(join(RES, 'mipmap-anydpi-v26', 'ic_launcher.xml'), adaptive);
writeFileSync(join(RES, 'mipmap-anydpi-v26', 'ic_launcher_round.xml'), adaptive);
console.log('Iconos generados en', RES);
