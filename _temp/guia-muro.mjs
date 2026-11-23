// Guia para ChatGPT: muro mas arriba (RAISE px de la imagen 1254) y gradas mas separadas (GAP en unidades de cancha).
// node guia-muro.mjs <src1254.png> <wallBottomY1536> <raise1254> <gap> <out.png>
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [src, wallBArg, raiseArg, gapArg, out] = process.argv.slice(2);
const im = decode(src); const N = im.w; const k = 1536 / N; const S = 0.875;
const TOP = 302 - Number(wallBArg) * S; const LEFT = 360 - (1536 * S) / 2;
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 }, ALLEY = 72;
const V = { NEAR_Y: 1010, FAR_Y: 312, NEAR_W: 700, RATIO: 0.48, LAT_K: 1.15, Z_K: 0.75 };
const L0 = COURT.left, L1 = COURT.right, LAT_C = (COURT.top + COURT.bottom) / 2, LAT_W = COURT.bottom - COURT.top;
const CAM_X = (L0 - V.RATIO * L1) / (1 - V.RATIO), D1 = L0 - CAM_X, D2 = L1 - CAM_X;
const F = (V.NEAR_W * D1) / LAT_W, K = (V.NEAR_Y - V.FAR_Y) / (1 / D1 - 1 / D2), H0 = V.NEAR_Y - K / D1, SHIFT = 52;
const proj = (x, y, z = 0) => { const D = Math.max(80, x - CAM_X), s = F / D; return [360 + (y - LAT_C) * s * V.LAT_K, H0 + K / D - V.Z_K * z * s + SHIFT]; };
const P = (x, y) => { const [wx, wy] = proj(x, y); return [(wx - LEFT) / S / k, (wy - TOP) / S / k]; };
const wallImgY0 = (302 - TOP) / S / k, wallImgY = wallImgY0 - Number(raiseArg);
const wallScr = TOP + wallImgY * S * k;
let lo = L1, hi = 20000; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (proj(m, 0)[1] > wallScr) lo = m; else hi = m; }
const XW = (lo + hi) / 2, XN = L0 - 600;
const o = Buffer.from(im.px);
const px = (x, y, c) => { for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= N || Y >= N) continue; const d = (Y * N + X) * 4; o[d] = c[0]; o[d + 1] = c[1]; o[d + 2] = c[2]; o[d + 3] = 255; } };
const line = (a, b, c) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1; for (let t = 0; t <= n; t++) px(Math.round(a[0] + ((b[0] - a[0]) * t) / n), Math.round(a[1] + ((b[1] - a[1]) * t) / n), c); };
const RED = [255, 30, 30], YEL = [255, 230, 0];
const GAP = Number(gapArg), dT = COURT.top - ALLEY, dB = COURT.bottom + ALLEY;
const clip = (a, b) => { // recorta el segmento a y<=N
  if (b[1] <= N) return b; const t = (N - a[1]) / (b[1] - a[1]); return [a[0] + (b[0] - a[0]) * t, N]; };
const res = {};
for (const [name, y0] of [['izq', dT - GAP], ['der', dB + GAP]]) {
  const a = P(XW, y0), b = clip(a, P(XN, y0)); line(a, b, RED); res[name] = [a, b];
}
line([0, wallImgY], [N, wallImgY], RED);
// cancha (amarillo, solo referencia)
for (const [a, b] of [[[L0, dT], [L1, dT]], [[L0, dB], [L1, dB]], [[L1, dT], [L1, dB]]]) line(P(...a), P(...b), YEL);
save(out, N, N, o);
const pct = ([x, y]) => `(${(x / N * 100).toFixed(1)}% , ${(y / N * 100).toFixed(1)}%)`;
console.log('muro antes y', wallImgY0.toFixed(1), pct([0, wallImgY0]), 'ahora', wallImgY.toFixed(1), pct([0, wallImgY]));
for (const s of ['izq', 'der']) console.log(s, res[s].map((p) => p.map((v) => v.toFixed(0)).join(',')).join(' -> '), res[s].map(pct).join(' -> '));
