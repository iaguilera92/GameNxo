import { decode, save } from '../tools/png-lite.mjs';
const P = 'public/personajes/Nxo/pj-nxo-sprites-4.png';
const S = decode(P); const px = Buffer.from(S.px);
const isBg = (i) => px[i + 1] - Math.max(px[i], px[i + 2]) > 60;
const cen = (c, r) => { let a = 1e9, b = -1; for (let y = r * 128; y < r * 128 + 128; y++) for (let x = c * 192; x < c * 192 + 192; x++) if (!isBg((y * S.w + x) * 4)) { a = Math.min(a, x - c * 192); b = Math.max(b, x - c * 192); } return (a + b) / 2; };
const mean = (rows) => { let s = 0, n = 0; for (const r of rows) for (let c = 0; c < 8; c++) { s += cen(c, r); n++; } return s / n; };
const ref = mean([2, 4, 5, 6, 7]);
// fantasma frame 3 fila 4
for (let y = 384; y < 512; y++) for (let x = 2 * 192 + 140; x < 3 * 192; x++) { const i = (y * S.w + x) * 4; px[i] = 0; px[i + 1] = 255; px[i + 2] = 0; }
for (const r of [0, 1, 3]) {
  const d = Math.round(ref - mean([r])); console.log('fila', r + 1, 'shift', d);
  for (let c = 0; c < 8; c++) {
    const cell = Buffer.alloc(192 * 128 * 4);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 192; x++) {
      const sx = x - d, o = (y * 192 + x) * 4;
      if (sx >= 0 && sx < 192) px.copy(cell, o, ((r * 128 + y) * S.w + c * 192 + sx) * 4, ((r * 128 + y) * S.w + c * 192 + sx) * 4 + 4);
      else { cell[o] = 0; cell[o + 1] = 255; cell[o + 2] = 0; cell[o + 3] = 255; }
    }
    for (let y = 0; y < 128; y++) cell.copy(px, ((r * 128 + y) * S.w + c * 192) * 4, y * 192 * 4, (y + 1) * 192 * 4);
  }
}
save(P, S.w, S.h, px);
