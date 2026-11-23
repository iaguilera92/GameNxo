import { decode, save } from '../frontend/tools/png-lite.mjs';
const bg = decode('respaldo_oficial/ambientes/ambiente-3-1254-v2.png'), sh = decode('respaldo_oficial/ambientes/ambiente-3-figuras-alpha.png');
const fr = decode('frente-a3.png'); const W = bg.w, k = 1536 / 1254, cw = sh.w / 8, ch = sh.h / 4;
const mk = (tint) => {
  const p = Buffer.from(bg.px);
  // auto (fila r) con los pies en (x,y) de 1254 y alto h (px 1254) del más alto; muestreo por caja
  const car = (r, x, y, h) => {
    const s = h / (ch * 0.62); const w = cw * s, hh = ch * s;
    for (let j = 0; j < hh; j++) for (let i = 0; i < w; i++) {
      let a = 0, R = 0, G = 0, B = 0, n = 0;
      for (let v = 0; v < 1 / s; v++) for (let u = 0; u < 1 / s; u++) { const sx = Math.floor(i / s + u), sy = Math.floor(r * ch + j / s + v); const d = (sy * sh.w + sx) * 4; const al = sh.px[d + 3]; a += al; R += sh.px[d] * al; G += sh.px[d+1] * al; B += sh.px[d+2] * al; n++; }
      if (!a) continue; const X = Math.round(x - w / 2 + i), Y = Math.round(y - hh + j + 0.12 * hh), d = (Y * W + X) * 4, al = a / n / 255;
      const c = [R / a, G / a, B / a].map((v, q) => v * tint[q]);
      for (let q = 0; q < 3; q++) p[d + q] = p[d + q] * (1 - al) + c[q] * al;
    }
  };
  const H = (x) => (34 + 101 * (502 - x * k) / 747) / k * 0.95;
  car(0, 335, 274, H(335)); car(2, 255, 300, H(255)); car(3, 150, 337, H(150));
  for (let y = 0; y < fr.h; y++) for (let x = 0; x < fr.w; x++) { const d = (y * fr.w + x) * 4; if (fr.px[d + 3]) fr.px.copy(p, ((150 + y) * W + x) * 4, d, d + 4); }
  return p;
};
const z = 2, [vx, vy, vw, vh] = [60, 170, 380, 220]; const out = Buffer.alloc(vw * z * vh * 2 * z * 4);
[[1, 1, 1], [0.78, 0.66, 0.86]].forEach((t, n) => { const p = mk(t); for (let y = 0; y < vh * z; y++) for (let x = 0; x < vw * z; x++) { const s = ((vy + Math.floor(y / z)) * W + vx + Math.floor(x / z)) * 4, d = ((n * vh * z + y) * vw * z + x) * 4; p.copy(out, d, s, s + 4); out[d + 3] = 255; } });
save('para-chatgpt/a3-autos-real.png', vw * z, vh * 2 * z, out); console.log('ok');
