import { decode, save } from '../tools/png-lite.mjs';
import { readdirSync } from 'node:fs';
const dir='public/assets/characters/nxo-v2/'; const names=process.argv.slice(2);
const imgs=names.map(n=>decode(dir+n+'.png')); const W=imgs[0].w, H=imgs[0].h; const out=Buffer.alloc(W*H*names.length*4);
imgs.forEach((im,k)=>{ for(let y=0;y<H;y++)for(let x=0;x<W;x++){const s=(y*W+x)*4,d=((k*H+y)*W+x)*4; const a=im.px[s+3]/255; const bg=(Math.floor(x/200)%2)?[60,70,90]:[80,90,110]; let c=[0,1,2].map(j=>Math.round(im.px[s+j]*a+bg[j]*(1-a))); if(y===133) c=[255,0,0]; if(x%200===100 && y%4<2) c=[255,255,0]; out[d]=c[0];out[d+1]=c[1];out[d+2]=c[2];out[d+3]=255;}});
save('_tmp/contact.png',W,H*names.length,out);
