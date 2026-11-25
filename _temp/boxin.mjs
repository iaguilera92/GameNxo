import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ui/como-te-llamas-caja.png');
for (let y = 0; y < im.h; y += 8) { const d = (y * im.w + 500) * 4; const e = (y * im.w + 99) * 4; console.log(y, [...im.px.slice(d, d + 4)].join(','), '| x99', [...im.px.slice(e, e + 4)].join(',')); }
