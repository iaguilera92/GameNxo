// Pega una animacion nueva (imagen aparte, frames en cuadricula) como fila de una hoja de NXO.
//   node tools/paste-row.mjs <hoja.png> <fila 1-8> <nueva.png> <cols> <rows> [frames]
//   frames = lista de frames de la imagen nueva (1-based, separados por coma) que se pegan en las 8 columnas de la fila.
//            Por defecto 1,2,...,8. Ej.: "1,2,3,4,5,6,7,8" para descartar un 9.o frame.
//   feet   = (opcional) linea de los pies dentro de la celda, en px desde arriba. Por defecto, la del frame 1 actual de la fila.
//   height = (opcional) alto del personaje de pie en px. Por defecto, el del frame 1 actual. Si la raqueta sube mucho,
//            usar pies mas abajo y un alto algo menor para que no se corte arriba (p. ej. feet 142, height 112).
// - La celda de la hoja se deduce de su tamano (ancho/8 x alto/8): sirve para hojas de 192x128 y de 1330x1182.
// - Cada frame se escala con UN solo factor: el personaje del frame 1 nuevo mide lo mismo que el frame 1 actual de esa fila.
// - Horizontal: la CABEZA (pelo oscuro) de cada frame queda en el centro de su celda (los frames generados derivan de lado).
// - Vertical: los pies de cada frame quedan en la misma linea que los pies del frame 1 actual.
// - El fondo queda en verde puro (#00FF00), como el resto de la hoja (build-nxo-v2.mjs lo quita).
import { decode, save } from './png-lite.mjs';
const [sheetPath, rowArg, newPath, colsArg, rowsArg, framesArg, feetArg, heightArg] = process.argv.slice(2);
const ROW = Number(rowArg) - 1;
const COLS = Number(colsArg);
const ROWS = Number(rowsArg);
const N = 8;
const isGreen = (r, g, b) => g - Math.max(r, b) > 40;
const sheet = decode(sheetPath);
const src = decode(newPath);
const CW = sheet.w / N;
const CH = sheet.h / N;
const frames = (framesArg ? framesArg.split(',').map(Number) : [1, 2, 3, 4, 5, 6, 7, 8]).map((f) => f - 1);
if (frames.length !== N) throw new Error(`se necesitan ${N} frames y hay ${frames.length}`);
/**
 * Dueno de cada pixel: cada pieza conexa de la imagen nueva pertenece al frame cuyo cuerpo (pieza mas grande de su celda)
 * esta mas cerca. Asi un puno o una raqueta que cruza al vecino no se mezcla con el frame de al lado.
 */
const NF = COLS * ROWS;
const fw = src.w / COLS;
const fh = src.h / ROWS;
const owner = new Int16Array(src.w * src.h).fill(-1);
{
  const lab = new Int32Array(src.w * src.h).fill(-1);
  const comps = [];
  for (let s0 = 0; s0 < src.w * src.h; s0++) {
    const o = s0 * 4;
    if (lab[s0] >= 0 || isGreen(src.px[o], src.px[o + 1], src.px[o + 2])) continue;
    const id = comps.length;
    const c = { id, n: 0, x0: 1e9, x1: -1, y0: 1e9, y1: -1, sx: 0, sy: 0, pix: [] };
    const st = [s0];
    lab[s0] = id;
    while (st.length) {
      const q = st.pop();
      const x = q % src.w, y = (q / src.w) | 0;
      c.n++; c.pix.push(q); c.sx += x; c.sy += y;
      if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= src.w || ny >= src.h) continue;
          const nq = ny * src.w + nx, no = nq * 4;
          if (lab[nq] >= 0 || isGreen(src.px[no], src.px[no + 1], src.px[no + 2])) continue;
          lab[nq] = id;
          st.push(nq);
        }
    }
    comps.push(c);
  }
  const cellOf = (x, y) => Math.min(NF - 1, Math.floor(y / fh) * COLS + Math.min(COLS - 1, Math.floor(x / fw)));
  const body = new Array(NF).fill(null);
  for (const c of comps) {
    if (c.n < 300) continue;
    const k = cellOf(c.sx / c.n, c.sy / c.n);
    if (!body[k] || c.n > body[k].n) body[k] = c;
  }
  for (const c of comps) {
    if (c.n < 4) continue; // polvo
    let best = -1, bd = 1e9;
    for (let k = 0; k < NF; k++) {
      const b = body[k];
      if (!b) continue;
      const d = Math.max(0, b.x0 - c.x1, c.x0 - b.x1) + Math.max(0, b.y0 - c.y1, c.y0 - b.y1);
      if (d < bd) { bd = d; best = k; }
    }
    if (best >= 0 && (c === body[best] || bd < 80)) for (const q of c.pix) owner[q] = best;
  }
}
/** Caja de lo que no es verde (y es del frame k) dentro de un rectangulo. */
function bbox(img, x0, y0, w, h, k = -1) {
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * img.w + x) * 4;
      if (!isGreen(img.px[i], img.px[i + 1], img.px[i + 2]) && (k < 0 || owner[y * img.w + x] === k)) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}
/** Centro horizontal de la cabeza: pixeles oscuros de las primeras filas del cuerpo (la raqueta es roja/blanca, no cuenta). */
function headCx(img, b, k) {
  const dark = (x, y) => {
    const i = (y * img.w + x) * 4;
    return owner[y * img.w + x] === k && img.px[i] < 120 && img.px[i + 1] < 90 && img.px[i + 2] < 90 && !isGreen(img.px[i], img.px[i + 1], img.px[i + 2]);
  };
  let top = -1;
  for (let y = b.minY; y <= b.maxY && top < 0; y++) {
    let n = 0;
    for (let x = b.minX; x <= b.maxX; x++) if (dark(x, y)) n++;
    if (n >= 8) top = y;
  }
  if (top < 0) return (b.minX + b.maxX) / 2;
  let s = 0, c = 0;
  const lim = top + Math.round((b.maxY - top) * 0.16);
  for (let y = top; y <= lim; y++) for (let x = b.minX; x <= b.maxX; x++) if (dark(x, y)) { s += x; c++; }
  return c ? s / c : (b.minX + b.maxX) / 2;
}
// referencia: frame 1 actual de la fila (altura y pies)
const ref = bbox(sheet, 0, Math.round(ROW * CH), Math.round(CW), Math.round(CH), -1);
const refFeet = feetArg ? Math.round(ROW * CH) + Number(feetArg) : ref.maxY;
const boxes = frames.map((k) => {
  const cx = (k % COLS) * fw, cy = Math.floor(k / COLS) * fh;
  const b = bbox(src, Math.max(0, Math.round(cx - fw / 2)), Math.round(cy), Math.min(src.w, Math.round(fw * 2)), Math.round(fh), k);
  return { ...b, hc: headCx(src, b, k), k };
});
// escala unica: altura del frame 1 nuevo = altura del frame 1 actual
const scale = (heightArg ? Number(heightArg) : ref.h) / boxes[0].h;
console.log({ ref: { h: ref.h, feet: refFeet }, new1: { h: boxes[0].h }, scale: scale.toFixed(3), headCx: boxes.map((b) => Math.round(b.hc)) });
for (let k = 0; k < N; k++) {
  const b = boxes[k];
  const ox = Math.round(k * CW), oy = Math.round(ROW * CH);
  const cwk = Math.round((k + 1) * CW) - ox; // ancho exacto de esta celda (las celdas miden fracciones: sin huecos entre ellas)
  const dcx = (k + 0.5) * CW - ox; // la cabeza va al centro de la celda
  // celda destino a verde
  for (let y = 0; y < Math.round(CH); y++)
    for (let x = 0; x < cwk; x++) {
      const i = ((oy + y) * sheet.w + ox + x) * 4;
      sheet.px[i] = 0; sheet.px[i + 1] = 255; sheet.px[i + 2] = 0; sheet.px[i + 3] = 255;
    }
  const step = 1 / scale;
  for (let y = 0; y < Math.round(CH); y++)
    for (let x = 0; x < cwk; x++) {
      // pixel (x, y) de la celda destino -> punto de la imagen nueva
      const sx0 = b.hc + (x - dcx) / scale;
      const sy0 = b.maxY + 1 + (y + oy - refFeet - 1) / scale;
      let r = 0, g = 0, bl = 0, n = 0, tot = 0;
      for (let yy = 0; yy < step; yy += 1)
        for (let xx = 0; xx < step; xx += 1) {
          const px = Math.floor(sx0 + xx), py = Math.floor(sy0 + yy);
          tot++;
          if (px < 0 || py < 0 || px >= src.w || py >= src.h) continue;
          const i = (py * src.w + px) * 4;
          if (isGreen(src.px[i], src.px[i + 1], src.px[i + 2]) || owner[py * src.w + px] !== b.k) continue;
          r += src.px[i]; g += src.px[i + 1]; bl += src.px[i + 2]; n++;
        }
      if (!n) continue;
      const a = n / tot;
      if (a < 0.35) continue; // borde muy fino: se queda verde (evita halos)
      const i = ((oy + y) * sheet.w + ox + x) * 4;
      sheet.px[i] = Math.round(r / n);
      sheet.px[i + 1] = Math.round(g / n);
      sheet.px[i + 2] = Math.round(bl / n);
    }
}
save(sheetPath, sheet.w, sheet.h, sheet.px);
console.log('fila', ROW + 1, 'pegada en', sheetPath);