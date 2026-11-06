// Utilidades PNG mínimas (sin dependencias): decode a RGBA 8 bits y encode.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

export function decode(path) {
  const b = readFileSync(path);
  let p = 8, w = 0, h = 0, bd = 8, ct = 6, plte = null, trns = null; const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), t = b.toString('ascii', p + 4, p + 8), d = b.subarray(p + 8, p + 8 + len);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; }
    if (t === 'PLTE') plte = d; if (t === 'tRNS') trns = d; if (t === 'IDAT') idat.push(d);
    p += 12 + len;
  }
  if (bd !== 8) throw new Error('bit depth ' + bd + ' no soportado');
  const chn = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ct], st = w * chn, raw = inflateSync(Buffer.concat(idat)), s = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) {
      const a = x >= chn ? s[y * st + x - chn] : 0, u = y ? s[(y - 1) * st + x] : 0, c = y && x >= chn ? s[(y - 1) * st + x - chn] : 0;
      let v = raw[y * (st + 1) + 1 + x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      s[y * st + x] = v & 255;
    }
  }
  const px = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    let r, g, bl, a = 255;
    if (ct === 6) { r = s[i * 4]; g = s[i * 4 + 1]; bl = s[i * 4 + 2]; a = s[i * 4 + 3]; }
    else if (ct === 2) { r = s[i * 3]; g = s[i * 3 + 1]; bl = s[i * 3 + 2]; }
    else if (ct === 0) { r = g = bl = s[i]; }
    else if (ct === 4) { r = g = bl = s[i * 2]; a = s[i * 2 + 1]; }
    else { const k = s[i]; r = plte[k * 3]; g = plte[k * 3 + 1]; bl = plte[k * 3 + 2]; a = trns && k < trns.length ? trns[k] : 255; }
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = bl; px[i * 4 + 3] = a;
  }
  return { w, h, ct, px };
}

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
export function encode(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
export const save = (path, w, h, px) => writeFileSync(path, encode(w, h, px));
