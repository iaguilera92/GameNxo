// Prueba temporal (no es del juego): abre la ESCENA de PERSONALIZAR en Chrome headless, crea la demostraciÃ³n EN ACCIÃ“N de la ULTI
// LEGENDARIA (BOLA DE ENERGÃA), la deja correr, la destruye como al cerrar el diÃ¡logo y mira si la escena quedÃ³ sana.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';

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
    if (page) {
      ws = new WebSocket(page.webSocketDebuggerUrl);
      break;
    }
  } catch {}
  await sleep(250);
}
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
const logs = [];
ws.addEventListener('message', (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  } else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text));
  else if (m.method === 'Runtime.consoleAPICalled' && (m.params.type === 'error' || m.params.type === 'warning')) logs.push(m.params.type + ' ' + m.params.args.map((a) => a.value ?? a.description).join(' '));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
for (let i = 0; i < 80 && !(await ev('!!window.__game && !!window.__game.scene.getScene("Menu") && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
await ev('window.__game.scene.start("Customize")');
await sleep(2500);
const out = await ev(`(async () => {
  const sc = window.__game.scene.getScene('Customize');
  const mod = await import('/src/fx/powerDemo.ts');
  const parent = sc.add.container(0, 0).setDepth(9000);
  const r = { x: 20, y: 300, w: 680, h: 460 };
  const demo = mod.createSpecialDemo(sc, parent, r, { x: 20, y: 330, w: 680, h: 390 }, 'nxo', 'inferno', 'hurricane');
  demo.setActive(true);
  window.__demo = demo;
  return 'ok';
})()`);
console.log('crear demo:', out);
for (let k = 0; k < 30; k++) { await sleep(300); const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync('_temp/hd2-' + String(k).padStart(2, '0') + '.png', Buffer.from(r.result.data, 'base64')); }
console.log('errores:\n' + (logs.slice(0, 15).join('\n') || '(ninguno)'));
ws.close(); proc.kill(); process.exit(0);
