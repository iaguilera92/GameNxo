import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode('respaldo_oficial/ambientes/ambiente-1-1254-cancha-nueva.png');
for (const x of [450, 627, 800]) { let out=[]; for (let y = 200; y < 320; y+=2) { const i=(y*im.w+x)*4; out.push(y+':'+im.px[i]+','+im.px[i+1]+','+im.px[i+2]); } console.log('x',x,out.join(' ')); }
