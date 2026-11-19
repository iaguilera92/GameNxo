// Uso puntual (retrato de Net sobre verde croma): quita el verde con el MISMO croma de frontend/tools/build-hd.mjs, con Chrome headless.
//   node retrato-croma.mjs <entrada.png> <salida.png>
// Salida: PNG con alfa, una vista previa sobre azul (<salida>-prev.png) y la caja visible (alfa > 8).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [inp, out] = process.argv.slice(2);
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ud = mkdtempSync(join(tmpdir(), 'crm-'));
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
  console.error('A conectado'); await send('Page.enable'); console.error('B enable');
  await send('Page.navigate', { url: pathToFileURL(resolve(inp)).href });
  await sleep(1500); console.error('C navegado');
  const expr = `(async () => {
    const img = document.images[0]; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H); const px = id.data;
    // croma de build-hd.mjs
    for (let i = 0; i < px.length; i += 4) {
      const r = px[i], gg = px[i + 1], b = px[i + 2];
      const m = Math.max(r, b);
      const d = gg - m;
      if (d > 60) { px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0; }
      else if (d > 12) { px[i + 1] = Math.min(gg, m); px[i + 3] = Math.round(255 * (1 - (d - 12) / 48)); }
      else if (d > 0) px[i + 1] = m;
    }
    g.putImageData(id, 0, 0);
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (px[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const pc = document.createElement('canvas'); pc.width = W; pc.height = H;
    const pg = pc.getContext('2d'); pg.fillStyle = '#2f7fe0'; pg.fillRect(0, 0, W, H); pg.drawImage(c, 0, 0);
    return { W, H, box: [x0, y0, x1, y1], url: c.toDataURL('image/png'), prev: pc.toDataURL('image/png') };
  })()`;
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: expr });
  const v = r.result?.result?.value;
  if (!v) throw new Error(JSON.stringify(r.result));
  writeFileSync(out, Buffer.from(v.url.split(',')[1], 'base64'));
  writeFileSync(out.replace(/\.png$/, '-prev.png'), Buffer.from(v.prev.split(',')[1], 'base64'));
  console.log(JSON.stringify({ out, W: v.W, H: v.H, box: v.box }));
} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}

