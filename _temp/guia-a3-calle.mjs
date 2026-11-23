import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('para-chatgpt/a3-nueva.png'); const W = im.w, H = im.h, o = Buffer.from(im.px);
const dot = (x, y, r = 3) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const d = (Y * W + X) * 4; o[d] = 255; o[d+1] = 0; o[d+2] = 0; o[d+3] = 255; } };
const line = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 0; i <= n; i++) dot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n); };
// bordes de la calle nueva (px de 1254): baja desde el borde de ARRIBA hasta el borde IZQUIERDO
line([330, 0], [0, 300]); line([480, 0], [0, 470]);
save('para-chatgpt/a3-guia-calle.png', W, H, o); console.log('ok');
