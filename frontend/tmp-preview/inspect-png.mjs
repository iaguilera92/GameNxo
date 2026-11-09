// Inspección temporal de PNG: tamaño, canal alfa y caja del contenido visible.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

function decode(path) {
  const b = readFileSync(path);
  let p = 8;
  let w = 0, h = 0, depth = 0, ctype = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; ctype = data[9]; }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const ch = { 6: 4, 2: 3, 4: 2, 0: 1 }[ctype];
  if (depth !== 8 || !ch) return { w, h, depth, ctype, unsupported: true };
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * ch;
  const out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= ch ? out[y * stride + x - ch] : 0;
      const up = y > 0 ? out[(y - 1) * stride + x] : 0;
      const c = y > 0 && x >= ch ? out[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a;
      else if (f === 2) v += up;
      else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c; const pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, ch, px: out };
}

for (const path of process.argv.slice(2)) {
  const d = decode(path);
  const name = path.split(/[\\/]/).pop();
  if (d.unsupported) { console.log(name, d); continue; }
  const { w, h, ch, px } = d;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, opaque = 0, semi = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = ch === 4 ? px[(y * w + x) * 4 + 3] : 255;
    if (a > 16) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (a === 255) opaque++; else if (a > 0) semi++;
  }
  // fila más baja con contenido: centro horizontal de los pies
  const footRow = y1 - 2;
  let fx0 = w, fx1 = -1;
  for (let x = 0; x < w; x++) { const a = ch === 4 ? px[(footRow * w + x) * 4 + 3] : 255; if (a > 16) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); } }
  // borde izquierdo: rango vertical del contenido en la columna más a la izquierda (+4)
  let ly0 = h, ly1 = -1;
  for (let y = 0; y < h; y++) { const a = ch === 4 ? px[(y * w + x0 + 4) * 4 + 3] : 255; if (a > 16) { ly0 = Math.min(ly0, y); ly1 = Math.max(ly1, y); } }
  console.log(JSON.stringify({ name, w, h, alpha: ch === 4, transparentPct: +(100 * (1 - (opaque + semi) / (w * h))).toFixed(1), bbox: { x0, y0, x1, y1, bw: x1 - x0 + 1, bh: y1 - y0 + 1 }, feetX: [fx0, fx1], leftEdgeY: [ly0, ly1] }));
}
