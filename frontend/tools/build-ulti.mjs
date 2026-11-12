// Corta la hoja de la ULTI (6 filas x 9 frames, rejilla fija) de UN personaje en 6 tiras WebP + su JSON.
// Sirve para cualquier personaje y vista dado de alta en tools/characters.mjs (nxo, nxo-front, mai, mai-front, ...).
//   node tools/build-ulti.mjs <id>       p. ej. nxo | nxo-front | mai | mai-front
//   node tools/build-ulti.mjs all        todos los que tienen hoja de ULTI
//   node tools/build-ulti.mjs <id> png   deja las tiras en PNG (más rápido, solo para probar)
// Entrada: public/personajes/<dir>/<prefix>-ulti.png (fondo verde o transparente; vale cualquier tamaño: la celda es ancho/9 x alto/6).
// Salida:  public/assets/characters/<id>-inferno/{inferno-swing,ulti-hit,ulti-stun,idle-nr,run-nr,pickup}.webp y src/characters/<id>-inferno.json
// Contrato de la hoja (qué es cada fila y cada frame): docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md.
// Hace: pasa el verde a alfa, separa las piezas conexas y reparte cada una en su celda de la rejilla, escala TODO con un mismo
// factor (el guardia del frame 1 mide 140 px), apoya cada fila en su suelo, centra por el cuerpo (píxeles oscuros: pelo y ropa,
// no estrellas ni destellos) y empaqueta los 9 frames de cada fila en una textura de 3 columnas.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';
import { keepEnclosedGreen } from './keep-enclosed-green.mjs';
import { CHARACTERS } from './characters.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = process.argv[2];
if (ID === 'all') {
  for (const [id, c] of Object.entries(CHARACTERS)) if (c.ulti) execFileSync(process.execPath, [fileURLToPath(import.meta.url), id], { stdio: 'inherit' });
  process.exit(0);
}
const CHAR = CHARACTERS[ID];
if (!CHAR?.ulti) throw new Error(`uso: node tools/build-ulti.mjs <${Object.entries(CHARACTERS).filter(([, c]) => c.ulti).map(([id]) => id).join('|')}|all> [png]`);
const CFG = CHAR.ulti;
const SRC = join(ROOT, 'public', 'personajes', ...CHAR.dir.split('/'), `${CHAR.prefix}-ulti.png`);
const OUT = join(ROOT, 'public', 'assets', 'characters', `${ID}-inferno`);
const JSON_NAME = `${ID}-inferno.json`;
const GREEN = !!CFG.greenDetails; // detalles verdes dentro del personaje (la flor de la gorra de MAI) que el croma no debe borrar
const STAND_H = 140;
/** tiras en WebP (docs §0.4). `png` como 2.º argumento las deja en PNG (más rápido, para probar) */
const GRID_WEBP = process.argv[3] !== 'png';
// frames (0-based): hold = pose congelada en la concentración, PRE = justo antes del golpe, IMPACT = contacto
const [HOLD, PRE, IMPACT] = [CFG.hold ?? 4, CFG.preStrike ?? 5, CFG.impact ?? 6];
const COLS = 3;
const A = 12;
const img = decode(SRC);
const { w, h, px } = img;
// hoja con fondo VERDE en vez de alfa (la de MAI): el verde pasa a transparente con el mismo croma que build-moves
// (alfa parcial y sin reflejo verde en los bordes) y se conservan las hojas verdes de la flor de su gorra
{
  let transp = 0;
  for (let i = 3; i < w * h * 4; i += 4) if (px[i] === 0) transp++;
  if (transp < w * h * 0.1) {
    const src = Buffer.from(px);
    for (let i = 0; i < w * h * 4; i += 4) {
      const r = px[i], g = px[i + 1], b = px[i + 2];
      const m = Math.max(r, b), d = g - m;
      if (d > 60) px[i + 3] = 0;
      else if (d > 12) { px[i + 1] = Math.min(g, m); px[i + 3] = Math.round(px[i + 3] * (1 - (d - 12) / 48)); }
      else if (d > 0) px[i + 1] = m;
    }
    console.log(`fondo verde -> alfa${GREEN ? `; ${keepEnclosedGreen(src, px, w, h).length} detalles verdes recuperados (gorra)` : ''}`);
  }
}
// piezas conexas (alfa > A, 8 vecinos): si dos frames se solapan en columnas sin tocarse (la raqueta de uno por encima
// de la del otro, como los frames 7-8 de MAI), cada pieza va entera a su frame en vez de cortarse en vertical
const lab = new Int32Array(w * h).fill(-1);
const comps = [];
for (let s = 0; s < w * h; s++) {
  if (lab[s] >= 0 || px[s * 4 + 3] <= A) continue;
  const c = { x0: s % w, x1: s % w, y0: (s / w) | 0, y1: (s / w) | 0, sx: 0, sy: 0, n: 0 };
  const id = comps.length;
  const st = [s];
  lab[s] = id;
  while (st.length) {
    const p = st.pop(), x = p % w, y = (p / w) | 0;
    c.n++; c.sx += x; c.sy += y;
    if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x;
    if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const q = ny * w + nx;
        if (lab[q] >= 0 || px[q * 4 + 3] <= A) continue;
        lab[q] = id;
        st.push(q);
      }
  }
  comps.push(c);
}
// ------------------------------------------------------------------ hoja de 6 filas x 9 (ULTI completa)
// Rejilla FIJA de 9 columnas x 6 filas (celda = w/9 x h/6), una animación por fila.
// Cada pieza (alfa conexa) va entera a la celda donde cae su centro, así los efectos que rozan el borde de la celda
// no se cortan. Las piezas de menos de GRID_MIN_PX px son restos del croma y se ignoran.
const GRID_COLS = 9, GRID_ROWS = 6, GRID_MIN_PX = 30;
/** filas de la hoja de 6 x 9: clip, fps, bucle (docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md, hoja de la ULTI) */
const GRID_CLIPS = [
  ['inferno-swing', 15, false],
  ['ulti-hit', 14, false],
  ['ulti-stun', 12, true],
  ['idle-nr', 8, true],
  ['run-nr', 14, true],
  ['pickup', 14, false],
];
/** ulti-hit: desde este frame (0-based; 2 = frame 3) la mano queda vacía · pickup: frame en que la mano toma la raqueta (3 = frame 4) */
const GRID_RACKET_FREE = CFG.racketFree ?? 2, GRID_PICKUP_GRAB = CFG.pickupGrab ?? 3;
buildGrid();
function buildGrid() {
  const cw = w / GRID_COLS, chh = h / GRID_ROWS;
  const cellOf = (c) => {
    const col = Math.min(GRID_COLS - 1, Math.floor(c.sx / c.n / cw));
    const row = Math.min(GRID_ROWS - 1, Math.floor(c.sy / c.n / chh));
    return row * GRID_COLS + col;
  };
  const fr = Array.from({ length: GRID_COLS * GRID_ROWS }, (_, i) => ({ row: Math.floor(i / GRID_COLS), ids: new Set(), x0: 1e9, x1: -1, y0: 1e9, y1: -1 }));
  let dropped = 0;
  comps.forEach((c, i) => {
    if (c.n < GRID_MIN_PX) { dropped++; return; }
    const f = fr[cellOf(c)];
    f.ids.add(i);
    f.x0 = Math.min(f.x0, c.x0); f.x1 = Math.max(f.x1, c.x1); f.y0 = Math.min(f.y0, c.y0); f.y1 = Math.max(f.y1, c.y1);
  });
  console.log(`hoja ${w}x${h}: rejilla ${GRID_COLS}x${GRID_ROWS} (celda ${cw.toFixed(1)}x${chh.toFixed(1)}), ${dropped} manchas < ${GRID_MIN_PX} px ignoradas`);
  const empty = fr.map((f, i) => (f.ids.size ? -1 : i)).filter((i) => i >= 0);
  if (empty.length) throw new Error(`celdas vacías (fila/frame): ${empty.map((i) => `${Math.floor(i / GRID_COLS) + 1}/${(i % GRID_COLS) + 1}`).join(', ')}`);
  // métricas: caja, base y centro del cuerpo (píxeles oscuros: pelo, ropa y zapatillas; estrellas y destellos no cuentan)
  for (const f of fr) {
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, sx = 0, sn = 0;
    for (let y = f.y0; y <= f.y1; y++)
      for (let x = f.x0; x <= f.x1; x++) {
        const p = y * w + x, o = p * 4, a = px[o + 3];
        if (a <= A || !f.ids.has(lab[p])) continue;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        if (a > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70) { sx += x; sn++; }
      }
    Object.assign(f, { bx0: x0, bx1: x1, by0: y0, by1: y1, cx: sn ? sx / sn : (x0 + x1) / 2 });
  }
  // suelo de cada fila: mediana de las bases de sus frames
  const median = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
  for (let r = 0; r < GRID_ROWS; r++) {
    const row = fr.filter((f) => f.row === r);
    const g = median(row.map((f) => f.by1));
    for (const f of row) f.ground = g;
  }
  // escala única: el guardia del frame 1 de la fila 1 mide STAND_H (de la base al pelo)
  const sc = STAND_H / (fr[0].ground - fr[0].by0);
  console.log(`escala ${sc.toFixed(4)} (guardia ${fr[0].ground - fr[0].by0} px)`);
  // celda común a todos los clips (no saltan al cambiar de uno a otro)
  let L = 0, R = 0, T = 0, B = 0;
  for (const f of fr) {
    L = Math.max(L, (f.cx - f.bx0) * sc);
    R = Math.max(R, (f.bx1 - f.cx) * sc);
    T = Math.max(T, (f.ground - f.by0) * sc);
    B = Math.max(B, (f.by1 - f.ground) * sc);
  }
  const PAD = 4;
  const CW = Math.ceil(L + R) + PAD * 2, CH = Math.ceil(T + B) + PAD * 2;
  const ax = Math.ceil(L) + PAD, ay = Math.ceil(T) + PAD;
  const ROWS = Math.ceil(GRID_COLS / COLS);
  const SW = CW * COLS, SH = CH * ROWS;
  console.log(`celda ${CW}x${CH}  ancla (${ax}, ${ay})  textura por clip ${SW}x${SH}`);
  mkdirSync(OUT, { recursive: true });
  const anims = {};
  GRID_CLIPS.forEach(([name, fps, loop], r) => {
    const row = fr.filter((f) => f.row === r);
    console.log(`  ${name.padEnd(14)} suelo ${row[0].ground}  alto ${row.map((f) => f.ground - f.by0).join(',')}  centro ${row.map((f) => Math.round(f.cx - row[0].cx)).join(',')}`);
    const sheet = Buffer.alloc(SW * SH * 4, 0);
    row.forEach((f, idx) => {
      const cellX = (idx % COLS) * CW, cellY = Math.floor(idx / COLS) * CH;
      for (let dy = 0; dy < CH; dy++)
        for (let dx = 0; dx < CW; dx++) {
          const sx0 = f.cx + (dx - ax) / sc, sx1 = f.cx + (dx + 1 - ax) / sc;
          const sy0 = f.ground + (dy - ay) / sc, sy1 = f.ground + (dy + 1 - ay) / sc;
          let rr = 0, gg = 0, bb = 0, aa = 0, n = 0;
          // promedio de área en alfa premultiplicado (vale para ampliar y para reducir)
          for (let y = Math.floor(sy0); y < Math.max(Math.floor(sy0) + 1, Math.ceil(sy1)); y++)
            for (let x = Math.floor(sx0); x < Math.max(Math.floor(sx0) + 1, Math.ceil(sx1)); x++) {
              n++;
              if (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1) continue;
              const p = y * w + x;
              if (!f.ids.has(lab[p])) continue;
              const o = p * 4, pa = px[o + 3] / 255;
              rr += px[o] * pa; gg += px[o + 1] * pa; bb += px[o + 2] * pa; aa += pa;
            }
          if (!n || aa <= 0) continue;
          const di = ((cellY + dy) * SW + cellX + dx) * 4;
          sheet[di] = Math.min(255, Math.round(rr / aa)); sheet[di + 1] = Math.min(255, Math.round(gg / aa)); sheet[di + 2] = Math.min(255, Math.round(bb / aa));
          sheet[di + 3] = Math.min(255, Math.round((aa / n) * 255));
        }
    });
    // tira en PNG y, si se pide, a WebP (docs §0.4): se convierte y se borra el PNG de public/
    save(join(OUT, `${name}.png`), SW, SH, sheet);
    let file = `${name}.png`;
    if (GRID_WEBP) {
      execFileSync(process.execPath, [join(ROOT, 'tools', 'convert-image.mjs'), join(OUT, `${name}.png`), join(OUT, `${name}.webp`), '0.92'], { stdio: 'ignore' });
      if (!existsSync(join(OUT, `${name}.webp`))) throw new Error(`no se pudo convertir ${name}.png a webp`);
      unlinkSync(join(OUT, `${name}.png`));
      file = `${name}.webp`;
    }
    anims[name] = { file, frames: GRID_COLS, fps, loop, ...(name === 'inferno-swing' ? { impact: IMPACT } : {}) };
  });
  const cfg = {
    source: `${basename(SRC)} (6 filas x 9: ULTI completa)`,
    view: CHAR.view,
    cell: { w: CW, h: CH },
    origin: { x: +(ax / CW).toFixed(5), y: +(ay / CH).toFixed(5) },
    standHeight: STAND_H,
    cols: COLS,
    hold: HOLD,
    preStrike: PRE,
    strikeFrom: PRE,
    impact: IMPACT,
    racketFree: GRID_RACKET_FREE,
    pickupGrab: GRID_PICKUP_GRAB,
    animations: anims,
  };
  writeFileSync(join(ROOT, 'src', 'characters', JSON_NAME), JSON.stringify(cfg, null, 2) + '\n');
  console.log('listo →', OUT);
}

