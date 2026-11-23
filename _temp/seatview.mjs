// vista de pantalla (720x1280, zoom 0.7) de ambiente-2 con los asientos marcados
import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('../_temp/respaldo_oficial/ambientes/ambiente-2-1254.png');
const k = 1536 / 1254, s = (1280 / 1024) * Number(process.argv[4] ?? 0.7), wallB = 396;
const left = 360 - (1536 * s) / 2, top = 302 - wallB * s;
const W = 720, H = 700, o = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const ix = Math.floor((x - left) / s / k), iy = Math.floor((y - top) / s / k); const d = (y * W + x) * 4; if (ix < 0 || iy < 0 || ix >= im.w || iy >= im.h) continue; const i = (iy * im.w + ix) * 4; o[d] = im.px[i]; o[d+1] = im.px[i+1]; o[d+2] = im.px[i+2]; o[d+3] = 255; }
const seats = JSON.parse(process.argv[2]);
for (const [sx, sy, hh] of seats) { const cx = left + sx * s, cy = top + sy * s, hh2 = hh * s; for (let y = cy - hh2; y <= cy; y++) for (let x = cx - hh2 * 0.35; x <= cx + hh2 * 0.35; x++) { const edge = y < cy - hh2 + 2 || y > cy - 2 || x < cx - hh2 * 0.35 + 2 || x > cx + hh2 * 0.35 - 2; if (!edge) continue; const d = ((y | 0) * W + (x | 0)) * 4; if (d >= 0 && d < o.length) { o[d] = 0; o[d+1] = 255; o[d+2] = 0; o[d+3] = 255; } } }
save(process.argv[3], W, H, o);

