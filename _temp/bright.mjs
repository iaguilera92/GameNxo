import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode('_warp1.png');
const br = (x, y) => { const i = (y * im.w + x) * 4; return im.px[i] > 205 && im.px[i + 1] > 175; };
for (const x of [250, 270, 290, 310, 330, 924, 944, 964, 984, 1004]) { const ys = []; for (let y = 240; y < 520; y++) if (br(x, y) && !br(x, y - 1)) ys.push(y); console.log(x, ys.join(',')); }
