// MARCOS DEL PERFIL (card del perfil del menú): corta la hoja public/personajes/Marcos/marcos-ranked.png (6 marcos, 2 columnas x 3 filas) en un
// WebP con transparencia por liga: public/assets/marcos/<liga>.webp, y escribe src/ui/profile-frames.json con el cuerpo de cada marco.
// Uso (desde frontend/):  node tools/build-profile-frames.mjs [debug]
// La hoja trae fondo blanco y sombras difusas: el exterior es lo que se alcanza desde el borde del recorte sin cruzar el contorno
// del marco (zona de poco cambio de color). Necesita Google Chrome (como convert-image.mjs).
import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// SET=2v2 corta la hoja de los marcos de la LIGA 2v2 (marcos-ranked-2v2.png -> public/assets/marcos2v2/ y src/ui/profile-frames-2v2.json)
const SET = process.env.SET === '2v2' ? '2v2' : '1v1';
const SRC = SET === '2v2' ? 'public/personajes/Marcos/marcos-ranked-2v2.png' : 'public/personajes/Marcos/marcos-ranked.png'; // fuente (public/personajes no entra al APK)
const OUT = SET === '2v2' ? 'public/assets/marcos2v2' : 'public/assets/marcos';
const JSON_OUT = SET === '2v2' ? 'profile-frames-2v2.json' : 'profile-frames.json';
// celda de cada marco en la hoja (x, y, w, h) y su cuerpo (rectángulo que coincide con la card; fuera de él sobresalen alas / corona)
// `body` se rellena tras mirar el recorte (coordenadas de la hoja); sin body = todo el recorte
const CELLS = SET === '2v2' ? [
  { id: 'bronze', cell: [10, 70, 720, 270] },
  { id: 'silver', cell: [725, 70, 723, 270] },
  { id: 'gold', cell: [10, 345, 720, 270] },
  { id: 'platinum', cell: [725, 345, 723, 270] },
  { id: 'diamond', cell: [0, 625, 730, 320] },
  { id: 'challenger', cell: [725, 610, 723, 340] },
] : [
  { id: 'bronze', cell: [10, 60, 750, 290] },
  { id: 'silver', cell: [770, 60, 760, 290] },
  { id: 'gold', cell: [10, 345, 750, 280] },
  { id: 'platinum', cell: [770, 345, 760, 280] },
  { id: 'diamond', cell: [0, 625, 770, 320] },
  { id: 'challenger', cell: [765, 615, 771, 340] },
];
// cuerpo de cada marco dentro de su WebP (px): el rect?ngulo que coincide con la card; alas y corona sobresalen. Sin entrada = todo el WebP
const BODY = SET === '2v2' ? {
  diamond: { x: 26, y: 16, w: 646, h: 222 },
  challenger: { x: 34, y: 44, w: 638, h: 208 },
} : {
  diamond: { x: 24, y: 18, w: 696, h: 214 },
  challenger: { x: 26, y: 42, w: 693, h: 221 },
};
const THR = Number(process.env.THR ?? 38); // cambio de color entre vecinos que cuenta como contorno
const debug = process.argv[2] === 'debug';

const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ud = mkdtempSync(join(tmpdir(), 'frames-'));
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
  await send('Page.navigate', { url: pathToFileURL(resolve(SRC)).href });
  await sleep(1500);
  const r = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const CELLS = ${JSON.stringify(CELLS)}, THR = ${THR};
      const img = document.images[0];
      await img.decode();
      const out = [];
      for (const { id, cell } of CELLS) {
        const [cx, cy, cw, ch] = cell;
        const c = document.createElement('canvas');
        c.width = cw; c.height = ch;
        const x = c.getContext('2d', { willReadFrequently: true });
        x.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
        const im = x.getImageData(0, 0, cw, ch);
        const d = im.data;
        const n = cw * ch;
        // contorno: cambio fuerte de color con el vecino de la derecha o de abajo (y su vecino, para cerrar huecos de 1 px)
        const edge = new Uint8Array(n);
        for (let j = 0; j < ch - 1; j++) for (let i = 0; i < cw - 1; i++) {
          const p = (j * cw + i) * 4, q = p + 4, s = p + cw * 4;
          const g = Math.abs(d[p] - d[q]) + Math.abs(d[p + 1] - d[q + 1]) + Math.abs(d[p + 2] - d[q + 2]);
          const h = Math.abs(d[p] - d[s]) + Math.abs(d[p + 1] - d[s + 1]) + Math.abs(d[p + 2] - d[s + 2]);
          if (g > THR || h > THR) { edge[j * cw + i] = 1; edge[j * cw + i + 1] = 1; edge[(j + 1) * cw + i] = 1; }
        }
        // exterior: inundación desde el borde del recorte por lo que no es contorno
        const ext = new Uint8Array(n);
        const st = [];
        const push = (i, j) => { const k = j * cw + i; if (!ext[k] && !edge[k]) { ext[k] = 1; st.push(k); } };
        for (let i = 0; i < cw; i++) { push(i, 0); push(i, ch - 1); }
        for (let j = 0; j < ch; j++) { push(0, j); push(cw - 1, j); }
        while (st.length) {
          const k = st.pop(), i = k % cw, j = (k - i) / cw;
          if (i > 0) push(i - 1, j); if (i < cw - 1) push(i + 1, j); if (j > 0) push(i, j - 1); if (j < ch - 1) push(i, j + 1);
        }
        // solo se queda el trozo m?s grande de lo que no es exterior (el marco): las motas sueltas de la sombra se descartan
        const lab = new Int32Array(n);
        let best = 0, bestN = 0, nl = 0;
        for (let k0 = 0; k0 < n; k0++) {
          if (ext[k0] || lab[k0]) continue;
          nl++;
          let cnt = 0;
          const q = [k0];
          lab[k0] = nl;
          while (q.length) {
            const k = q.pop(), i = k % cw, j = (k - i) / cw;
            cnt++;
            if (i > 0 && !ext[k - 1] && !lab[k - 1]) { lab[k - 1] = nl; q.push(k - 1); }
            if (i < cw - 1 && !ext[k + 1] && !lab[k + 1]) { lab[k + 1] = nl; q.push(k + 1); }
            if (j > 0 && !ext[k - cw] && !lab[k - cw]) { lab[k - cw] = nl; q.push(k - cw); }
            if (j < ch - 1 && !ext[k + cw] && !lab[k + cw]) { lab[k + cw] = nl; q.push(k + cw); }
          }
          if (cnt > bestN) { bestN = cnt; best = nl; }
        }
        for (let k = 0; k < n; k++) if (lab[k] !== best) ext[k] = 1;
        // interior: lo azul marino del centro se vuelve transparente (la card pone su propio fondo debajo)
        {
          const c0 = Math.floor(ch / 2) * cw + Math.floor(cw / 2);
          const navy = (k) => { const p = k * 4; return d[p] < 70 && d[p + 1] < 80 && d[p + 2] < 120; };
          if (!ext[c0] && navy(c0)) {
            const q = [c0];
            const seen = new Uint8Array(n);
            seen[c0] = 1;
            while (q.length) {
              const k = q.pop(), i = k % cw, j = (k - i) / cw;
              ext[k] = 1;
              for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const ni = i + di, nj = j + dj;
                if (ni < 0 || nj < 0 || ni >= cw || nj >= ch) continue;
                const nk = nj * cw + ni;
                if (seen[nk] || ext[nk] || !navy(nk)) continue;
                seen[nk] = 1;
                q.push(nk);
              }
            }
          }
        }
        // el contorno que toca el exterior (1 px de grosor del filo) también se vuelve transparente si es claro/difuso: se deja tal cual
        let x0 = cw, y0 = ch, x1 = 0, y1 = 0;
        for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
          const k = j * cw + i;
          if (ext[k]) { d[k * 4 + 3] = 0; continue; }
          if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j;
        }
        x.putImageData(im, 0, 0);
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        const o = document.createElement('canvas');
        o.width = w; o.height = h;
        o.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
        out.push({ id, w, h, ox: cx + x0, oy: cy + y0, webp: o.toDataURL('image/webp', 0.92), png: ${debug} ? (() => { const m = document.createElement('canvas'); m.width = w; m.height = h; const mx = m.getContext('2d'); mx.fillStyle = '#ff00ff'; mx.fillRect(0, 0, w, h); mx.drawImage(o, 0, 0); return m.toDataURL('image/png'); })() : null });
      }
      return out;
    })()`,
  });
  const v = r.result?.result?.value;
  if (!v) throw new Error('no se pudo procesar: ' + JSON.stringify(r.result));
  mkdirSync(OUT, { recursive: true });
  const meta = {};
  for (const f of v) {
    writeFileSync(join(OUT, `${f.id}.webp`), Buffer.from(f.webp.split(',')[1], 'base64'));
    if (f.png) writeFileSync(join('..', '_temp', `marco-${f.id}.png`), Buffer.from(f.png.split(',')[1], 'base64'));
    meta[f.id] = { w: f.w, h: f.h, body: BODY[f.id] ?? { x: 0, y: 0, w: f.w, h: f.h } };
    console.log(`${f.id}: ${f.w}x${f.h} (origen en la hoja ${f.ox},${f.oy})`);
  }
  writeFileSync(join('src', 'ui', JSON_OUT), JSON.stringify(meta, null, 1) + '\n');
} finally {
  ws?.close();
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill();
  await sleep(300);
  try { rmSync(ud, { recursive: true, force: true }); } catch {}
}
