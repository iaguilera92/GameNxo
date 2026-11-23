const VW = 720, VH = 1280, s = Math.max(VH / 1024, (VW + 400) / 1536) * 0.7, k = 1536 / 1254;
const left = VW / 2 - (1536 * s) / 2, top = 302 - 431 * s;
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 }, ALLEY = 72;
const V = { NEAR_Y: 1010, FAR_Y: 312, NEAR_W: 700, RATIO: 0.48, LAT_K: 1.15 };
const L0 = COURT.left, L1 = COURT.right, LAT_C = (COURT.top + COURT.bottom) / 2, LAT_W = COURT.bottom - COURT.top;
const CAM_X = (L0 - V.RATIO * L1) / (1 - V.RATIO), D1 = L0 - CAM_X, D2 = L1 - CAM_X;
const F = (V.NEAR_W * D1) / LAT_W, K = (V.NEAR_Y - V.FAR_Y) / (1 / D1 - 1 / D2), H0 = V.NEAR_Y - K / D1, SHIFT = 52;
const P = (x, y) => { const D = x - CAM_X, ss = F / D; return [VW / 2 + (y - LAT_C) * ss * V.LAT_K, H0 + K / D + SHIFT]; };
const I = (x, y) => { const [wx, wy] = P(x, y); return [Math.round((wx - left) / s / k), Math.round((wy - top) / s / k)]; };
const dT = COURT.top - ALLEY, dB = COURT.bottom + ALLEY, NX = (L0 + L1) / 2;
for (const lat of [18, 802]) { const a = I(L1, lat), b = I(L0, lat); const m = (b[0]-a[0])/(b[1]-a[1]); const at = (y) => Math.round(a[0] + m*(y-a[1])); console.log('lat', lat, 'y352', at(352), 'y410', at(410), 'y621', I(NX,lat)[0], 'y1061', at(1061), 'y1254', at(1254), 'borde en y', Math.round(a[1] + ((lat<400?0:1254)-a[0])/m)); }
