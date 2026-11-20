// INTROS de la pantalla VS (19-11-2026): recorta la hoja de cada personaje (8 cuadros en 2 filas de 4, fondo verde croma) en una tira WebP
// con celdas iguales para Phaser.
//   node tools/build-intro-2v2.mjs            (todos los que tengan hoja, de las dos intros)
// Dos tipos de INTRO (19-11-2026, usuario):
//   INTRO 1 = pj-<id>-intro-2v2.png (caminando hacia la cámara en contraluz) → assets/characters/intro-2v2/<id>.webp + src/ui/intro-2v2.json
//   INTRO 2 = pj-<id>-intro-2.png   (primer plano mirando a la cámara con la raqueta y su aura) → assets/characters/intro-2/<id>.webp + src/ui/intro-2.json
// Entrada en public/personajes/<Personaje>/. Una misma ventana de recorte para los 8 cuadros (no saltan).
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from './png-lite.mjs';
import { saveWebp } from './image-out.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/**
 * (19-11-2026) Personajes: TODOS los que tengan su hoja en `public/personajes/<Carpeta>/` (un personaje nuevo solo necesita dejar ahí su hoja y
 * correr la herramienta). `GESTURE` = hacia qué lado de SU hoja de la intro 1 hace el gesto (NXO levanta el puño a la derecha de la imagen): en
 * la VS se voltea para que mire al compañero. Sin dato = gesto al centro (no se voltea), como Mai con su muñequera.
 */
const GESTURE = { nxo: 'right' };
const KINDS = [
  { suffix: 'intro-2v2', out: 'intro-2v2', json: 'intro-2v2.json', gesture: true },
  // (19-11-2026) intro 2: cada cuadro se alinea por el BORDE DE ARRIBA de su propio dibujo (en la hoja de NXO las dos filas no están a la misma altura)
  { suffix: 'intro-2', out: 'intro-2', json: 'intro-2.json', gesture: false, anchorTop: true },
];
const charsOf = (suffix) => {
  const re = new RegExp('^pj-([a-z0-9]+)-' + suffix.replace(/-/g, '\\-') + '\\.png$');
  return readdirSync(join(ROOT, 'public', 'personajes'), { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .flatMap((d) =>
      readdirSync(join(ROOT, 'public', 'personajes', d.name))
        .map((f) => re.exec(f))
        .filter(Boolean)
        .map((m) => ({ id: m[1], dir: d.name })),
    );
};
/**
 * (19-11-2026, usuario) RECORTE por personaje e intro (fracción del alto del dibujo): `top` quita pelo de arriba y `bottom` lo de abajo (cuello,
 * barbilla). El corte se funde en un borde suave (`FADE`), para que no quede una línea recta en seco.
 */
const TRIM = { 'intro-2': { nxo: { top: 0.06, bottom: 0.03 } } }; // (20-11-2026) hoja nueva (aura roja): antes 0.1 / 0.14 cortaba la barba
/** (21-11-2026) personajes cuya intro 2 se alinea por el borde de arriba de cada cuadro (Mai NO: se queda quieta) */
const ANCHOR_TOP = { 'intro-2': new Set(['nxo']) };
const FADE = 0.06;
const ROWS = 2;
const COLS = 4;
/** alto máximo del personaje en la tira (px): en la VS se ve a ~40 % del alto de la pantalla */
const MAX_H = 440;
const PAD = 3;

for (const KIND of KINDS) {
  const meta = {};
  for (const ch of charsOf(KIND.suffix)) {
    const src = join(ROOT, 'public', 'personajes', ch.dir, `pj-${ch.id}-${KIND.suffix}.png`);
    if (!existsSync(src)) continue;
    const im = decode(src);
    const cw = Math.floor(im.w / COLS);
    const chh = Math.floor(im.h / ROWS);
    // croma: verde → transparente, sin halo verde en los bordes (los cuadros borrosos: borde suave)
    const px = Buffer.alloc(im.w * im.h * 4);
    for (let i = 0; i < im.w * im.h; i++) {
      const r = im.px[i * 4];
      const g = im.px[i * 4 + 1];
      const b = im.px[i * 4 + 2];
      const m = Math.max(r, b);
      const green = g - m;
      let a = 255;
      if (green > 100) a = 0;
      else if (green > 30) a = Math.round(255 * (1 - (green - 30) / 70));
      px[i * 4] = r;
      // sin halo verde: en los bordes (y en los cuadros borrosos) el verde se recorta al de los otros canales
      px[i * 4 + 1] = green > 0 ? Math.min(g, Math.round((r + b) / 2 + (m - (r + b) / 2) * 0.6)) : g;
      px[i * 4 + 2] = b;
      px[i * 4 + 3] = a;
    }
    // ventana común de los 8 cuadros (relativa a la casilla); y el borde de arriba / abajo de CADA cuadro (anchorTop)
    let x0 = cw, y0 = chh, x1 = -1, y1 = -1;
    const fTop = [];
    const fBot = [];
    for (let f = 0; f < ROWS * COLS; f++) {
      const ox = (f % COLS) * cw;
      const oy = Math.floor(f / COLS) * chh;
      let t = chh, bo = -1;
      for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) {
        if (px[((oy + y) * im.w + ox + x) * 4 + 3] < 30) continue;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (y < t) t = y;
        if (y > bo) bo = y;
      }
      fTop.push(t);
      fBot.push(bo);
    }
    // alineado por arriba: alto = el mayor dibujo; cada cuadro empieza en SU borde de arriba
    // (21-11-2026, usuario) solo NXO se alinea por arriba de CADA cuadro; Mai usa la ventana común (cada cuadro en el MISMO sitio: con pétalos y destellos
    // por encima del gorro, alinear por arriba la hacía vibrar al correr los cuadros)
    const anchor = !!KIND.anchorTop && ANCHOR_TOP[KIND.suffix]?.has(ch.id) !== false;
    const span = anchor ? Math.max(...fTop.map((t, i) => fBot[i] - t + 1)) : y1 - y0 + 1;
    const tr = TRIM[KIND.suffix]?.[ch.id];
    const cutTop = tr ? Math.round(span * (tr.top ?? 0)) : 0;
    const cutBot = tr ? Math.round(span * (tr.bottom ?? 0)) : 0;
    y0 += cutTop;
    y1 = (anchor ? y0 - cutTop + span - 1 : y1) - cutBot;
    const bw = x1 - x0 + 1;
    const bh = y1 - y0 + 1;
    const k = Math.min(1, MAX_H / bh);
    const cellW = Math.ceil(bw * k) + PAD * 2;
    const cellH = Math.ceil(bh * k) + PAD * 2;
    const W = cellW * COLS * ROWS; // tira horizontal de 8 cuadros
    const H = cellH;
    const out = Buffer.alloc(W * H * 4);
    for (let f = 0; f < ROWS * COLS; f++) {
      const sx = (f % COLS) * cw + x0;
      const sy = Math.floor(f / COLS) * chh + (anchor ? fTop[f] + cutTop : y0);
      const dw = Math.round(bw * k);
      const dh = Math.round(bh * k);
      for (let y = 0; y < dh; y++) for (let x = 0; x < dw; x++) {
        const a0x = sx + x / k, a0y = sy + y / k, a1x = a0x + 1 / k, a1y = a0y + 1 / k;
        let R = 0, G = 0, B = 0, A = 0, n = 0;
        for (let yy = Math.floor(a0y); yy < Math.ceil(a1y); yy++) for (let xx = Math.floor(a0x); xx < Math.ceil(a1x); xx++) {
          const i = (yy * im.w + xx) * 4;
          const a = px[i + 3];
          R += px[i] * a;
          G += px[i + 1] * a;
          B += px[i + 2] * a;
          A += a;
          n++;
        }
        if (!n || !A) continue;
        const o = ((PAD + y) * W + f * cellW + PAD + x) * 4;
        // borde suave en los lados recortados (TRIM)
        let fade = 1;
        if (tr) {
          const q = y / dh;
          if (tr.top) fade = Math.min(fade, q / FADE);
          if (tr.bottom) fade = Math.min(fade, (1 - q) / FADE);
          fade = Math.max(0, Math.min(1, fade));
        }
        out[o] = Math.round(R / A);
        out[o + 1] = Math.round(G / A);
        out[o + 2] = Math.round(B / A);
        out[o + 3] = Math.round((A / n) * fade);
      }
    }
    const file = join(ROOT, 'public', 'assets', 'characters', KIND.out, `${ch.id}.webp`);
    mkdirSync(dirname(file), { recursive: true });
    saveWebp(file, W, H, out);
    meta[ch.id] = {
      file: `assets/characters/${KIND.out}/${ch.id}.webp`,
      cell: { w: cellW, h: cellH },
      frames: ROWS * COLS,
      feetPad: PAD,
      ...(KIND.gesture && GESTURE[ch.id] ? { gesture: GESTURE[ch.id] } : {}),
    };
    console.log(`${KIND.suffix} ${ch.id}: ${W}x${H} (celda ${cellW}x${cellH})`);
  }
  writeFileSync(join(ROOT, 'src', 'ui', KIND.json), JSON.stringify(meta, null, 2) + '\n');
  console.log(`listo: src/ui/${KIND.json}`);
}
