// nuevo algoritmo (suave): peso por tono y saturación, el tono se GIRA (conserva los degradados)
import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ui/perfil-pj.png');
const HUES = { nxo: null, mai: [335, 0.85, 1.15], jun: [25, 1, 1.2], mat: [130, 0.95, 0.95], zac: [50, 1, 1.35], net: [275, 0.95, 1.1], isa: [315, 1, 1.05], rin: [195, 0.95, 1.3], flo: [178, 0.85, 0.95] };
export function recolor(r, g, b, hue) {
  const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), dl = mx - mn;
  if (dl < 0.02) return [r, g, b];
  let h = mx === R ? ((G - B) / dl) % 6 : mx === G ? (B - R) / dl + 2 : (R - G) / dl + 4;
  h *= 60; if (h < 0) h += 360;
  const sat = dl / mx;
  const dist = Math.min(Math.abs(h - 355), 360 - Math.abs(h - 355)); // distancia al rojo de la ficha
  // hacia el naranja / dorado se corta pronto (el borde dorado de la caja de la pasiva no cambia); hacia el morado, suave
  const wh = h < 180 ? (h <= 12 ? 1 : h >= 22 ? 0 : 1 - (h - 12) / 10) : dist <= 30 ? 1 : dist >= 70 ? 0 : 1 - (dist - 30) / 40;
  const ws = sat <= 0.12 ? 0 : sat >= 0.3 ? 1 : (sat - 0.12) / 0.18;
  const w = wh * ws;
  if (w <= 0) return [r, g, b];
  const [th, ts, tv] = hue;
  let d = th - 355; if (d > 180) d -= 360; if (d < -180) d += 360;
  const nh = (((h + d * w) % 360) + 360) % 360;
  const ns = Math.min(1, sat * (1 + (ts - 1) * w));
  const nv = Math.min(1, mx * (1 + (tv - 1) * w));
  const c = nv * ns, x = c * (1 - Math.abs(((nh / 60) % 2) - 1)), m = nv - c;
  const [rr, gg, bb] = nh < 60 ? [c, x, 0] : nh < 120 ? [x, c, 0] : nh < 180 ? [0, c, x] : nh < 240 ? [0, x, c] : nh < 300 ? [x, 0, c] : [c, 0, x];
  return [(rr + m) * 255, (gg + m) * 255, (bb + m) * 255];
}
const q = 4, w = Math.floor(im.w / q), h = Math.floor(im.h / q), ids = Object.keys(HUES), cols = 3, rows = Math.ceil(ids.length / cols);
const out = Buffer.alloc(w * cols * h * rows * 4);
ids.forEach((id, n) => {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y * q) * im.w + x * q) * 4; const a = im.px[s + 3];
    let [r, g, b] = [im.px[s], im.px[s + 1], im.px[s + 2]];
    if (HUES[id] && a) [r, g, b] = recolor(r, g, b, HUES[id]);
    const ox = (n % cols) * w + x, oy = Math.floor(n / cols) * h + y, d = (oy * w * cols + ox) * 4, k = a / 255;
    out[d] = r * k + 255 * (1 - k); out[d + 1] = g * k + 255 * (1 - k); out[d + 2] = b * k + 255 * (1 - k); out[d + 3] = 255;
  }
});
save('para-chatgpt/fichas-colores3.png', w * cols, h * rows, out); console.log('ok');
