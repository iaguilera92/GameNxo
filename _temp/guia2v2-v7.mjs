import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-1-2v2-1254-v7.png');
const o = Buffer.from(im.px), W = im.w, H = im.h;
const line = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 0; i <= n; i++) { const x = a[0] + (b[0] - a[0]) * i / n, y = a[1] + (b[1] - a[1]) * i / n; for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const d = (Y * W + X) * 4; o[d] = 255; o[d + 1] = 0; o[d + 2] = 0; o[d + 3] = 255; } } };
line([259, 352], [0, 969]); line([995, 352], [1254, 969]);
save('para-chatgpt/2v2-v7-guia-muros-rojo.png', W, H, o);
console.log('ok');


