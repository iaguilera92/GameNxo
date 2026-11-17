// Prueba temporal con TOQUES REALES (CDP Input): PERSONALIZAR â†’ tarjeta ULTI â†’ hueco BOLA DE ENERGÃA â†’ EN ACCIÃ“N â†’ X â†’ arrastrar.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const ud = mkdtempSync(join(tmpdir(), 'cdp-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${ud}`, '--window-size=540,960', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60; i++) {
  try {
    const list = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
  } catch {}
  await sleep(250);
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('error ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return 'ERR ' + r.result.exceptionDetails.exception?.description; return r.result?.result?.value; };
/** toque en (x, y) del JUEGO */
const tap = async (gx, gy) => {
  const p = await ev(`(() => { const c = window.__game.canvas.getBoundingClientRect(); const s = window.__game.scale; return { x: c.left + ${gx} * c.width / s.width, y: c.top + ${gy} * c.height / s.height }; })()`);
  for (const type of ['mousePressed', 'mouseReleased']) { await send('Input.dispatchMouseEvent', { type, x: p.x, y: p.y, button: 'left', clickCount: 1 }); await sleep(60); }
};
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); (await import('node:fs')).writeFileSync(`_temp/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const drag = async (gx, gy0, gy1) => {
  const p0 = await ev(`(() => { const c = window.__game.canvas.getBoundingClientRect(); const s = window.__game.scale; return { x: c.left + ${gx} * c.width / s.width, y: c.top + ${gy0} * c.height / s.height, y1: c.top + ${gy1} * c.height / s.height }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p0.x, y: p0.y, button: 'left', clickCount: 1 });
  for (let k = 1; k <= 10; k++) { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p0.x, y: p0.y + ((p0.y1 - p0.y) * k) / 10, button: 'left', buttons: 1 }); await sleep(30); }
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p0.x, y: p0.y1, button: 'left', clickCount: 1 });
};
await send('Runtime.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
await ev(`(async () => { const ps = await import('/src/domain/playerStore.ts'); ps.commit((s) => ({ ok: true, state: { ...s, level: 30, owned: [...s.owned, 'inferno:energy'] } })); return 'ok'; })()`);
await ev('window.__game.scene.start("Customize")');
await sleep(2500);
const zonesJs = `const zonesOf = (o, out = []) => { if (o.type === 'Zone' && o.input && o.input.enabled) out.push(o); (o.list || []).forEach((c) => zonesOf(c, out)); return out; }; const center = (z) => { const b = z.getBounds(); return [b.centerX, b.centerY]; };`;
// pointerdown contador en la escena
await ev(`(() => { const sc = window.__game.scene.getScene('Customize'); window.__downs = 0; sc.input.on('pointerdown', () => window.__downs++); return 1; })()`);
await ev(`(() => { const sc = window.__game.scene.getScene('Customize'); sc.openUltiDialog(); return 'ok'; })()`);
await sleep(700);
let c = await ev(`(() => { ${zonesJs} const sc = window.__game.scene.getScene('Customize'); const root = sc.children.list.filter((o) => o.depth === 8000).pop(); const cells = zonesOf(root).filter((q) => Math.abs(q.width - q.height) < 1 && q.width > 60 && q.width < 200); return center(cells[9]); })()`);
await tap(c[0], c[1]);
await sleep(400);
c = await ev(`(() => { ${zonesJs} const sc = window.__game.scene.getScene('Customize'); const root = sc.children.list.filter((o) => o.depth === 8000).pop(); const z = zonesOf(root).filter((q) => Math.round(q.width) === 180).sort((a, b) => b.x - a.x); return center(z[0]); })()`);
await tap(c[0], c[1]);
await sleep(Number(process.argv[2] ?? 2600)); await shot('cdp-demo');
c = await ev(`(() => { ${zonesJs} const sc = window.__game.scene.getScene('Customize'); const root = sc.children.list.filter((o) => o.depth === 8000).pop(); return center(zonesOf(root).find((q) => Math.round(q.width) === 56)); })()`);
await tap(c[0], c[1]);
await sleep(1200);
const probe = `JSON.stringify((() => { const sc = window.__game.scene.getScene('Customize'); const cam = sc.cameras.main; return { dialogos: sc.children.list.filter((o) => o.depth >= 8000).length, downs: window.__downs, scrollY: Math.round(cam.scrollY), frame: window.__game.loop.frame, fps: Math.round(window.__game.loop.actualFps), inputOn: sc.input.enabled, topOnly: sc.input.topOnly }; })())`;
console.log('tras cerrar', await ev(probe)); await shot('cdp-tras-cerrar');
await drag(360, 900, 400);
await sleep(600);
console.log('tras arrastrar', await ev(probe)); await shot('cdp-tras-arrastrar');
await tap(360, 640);
await sleep(300);
console.log('tras tocar', await ev(probe));
console.log('errores:\n' + (logs.slice(0, 12).join('\n') || '(ninguno)'));
ws.close(); proc.kill(); process.exit(0);

