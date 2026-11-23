// Vista previa de los COLORES de la cancha dura (CourtView.drawHard, sin los brillos) sobre un ambiente de 1254, para elegir la paleta.
// node preview-cancha.mjs <in.png> <out.png> <anchorY> '<{"alley":"#..","near":"#..","far":"#.."}>'
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [inp, out, anchorArg, palArg] = process.argv.slice(2);
// (PowerShell quita las comillas del JSON: se puede pasar la ruta de un .json)
const pal = JSON.parse(palArg.endsWith('.json') ? (await import('node:fs')).readFileSync(palArg, 'utf8') : palArg);
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const C = { alley: hex(pal.alley), near: hex(pal.near), far: hex(pal.far) };
const im = decode(inp);
const W = im.w, H = im.h, o = Buffer.from(im.px);
const VW = 720, VH = 1280, s = Math.max(VH / 1024, (VW + 400) / 1536) * 0.7, k = 1536 / 1254;
const left = VW / 2 - (1536 * s) / 2, top = 302 - Number(anchorArg) * s;
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 }, ALLEY = 72;
const V = { NEAR_Y: 1010, FAR_Y: 312, NEAR_W: 700, RATIO: 0.48, LAT_K: 1.15 };
const L0 = COURT.left, L1 = COURT.right, LAT_C = (COURT.top + COURT.bottom) / 2, LAT_W = COURT.bottom - COURT.top;
const CAM_X = (L0 - V.RATIO * L1) / (1 - V.RATIO), D1 = L0 - CAM_X, D2 = L1 - CAM_X;
const F = (V.NEAR_W * D1) / LAT_W, K = (V.NEAR_Y - V.FAR_Y) / (1 / D1 - 1 / D2), H0 = V.NEAR_Y - K / D1, SHIFT = 52;
const P = (x, y) => { const D = x - CAM_X, ss = F / D; return [VW / 2 + (y - LAT_C) * ss * V.LAT_K, H0 + K / D + SHIFT]; };
const I = (x, y) => { const [wx, wy] = P(x, y); return [(wx - left) / s / k, (wy - top) / s / k]; };
const put = (X, Y, c, a = 1) => { X = Math.round(X); Y = Math.round(Y); if (X < 0 || Y < 0 || X >= W || Y >= H) return; const d = (Y * W + X) * 4; for (let i = 0; i < 3; i++) o[d + i] = Math.round(o[d + i] * (1 - a) + c[i] * a); };
const dT = COURT.top - ALLEY, dB = COURT.bottom + ALLEY, NX = (L0 + L1) / 2, SV = ((L1 - L0) / 2) * 0.538;
const bands = 14;
for (let x = L0; x <= L1; x += 0.35) {
  for (let y = dT; y <= dB; y += 0.35) {
    let c = C.alley;
    if (y >= COURT.top && y <= COURT.bottom) {
      const b = Math.min(bands - 1, Math.floor(((x - L0) / (L1 - L0)) * bands));
      const t = b / (bands - 1);
      c = [0, 1, 2].map((i) => C.near[i] + (C.far[i] - C.near[i]) * t);
      if (x >= NX - SV && x <= NX + SV) c = c.map((v) => v + (255 - v) * 0.05); // cuadros de saque un tono más claros
    }
    const [px, py] = I(x, y);
    put(px, py, c);
  }
}
const WH = [255, 255, 255];
const line = (a, b) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2); for (let i = 0; i <= n; i++) for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) put(a[0] + ((b[0] - a[0]) * i) / n + dx, a[1] + ((b[1] - a[1]) * i) / n + dy, WH, Math.hypot(dx, dy) <= 1.5 ? 1 : 0.35); };
line(I(L1, dT), I(L1, dB)); line(I(L0, dT), I(L0, dB));
for (const y of [dT, COURT.top, COURT.bottom, dB]) line(I(L0, y), I(L1, y));
line(I(NX - SV, COURT.top), I(NX - SV, COURT.bottom)); line(I(NX + SV, COURT.top), I(NX + SV, COURT.bottom));
line(I(NX - SV, LAT_C), I(NX + SV, LAT_C));
save(out, W, H, o);
console.log('ok', out);
