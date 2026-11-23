// Endereza los muros laterales de un ambiente 2v2 (1254x1254) fila por fila para que su pie caiga sobre la guia.
// Cada fila se estira o desplaza en horizontal: el muro y el pasillo de cada lado se mueven juntos (sin cuÃ±a) y el piso
// verde entre el pie y el centro se reparte lineal. Las filas de arriba (paseo, muro del fondo) no se tocan.
// node enderezar-2v2.mjs <in.png> <out.png> '<{"L":[x352,pendiente],"R":[x352,pendiente]}>'
//   pendiente = cuanto se abre el pie por cada px que baja (fuente, medido con edge3)
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [inp, out, srcArg] = process.argv.slice(2);
const im = decode(inp);
const W = im.w, H = im.h, o = Buffer.from(im.px);
const src = JSON.parse(srcArg.endsWith('.json') ? (await import('node:fs')).readFileSync(srcArg, 'utf8') : srcArg);
const FOOT = 352, Y0 = 200, Y1 = 250, CX = W / 2; // de Y0 a Y1 la correccion entra de a poco
const GL = [259, (259 - 0) / (969 - 352)], GR = [995, (1254 - 995) / (969 - 352)];
const footAt = ([x0, m], y, side) => x0 + side * m * (Math.max(y, FOOT) - FOOT);
const sample = (x, y) => {
  x = Math.min(W - 1.001, Math.max(0, x));
  const x0 = Math.floor(x), fx = x - x0, i = (y * W + x0) * 4, r = [0, 0, 0, 0];
  for (let k = 0; k < 4; k++) r[k] = im.px[i + k] * (1 - fx) + im.px[i + 4 + k] * fx;
  return r;
};
for (let y = Y0; y < H; y++) {
  const t = Math.min(1, (y - Y0) / (Y1 - Y0));
  // pie fuente y pie destino de cada lado en esta fila
  const sL = footAt(src.L, y, -1), sR = footAt(src.R, y, 1);
  const tL = sL + (footAt(GL, y, -1) - sL) * t, tR = sR + (footAt(GR, y, 1) - sR) * t;
  for (let x = 0; x < W; x++) {
    let sx;
    if (x <= tL) sx = tL >= sL && tL > 1 ? (x * sL) / tL : x - (tL - sL); // muro izq: estirar si entra, desplazar si sale
    else if (x >= tR) sx = tR <= sR && W - tR > 1 ? W - ((W - x) * (W - sR)) / (W - tR) : x - (tR - sR);
    else if (x < CX) sx = sL + ((x - tL) * (CX - sL)) / (CX - tL);
    else sx = CX + ((x - CX) * (sR - CX)) / (tR - CX);
    const c = sample(sx, y), d = (y * W + x) * 4;
    for (let k = 0; k < 4; k++) o[d + k] = Math.round(c[k]);
  }
}
save(out, W, H, o);
console.log('ok', out);
