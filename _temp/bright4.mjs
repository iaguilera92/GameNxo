import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]);
const br = (x, y) => { const i = (y * im.w + x) * 4; return im.px[i] > 205 && im.px[i + 1] > 175; };
for (const x of [240,250,260,270,280,290,300,310,320,330,924,934,944,954,964,974,984,994,1004,1014]) { const ys = []; for (let y = 230; y < 480; y++) if (br(x, y) && !br(x, y - 1)) ys.push(y); console.log(x, ys.join(',')); }

