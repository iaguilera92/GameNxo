// Corta las hojas NUEVAS de NXO de espaldas (public/personajes/Nxo/pj-nxo-sprites-1..4.png) y genera
// las tiras de animación que carga el juego + sus JSON.
//   node tools/build-nxo-v2.mjs
// Hojas: 1536x1024, 8 columnas x 8 filas, celda 192x128, fondo verde chroma. Ya vienen normalizadas
// (personaje centrado en x, pies a y≈122-124), así que NO se reescala ni se realinea: solo se quita el
// verde (a alfa, con despill en los bordes) y se copia cada fila a una tira de 8 frames (1536x128).
// Salida: public/assets/characters/nxo-v2/<anim>.png y los JSON de src/characters/ (nxo-sprites, nxo-hits,
// nxo-move, nxo-special, nxo-extra). El INFERNO (pj-nxo-sprite-inferno.png) va aparte: build-nxo-inferno.mjs.
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode, save } from './png-lite.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'public', 'personajes', 'Nxo');
const DIR = 'nxo-v2';
const OUT = join(ROOT, 'public', 'assets', 'characters', DIR);
const CW = 192;
const CH = 128;
const N = 8;

/**
 * Registro de filas (1-based como en la hoja). `keep`: 'main' = quedarse solo con la pieza principal
 * (quita marcas sueltas como los "( )" de la espera activa).
 */
const ROWS = {
  1: { 1: 'idle', 2: 'run', 3: 'runstop', 4: 'victory', 5: 'brake-turn', 6: 'run-left', 7: 'dash', 8: 'defeat' },
  2: { 1: 'forehand', 2: 'backhand', 3: 'forehand-power', 4: 'backhand-power', 5: 'serve', 6: 'serve-spin', 7: 'smash', 8: 'smash-power' },
  3: { 1: 'dive-right', 2: 'dive-left', 3: 'recover-right', 4: 'recover-left', 5: 'stunned', 6: 'point-won', 7: 'point-lost', 8: 'wait' },
  4: { 1: 'serve-bounce', 2: 'serve-toss', 3: 'walk', 4: 'inferno-hit', 5: 'volley', 6: 'dropshot', 7: 'intro', 8: 'greet' },
};
const KEEP_MAIN = new Set(['wait']);

// ------------------------------------------------------------------ chroma
function chroma(px, i) {
  const r = px[i], g = px[i + 1], b = px[i + 2];
  const m = Math.max(r, b);
  const d = g - m;
  if (d > 60) return [0, 0, 0, 0];
  if (d > 12) {
    // borde: alfa parcial y sin reflejo verde
    const a = Math.round(255 * (1 - (d - 12) / 48));
    return [r, Math.min(g, m), b, a];
  }
  return [r, d > 0 ? m : g, b, px[i + 3]];
}

/** Deja solo la pieza conexa más grande (alfa > 40) de una celda. */
function keepMain(cell) {
  const seen = new Int32Array(CW * CH).fill(-1);
  const sizes = [];
  for (let s = 0; s < CW * CH; s++) {
    if (seen[s] >= 0 || cell[s * 4 + 3] <= 40) continue;
    const id = sizes.length;
    let n = 0;
    const st = [s];
    seen[s] = id;
    while (st.length) {
      const p = st.pop();
      n++;
      const x = p % CW, y = (p / CW) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) continue;
        const q = ny * CW + nx;
        if (seen[q] >= 0 || cell[q * 4 + 3] <= 40) continue;
        seen[q] = id;
        st.push(q);
      }
    }
    sizes.push(n);
  }
  const best = sizes.indexOf(Math.max(...sizes));
  for (let p = 0; p < CW * CH; p++) if (seen[p] !== best) cell[p * 4 + 3] = 0;
}

// ------------------------------------------------------------------ corte
// Las hojas NO caen exactas en la rejilla de 192x128 (los pies de una fila cruzan a la celda de abajo y
// cada hoja tiene un tamaño de dibujo algo distinto). Por eso: se quita el verde de toda la hoja, se
// separan las piezas conexas y cada pieza va a la celda (fila, columna) donde cae su centro. Luego cada
// fila se apoya en un suelo común (mediana de las bases de sus frames) y cada hoja se escala para que el
// personaje de pie (frame 1 de la fila 1) mida lo mismo que en la hoja 1.
const med = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
mkdirSync(OUT, { recursive: true });
const frames = {}; // name -> [{ sheet, bx0, bx1, by0, by1, ground, cx, mask }]
const sheets = {};
for (const sheet of [1, 2, 3, 4]) {
  const img = decode(join(SRC_DIR, `pj-nxo-sprites-${sheet}.png`));
  const { w, h } = img;
  if (w !== CW * N || h !== CH * N) throw new Error(`hoja ${sheet}: ${w}x${h} (se esperaba ${CW * N}x${CH * N})`);
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h * 4; i += 4) {
    const [r, g, b, a] = chroma(img.px, i);
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  }
  // cortes entre filas, por columna: la línea con menos píxeles cerca del límite nominal (una raqueta
  // levantada puede tocar los pies del frame de arriba y unir dos frames en una sola pieza)
  const cutAt = []; // [col][r] = y: no se une y con y+1
  for (let col = 0; col < N; col++) {
    cutAt[col] = [];
    for (let r = 1; r < N; r++) {
      const b = r * CH;
      let best = b, bv = 1e9;
      for (let y = b - 8; y <= b + 16; y++) {
        let n = 0;
        for (let x = col * CW; x < (col + 1) * CW; x++) if (px[(y * w + x) * 4 + 3] > 24) n++;
        if (n < bv) { bv = n; best = y; }
      }
      cutAt[col][r] = best;
    }
  }
  const isCut = (x, y, ny) => {
    if (ny === y) return false;
    const cuts = cutAt[Math.min(N - 1, Math.floor(x / CW))];
    const yy = Math.min(y, ny);
    return cuts.includes(yy);
  };
  // piezas conexas (alfa > 24)
  const lab = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let s = 0; s < w * h; s++) {
    if (lab[s] >= 0 || px[s * 4 + 3] <= 24) continue;
    const id = comps.length;
    const c = { x0: 1e9, x1: -1, y0: 1e9, y1: -1, n: 0 };
    const st = [s];
    lab[s] = id;
    while (st.length) {
      const p = st.pop();
      const x = p % w, y = (p / w) | 0;
      c.n++;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const q = ny * w + nx;
          if (lab[q] >= 0 || px[q * 4 + 3] <= 24 || isCut(x, y, ny)) continue;
          lab[q] = id;
          st.push(q);
        }
    }
    comps.push(c);
  }
  // cuerpos (piezas con pelo/ropa oscuros): su fila sale de los pies (≈ y 122 + 128·fila)
  const dark = new Int32Array(comps.length);
  for (let p = 0; p < w * h; p++) {
    const id = lab[p];
    if (id < 0) continue;
    const o = p * 4;
    if (px[o + 3] > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70) dark[id]++;
  }
  const clampI = (v) => Math.min(N - 1, Math.max(0, v));
  const bodies = [];
  comps.forEach((c, i) => {
    c.col = clampI(Math.floor((c.x0 + c.x1) / 2 / CW));
    if (dark[i] > 150) {
      c.row = clampI(Math.round((c.y1 - 122) / CH));
      c.body = true;
      bodies.push(c);
    }
  });
  // el resto (raqueta suelta, estrellas, polvo, marcas) va con el cuerpo más cercano de su columna
  for (const c of comps) {
    if (c.body) continue;
    let best = null, bd = 1e9;
    for (const b of bodies) {
      if (b.col !== c.col) continue;
      const d = Math.max(0, b.y0 - c.y1, c.y0 - b.y1) + Math.max(0, b.x0 - c.x1, c.x0 - b.x1);
      if (d < bd) { bd = d; best = b; }
    }
    c.row = best && bd < 70 ? best.row : -1;
  }
  for (const c of comps) if (c.x1 - c.x0 > CW * 1.15) console.warn(`  hoja ${sheet}: pieza ancha ${c.x0}-${c.x1} (fila ${c.row + 1})`);
  sheets[sheet] = { w, h, px, lab, comps };
  for (const [row, name] of Object.entries(ROWS[sheet])) {
    const r = Number(row) - 1;
    const list = [];
    for (let f = 0; f < N; f++) {
      let ids = comps.map((c, i) => (c.row === r && c.col === f && c.n >= 6 ? i : -1)).filter((i) => i >= 0);
      if (KEEP_MAIN.has(name)) ids = [ids.reduce((a, b) => (comps[b].n > comps[a].n ? b : a))];
      const set = new Set(ids);
      let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1, sx = 0, sn = 0;
      for (const i of ids) {
        const c = comps[i];
        x0 = Math.min(x0, c.x0); x1 = Math.max(x1, c.x1); y0 = Math.min(y0, c.y0); y1 = Math.max(y1, c.y1);
      }
      for (let y = y0; y <= y1; y++)
        for (let x = x0; x <= x1; x++) {
          const o = (y * w + x) * 4;
          if (set.has(lab[y * w + x]) && px[o + 3] > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70) { sx += x; sn++; }
        }
      // base "sólida" (alfa alto): sin sombras ni polvo semitransparente
      let solidBot = -1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (set.has(lab[y * w + x]) && px[(y * w + x) * 4 + 3] > 200) solidBot = y;
      // ancho de la cabeza (pelo): filas superiores de píxeles oscuros. No depende de la pose (de espaldas)
      const isDark = (x, y) => { const o = (y * w + x) * 4; return set.has(lab[y * w + x]) && px[o + 3] > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70; };
      let yt = -1;
      for (let y = y0; y <= y1 && yt < 0; y++) { let n = 0; for (let x = x0; x <= x1; x++) if (isDark(x, y)) n++; if (n >= 4) yt = y; }
      const spans = [];
      for (let y = yt + 8; y <= yt + 26 && y <= y1; y++) {
        let a = 1e9, b = -1;
        for (let x = x0; x <= x1; x++) if (isDark(x, y)) { if (x < a) a = x; if (x > b) b = x; }
        if (b >= 0) spans.push(b - a + 1);
      }
      const headW = spans.length ? med(spans) : 0;
      list.push({ sheet, set, x0, x1, y0, y1, bot: solidBot, dark: sn, headW, cxDark: sn ? sx / sn : (x0 + x1) / 2, cell0: f * CW + CW / 2 });
    }
    const ground = med(list.map((f) => f.bot));
    for (const f of list) f.ground = ground;
    frames[name] = list;
  }
}

// escala por hoja: alto de pie (frame 1, fila 1) igual al de la hoja 1
const standH = (name) => {
  const f = frames[name][0];
  return f.ground - f.y0;
};
const REF = { 1: 'idle', 2: 'forehand', 3: 'dive-right', 4: 'serve-bounce' };
// todas al alto de la hoja más pequeña (solo se reduce, nunca se amplía)
const STAND_SRC = Math.min(...[1, 2, 3, 4].map((s) => standH(REF[s])));
const sheetScale = {};
for (const s of [1, 2, 3, 4]) sheetScale[s] = STAND_SRC / standH(REF[s]);
console.log('alto de pie por hoja:', Object.fromEntries([1, 2, 3, 4].map((s) => [s, standH(REF[s])])), 'escala', sheetScale);
// además, algunas filas vienen dibujadas más chicas (p. ej. saque/smash): escala por fila según el ancho
// de la cabeza (mediana de la fila) comparado con el de la fila de referencia de su hoja
// Se compara el frame "de pie" de cada fila con la guardia de referencia (STAND_SRC). Las filas que empiezan
// corriendo se comparan con la carrera (frame 1 de 'run'); las recuperaciones, por su último frame (de pie).
const rowScale = {};
const hOf = (name, i) => frames[name][i].ground - frames[name][i].y0;
const RUN_LIKE = new Set(['runstop', 'brake-turn', 'run-left', 'dash']);
const LAST_STAND = new Set(['recover-right', 'recover-left']);
for (const [name, list] of Object.entries(frames)) {
  let target;
  if (RUN_LIKE.has(name)) target = hOf('run', 0) * sheetScale[frames.run[0].sheet] / hOf(name, 0);
  else if (LAST_STAND.has(name)) target = STAND_SRC / hOf(name, N - 1);
  else if (name === 'run') target = sheetScale[list[0].sheet];
  else target = STAND_SRC / hOf(name, 0);
  rowScale[name] = target;
  for (const f of list) f.sc = target;
}
console.log('escala por fila:', Object.fromEntries(Object.entries(rowScale).map(([n, v]) => [n, +v.toFixed(3)])));

// celda de salida: cabe todo (con el ancla en el suelo y en el centro de la celda original)
let L = 0, R = 0, T = 0, B = 0;
for (const list of Object.values(frames))
  for (const f of list) {
    const sc = f.sc;
    L = Math.max(L, (f.cell0 - f.x0) * sc);
    R = Math.max(R, (f.x1 + 1 - f.cell0) * sc);
    T = Math.max(T, (f.ground - f.y0) * sc);
    B = Math.max(B, (f.y1 + 1 - f.ground) * sc);
  }
const PAD = 2;
const HALF = Math.ceil(Math.max(L, R)) + PAD; // simétrica: el ancla queda en el centro
const OW = HALF * 2;
const AY = Math.ceil(T) + PAD;
const OH = AY + Math.ceil(B) + PAD;
console.log(`celda de salida ${OW}x${OH}  ancla (${HALF}, ${AY})`);

const metrics = {};
for (const [name, list] of Object.entries(frames)) {
  const strip = Buffer.alloc(OW * N * OH * 4, 0);
  list.forEach((f, i) => {
    const { w, px, lab } = sheets[f.sheet];
    const sc = f.sc;
    for (let dy = 0; dy < OH; dy++)
      for (let dx = 0; dx < OW; dx++) {
        const sx0 = f.cell0 + (dx - HALF) / sc, sx1 = f.cell0 + (dx + 1 - HALF) / sc;
        const sy0 = f.ground + (dy - AY) / sc, sy1 = f.ground + (dy + 1 - AY) / sc;
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let y = Math.floor(sy0); y < Math.ceil(sy1); y++)
          for (let x = Math.floor(sx0); x < Math.ceil(sx1); x++) {
            n++;
            if (x < f.x0 || x > f.x1 || y < f.y0 || y > f.y1 || !f.set.has(lab[y * w + x])) continue;
            const o = (y * w + x) * 4;
            const pa = px[o + 3] / 255;
            r += px[o] * pa; g += px[o + 1] * pa; b += px[o + 2] * pa; a += pa;
          }
        if (!n || a <= 0) continue;
        const di = (dy * OW * N + i * OW + dx) * 4;
        strip[di] = Math.round(r / a); strip[di + 1] = Math.round(g / a); strip[di + 2] = Math.round(b / a);
        strip[di + 3] = Math.min(255, Math.round((a / n) * 255));
      }
  });
  save(join(OUT, `${name}.png`), OW * N, OH, strip);
  metrics[name] = list.map((f) => Math.round((f.ground - f.y0) * f.sc));
  console.log(`${name.padEnd(15)} hoja ${list[0].sheet}  suelo ${list[0].ground}  alto ${metrics[name].join(',')}`);
}

// ------------------------------------------------------------------ JSON
const STAND_H = Math.round(STAND_SRC);
const origin = { x: 0.5, y: +(AY / OH).toFixed(5) };
const cell = { w: OW, h: OH };
const src = (s, r) => `pj-nxo-sprites-${s}.png (fila ${r})`;
const anim = (file, fps, loop, impact) => ({ file: `${file}.png`, frames: N, fps, loop, ...(impact !== undefined ? { impact } : {}), scale: 1 });
const hit = (file, fps, impact) => ({ file: `${file}.png`, frames: N, fps, loop: false, impact });
const write = (name, obj) => writeFileSync(join(ROOT, 'src', 'characters', `${name}.json`), JSON.stringify(obj, null, 2) + '\n');

// fotogramas clave (0-based) — ver MOVIMIENTOS-PERSONAJES.txt §10
const K = {
  hold: 2, // guardia con la raqueta atrás (forehand/backhand)
  serveWait: 2, // saque: postura de trofeo (raqueta atrás) esperando la pelota
  smashStart: 2,
  hitImpact: 4,
  serveImpact: 4,
  smashImpact: 4,
};

write('nxo-sprites', {
  source: 'pj-nxo-sprites-1.png / pj-nxo-sprites-2.png (tools/build-nxo-v2.mjs)',
  view: 'back',
  cell,
  origin,
  standHeight: STAND_H,
  hold: K.hold,
  serveWait: K.serveWait,
  smashStart: K.smashStart,
  animations: {
    idle: anim('idle', 8, true),
    run: anim('run', 14, true),
    runstop: anim('runstop', 14, false),
    forehand: anim('forehand', 15, false, K.hitImpact),
    backhand: anim('backhand', 15, false, K.hitImpact),
    serve: anim('serve', 12, false, K.serveImpact),
    smash: anim('smash', 14, false, K.smashImpact),
    victory: anim('victory', 10, false),
  },
});
write('nxo-hits', {
  source: src(2, '1-7'),
  view: 'back',
  cell,
  origin,
  standHeight: STAND_H,
  hold: K.hold,
  serveWait: K.serveWait,
  smashStart: K.smashStart,
  animations: {
    forehand: hit('forehand', 15, K.hitImpact),
    backhand: hit('backhand', 15, K.hitImpact),
    'forehand-power': hit('forehand-power', 15, K.hitImpact),
    'backhand-power': hit('backhand-power', 15, K.hitImpact),
    serve: hit('serve', 12, K.serveImpact),
    smash: hit('smash', 14, K.smashImpact),
  },
});
write('nxo-move', {
  source: src(1, 5),
  view: 'back',
  cell,
  origin,
  standHeight: STAND_H,
  turnExit: 5,
  turnRate: 2.2,
  landFrom: 1,
  landExit: 3,
  landEnd: 4,
  landRate: 2.6,
  animations: { 'brake-turn': { file: 'brake-turn.png', frames: N, fps: 14, loop: false } },
});
write('nxo-special', {
  source: src(2, 8),
  view: 'back',
  cell,
  origin,
  standHeight: STAND_H,
  start: 2,
  animations: { 'smash-power': { file: 'smash-power.png', frames: N, fps: 14, loop: false, impact: 4 } },
});
const ex = (file, fps, loop = false, extra = {}) => ({ file: `${file}.png`, frames: N, fps, loop, ...extra });
write('nxo-extra', {
  source: 'pj-nxo-sprites-1..4.png (tools/build-nxo-v2.mjs): animaciones nuevas',
  view: 'back',
  cell,
  origin,
  standHeight: STAND_H,
  animations: {
    'run-left': ex('run-left', 14, true),
    dash: ex('dash', 18, true),
    defeat: ex('defeat', 10),
    'serve-spin': ex('serve-spin', 12, false, { impact: K.serveImpact }),
    'dive-right': ex('dive-right', 18),
    'dive-left': ex('dive-left', 18),
    'recover-right': ex('recover-right', 14),
    'recover-left': ex('recover-left', 14),
    stunned: ex('stunned', 12, true),
    'point-won': ex('point-won', 12),
    'point-lost': ex('point-lost', 10),
    wait: ex('wait', 10, true),
    'serve-bounce': ex('serve-bounce', 12, true),
    'serve-toss': ex('serve-toss', 14),
    walk: ex('walk', 10, true),
    'inferno-hit': ex('inferno-hit', 14),
    volley: ex('volley', 16, false, { impact: 4 }),
    dropshot: ex('dropshot', 14, false, { impact: 4 }),
    intro: ex('intro', 10),
    greet: ex('greet', 10),
  },
});
console.log(`alto ${STAND_H}  origen ${JSON.stringify(origin)}  → ${OUT}`);
