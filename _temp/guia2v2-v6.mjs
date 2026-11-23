import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-1-2v2-1254-v6.png');
const o = Buffer.from(im.px), W = im.w, H = im.h;
const line = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n; for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const d = (Y * W + X) * 4; o[d] = 255; o[d + 1] = 0; o[d + 2] = 0; o[d + 3] = 255; } } };
line([336, 337], [0, 1195]); line([886, 337], [1254, 1219]);
save('para-chatgpt/2v2-v6-guia-muros-rojo.png', W, H, o);
console.log('ok');

