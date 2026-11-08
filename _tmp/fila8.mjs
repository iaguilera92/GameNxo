import { decode, save } from '../tools/png-lite.mjs';
import os from 'os';
const SRC = process.argv[4] || '_tmp/smash8-fuente.png';
const ROW = +process.argv[2] || 8; // fila destino (1..8)
const MINIDLE = +process.argv[3] || 90; // alto mínimo del idle en px
const S = decode(SRC);
const isBg = (x, y) => { const i = (y * S.w + x) * 4; return S.px[i + 1] - Math.max(S.px[i], S.px[i + 2]) > 60; };
// columnas: segmentos por proyección
const colN = []; for (let x = 0; x < S.w; x++) { let n = 0; for (let y = 0; y < S.h; y++) if (!isBg(x, y)) n++; colN.push(n); }
let seg = [], s0 = null;
for (let x = 0; x < S.w; x++) { if (colN[x] > 2 && s0 === null) s0 = x; if (colN[x] <= 2 && s0 !== null) { seg.push([s0, x - 1]); s0 = null; } }
if (s0 !== null) seg.push([s0, S.w - 1]);
// unir segmentos con hueco < 6 px
const m = []; for (const g of seg) { if (m.length && g[0] - m[m.length - 1][1] < 3) m[m.length - 1][1] = g[1]; else m.push([...g]); }
console.log(S.w, S.h, 'segmentos', m.length, JSON.stringify(m));
if (m.length !== 9) { console.log('NO SON 9 COLUMNAS'); process.exit(1); }
const bb = m.map(([a, b]) => { let y0 = 1e9, y1 = -1; for (let y = 0; y < S.h; y++) for (let x = a; x <= b; x++) if (!isBg(x, y)) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { a, b, y0, y1 }; });
const idle = bb[0], idleH = idle.y1 - idle.y0 + 1, feet = idle.y1;
const hmax = Math.max(...bb.map(b => b.y1 - b.y0 + 1)); const topmax = hmax + 10 / 0.3;
let sc = 111 / idleH; const cap = 124 / topmax; console.log('idleH', idleH, 'topmax', topmax, 'escala normal', sc.toFixed(3), 'cap', cap.toFixed(3), 'idle resultante', (idleH * cap).toFixed(0));
sc = Math.max(cap, MINIDLE / idleH); sc = Math.min(sc, 111 / idleH);
console.log('escala usada', sc.toFixed(3), 'idle px', (idleH * sc).toFixed(0));
// ancla horizontal: centro del idle de cada frame de pie (col 1) = centro de su bbox; usamos el centro del cuerpo ≈ centro de segmento de idle para col 1 y 9.
// para el resto: usar centro del segmento (la raqueta mueve el bbox, pero ChatGPT mantiene el cuerpo cerca del centro de celda)
const pitch = (m[8][0] + m[8][1]) / 2 - (m[0][0] + m[0][1]) / 2; const step = pitch / 8; const c0 = (m[0][0] + m[0][1]) / 2;
const CW = 192, CH = 128;
const D = '/Nxo';
const T = decode('public/personajes/Nxo/pj-nxo-sprites-2.png');
const px = Buffer.from(T.px);
for (let c = 0; c < 9; c++) {
  const ax = c0 + c * step; const hop = Math.min((feet - bb[c].y1) * sc, 5); const scF = Math.min(sc, (121 - hop) / (bb[c].y1 - bb[c].y0 + 1)); console.log('col', c + 1, 'escala', scF.toFixed(3));
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const di = (((ROW - 1) * CH + y) * T.w + c * CW + x) * 4;
    px[di] = 0; px[di + 1] = 255; px[di + 2] = 0; px[di + 3] = 255;
    const sx = Math.round(ax + (x - 96) / scF), sy = Math.round(bb[c].y1 + (y - 122 + hop) / scF);
    if (sx < bb[c].a || sx > bb[c].b || sy < 0 || sy >= S.h) continue;
    if (isBg(sx, sy)) continue;
    const si = (sy * S.w + sx) * 4;
    px[di] = S.px[si]; px[di + 1] = S.px[si + 1]; px[di + 2] = S.px[si + 2];
  }
}
save('_tmp/nxo-sprites-2-prueba.png', T.w, T.h, px);






