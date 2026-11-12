// Procesa la hoja de la ULTI: completa (pj-nxo-ulti.png, pj-nxo-rival-ulti.png: 6 filas x 9, rejilla fija) o la antigua
// del INFERNO DRIVE (pj-mai-inferno.png y equivalentes: 1 fila x 9 frames, fondo alfa o verde).
// Contrato de la hoja (qué es cada frame): docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md.
//   node tools/build-nxo-inferno.mjs [hoja.png] [salida]
// Hace: separa los 9 frames (por columnas vacías; si dos se solapan sin tocarse, por piezas; si el fuego los une,
// por la columna más vacía), escala TODO con un mismo factor (el guardia del frame 1 mide 140 px), alinea por los
// pies y el centro del cuerpo (píxeles oscuros: pelo y ropa) y empaqueta los 9 en una sola textura de 3 columnas.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';
import { keepEnclosedGreen } from './keep-enclosed-green.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.argv[2] || join(ROOT, 'public', 'personajes', 'Nxo', 'pj-nxo-ulti.png');
const OUT = process.argv[3] || join(ROOT, 'public', 'assets', 'characters', 'nxo-inferno');
// node tools/build-nxo-inferno.mjs [hoja.png] [carpeta-salida] [json] [front|flip|-] [png]
//   Hojas de la ULTI completa (6 filas x 9, rejilla fija; tiras en WebP, `png` como 6.º argumento para PNG):
//     NXO de espaldas:
//       node tools/build-nxo-inferno.mjs public/personajes/Nxo/pj-nxo-ulti.png
//     NXO rival, de frente (raqueta ya en la mano derecha, a la izquierda de la imagen: 'front', sin espejo):
//       node tools/build-nxo-inferno.mjs public/personajes/Nxo/rival/pj-nxo-rival-ulti.png public/assets/characters/nxo-front-inferno nxo-front-inferno.json front
//   Hojas antiguas de 1 fila x 9 (respaldo; ya no se procesan para NXO):
//     en _temp/respaldo_oficial/Nxo/ y /Nxo/rival/ (-antes-ulti)
//   MAI de espaldas (hoja con fondo verde):
//     node tools/build-nxo-inferno.mjs public/personajes/Mai/pj-mai-ulti.png public/assets/characters/mai-inferno mai-inferno.json
const JSON_NAME = process.argv[4] || 'nxo-inferno.json';
const FLIP = process.argv[5] === 'flip'; // espeja cada frame (para una hoja de frente con la raqueta en la mano izquierda)
const FRONT_VIEW = FLIP || process.argv[5] === 'front'; // solo la etiqueta "view" del JSON
const MAI = /pj-mai/i.test(basename(SRC)); // las hojas verdes de la flor de la gorra de MAI no son fondo
const STAND_H = 140;
/** hoja de 6 x 9: tiras en WebP (docs §0.4). `png` como 6.º argumento las deja en PNG (más rápido, para probar) */
const GRID_WEBP = process.argv[6] !== 'png';
// frames (0-based): hold = pose congelada en la concentración, PRE = justo antes del golpe, IMPACT = contacto
const [HOLD, PRE, IMPACT] = FLIP ? [4, 4, 5] : [4, 5, 6];
const NF = 9; // frames de la hoja (1 fila)
const COLS = 3;
const A = 12;
const FEATHER = 28; // px de la hoja original

const img = decode(SRC);
const { w, h, px } = img;
// hoja con fondo VERDE en vez de alfa (la de MAI): el verde pasa a transparente con el mismo croma que build-nxo-v2
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
    console.log(`fondo verde -> alfa${MAI ? `; ${keepEnclosedGreen(src, px, w, h).length} detalles verdes recuperados (gorra)` : ''}`);
  }
}
const al = (x, y) => px[(y * w + x) * 4 + 3];
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
/** el píxel p pertenece al frame f (los frames separados por piezas solo aceptan las suyas) */
const inFrame = (f, p) => !f.ids || f.ids.has(lab[p]);
const runs = (arr, min) => {
  const r = [];
  let s = -1;
  for (let i = 0; i <= arr.length; i++) {
    const on = i < arr.length && arr[i] > min;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { r.push([s, i - 1]); s = -1; }
  }
  return r;
};
// ------------------------------------------------------------------ hoja de 6 filas x 9 (ULTI completa)
// Hojas cuadradas (h/w > 0.8): rejilla FIJA de 9 columnas x 6 filas (celda = w/9 x h/6), una animación por fila.
// Cada pieza (alfa conexa) va entera a la celda donde cae su centro, así los efectos que rozan el borde de la celda
// no se cortan. Las piezas de menos de GRID_MIN_PX px son restos del croma y se ignoran.
// Las hojas de 1 fila (rival, Mai) siguen por el camino de siempre, más abajo.
const GRID = h / w > 0.8;
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
const GRID_RACKET_FREE = 2, GRID_PICKUP_GRAB = 3;
if (GRID) {
  buildGrid();
  process.exit(0);
}
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
    view: FRONT_VIEW ? 'front' : 'back',
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

const rowP = new Array(h).fill(0);
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (al(x, y) > A) rowP[y]++;
const rows = runs(rowP, 0);
if (rows.length !== 1) throw new Error(`se esperaba 1 fila y hay ${rows.length}`);

const colsOf = (y0, y1) => {
  const c = new Array(w).fill(0);
  for (let y = y0; y <= y1; y++) for (let x = 0; x < w; x++) if (al(x, y) > A) c[x]++;
  return c;
};
const frames = [];
rows.forEach(([y0, y1], r) => {
  const c = colsOf(y0, y1);
  let pieces = runs(c, 0).filter(([a, b]) => b - a >= 12); // sin rebabas sueltas de 1-3 px
  // piezas que contienen varios frames (se tocan por el fuego): se cortan en la columna más vacía cerca de los límites esperados
  const cell = w / NF;
  const out = [];
  for (const [a, b] of pieces) {
    const n = Math.max(1, Math.round((b - a + 1) / (cell * 1.05)));
    if (n === 1) { out.push([a, b]); continue; }
    // primero, por piezas: si hay tantas piezas grandes (personaje + raqueta) como frames, cada una es un frame y las
    // sueltas van con la grande más cercana; así no se corta nada en vertical
    const inPiece = comps.map((c, i) => i).filter((i) => comps[i].x0 >= a && comps[i].x1 <= b);
    const big = inPiece.filter((i) => comps[i].n >= 5000).sort((p, q) => comps[p].x0 - comps[q].x0);
    if (big.length === n) {
      const groups = big.map((i) => new Set([i]));
      for (const i of inPiece) {
        if (big.includes(i)) continue;
        const cx = comps[i].sx / comps[i].n;
        let k = 0;
        big.forEach((j, t) => { if (Math.abs(comps[j].sx / comps[j].n - cx) < Math.abs(comps[big[k]].sx / comps[big[k]].n - cx)) k = t; });
        groups[k].add(i);
      }
      for (const ids of groups) {
        const xs = [...ids].map((i) => comps[i]);
        out.push([Math.min(...xs.map((c) => c.x0)), Math.max(...xs.map((c) => c.x1)), '', ids]);
      }
      console.log(`  fila ${r + 1}: ${n} frames que se solapan en ${a}-${b}: separados por piezas (sin corte)`);
      continue;
    }
    // cuerpos: tramos de píxeles oscuros (pelo y ropa); el corte va en la columna más vacía entre dos cuerpos
    const dark = new Array(w).fill(0);
    for (let y = y0; y <= y1; y++) for (let x = a; x <= b; x++) { const o = (y * w + x) * 4; if (px[o + 3] > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70) dark[x]++; }
    const bodies = runs(dark, 3).filter(([p, q]) => q - p > 20);
    // si los remolinos de energía unen varios cuerpos (no se distinguen), el corte se busca cerca de la rejilla nominal
    const byBodies = bodies.length === n;
    if (!byBodies) console.warn(`  fila ${r + 1}: ${n} frames esperados y ${bodies.length} cuerpos en ${a}-${b}: se corta cerca de la rejilla`);
    let start = a;
    for (let i = 0; i < n - 1; i++) {
      // densidad de píxeles "sólidos" que NO son fuego (cuerpo, raqueta, manos): el corte pasa por el hueco entre
      // el cuerpo de uno y la raqueta del siguiente; el fuego se reparte a cada lado
      const solid = (x) => {
        let n2 = 0;
        for (let y = y0; y <= y1; y++) {
          const o = (y * w + x) * 4;
          if (px[o + 3] > 200 && !(px[o + 2] < 110 && px[o + 1] > 110 && px[o] > 230)) n2++;
        }
        return n2;
      };
      const nom = Math.round(a + ((i + 1) * (b - a + 1)) / n);
      const lo = byBodies ? bodies[i][1] + 1 : nom - 40, hi = byBodies ? bodies[i + 1][0] - 1 : nom + 40;
      let bv = 1e9;
      for (let x = lo; x <= hi; x++) bv = Math.min(bv, solid(x));
      const ok = [];
      for (let x = lo; x <= hi; x++) if (solid(x) <= bv) ok.push(x);
      const best = ok[Math.floor(ok.length / 2)];
      console.log(`  corte ${i + 1}|${i + 2} en x=${best} (sólidos ${bv}, hueco ${ok.length}px)`);
      out.push([start, best - 1, i > 0 ? 'LR' : 'R']);
      start = best;
    }
    out.push([start, b, 'L']);
  }
  for (const [x0, x1, cut = '', ids] of out) frames.push({ row: r, x0, x1, y0, y1, cut, ids });
});
if (frames.length !== NF) throw new Error(`se esperaban ${NF} frames y hay ${frames.length}: ${JSON.stringify(frames.map((f) => [f.x0, f.x1]))}`);
if (FLIP && frames.some((f) => f.ids)) throw new Error('flip con frames separados por piezas: no soportado (el espejo se hace por columnas)');

if (FLIP) {
  for (const f of frames) {
    for (let y = f.y0; y <= f.y1; y++)
      for (let i = 0; i < (f.x1 - f.x0 + 1) >> 1; i++) {
        const a = (y * w + f.x0 + i) * 4, b = (y * w + f.x1 - i) * 4;
        for (let k = 0; k < 4; k++) { const v = px[a + k]; px[a + k] = px[b + k]; px[b + k] = v; }
      }
    f.cut = f.cut.replace(/[LR]/g, (c) => (c === 'L' ? 'R' : 'L'));
  }
}
// métricas por frame: caja opaca, suelo (percentil de la base de los píxeles sólidos), centro del cuerpo (píxeles oscuros)
for (const f of frames) {
  let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, sx = 0, sn = 0;
  for (let y = f.y0; y <= f.y1; y++)
    for (let x = f.x0; x <= f.x1; x++) {
      const o = (y * w + x) * 4, a = px[o + 3];
      if (a <= A || !inFrame(f, y * w + x)) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (a > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70) { sx += x; sn++; }
    }
  f.bx0 = x0; f.bx1 = x1; f.by0 = y0; f.by1 = y1;
  f.cx = sn ? sx / sn : (x0 + x1) / 2;
}
// suelo de cada fila: mediana de las bases de sus frames (el pie apoyado no cambia aunque el otro se levante)
const med = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
for (const r of [0]) {
  const g = med(frames.filter((f) => f.row === r).map((f) => f.by1));
  for (const f of frames) if (f.row === r) f.ground = g;
}
// escala única: el cuerpo del guardia (frame 1) de la base al pelo mide STAND_H
// la fila 2 está dibujada algo más grande: su guardia final (frame 16) se iguala al guardia del frame 1
const f1 = frames[0], f16 = frames[0];
const scale = STAND_H / (f1.ground - f1.by0);
const rowScale = [scale, (scale * (f1.ground - f1.by0)) / (f16.ground - f16.by0)];
for (const f of frames) f.sc = rowScale[f.row];
console.log(`hoja ${w}x${h}  escala fila1 ${rowScale[0].toFixed(4)}  fila2 ${rowScale[1].toFixed(4)}`);
frames.forEach((f, i) => console.log(`  frame ${i + 1}: x ${f.x0}-${f.x1}  caja ${f.bx1 - f.bx0 + 1}x${f.by1 - f.by0 + 1}  centro ${f.cx.toFixed(0)}  suelo ${f.ground}`));

// extensiones respecto al ancla (cx, suelo), ya escaladas
let L = 0, R = 0, T = 0, B = 0;
for (const f of frames) {
  L = Math.max(L, (f.cx - f.bx0) * f.sc);
  R = Math.max(R, (f.bx1 - f.cx) * f.sc);
  T = Math.max(T, (f.ground - f.by0) * f.sc);
  B = Math.max(B, (f.by1 - f.ground) * f.sc);
}
const PAD = 4;
const CW = Math.ceil(L + R) + PAD * 2, CH = Math.ceil(T + B) + PAD * 2;
const ax = Math.ceil(L) + PAD, ay = Math.ceil(T) + PAD; // ancla dentro de la celda
const ROWS = Math.ceil(NF / COLS);
const SW = CW * COLS, SH = CH * ROWS;
console.log(`celda ${CW}x${CH}  ancla (${ax}, ${ay})  textura ${SW}x${SH}`);

const sheet = Buffer.alloc(SW * SH * 4, 0);
// reescalado por promedio de área en alfa premultiplicado
function blit(f, idx) {
  const cellX = (idx % COLS) * CW, cellY = Math.floor(idx / COLS) * CH;
  for (let dy = 0; dy < CH; dy++) {
    for (let dx = 0; dx < CW; dx++) {
      // caja de origen que cubre este píxel destino
      const sx0 = f.cx + (dx - ax) / f.sc, sx1 = f.cx + (dx + 1 - ax) / f.sc;
      const sy0 = f.ground + (dy - ay) / f.sc, sy1 = f.ground + (dy + 1 - ay) / f.sc;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++) {
        if (y < f.y0 || y > f.y1) { n++; continue; }
        for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
          n++;
          if (x < f.x0 || x > f.x1 || !inFrame(f, y * w + x)) continue;
          const o = (y * w + x) * 4;
          let pa = px[o + 3] / 255;
          // el desvanecido de los bordes de corte solo afecta al fuego (no a cuerpo, raqueta ni manos)
          if (f.cut && !(px[o + 3] > 200 && !(px[o + 2] < 110 && px[o + 1] > 110 && px[o] > 230))) {
            if (f.cut.includes('L')) pa *= Math.min(1, (x - f.x0) / FEATHER);
            if (f.cut.includes('R')) pa *= Math.min(1, (f.x1 - x) / FEATHER);
          }
          r += px[o] * pa; g += px[o + 1] * pa; b += px[o + 2] * pa; a += pa;
        }
      }
      if (!n || a <= 0) continue;
      const di = ((cellY + dy) * SW + cellX + dx) * 4;
      const al2 = a / n;
      sheet[di] = Math.min(255, Math.round(r / a)); sheet[di + 1] = Math.min(255, Math.round(g / a)); sheet[di + 2] = Math.min(255, Math.round(b / a));
      sheet[di + 3] = Math.min(255, Math.round(al2 * 255));
    }
  }
}
frames.forEach((f, i) => blit(f, i));
mkdirSync(OUT, { recursive: true });
save(join(OUT, 'inferno-swing.png'), SW, SH, sheet);

// fotogramas clave (0-based): espera = frame 8, contacto = frame 11
const cfg = {
  source: `${process.argv[2] ? basename(SRC) : 'pj-nxo-inferno.png'} (1 fila x 9: INFERNO DRIVE)`,
  view: FRONT_VIEW ? 'front' : 'back',
  cell: { w: CW, h: CH },
  origin: { x: +(ax / CW).toFixed(5), y: +(ay / CH).toFixed(5) },
  standHeight: STAND_H,
  cols: COLS,
  hold: HOLD,
  preStrike: PRE,
  strikeFrom: PRE,
  impact: IMPACT,
  animations: { 'inferno-swing': { file: 'inferno-swing.png', frames: NF, fps: 15, loop: false, impact: IMPACT } },
};
writeFileSync(join(ROOT, 'src', 'characters', JSON_NAME), JSON.stringify(cfg, null, 2) + '\n');
console.log('listo →', OUT);

