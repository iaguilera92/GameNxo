import { decode, save } from '../tools/png-lite.mjs';
import os from 'os';
const S = decode(os.homedir() + '/Downloads/new-sprites-2.png');
const COLS = 9, ROWS = 8, CW = 192, CH = 128;
const isBg = (x, y) => { const i = (y * S.w + x) * 4; return S.px[i + 1] - Math.max(S.px[i], S.px[i + 2]) > 60; };
const rowIdle = [[16, 137], [166, 285], [314, 423], [450, 555], [584, 699], [728, 837], [862, 975], [1027, 1154]];
const rb = [0, 151, 300, 436, 560, 706, 842, 985, S.h];
const cb = [0, 153, 302, 452, 604, 757, 912, 1054, 1196, S.w];
const pitchX = 147.8;
const out = Buffer.alloc(CW * COLS * CH * ROWS * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 0; out[i + 1] = 255; out[i + 2] = 0; out[i + 3] = 255; }
for (let r = 0; r < ROWS; r++) {
  const idleH = rowIdle[r][1] - rowIdle[r][0] + 1, feet = rowIdle[r][1];
  const box = [];
  for (let c = 0; c < COLS; c++) {
    let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = rb[r]; y < rb[r + 1]; y++) for (let x = cb[c]; x < cb[c + 1]; x++) if (!isBg(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    box.push({ x0, x1, y0, y1, ax: 73.9 + c * pitchX });
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
save('_tmp/nxo-sprites-2-nueva.png', CW * COLS, CH * ROWS, out);

