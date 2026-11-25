// SPRITES EN ALTA (14-11-2026): una imagen POR ANIMACIÓN (2 filas × 4 frames, 8 frames en orden de lectura) en vez de las 4
// hojas de 8 × 8. Cada personaje sale ~2,5 veces más grande en la fuente y se ve nítido en el teléfono.
//   node tools/build-hd.mjs <pack> [--stand=190]       p. ej. nxo
// Entrada: public/personajes/<dir>/jugador/<clip>.png (vista de espaldas; otras vistas: <dir>/hd/)  (fondo verde croma liso; un frame por casilla de la rejilla 4 × 2)
//          Los clips que aún NO tengan imagen HD se reaprovechan de las tiras actuales (agrandadas), así se puede ir de a poco.
// Salida:  public/assets/characters/<pack>-v2/<clip>.webp (las mismas tiras que usa el juego) y, en src/characters/<pack>-*.json,
//          solo cell / origin / standHeight (el resto de cada JSON no se toca: fps, impactos, esperas...).
// El juego escala por standHeight (CHAR_UNITS_H / standHeight): con más píxeles se ve igual de grande pero más nítido.
// MEMORIA: cada tira ocupa ancho × alto × 4 bytes en la GPU; --stand=190 (por defecto) ≈ 2,7 veces la de hoy (115). No pasar de ~200.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { decode } from './png-lite.mjs';
import { fail, saveWebp, webpToPng } from './image-out.mjs';
import { CHARACTERS, ROWS_NXO } from './characters.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const ID = process.argv[2];
const CHAR = CHARACTERS[ID];
if (!CHAR) fail(`uso: node tools/build-hd.mjs <${Object.keys(CHARACTERS).join('|')}> [--stand=190]`);
const arg = (k, d) => {
  const a = process.argv.find((s) => s.startsWith(`--${k}=`));
  return a ? Number(a.split('=')[1]) : d;
};
// (14-11-2026) el RIVAL (vista de frente) se ve más chico al fondo de la cancha: 150 basta y ahorra memoria
const STAND = arg('stand', CHAR.view === 'front' ? 150 : 190);
/**
 * (14-11-2026) `--ulti`: las 6 animaciones de la ULTI (hoja pj-<id>-ulti, 9 frames cada una) en alta: una imagen VERTICAL de
 * 1024 × 1536 por animación con rejilla de 3 × 3, `<pack>-ulti-<n>.png` (1 inferno-swing, 2 ulti-hit, 3 ulti-stun, 4 idle-nr,
 * 5 run-nr, 6 pickup). Salida en assets/characters/<infDir>/ y `<pack>-inferno.json` (celda propia por tira, como el resto).
 */
const ULTI = process.argv.includes('--ulti');
const ULTI_CLIPS = ['inferno-swing', 'ulti-hit', 'ulti-stun', 'idle-nr', 'run-nr', 'pickup'];
/**
 * Rejilla de la imagen HD (14-11-2026): se deduce de su FORMATO: horizontal = 2 filas × 4 (8 frames, el de siempre);
 * vertical = 3 × 3 (9 frames, como la hoja vieja de la ULTI). La ULTI vale en los dos: sus frames clave caen antes del 8.
 * framesHd la fija para cada imagen; el resto usa frames.length.
 */
let COLS = 4;
let ROWS = 2;
let NF = 8;
const PAD = 3;
// (14-11-2026) las imágenes nuevas del personaje de ESPALDAS van en personajes/<Personaje>/jugador/ (las hojas viejas no se tocan)
const SRC = join(ROOT, 'public', 'personajes', ...CHAR.dir.split('/'), CHAR.view === 'back' ? 'jugador' : 'hd');
/** prefijo de los archivos HD: el pack del rival (`<id>-front`) se nombra `<id>-rival-…` (p. ej. nxo-rival-movimientos-1.png) */
const FID = ID.replace(/-front$/, '-rival');
const OUT = join(ROOT, 'public', 'assets', 'characters', ULTI ? `${ID}-inferno` : `${ID}-v2`);
const JSON_DIR = join(ROOT, 'src', 'characters');
const TMP = join(tmpdir(), `build-hd-${ID}-${process.pid}`);
mkdirSync(TMP, { recursive: true });

/** todos los clips del pack (los de las 4 hojas) */
/**
 * (14-11-2026) Clips NUEVOS que no están en las hojas viejas (sin fila en ROWS_NXO): se crean en su JSON la primera vez que llega
 * su imagen HD. `walk-intro` = caminata lenta de la ENTRADA al partido (NxoActor.runKey, walkFor).
 */
// (18-11-2026, usuario) `victory-big` = VICTORIA de verdad al ganar el PARTIDO (se tira al suelo de rodillas, "¡VAMOS!"): `<pack>-extras-4`
// (18-11-2026, usuario) `point-sad` = reacción TRISTE al perder un punto (se alterna con point-lost, el enojado): `<pack>-extras-5`
const NEW_CLIPS = {
  'walk-intro': { json: 'extra', fps: 8, loop: true },
  'victory-big': { json: 'extra', fps: 10, loop: false },
  'point-sad': { json: 'extra', fps: 8, loop: false },
  // (18-11-2026, usuario) 3.ª reacción al perder punto: incrédulo (manos a la cadera, mira al cielo): `<pack>-reacciones-4`
  'point-doubt': { json: 'extra', fps: 8, loop: false },
  // (18-11-2026, usuario) 2.ª celebración de punto: se tira de rodillas, se desliza y grita "¡VAMOS!": `<pack>-reacciones-5`
  'point-cheer': { json: 'extra', fps: 10, loop: false },
};
const CLIPS = ULTI ? ULTI_CLIPS : [...Object.values(ROWS_NXO).flatMap((r) => Object.values(r)), ...Object.keys(NEW_CLIPS)];
/** clips que NO empiezan de pie: se miden con la carrera (frame 1) o con su último frame (recuperaciones) */
const RUN_LIKE = new Set(['runstop', 'brake-turn', 'run-left', 'dash']);
const LAST_STAND = new Set(['recover-right', 'recover-left']);
/** clips cuyo frame 1 tampoco es "de pie" normal: copian la escala de otro clip */
const SCALE_AS = { 'point-cheer': 'idle', 'point-doubt': 'idle', 'point-sad': 'idle', 'victory-big': 'idle', 'inferno-hit': 'idle', stunned: 'idle', defeat: 'idle', 'dive-right': 'idle', 'dive-left': 'idle' };

// ------------------------------------------------------------------ croma (igual que build-moves.mjs)
function chroma(px, i) {
  const r = px[i], g = px[i + 1], b = px[i + 2];
  if (CHAR.chroma === 'magenta') {
    const d = Math.min(r, b) - g;
    if (d > 70) return [0, 0, 0, 0];
    if (d <= 12) return [r, g, b, px[i + 3]];
    const a = Math.round(px[i + 3] * (70 - d) / 58);
    const spill = d - 12;
    return [r - spill, g, b - spill, a];
  }
  const m = Math.max(r, b);
  const d = g - m;
  if (d > 60) return [0, 0, 0, 0];
  if (d > 12) {
    const a = Math.round(255 * (1 - (d - 12) / 48));
    return [r, Math.min(g, m), b, a];
  }
  return [r, d > 0 ? m : g, b, px[i + 3]];
}

/**
 * ChatGPT suele dibujar LÍNEAS oscuras entre las casillas (no son verdes: el croma no las borra y unirían todos los frames en
 * una sola pieza). En cada borde de casilla, si la franja de ±4 px es casi toda opaca a lo largo, se borran sus píxeles oscuros.
 */
function clearGridLines(px, w, h, cw, ch) {
  const dark = (i) => px[i + 3] > 24 && px[i] + px[i + 1] + px[i + 2] < 240;
  const lines = [];
  for (let c = 1; c < COLS; c++) lines.push({ v: true, at: Math.round(c * cw) });
  for (let r = 1; r < ROWS; r++) lines.push({ v: false, at: Math.round(r * ch) });
  // bordes exteriores de la imagen también (a veces la rejilla trae marco)
  lines.push({ v: true, at: 0 }, { v: true, at: w - 1 }, { v: false, at: 0 }, { v: false, at: h - 1 });
  for (const L of lines) {
    for (let d = -4; d <= 4; d++) {
      const k = L.at + d;
      if (k < 0 || k >= (L.v ? w : h)) continue;
      const n = L.v ? h : w;
      let hits = 0;
      for (let t = 0; t < n; t++) if (dark(((L.v ? t * w + k : k * w + t)) * 4)) hits++;
      if (hits < n * 0.6) continue; // no es una línea de rejilla (p. ej. el personaje cruza el borde)
      for (let t = 0; t < n; t++) {
        const i = (L.v ? t * w + k : k * w + t) * 4;
        if (dark(i)) px[i + 3] = 0;
      }
    }
  }
}

/** Imagen HD de un clip -> 8 frames { px, w, h, ax, ay, top, bottom } (ancla = centro de su casilla, suelo común del clip). */
function framesHd(path) {
  const img = decode(path);
  const { w, h } = img;
  [COLS, ROWS, NF] = h > w ? [3, 3, 9] : [4, 2, 8];
  const px = Buffer.from(img.px);
  for (let i = 0; i < w * h * 4; i += 4) {
    const c = chroma(px, i);
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = c[3];
  }
  const cw = w / COLS;
  const ch = h / ROWS;
  clearGridLines(px, w, h, cw, ch);
  // piezas conexas (alfa > 24): cada una va a la casilla donde cae su centro (la raqueta puede cruzar el borde de la casilla)
  const lab = new Int32Array(w * h).fill(-1);
  const comps = [];
  const stack = [];
  for (let p = 0; p < w * h; p++) {
    if (lab[p] !== -1 || px[p * 4 + 3] <= 24) continue;
    const id = comps.length;
    let x0 = w, y0 = h, x1 = 0, y1 = 0, n = 0;
    lab[p] = id;
    stack.push(p);
    const pts = [];
    while (stack.length) {
      const q = stack.pop();
      pts.push(q);
      const x = q % w, y = (q / w) | 0;
      n++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const r = ny * w + nx;
          if (lab[r] === -1 && px[r * 4 + 3] > 24) {
            lab[r] = id;
            stack.push(r);
          }
        }
    }
    if (x1 - x0 > cw * 1.25 || y1 - y0 > ch * 1.25) {
      // (14-11-2026) pieza que une DOS frames (p. ej. el fuego de uno toca el del vecino): se corta por los bordes de casilla
      const parts = new Map();
      for (const q of pts) {
        const k = Math.min(ROWS - 1, Math.floor(((q / w) | 0) / ch)) * COLS + Math.min(COLS - 1, Math.floor((q % w) / cw));
        if (!parts.has(k)) parts.set(k, []);
        parts.get(k).push(q);
      }
      for (const sub of parts.values()) {
        let a0 = w, b0 = h, a1 = 0, b1 = 0;
        for (const q of sub) { const x = q % w, y = (q / w) | 0; if (x < a0) a0 = x; if (x > a1) a1 = x; if (y < b0) b0 = y; if (y > b1) b1 = y; }
        comps.push({ x0: a0, y0: b0, x1: a1, y1: b1, n: sub.length, pts: sub });
      }
      continue;
    }
    comps.push({ x0, y0, x1, y1, n, pts });
  }
  const cells = Array.from({ length: NF }, () => []);
  const cellOf = (c) => Math.min(ROWS - 1, Math.floor((c.y0 + c.y1) / 2 / ch)) * COLS + Math.min(COLS - 1, Math.floor((c.x0 + c.x1) / 2 / cw));
  // (14-11-2026) 1) el CUERPO de cada casilla = su pieza más grande; 2) cada pieza suelta (estela, polvo, destello) va con el
  // cuerpo MÁS CERCANO de su misma fila, no con la casilla donde cae su centro (ChatGPT a veces dibuja la estela cruzando a la
  // casilla vecina y quedaba pegada en el frame de al lado).
  const live = comps.filter((c) => c.n >= 12); // fuera el polvo de croma
  const body = new Array(NF).fill(null);
  for (const c of live) {
    const i = cellOf(c);
    if (!body[i] || c.n > body[i].n) body[i] = c;
  }
  // distancia REAL (píxel a píxel, con muestras) entre una pieza y un cuerpo; los rectángulos se pisan con raquetas estiradas
  const sample = (pts, k) => { const out = []; for (let i = 0; i < pts.length; i += k) out.push(pts[i]); return out; };
  const gap = (c, b) => {
    const box = Math.max(0, b.x0 - c.x1, c.x0 - b.x1) + Math.max(0, b.y0 - c.y1, c.y0 - b.y1);
    if (box > 60) return box + 1e6; // lejos: no hace falta medir fino
    const cs = sample(c.pts, Math.max(1, Math.floor(c.pts.length / 300)));
    const bs = sample(b.pts, Math.max(1, Math.floor(b.pts.length / 3000)));
    let m = Infinity;
    for (const p of cs) {
      const px = p % w, py = (p / w) | 0;
      for (const q of bs) {
        const dx = px - (q % w), dy = py - ((q / w) | 0);
        const d = dx * dx + dy * dy;
        if (d < m) m = d;
      }
    }
    return Math.sqrt(m);
  };
  for (const c of live) {
    const i0 = cellOf(c);
    if (body[i0] === c) { cells[i0].push(c); continue; }
    const row = Math.floor(i0 / COLS);
    let best = i0, bd = Infinity;
    for (let k = row * COLS; k < row * COLS + COLS; k++) {
      if (!body[k]) continue;
      const d = gap(c, body[k]);
      if (d < bd) { bd = d; best = k; }
    }
    cells[best].push(c);
  }
  const frames = cells.map((cs, i) => {
    if (!cs.length) fail(`${path}: la casilla ${i + 1} está vacía (¿la rejilla no es de 4 × 2?)`);
    const main = cs.reduce((a, b) => (b.n > a.n ? b : a));
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (const c of cs) {
      x0 = Math.min(x0, c.x0); y0 = Math.min(y0, c.y0); x1 = Math.max(x1, c.x1); y1 = Math.max(y1, c.y1);
    }
    const fw = x1 - x0 + 1, fh = y1 - y0 + 1;
    const out = Buffer.alloc(fw * fh * 4);
    for (const c of cs)
      for (const q of c.pts) {
        const x = q % w, y = (q / w) | 0;
        px.copy(out, ((y - y0) * fw + (x - x0)) * 4, q * 4, q * 4 + 4);
      }
    const col = i % COLS, row = (i / COLS) | 0;
    // ancla x = centro de la casilla; base de los pies = fondo de la pieza principal
    return { px: out, w: fw, h: fh, bh: fh, x0, y0, ax: (col + 0.5) * cw - x0, cellTop: row * ch, foot: main.y1, top: main.y0 };
  });
  // (14-11-2026) SUELO POR FILA de la imagen: el punto más bajo (pies / cuerpo tumbado) de los 4 frames de cada fila. ChatGPT no
  // dibuja las dos filas a la misma altura dentro de su casilla; con un suelo común (mediana) una fila quedaba hundida o flotando.
  // Los frames en el aire de una fila quedan por encima de ese suelo (saltos, estiradas).
  for (let r = 0; r < ROWS; r++) {
    const row = frames.filter((f) => f.cellTop === r * ch);
    const ground = Math.max(...row.map((f) => f.foot - f.cellTop));
    for (const f of row) f.ay = f.cellTop + ground - f.y0;
  }
  frames.imgW = w; // ancho de la imagen fuente: los clips que copian la escala de otro (SCALE_AS) se corrigen si es de otro tamaño
  return frames;
}

/** Tira actual (WebP del juego) -> 8 frames RECORTADOS a lo dibujado, con el ancla de su celda (propia o del grupo). */
function framesOld(clip, cell, origin, nf) {
  const NF = nf; // frames de la tira actual (8, o 9 en la ULTI)
  const png = join(TMP, `${clip}.png`);
  webpToPng(join(OUT, `${clip}.webp`), png);
  const img = decode(png);
  // la textura puede ser una FILA (tiras de siempre) o una REJILLA (la ULTI vieja: 3 × 3): se deduce de la celda
  const cols = Math.max(1, Math.round(img.w / cell.w));
  const fw = Math.round(img.w / cols);
  const fh = Math.round(img.h / Math.max(1, Math.round(img.h / cell.h)));
  return Array.from({ length: NF }, (_, i) => {
    const ox = (i % cols) * fw, oy = Math.floor(i / cols) * fh;
    let x0 = fw, y0 = fh, x1 = -1, y1 = -1;
    for (let y = 0; y < fh; y++)
      for (let x = 0; x < fw; x++)
        if (img.px[((oy + y) * img.w + ox + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        }
    if (x1 < 0) { x0 = 0; y0 = 0; x1 = 0; y1 = 0; }
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const out = Buffer.alloc(w * h * 4);
    for (let y = 0; y < h; y++) img.px.copy(out, y * w * 4, ((oy + y0 + y) * img.w + ox + x0) * 4, ((oy + y0 + y) * img.w + ox + x0 + w) * 4);
    const ax = origin.x * cell.w - x0, ay = origin.y * cell.h - y0;
    return { px: out, w, h, bh: h, ax, ay, top: 0, foot: ay };
  });
}

/** alto "de pie" del clip en sus píxeles (para escalar todos al mismo STAND) */
function standOf(clip, frames) {
  const f = LAST_STAND.has(clip) ? frames[frames.length - 1] : frames[0];
  return f.foot - f.top;
}

// ------------------------------------------------------------------ JSON del pack
const JSONS = (ULTI ? ['inferno'] : ['sprites', 'hits', 'move', 'special', 'extra']).map((k) => join(JSON_DIR, `${ID}-${k}.json`)).filter(existsSync);
const cfgs = JSONS.map((p) => ({ p, j: JSON.parse(readFileSync(p, 'utf8')) }));
const cfgOf = (clip) => cfgs.find((c) => c.j.animations?.[clip]);
const missing = CLIPS.filter((c) => !cfgOf(c));
if (missing.length) console.log(`(sin JSON, se ignoran: ${missing.join(', ')})`);

/**
 * Nombre de la imagen de un clip (usuario, 14-11-2026): `<pack>-<hoja>-<n>.png`, con el nombre de la hoja (hoja 1 =
 * `movimientos`) y `n` = su número entre las animaciones QUE SE HACEN de esa hoja, en orden y SIN HUECOS (las filas sin uso
 * no se dibujan ni cuentan). Hoja 1: 1 idle, 2 run, 3 runstop, 4 victory, 5 brake-turn, 6 dash, 7 defeat.
 * + al final de movimientos (usuario, 14-11-2026): 8 walk, 9 dive-right, 10 dive-left, 11 recover-right, 12 recover-left
 *   (son de las hojas 4 y 3, pero son movimiento; en su hoja original NO se cuentan).
 * Hoja 2 (`golpes`): 1 forehand, 2 backhand, 3 forehand-power, 4 backhand-power, 5 serve, 6 serve-spin, 7 smash, 8 smash-power.
 * Hoja 3 (`reacciones`): 1 stunned, 2 point-won, 3 point-lost (`wait` no se hace; las estiradas van en movimientos).
 * + `golpes-9` = serve-toss (usuario: es parte del saque). Hoja 4 (`extras`): 1 walk-intro (caminata de entrada, clip nuevo),
 *   2 inferno-hit, 3 volley (`serve-bounce` descartado;
 *   `walk` va en movimientos-8; `dropshot`, `intro` y `greet` no se hacen).
 * Vale también `<clip>.png`.
 */
const SHEET_NAME = { 1: 'movimientos', 2: 'golpes', 3: 'reacciones', 4: 'extras' };
/** filas que NO se hacen (el juego no las reproduce): docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md ★ */
const SKIP = new Set(['run-left', 'wait', 'dropshot', 'intro', 'greet', 'serve-bounce']); // serve-bounce: descartado (14-11-2026)
/** clips de OTRA hoja que el usuario pidió numerar al final de una hoja (walk = hoja 4 fila 3, se ve al moverse): `nxo-movimientos-8` */
const APPEND = { 1: ['walk', 'dive-right', 'dive-left', 'recover-right', 'recover-left'], 2: ['serve-toss'], 3: ['point-doubt', 'point-cheer'], 4: ['victory-big', 'point-sad'] }; // estiradas = movimiento (usuario, 14-11-2026)
/** clips que van AL PRINCIPIO de una hoja: `nxo-extras-1` = caminata de entrada (reemplaza al bote, descartado) */
const PREPEND = { 4: ['walk-intro'] };
const MOVED = new Set(Object.values(APPEND).flat());
/**
 * (18-11-2026) Imagen HD de origen `<base>.png` o, si no hay, `<base>.webp` (se pasa a PNG en TMP para leerla): así una hoja rehecha
 * se puede dejar directamente en WebP (más liviana) y borrar el PNG.
 */
function srcImg(base) {
  const png = join(SRC, `${base}.png`);
  if (existsSync(png)) return png;
  const webp = join(SRC, `${base}.webp`);
  if (!existsSync(webp)) return null;
  const out = join(TMP, `src-${base}.png`);
  webpToPng(webp, out);
  return out;
}
function hdFile(clip) {
  if (ULTI) {
    const n = ULTI_CLIPS.indexOf(clip) + 1;
    return n > 0 ? srcImg(`${FID}-ulti-${n}`) : null;
  }
  for (const [sheet, rows] of Object.entries(ROWS_NXO)) {
    const made = [...(PREPEND[sheet] ?? []), ...Object.keys(rows).sort((a, b) => a - b).map((r) => rows[r]).filter((c) => !SKIP.has(c) && !MOVED.has(c)), ...(APPEND[sheet] ?? [])];
    const n = made.indexOf(clip) + 1;
    if (n > 0 && SHEET_NAME[sheet]) {
      const f = srcImg(`${FID}-${SHEET_NAME[sheet]}-${n}`);
      if (f) return f;
    }
  }
  return srcImg(clip);
}

const data = {};
const hdUsed = [];
for (const clip of CLIPS) {
  let c = cfgOf(clip);
  if (!c && NEW_CLIPS[clip] && hdFile(clip)) {
    // clip nuevo: se da de alta en su JSON (celda y ancla las pone el resto de la herramienta)
    const nc = NEW_CLIPS[clip];
    c = cfgs.find((x) => x.p.endsWith(`${ID}-${nc.json}.json`));
    if (c) c.j.animations[clip] = { file: `${clip}.webp`, frames: NF, fps: nc.fps, loop: nc.loop };
  }
  if (!c) continue;
  const hd = hdFile(clip);
  if (hd) {
    // la tira actual sirve de REFERENCIA de tamaño (cuánto mide esta animación respecto del personaje de pie)
    const ai = c.j.animations[clip];
    const old = existsSync(join(OUT, `${clip}.webp`)) ? framesOld(clip, ai.cell ?? c.j.cell, ai.origin ?? c.j.origin, ai.frames ?? 8) : null;
    data[clip] = { frames: framesHd(hd), hd: true, old, oldStand: c.j.standHeight };
    hdUsed.push(clip);
  } else if (existsSync(join(OUT, `${clip}.webp`))) {
    const ai = c.j.animations[clip];
    data[clip] = { frames: framesOld(clip, ai.cell ?? c.j.cell, ai.origin ?? c.j.origin, ai.frames ?? 8), hd: false, oldStand: c.j.standHeight };
  }
}
if (!hdUsed.length) fail(`no hay imágenes HD en ${SRC} (<clip>.png). Nada que hacer.`);
// escala de cada clip
for (const [clip, d] of Object.entries(data)) {
  if (!d.hd) d.k = STAND / d.oldStand;
}
// (14-11-2026) Clips en HD: se escalan para que midan lo MISMO que en su tira actual (alto mediano de sus frames, con todo:
// raqueta, polvo…), pasado a STAND. Así una carrera agachada o una estirada no se agrandan como si estuvieran de pie.
// Sin tira de referencia: por su frame "de pie" (standOf) como antes.
const medH = (frames) => {
  const hs = frames.map((f) => f.bh).sort((a, b) => a - b);
  return hs[Math.floor(hs.length / 2)];
};
for (const [clip, d] of Object.entries(data)) {
  if (!d.hd) continue;
  if (d.old) d.k = (medH(d.old) * (STAND / d.oldStand)) / medH(d.frames);
  else {
    const ref = SCALE_AS[clip] && data[SCALE_AS[clip]]?.hd ? SCALE_AS[clip] : null;
    d.k = ref ? null : STAND / standOf(clip, d.frames);
    d.ref = ref;
  }
}
// (17-11-2026) misma escala que su referencia EN EL DIBUJO: si la imagen fuente es de otro tamaño (p. ej. 2512 o 1024 px de ancho en vez de
// 1536), el personaje viene dibujado más grande o más chico en píxeles y se corrige con la proporción de anchos (antes la estirada de MAI
// rival salía 1,5 veces más grande hacia un lado y casi la mitad hacia el otro)
for (const d of Object.values(data)) if (d.k === null) d.k = data[d.ref].k * ((data[d.ref].frames.imgW ?? 1) / (d.frames.imgW ?? 1));
for (const clip of RUN_LIKE) if (data[clip]?.hd && !data[clip].old && data.run?.hd) data[clip].k = data.run.k * ((data.run.frames.imgW ?? 1) / (data[clip].frames.imgW ?? 1)); // sin referencia: al tamaño de `run` (corregido por el tamaño de la imagen)
// (21-11-2026, usuario: "la estirada de MAI se ve más pequeña") las ESTIRADAS nuevas traen la levantada y la guardia (cuadros de pie): copiar el alto
// mediano de la tira VIEJA (solo el personaje tirado) las achicaba enteras. Se escalan para que su cuadro 1 (la guardia, de pie) mida lo mismo
// en pantalla que el cuadro 1 de `idle` (sin depender del tamaño en píxeles con que la IA dibujó cada hoja)
for (const clip of ['dive-right', 'dive-left']) {
  const d = data[clip];
  if (d?.hd && data.idle) d.k = (data.idle.k * standOf('idle', data.idle.frames)) / standOf(clip, d.frames);
}

// (14-11-2026) CELDA PROPIA POR TIRA (simétrica: el ancla en el centro): cada animación ocupa solo lo que dibuja. Antes había
// una celda común (la de la más ancha) y cada tira pagaba ese tamaño en la memoria del teléfono.
function cellOf(d) {
  let L = 0, R = 0, T = 0, B = 0;
  for (const f of d.frames) {
    L = Math.max(L, f.ax * d.k); R = Math.max(R, (f.w - f.ax) * d.k);
    T = Math.max(T, f.ay * d.k); B = Math.max(B, (f.h - f.ay) * d.k);
  }
  const HALF = Math.ceil(Math.max(L, R)) + PAD;
  const AY = Math.ceil(T) + PAD;
  return { HALF, OW: HALF * 2, AY, OH: AY + Math.ceil(B) + PAD };
}
let bytes = 0;
for (const [clip, d] of Object.entries(data)) {
  d.c = cellOf(d); // también la ULTI: celda propia por tira (NxoActor la carga con loadStrip)
  const nf = d.frames.length;
  if (process.env.DBG) console.log(clip, "k", d.k?.toFixed(3), "w", d.frames.map((f) => f.w).join(","), "bh", d.frames.map((f) => f.bh).join(","), d.old ? "oldbh " + d.old.map((f) => f.bh).join(",") : "");
  // (14-11-2026) si la tira no cabe en 4096 px de ancho (efectos muy anchos), los frames se acomodan en VARIAS FILAS de la
  // textura (Phaser corta los spritesheets de izquierda a derecha y de arriba abajo; framesOld también lee rejillas)
  d.gc = Math.min(nf, Math.max(1, Math.floor(4096 / d.c.OW)));
  if (d.c.OW > 4096) fail(`${clip}: frame de ${d.c.OW} px de ancho (> 4096)`);
  bytes += d.c.OW * nf * d.c.OH * 4;
}
console.log(`stand ${STAND}  ·  memoria de las tiras ≈ ${(bytes / 1048576).toFixed(1)} MB  ·  HD: ${hdUsed.join(', ')}`);

/** remuestreo por área (buena calidad al reducir; bilineal al agrandar) */
function blit(dst, dw, f, k, ox, oy) {
  const sw = f.w, sh = f.h, src = f.px;
  const x0 = Math.floor(ox - f.ax * k), y0 = Math.floor(oy - f.ay * k);
  const W = Math.ceil(sw * k) + 1, H = Math.ceil(sh * k) + 1;
  const inv = 1 / k;
  const box = Math.max(1, inv);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const dx = x0 + x, dy = y0 + y;
      if (dx < 0 || dy < 0 || dx >= dw) continue;
      // centro del píxel destino en coordenadas fuente
      const sx = (dx + 0.5 - ox) * inv + f.ax, sy = (dy + 0.5 - oy) * inv + f.ay;
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      const s = box > 1 ? Math.ceil(box) : 1;
      for (let j = 0; j < s; j++)
        for (let i = 0; i < s; i++) {
          const px = s > 1 ? sx - box / 2 + (i + 0.5) * (box / s) : sx - 0.5;
          const py = s > 1 ? sy - box / 2 + (j + 0.5) * (box / s) : sy - 0.5;
          // bilineal (4 vecinos, sin crear arrays: es el bucle caliente)
          const ix = Math.floor(px), iy = Math.floor(py), fx = px - ix, fy = py - iy;
          for (let q = 0; q < 4; q++) {
            const qx = ix + (q & 1), qy = iy + (q >> 1);
            const wgt = ((q & 1) ? fx : 1 - fx) * ((q >> 1) ? fy : 1 - fy);
            n += wgt;
            if (qx < 0 || qy < 0 || qx >= sw || qy >= sh || wgt <= 0) continue;
            const p = (qy * sw + qx) * 4;
            const al = src[p + 3] / 255;
            if (al === 0) continue;
            r += src[p] * al * wgt; g += src[p + 1] * al * wgt; b += src[p + 2] * al * wgt; a += al * wgt;
          }
        }
      if (a <= 0.002) continue;
      const di = (dy * dw + dx) * 4;
      if (di < 0 || di >= dst.length) continue;
      dst[di] = Math.round(r / a); dst[di + 1] = Math.round(g / a); dst[di + 2] = Math.round(b / a); dst[di + 3] = Math.round((a / n) * 255);
    }
}

mkdirSync(OUT, { recursive: true });
for (const [clip, d] of Object.entries(data)) {
  const { HALF, OW, AY, OH } = d.c;
  const nf = d.frames.length;
  const gc = d.gc, gr = Math.ceil(nf / gc); // columnas y filas de la textura (1 fila casi siempre)
  const TW = OW * gc, TH = OH * gr;
  const strip = Buffer.alloc(TW * TH * 4, 0);
  d.frames.forEach((f, i) => blit(strip, TW, f, d.k, (i % gc) * OW + HALF, Math.floor(i / gc) * OH + AY));
  saveWebp(join(OUT, `${clip}.webp`), TW, TH, strip);
  d.cell = { w: OW, h: OH };
  d.origin = { x: 0.5, y: +(AY / OH).toFixed(5) };
}
// JSON: cada animación con su celda y ancla; el grupo conserva una (la del reposo) para lo que no traiga la suya
const ref = data.idle ?? Object.values(data)[0];
for (const { p, j } of cfgs) {
  for (const [clip, a] of Object.entries(j.animations)) {
    if (!data[clip]) continue;
    a.frames = data[clip].frames.length; // 8 (2 × 4) o 9 (3 × 3)
    a.cell = data[clip].cell;
    a.origin = data[clip].origin;
  }
  j.cell = ref.cell;
  j.origin = ref.origin;
  j.standHeight = STAND;
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
}
rmSync(TMP, { recursive: true, force: true });
const redraw = hdUsed.filter((c) => ['serve', 'serve-spin', 'serve-bounce'].includes(c));
if (redraw.length) console.log(`OJO: cambió ${redraw.join(', ')}: volver a medir serveRacket (hits.json) y/o BOUNCE en NxoActor.ts (docs/COMO-TRABAJAR-SPRITES-MOVIMIENTOS.md §5).`);
console.log(`listo: ${Object.keys(data).length} tiras en ${OUT}`);
