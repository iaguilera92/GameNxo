import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode('../frontend/public/como-te-llamas.png');
console.log(im.w, im.h, 'alpha esquina', im.px[3], 'centro', im.px[((im.h >> 1) * im.w + (im.w >> 1)) * 4 + 3]);
// filas con algo opaco (para ubicar las piezas): bandas
let prev = false, start = 0;
for (let y = 0; y < im.h; y++) {
  let n = 0, x0 = im.w, x1 = 0;
  for (let x = 0; x < im.w; x++) if (im.px[(y * im.w + x) * 4 + 3] > 40) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); }
  const on = n > 0;
  if (on && !prev) start = y;
  if (!on && prev) console.log('banda y', start, '-', y - 1);
  prev = on;
}
if (prev) console.log('banda y', start, '-', im.h - 1);
