import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-1-1254-v3.png');
const floor = (x, y) => { const i = (y * im.w + x) * 4, r = im.px[i], g = im.px[i + 1], b = im.px[i + 2]; return b > r + 35 && b > g + 30 && r < 90; };
const out = [];
for (const x of [0, 40, 80, 120, 160, 200, 240, 280, 320, 340, 914, 940, 980, 1020, 1060, 1100, 1140, 1180, 1220, 1253]) {
  let y = 900; while (y > 200 && floor(x, y)) y--; out.push(x + ':' + y);
}
console.log(out.join('  '));
// top of stands (first non-sky from top? print rows color at x=60)
