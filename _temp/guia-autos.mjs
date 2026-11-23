import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-3-1254-v2.png'); const W = im.w, H = im.h, o = Buffer.from(im.px);
const dot = (x, y, r = 4) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const d = (Y * W + X) * 4; o[d] = 255; o[d+1] = 0; o[d+2] = 0; } };
const [x0, y0, x1, y1] = [345, 270, 30, 379];
for (let t = 0; t <= 1; t += 0.001) dot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
const a = Math.atan2(y1 - y0, x1 - x0);
for (const s of [-1, 1]) for (let t = 0; t <= 40; t += 0.5) dot(x1 - Math.cos(a + s * 0.5) * t, y1 - Math.sin(a + s * 0.5) * t);
save('para-chatgpt/a3-guia-autos.png', W, H, o); console.log('ok');
