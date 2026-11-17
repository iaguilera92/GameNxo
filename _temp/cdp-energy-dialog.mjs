// Prueba temporal: PERSONALIZAR â†’ diÃ¡logo ULTI â†’ hueco BOLA DE ENERGÃA â†’ EN ACCIÃ“N â†’ cerrar (X). Mira si la escena queda sana.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const ud = mkdtempSync(join(tmpdir(), 'cdp-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${ud}`, '--window-size=720,1280', 'about:blank'], { stdio: 'ignore' });
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
await send('Runtime.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
await ev(`(async () => { const ps = await import('/src/domain/playerStore.ts'); ps.commit((s) => ({ ok: true, state: { ...s, owned: [...s.owned, 'inferno:energy'], equipped: { ...s.equipped, skin: process_SKIN } } })); return 'ok'; })()`.replace('process_SKIN', JSON.stringify(process.argv[3] ?? 'nxo')));
await ev('window.__game.scene.start("Customize")');
await sleep(2500);
const zonesJs = `const zonesOf = (o, out = []) => { if (o.type === 'Zone' && o.input && o.input.enabled) out.push(o); (o.list || []).forEach((c) => zonesOf(c, out)); return out; };`;
console.log('base', await ev(`JSON.stringify((() => { const sc = window.__game.scene.getScene('Customize'); return { fps: Math.round(window.__game.loop.actualFps), objs: sc.children.list.length, upd: sc.events.listenerCount('update'), post: sc.events.listenerCount('postupdate'), tweens: sc.tweens.getTweens().length, timers: sc.time.getAllEvents ? sc.time.getAllEvents().length : -1, textures: Object.keys(window.__game.textures.list).length }; })())`));
console.log('abrir:', await ev(`(() => { const sc = window.__game.scene.getScene('Customize'); sc.openUltiDialog(); return 'ok'; })()`));
await sleep(600);
console.log('hueco energÃ­a:', await ev(`(() => { ${zonesJs} const sc = window.__game.scene.getScene('Customize');
  const root = sc.children.list.filter((o) => o.depth === 8000).pop();
  const z = zonesOf(root); const cells = z.filter((q) => Math.abs(q.width - q.height) < 1 && q.width > 60 && q.width < 200);
  window.__zones = z.map((q) => [Math.round(q.width), Math.round(q.height)]).join(' ');
  cells[9].emit('pointerup', sc.input.activePointer); return 'celdas ' + cells.length; })()`));
await sleep(400);
console.log('en acciÃ³n:', await ev(`(() => { ${zonesJs} const sc = window.__game.scene.getScene('Customize');
  const root = sc.children.list.filter((o) => o.depth === 8000).pop();
  const z = zonesOf(root).filter((q) => Math.round(q.width) === 180).sort((a, b) => b.x - a.x);
  z[0].emit('pointerup', sc.input.activePointer); return 'ok ' + z.length; })()`));
const at = Number(process.argv[2] ?? 2500);
await sleep(at);
console.log('antes', await ev(`JSON.stringify((() => { const sc = window.__game.scene.getScene('Customize'); return { tp: sc.tweens.paused, time: sc.time.paused, fps: Math.round(window.__game.loop.actualFps) }; })())`));
const MODE = process.argv[4] ?? 'x';
if (MODE === 'equip') console.log('equipar:', await ev(`(() => { ${zonesJs} const sc = window.__game.scene.getScene('Customize'); const root = sc.children.list.filter((o) => o.depth === 8000).pop(); const z = zonesOf(root).filter((q) => Math.round(q.height) === 80); if (!z.length) return 'sin botón'; z[0].emit('pointerup', sc.input.activePointer); return 'ok'; })()`));
else console.log('cerrar X:', await ev(`(() => { ${zonesJs} const sc = window.__game.scene.getScene('Customize');
  const root = sc.children.list.filter((o) => o.depth === 8000).pop();
  const x = zonesOf(root).find((q) => Math.round(q.width) === 56); x.emit('pointerup', sc.input.activePointer); return 'ok'; })()`));
await sleep(2000);
console.log('despuÃ©s', await ev(`JSON.stringify((() => { const sc = window.__game.scene.getScene('Customize'); const t = sc.tweens.getTweens();
  return { tp: sc.tweens.paused, time: sc.time.paused, pausedTweens: t.filter((x) => x.isPaused()).length, dialogos: sc.children.list.filter((o) => o.depth >= 8000).length, active: sc.sys.isActive(), fps: Math.round(window.__game.loop.actualFps), frame: window.__game.loop.frame }; })())`));
await sleep(1000);
await sleep(3000);
console.log('3 s después', await ev(`JSON.stringify((() => { const sc = window.__game.scene.getScene('Customize'); return { fps: Math.round(window.__game.loop.actualFps), objs: sc.children.list.length, upd: sc.events.listenerCount('update'), post: sc.events.listenerCount('postupdate'), tweens: sc.tweens.getTweens().length, timers: sc.time.getAllEvents ? sc.time.getAllEvents().length : -1, textures: Object.keys(window.__game.textures.list).length }; })())`));
console.log('errores:\n' + (logs.slice(0, 12).join('\n') || '(ninguno)'));
ws.close(); proc.kill(); process.exit(0);


