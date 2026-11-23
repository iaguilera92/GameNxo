import { decode } from '../frontend/tools/png-lite.mjs';
const im = decode(process.argv[2]);
const at=(x,y)=>{const i=(y*im.w+x)*4;return [im.px[i],im.px[i+1],im.px[i+2]].join(',')};
let s=[];for(let x=0;x<40;x+=3)s.push(at(x,5));console.log('top',s.join(' '));
s=[];for(let y=0;y<40;y+=3)s.push(at(5,y));console.log('left',s.join(' '));
console.log('mid gap',at(165,600),at(170,300),at(680,310),at(60,930));
console.log('dog fur',at(90,1060),at(260,1050));
