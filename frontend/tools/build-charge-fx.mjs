// Arma la hoja de un efecto de CARGA (el "cargando golpe" que se ve en el suelo bajo el jugador mientras carga la potencia).
//   node tools/build-charge-fx.mjs            (las tres: fuego, energia, tulipan)
//   node tools/build-charge-fx.mjs fuego      (solo una)
// Fuentes: art/cargando/cargando-<nombre>.png  ->  salida: public/assets/charge-<id>.webp  (fuego->fire, energia->energy, tulipan->tulip)
//
// Cada fuente es una hoja de 10 frames (5 columnas x 2 filas, en orden de lectura): el efecto nace (0), crece hasta su
// punto máximo (5-6) y se disipa (9). A diferencia de las bolas del INFERNO (tools/build-power-ball.mjs) NO se centra
// cada frame: el aro del suelo debe quedar fijo entre frames, así que todos comparten el mismo recorte y el mismo ancla
// (el centro del aro = los pies del jugador). Salida: celdas iguales en 5 columnas x 2 filas; el ancla va en
// (ancho/2, anclaY) y se imprime para ponerla en CHARGE_FX (fx/chargeFx.ts).
// - fuego / energía: fondo transparente; los frames se separan por las franjas vacías (alfa).
// - tulipán: trae una rejilla gris y una bruma blanca de fondo; se corta por rejilla (5x2) con un margen que deja fuera
//   las líneas y se descarta el alfa muy bajo (la bruma). El resultado se revisa a ojo en _tmp/charge-<id>-previa.png.
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { decode } from './png-lite.mjs';
import { saveWebp } from './image-out.mjs';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHEETS = {
  // fuente nueva (11-11-2026, cargando-fuego.webp → .png con tools/convert-image.mjs); la anterior en art/cargando/Old/
  fuego: { id: 'fire', mode: 'bands' },
  energia: { id: 'energy', mode: 'grid', inset: 0, autoRow: true, floor: 6, strong: 90 },
  // fuente nueva (11-11-2026, cargando-tulipan.webp → .png con tools/convert-image.mjs): fondo transparente, sin rejilla ni
  // bruma; se corta como el fuego. (La anterior, con rejilla gris y bruma blanca, está en art/cargando/Old/.)
  tulipan: { id: 'tulip', mode: 'bands' },
};
const COLS = 5;
const ROWS = 2;
const NF = COLS * ROWS;
/** ancho de cada celda de salida (px): el resto sale por la proporción */
const OUT_W = 256;
/** alfa a partir del cual un píxel cuenta como dibujo */
const A = 20;
/** margen alrededor de cada frame para no cortar su resplandor */
const MARGIN = 10;

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SHEETS);
for (const name of names) build(name, SHEETS[name]);

function build(name, cfg) {
  if (!cfg) throw new Error(`hoja desconocida: ${name} (fuego | energia | tulipan)`);
  const SRC = join(ROOT, 'art', 'cargando', `cargando-${name}.png`);
  const OUT = join(ROOT, 'public', 'assets', `charge-${cfg.id}.webp`);
  const { w, h, px } = decode(SRC);
  // limpieza: alfa residual fuera
  for (let i = 3; i < px.length; i += 4) if (px[i] <= (cfg.floor ?? 2)) px[i] = 0;
  const AA = cfg.A ?? A;
  // bruma de fondo horneada (tulipán): el alfa por debajo de ramp[0] se descarta y hasta ramp[1] sube suave a opaco
  if (cfg.ramp) {
    const [lo, hi] = cfg.ramp;
    for (let i = 3; i < px.length; i += 4) {
      const u = Math.min(1, Math.max(0, (px[i] - lo) / (hi - lo)));
      let a = u * u * (3 - 2 * u);
      // la bruma es casi blanca/gris; lo que sí es dibujo (pétalos, brillo rosado) tiene color: en lo semitransparente
      // se pesa por saturación (lo opaco no se toca para no apagar los brillos blancos del aro)
      if (cfg.satWeight && px[i] < 225) {
        const o = i - 3;
        const sat = Math.max(px[o], px[o + 1], px[o + 2]) - Math.min(px[o], px[o + 1], px[o + 2]);
        const t = Math.min(1, Math.max(0, (sat - cfg.satWeight[0]) / (cfg.satWeight[1] - cfg.satWeight[0])));
        a *= t * t * (3 - 2 * t);
      }
      px[i] = Math.round(255 * a);
    }
  }
  const solid = (x, y) => px[(y * w + x) * 4 + 3] > AA;

  /** Cajas de los frames [x0,x1) x [y0,y1) en orden de lectura. */
  let boxes = [];
  if (cfg.mode === 'grid') {
    const cw = w / COLS, ins = cfg.inset ?? 8;
    // corte entre las dos filas: con `autoRow` es la línea con menos dibujo entre el 35 % y el 65 % del alto
    let ys = h / ROWS;
    if (cfg.autoRow) {
      let best = 1e18;
      for (let y = Math.round(h * 0.35); y < Math.round(h * 0.65); y++) {
        let s = 0;
        for (let x = 0; x < w; x++) s += px[(y * w + x) * 4 + 3];
        if (s < best) { best = s; ys = y; }
      }
    }
    const rows = [[0, ys], [ys, h]];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        boxes.push({ x0: Math.round(c * cw + ins), x1: Math.round((c + 1) * cw - ins), y0: Math.round(rows[r][0] + ins), y1: Math.round(rows[r][1] - ins) });
    // fuera de la rejilla (líneas y bruma de los bordes) todo a 0 antes de medir
    const keep = new Uint8Array(w * h);
    for (const b of boxes) for (let y = b.y0; y < b.y1; y++) for (let x = b.x0; x < b.x1; x++) keep[y * w + x] = 1;
    for (let i = 0; i < w * h; i++) if (!keep[i]) px[i * 4 + 3] = 0;
  } else {
    const bands = (len, has) => {
      const out = [];
      let s = -1;
      for (let i = 0; i <= len; i++) {
        const on = i < len && has(i);
        if (on && s < 0) s = i;
        if (!on && s >= 0) {
          if (i - s > 40) out.push([s, i - 1]); // las chispas sueltas no cuentan como frame
          s = -1;
        }
      }
      return out;
    };
    for (const [ry0, ry1] of bands(h, (y) => { for (let x = 0; x < w; x++) if (solid(x, y)) return true; return false; }))
      for (const [cx0, cx1] of bands(w, (x) => { for (let y = ry0; y <= ry1; y++) if (solid(x, y)) return true; return false; }))
        boxes.push({ x0: Math.max(0, cx0 - MARGIN), x1: Math.min(w, cx1 + 1 + MARGIN), y0: Math.max(0, ry0 - MARGIN), y1: Math.min(h, ry1 + 1 + MARGIN) });
  }
  if (boxes.length !== NF) throw new Error(`${name}: se esperaban ${NF} frames y se encontraron ${boxes.length}`);

  // ---- ancla de CADA frame: el aro del suelo. Los frames no están en una rejilla perfecta, así que se mide en cada uno:
  // x = centro del dibujo fuerte en la franja inferior; y = su borde inferior menos media altura del aro (~13 % de su ancho)
  const strongA = cfg.strong ?? 110;
  const col = (k) => k % COLS, row = (k) => Math.floor(k / COLS);
  const anchors = boxes.map((b, k) => {
    let maxY = -1;
    for (let y = b.y1 - 1; y >= b.y0 && maxY < 0; y--) for (let x = b.x0; x < b.x1; x++) if (px[(y * w + x) * 4 + 3] > strongA) { maxY = y; break; }
    if (maxY < 0) throw new Error(`${name}: frame ${k + 1} sin aro`);
    const bandH = Math.round((b.y1 - b.y0) * 0.12);
    let x0 = 1e9, x1 = -1;
    for (let y = Math.max(b.y0, maxY - bandH); y <= maxY; y++) for (let x = b.x0; x < b.x1; x++) if (px[(y * w + x) * 4 + 3] > strongA) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
    const ringW = x1 - x0 + 1;
    return { x: (x0 + x1) / 2, y: maxY - ringW * 0.13, ringW };
  });
  const ax = (k) => anchors[k].x;
  const ay = (k) => anchors[k].y;
  let left = 0, right = 0, up = 0, down = 0;
  boxes.forEach((b, k) => {
    for (let y = b.y0; y < b.y1; y++)
      for (let x = b.x0; x < b.x1; x++)
        if (solid(x, y)) {
          left = Math.max(left, ax(k) - x); right = Math.max(right, x - ax(k)); up = Math.max(up, ay(k) - y); down = Math.max(down, y - ay(k));
        }
  });  const half = Math.ceil(Math.max(left, right)) + 4;
  up = Math.ceil(up) + 4;
  down = Math.ceil(down) + 4;
  const scale = OUT_W / (half * 2);
  const CW = OUT_W;
  const CH = Math.ceil((up + down) * scale);
  const anchorY = Math.round(up * scale);

  // ---- empaquetar (promedio ponderado por alfa)
  const SW = CW * COLS, SH = CH * ROWS;
  const sheet = Buffer.alloc(SW * SH * 4, 0);
  const step = 1 / scale;
  boxes.forEach((b, k) => {
    const ox = col(k) * CW, oy = row(k) * CH;
    const fx = ax(k), fy = ay(k);
    for (let dy = 0; dy < CH; dy++)
      for (let dx = 0; dx < CW; dx++) {
        const sx0 = fx + (dx - CW / 2) / scale;
        const sy0 = fy + (dy - anchorY) / scale;
        let r = 0, g = 0, bl = 0, a = 0, n = 0;
        for (let yy = 0; yy < step; yy += 1)
          for (let xx = 0; xx < step; xx += 1) {
            const sx = Math.floor(sx0 + xx), sy = Math.floor(sy0 + yy);
            n++;
            if (sx < b.x0 || sx >= b.x1 || sy < b.y0 || sy >= b.y1) continue;
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
  });
  mkdirSync(dirname(OUT), { recursive: true });
  saveWebp(OUT, SW, SH, sheet);
  // ancho del aro respecto a la celda (para escalar en el juego): el del último frame
  const ringW = (anchors.reduce((s, q) => s + q.ringW, 0) / NF) * scale;
  console.log(`${name} -> ${OUT}`);
  console.log(`  fuente ${w}x${h} (${cfg.mode})  celda ${CW}x${CH}  hoja ${SW}x${SH}  ancla y=${anchorY}  aro ~${Math.round(ringW)} px de ${CW}  (ringFill ${(ringW / CW).toFixed(2)}, anchorFy ${(anchorY / CH).toFixed(3)})`);
}

