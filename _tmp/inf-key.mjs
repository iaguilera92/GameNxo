import { decode, save } from '../frontend/tools/png-lite.mjs';
import os from 'os';
const S = decode(process.argv[2] || (os.homedir() + '/Downloads/pj-nxo-inferno.png'));
const o = Buffer.alloc(S.w * S.h * 4);
for (let i = 0; i < o.length; i += 4) {
  const r = S.px[i], g = S.px[i + 1], b = S.px[i + 2], m = Math.max(r, b), d = g - m;
  const a = d > 70 ? 0 : d < 25 ? 255 : Math.round(255 * (70 - d) / 45);
  if (a > 0 && a < 255) { const k = a / 255, u = (v, bg) => Math.max(0, Math.min(255, Math.round((v - (1 - k) * bg) / k))); o[i] = u(r, 0); o[i + 1] = Math.min(u(g, 255), Math.max(u(r, 0), u(b, 0))); o[i + 2] = u(b, 0); } else { o[i] = r; o[i + 1] = d > 0 ? m : g; o[i + 2] = b; } o[i + 3] = a;
}
save(process.argv[3] || 'public/personajes/Nxo/pj-nxo-sprite-inferno.png', S.w, S.h, o);
console.log(S.w, S.h);



