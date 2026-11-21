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
  await send('Page.navigate', { url: pathToFileURL(resolve('frontend/public/assets/characters/nxo-front-inferno/inferno-swing.webp')).href }); await sleep(500);
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
    const img = document.images[0]; await img.decode();
    const S=5; const c = document.createElement('canvas'); c.width = 212*S; c.height = 174*S;
    const x = c.getContext('2d'); x.fillStyle='#444'; x.fillRect(0,0,c.width,c.height); x.imageSmoothingEnabled=true; x.drawImage(img, 212*3,0,212,174, 0,0,212*S,174*S);
    x.strokeStyle='rgba(255,255,255,0.5)'; x.fillStyle='#fff'; x.font='14px sans-serif';
    for(let i=0;i<=212;i+=20){x.beginPath();x.moveTo(i*S,0);x.lineTo(i*S,c.height);x.stroke();x.fillText(i,i*S+2,12);}
    for(let j=0;j<=174;j+=20){x.beginPath();x.moveTo(0,j*S);x.lineTo(c.width,j*S);x.stroke();x.fillText(j,2,j*S-2);}
    return c.toDataURL('image/png');
  })()` });
  (await import('node:fs')).writeFileSync('_temp/_f3.png', Buffer.from(r.result.result.value.split(',')[1], 'base64'));} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}


