// Pega una animación nueva (imagen aparte, frames en cuadrícula) como fila de una hoja de NXO.
//   node tools/paste-row.mjs <hoja.png> <fila 1-8> <nueva.png> <cols> <rows>
// - Cada frame de la imagen nueva se recorta (lo que no es verde), se escala para que el personaje tenga la
//   MISMA altura que en el frame 1 actual de esa fila y se apoya con los pies en la misma línea.
// - La posición horizontal relativa entre frames se conserva (desplazamiento común basado en el frame 1).
// - El fondo queda en verde puro (#00FF00), como el resto de la hoja (build-nxo-v2.mjs lo quita).
import { decode, save } from './png-lite.mjs';

const [sheetPath, rowArg, newPath, colsArg, rowsArg] = process.argv.slice(2);
const ROW = Number(rowArg) - 1;
const COLS = Number(colsArg);
const ROWS = Number(rowsArg);
const CW = 192;
const CH = 128;
const N = 8;

const isGreen = (r, g, b) => g - Math.max(r, b) > 40;
const sheet = decode(sheetPath);
const src = decode(newPath);

/** Caja de lo que no es verde dentro de un rectángulo. */
function bbox(img, x0, y0, w, h) {
  let minX = 1e9, minY = 1e9, maxX = -1, maxY = -1;
  for (let y = y0; y < y0 + h; y++)
    for (let x = x0; x < x0 + w; x++) {
      const i = (y * img.w + x) * 4;
      if (!isGreen(img.px[i], img.px[i + 1], img.px[i + 2])) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// referencia: frame 1 actual de la fila (altura y pies)
const ref = bbox(sheet, 0, ROW * CH, CW, CH);
const refFeet = ref.maxY - ROW * CH;
const refCx = (ref.minX + ref.maxX) / 2;

const fw = src.w / COLS;
const fh = src.h / ROWS;
const boxes = [];
for (let k = 0; k < N; k++) {
  const cx = (k % COLS) * fw, cy = Math.floor(k / COLS) * fh;
  boxes.push({ ...bbox(src, Math.round(cx), Math.round(cy), Math.round(fw), Math.round(fh)), cx, cy });
}
// escala única: altura del frame 1 nuevo = altura del frame 1 actual
const scale = ref.h / boxes[0].h;
// desplazamiento común (en coordenadas de la celda nueva) para centrar como el frame 1 actual
const new1Cx = (boxes[0].minX + boxes[0].maxX) / 2 - boxes[0].cx;
const new1Feet = boxes[0].maxY - boxes[0].cy;
console.log({ ref: { h: ref.h, feet: refFeet, cx: refCx }, new1: { h: boxes[0].h, feet: new1Feet, cx: new1Cx }, scale: scale.toFixed(3) });

for (let k = 0; k < N; k++) {
  const b = boxes[k];
  const ox = k * CW, oy = ROW * CH;
  // celda destino a verde
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      const i = ((oy + y) * sheet.w + ox + x) * 4;
      sheet.px[i] = 0; sheet.px[i + 1] = 255; sheet.px[i + 2] = 0; sheet.px[i + 3] = 255;
    }
  // muestreo por área (promedia solo píxeles que no son verdes; cobertura = alfa → mezcla con verde)
  for (let y = 0; y < CH; y++)
    for (let x = 0; x < CW; x++) {
      // punto de la celda nueva que corresponde a (x, y) de la celda destino
      const sx0 = b.cx + new1Cx + (x - refCx) / scale;
      const sy0 = b.cy + new1Feet + (y - refFeet) / scale;
      const step = 1 / scale;
      let r = 0, g = 0, bl = 0, n = 0, tot = 0;
      for (let yy = 0; yy < step; yy += 1)
        for (let xx = 0; xx < step; xx += 1) {
          const px = Math.floor(sx0 + xx), py = Math.floor(sy0 + yy);
          tot++;
          if (px < b.cx || py < b.cy || px >= b.cx + fw || py >= b.cy + fh || px >= src.w || py >= src.h) continue;
          const i = (py * src.w + px) * 4;
          if (isGreen(src.px[i], src.px[i + 1], src.px[i + 2])) continue;
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
