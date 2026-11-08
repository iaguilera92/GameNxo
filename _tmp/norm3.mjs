import { decode, save } from '../tools/png-lite.mjs';
import os from 'os';
const S = decode(os.homedir() + '/Downloads/Hoja de sprites de tenista en acción.png');
const COLS = 9, ROWS = 8, CW = 192, CH = 128;
const isBg = (x, y) => { const i = (y * S.w + x) * 4; return S.px[i + 1] - Math.max(S.px[i], S.px[i + 2]) > 60; };
const rowIdle = [[8, 118], [130, 238], [250, 360], [372, 480], [490, 600], [618, 720], [733, 843], [880, 960]];
const rb = [0, 125, 245, 367, 487, 610, 727, 853, S.h];
const cb = [0, 184, 365, 546, 727, 908, 1089, 1270, 1451, S.w];
const pitchX = 181;
const out = Buffer.alloc(CW * COLS * CH * ROWS * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 0; out[i + 1] = 255; out[i + 2] = 0; out[i + 3] = 255; }
for (let r = 0; r < 7; r++) {
  const idleH = rowIdle[r][1] - rowIdle[r][0] + 1, feet = rowIdle[r][1];
  const box = [];
  for (let c = 0; c < COLS; c++) {
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = rb[r]; y < rb[r + 1]; y++) for (let x = cb[c]; x < cb[c + 1]; x++) if (!isBg(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    box.push({ x0, x1, y0, y1, ax: 93 + c * pitchX });
  }
  let s = 111 / idleH;
  for (const b of box) {
    s = Math.min(s, 124 / Math.max(feet - b.y0, 1), 94 / Math.max(Math.abs(b.x0 - b.ax), Math.abs(b.x1 - b.ax), 1));
  }
  console.log('fila', r + 1, 'idleH', idleH, 'scale', s.toFixed(3), 'topmax', Math.max(...box.map(b => feet - b.y0)));
  for (let c = 0; c < COLS; c++) {
    const ax = box[c].ax;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const sx = Math.round(ax + (x - 96) / s), sy = Math.round(feet + (y - 122) / s);
      if (sx < cb[c] || sx >= cb[c + 1] || sy < rb[r] || sy >= rb[r + 1]) continue;
      if (isBg(sx, sy)) continue;
      const si = (sy * S.w + sx) * 4, di = ((r * CH + y) * CW * COLS + c * CW + x) * 4;
      out[di] = S.px[si]; out[di + 1] = S.px[si + 1]; out[di + 2] = S.px[si + 2]; out[di + 3] = 255;
    }
  }
}
const O = decode('public/personajes/Nxo/pj-nxo-sprites-2.png'); const o8 = 7 * CH * CW * COLS * 4; for (let i = o8; i < out.length; i++) out[i] = O.px[i];
save('_tmp/nxo-sprites-2-nueva2.png', CW * COLS, CH * ROWS, out);


