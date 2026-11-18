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
await ev("window.__game.scene.start('Match', { botName: 'RoboAce', mode: '2v2', allyName: 'NetBot', rival2Name: 'Volea.exe' })");
const errs = [];
for (let i = 0; i < 70; i++) {
  const st = await ev("(() => { const m = window.__game.scene.getScene('Match'); return m && m.sys.isActive() ? JSON.stringify({ ph: m.phase, d: m.doubles, n: m.everyone().length, ball: Math.round(m.ball.s.x) + ',' + Math.round(m.ball.s.y), hit: m.lastHitter, bot: m.rivalActors.indexOf(m.bot), sc: m.score.points + '/' + m.score.games }) : 'none'; })()");
  if (i % 5 === 0) console.log(i, st);
  if (i === 22 || i === 40 || i === 60) await shot('d22-' + i);
  if (typeof st === 'string' && (st.includes('"ph":"serve"') || st.includes('"ph":"toss"'))) await ev("(() => { const m = window.__game.scene.getScene('Match'); if (m.server === 'player') m.onServeButton('normal'); })()");
  await sleep(300);
}ws.close(); proc.kill(); process.exit(0);
