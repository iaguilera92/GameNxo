// prueba de humo: abre el juego en Chrome headless, junta errores y cuenta texturas de personajes cargadas
import { spawn, spawnSync } from 'node:child_process';
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
let id = 0; const pend = new Map(); const logs = []; const urls = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Network.requestWillBeSent') urls.push(d.params.request.url);
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 300));
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 200)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable'); await send('Network.enable');
await send('Page.navigate', { url: 'http://localhost:4179/' });
await sleep(14000);
const ev = async (e) => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
const info = await ev(`(() => { const g = window.Phaser && Phaser.GAMES?.[0]; if (!g) return 'sin juego'; const keys = g.textures.getTextureKeys(); const pre = ['nxo-','nxof-','mai-','maif-','mat-','matf-']; const c = {}; for (const p of pre) c[p] = keys.filter(k => k.startsWith(p)).length; return JSON.stringify({ scenes: g.scene.getScenes(true).map(s => s.scene.key), chars: c }); })()`);
const dirs = {}; for (const u of urls) { const m = u.match(/assets\/characters\/([^/]+)\//); if (m) dirs[m[1]] = (dirs[m[1]] ?? 0) + 1; } console.log('tiras pedidas por carpeta:', JSON.stringify(dirs)); console.log('total pedidos', urls.length);
console.log(logs.slice(0, 25).join('\n') || 'sin errores');
ws.close(); spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });

