// Corta las 4 hojas de movimientos (8 filas) de UN personaje en tiras de animación (WebP) + los JSON del juego.
// Sirve para cualquier personaje y vista dado de alta en tools/characters.mjs (nxo, nxo-front, mai, ...).
//   node tools/build-moves.mjs <id>      p. ej. nxo | nxo-front | mai
//   node tools/build-moves.mjs all       todos los que tienen hojas de movimientos
// Entrada: public/personajes/<dir>/<prefix>-1..4.png (fondo verde, blanco o transparente; el tamaño de celda se deduce de
//          cada hoja, así que vale cualquier resolución).
// Salida:  public/assets/characters/<id>-v2/<clip>.webp y src/characters/<id>-{sprites,hits,move,special,extra}.json
// La ULTI (hoja de 6 x 9) va aparte: tools/build-ulti.mjs. Guía: docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decode } from './png-lite.mjs';
import { fail, saveWebp } from './image-out.mjs';
import { keepEnclosedGreen } from './keep-enclosed-green.mjs';
import { CHARACTERS } from './characters.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = process.argv[2];
const WITH_MOVES = Object.entries(CHARACTERS).filter(([, c]) => c.moves).map(([id]) => id);
if (ID === 'all') {
  const failed = [];
  for (const id of WITH_MOVES) {
    try { execFileSync(process.execPath, [fileURLToPath(import.meta.url), id], { stdio: 'inherit' }); } catch { failed.push(id); }
  }
  if (failed.length) fail(`fallaron: ${failed.join(', ')} (el resto se generó)`);
  process.exit(0);
}
const CHAR = CHARACTERS[ID];
if (!CHAR) fail(`uso: node tools/build-moves.mjs <${WITH_MOVES.join('|')}|all>`);
if (!CHAR.moves) fail(`${ID} aún no tiene hojas de movimientos en tools/characters.mjs (solo ULTI). Con movimientos: ${WITH_MOVES.join(', ')}`);
const CFG = CHAR.moves;
const VIEW = CHAR.view;
const SRC_DIR = join(ROOT, 'public', 'personajes', ...CHAR.dir.split('/'));
const SRC_NAME = (s) => `${CHAR.prefix}-${s}.png`;
const DIR = `${ID}-v2`;
const PFX = `${ID}-`;
const FLIP_SHEETS = new Set(CFG.flipSheets ?? []);
const FLIP_ROWS = Object.fromEntries(Object.entries(CFG.flipRows ?? {}).map(([sheet, rows]) => [sheet, new Set(rows)]));
const CUT_AT = CFG.cutAt ?? {};
const GREEN = !!CFG.greenDetails;
const ROWS = CFG.rows;
const DERIVED = CFG.derived ?? {};
const KEEP_MAIN = new Set(CFG.keepMain ?? []);
const REF_FOURTH = CFG.refFourth;
const SCALE_AS_CFG = CFG.scaleAs ?? {};
for (const s of [1, 2, 3, 4]) if (!existsSync(join(SRC_DIR, SRC_NAME(s)))) fail(`falta la hoja ${join(SRC_DIR, SRC_NAME(s))}`);
const EXT = '.webp'; // todas las tiras van en WebP (docs §0, regla 4)
const OUT = join(ROOT, 'public', 'assets', 'characters', DIR);
const N = 8; // filas por hoja
const COLS = CFG.cols; // frames por fila de cada hoja
// ------------------------------------------------------------------ fondo blanco / espejo (hojas del rival)
/** espeja cada celda de la hoja en horizontal (celda a celda, para que las columnas no se inviertan) */
function flipX(img, NC) {
  const { w, h, px } = img;
  const cw = w / NC;
  const out = Buffer.from(px);
  for (let y = 0; y < h; y++)
    for (let c = 0; c < NC; c++) {
      const x0 = Math.round(c * cw), x1 = Math.round((c + 1) * cw) - 1;
      for (let x = x0; x <= x1; x++) {
        const s = (y * w + x) * 4, d = (y * w + (x0 + x1 - x)) * 4;
        out[d] = px[s]; out[d + 1] = px[s + 1]; out[d + 2] = px[s + 2]; out[d + 3] = px[s + 3];
      }
    }
  px.set(out);
}
/** fondo BLANCO -> transparente: relleno desde los bordes (lo blanco encerrado, como la camiseta o el cordaje, se conserva) */
function whiteToAlpha(img) {
  const { w, h, px } = img;
  const light = (i) => px[i + 3] > 0 && Math.min(px[i], px[i + 1], px[i + 2]) > 232;
  const corner = (px[0] + px[1] + px[2]) / 3;
  if (corner < 235 || px[3] === 0) return; // no es una hoja de fondo blanco
  const gone = new Uint8Array(w * h);
  const st = [];
  const push = (x, y) => { const p = y * w + x; if (!gone[p] && light(p * 4)) { gone[p] = 1; st.push(p); } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (st.length) {
    const p = st.pop();
    const x = p % w, y = (p / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }
  // halo: pixeles claros pegados al fondo quitado -> alfa parcial (sin borde blanco alrededor del dibujo)
  const edge = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      if (gone[p] || !(gone[p - 1] || gone[p + 1] || gone[p - w] || gone[p + w])) continue;
      const m = Math.min(px[p * 4], px[p * 4 + 1], px[p * 4 + 2]);
      if (m > 150) edge.push([p, Math.max(0, Math.min(255, Math.round(((235 - m) / 85) * 255)))]);
    }
  for (let p = 0; p < w * h; p++) if (gone[p]) px[p * 4 + 3] = 0;
  for (const [p, a] of edge) px[p * 4 + 3] = Math.min(px[p * 4 + 3], a);
}
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

// ------------------------------------------------------------------ corte
// Las hojas NO caen exactas en la rejilla de 192x128 (los pies de una fila cruzan a la celda de abajo y
// cada hoja tiene un tamaÃ±o de dibujo algo distinto). Por eso: se quita el verde de toda la hoja, se
// separan las piezas conexas y cada pieza va a la celda (fila, columna) donde cae su centro. Luego cada
// fila se apoya en un suelo comÃºn (mediana de las bases de sus frames) y cada hoja se escala para que el
// personaje de pie (frame 1 de la fila 1) mida lo mismo que en la hoja 1.
const med = (a) => [...a].sort((p, q) => p - q)[Math.floor(a.length / 2)];
mkdirSync(OUT, { recursive: true });
const frames = {}; // name -> [{ sheet, bx0, bx1, by0, by1, ground, cx, mask }]
const sheets = {};
for (const sheet of [1, 2, 3, 4]) {
  const img = decode(join(SRC_DIR, SRC_NAME(sheet)));
  if (FLIP_SHEETS.has(sheet)) flipX(img, COLS[sheet]);
  whiteToAlpha(img);
  const { w, h } = img;
  const NC = COLS[sheet];
  // celda REAL de esta hoja: cada hoja puede venir con otro tamaÃ±o (p. ej. 1330x1182); el corte usa la rejilla NC x N
  const cw = w / NC;
  const chh = h / N;
  console.log(`hoja ${sheet}: ${w}x${h}, celda ${cw.toFixed(1)}x${chh.toFixed(1)}`);
  // hoja con fondo TRANSPARENTE (en vez de verde): se descarta el halo casi invisible (alfa bajo), que unirÃ­a piezas
  let transp = 0;
  for (let i = 3; i < w * h * 4; i += 4) if (img.px[i] === 0) transp++;
  const hasAlpha = transp > w * h * 0.1;
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h * 4; i += 4) {
    let [r, g, b, a] = chroma(img.px, i);
    if (hasAlpha && a < 80) a = 0;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  }
  // MAI: las hojas verdes de la flor de la gorra no son fondo (el croma las dejaba como agujeros en la gorra)
  if (GREEN) console.log(`  hoja ${sheet}: ${keepEnclosedGreen(img.px, px, w, h).length} detalles verdes recuperados (gorra)`);
  // cortes entre filas, por columna: la lÃ­nea con menos pÃ­xeles cerca del lÃ­mite nominal (una raqueta
  // levantada puede tocar los pies del frame de arriba y unir dos frames en una sola pieza)
  const cutAt = []; // [col][r] = y: no se une y con y+1
  for (let col = 0; col < NC; col++) {
    cutAt[col] = [];
    for (let r = 1; r < N; r++) {
      const b = Math.round(r * chh);
      let best = b, bv = 1e9;
      for (let y = b - 40; y <= b + 16; y++) { // ventana amplia hacia arriba: en los saltos la cabeza cruza el limite nominal de la fila
        let n = 0;
        for (let x = Math.round(col * cw); x < Math.round((col + 1) * cw); x++) if (px[(y * w + x) * 4 + 3] > 24) n++;
        if (n < bv || (n === bv && Math.abs(y - b) < Math.abs(best - b))) { bv = n; best = y; } // empate: el mas cercano al limite nominal
      }
      cutAt[col][r] = CUT_AT[sheet]?.[`${r}/${col + 1}`] ?? best;
    }
  }
  const isCut = (x, y, ny) => {
    if (ny === y) return false;
    const cuts = cutAt[Math.min(NC - 1, Math.floor(x / cw))];
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
  // cuerpos (piezas con pelo/ropa oscuros): su fila sale de los pies (â‰ˆ y 122 + 128Â·fila)
  const dark = new Int32Array(comps.length);
  for (let p = 0; p < w * h; p++) {
    const id = lab[p];
    if (id < 0) continue;
    const o = p * 4;
    if (px[o + 3] > 220 && px[o] < 70 && px[o + 1] < 70 && px[o + 2] < 70) dark[id]++;
  }
  const clampI = (v) => Math.min(N - 1, Math.max(0, v));
  const clampC = (v) => Math.min(NC - 1, Math.max(0, v));
  const bodies = [];
  comps.forEach((c, i) => {
    c.col = clampC(Math.floor((c.x0 + c.x1) / 2 / cw));
    if (dark[i] > 150) {
      c.row = clampI(Math.round((c.y1 - 0.953 * chh) / chh)); // los pies caen a â‰ˆ 95 % de la altura de la celda
      c.body = true;
      bodies.push(c);
    }
  });
  // el resto (raqueta suelta, estrellas, polvo, marcas) va con el cuerpo mÃ¡s cercano de su columna
  // ...salvo el trozo que la línea de corte entre filas separó de un cuerpo (p. ej. la suela de un salto que roza
  // la cabeza del frame de abajo): ese va con el cuerpo del que se cortó, aunque el otro quede más cerca
  const cutOwner = (ci) => {
    const c = comps[ci];
    const votes = new Map();
    for (const [y, ny] of [[c.y0, c.y0 - 1], [c.y1, c.y1 + 1]]) {
      if (ny < 0 || ny >= h) continue;
      for (let x = c.x0; x <= c.x1; x++) {
        if (lab[y * w + x] !== ci) continue;
        for (let nx = Math.max(0, x - 1); nx <= Math.min(w - 1, x + 1); nx++) {
          const o = lab[ny * w + nx];
          if (o >= 0 && o !== ci && comps[o].body && isCut(x, y, ny)) votes.set(o, (votes.get(o) || 0) + 1);
        }
      }
    }
    let own = -1, nv = 0;
    for (const [o, v] of votes) if (v > nv) { nv = v; own = o; }
    return own;
  };
  for (const [ci, c] of comps.entries()) {
    if (c.body) continue;
    const own = cutOwner(ci);
    if (own >= 0) {
      c.row = comps[own].row;
      c.col = comps[own].col;
      continue;
    }
    let best = null, bd = 1e9;
    for (const b of bodies) {
      if (b.col !== c.col) continue;
      const d = Math.max(0, b.y0 - c.y1, c.y0 - b.y1) + Math.max(0, b.x0 - c.x1, c.x0 - b.x1);
      if (d < bd) { bd = d; best = b; }
    }
    c.row = best && bd < 70 ? best.row : -1;
  }
  for (const c of comps) if (c.x1 - c.x0 > cw * 1.15) console.warn(`  hoja ${sheet}: pieza ancha ${c.x0}-${c.x1} (fila ${c.row + 1})`);
  sheets[sheet] = { w, h, px, lab, comps };
  for (const [row, name] of Object.entries(ROWS[sheet])) {
    const r = Number(row) - 1;
    const list = [];
    for (let f = 0; f < NC; f++) {
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
      // base "sÃ³lida" (alfa alto): sin sombras ni polvo semitransparente
      let solidBot = -1;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (set.has(lab[y * w + x]) && px[(y * w + x) * 4 + 3] > 200) solidBot = y;
      // ancho de la cabeza (pelo): filas superiores de pÃ­xeles oscuros. No depende de la pose (de espaldas)
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
      // tope del CUERPO (sin estrellas, destellos ni humo que sobresalen): con Ã©l se mide el alto del personaje
      const bodyIds = ids.filter((i) => comps[i].body);
      const top = bodyIds.length ? Math.min(...bodyIds.map((i) => comps[i].y0)) : y0;
      const flip = !!FLIP_ROWS[sheet]?.has(Number(row));
      list.push({ sheet, set, x0, x1, y0, y1, top, bot: solidBot, dark: sn, headW, cxDark: sn ? sx / sn : (x0 + x1) / 2, cell0: f * cw + cw / 2, flip });
    }
    const ground = med(list.map((f) => f.bot));
    for (const f of list) f.ground = ground;
    frames[name] = list;
  }
}
// clips derivados: copia de los frames elegidos (conservan el suelo de su fila; la escala se calcula aparte)
for (const [name, d] of Object.entries(DERIVED)) {
  frames[name] = d.frames.map((i) => ({ ...frames[d.from][i] }));
  console.log(`${name}: frames ${d.frames.map((i) => i + 1).join(',')} de ${d.from}`);
}

// escala por hoja: alto de pie (frame 1, fila 1) igual al de la hoja 1
const standH = (name) => {
  const f = frames[name][0];
  return f.ground - f.top;
};
const REF = { 1: 'idle', 2: 'forehand', 3: 'dive-right', 4: REF_FOURTH };
// todas al alto de la hoja mÃ¡s pequeÃ±a (solo se reduce, nunca se amplÃ­a)
const STAND_SRC = Math.min(...[1, 2, 3, 4].map((s) => standH(REF[s])));
const sheetScale = {};
for (const s of [1, 2, 3, 4]) sheetScale[s] = STAND_SRC / standH(REF[s]);
console.log('alto de pie por hoja:', Object.fromEntries([1, 2, 3, 4].map((s) => [s, standH(REF[s])])), 'escala', sheetScale);
// ademÃ¡s, algunas filas vienen dibujadas mÃ¡s chicas (p. ej. saque/smash): escala por fila segÃºn el ancho
// de la cabeza (mediana de la fila) comparado con el de la fila de referencia de su hoja
// Se compara el frame "de pie" de cada fila con la guardia de referencia (STAND_SRC). Las filas que empiezan
// corriendo se comparan con la carrera (frame 1 de 'run'); las recuperaciones, por su Ãºltimo frame (de pie).
const rowScale = {};
const hOf = (name, i) => frames[name][i].ground - frames[name][i].top;
const RUN_LIKE = new Set(['runstop', 'brake-turn', 'run-left', 'dash']);
const LAST_STAND = new Set(['recover-right', 'recover-left']);
for (const [name, list] of Object.entries(frames)) {
  let target;
  if (RUN_LIKE.has(name)) target = hOf('run', 0) * sheetScale[frames.run[0].sheet] / hOf(name, 0);
  else if (LAST_STAND.has(name)) target = STAND_SRC / hOf(name, list.length - 1);
  else if (name === 'run') target = sheetScale[list[0].sheet];
  else target = STAND_SRC / hOf(name, 0);
  rowScale[name] = target;
  for (const f of list) f.sc = target;
}
/**
 * Misma escala que otra fila: las que NO empiezan de pie (el aturdido de MAI ya empieza agachada) copian la de una
 * fila vecina de su hoja, y los clips derivados la de la fila de donde salen (sin saltos de tamaño al encadenarlos).
 */
const SCALE_AS = {
  ...SCALE_AS_CFG,
  ...Object.fromEntries(Object.entries(DERIVED).map(([name, d]) => [name, d.from])),
};
for (const [name, as] of Object.entries(SCALE_AS)) {
  rowScale[name] = rowScale[as];
  for (const f of frames[name]) f.sc = rowScale[as];
}
console.log('escala por fila:', Object.fromEntries(Object.entries(rowScale).map(([n, v]) => [n, +v.toFixed(3)])));

// celda de salida: cabe todo (con el ancla en el suelo y en el centro de la celda original)
let L = 0, R = 0, T = 0, B = 0;
for (const list of Object.values(frames))
  for (const f of list) {
    const sc = f.sc;
    const l = (f.cell0 - f.x0) * sc, r = (f.x1 + 1 - f.cell0) * sc; // espejado: izquierda y derecha se cambian
    L = Math.max(L, f.flip ? r : l);
    R = Math.max(R, f.flip ? l : r);
    T = Math.max(T, (f.ground - f.y0) * sc);
    B = Math.max(B, (f.y1 + 1 - f.ground) * sc);
  }
const PAD = 2;
const HALF = Math.ceil(Math.max(L, R)) + PAD; // simÃ©trica: el ancla queda en el centro
const OW = HALF * 2;
const AY = Math.ceil(T) + PAD;
const OH = AY + Math.ceil(B) + PAD;
console.log(`celda de salida ${OW}x${OH}  ancla (${HALF}, ${AY})`);

const metrics = {};
for (const [name, list] of Object.entries(frames)) {
  const NF = list.length;
  const strip = Buffer.alloc(OW * NF * OH * 4, 0);
  list.forEach((f, i) => {
    const { w, px, lab } = sheets[f.sheet];
    const sc = f.sc;
    for (let dy = 0; dy < OH; dy++)
      for (let dx = 0; dx < OW; dx++) {
        // fila espejada (FLIP_ROWS): se lee la celda reflejada respecto a su centro
        const u0 = (dx - HALF) / sc, u1 = (dx + 1 - HALF) / sc;
        const sx0 = f.flip ? f.cell0 - u1 : f.cell0 + u0, sx1 = f.flip ? f.cell0 - u0 : f.cell0 + u1;
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
        const di = (dy * OW * NF + i * OW + dx) * 4;
        strip[di] = Math.round(r / a); strip[di + 1] = Math.round(g / a); strip[di + 2] = Math.round(b / a);
        strip[di + 3] = Math.min(255, Math.round((a / n) * 255));
      }
  });
  saveWebp(join(OUT, `${name}.webp`), OW * NF, OH, strip); // PNG temporal -> WebP (image-out.mjs); falla si la conversión no sale
  metrics[name] = list.map((f) => Math.round((f.ground - f.y0) * f.sc));
  console.log(`${name.padEnd(15)} hoja ${list[0].sheet}  suelo ${list[0].ground}  alto ${metrics[name].join(',')}`);
}

// ------------------------------------------------------------------ JSON
const STAND_H = Math.round(STAND_SRC);
const origin = { x: 0.5, y: +(AY / OH).toFixed(5) };
const cell = { w: OW, h: OH };
const src = (s, r) => `${SRC_NAME(s)} (fila ${r})`;
/** frames reales de cada animaciÃ³n ((las hojas de Mai pueden traer 9 columnas)) */
const nf = (file) => frames[file]?.length ?? N;
const anim = (file, fps, loop, impact) => ({ file: `${file}${EXT}`, frames: nf(file), fps, loop, ...(impact !== undefined ? { impact } : {}), scale: 1 });
const hit = (file, fps, impact) => ({ file: `${file}${EXT}`, frames: nf(file), fps, loop: false, impact });
const write = (name, obj) => writeFileSync(join(ROOT, 'src', 'characters', `${name}.json`), JSON.stringify(obj, null, 2) + '\n');

// fotogramas clave (0-based) â€” ver docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md Â§5
// Hoja 2 (8 frames): 1 guardia, 2 preparaciÃ³n, 3 carga, 4 inicio, 5 aceleraciÃ³n, 6 IMPACTO (derecha/revÃ©s),
// 7 seguimiento, 8 recuperaciÃ³n. Saques y remates: 3 trofeo/carga, 5 IMPACTO arriba, 6-7 seguimiento.
// Desde la hoja 2 del rival del 12-11-2026, espaldas y rival usan los mismos frames clave.
const K = {
  hold: 1, // pose de espera y arranque del golpe NORMAL del reves = frame 2
  powerHoldFh: 3, // derecha CARGADA (fila 3): pose de carga = frame 4
  powerHold: 3, // reves CARGADO (fila 4): pose de carga = frame 4
  serveWait: 2, // saque: postura de trofeo (raqueta atrÃ¡s) esperando la pelota
  smashStart: 2,
  fhHold: 1, // derecha: pose de espera y arranque del golpe automatico = frame 2. Se vera todo el swing; la carga tiene su propia fila (fila 3)
  fhImpact: 6, // derecha: contacto en el frame 7 (fila 1)
  hitImpact: 5, // derecha / revÃ©s (normal y potente): el contacto se ve en el frame 6
  serveImpact: 4, // saque, saque con efecto, remate y smash potenciado: contacto en el frame 5
  smashImpact: 4,
  /**
   * Centro del cordaje en el frame de impacto del saque (frame 5 de serve.png / serve-spin.png), MEDIDO sobre las
   * tiras: `z` = altura sobre los pies y `dx` = desplazamiento lateral (+ = derecha de la pantalla), en unidades del
   * personaje (alto 150). El juego pone ahí la pelota y calcula el salto del saque (MatchScene.serveJump). Si cambian
   * las hojas del saque hay que volver a medirlo (ver docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md).
   */
  serveRacket: CFG.serveRacket,
};
/**
 * Smash potenciado (hoja 2, fila 8): viene dibujado mÃ¡s chico (~80 px). La escala POR FILA de arriba ya lo
 * amplÃ­a (â‰ˆ Ã—1,37: su frame de pie queda igual que el resto), asÃ­ que aquÃ­ no se multiplica otra vez.
 * Si hiciera falta un retoque extra en el juego, este valor se aplica en NxoActor.fitTo.
 */
const SMASH_POWER_SCALE = 1;

write(PFX + 'sprites', {
  source: `${SRC_NAME(1)} / ${SRC_NAME(2)} (tools/build-moves.mjs)`,
  view: VIEW,
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
write(PFX + 'hits', {
  source: src(2, '1-7'),
  view: VIEW,
  cell,
  origin,
  standHeight: STAND_H,
  hold: K.hold,
  serveWait: K.serveWait,
  smashStart: K.smashStart,
  serveRacket: K.serveRacket,
  holdForehand: K.fhHold,
  holdPower: K.powerHold,
  holdPowerForehand: K.powerHoldFh,
  animations: {
    forehand: hit('forehand', 15, K.fhImpact),
    backhand: hit('backhand', 15, K.hitImpact),
    'forehand-power': hit('forehand-power', 15, K.hitImpact),
    'backhand-power': hit('backhand-power', 15, K.hitImpact),
    serve: hit('serve', 12, K.serveImpact),
    smash: hit('smash', 14, K.smashImpact),
  },
});
write(PFX + 'move', {
  source: src(1, 5),
  view: VIEW,
  cell,
  origin,
  standHeight: STAND_H,
  turnExit: 5,
  turnRate: 2.2,
  landFrom: 1,
  landExit: 3,
  landEnd: 4,
  landRate: 2.6,
  animations: { 'brake-turn': { file: `brake-turn${EXT}`, frames: nf('brake-turn'), fps: 14, loop: false } },
});
write(PFX + 'special', {
  source: src(2, 8),
  view: VIEW,
  cell,
  origin,
  standHeight: STAND_H,
  start: 2,
  animations: { 'smash-power': { file: `smash-power${EXT}`, frames: nf('smash-power'), fps: 14, loop: false, impact: K.smashImpact, scale: SMASH_POWER_SCALE } },
});
const ex = (file, fps, loop = false, extra = {}) => ({ file: `${file}${EXT}`, frames: nf(file), fps, loop, ...extra });
// solo las que tienen tira (MAI no trae bote ni lanzamiento del saque: el juego usa el reposo y el saque normal)
const onlyBuilt = (anims) => {
  const gone = Object.keys(anims).filter((k) => !frames[k]);
  if (gone.length) console.log('sin fila en estas hojas (no van en el JSON):', gone.join(', '));
  return Object.fromEntries(Object.entries(anims).filter(([k]) => frames[k]));
};
write(PFX + 'extra', {
  source: `${SRC_NAME(1)}..4 (tools/build-moves.mjs): animaciones nuevas`,
  view: VIEW,
  cell,
  origin,
  standHeight: STAND_H,
  animations: onlyBuilt({
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
  }),
});
console.log(`alto ${STAND_H}  origen ${JSON.stringify(origin)}  â†’ ${OUT}`);
