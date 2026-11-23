import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]); const N = im.w;
const at = (x, y) => { const d = (y * N + x) * 4; return [im.px[d], im.px[d + 1], im.px[d + 2]]; };
const lum = (c) => c[0] + c[1] + c[2];
// columna central x=627: perfil vertical 180..280
let s = ''; for (let y = 180; y <= 280; y += 2) s += y + ':' + at(627, y).join(',') + ' '; console.log(s);
s = ''; for (let y = 180; y <= 280; y += 2) s += y + ':' + at(500, y).join(',') + ' '; console.log(s);
// bordes de gradas: por fila, ultimo x claro desde la izquierda contando desde el centro hacia afuera
for (let y = 260; y <= 800; y += 60) {
  let L = -1; for (let x = 600; x >= 0; x--) if (lum(at(x, y)) > 300) { L = x; break; }
  let R = -1; for (let x = 650; x < N; x++) if (lum(at(x, y)) > 300) { R = x; break; }
  console.log('y', y, 'L', L, 'R', R);
}
