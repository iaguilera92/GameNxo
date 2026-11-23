import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]);
for (const x of [500, 627, 760]) { let s=[]; for (let y=190;y<335;y+=3){const i=(y*im.w+x)*4; s.push(y+':'+im.px[i]+','+im.px[i+1]+','+im.px[i+2]);} console.log('x'+x, s.join(' ')); }
