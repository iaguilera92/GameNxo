import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]);
const br = (x, y) => { const i = (y * im.w + x) * 4; return im.px[i] > 205 && im.px[i + 1] > 175; };
for (const x of [20,60,100,140,180,220,260,300,954,994,1034,1074,1114,1154,1194,1234]) { const ys = []; for (let y = 170; y < 600; y++) if (br(x, y) && !br(x, y - 1)) ys.push(y); console.log(x, ys.join(',')); }

