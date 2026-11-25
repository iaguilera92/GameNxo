import fs from 'fs';
const f='frontend/src/scenes/OnboardingScene.ts';
let s=fs.readFileSync(f,'utf8').replace(/\r\n/g,'\n');
const a=s.indexOf("    const [th, ts, tv] = hue;\n    for (let i = 0;");
const b=s.indexOf("    ctx.putImageData(img, 0, 0);");
if(a<0||b<0||s.indexOf("    const [th, ts, tv] = hue;\n    for (let i = 0;",a+1)>=0) throw 'nf';
const nw=`    const [th, ts, tv] = hue;
    let dh = th - 355; // giro de tono desde el rojo de la ficha
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
      if (dl < 0.02) continue;
      let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
      h *= 60;
      if (h < 0) h += 360;
      const sat = dl / mx;
      const dist = Math.min(Math.abs(h - 355), 360 - Math.abs(h - 355));
      // peso suave: hacia el naranja se corta pronto (el borde dorado no cambia); hacia el morado, degradado
      const wh = h < 180 ? (h <= 12 ? 1 : h >= 22 ? 0 : 1 - (h - 12) / 10) : dist <= 30 ? 1 : dist >= 70 ? 0 : 1 - (dist - 30) / 40;
      const wsat = sat <= 0.12 ? 0 : sat >= 0.3 ? 1 : (sat - 0.12) / 0.18;
      const w = wh * wsat;
      if (w <= 0) continue;
      // se GIRA el tono (conserva los degradados); saturación y brillo según el color
      const nh = (((h + dh * w) % 360) + 360) % 360;
      const ns = Math.min(1, sat * (1 + (ts - 1) * w));
      const nv = Math.min(1, mx * (1 + (tv - 1) * w));
      const c = nv * ns, x = c * (1 - Math.abs(((nh / 60) % 2) - 1)), m = nv - c;
      const [rr, gg, bb] = nh < 60 ? [c, x, 0] : nh < 120 ? [x, c, 0] : nh < 180 ? [0, c, x] : nh < 240 ? [0, x, c] : nh < 300 ? [x, 0, c] : [c, 0, x];
      d[i] = (rr + m) * 255;
      d[i + 1] = (gg + m) * 255;
      d[i + 2] = (bb + m) * 255;
    }
`;
s=s.slice(0,a)+nw+s.slice(b);
fs.writeFileSync(f,s);console.log('ok');
