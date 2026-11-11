// Arma las hojas de una BOLA DE ULTI CON RASTRO (hoy: tulipán): la bola (cabeza de la estela) y su rastro, que el juego
// pinta DETRÁS de la bola en el mismo frame.
//   node tools/build-trail-ball.mjs            (todas las de SHEETS)
//   node tools/build-trail-ball.mjs tulipan    (solo una)
// Fuentes: art/inferno/inferno-ball-<nombre>.png y art/inferno/inferno-ball-<nombre>-rastro.png
// Salida:  public/assets/inferno-ball-<id>.png y public/assets/inferno-ball-<id>-trail.png
//
// Contrato de las fuentes: las DOS hojas del mismo tamaño, 10 frames en 5 columnas x 2 filas (rejilla uniforme, en orden de
// lectura), fondo transparente, la estela en HORIZONTAL con la cabeza a la DERECHA y la cola a la izquierda. El rastro
// está dibujado en el mismo sitio que la bola en cada celda (son dos capas del mismo efecto).
// A diferencia de tools/build-power-ball.mjs NO se centra cada frame: todos los frames de las dos hojas comparten recorte
// y ancla (la cabeza = donde va la pelota), así la bola y su rastro calzan. La herramienta imprime la celda y el ancla
// (originX / originY) que van en BALL_ART (src/fx/InfernoFx.ts). Revisar a ojo public/assets/inferno-ball-<id>*.png.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
/**
 * Por bola: id del juego y ancla en la celda de la FUENTE (fracción del ancho / alto de la celda): la cabeza de la estela.
 * `floor` = alfa que se descarta (restos del fondo); `satWeight` = la bruma blanca semitransparente (sin color) se apaga,
 * lo que tiene color (pétalos, brillo rosado) se queda. `dark` = [luz baja, luz alta, saturación máx.]: los píxeles grises
 * oscuros (más oscuros que `luz alta` y con menos color que `saturación máx.`) se apagan.
 */
const SHEETS = {
  tulipan: { id: 'tulip', anchor: [0.86, 0.58], floor: 2, satWeight: [10, 40], dark: [110, 190, 70] },
};
const COLS = 5;
const ROWS = 2;
const NF = COLS * ROWS;
/** ancho de cada celda de salida (px): el alto sale por la proporción */
const OUT_W = 384;
/** alfa a partir del cual un píxel cuenta como dibujo (para medir el recorte) */
const A = 16;
const PAD = 4;

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHEETS);
for (const name of names) build(name, SHEETS[name]);

function clean(img, cfg) {
  const { px } = img;
  for (let i = 3; i < px.length; i += 4) {
    if (px[i] <= cfg.floor) {
      px[i] = 0;
      continue;
    }
    const o = i - 3;
    const hi = Math.max(px[o], px[o + 1], px[o + 2]);
    const sat = hi - Math.min(px[o], px[o + 1], px[o + 2]);
    const smooth = (v, lo, up) => {
      const t = Math.min(1, Math.max(0, (v - lo) / (up - lo)));
      return t * t * (3 - 2 * t);
    };
    if (cfg.satWeight && px[i] < 225) px[i] = Math.round(px[i] * smooth(sat, cfg.satWeight[0], cfg.satWeight[1]));
    // trazos oscuros sin color (sombras grises horneadas): sobre fondo blanco no se ven, sobre la cancha salen negros
    if (cfg.dark && sat < cfg.dark[2]) px[i] = Math.round(px[i] * smooth(hi, cfg.dark[0], cfg.dark[1]));
  }
  return img;
}

function build(name, cfg) {
  if (!cfg) throw new Error(`hoja desconocida: ${name} (${Object.keys(SHEETS).join(' | ')})`);
  const srcs = [`inferno-ball-${name}.png`, `inferno-ball-${name}-rastro.png`].map((f) => join(ROOT, 'art', 'inferno', f));
  const outs = [`inferno-ball-${cfg.id}.png`, `inferno-ball-${cfg.id}-trail.png`].map((f) => join(ROOT, 'public', 'assets', f));
  const imgs = srcs.map((s) => clean(decode(s), cfg));
  const { w, h } = imgs[0];
  if (imgs[1].w !== w || imgs[1].h !== h) throw new Error(`${name}: la bola (${w}x${h}) y el rastro (${imgs[1].w}x${imgs[1].h}) deben medir lo mismo`);
  const cw = w / COLS;
  const ch = h / ROWS;
  // ancla de cada celda (igual en las dos hojas)
  const ax = (k) => (k % COLS) * cw + cfg.anchor[0] * cw;
  const ay = (k) => Math.floor(k / COLS) * ch + cfg.anchor[1] * ch;

  // ---- recorte común: lo más lejos que llega el dibujo desde el ancla, en todos los frames de las dos hojas
  let left = 0, right = 0, up = 0, down = 0;
  const empty = [];
  for (const { px } of imgs)
    for (let k = 0; k < NF; k++) {
      const x0 = Math.round((k % COLS) * cw), x1 = Math.round(((k % COLS) + 1) * cw);
      const y0 = Math.round(Math.floor(k / COLS) * ch), y1 = Math.round((Math.floor(k / COLS) + 1) * ch);
      let n = 0;
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          if (px[(y * w + x) * 4 + 3] <= A) continue;
          n++;
          left = Math.max(left, ax(k) - x);
          right = Math.max(right, x - ax(k));
          up = Math.max(up, ay(k) - y);
          down = Math.max(down, y - ay(k));
        }
      if (!n) empty.push(k + 1);
    }
  if (empty.length) throw new Error(`${name}: frames vacíos ${empty.join(', ')}`);
  left = Math.ceil(left) + PAD;
  right = Math.ceil(right) + PAD;
  up = Math.ceil(up) + PAD;
  down = Math.ceil(down) + PAD;
  const scale = OUT_W / (left + right);
  const CW = OUT_W;
  const CH = Math.ceil((up + down) * scale);
  const oxPx = left * scale;
  const oyPx = up * scale;

  // ---- empaquetar (promedio ponderado por alfa), 5 columnas x 2 filas
  const SW = CW * COLS, SH = CH * ROWS;
  const step = 1 / scale;
  imgs.forEach(({ px }, s) => {
    const sheet = Buffer.alloc(SW * SH * 4, 0);
    for (let k = 0; k < NF; k++) {
      const bx0 = Math.round((k % COLS) * cw), bx1 = Math.round(((k % COLS) + 1) * cw);
      const by0 = Math.round(Math.floor(k / COLS) * ch), by1 = Math.round((Math.floor(k / COLS) + 1) * ch);
      const ox = (k % COLS) * CW, oy = Math.floor(k / COLS) * CH;
      for (let dy = 0; dy < CH; dy++)
        for (let dx = 0; dx < CW; dx++) {
          const sx0 = ax(k) + (dx - oxPx) / scale;
          const sy0 = ay(k) + (dy - oyPx) / scale;
          let r = 0, g = 0, bl = 0, a = 0, n = 0;
          for (let yy = 0; yy < step; yy += 1)
            for (let xx = 0; xx < step; xx += 1) {
              const sx = Math.floor(sx0 + xx), sy = Math.floor(sy0 + yy);
              n++;
              if (sx < bx0 || sx >= bx1 || sy < by0 || sy >= by1) continue;
              const o = (sy * w + sx) * 4;
              const pa = px[o + 3] / 255;
              r += px[o] * pa; g += px[o + 1] * pa; bl += px[o + 2] * pa; a += pa;
            }
          if (!n || a <= 0) continue;
          const di = ((oy + dy) * SW + ox + dx) * 4;
          sheet[di] = Math.min(255, Math.round(r / a));
          sheet[di + 1] = Math.min(255, Math.round(g / a));
          sheet[di + 2] = Math.min(255, Math.round(bl / a));
          sheet[di + 3] = Math.min(255, Math.round((a / n) * 255));
        }
    }
    save(outs[s], SW, SH, sheet);
  });
  console.log(`${name} -> ${outs.join(' + ')}`);
  console.log(`  fuente ${w}x${h}  celda ${CW}x${CH}  hoja ${SW}x${SH}  ancla (${Math.round(oxPx)}, ${Math.round(oyPx)})  originX ${(oxPx / CW).toFixed(3)}  originY ${(oyPx / CH).toFixed(3)}`);
}
