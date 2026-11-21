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
  for (const f of ['_temp/liga/panel-recompensa-con-cofre-antes.webp','frontend/public/assets/liga/panel-recompensa.webp']) {
    await send('Page.navigate', { url: pathToFileURL(resolve(f)).href }); await sleep(500);
    const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const img = document.images[0]; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data; const W=c.width;
      const gold=(i,j)=>{const k=(j*W+i)*4;return d[k+3]>200&&d[k]>235&&d[k+1]>150&&d[k+2]<110;};
      const runs=(j,x0,x1)=>{const o=[];let s=-1;for(let i=x0;i<=x1;i++){const g=gold(i,j);if(g&&s<0)s=i;if(!g&&s>=0){o.push([s,i-1]);s=-1;}}return o.filter(r=>r[1]-r[0]>=0);};
      const vruns=(i,y0,y1)=>{const o=[];let s=-1;for(let j=y0;j<=y1;j++){const g=gold(i,j);if(g&&s<0)s=j;if(!g&&s>=0){o.push([s,j-1]);s=-1;}}return o;};
      // etiqueta amarilla: caja de pixeles muy amarillos (r>240,g>190,b<60) en x>1500,y<260
      let tx0=W,tx1=0,ty0=999,ty1=0;
      for(let j=100;j<260;j++)for(let i=1500;i<2000;i++){const k=(j*W+i)*4;if(d[k+3]>200&&d[k]>240&&d[k+1]>190&&d[k+2]<70){if(i<tx0)tx0=i;if(i>tx1)tx1=i;if(j<ty0)ty0=j;if(j>ty1)ty1=j;}}
      // linea del titulo (borde inferior de la franja): columna x=900, dorados
      return { row390: runs(390,1300,1960), col1650: vruns(1650,250,520), col1403: vruns(1403,250,520), col1380: vruns(1380,250,520), col900: vruns(900,200,280), tag:[tx0,ty0,tx1,ty1] };
    })()` });
    console.log(f); console.log(JSON.stringify(r.result.result.value));
  }} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}




