// Convierte imágenes con transparencia entre .webp y .png usando Chrome headless (Node no lee ni escribe webp y el
// proyecto no trae dependencias de imagen). El formato de salida sale de la extensión.
//   node tools/convert-image.mjs <entrada.webp> <salida.png>        fuente webp -> png (las herramientas de hojas leen PNG)
//   node tools/convert-image.mjs <entrada.png> <salida.webp> [0.92]  hoja procesada -> webp con alfa (calidad 0..1)
// Necesita Google Chrome instalado (ruta por defecto de Windows o la variable CHROME).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [inp, out, q = '0.92'] = process.argv.slice(2);
if (!inp || !out) throw new Error('uso: node tools/convert-image.mjs <entrada> <salida.png|salida.webp> [calidad webp]');
const mime = out.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png';
const quality = Math.min(1, Math.max(0, Number(q)));
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ud = mkdtempSync(join(tmpdir(), 'webp2png-'));
// puerto al azar: con uno fijo, un Chrome huérfano de una corrida anterior respondía en su lugar y devolvía otra imagen
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
  if (!page) throw new Error('no se pudo abrir Chrome');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pend = new Map();
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Page.enable');
  await send('Page.navigate', { url: pathToFileURL(resolve(inp)).href });
  await sleep(1500);
  const r = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const img = document.images[0];
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      return { w: c.width, h: c.height, url: c.toDataURL(${JSON.stringify(mime)}, ${quality}) };
    })()`,
  });
  const v = r.result?.result?.value;
  if (!v?.url) throw new Error('no se pudo convertir: ' + JSON.stringify(r.result));
  writeFileSync(out, Buffer.from(v.url.split(',')[1], 'base64'));
  console.log(`${inp} -> ${out} (${v.w}x${v.h})`);
} finally {
  ws?.close();
  // Chrome lanza procesos hijos: se cierra todo el árbol para no dejar instancias escuchando
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}
