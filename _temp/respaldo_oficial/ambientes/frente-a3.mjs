// (23-11-2026) Capa FRENTE del ambiente-3: lo que queda delante de la calle (flores y cantero del fondo, poste del farol, reja verde),
// recortado del mismo fondo (px de la imagen 1254). Los autos se dibujan debajo de esta capa. Salida: PNG con alfa del recorte
// CX..CX+CW, CY..CY+CH; luego convert-image.mjs a webp con ancho CW*1536/1254. Uso: node frente-a3.mjs [preview]
import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-3-1254-v3.png'); const W = im.w;
const [CX, CY, CW, CH] = [0, 150, 440, 270];
const inPoly = (x, y, P) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
// flores + cantero + muro del fondo (borde izquierdo del arbusto rosado/verde)
const A = [[366,150],[440,150],[440,420],[318,420],[318,280],[325,268],[332,258],[340,250],[345,238],[352,228],[362,220],[366,218]];
// poste del farol
const poste = (x, y) => x >= 275 && x <= 295;
// riel de arriba de la reja (y por x) y las tapas de los postes
const RAIL = [[0,403],[70,377],[178,337],[240,312],[295,290],[340,275],[370,269]];
const railY = (x) => { for (let i = 1; i < RAIL.length; i++) if (x <= RAIL[i][0]) { const [a, b] = [RAIL[i-1], RAIL[i]]; return a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0]); } return RAIL.at(-1)[1]; };
const POSTS = [[61,79,370],[171,186,328],[234,248,305],[312,324,278]];
const front = (x, y) => inPoly(x, y, A) || poste(x, y) || y >= railY(x) - 1 || POSTS.some(([a, b, t]) => x >= a && x <= b && y >= t);
const o = Buffer.alloc(CW * CH * 4);
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const X = CX + x, Y = CY + y, s = (Y * W + X) * 4, d = (y * CW + x) * 4; if (front(X, Y)) { im.px.copy(o, d, s, s + 4); o[d + 3] = 255; } }
save('frente-a3.png', CW, CH, o);
if (process.argv[2] === 'preview') {
  // autos REALES (hoja v2 ya recortada) por los 2 carriles, DEBAJO de la capa frente; zoom x2
  const sh = decode('para-chatgpt/autos-v2-check.png'); const cw = 177, ch = 132, k = 1536 / 1254;
  const p = Buffer.from(im.px);
  const car = (r, x, y, h1536) => {
    const s = (h1536 / k) / 128; const w = cw * s, hh = ch * s;
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      let a = 0, R = 0, G = 0, B = 0, n = 0; const st = Math.max(1, Math.round(1 / s));
      for (let v = 0; v < st; v++) for (let u = 0; u < st; u++) { const sx = Math.min(cw - 1, Math.floor(i / s + u)), sy = r * ch + Math.min(ch - 1, Math.floor(j / s + v)); const d = (sy * sh.w + sx) * 4; const al = sh.px[d + 3]; a += al; R += sh.px[d] * al; G += sh.px[d+1] * al; B += sh.px[d+2] * al; n++; }
      if (!a) continue; car.n = (car.n || 0) + 1; const X = Math.round(x - w / 2 + i), Y = Math.round(y + 2 * s - hh + j), d = (Y * W + X) * 4, al = a / n / 255;
      p[d] = p[d] * (1 - al) + R / a * al; p[d+1] = p[d+1] * (1 - al) + G / a * al; p[d+2] = p[d+2] * (1 - al) + B / a * al;
    }
  };
  const LANES = JSON.parse(process.argv[3]); console.log('lanes', JSON.stringify(LANES)); // [[x0,y0,x1,y1,h0,h1], ...] en px 1536
  LANES.forEach((L, li) => { const [x0, y0, x1, y1, h0, h1] = L; for (const [t, r] of [[0, 0], [0.1, 1 + li], [0.2, 3 - li], [0.3, 2]]) car(r, (x0 + (x1 - x0) * t) / k, (y0 + (y1 - y0) * t) / k, h0 + (h1 - h0) * t); });
  console.log('px autos', car.n);
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const d = (y * CW + x) * 4; if (o[d + 3]) o.copy(p, ((CY + y) * W + CX + x) * 4, d, d + 4); }
  const z = 2, [vx, vy, vw, vh] = [20, 160, 420, 260]; const q = Buffer.alloc(vw * z * vh * z * 4);
  for (let y = 0; y < vh * z; y++) for (let x = 0; x < vw * z; x++) { const s = ((vy + Math.floor(y / z)) * W + vx + Math.floor(x / z)) * 4; p.copy(q, (y * vw * z + x) * 4, s, s + 4); q[(y * vw * z + x) * 4 + 3] = 255; }
  save('para-chatgpt/a3v3-preview.png', vw * z, vh * z, q);
}
console.log('ok');



