// BOCETO para redibujar un ambiente: gradas en 3D con la MISMA proyeccion que la cancha del juego (projection.ts), paralelas a la cancha.
// Parte de la imagen actual (cielo, casas, muro) y pinta encima piso liso y gradas. Sale en 1254 (lo que devuelve ChatGPT).
// node standsketch.mjs <src1254.png> <wallBottomY1536> <out.png> [guia.png]
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [src, wallBArg, out, guideOut] = process.argv.slice(2);
const im = decode(src);
const N = im.w; // 1254
const k = 1536 / N;
const S = 0.875; // escala fija de la imagen (1280 / 1024 * 0.7)
const LEFT = 360 - (1536 * S) / 2, TOP = 302 - Number(wallBArg) * S;
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 }, ALLEY = 72;
const V = { NEAR_Y: 1010, FAR_Y: 312, NEAR_W: 700, RATIO: 0.48, LAT_K: 1.15, Z_K: 0.75 };
const L0 = COURT.left, L1 = COURT.right, LAT_C = (COURT.top + COURT.bottom) / 2, LAT_W = COURT.bottom - COURT.top;
const CAM_X = (L0 - V.RATIO * L1) / (1 - V.RATIO), D1 = L0 - CAM_X, D2 = L1 - CAM_X;
const F = (V.NEAR_W * D1) / LAT_W, K = (V.NEAR_Y - V.FAR_Y) / (1 / D1 - 1 / D2), H0 = V.NEAR_Y - K / D1, SHIFT = 52;
const proj = (x, y, z = 0) => { const D = Math.max(80, x - CAM_X), s = F / D; return [360 + (y - LAT_C) * s * V.LAT_K, H0 + K / D - V.Z_K * z * s + SHIFT]; };
const toImg = ([wx, wy]) => [(wx - LEFT) / S / k, (wy - TOP) / S / k]; // px de la imagen de 1254
const P = (x, y, z) => toImg(proj(x, y, z));
// x de cancha del pie del muro (su y en pantalla es 302)
let lo = L1, hi = 20000; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (proj(m, 0)[1] > 302) lo = m; else hi = m; }
const XW = (lo + hi) / 2;
const XN = L0 - 260; // las gradas siguen hasta fuera de pantalla por abajo
const o = Buffer.from(im.px);
const px = (x, y, c) => { if (x < 0 || y < 0 || x >= N || y >= N) return; const d = (y * N + x) * 4; o[d] = c[0]; o[d + 1] = c[1]; o[d + 2] = c[2]; o[d + 3] = 255; };
const poly = (pts, c) => {
  const ys = pts.map((p) => p[1]); const y0 = Math.max(0, Math.floor(Math.min(...ys))), y1 = Math.min(N - 1, Math.ceil(Math.max(...ys)));
  for (let y = y0; y <= y1; y++) {
    const xs = [];
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; if ((a[1] <= y + 0.5) !== (b[1] <= y + 0.5)) xs.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1])); }
    xs.sort((p, q) => p - q);
    for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.max(0, Math.ceil(xs[i] - 0.5)); x <= Math.min(N - 1, Math.floor(xs[i + 1] - 0.5)); x++) px(x, y, c);
  }
};
const line = (a, b, c) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1])) + 1; for (let t = 0; t <= n; t++) px(Math.round(a[0] + ((b[0] - a[0]) * t) / n), Math.round(a[1] + ((b[1] - a[1]) * t) / n), c); };
// 1) piso liso desde el pie del muro hacia abajo
const wallImgY = (302 - TOP) / S / k;
const FLOOR = [38, 48, 104];
poly([[0, wallImgY], [N, wallImgY], [N, N], [0, N]], FLOOR);
// 2) gradas: GAP fuera de la linea de dobles, STEPS escalones de RISE (alto) x DEPTH (hondo), en unidades de cancha
const GAP = 60, STEPS = 5, RISE = 30, DEPTH = 52;
const dT = COURT.top - ALLEY, dB = COURT.bottom + ALLEY;
const TOPC = [170, 168, 182], RISEC = [118, 116, 134], EDGE = [235, 200, 120], DARK = [20, 20, 30];
for (const side of [-1, 1]) {
  const y0 = side < 0 ? dT - GAP : dB + GAP;
  for (let i = STEPS - 1; i >= 0; i--) {
    const yin = y0 + side * i * DEPTH, yout = i === STEPS - 1 ? y0 + side * 2000 : yin + side * DEPTH, z = (i + 1) * RISE;
    poly([P(XN, yin, z), P(XW, yin, z), P(XW, yout, z), P(XN, yout, z)], TOPC); // pisada
    poly([P(XN, yin, z - RISE), P(XW, yin, z - RISE), P(XW, yin, z), P(XN, yin, z)], RISEC); // frente (mira a la cancha)
    line(P(XN, yin, z), P(XW, yin, z), EDGE); // borde iluminado
    line(P(XN, yin, z - RISE), P(XW, yin, z - RISE), DARK);
  }
}
save(out, N, N, o);
const r = (p) => p.map((v) => (v * k).toFixed(0)).join(',');
console.log('XW', XW.toFixed(0), 'pie del muro img1254 y', wallImgY.toFixed(1));
for (const side of [-1, 1]) { const y0 = side < 0 ? dT - GAP : dB + GAP; for (let i = 0; i < 2; i++) { const yin = y0 + side * i * DEPTH, z = (i + 1) * RISE; console.log(side < 0 ? 'izq' : 'der', 'escalon', i + 1, 'borde (1536):', r(P(XW, yin, z)), '->', r(P(L1 - 300, yin, z)), ' pie del frente:', r(P(XW, yin, z - RISE)), '->', r(P(L1 - 300, yin, z - RISE))); } }
if (guideOut) {
  const g = Buffer.from(o); const o2 = o; // dibuja la cancha encima (solo guia)
  const Y = [255, 255, 0]; const Q = (x, y) => P(x, y, 0);
  for (const [a, b] of [[[L0, dT], [L1, dT]], [[L0, dB], [L1, dB]], [[L0, dT], [L0, dB]], [[L1, dT], [L1, dB]], [[L0, COURT.top], [L1, COURT.top]], [[L0, COURT.bottom], [L1, COURT.bottom]]]) line(Q(...a), Q(...b), Y);
  save(guideOut, N, N, o2); g.copy(o);
}
