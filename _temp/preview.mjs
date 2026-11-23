import { decode, save } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]); const o=Buffer.alloc(im.w*im.h*4);
for(let i=0;i<im.w*im.h;i++){const a=im.px[i*4+3]/255;o[i*4]=im.px[i*4]*a+200*(1-a);o[i*4+1]=im.px[i*4+1]*a;o[i*4+2]=im.px[i*4+2]*a+200*(1-a);o[i*4+3]=255;}
save(process.argv[3],im.w,im.h,o);
