// Pantalla simulada (720x1280, zoom de camara 0.85) de un ambiente con el contorno de la cancha y cajas de asientos
// node screensim.mjs <src1254.png> <wallBottomY> <zoom> '<seats [[x,y,h],...]>' <out.png> [srcScaleTo1536]
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [src, wallBArg, zoomArg, seatsArg, out] = process.argv.slice(2);
const im = decode(src);
const k = 1536 / im.w;
const VW = 720, VH = 1280, CAM = 0.85;
const s = Math.max(VH / 1024, (VW + 400) / 1536) * Number(zoomArg);
const wallB = Number(wallBArg);
const left = VW / 2 - (1536 * s) / 2, top = 302 - wallB * s;
// proyeccion (copiada de projection.ts)
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 }, ALLEY = 72;
const V = { NEAR_Y: 1010, FAR_Y: 312, NEAR_W: 700, RATIO: 0.48, LAT_K: 1.15 };
const L0 = COURT.left, L1 = COURT.right, LAT_C = (COURT.top + COURT.bottom) / 2, LAT_W = COURT.bottom - COURT.top;
const CAM_X = (L0 - V.RATIO * L1) / (1 - V.RATIO), D1 = L0 - CAM_X, D2 = L1 - CAM_X;
const F = (V.NEAR_W * D1) / LAT_W, K = (V.NEAR_Y - V.FAR_Y) / (1 / D1 - 1 / D2), H0 = V.NEAR_Y - K / D1, SHIFT = 52;
const P = (x, y) => { const D = Math.max(80, x - CAM_X), ss = F / D; return [VW / 2 + (y - LAT_C) * ss * V.LAT_K, H0 + K / D + SHIFT]; };
const dT = COURT.top - ALLEY, dB = COURT.bottom + ALLEY;
// mundo -> pantalla con zoom de camara centrado
const toScr = (wx, wy) => [(wx - VW / 2) * CAM + VW / 2, (wy - VH / 2) * CAM + VH / 2];
const toWorld = (sx, sy) => [(sx - VW / 2) / CAM + VW / 2, (sy - VH / 2) / CAM + VH / 2];
const o = Buffer.alloc(VW * VH * 4);
for (let y = 0; y < VH; y++) for (let x = 0; x < VW; x++) {
  const [wx, wy] = toWorld(x, y);
  const ix = Math.floor((wx - left) / s / k), iy = Math.floor((wy - top) / s / k);
  const d = (y * VW + x) * 4; o[d + 3] = 255;
  if (ix < 0 || iy < 0 || ix >= im.w || iy >= im.h) { o[d] = 20; o[d + 1] = 20; o[d + 2] = 30; continue; }
  const i = (iy * im.w + ix) * 4; o[d] = im.px[i]; o[d + 1] = im.px[i + 1]; o[d + 2] = im.px[i + 2];
}
const dot = (x, y, c) => { x |= 0; y |= 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const X = x + a, Y = y + b; if (X < 0 || Y < 0 || X >= VW || Y >= VH) continue; const d = (Y * VW + X) * 4; o[d] = c[0]; o[d + 1] = c[1]; o[d + 2] = c[2]; } };
const line = (a, b, c) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let t = 0; t <= n; t++) dot(a[0] + ((b[0] - a[0]) * t) / n, a[1] + ((b[1] - a[1]) * t) / n, c); };
const Q = (x, y) => toScr(...P(x, y));
const Y = [255, 255, 0];
line(Q(L0, dT), Q(L1, dT), Y); line(Q(L0, dB), Q(L1, dB), Y); line(Q(L0, dT), Q(L0, dB), Y); line(Q(L1, dT), Q(L1, dB), Y);
line(Q(L0, COURT.top), Q(L1, COURT.top), Y); line(Q(L0, COURT.bottom), Q(L1, COURT.bottom), Y);
const NX = (L0 + L1) / 2; line(Q(NX, dT - 20), Q(NX, dB + 20), [255, 0, 255]);
for (const [sx, sy, hh] of JSON.parse(seatsArg || '[]')) {
  const [cx, cy] = toScr(left + sx * s, top + sy * s), h2 = hh * s * CAM;
  line([cx - h2 * 0.35, cy], [cx + h2 * 0.35, cy], [0, 255, 0]); line([cx - h2 * 0.35, cy - h2], [cx + h2 * 0.35, cy - h2], [0, 255, 0]);
  line([cx - h2 * 0.35, cy], [cx - h2 * 0.35, cy - h2], [0, 255, 0]); line([cx + h2 * 0.35, cy], [cx + h2 * 0.35, cy - h2], [0, 255, 0]);
}
save(out, VW, VH, o);
console.log('s', s.toFixed(3), 'left', left.toFixed(1), 'top', top.toFixed(1));
