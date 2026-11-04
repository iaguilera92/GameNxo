// Prueba temporal: jugador (cuerpo+brazo) sobre la cancha, a la escala y perspectiva del juego.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const A = new URL('../public/assets/characters/', import.meta.url);

function decode(path) {
  const b = readFileSync(path);
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') w = data.readUInt32BE(0), (h = data.readUInt32BE(4));
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), st = w * 4, px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) {
      const a = x >= 4 ? px[y * st + x - 4] : 0, u = y > 0 ? px[(y - 1) * st + x] : 0, c = y > 0 && x >= 4 ? px[(y - 1) * st + x - 4] : 0;
      let v = raw[y * (st + 1) + 1 + x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      px[y * st + x] = v & 255;
    }
  }
  return { w, h, px };
}
const body = decode(new URL('player_back_body.png', A));
const arm = decode(new URL('player_back_arm.png', A));

// calibración (igual que src/characters/skins.ts, vista back del player)
const CHAR_UNITS_H = 150, PAD = 8;
const B = { ox: 262.5, oy: 998, scale: CHAR_UNITS_H / 991 };
const ARM = { ox: 95, oy: 498, scale: 0.058, angle: -16.8 };
const SH = { x: 16.4, y: -68.6 };
void PAD;

// --- lienzo = recorte de cancha (proyección aproximada del juego)
const CW = 760, CH = 1000;
const img = Buffer.alloc(CW * CH * 4);
const setbg = (x, y, r, g, b) => { const i = (y * CW + x) * 4; img[i] = r; img[i + 1] = g; img[i + 2] = b; img[i + 3] = 255; };
for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) { const t = y / CH; setbg(x, y, 0x1d + t * 0x0d, 0x5e + t * 0x16, 0x86 + t * 0x3a); }
// pista en perspectiva
const nearY = 880, farY = 300, cx = CW / 2;
const halfAt = (y) => 150 + ((y - farY) / (nearY - farY)) * 180;
for (let y = farY; y <= nearY; y++) { const hw = halfAt(y) * 1.27, t = (y - farY) / (nearY - farY); for (let x = Math.floor(cx - hw); x <= cx + hw; x++) if (x >= 0 && x < CW) setbg(x, y, 0x2f + t * 0x1b, 0x78 + t * 0x24, 0xdc); }
const wline = (y, k) => { const hw = halfAt(y) * k; for (let x = cx - hw; x <= cx + hw; x++) for (let t = 0; t < 3; t++) setbg(Math.floor(x), y + t, 255, 255, 255); };
const vline = (k) => { for (let y = farY; y <= nearY; y++) for (let t = 0; t < 3; t++) { const x = Math.floor(cx + halfAt(y) * k + t - 1); if (x >= 0 && x < CW) setbg(x, y, 255, 255, 255); } };
wline(farY, 1.27); wline(nearY, 1.27);
for (const k of [-1.27, -1, 1, 1.27]) vline(k);
const netY = farY + (nearY - farY) * 0.45;
for (let x = cx - halfAt(netY) * 1.35; x <= cx + halfAt(netY) * 1.35; x++) { for (let t = 0; t < 70; t++) { const i = (Math.floor(netY - t) * CW + Math.floor(x)) * 4; img[i] = img[i] * 0.45 + 0x2b * 0.55; img[i + 1] = img[i + 1] * 0.45 + 0x2b * 0.55; img[i + 2] = img[i + 2] * 0.45 + 0x40 * 0.55; } for (let t = 0; t < 5; t++) setbg(Math.floor(x), Math.floor(netY - 70 + t), 255, 255, 255); }

const blend = (x, y, s, si, a = 1) => {
  if (x < 0 || y < 0 || x >= CW || y >= CH) return;
  const al = (s[si + 3] / 255) * a; if (al <= 0) return;
  const i = (y * CW + x) * 4;
  for (let k = 0; k < 3; k++) img[i + k] = img[i + k] * (1 - al) + s[si + k] * al;
};
function draw(src, ox, oy, k, deg, X, Y, flip) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r), R = Math.hypot(src.w, src.h) * k;
  for (let y = Math.floor(Y - R); y < Y + R; y++) for (let x = Math.floor(X - R); x < X + R; x++) {
    let dx = (x + 0.5 - X) / k, dy = (y + 0.5 - Y) / k;
    if (flip) dx = -dx;
    const u = Math.floor(c * dx + s * dy + ox), v = Math.floor(-s * dx + c * dy + oy);
    if (u < 0 || v < 0 || u >= src.w || v >= src.h) continue;
    blend(x, y, src.px, (v * src.w + u) * 4);
  }
}
// escala en pantalla por unidad, según la perspectiva del jugador (cerca de la línea de fondo)
function placePlayer(X, Y, s, armAngle, facing) {
  // sombra
  for (let y = -6 * s; y <= 6 * s; y++) for (let x = -34 * s; x <= 34 * s; x++) if ((x * x) / (34 * s) ** 2 + (y * y) / (6 * s) ** 2 <= 1) blend(X + x, Y + y, [0, 0, 0, 255], 0, 0.3);
  const flip = facing < 0;
  draw(body, B.ox, B.oy, B.scale * s, 0, X, Y, flip);
  const sx = X + SH.x * s * (flip ? -1 : 1);
  const sy = Y + SH.y * s;
  draw(arm, ARM.ox, ARM.oy, ARM.scale * s, (armAngle - ARM.angle) * (flip ? -1 : 1), sx, sy, flip);
}
// jugador cerca (grande) en pose de reposo mirando la pelota, y una instancia más al fondo corriendo
placePlayer(cx - 120, nearY - 20, 2.0, -60, 1);
placePlayer(cx + 150, farY + 180, 1.15, 150, -1);
// pelota
for (let y = -10; y <= 10; y++) for (let x = -10; x <= 10; x++) if (x * x + y * y <= 100) blend(cx + 40 + x, netY + 40 + y, [0xd7, 0xf5, 0x3a, 255], 0);

const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc((CW * 4 + 1) * CH);
for (let y = 0; y < CH; y++) Buffer.from(img.buffer, y * CW * 4, CW * 4).copy(raw, y * (CW * 4 + 1) + 1);
const ih = Buffer.alloc(13); ih.writeUInt32BE(CW, 0); ih.writeUInt32BE(CH, 4); ih[8] = 8; ih[9] = 6;
writeFileSync(new URL('./match-test.png', import.meta.url), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('ok');
