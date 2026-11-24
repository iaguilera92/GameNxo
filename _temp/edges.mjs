import { decode } from '../frontend/tools/png-lite.mjs';
for (const n of ['ambiente-1-1254-v7','ambiente-2-1254-v2','ambiente-3-1254-v3','ambiente-4-1254-extendido','ambiente-1-2v2-1254-v14']) {
  const im = decode(`respaldo_oficial/ambientes/${n}.png`); const avg = (y0, y1) => { let r = 0, g = 0, b = 0, c = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < im.w; x++) { const d = (y * im.w + x) * 4; r += im.px[d]; g += im.px[d+1]; b += im.px[d+2]; c++; } return '0x' + [r, g, b].map((v) => Math.round(v / c).toString(16).padStart(2, '0')).join(''); };
  console.log(n, im.w, im.h, 'top', avg(0, 12), 'bottom', avg(im.h - 12, im.h));
}

