// Uso puntual (retrato de Nxo sobre fondo negro): quita el fondo negro con Chrome headless.
//   node retrato-black.mjs info  <entrada.png>
//   node retrato-black.mjs clean <entrada.png> <salida.png> [T=12] [T2=36] [Tin=3] [minIn=300]
// info: componentes casi negros (max canal <= Tin) que NO tocan el borde (huecos cerrados) y los que sí.
// clean: 1) borra el fondo (flood-fill desde el borde sobre pixeles con max canal <= T), con borde suave hasta T2;
//        2) borra tambien los huecos cerrados de negro puro (max canal <= Tin) con al menos minIn pixeles (p. ej. dentro de la raqueta).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [mode, inp, out, T = '12', T2 = '36', Tin = '3', minIn = '60', region = '0,0,0,0'] = process.argv.slice(2);
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ud = mkdtempSync(join(tmpdir(), 'blk-'));
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
  await send('Page.navigate', { url: pathToFileURL(resolve(inp)).href });
  await sleep(1500);
  const expr = `(async () => {
    const T = ${Number(T)}, T2 = ${Number(T2)}, Tin = ${Number(Tin)}, minIn = ${Number(minIn)}, MODE = ${JSON.stringify(mode)};
    const img = document.images[0]; await img.decode();
    const W = img.naturalWidth, H = img.naturalHeight;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const id = g.getImageData(0, 0, W, H); const d = id.data;
    const mx = (p) => Math.max(d[p * 4], d[p * 4 + 1], d[p * 4 + 2]);
    // 1) fondo: flood-fill desde el borde sobre pixeles con max <= T
    const bg = new Uint8Array(W * H);
    const stack = new Int32Array(W * H); let sp = 0;
    const push = (p) => { if (!bg[p] && mx(p) <= T) { bg[p] = 1; stack[sp++] = p; } };
    for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
    for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
    while (sp) { const p = stack[--sp]; const x = p % W, y = (p / W) | 0;
      if (x > 0) push(p - 1); if (x < W - 1) push(p + 1); if (y > 0) push(p - W); if (y < H - 1) push(p + W); }
    let nBg = 0; for (let p = 0; p < W * H; p++) nBg += bg[p];
    // 2) componentes cerrados de negro puro (max <= Tin) que no son fondo
    const seen = new Uint8Array(W * H); const comps = [];
    for (let s = 0; s < W * H; s++) {
      if (seen[s] || bg[s] || mx(s) > Tin) continue;
      let n = 0, x0 = W, y0 = H, x1 = 0, y1 = 0; sp = 0; stack[sp++] = s; seen[s] = 1; const members = [];
      while (sp) { const p = stack[--sp]; members.push(p); n++; const x = p % W, y = (p / W) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        const nb = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
        for (const q of nb) if (q >= 0 && !seen[q] && !bg[q] && mx(q) <= Tin) { seen[q] = 1; stack[sp++] = q; } }
      comps.push({ n, bbox: [x0, y0, x1, y1], members });
    }
    comps.sort((a, b) => b.n - a.n);
    if (MODE === 'info') return { W, H, nBg, closed: comps.slice(0, 25).map((k) => ({ n: k.n, bbox: k.bbox })), nClosed: comps.length };
    // 3) aplicar: fondo transparente con borde suave; huecos cerrados grandes transparentes
    for (let p = 0; p < W * H; p++) {
      if (bg[p]) { d[p * 4 + 3] = 0; continue; }
    }
    // borde suave: pixeles NO fondo pegados al fondo, con max entre T y T2, ganan alfa proporcional
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const p = y * W + x; if (bg[p]) continue;
      if (!(bg[p - 1] || bg[p + 1] || bg[p - W] || bg[p + W])) continue;
      const m = mx(p); if (m >= T2) continue;
      d[p * 4 + 3] = Math.round(255 * Math.max(0, (m - T) / (T2 - T)));
    }
    let nIn = 0;
    // solo los huecos dentro de la region (la malla de la raqueta): el resto del negro cerrado (pupilas, pelo) se queda
    const R = ${JSON.stringify(region.split(',').map(Number))};
    for (const k of comps) {
      const b = k.bbox;
      if (k.n >= minIn && b[0] >= R[0] && b[1] >= R[1] && b[2] <= R[2] && b[3] <= R[3]) { nIn += k.n; for (const p of k.members) d[p * 4 + 3] = 0; }
    }
    g.putImageData(id, 0, 0);
    // caja visible
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const pc = document.createElement('canvas'); pc.width = W; pc.height = H;
    const pg = pc.getContext('2d'); pg.fillStyle = '#2f7fe0'; pg.fillRect(0, 0, W, H); pg.drawImage(c, 0, 0);
    return { W, H, nBg, nIn, box: [x0, y0, x1, y1], url: c.toDataURL('image/png'), prev: pc.toDataURL('image/png') };
  })()`;
  const r = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: expr });
  const v = r.result?.result?.value;
  if (!v) throw new Error(JSON.stringify(r.result));
  if (mode === 'info') console.log(JSON.stringify(v));
  else {
    writeFileSync(out, Buffer.from(v.url.split(',')[1], 'base64'));
    writeFileSync(out.replace(/\.png$/, '-prev.png'), Buffer.from(v.prev.split(',')[1], 'base64'));
    console.log(JSON.stringify({ out, W: v.W, H: v.H, nBg: v.nBg, nIn: v.nIn, box: v.box }));
  }
} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}
