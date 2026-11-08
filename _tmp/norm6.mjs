import { decode, save } from '../tools/png-lite.mjs';
import os from 'os';
const S = decode(os.homedir() + '/Downloads/Hoja de sprites de ataque tenístico en 8×8.png');
const COLS = 9, ROWS = 8, CW = 192, CH = 128;
const isBg = (x, y) => { const i = (y * S.w + x) * 4; return S.px[i + 1] - Math.max(S.px[i], S.px[i + 2]) > 60; };
// bandas de reposo: frame 1 (columna 0)
const prof = new Array(S.h).fill(0);
for (let y = 0; y < S.h; y++) for (let x = 0; x < S.w / COLS; x++) if (!isBg(x, y)) prof[y]++;
const bands = []; let st = -1;
for (let y = 0; y <= S.h; y++) { const on = y < S.h && prof[y] > 0; if (on && st < 0) st = y; if (!on && st >= 0) { if (y - st > 30) bands.push([st, y - 1]); st = -1; } }
console.log('bandas', JSON.stringify(bands));
if (bands.length !== 8) throw new Error('bandas ' + bands.length);
const rb = [0]; for (let r = 0; r < 7; r++) rb.push(Math.round((bands[r][1] + bands[r + 1][0]) / 2)); rb.push(S.h);
const pw = S.w / COLS;
const cb = []; for (let c = 0; c <= COLS; c++) cb.push(Math.round(c * pw));
const out = Buffer.alloc(CW * COLS * CH * ROWS * 4);
for (let i = 0; i < out.length; i += 4) { out[i] = 0; out[i + 1] = 255; out[i + 2] = 0; out[i + 3] = 255; }
for (let r = 0; r < ROWS; r++) {
  const [t0, feet] = bands[r], idleH = feet - t0 + 1;
  // ancla x: centro del frame 1 (cuerpo) y mismo paso para todos
  let x0 = 1e9, x1 = -1; for (let y = t0; y <= feet; y++) for (let x = 0; x < pw; x++) if (!isBg(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const a0 = (x0 + x1) / 2;
  let s = 111 / idleH;
  s = Math.min(s, 1.3);
  console.log('fila', r + 1, 'idleH', idleH, 'scale', s.toFixed(3), 'rb', rb[r], rb[r + 1]);
  for (let c = 0; c < COLS; c++) {
    const ax = a0 + c * pw;
    for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
      const sx = Math.round(ax + (x - 96) / s), sy = Math.round(feet + (y - 122) / s);
      if (sx < 0 || sx >= S.w || sy < rb[r] || sy >= rb[r + 1]) continue;
      if (isBg(sx, sy)) continue;
      const si = (sy * S.w + sx) * 4, di = ((r * CH + y) * CW * COLS + c * CW + x) * 4;
      out[di] = S.px[si]; out[di + 1] = S.px[si + 1]; out[di + 2] = S.px[si + 2]; out[di + 3] = 255;
    }
  }
}
save('_tmp/nxo-sprites-2-nueva5.png', CW * COLS, CH * ROWS, out);
