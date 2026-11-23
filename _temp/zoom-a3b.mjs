import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-3-1254-v2.png'); const W = im.w;
const [cx, cy, cw, ch, z] = [0, 200, 260, 280, 3];
const o = Buffer.alloc(cw * z * ch * z * 4);
for (let y = 0; y < ch * z; y++) for (let x = 0; x < cw * z; x++) {
  const X = cx + Math.floor(x / z), Y = cy + Math.floor(y / z); const s = (Y * W + X) * 4, d = (y * cw * z + x) * 4;
  im.px.copy(o, d, s, s + 4);
  if ((X % 10 === 0 && x % z === 0) || (Y % 10 === 0 && y % z === 0)) { const m = (X % 50 === 0 && x % z === 0) || (Y % 50 === 0 && y % z === 0); o[d] = m ? 255 : 120; o[d+1] = m ? 0 : 120; o[d+2] = m ? 0 : 120; }
}
save('para-chatgpt/a3-zoom2.png', cw * z, ch * z, o); console.log('ok');


