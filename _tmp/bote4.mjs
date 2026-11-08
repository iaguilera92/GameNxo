import { decode, save } from '../tools/png-lite.mjs';
import os from 'os';
const P = 'public/personajes/Nxo/pj-nxo-sprites-4.png';
const D = decode(P); const px = Buffer.from(D.px);
const S = decode(os.homedir() + '/Downloads/Sprite de tenis en rebote animado.png');
const isBgS = (x, y) => { const i = (y * S.w + x) * 4; return S.px[i + 1] - Math.max(S.px[i], S.px[i + 2]) > 60; };
const isBgD = (i) => px[i + 1] - Math.max(px[i], px[i + 2]) > 60;
const cen = (c, r) => { let a = 1e9, b = -1; for (let y = r * 128; y < r * 128 + 128; y++) for (let x = c * 192; x < c * 192 + 192; x++) if (!isBgD((y * D.w + x) * 4)) { a = Math.min(a, x - c * 192); b = Math.max(b, x - c * 192); } return (a + b) / 2; };
let s0 = 0, n0 = 0; for (const r of [1, 3, 4, 5, 6]) for (let c = 0; c < 8; c++) { s0 += cen(c, r); n0++; } const ref = s0 / n0;
const CWs = S.w / 8;
const box = [];
for (let c = 0; c < 8; c++) { let x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1; for (let y = 0; y < S.h; y++) for (let x = Math.floor(c * CWs); x < Math.floor((c + 1) * CWs); x++) if (!isBgS(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } box.push({ x0, x1, y0, y1 }); }
const feet = Math.max(...box.map(b => b.y1)), h0 = box[0].y1 - box[0].y0 + 1;
const s = 111 / h0; const mc = box.reduce((a, b) => a + (b.x0 + b.x1) / 2 - 0, 0) / 8;
const mrel = box.reduce((a, b, c) => a + ((b.x0 + b.x1) / 2 - c * CWs), 0) / 8;
console.log('scale', s.toFixed(3), 'ref', ref.toFixed(1), 'h0', h0, 'feet', feet);
for (let c = 0; c < 8; c++) for (let y = 0; y < 128; y++) for (let x = 0; x < 192; x++) {
  const sx = Math.round(c * CWs + mrel + (x - ref) / s), sy = Math.round(feet + (y - 122) / s);
  const o = (y * D.w + c * 192 + x) * 4; let ok = false;
  if (sx >= Math.floor(c * CWs) && sx < Math.floor((c + 1) * CWs) && sy >= 0 && sy < S.h && !isBgS(sx, sy)) { const si = (sy * S.w + sx) * 4; px[o] = S.px[si]; px[o + 1] = S.px[si + 1]; px[o + 2] = S.px[si + 2]; px[o + 3] = 255; ok = true; }
  if (!ok) { px[o] = 0; px[o + 1] = 255; px[o + 2] = 0; px[o + 3] = 255; }
}
save(P, D.w, D.h, px);
