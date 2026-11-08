import {decode} from '../tools/png-lite.mjs';
const S=decode('public/personajes/Nxo/pj-nxo-sprites-4.png');
const bg=(p,i)=>p[i+1]-Math.max(p[i],p[i+2])>60;
const occ=[];for(let y=0;y<S.h;y++){let n=0;for(let x=0;x<S.w;x++)if(!bg(S.px,(y*S.w+x)*4))n++;occ.push(n)}
let st=-1;for(let y=0;y<=S.h;y++){const on=y<S.h&&occ[y]>3;if(on&&st<0)st=y;if(!on&&st>=0){console.log('banda',st,y-1);st=-1}}
