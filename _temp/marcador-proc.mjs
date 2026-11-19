// Uso puntual (marcador de misiones): analiza el alfa de un PNG, o lo recorta y reduce con Chrome headless.
//   node marcador-proc.mjs info <entrada.png>
//   node marcador-proc.mjs crop <entrada.png> <salida.png> <x> <y> <w> <h> <anchoFinal>
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, inp, out, ...nums] = process.argv.slice(2);
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ud = mkdtempSync(join(tmpdir(), 'marc-'));
const port = 20000 + Math.floor(Math.random() * 30000);
const proc = spawn(chrome, ['--headless=new', '--allow-file-access-from-files', `--remote-debugging-port=${port}`, `--user-data-dir=${ud}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
try {
  let page;
  for (let i = 0; i < 50 && !page; i++) {
    try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
    if (!page) await sleep(200);
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pend = new Map();
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(resolve(mode === 'info' ? inp : inp)).href });
  await sleep(1500);
  const [cx, cy, cw, ch, fw] = nums.map(Number);
  const expr = mode === 'info'
    ? `(async () => {
      const img = document.images[0]; await img.decode();
      const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext('2d'); g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const W = c.width, H = c.height;
      const px = (x, y) => Array.from(d.slice((y * W + x) * 4, (y * W + x) * 4 + 4));
      let minA = 255, nT = 0, nO = 0, x0 = W, y0 = H, x1 = -1, y1 = -1;
      // "contenido" = alfa > 8 y no blanco puro
      let cx0 = W, cy0 = H, cx1 = -1, cy1 = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4; const a = d[i + 3];
        if (a < 255) nT++; else nO++;
        if (a > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        const white = d[i] > 245 && d[i + 1] > 245 && d[i + 2] > 245;
        if (a > 8 && !white) { if (x < cx0) cx0 = x; if (x > cx1) cx1 = x; if (y < cy0) cy0 = y; if (y > cy1) cy1 = y; }
      }
      return { W, H, corners: [px(0, 0), px(W - 1, 0), px(0, H - 1), px(W - 1, H - 1), px(W >> 1, 5)], semiOTransparentes: nT, opacos: nO, bboxAlfa: [x0, y0, x1, y1], bboxNoBlanco: [cx0, cy0, cx1, cy1] };
    })()`
    : `(async () => {
      const img = document.images[0]; await img.decode();
      const k = ${fw} / ${cw};
      const c = document.createElement('canvas'); c.width = ${fw}; c.height = Math.round(${ch} * k);
      const g = c.getContext('2d'); g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(img, ${cx}, ${cy}, ${cw}, ${ch}, 0, 0, c.width, c.height);
      return { w: c.width, h: c.height, url: c.toDataURL('image/png') };
    })()`;
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: expr });
  const v = r.result?.result?.value;
  if (!v) throw new Error(JSON.stringify(r.result));
  if (mode === 'info') console.log(JSON.stringify(v));
  else { writeFileSync(out, Buffer.from(v.url.split(',')[1], 'base64')); console.log(`${out} ${v.w}x${v.h}`); }
} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}
