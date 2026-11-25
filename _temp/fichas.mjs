// vista previa del cambio de color de la ficha (mismo algoritmo que OnboardingScene.cardTexture), a 1/4
import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ui/perfil-pj.png');
const HUES = { nxo: null, mai: [335, 0.85, 1.15], jun: [25, 1, 1.2], mat: [130, 0.95, 0.95], zac: [50, 1, 1.35], net: [275, 0.95, 1.1], isa: [315, 1, 1.05], rin: [195, 0.95, 1.3], flo: [178, 0.85, 0.95] };
const q = 4, w = Math.floor(im.w / q), h = Math.floor(im.h / q), ids = Object.keys(HUES), cols = 3, rows = Math.ceil(ids.length / cols);
const out = Buffer.alloc(w * cols * h * rows * 4);
ids.forEach((id, n) => {
  const hue = HUES[id];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((y * q) * im.w + x * q) * 4; let r = im.px[s], g = im.px[s + 1], b = im.px[s + 2]; const a = im.px[s + 3];
    if (hue && a) {
      const R = r / 255, G = g / 255, B = b / 255, mx = Math.max(R, G, B), mn = Math.min(R, G, B), dl = mx - mn;
      if (dl >= 0.08 && mx === R) { let hh = (((G - B) / dl) % 6) * 60; if (hh < 0) hh += 360; const sat = dl / mx;
        if ((hh >= 320 || hh <= 25) && sat >= 0.25) { const [th, ts, tv] = hue; const ns = Math.min(1, sat * ts), nv = Math.min(1, mx * tv); const c = nv * ns, xx = c * (1 - Math.abs(((th / 60) % 2) - 1)), m = nv - c;
          const [rr, gg, bb] = th < 60 ? [c, xx, 0] : th < 120 ? [xx, c, 0] : th < 180 ? [0, c, xx] : th < 240 ? [0, xx, c] : th < 300 ? [xx, 0, c] : [c, 0, xx]; r = (rr + m) * 255; g = (gg + m) * 255; b = (bb + m) * 255; } } }
    const ox = (n % cols) * w + x, oy = Math.floor(n / cols) * h + y, d = (oy * w * cols + ox) * 4;
    const k = a / 255; out[d] = r * k + 255 * (1 - k); out[d + 1] = g * k + 255 * (1 - k); out[d + 2] = b * k + 255 * (1 - k); out[d + 3] = 255;
  }
});
save('para-chatgpt/fichas-colores.png', w * cols, h * rows, out); console.log(ids.join(' '));
