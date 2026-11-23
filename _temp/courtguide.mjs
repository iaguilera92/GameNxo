// Guia: la imagen del ambiente (1254) con la cancha ACTUAL dibujada encima en sus coordenadas, y el marco de lo que se ve en pantalla
// node courtguide.mjs <src1254.png> <wallBottomY(1536)> <zoom> <out.png>
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [src, wallBArg, zoomArg, out] = process.argv.slice(2);
const im = decode(src);
const k = 1536 / im.w;
const VW = 720, VH = 1280, CAM = 0.85;
const s = Math.max(VH / 1024, (VW + 400) / 1536) * Number(zoomArg);
const left = VW / 2 - (1536 * s) / 2, top = 302 - Number(wallBArg) * s;
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 }, ALLEY = 72;
const V = { NEAR_Y: 1010, FAR_Y: 312, NEAR_W: 700, RATIO: 0.48, LAT_K: 1.15 };
const L0 = COURT.left, L1 = COURT.right, LAT_C = (COURT.top + COURT.bottom) / 2, LAT_W = COURT.bottom - COURT.top;
const CAM_X = (L0 - V.RATIO * L1) / (1 - V.RATIO), D1 = L0 - CAM_X, D2 = L1 - CAM_X;
const F = (V.NEAR_W * D1) / LAT_W, K = (V.NEAR_Y - V.FAR_Y) / (1 / D1 - 1 / D2), H0 = V.NEAR_Y - K / D1, SHIFT = 52;
const P = (x, y) => { const D = Math.max(80, x - CAM_X), ss = F / D; return [VW / 2 + (y - LAT_C) * ss * V.LAT_K, H0 + K / D + SHIFT]; };
// mundo -> px de la imagen 1254
const I = ([wx, wy]) => [(wx - left) / s / k, (wy - top) / s / k];
const o = Buffer.from(im.px);
const dot = (x, y, c, r = 2) => { x |= 0; y |= 0; for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const X = x + a, Y = y + b; if (X < 0 || Y < 0 || X >= im.w || Y >= im.h) continue; const d = (Y * im.w + X) * 4; o[d] = c[0]; o[d + 1] = c[1]; o[d + 2] = c[2]; o[d + 3] = 255; } };
const line = (a, b, c, r) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let t = 0; t <= n; t++) dot(a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n, c, r); };
const Q = (x, y) => I(P(x, y));
const dT = COURT.top - ALLEY, dB = COURT.bottom + ALLEY, W = [255, 255, 0];
for (const [a, b] of [[[L0, dT], [L1, dT]], [[L0, dB], [L1, dB]], [[L0, dT], [L0, dB]], [[L1, dT], [L1, dB]], [[L0, COURT.top], [L1, COURT.top]], [[L0, COURT.bottom], [L1, COURT.bottom]]]) line(Q(...a), Q(...b), W, 2);
const NX = (L0 + L1) / 2; line(Q(NX, dT - 20), Q(NX, dB + 20), [255, 0, 255], 2);
// marco de pantalla en juego (zoom de camara 0.85, camara centrada)
const scr = (sx, sy) => I([(sx - VW / 2) / CAM + VW / 2, (sy - VH / 2) / CAM + VH / 2]);
const c = [0, 255, 0];
line(scr(0, 0), scr(VW, 0), c, 1); line(scr(VW, 0), scr(VW, VH), c, 1); line(scr(VW, VH), scr(0, VH), c, 1); line(scr(0, VH), scr(0, 0), c, 1);
// espectador SENTADO del mismo tamano que el rival a esa distancia (0.7 del alto de pie: 150 * s * CHAR_K), justo fuera de los pasillos
const cy = [0, 220, 255];
for (const x of [1240, 1110, 960, 800, 640]) for (const y of [dT - 60, dB + 60]) {
  const D = x - CAM_X, hw = 150 * (F / D) * 0.58 * 0.7;
  const [fx, fy] = I(P(x, y)); const hi = hw / s / k, wi = hi * 0.55;
  line([fx - wi / 2, fy], [fx + wi / 2, fy], cy, 1); line([fx - wi / 2, fy - hi], [fx + wi / 2, fy - hi], cy, 1);
  line([fx - wi / 2, fy], [fx - wi / 2, fy - hi], cy, 1); line([fx + wi / 2, fy], [fx + wi / 2, fy - hi], cy, 1);
}
save(out, im.w, im.h, o);
const pr = (n, p) => console.log(n, p.map((v) => (v * k).toFixed(0)).join(','), '(1536)');
pr('fondo-izq', Q(L1, dT)); pr('fondo-der', Q(L1, dB)); pr('cerca-izq', Q(L0, dT)); pr('cerca-der', Q(L0, dB));
pr('pantalla arriba-izq', scr(0, 0)); pr('pantalla abajo-der', scr(VW, VH));
