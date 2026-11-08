import { decode, save } from '../tools/png-lite.mjs';
const S = decode('_tmp/mai-sprites-1-antes.png'); const out = Buffer.from(S.px);
const I = decode('_tmp/mai-fila6.png');
const isBg = (p, i) => p[i + 1] - Math.max(p[i], p[i + 2]) > 60;
function bbox(J, x0, x1, y0, y1) { let a=1e9,b=1e9,c=-1,d=-1; for (let y=y0;y<y1;y++) for (let x=x0;x<=x1;x++) if (!isBg(J.px,(y*J.w+x)*4)) {a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);} return {x0:a,y0:b,x1:c,y1:d}; }
// referencia: alto del idle (fila 1, frame 1) y pies
const ref = bbox(S, 0, 191, 0, 128); const refH = ref.y1 - ref.y0, feet = ref.y1;
console.log('ref', ref);
const occ = new Array(I.w).fill(0);
for (let x=0;x<I.w;x++) for (let y=0;y<I.h;y++) if (!isBg(I.px,(y*I.w+x)*4)) occ[x]++;
let segs=[],st=-1; for (let x=0;x<=I.w;x++){const on=x<I.w&&occ[x]>2; if(on&&st<0)st=x; if(!on&&st>=0){segs.push([st,x-1]);st=-1;}}
segs=segs.filter(r=>r[1]-r[0]>12); console.log('segs',segs.length);
const b0 = bbox(I, segs[0][0], segs[0][1], 0, I.h); const s = refH/(b0.y1-b0.y0), base=b0.y1;
const oy = 5*128;
for (let y=0;y<128;y++) for (let x=0;x<S.w;x++){const i=((oy+y)*S.w+x)*4; out[i]=0;out[i+1]=255;out[i+2]=0;}
segs.forEach((sg,c)=>{ const bb=bbox(I,sg[0],sg[1],0,I.h); const cx=(bb.x0+bb.x1)/2;
 for (let y=0;y<128;y++) for (let x=0;x<192;x++){ const fx=cx+(x-96)/s, fy=base+(y-feet)/s;
  const xa=Math.floor(fx-0.5/s),xb=Math.ceil(fx+0.5/s),ya=Math.floor(fy-0.5/s),yb=Math.ceil(fy+0.5/s);
  let R=0,G=0,B=0,n=0;
  for (let yy=ya;yy<=yb;yy++) for (let xx=xa;xx<=xb;xx++){ if(xx<sg[0]-2||xx>sg[1]+2||yy<0||yy>=I.h){G+=255;n++;continue;} const i=(yy*I.w+xx)*4;R+=I.px[i];G+=I.px[i+1];B+=I.px[i+2];n++;}
  const i=((oy+y)*S.w+c*192+x)*4; out[i]=R/n;out[i+1]=G/n;out[i+2]=B/n; }
 const nb=bbox({w:S.w,h:S.h,px:out},c*192,c*192+191,oy,oy+128); if(nb.x0<=c*192||nb.x1>=c*192+191||nb.y0<=oy||nb.y1>=oy+127) console.log('toca borde',c+1,nb);
});
save('public/personajes/Mai/pj-mai-sprites-1.png', S.w, S.h, out);
