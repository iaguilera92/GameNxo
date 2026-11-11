// Corta la hoja de la PALOMA del ambiente (public/ambiente-paloma.png: 8 columnas x 3 filas, celdas de 271,5 x 241,3 px)
// en una cuadrícula limpia de celdas enteras y a la mitad de tamaño -> public/assets/ambiente/paloma.png.
//   fila 1  en el suelo: quieta, camina, picotea (8 frames, en bucle)
//   fila 2  despegue: de pie -> alas abiertas -> en el aire (8 frames; al revés = aterrizaje)
//   fila 3  vuelo (8 frames, en bucle)
// La paloma mira a la DERECHA. Uso: node tools/build-paloma.mjs  (fx/AmbientBird.ts carga el resultado)
//
// AVIÓN: node tools/build-paloma.mjs avion
//   public/ambiente-avion.png (8 columnas x 1 fila, mirando a la derecha; se va achicando = se aleja)
//   -> public/assets/ambiente/avion.png (fx/AmbientPlane.ts)
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PLANE = process.argv[2] === 'avion';
const SRC = join(ROOT, 'public', PLANE ? 'ambiente-avion.png' : 'ambiente-paloma.png');
const OUT_DIR = join(ROOT, 'public', 'assets', 'ambiente');
const OUT_NAME = PLANE ? 'avion.png' : 'paloma.png';
const COLS = 8;
const ROWS = PLANE ? 1 : 3;
const K = 2; // reducción (2 = mitad)

const src = decode(SRC);
const cw = Math.floor(src.w / COLS / K);
const ch = Math.floor(src.h / ROWS / K);
const W = cw * COLS;
const H = ch * ROWS;
const out = Buffer.alloc(W * H * 4);

for (let r = 0; r < ROWS; r++) {
  for (let c = 0; c < COLS; c++) {
    const x0 = Math.round((c * src.w) / COLS);
    const y0 = Math.round((r * src.h) / ROWS);
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        // promedio K x K con alfa premultiplicado (bordes limpios al reducir)
        let R = 0, G = 0, B = 0, A = 0;
        for (let dy = 0; dy < K; dy++) {
          for (let dx = 0; dx < K; dx++) {
            const sx = Math.min(src.w - 1, x0 + x * K + dx);
            const sy = Math.min(src.h - 1, y0 + y * K + dy);
            const i = (sy * src.w + sx) * 4;
            const a = src.px[i + 3];
            R += src.px[i] * a;
            G += src.px[i + 1] * a;
            B += src.px[i + 2] * a;
            A += a;
          }
        }
        const o = ((r * ch + y) * W + c * cw + x) * 4;
        if (A > 0) {
          out[o] = Math.round(R / A);
          out[o + 1] = Math.round(G / A);
          out[o + 2] = Math.round(B / A);
        }
        out[o + 3] = Math.round(A / (K * K));
      }
    }
  }
}

mkdirSync(OUT_DIR, { recursive: true });
save(join(OUT_DIR, OUT_NAME), W, H, out);
console.log(`${OUT_NAME} ${W}x${H} (celda ${cw}x${ch}, ${COLS}x${ROWS})`);
