// pie de las gradas (fin de la arcilla) por fila, en px de 1254: node edge-a2.mjs <png>
import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]);
const W = im.w;
const clay = (x, y) => { const d = (y * W + x) * 4, r = im.px[d], g = im.px[d + 1], b = im.px[d + 2]; return b > 120 && r < 90 && b - r > 60; };
for (let y = 330; y <= 640; y += 20) {
  let L = 627, R = 627, miss = 0;
  for (let x = 627; x >= 0; x--) { if (clay(x, y)) { L = x; miss = 0; } else if (++miss > 6) break; }
  miss = 0;
  for (let x = 627; x < W; x++) { if (clay(x, y)) { R = x; miss = 0; } else if (++miss > 6) break; }
  console.log(y, L, R);
}

