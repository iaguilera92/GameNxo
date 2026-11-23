import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]); const N = im.w;
const at = (x, y) => { const d = (y * N + x) * 4; return [im.px[d], im.px[d + 1], im.px[d + 2]]; };
let s = ''; for (let y = 200; y <= 350; y += 3) s += y + ':' + at(627, y).join(',') + ' '; console.log(s);
const floor = (c, ref) => Math.abs(c[0] - ref[0]) + Math.abs(c[1] - ref[1]) + Math.abs(c[2] - ref[2]) < 45;
for (let y = 340; y <= 760; y += 30) {
  const ref = at(627, y); let L = -1, R = -1;
  for (let x = 627; x >= 0; x--) if (!floor(at(x, y), ref)) { L = x; break; }
  for (let x = 627; x < N; x++) if (!floor(at(x, y), ref)) { R = x; break; }
  console.log('y', y, 'L', L, 'R', R);
}
