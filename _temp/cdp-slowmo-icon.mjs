// Prueba temporal: dibuja el icono de TIEMPO LENTO junto a otros defensivos y saca una captura.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--window-size=540,960', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? 'ERR ' + r.result.exceptionDetails.exception?.description : r.result?.result?.value; };
await send('Runtime.enable'); await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
console.log(await ev(`(async () => {
  const ic = await import('/src/ui/icons.ts');
  const sc = window.__game.scene.getScene('Menu');
  const bg = sc.add.rectangle(270, 480, 540, 960, 0x16203f).setDepth(99998);
  const ids = ['lightning', 'skate', 'slowmo', 'blink'];
  ids.forEach((id, i) => { const g = sc.add.graphics().setDepth(99999).setPosition(90 + i * 120, 480); ic.drawDefensiveIcon(g, id, 50); });
  const big = sc.add.graphics().setDepth(99999).setPosition(270, 700); ic.drawDefensiveIcon(big, 'slowmo', 140);
  return 'ok';
})()`));
await sleep(500);
const r = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync('_temp/slowmo-icon.png', Buffer.from(r.result.data, 'base64'));
console.log('errores:', logs.join('\n') || '(ninguno)');
ws.close(); proc.kill(); process.exit(0);
