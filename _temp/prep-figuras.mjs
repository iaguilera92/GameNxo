// Quita el fondo de tablero (falsa transparencia) de ambiente-2-figuras: relleno desde el borde sobre gris claro neutro.
import { decode, save } from '../frontend/tools/png-lite.mjs';
const [src, out] = process.argv.slice(2);
const im = decode(src); const { w, h } = im; const p = im.px;
const bgLike = (i) => { const r=p[i*4],g=p[i*4+1],b=p[i*4+2]; return Math.max(r,g,b)-Math.min(r,g,b) <= Number(process.env.CHROMA ?? 8) && Math.min(r,g,b) >= Number(process.env.MINV ?? 222); };
const bg = new Uint8Array(w*h); const st = [];
for (let x=0;x<w;x++){st.push(x, (h-1)*w+x);} for (let y=0;y<h;y++){st.push(y*w, y*w+w-1);}
while (st.length) { const i = st.pop(); if (bg[i] || !bgLike(i)) continue; bg[i]=1; const x=i%w, y=(i/w)|0;
  if (x>0) st.push(i-1); if (x<w-1) st.push(i+1); if (y>0) st.push(i-w); if (y<h-1) st.push(i+w); }
// huecos cerrados (entre brazo y cuerpo): componentes de tablero de mas de 400 px con los dos tonos del tablero
const seen = new Uint8Array(w*h); let holes = 0;
for (let s=0;s<w*h;s++) { if (bg[s]||seen[s]||!bgLike(s)) continue; const comp=[s]; seen[s]=1; let lo=0, hi=0;
  for (let k=0;k<comp.length;k++){ const i=comp[k]; const v=p[i*4]; if (v<243) lo++; else hi++; const x=i%w,y=(i/w)|0;
    for (const j of [x>0?i-1:-1, x<w-1?i+1:-1, y>0?i-w:-1, y<h-1?i+w:-1]) if (j>=0&&!seen[j]&&!bg[j]&&bgLike(j)){seen[j]=1;comp.push(j);} }
  if (comp.length > 400 && lo > comp.length*0.2 && hi > comp.length*0.2) { for (const i of comp) bg[i]=1; holes++; } }
const o = Buffer.from(p);
for (let i=0;i<w*h;i++) { if (bg[i]) { o[i*4+3]=0; continue; }
  // borde suave: gris claro pegado al fondo
  const x=i%w,y=(i/w)|0; const near = (x>0&&bg[i-1])||(x<w-1&&bg[i+1])||(y>0&&bg[i-w])||(y<h-1&&bg[i+w]);
  if (near) { const r=p[i*4],g=p[i*4+1],b=p[i*4+2]; if (Math.max(r,g,b)-Math.min(r,g,b) <= 14 && Math.min(r,g,b) > 150) o[i*4+3] = Math.round(255*Math.max(0,(222-Math.min(r,g,b)))/72); } }
save(out, w, h, o); console.log('huecos', holes);

