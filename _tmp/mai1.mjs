import { decode, save } from '../tools/png-lite.mjs';
const A = decode('_tmp/mai-sprites-1-antes.png'), N = decode('_tmp/mai-fila6.png');
const out = Buffer.alloc(A.w*A.h*4); for (let i=0;i<out.length;i+=4){out[i]=0;out[i+1]=255;out[i+2]=0;out[i+3]=255;}
const bg=(p,i)=>p[i+1]-Math.max(p[i],p[i+2])>60;
function bbox(J,x0,x1,y0,y1){let a=1e9,b=1e9,c=-1,d=-1;for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++)if(!bg(J.px,(y*J.w+x)*4)){a=Math.min(a,x);b=Math.min(b,y);c=Math.max(c,x);d=Math.max(d,y);}return{x0:a,y0:b,x1:c,y1:d};}
function segs(J,y0,y1){const o=new Array(J.w).fill(0);for(let x=0;x<J.w;x++)for(let y=y0;y<=y1;y++)if(!bg(J.px,(y*J.w+x)*4))o[x]++;const r=[];let st=-1;for(let x=0;x<=J.w;x++){const on=x<J.w&&o[x]>2;if(on&&st<0)st=x;if(!on&&st>=0){r.push([st,x-1]);st=-1;}}return r.filter(q=>q[1]-q[0]>12);}
const bands=[[11,127],[140,253],[264,379],[385,506],[520,632],[642,756],[769,884],[898,1016]];
const REF=111, FEET=122, S0=REF/(bands[0][1]-bands[0][0]);
function put(J,y0,y1,row,s,tag){const sg=segs(J,y0,y1);console.log(tag,row+1,'segs',sg.length);
 sg.slice(0,8).forEach((q,c)=>{const bb=bbox(J,q[0],q[1],y0,y1),cx=(bb.x0+bb.x1)/2,base=bb.y1;
  for(let y=0;y<128;y++)for(let x=0;x<192;x++){const fx=cx+(x-96)/s,fy=base+(y-FEET)/s;
   const xa=Math.floor(fx-.5/s),xb=Math.ceil(fx+.5/s),ya=Math.floor(fy-.5/s),yb=Math.ceil(fy+.5/s);let R=0,G=0,B=0,n=0;
   for(let yy=ya;yy<=yb;yy++)for(let xx=xa;xx<=xb;xx++){if(xx<q[0]-2||xx>q[1]+2||yy<y0||yy>y1){G+=255;n++;continue;}const i=(yy*J.w+xx)*4;R+=J.px[i];G+=J.px[i+1];B+=J.px[i+2];n++;}
   const i=((row*128+y)*A.w+c*192+x)*4;out[i]=R/n;out[i+1]=G/n;out[i+2]=B/n;}
  const nb=bbox({w:A.w,px:out},c*192,c*192+191,row*128,row*128+127);
  if(nb.x0<=c*192||nb.x1>=c*192+191||nb.y0<=row*128||nb.y1>=row*128+127)console.log('borde',row+1,c+1);});}
bands.forEach((b,r)=>{ if(r===5) return; put(A,b[0],b[1],r,S0,'A'); });
const nb=bbox(N,segs(N,0,N.h-1)[0][0],segs(N,0,N.h-1)[0][1],0,N.h-1);
put(N,0,N.h-1,5,REF/(nb.y1-nb.y0),'N');
save('public/personajes/Mai/pj-mai-sprites-1.png',A.w,A.h,out);
