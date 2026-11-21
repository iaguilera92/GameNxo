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
  await send('Page.navigate', { url: pathToFileURL(resolve('frontend/public/assets/dinero-virtual-3.png')).href }); await sleep(600);
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const img = document.images[0]; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const id = x.getImageData(0, 0, W, H); const d = id.data;
    const corner = [d[3], d[(W-1)*4+3], d[((H-1)*W)*4+3]]; const cornerRGB=[d[0],d[1],d[2]];
    const bg = (i) => { const k=i*4; if (d[k+3]<20) return true; return d[k]>238 && d[k+1]>238 && d[k+2]>238; };
    const seen = new Uint8Array(W*H); const st=[];
    for (let i=0;i<W;i++){ st.push(i, (H-1)*W+i); } for (let j=0;j<H;j++){ st.push(j*W, j*W+W-1); }
    while (st.length) { const i=st.pop(); if (seen[i] || !bg(i)) continue; seen[i]=1; const px=i%W, py=(i/W)|0; if(px>0)st.push(i-1); if(px<W-1)st.push(i+1); if(py>0)st.push(i-W); if(py<H-1)st.push(i+W); }
    let x0=W,y0=H,x1=0,y1=0;
    for (let q=0;q<W*H;q++){ if(seen[q]) d[q*4+3]=0; else { const px=q%W,py=(q/W)|0; if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py; } }
    x.putImageData(id,0,0);
    const cw=x1-x0+1, ch=y1-y0+1; const sc=Math.min(1, 512/Math.max(cw,ch));
    const o=document.createElement('canvas'); o.width=Math.round(cw*sc); o.height=Math.round(ch*sc);
    const ox=o.getContext('2d'); ox.imageSmoothingQuality='high'; ox.drawImage(c,x0,y0,cw,ch,0,0,o.width,o.height);
    return { corner, cornerRGB, box:[x0,y0,x1,y1], w:o.width, h:o.height, data:o.toDataURL('image/webp',0.92) };
  })()` });
  const v = r.result.result.value;
  (await import('node:fs')).writeFileSync('frontend/public/assets/dinero-virtual-3.webp', Buffer.from(v.data.split(',')[1], 'base64'));
  console.log(JSON.stringify({corner:v.corner,rgb:v.cornerRGB,box:v.box,w:v.w,h:v.h}));} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}


