// Distancia en pantalla (mundo, px) entre la linea de dobles y el pie del muro lateral, y guia con distancia constante
// node gap2v2.mjs <wallBottomY1536> <edgeL json [[y,x],...] en 1254> <G>
const [wbArg, edgeArg, gArg] = process.argv.slice(2);
const VW = 720, VH = 1280;
const s = Math.max(VH / 1024, (VW + 400) / 1536) * 0.7;
const k = 1536 / 1254;
const left = VW / 2 - (1536 * s) / 2, top = 302 - Number(wbArg) * s;
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 }, ALLEY = 72;
const V = { NEAR_Y: 1010, FAR_Y: 312, NEAR_W: 700, RATIO: 0.48, LAT_K: 1.15 };
const L0 = COURT.left, L1 = COURT.right, LAT_C = (COURT.top + COURT.bottom) / 2, LAT_W = COURT.bottom - COURT.top;
const CAM_X = (L0 - V.RATIO * L1) / (1 - V.RATIO), D1 = L0 - CAM_X, D2 = L1 - CAM_X;
const F = (V.NEAR_W * D1) / LAT_W, K = (V.NEAR_Y - V.FAR_Y) / (1 / D1 - 1 / D2), H0 = V.NEAR_Y - K / D1, SHIFT = 52;
const dT = COURT.top - ALLEY, dB = COURT.bottom + ALLEY;
// para una fila de pantalla wy: x de las lineas de dobles
const doublesAt = (wy) => { const D = K / (wy - SHIFT - H0); const ss = F / D; return [VW / 2 + (dT - LAT_C) * ss * V.LAT_K, VW / 2 + (dB - LAT_C) * ss * V.LAT_K]; };
const toImg = (wx, wy) => [(wx - left) / s / k, (wy - top) / s / k];
const toWorld = (ix, iy) => [left + ix * k * s, top + iy * k * s];
console.log('s', s.toFixed(4), 'left', left.toFixed(1), 'top', top.toFixed(1), 'farBase y', (H0 + K / D2 + SHIFT).toFixed(1), 'nearBase y', (H0 + K / D1 + SHIFT).toFixed(1));
if (edgeArg && edgeArg !== '-') {
  for (const [iy, ixL, ixR] of JSON.parse(edgeArg)) {
    const [wxL, wy] = toWorld(ixL, iy), [wxR] = toWorld(ixR, iy);
    const [dl, dr] = doublesAt(wy);
    console.log('img y', iy, 'world y', wy.toFixed(0), 'gapL', (dl - wxL).toFixed(0), 'gapR', (wxR - dr).toFixed(0));
  }
}
if (gArg) {
  const G = Number(gArg);
  for (const iy of [352, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1254]) {
    const [, wy] = toWorld(0, iy); const [dl, dr] = doublesAt(wy);
    console.log('guia img y', iy, 'L x', toImg(dl - G, wy)[0].toFixed(0), 'R x', toImg(dr + G, wy)[0].toFixed(0));
  }
}
