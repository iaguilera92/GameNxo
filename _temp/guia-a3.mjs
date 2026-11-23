import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('para-chatgpt/a3-con-cancha.png');
const W = im.w, H = im.h, o = Buffer.from(im.px);
const dot = (x, y, r) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const d = (Y * W + X) * 4; o[d] = 255; o[d + 1] = 0; o[d + 2] = 0; o[d + 3] = 255; } };
const line = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 0; i <= n; i++) dot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, 3); };
// pie de las gradas y del muro (px de 1254): lineas de la v14 del 2v2 llevadas a esta cancha (zoom 0.6: x1,1667 respecto del centro y de la linea de fondo)
line([229, 320], [0, 631]); line([1025, 320], [1254, 631]); line([229, 320], [1025, 320]);
save('para-chatgpt/a3-guia-rojo.png', W, H, o);
console.log('ok');
