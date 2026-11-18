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
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`_temp/wg-${n}.png`, Buffer.from(r.result.data, 'base64')); };
const kind = process.argv[2] || 'coins';
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
await sleep(3500);
// ruleta "abierta": se cobra un premio y se cierra
const gain = kind === 'xp' ? "{ coins: 0, xp: 150 }" : "{ coins: 480, xp: 0 }";
console.log(await ev(`(async () => { const g = window.__game; const ps = await import('/src/domain/playerStore.ts'); const ops = await import('/src/domain/operations.ts'); g.registry.set('wheel.open', true); ${kind === 'xp' ? 'ps.commit((s) => ops.addXp(s, 150));' : 'ps.commit((s) => ({ ok: true, state: { ...s, coins: s.coins + 480 } }));'} g.registry.set('menu.wheelGain', ${gain}); return 'ok ' + ps.getPlayer().coins + ' xp ' + ps.getPlayer().xp; })()`));
await sleep(600); await shot(kind + '-0hold');
console.log(await ev(`(() => { const g = window.__game; g.registry.set('wheel.open', false); g.events.emit('wheel-closed'); return 'cerrada'; })()`));
for (let k = 0; k < 6; k++) { await sleep(700); await shot(kind + '-' + k); }
console.log('errores:', logs.join('\n') || '(ninguno)');
ws.close(); proc.kill(); process.exit(0);
