// Replica EXACTA del render del menú (vista front, reposo ang=0) con varios hombros alrededor del actual.
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';
const A = new URL('../public/assets/characters/', import.meta.url);
const ID = process.argv[2] || 'nxo';
function decode(path){let b=readFileSync(path),p=8,w=0,h=0,idat=[];while(p<b.length){const len=b.readUInt32BE(p),t=b.toString('ascii',p+4,p+8),d=b.subarray(p+8,p+8+len);if(t==='IHDR')w=d.readUInt32BE(0),h=d.readUInt32BE(4);if(t==='IDAT')idat.push(d);p+=12+len;}const raw=inflateSync(Buffer.concat(idat)),st=w*4,px=Buffer.alloc(h*st);for(let y=0;y<h;y++){const f=raw[y*(st+1)];for(let x=0;x<st;x++){const a=x>=4?px[y*st+x-4]:0,u=y>0?px[(y-1)*st+x]:0,c=y>0&&x>=4?px[(y-1)*st+x-4]:0;let v=raw[y*(st+1)+1+x];if(f===1)v+=a;else if(f===2)v+=u;else if(f===3)v+=(a+u)>>1;else if(f===4){const q=a+u-c,pa=Math.abs(q-a),pb=Math.abs(q-u),pc=Math.abs(q-c);v+=pa<=pb&&pa<=pc?a:pb<=pc?u:c;}px[y*st+x]=v&255;}}return{w,h,px};}
const PAD=8,CH=150;
const body=decode(new URL(`${ID}_front_body.png`,A)),arm=decode(new URL(`${ID}_front_arm.png`,A));
const bscale=CH/(body.h-PAD*2);
const elbow={ox:arm.w*0.03,oy:arm.h*0.84};
const U=2.7, CW=1200, CH2=640;
const img=Buffer.alloc(CW*CH2*4);for(let i=0;i<CW*CH2;i++){img[i*4]=0x12;img[i*4+1]=0x25;img[i*4+2]=0x4f;img[i*4+3]=255;}
const blend=(x,y,s,si,a=1)=>{if(x<0||y<0||x>=CW||y>=CH2)return;const al=(s[si+3]/255)*a;if(al<=0)return;const i=(y*CW+x)*4;for(let k=0;k<3;k++)img[i+k]=img[i+k]*(1-al)+s[si+k]*al;};
function drawImg(src,ox,oy,k,deg,X,Y){const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);const R=Math.hypot(src.w,src.h)*k;for(let y=Math.floor(Y-R);y<Y+R;y++)for(let x=Math.floor(X-R);x<X+R;x++){const dx=(x+.5-X)/k,dy=(y+.5-Y)/k;const u=Math.floor(c*dx+s*dy+ox),v=Math.floor(-s*dx+c*dy+oy);if(u<0||v<0||u>=src.w||v>=src.h)continue;blend(x,y,src.px,(v*src.w+u)*4);}}
// candidatos alrededor del hombro actual (40,-104)
const SHs=[[40,-104],[48,-108],[54,-110],[46,-116],[52,-118]];
SHs.forEach((SH,i)=>{const fx=130+i*230,fy=600;
  drawImg(body,body.w/2,body.h-PAD,bscale*U,0,fx,fy);
  const sx=fx+SH[0]*U,sy=fy+SH[1]*U;
  drawImg(arm,elbow.ox,elbow.oy,bscale*U,0,sx,sy); // reposo ang=0 (raqueta levantada, pose menú)
  for(let d=-4;d<=4;d++){blend(sx+d,sy,[255,60,60,255],0);blend(sx,sy+d,[255,60,60,255],0);}
  for(let b=0;b<=i;b++)for(let yy=0;yy<10;yy++)for(let xx=0;xx<10;xx++)blend(fx-40+b*14+xx,14+yy,[255,210,60,255],0);
});
const crcT=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});const crc=b=>{let c=0xffffffff;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return(c^0xffffffff)>>>0;};const chunk=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c]);};
const raw=Buffer.alloc((CW*4+1)*CH2);for(let y=0;y<CH2;y++)Buffer.from(img.buffer,y*CW*4,CW*4).copy(raw,y*(CW*4+1)+1);const ih=Buffer.alloc(13);ih.writeUInt32BE(CW,0);ih.writeUInt32BE(CH2,4);ih[8]=8;ih[9]=6;
writeFileSync(new URL('./menu-pose.png',import.meta.url),Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ih),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]));console.log('SHs:',JSON.stringify(SHs));

