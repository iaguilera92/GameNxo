import { decode } from '../frontend/tools/png-lite.mjs';
for (const f of ['elije-tu-pj', 'perfil-pj']) { const im = decode(`../frontend/public/${f}.png`); const a = (x, y) => im.px[(y * im.w + x) * 4 + 3]; console.log(f, im.w, im.h, 'alpha corner', a(2, 2), a(im.w - 3, im.h - 3), 'centro', a(im.w >> 1, im.h >> 1)); }
