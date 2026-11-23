import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-3-1254-v3.png'); const W = im.w;
const P = (x, y) => { const d = (y * W + x) * 4; return [im.px[d], im.px[d+1], im.px[d+2]]; };
const asf = ([r, g, b]) => b > g && r > g && r < 150 && b < 170 && b - g > 15;
const white = ([r, g, b]) => r > 200 && g > 200 && b > 200;
for (let x = 10; x <= 340; x += 30) {
  let s = ''; let first = -1, last = -1; const wy = [];
  for (let y = 200; y < 420; y++) { const c = P(x, y); if (asf(c)) { if (first < 0) first = y; last = y; } if (white(c)) wy.push(y); }
  // primera corrida continua de asfalto
  let y = first; while (y < 420 && (asf(P(x, y)) || white(P(x, y)) || asf(P(x, y + 1)) || asf(P(x, y + 2)))) y++;
  console.log(x, 'asfalto', first, '..', y, 'blancos', wy.length ? wy[0] + '-' + wy.at(-1) : '-');
}
