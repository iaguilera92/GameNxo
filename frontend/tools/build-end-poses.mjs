// Poses de la PANTALLA DE RESULTADO (MatchEndScene) para un personaje de frente cuya hoja nueva aún no está procesada:
// corta de su hoja 1 (8 x 8 celdas, fondo verde) las filas de reposo (1), victoria (4) y derrota (8) en tiras de 8 frames
// con fondo transparente. NO toca las hojas del partido. Hoy: MAI rival (public/personajes/Mai/rival/pj-mai-rival-1.png).
//   node tools/build-end-poses.mjs   -> public/assets/characters/mai-front-end/{idle,victory,defeat}.webp
// La escena mide la silueta de cada tira al dibujarla (alto y pies), así que no hace falta JSON de ancla.
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from './png-lite.mjs';
import { saveWebp } from './image-out.mjs';
import { keepEnclosedGreen } from './keep-enclosed-green.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'public', 'personajes', 'Mai', 'rival', 'pj-mai-rival-1.png');
const OUT = join(ROOT, 'public', 'assets', 'characters', 'mai-front-end');
const COLS = 8;
const ROWS = 8;
const CLIPS = { idle: 1, victory: 4, defeat: 8 }; // fila (1-based, como en la hoja; docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md §5)

const s = decode(SRC);
// croma: fuera el verde del fondo (y su borde verdoso), luego se recuperan los detalles verdes de la gorra de Mai
const out = Buffer.from(s.px);
for (let i = 0; i < s.w * s.h; i++) {
  const r = s.px[i * 4], g = s.px[i * 4 + 1], b = s.px[i * 4 + 2];
  const dom = g - Math.max(r, b);
  if (g > 120 && dom > 70) out[i * 4 + 3] = 0;
  else if (g > 100 && dom > 30) {
    // borde: semitransparente y sin el tinte verde
    out[i * 4 + 3] = Math.round(255 * (1 - (dom - 30) / 40));
    out[i * 4 + 1] = Math.max(r, b);
  }
}
keepEnclosedGreen(s.px, out, s.w, s.h);

const cw = Math.floor(s.w / COLS);
const ch = Math.floor(s.h / ROWS);
mkdirSync(OUT, { recursive: true });
for (const [name, row] of Object.entries(CLIPS)) {
  const W = cw * COLS;
  const strip = Buffer.alloc(W * ch * 4);
  const y0 = Math.round(((row - 1) * s.h) / ROWS);
  for (let c = 0; c < COLS; c++) {
    const x0 = Math.round((c * s.w) / COLS);
    for (let y = 0; y < ch; y++) out.copy(strip, (y * W + c * cw) * 4, ((y0 + y) * s.w + x0) * 4, ((y0 + y) * s.w + x0 + cw) * 4);
  }
  saveWebp(join(OUT, `${name}.webp`), W, ch, strip); // PNG temporal -> WebP (image-out.mjs)
  console.log(`${name}.webp ${W}x${ch} (celda ${cw}x${ch})`);
}
