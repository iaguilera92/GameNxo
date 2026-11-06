// Importa una lámina 2x2 (cuerpo frente/espalda + brazo frente/espalda) a piezas de skin.
// Uso: node import-sheet.mjs <archivoEnDownloads> <idSkin>
// Quita fondo (cuadros o blanco), separa por islas, recorta, instala en public/assets/characters.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join } from 'node:path';

const FILE = process.argv[2];
const ID = process.argv[3] || 'nxo';
const SRC = join(homedir(), 'Downloads', FILE);
const OUT = new URL('../public/assets/characters/', import.meta.url);
mkdirSync(OUT, { recursive: true });
const PAD = 8;

function decode(path) {
  const b = readFileSync(path); let p = 8, w = 0, h = 0, ct = 6; const idat = [];
  while (p < b.length) { const len = b.readUInt32BE(p); const t = b.toString('ascii', p + 4, p + 8); const d = b.subarray(p + 8, p + 8 + len); if (t === 'IHDR') { (w = d.readUInt32BE(0)), (h = d.readUInt32BE(4)), (ct = d[9]); } if (t === 'IDAT') idat.push(d); p += 12 + len; }
  const ch = ct === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idat)), st = w * ch, s = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) { const f = raw[y * (st + 1)]; for (let x = 0; x < st; x++) { const a = x >= ch ? s[y * st + x - ch] : 0, u = y > 0 ? s[(y - 1) * st + x] : 0, c = y > 0 && x >= ch ? s[(y - 1) * st + x - ch] : 0; let v = raw[y * (st + 1) + 1 + x]; if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1; else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; } s[y * st + x] = v & 255; } }
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) { px[i * 4] = s[i * ch]; px[i * 4 + 1] = s[i * ch + 1]; px[i * 4 + 2] = s[i * ch + 2]; px[i * 4 + 3] = ch === 4 ? s[i * ch + 3] : 255; }
  return { w, h, px };
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function encode(w, h, px) { const raw = Buffer.alloc((w * 4 + 1) * h); for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6; return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]); }

const im = decode(SRC);
const { w, h, px } = im;
// 1) quitar fondo SOLO si la imagen no tiene transparencia real (3er arg 'clean').
//    Si ya es transparente, se respeta tal cual (no se aplica ningún filtro).
let alphaPixels = 0;
for (let i = 0; i < w * h; i++) if (px[i * 4 + 3] < 250) alphaPixels++;
const hasAlpha = alphaPixels > w * h * 0.05;
const clean = process.argv[4] === 'clean' || !hasAlpha ? !process.argv.includes('noclean') : false;
if (clean && !hasAlpha) {
  let cleared = 0;
  for (let i = 0; i < w * h; i++) {
    const r = px[i * 4], g = px[i * 4 + 1], b = px[i * 4 + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx - mn <= 16 && mn >= 185) { px[i * 4 + 3] = 0; cleared++; }
  }
  console.log(`fondo borrado: ${(100 * cleared / (w * h)).toFixed(1)}%`);
} else {
  console.log(`imagen ya transparente (${(100 * alphaPixels / (w * h)).toFixed(1)}% con alfa): se respeta sin filtro`);
}

// 2) separar por islas (flood fill con tolerancia de hueco)
const seen = new Uint8Array(w * h);
const solid = (x, y) => px[(y * w + x) * 4 + 3] > 24;
const GAP = 4;
const islands = [];
for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
  if (seen[y * w + x] || !solid(x, y)) continue;
  let x0 = x, y0 = y, x1 = x, y1 = y, n = 0; const stack = [[x, y]]; seen[y * w + x] = 1;
  while (stack.length) { const [cx, cy] = stack.pop(); n++; x0 = Math.min(x0, cx); y0 = Math.min(y0, cy); x1 = Math.max(x1, cx); y1 = Math.max(y1, cy); for (let dy = -GAP; dy <= GAP; dy++) for (let dx = -GAP; dx <= GAP; dx++) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[ny * w + nx] || !solid(nx, ny)) continue; seen[ny * w + nx] = 1; stack.push([nx, ny]); } }
  if (n > 2500) islands.push({ x0, y0, x1, y1, n, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 });
}
console.log('islas:', islands.length);
const half = w / 2, mid = h / 2;
const pick = (left, top) => islands.find((b) => (b.cx < half) === left && (b.cy < mid) === top);
const MAP = [[`${ID}_front_body.png`, pick(true, true)], [`${ID}_back_body.png`, pick(true, false)], [`${ID}_front_arm.png`, pick(false, true)], [`${ID}_back_arm.png`, pick(false, false)]];
for (const [name, b] of MAP) {
  if (!b) { console.log('FALTA', name); continue; }
  const x0 = Math.max(0, b.x0 - PAD), y0 = Math.max(0, b.y0 - PAD), x1 = Math.min(w - 1, b.x1 + PAD), y1 = Math.min(h - 1, b.y1 + PAD);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) px.copy(out, y * cw * 4, ((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4);
  writeFileSync(new URL(name, OUT), encode(cw, ch, out));
  const footRow = ch - 1 - PAD; let fx0 = cw, fx1 = -1;
  for (let x = 0; x < cw; x++) if (out[(footRow * cw + x) * 4 + 3] > 16) { fx0 = Math.min(fx0, x); fx1 = Math.max(fx1, x); }
  console.log(`${name}  ${cw}x${ch}  pies.c=${Math.round((fx0 + fx1) / 2)}`);
}
