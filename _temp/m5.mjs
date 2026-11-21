// Mide el bounding box NO transparente de cada arte de la pantalla LIGA (fracciones de su alto/ancho), para colocar por el dibujo
// y no por la caja (las imÃ¡genes traen mucho padding). Uso: node ../_temp/bbox-liga.mjs  (desde frontend/). Necesita Chrome.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const FILES = ['fondo-liga', 'pestanas-liga', 'pestanas-liga-2v2', 'escenario-liga', 'cards-stats', 'panel-recompensa', 'botones-liga', 'titulo-lideres', 'podio-liga', 'btn-top100'];
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ud = mkdtempSync(join(tmpdir(), 'bbox-'));
const port = 20000 + Math.floor(Math.random() * 30000);
const proc = spawn(chrome, ['--headless=new', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${ud}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let page;
  for (let i = 0; i < 50 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {} if (!page) await sleep(200); }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(resolve('frontend/public/assets/tienda-pj.png')).href }); await sleep(500);
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const img = document.images[0]; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, W, H); const d = id.data;
    const bg = (i) => { const k=i*4; const r=d[k],g=d[k+1],b=d[k+2]; return Math.min(r,g,b)>185 && Math.max(r,g,b)-Math.min(r,g,b)<14; };
    const seen = new Uint8Array(W*H); const st=[];
    for (let i=0;i<W;i++){ st.push(i, (H-1)*W+i); } for (let j=0;j<H;j++){ st.push(j*W, j*W+W-1); }
    while (st.length) { const i=st.pop(); if (seen[i] || !bg(i)) continue; seen[i]=1; const px=i%W, py=(i/W)|0; if(px>0)st.push(i-1); if(px<W-1)st.push(i+1); if(py>0)st.push(i-W); if(py<H-1)st.push(i+W); }
    // anillo de 1 px junto al fondo: se suaviza (alfa a la mitad) para que el borde no quede dentado
    for (let j=1;j<H-1;j++) for (let i=1;i<W-1;i++){ const q=j*W+i; if(seen[q]) continue; if(seen[q-1]||seen[q+1]||seen[q-W]||seen[q+W]) { const k=q*4; const lum=(d[k]+d[k+1]+d[k+2])/3; if(lum>150) seen[q]=2; } }
    let x0=W,y0=H,x1=0,y1=0;
    for (let q=0;q<W*H;q++){ if(seen[q]===1){ d[q*4+3]=0; } else if(seen[q]===2){ d[q*4+3]=0; } else { const px=q%W,py=(q/W)|0; if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py; } }
    x.putImageData(id,0,0);
    const pad=2; x0=Math.max(0,x0-pad); y0=Math.max(0,y0-pad); x1=Math.min(W-1,x1+pad); y1=Math.min(H-1,y1+pad);
    const o=document.createElement('canvas'); o.width=x1-x0+1; o.height=y1-y0+1; o.getContext('2d').drawImage(c,x0,y0,o.width,o.height,0,0,o.width,o.height);
    return { box:[x0,y0,x1,y1], w:o.width, h:o.height, data:o.toDataURL('image/webp',0.92) };
  })()` });
  const v = r.result.result.value;
  (await import('node:fs')).writeFileSync('frontend/public/assets/tienda-pj.webp', Buffer.from(v.data.split(',')[1], 'base64'));
  console.log(JSON.stringify({box:v.box,w:v.w,h:v.h}));} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}


