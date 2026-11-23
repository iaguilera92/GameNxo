// ENDEREZA las gradas de un ambiente de ChatGPT para que corran paralelas a la cancha del juego (boceto: standsketch.mjs).
// Cada grada se deforma con una homografia: su arriba queda fijo y su borde de abajo pasa a la recta de la perspectiva de la cancha.
// Lo que antes era grada y ahora queda fuera se pinta con el piso (color de la columna central a esa altura).
// node warp-gradas.mjs <in1254.png> <out.png> '<json lados>'
//   lado: { src: [[x,y] x4], dst: [[x,y] x4], zone: [xMin, xMax], edgeSrc: [[x,y],[x,y]], edgeDst: [[x,y],[x,y]], topY }
//   puntos en orden: esquina junto al muro (abajo), borde de abajo en el lateral de la imagen, arriba en el lateral, arriba junto al muro
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [inp, out, sidesArg] = process.argv.slice(2);
const im = decode(inp);
const W = im.w, H = im.h;
const sides = JSON.parse(sidesArg);
function homography(src, dst) {
  // dst = H * src ; resuelve 8 incognitas
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  for (let c = 0; c < 8; c++) {
    let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
    for (let r = 0; r < 8; r++) if (r !== c) { const f = A[r][c] / A[c][c]; for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
  }
  const h = b.map((v, i) => v / A[i][i]);
  return (x, y) => { const w = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / w, (h[3] * x + h[4] * y + h[5]) / w]; };
}
const inside = (pts, x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
// lado de una recta (a->b): >0 por encima (grada), segun hacia donde mire
const above = ([a, b], x, y) => { const t = (x - a[0]) / (b[0] - a[0]); return y < a[1] + t * (b[1] - a[1]); };
const sample = (x, y) => {
  x = Math.min(W - 1.001, Math.max(0, x)); y = Math.min(H - 1.001, Math.max(0, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, r = [0, 0, 0, 0];
  for (const [dx, dy, w] of [[0, 0, (1 - fx) * (1 - fy)], [1, 0, fx * (1 - fy)], [0, 1, (1 - fx) * fy], [1, 1, fx * fy]]) { const i = ((y0 + dy) * W + x0 + dx) * 4; for (let k = 0; k < 4; k++) r[k] += im.px[i + k] * w; }
  return r;
};
const o = Buffer.from(im.px);
const floorAt = (y) => { const i = (Math.round(y) * W + Math.round(W / 2)) * 4; return [im.px[i], im.px[i + 1], im.px[i + 2], 255]; };
for (const sd of sides) {
  const inv = homography(sd.dst, sd.src);
  const [zx0, zx1] = sd.zone;
  for (let y = sd.topY; y < H; y++) for (let x = zx0; x <= zx1; x++) {
    const d = (y * W + x) * 4;
    let c = null;
    if (sd.keep && y < sd.keep[2] && x >= sd.keep[0] && x <= sd.keep[1]) continue; // farol y valla junto a la esquina: sin tocar
    if (sd.all ? above(sd.edgeDst, x, y) : inside(sd.dst, x + 0.5, y + 0.5)) c = sample(...inv(x + 0.5, y + 0.5).map((v) => v - 0.5));
    else if (y >= sd.floorY && above(sd.edgeSrc, x, y - (sd.edgePad ?? 0)) && !above(sd.edgeDst, x, y)) c = floorAt(y); // era grada y ahora es piso
    if (c) for (let k = 0; k < 4; k++) o[d + k] = c[k];
  }
}
save(out, W, H, o);
console.log('ok', out);
