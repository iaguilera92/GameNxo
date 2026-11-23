// Dibuja la cancha del juego (blanco), la guia del pie de los muros (rojo) y la distancia muro-dobles medida (amarillo)
// sobre un ambiente 2v2 de 1254x1254. node cancha-sobre-ambiente.mjs <in.png> <out.png> '<[[y,xL,xR],...] pie medido>'
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [inp, out, edgeArg, anchorArg, zoomArg] = process.argv.slice(2);
const ZOOM = Number(zoomArg ?? 0.7); // zoom del ambiente en CourtView (2v2 y ambiente-1: 0.7; ambiente-2: 0.6). Con pantalla de 1280 de alto
const ANCHOR = Number(anchorArg ?? 431); // anchorY (o wallBottomY) del ambiente en CourtView: 2v2 = 431, ambiente-1 = 350
const im = decode(inp);
const W = im.w, H = im.h, o = Buffer.from(im.px);
const VW = 720, VH = 1280, s = Math.max(VH / 1024, (VW + 400) / 1536) * ZOOM, k = 1536 / 1254;
const left = VW / 2 - (1536 * s) / 2, top = 302 - ANCHOR * s;
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 }, ALLEY = 72;
const V = { NEAR_Y: 1010, FAR_Y: 312, NEAR_W: 700, RATIO: 0.48, LAT_K: 1.15 };
const L0 = COURT.left, L1 = COURT.right, LAT_C = (COURT.top + COURT.bottom) / 2, LAT_W = COURT.bottom - COURT.top;
const CAM_X = (L0 - V.RATIO * L1) / (1 - V.RATIO), D1 = L0 - CAM_X, D2 = L1 - CAM_X;
const F = (V.NEAR_W * D1) / LAT_W, K = (V.NEAR_Y - V.FAR_Y) / (1 / D1 - 1 / D2), H0 = V.NEAR_Y - K / D1, SHIFT = 52;
const P = (x, y) => { const D = x - CAM_X, ss = F / D; return [VW / 2 + (y - LAT_C) * ss * V.LAT_K, H0 + K / D + SHIFT]; };
const I = (x, y) => { const [wx, wy] = P(x, y); return [(wx - left) / s / k, (wy - top) / s / k]; };
const dot = (x, y, c, r) => { for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) { const X = Math.round(x + dx), Y = Math.round(y + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const d = (Y * W + X) * 4; o[d] = c[0]; o[d + 1] = c[1]; o[d + 2] = c[2]; o[d + 3] = 255; } };
const line = (a, b, c, r = 2) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])); for (let i = 0; i <= n; i++) dot(a[0] + ((b[0] - a[0]) * i) / n, a[1] + ((b[1] - a[1]) * i) / n, c, r); };
const WH = [255, 255, 255], RED = [255, 0, 0], YEL = [255, 230, 0];
const dT = COURT.top - ALLEY, dB = COURT.bottom + ALLEY, NX = (L0 + L1) / 2, SV = ((L1 - L0) / 2) * (21 / 39);
// cancha
line(I(L1, dT), I(L1, dB), WH); line(I(L0, dT), I(L0, dB), WH);
for (const y of [dT, COURT.top, COURT.bottom, dB]) line(I(L0, y), I(L1, y), WH);
line(I(NX - SV, COURT.top), I(NX - SV, COURT.bottom), WH); line(I(NX + SV, COURT.top), I(NX + SV, COURT.bottom), WH);
line(I(NX - SV, LAT_C), I(NX + SV, LAT_C), WH);
line(I(NX, dT - 25), I(NX, dB + 25), [40, 40, 40], 3); // red
// guia del pie de los muros (140 px por fuera de dobles)

// distancia medida: pie del muro de la imagen -> linea de dobles
const dbl = (y, side) => { const a = I(L1, side), b = I(L0, side); return a[0] + ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]); };
for (const [y, xL, xR] of JSON.parse(edgeArg || '[]')) {
  const l = dbl(y, dT), r = dbl(y, dB);
  line([xL, y], [l, y], YEL, 2); line([r, y], [xR, y], YEL, 2);
  console.log('y', y, 'gap izq', Math.round(l - xL), 'gap der', Math.round(xR - r), '(guia 140)');
}
// medidas para el prompt (px de 1024): esquinas de dobles y punto de fuga de los laterales
const q = (p) => [Math.round(p[0] * 1024 / W), Math.round(p[1] * 1024 / H)];
const fl = I(L1, dT), fr = I(L1, dB), nl = I(L0, dT), nr = I(L0, dB), ml = I(NX, dT), mr = I(NX, dB);
console.log('dobles fondo', q(fl), q(fr), ' red', q(ml), q(mr), ' abajo', q(nl), q(nr));
const vy = fl[1] + (nl[1] - fl[1]) * ((W / 2 - fl[0]) / (nl[0] - fl[0]));
console.log('punto de fuga y (1024):', Math.round(vy * 1024 / H));
save(out, W, H, o);
console.log('ok', out);

