import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode(process.env.SRC ?? '../_temp/respaldo_oficial/ambientes/ambiente-3-1254.png');
const [x0,y0,x1,y1,k] = process.argv.slice(2,7).map(Number); const W=(x1-x0)*k, H=(y1-y0)*k, o=Buffer.alloc(W*H*4);
for(let y=0;y<H;y++)for(let x=0;x<W;x++){const sx=x0+Math.floor(x/k), sy=y0+Math.floor(y/k); const i=(sy*im.w+sx)*4, d=(y*W+x)*4; let r=im.px[i],g=im.px[i+1],b=im.px[i+2];
 if(!process.env.NOGRID&&((sx%50===0)||(sy%50===0))){r=255;g=0;b=255;} o[d]=r;o[d+1]=g;o[d+2]=b;o[d+3]=255;}
save(process.argv[7],W,H,o);

