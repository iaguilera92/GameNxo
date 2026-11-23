import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('para-chatgpt/a3-nueva.png'); const W = im.w, H = im.h, o = Buffer.from(im.px); const k = 1536 / 1254;
const dot = (x, y, c, r = 2) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const d = (Y * W + X) * 4; o[d] = c[0]; o[d+1] = c[1]; o[d+2] = c[2]; o[d+3] = 255; } };
const [x0, y0, x1, y1, h0, h1] = [416, 316, -245, 456, 46, 135].map((v) => v / k);
for (let t = 0; t <= 1; t += 0.002) dot(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, [255, 0, 0]);
for (const t of [0, 0.1, 0.2, 0.3, 0.4, 0.5]) { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t, h = (h0 + (h1 - h0) * t) * 1.2; for (let j = 0; j < h; j++) dot(x, y - j, [255, 255, 0], 1); }
for (let y = 0; y < H; y++) dot(284 / k, y, [0, 255, 255], 1);
save('para-chatgpt/a3-autos-preview.png', W, H, o); console.log('ok');
