// Mide el alto visible (alfa > 40) de cada frame en las tiras de NXO espaldas, en px de la tira.
// Todas las tiras del pack comparten standHeight, así que el alto en px es proporcional al tamaño en pantalla.
// uso (desde frontend/): node ../_temp/medir-tiras-nxo.mjs [clip ...]
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { decode } from '../frontend/tools/png-lite.mjs';
import { webpToPng } from '../frontend/tools/image-out.mjs';

const DIR = 'public/assets/characters/nxo-v2';
const TMP = '../_temp/_tiras-nxo';
mkdirSync(TMP, { recursive: true });
const jsons = ['nxo-sprites', 'nxo-move', 'nxo-hits', 'nxo-special', 'nxo-extra'].map((n) => JSON.parse(readFileSync(`src/characters/${n}.json`, 'utf8')));
const clips = process.argv.slice(2).length ? process.argv.slice(2) : ['idle', 'run', 'walk', 'runstop', 'brake-turn', 'forehand', 'backhand', 'serve', 'serve-spin', 'volley', 'smash'];
for (const clip of clips) {
  const j = jsons.find((x) => x.animations?.[clip]);
  if (!j) { console.log(clip, 'sin JSON'); continue; }
  const a = j.animations[clip];
  const cell = a.cell ?? j.cell;
  const png = join(TMP, `${clip}.png`);
  if (!existsSync(png)) webpToPng(join(DIR, a.file), png);
  const im = decode(png);
  const cols = Math.floor(im.w / cell.w);
  const hs = [];
  const feet = [];
  for (let f = 0; f < a.frames; f++) {
    const cx = (f % cols) * cell.w, cy = Math.floor(f / cols) * cell.h;
    let top = -1, bot = -1;
    for (let y = 0; y < cell.h && top < 0; y++) for (let x = 0; x < cell.w; x++) if (im.px[((cy + y) * im.w + cx + x) * 4 + 3] > 40) { top = y; break; }
    for (let y = cell.h - 1; y >= 0 && bot < 0; y--) for (let x = 0; x < cell.w; x++) if (im.px[((cy + y) * im.w + cx + x) * 4 + 3] > 40) { bot = y; break; }
    hs.push(bot - top + 1);
    feet.push(bot);
  }
  const s = [...hs].sort((p, q) => p - q);
  console.log(clip.padEnd(12), 'f1', String(hs[0]).padStart(3), ' mediana', String(s[Math.floor(s.length / 2)]).padStart(3), ' todos', hs.join(','), ' celda', `${cell.w}x${cell.h}`, ' origen', (a.origin ?? j.origin).y);
}
