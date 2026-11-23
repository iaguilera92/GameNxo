import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]);
const br = (x, y) => { const i = (y * im.w + x) * 4; return im.px[i] > 205 && im.px[i + 1] > 175; };
for (const x of [60, 120, 180, 240, 300, 330, 924, 954, 1014, 1074, 1134, 1194]) { const ys = []; for (let y = 240; y < 600; y++) if (br(x, y) && !br(x, y - 1)) ys.push(y); console.log(x, ys.join(',')); }

