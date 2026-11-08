import { decode, save } from '../tools/png-lite.mjs';
const B = decode('public/personajes/Nxo/pj-nxo-sprites-1.png');
const N = decode('public/personajes/Nxo/_filas-5y7-nuevas.png');
const isBg = (p, i) => p[i + 1] - Math.max(p[i], p[i + 2]) > 60;
const bbox = (I, x0, y0, w, h) => {
  let a = 1e9, b = 1e9, c = -1, d = -1;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (!isBg(I.px, (y * I.w + x) * 4)) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return { x0: a, y0: b, x1: c, y1: d };
};
// referencia de escala: alto mediano del cuerpo en filas 2 y 6 de la base (y pies)
const hs = [], bots = [];
for (const r of [1, 5]) for (let c = 0; c < 8; c++) { const bb = bbox(B, c * 192, r * 128, 192, 128); hs.push(bb.y1 - bb.y0); bots.push(bb.y1 - r * 128); }
hs.sort((a, b) => a - b); bots.sort((a, b) => a - b);
const refH = 108, refBot = 115;
const cw = N.w / 8, ch = N.h / 2;
const segs = [];
for (let r = 0; r < 2; r++) {
  const y0 = Math.floor(r * ch), y1 = Math.floor((r + 1) * ch);
  const occ = new Array(N.w).fill(0);
  for (let x = 0; x < N.w; x++) for (let y = y0; y < y1; y++) if (!isBg(N.px, (y * N.w + x) * 4)) occ[x]++;
  let runs = [], st = -1;
  for (let x = 0; x <= N.w; x++) { const on = x < N.w && occ[x] > 2; if (on && st < 0) st = x; if (!on && st >= 0) { runs.push([st, x - 1]); st = -1; } }
  runs = runs.filter(r2 => r2[1] - r2[0] > 12);
  console.log('fila', r, 'segmentos', runs.length);
  segs.push(runs);
}
// escala común: alto mediano del personaje en la hoja nueva
const nh = [];
for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) { const sg = segs[r][c]; const bb = bbox(N, sg[0], Math.floor(r * ch), sg[1] - sg[0] + 1, Math.floor(ch)); nh.push(bb.y1 - bb.y0); }
nh.sort((a, b) => a - b);
const s = refH / nh[nh.length >> 1];
console.log({ refH, refBot, nhMed: nh[nh.length >> 1], s });
const out = Buffer.from(B.px);
const dstY = [548, 786];
for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) {
  const sg = segs[r][c]; const sx = sg[0], sy = Math.floor(r * ch), sw = sg[1] - sg[0] + 1, sh = Math.floor(ch);
  const bb = bbox(N, sx, sy, sw, sh);
  const cx = (bb.x0 + bb.x1) / 2, bot = bb.y1;
  const ox = c * 192, oy = dstY[r];
  // limpiar celda destino a verde
  for (let y = 0; y < 128; y++) for (let x = 0; x < 192; x++) { const i = ((oy + y) * B.w + ox + x) * 4; out[i] = 0; out[i + 1] = 255; out[i + 2] = 0; out[i + 3] = 255; }
  for (let y = 0; y < 128; y++) for (let x = 0; x < 192; x++) {
    // pixel destino -> fuente (promedio de caja)
    const fx = cx + (x - 96) / s, fy = bot + (oy + y - (oy + refBot)) / s;
    const x0 = Math.floor(fx - 0.5 / s), x1 = Math.ceil(fx + 0.5 / s), y0 = Math.floor(fy - 0.5 / s), y1 = Math.ceil(fy + 0.5 / s);
    let R = 0, G = 0, Bl = 0, n = 0;
    for (let yy = y0; yy <= y1; yy++) for (let xx = x0; xx <= x1; xx++) {
      if (xx < bb.x0 - 4 || yy < sy || xx > bb.x1 + 4 || yy >= sy + sh || (xx < sx) || xx >= sx + sw) { R += 0; G += 255; n++; continue; }
      const i = (yy * N.w + xx) * 4; R += N.px[i]; G += N.px[i + 1]; Bl += N.px[i + 2]; n++;
    }
    const i = ((oy + y) * B.w + ox + x) * 4; out[i] = R / n; out[i + 1] = G / n; out[i + 2] = Bl / n;
  }
}
save('public/personajes/Nxo/pj-nxo-sprites-1.png', B.w, B.h, out);
// comprobar recortes en bordes de celda

console.log('ok');



