import fs from 'fs';
﻿import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const ud = mkdtempSync(join(tmpdir(), 'smoke-'));
const port = 20000 + Math.floor(Math.random() * 30000);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${ud}`, '--window-size=720,1280', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let page; for (let i = 0; i < 50 && !page; i++) { try { page = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {} if (!page) await sleep(200); }
const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map(); const logs = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 400));
  if (d.method === 'Runtime.consoleAPICalled' && ['error'].includes(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
await send('Runtime.enable');
await send('Page.navigate', { url: 'http://localhost:4180/' });
await send('Emulation.setDeviceMetricsOverride', { width: 720, height: 1280, deviceScaleFactor: 1, mobile: true });
await ev("localStorage.clear(); location.reload(); 1");
for (let k = 0; k < 40; k++) { if (await ev("!!(window.__game && window.__game.scene.getScene('Login')?.sys.isActive())")) break; await sleep(1000); }
await sleep(2500);
const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync('_temp/para-chatgpt/' + n + '.png', Buffer.from(r.result.data, 'base64')); };
console.log('escenas', await ev("JSON.stringify(window.__game.scene.getScenes(true).map(s => s.scene.key))"));
await shot('login');
await ev("(async () => { const m = await import('/src/ui/PasswordDialog.ts'); const d = await import('/src/domain/devMode.ts'); window.__ok = 0; m.askPassword(window.__game.scene.getScene('Login'), { title: 'MODO DESARROLLO', max: 6, check: d.checkDevPassword, onOk: () => (window.__ok = 1) }); return 1; })()");
await sleep(800);
await shot('login-password');
console.log('input', await ev("(() => { const el = document.querySelector('input'); el.value = '7'; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' })); return 1; })()"), 'ok:', await ev('window.__ok'));
console.log(logs.slice(0, 30).join('\n') || 'sin errores');
ws.close(); spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
