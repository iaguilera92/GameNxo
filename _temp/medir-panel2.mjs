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
  const load = async (f) => {
    await send('Page.navigate', { url: pathToFileURL(resolve(f)).href });
    await sleep(500);
  };
  await load('frontend/public/assets/liga/panel-recompensa.webp');
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const img = document.images[0]; await img.decode();
    const oi = new Image(); oi.src = 'file:///C:/Users/IAGUILERA/Documents/00%20Trabajos/GameNxo/_temp/liga/panel-recompensa-con-cofre-antes.webp'; await oi.decode();
    const oc = document.createElement('canvas'); oc.width=oi.naturalWidth; oc.height=oi.naturalHeight; const ox = oc.getContext('2d',{willReadFrequently:true}); ox.drawImage(oi,0,0); window.__old = ox.getImageData(0,0,oc.width,oc.height).data;
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, c.width, c.height).data; const W = c.width, H = c.height;
    // flood fill del interior oscuro desde (272,333)
    const dark = (i) => { const k=i*4; return d[k+3]>200 && d[k]<110 && d[k+1]<60 && d[k+2]<30; };
    const seen = new Uint8Array(W*H); const st=[333*W+272]; seen[333*W+272]=1;
    let n=0,sx=0,sy=0,x0=W,x1=0,y0=H,y1=0;
    while(st.length){const i=st.pop();const px=i%W,py=(i/W)|0;n++;sx+=px;sy+=py;if(px<x0)x0=px;if(px>x1)x1=px;if(py<y0)y0=py;if(py>y1)y1=py;
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=px+dx,ny=py+dy;if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(!seen[j]&&dark(j)){seen[j]=1;st.push(j);}}}
    // radio interior: distancia mínima del centroide a un pixel NO oscuro del borde
    const cx=sx/n, cy=sy/n; let minR=1e9;
    for(let j=y0-2;j<=y1+2;j++)for(let i=x0-2;i<=x1+2;i++){ if(!seen[j*W+i]){ const dd=Math.hypot(i-cx,j-cy); if(dd<minR)minR=dd; } }
    // diferencia con el panel anterior fuera del circulo (x>520)
    const o = window.__old; let diff=0,cnt=0,maxd=0,dx0=W,dx1=0,dy0=H,dy1=0;
    for(let j=0;j<H;j++)for(let i=520;i<W;i++){const k=(j*W+i)*4;const dd=Math.abs(d[k]-o[k])+Math.abs(d[k+1]-o[k+1])+Math.abs(d[k+2]-o[k+2])+Math.abs(d[k+3]-o[k+3]);diff+=dd;cnt++;if(dd>60){if(i<dx0)dx0=i;if(i>dx1)dx1=i;if(j<dy0)dy0=j;if(j>dy1)dy1=j;}}
    return { fill:{n,x0,x1,y0,y1,cx,cy,minR,eqR:Math.sqrt(n/Math.PI)}, meanDiff: diff/cnt, bigDiffBox:[dx0,dy0,dx1,dy1] };
  })()` });
  console.log(JSON.stringify(r.result.result.value ?? r.result));} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}



