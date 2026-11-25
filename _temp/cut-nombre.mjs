// Corta como-te-llamas.png en el título (banda de arriba) y la caja del nombre (banda de abajo), cada una a su caja visible.
import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('../frontend/public/como-te-llamas.png');
const box = (y0, y1) => {
  let x0 = im.w, x1 = 0, t = y1, b = y0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < im.w; x++) if (im.px[(y * im.w + x) * 4 + 3] > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); t = Math.min(t, y); b = Math.max(b, y); }
  return { x0, y0: t, x1, y1: b };
};
const cut = (r, out) => {
  const w = r.x1 - r.x0 + 1, h = r.y1 - r.y0 + 1, o = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) im.px.copy(o, y * w * 4, ((r.y0 + y) * im.w + r.x0) * 4, ((r.y0 + y) * im.w + r.x0 + w) * 4);
  save(out, w, h, o);
  console.log(out, r, w, h);
};
cut(box(0, 466), 'respaldo_oficial/ui/como-te-llamas-titulo.png');
const b = box(467, im.h - 1);
cut(b, 'respaldo_oficial/ui/como-te-llamas-caja.png');
// borde interior de la caja: primera columna oscura en la fila del medio, y la barra amarilla
const my = (b.y0 + b.y1) >> 1;
let yellow = -1;
for (let x = b.x0; x < b.x1; x++) { const d = (my * im.w + x) * 4; if (im.px[d] > 200 && im.px[d + 1] > 170 && im.px[d + 2] < 90) { yellow = x; break; } }
console.log('barra amarilla x', yellow, '(relativa', yellow - b.x0, ') fila', my - b.y0);
