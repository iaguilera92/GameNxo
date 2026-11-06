// Temporal: separa una lámina en piezas (islas conexas de alfa), recorta cada una y las nombra.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join } from 'node:path';

const SRC = join(homedir(), 'Downloads', 'Hoja de personaje tenista en 3D.png');
const OUT = new URL('../public/assets/characters/', import.meta.url);
const PAD = 8;

function decode(path) {
  const b = readFileSync(path);
  let p = 8, w = 0, h = 0; const idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p); const t = b.toString('ascii', p + 4, p + 8); const d = b.subarray(p + 8, p + 8 + len); if (t === 'IHDR') (w = d.readUInt32BE(0)), (h = d.readUInt32BE(4)); if (t === 'IDAT') idat.push(d); p += 12 + len; }
  const raw = inflateSync(Buffer.concat(idat)), st = w * 4, px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)]; for (let x = 0; x < st; x++) { const a = x >= 4 ? px[y * st + x - 4] : 0, u = y > 0 ? px[(y - 1) * st + x] : 0, c = y > 0 && x >= 4 ? px[(y - 1) * st + x - 4] : 0; let v = raw[y * (st + 1) + 1 + x]; if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1; else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; } px[y * st + x] = v & 255; } }
  return { w, h, px };
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function encode(w, h, px) { const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }

const { w, h, px } = decode(SRC);
const seen = new Uint8Array(w * h);
const alpha = (x, y) => px[(y * w + x) * 4 + 3] > 24;
const islands = [];
// flood fill 8-dir (iterativo) con dilatación implícita: une píxeles a <=3 de distancia
const GAP = 3;
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (seen[y * w + x] || !alpha(x, y)) continue;
  let x0 = x, y0 = y, x1 = x, y1 = y, n = 0;
  const stack = [[x, y]]; seen[y * w + x] = 1;
  while (stack.length) {
    const [cx, cy] = stack.pop(); n++;
    x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy);
    for (let dy = -GAP; dy <= GAP; dy++) for (let dx = -GAP; dx <= GAP; dx++) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || !alpha(nx, ny)) continue;
      seen[ny * w + nx] = 1; stack.push([nx, ny]);
    }
  }
  if (n > 2000) islands.push({ x0, y0, x1, y1, n, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
}
console.log('islas:', islands.length);
islands.forEach((b, i) => console.log(`  #${i} ${b.x1 - b.x0 + 1}x${b.y1 - b.y0 + 1} centro(${Math.round(b.cx)},${Math.round(b.cy)}) px=${b.n}`));

// clasificar: izquierda (cx < w/2) = cuerpos; derecha = brazos. arriba (cy<h/2)=frente; abajo=espalda.
const half = w / 2, mid = h / 2;
const pick = (left, top) => islands.find((b) => (b.cx < half) === left && (b.cy < mid) === top);
const MAP = [
  ['rival_front_body.png', pick(true, true)],
  ['rival_back_body.png', pick(true, false)],
  ['rival_front_arm.png', pick(false, true)],
  ['rival_back_arm.png', pick(false, false)],
];
for (const [name, b] of MAP) {
  if (!b) { console.log('FALTA', name); continue; }
  const x0 = Math.max(0, b.x0 - PAD), y0 = Math.max(0, b.y0 - PAD), x1 = Math.min(w - 1, b.x1 + PAD), y1 = Math.min(h - 1, b.y1 + PAD);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) px.copy(out, y * cw * 4, ((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4);
  writeFileSync(new URL(name, OUT), encode(cw, ch, out));
  // pies/hombro para calibración
  const footRow = ch - 1 - PAD; let fx0 = cw, fx1 = -1;
  for (let x = 0; x < cw; x++) if (out[(footRow * cw + x) * 4 + 3] > 16) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); }
  console.log(`${name}  ${cw}x${ch}  pies=[${fx0},${fx1}] (c=${Math.round((fx0 + fx1) / 2)})`);
}
