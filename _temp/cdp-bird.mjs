import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const ud = mkdtempSync(join(tmpdir(), 'cdp-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${ud}`, '--window-size=540,960', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map();
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result?.result?.value;
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`_temp/${name}.png`, Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable'); await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
const amb = process.argv[2] || 'ambiente-3';
console.log(await ev("JSON.stringify([1,2,3].map((n) => window.__game.textures.exists('ambiente-' + n)))"));
await ev(`localStorage.setItem('dev.ambiente','${amb}'); localStorage.setItem('dev.paloma','left')`);
await ev(`window.__game.scene.start('Match', { botName: 'BOT' })`);
let done = false;
for (let i = 0; i < 120 && !done; i++) {
  const st = await ev("(() => { const m = window.__game.scene.getScene('Match'); const b = m && m.children.list.find((o) => o.texture && o.texture.key === 'ambiente-paloma'); return b && b.anims.currentAnim ? JSON.stringify({ a: b.anims.currentAnim.key, x: Math.round(b.x), y: Math.round(b.y) }) : 'x'; })()");
  if (i % 6 === 0) console.log(i, st);
  if (typeof st === 'string' && st.includes('paloma-idle')) { await sleep(500); await shot(`bird-idle-${amb}`); console.log('idle', st); done = true; }
  await sleep(250);
}
await ev(`localStorage.removeItem('dev.ambiente'); localStorage.removeItem('dev.paloma')`);
ws.close(); proc.kill(); process.exit(0);
