import { decode, save } from '../tools/png-lite.mjs';
const S = decode('_tmp/sprites-4-antes.png');
const out = Buffer.from(S.px);
const isBg = (p, i) => p[i + 1] - Math.max(p[i], p[i + 2]) > 60;
const isBall = (p, i) => p[i] > 200 && p[i + 1] > 160 && p[i + 2] < 95 && p[i] - p[i + 2] > 120;

function segments(I, y0, y1) {
  const occ = new Array(I.w).fill(0);
  for (let x = 0; x < I.w; x++) for (let y = y0; y < y1; y++) if (!isBg(I.px, (y * I.w + x) * 4)) occ[x]++;
  let runs = [], st = -1;
  for (let x = 0; x <= I.w; x++) { const on = x < I.w && occ[x] > 2; if (on && st < 0) st = x; if (!on && st >= 0) { runs.push([st, x - 1]); st = -1; } }
  return runs.filter(r => r[1] - r[0] > 12);
}
// copia de la hoja fuente con "mask" para borrar cosas
function loadSrc(path) { const I = decode(path); I.px = Buffer.from(I.px); return I; }

// borrar pelota (amarilla) en la fila indicada: pinta verde y dilata 2 px
function eraseBall(I, x0, x1, y0, y1) {
  const mark = new Uint8Array(I.w * I.h);
  for (let y = y0; y < y1; y++) for (let x = x0; x <= x1; x++) if (isBall(I.px, (y * I.w + x) * 4)) mark[y * I.w + x] = 1;
  const m2 = new Uint8Array(mark);
  for (let y = y0; y < y1; y++) for (let x = x0; x <= x1; x++) if (mark[y * I.w + x]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) m2[(y + dy) * I.w + x + dx] = 1;
  let n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x <= x1; x++) if (m2[y * I.w + x]) {
    const i = (y * I.w + x) * 4; const r = I.px[i], g = I.px[i + 1], b = I.px[i + 2];
    // solo borra lo que parece pelota o su borde (amarillo/naranja-oscuro), no la piel clara
    if (mark[y * I.w + x] || (r > 150 && g > 100 && b < 110 && r - b > 90 && g > b + 40)) { I.px[i] = 0; I.px[i + 1] = 255; I.px[i + 2] = 0; n++; }
  }
  return n;
}
// dejar solo el componente conexo más grande dentro de la caja
function keepLargest(I, x0, x1, y0, y1) {
  const lab = new Int32Array(I.w * I.h); let nl = 0; const sizes = [0];
  for (let y = y0; y < y1; y++) for (let x = x0; x <= x1; x++) {
    if (lab[y * I.w + x] || isBg(I.px, (y * I.w + x) * 4)) continue;
    nl++; let sz = 0; const st = [[x, y]]; lab[y * I.w + x] = nl;
    while (st.length) { const [cx, cy] = st.pop(); sz++;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = cx + dx, ny = cy + dy; if (nx < x0 || nx > x1 || ny < y0 || ny >= y1) continue;
        const k = ny * I.w + nx; if (lab[k] || isBg(I.px, k * 4)) continue; lab[k] = nl; st.push([nx, ny]);
      } }
    sizes.push(sz);
  }
  let best = 1; for (let l = 1; l <= nl; l++) if (sizes[l] > sizes[best]) best = l;
  for (let y = y0; y < y1; y++) for (let x = x0; x <= x1; x++) { const k = y * I.w + x; if (lab[k] && lab[k] !== best) { const i = k * 4; I.px[i] = 0; I.px[i + 1] = 255; I.px[i + 2] = 0; } }
}
function bbox(I, x0, x1, y0, y1) {
  let a = 1e9, b = 1e9, c = -1, d = -1;
  for (let y = y0; y < y1; y++) for (let x = x0; x <= x1; x++) if (!isBg(I.px, (y * I.w + x) * 4)) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); d = Math.max(d, y); }
  return { x0: a, y0: b, x1: c, y1: d };
}
// pega una fila fuente en la fila destino
function place(I, srcY0, srcY1, dstBand, dstFeet, refH, tag, fix) {
  const segs = segments(I, srcY0, srcY1);
  console.log(tag, 'segmentos', segs.length);
  if (fix) fix(I, segs);
  const b0 = bbox(I, segs[0][0], segs[0][1], srcY0, srcY1);
  const s = refH / (b0.y1 - b0.y0), base = b0.y1;
  console.log(tag, 'escala', s.toFixed(3));
  const oy = dstBand;
  for (let y = 0; y < 128; y++) for (let x = 0; x < S.w; x++) { const i = ((oy + y) * S.w + x) * 4; out[i] = 0; out[i + 1] = 255; out[i + 2] = 0; out[i + 3] = 255; }
  segs.forEach((sg, c) => {
    const bb = bbox(I, sg[0], sg[1], srcY0, srcY1);
    const cx = (bb.x0 + bb.x1) / 2, ox = c * 192;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 192; x++) {
      const fx = cx + (x - 96) / s, fy = base + (y - dstFeet) / s;
      const xa = Math.floor(fx - 0.5 / s), xb = Math.ceil(fx + 0.5 / s), ya = Math.floor(fy - 0.5 / s), yb = Math.ceil(fy + 0.5 / s);
      let R = 0, G = 0, B = 0, n = 0;
      for (let yy = ya; yy <= yb; yy++) for (let xx = xa; xx <= xb; xx++) {
        if (xx < sg[0] - 2 || xx > sg[1] + 2 || yy < srcY0 || yy >= srcY1) { G += 255; n++; continue; }
        const i = (yy * I.w + xx) * 4; R += I.px[i]; G += I.px[i + 1]; B += I.px[i + 2]; n++;
      }
      const i = ((oy + y) * S.w + ox + x) * 4; out[i] = R / n; out[i + 1] = G / n; out[i + 2] = B / n;
      // control de bordes
    }
    const nb = bbox({ w: S.w, h: S.h, px: out }, ox, ox + 191, oy, oy + 128);
    if (nb.x0 <= ox || nb.x1 >= ox + 191 || nb.y0 <= oy || nb.y1 >= oy + 127) console.log(tag, 'frame', c + 1, 'toca borde', nb);
  });
}

const D = loadSrc('_tmp/dosfilas.png'), L = loadSrc('_tmp/lanz.png');
const half = D.h / 2;
// fila 1: bote (fila superior de D). Borra pelota
place(D, 0, Math.floor(half), 0, 122, 111, 'bote', (I, segs) => {
  for (const sg of segs) console.log('pelota borrada px', eraseBall(I, sg[0] - 6, sg[1] + 6, 0, Math.floor(half)));
});
// fila 2: lanzamiento (L)
place(L, 0, L.h, 128, 123, 111, 'lanz');
// fila 4: impacto (fila inferior de D). Quita la raqueta suelta del frame 3
place(D, Math.floor(half), D.h, 384, 124, 111, 'impacto', (I, segs) => {
  const sg = segs[2]; keepLargest(I, sg[0], sg[1], Math.floor(half), D.h);
});
save('public/personajes/Nxo/pj-nxo-sprites-4.png', S.w, S.h, out);
console.log('ok');
