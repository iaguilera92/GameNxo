// Temporal: recorta las piezas recibidas, las copia a src/assets/characters con nombre estándar
// y genera una composición de prueba (cuerpo + brazo girado) para calibrar el hombro.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DL = join(homedir(), 'Downloads');
const OUT = new URL('../public/assets/characters/', import.meta.url);
const REF = new URL('../art/reference/', import.meta.url);
mkdirSync(OUT, { recursive: true });
mkdirSync(REF, { recursive: true });

const PIECES = [
  { src: 'Joven tenista chibi de espaldas.png', dst: 'player_back_body.png' },
  { src: 'Brazo caricaturesco con raqueta azul y amarilla.png', dst: 'player_back_arm.png' },
  { src: 'Brazo de tenista con raqueta azul y amarilla.png', dst: 'player_front_arm.png' },
  // referencias: no se empaquetan en la app
  { src: 'Chico caricaturesco con corona dorada.png', dst: 'player_back_full.png', ref: true },
  { src: 'Joven tenista con raqueta y corona.png', dst: 'player_front_full.png', ref: true },
];
const PAD = 8;

function decode(path) {
  const b = readFileSync(path);
  let p = 8, w = 0, h = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const type = b.toString('ascii', p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); if (data[8] !== 8 || data[9] !== 6) throw new Error('se esperaba RGBA 8 bits: ' + path); }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const st = w * 4;
  const px = Buffer.alloc(h * st);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)];
    for (let x = 0; x < st; x++) {
      const a = x >= 4 ? px[y * st + x - 4] : 0;
      const u = y > 0 ? px[(y - 1) * st + x] : 0;
      const c = y > 0 && x >= 4 ? px[(y - 1) * st + x - 4] : 0;
      let v = raw[y * (st + 1) + 1 + x];
      if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1;
      else if (f === 4) { const q = a + u - c, pa = Math.abs(q - a), pb = Math.abs(q - u), pc = Math.abs(q - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      px[y * st + x] = v & 255;
    }
  }
  return { w, h, px };
}
const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
function encode(w, h, px) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
function crop(img) {
  const { w, h, px } = img;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (px[(y * w + x) * 4 + 3] > 8) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  x0 = Math.max(0, x0 - PAD); y0 = Math.max(0, y0 - PAD); x1 = Math.min(w - 1, x1 + PAD); y1 = Math.min(h - 1, y1 + PAD);
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  const out = Buffer.alloc(cw * ch * 4);
  for (let y = 0; y < ch; y++) px.copy(out, y * cw * 4, ((y + y0) * w + x0) * 4, ((y + y0) * w + x1 + 1) * 4);
  return { w: cw, h: ch, px: out, x0, y0 };
}

const done = {};
for (const p of PIECES) {
  const c = crop(decode(join(DL, p.src)));
  writeFileSync(new URL(p.dst, p.ref ? REF : OUT), encode(c.w, c.h, c.px));
  done[p.dst] = c;
  console.log(`${p.src} -> ${p.dst}  ${c.w}x${c.h}  (recorte desde ${c.x0},${c.y0})`);
}

// ---------------------------------------------------------------- composición de prueba
// Valores a calibrar (coordenadas en píxeles de las imágenes ya recortadas)
const META = JSON.parse(process.argv[2] ?? '{}');
const body = done['player_back_body.png'];
const arm = done['player_back_arm.png'];
const B = { ox: META.bx ?? 262.5, oy: META.by ?? 998, scale: 150 / 991 }; // pies; 150 unidades de alto
const A = { ox: META.ax ?? 95, oy: META.ay ?? 498, scale: META.as ?? 0.058, angle: META.aa ?? -16.8 }; // hombro
const SH = { x: META.sx ?? 16.4, y: META.sy ?? -68.6 }; // hombro en unidades desde los pies

const CW = 1120, CH = 520, U = 2.1; // px de vista por unidad
const img = Buffer.alloc(CW * CH * 4);
for (let i = 0; i < CW * CH; i++) { img[i * 4] = 0x2f; img[i * 4 + 1] = 0x78; img[i * 4 + 2] = 0xdc; img[i * 4 + 3] = 255; }
const blend = (x, y, s, si) => {
  if (x < 0 || y < 0 || x >= CW || y >= CH) return;
  const a = s[si + 3] / 255; if (a <= 0) return;
  const i = (y * CW + x) * 4;
  for (let k = 0; k < 3; k++) img[i + k] = img[i + k] * (1 - a) + s[si + k] * a;
};
/** dibuja `src` con escala `k` (px vista / px fuente), rotado `deg` alrededor de su origen (ox,oy) colocado en (X,Y) */
function draw(src, ox, oy, k, deg, X, Y) {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const R = Math.hypot(src.w, src.h) * k;
  for (let y = Math.floor(Y - R); y < Y + R; y++) for (let x = Math.floor(X - R); x < X + R; x++) {
    const dx = (x + 0.5 - X) / k, dy = (y + 0.5 - Y) / k;
    const u = Math.floor(c * dx + s * dy + ox), v = Math.floor(-s * dx + c * dy + oy);
    if (u < 0 || v < 0 || u >= src.w || v >= src.h) continue;
    blend(x, y, src.px, (v * src.w + u) * 4);
  }
}
// poses: reposo (-60), carga (-115), golpe (150) — mismos ángulos que las animaciones actuales
[-60, -115, 150].forEach((ang, i) => {
  const fx = 190 + i * 370, fy = 480;
  draw(body, B.ox, B.oy, B.scale * U, 0, fx, fy);
  draw(arm, A.ox, A.oy, A.scale * U, ang - A.angle, fx + SH.x * U, fy + SH.y * U);
  for (let d = -3; d <= 3; d++) { blend(fx + SH.x * U + d, fy + SH.y * U, [255, 0, 0, 255], 0); blend(fx + SH.x * U, fy + SH.y * U + d, [255, 0, 0, 255], 0); }
});
writeFileSync(new URL('./skin-test.png', import.meta.url), encode(CW, CH, img));
console.log('preview ok');


