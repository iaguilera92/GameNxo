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
let id = 0; const pend = new Map(); const logs = []; let urls = [];
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Network.requestWillBeSent') urls.push(d.params.request.url);
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text).slice(0, 400));
  if (d.method === 'Runtime.consoleAPICalled' && ['error'].includes(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map((a) => a.value ?? a.description ?? '').join(' ').slice(0, 300)); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true }); return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description; };
await send('Runtime.enable'); await send('Network.enable');
await send('Page.navigate', { url: 'http://localhost:4180/' });
for (let k = 0; k < 60; k++) { if (await ev('!!(window.__game && window.__game.scene.getScene("Menu")?.sys.isActive())')) break; await sleep(1000); }
await ev("localStorage.setItem('gamenxo.devMode','1'); location.reload(); 1");
await sleep(3000);
for (let k = 0; k < 60; k++) { if (await ev('!!(window.__game && window.__game.scene.getScene("Menu")?.sys.isActive())')) break; await sleep(1000); }

const state = `(() => { const g = window.__game; const k = g.textures.getTextureKeys(); const pre = {nxo:'nxo-',nxof:'nxof-',mai:'mai-',maif:'maif-',mat:'mat-',matf:'matf-'}; const c = {}; for (const [n,p] of Object.entries(pre)) c[n] = k.filter(x => x.startsWith(p)).length; return JSON.stringify({ act: g.scene.getScenes(true).map(s => s.scene.key), chars: c, amb: k.filter(x => x.startsWith('ambiente')), liga: k.filter(x => x.startsWith('liga-')).length, shop: k.filter(x => ['shop-title','oferta-emotes','shop-pj-card'].includes(x)).length, charge: k.filter(x => x.startsWith('charge-')).length, total: k.length }); })()`;
const go = async (scene, data, wait = 6000) => { await ev(`(() => { const g = window.__game; for (const s of g.scene.getScenes(true)) if (s.scene.key !== '${scene}') g.scene.stop(s.scene.key); g.scene.start('${scene}', ${JSON.stringify(data ?? {})}); return 1; })()`); await sleep(wait); console.log(scene.padEnd(12), await ev(state)); };


await go('Ranked', {}, 6000);
const tw = "window.__game.scene.getScene('Ranked').tweens.getTweens().length";
const fps = "new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(Math.round(n / 2)); }; requestAnimationFrame(f); })";
console.log('tweens al entrar:', await ev(tw), '| fps:', await ev(fps));
for (let k = 0; k < 6; k++) await ev("(() => { const sc = window.__game.scene.getScene('Ranked'); sc.setTab(sc.tab === '2v2' ? '1v1' : '2v2'); return 1; })()");
await sleep(1500);
console.log('tweens tras 6 cambios de pesta?a:', await ev(tw));
const fake = "{ week: '2026-11-23', league: 'gold', eligible: true, coins: 120, rays: 1, cash: 5, wins: 4, net: 30, position: 6, positionLabel: '' }";
for (let k = 0; k < 3; k++) {
  await ev(`(() => { window.__game.scene.getScene('Ranked').showWeekly(${fake}); return 1; })()`);
  await sleep(1200);
  await ev(`(() => { window.__game.scene.getScene('Ranked').showSeasonChest(${fake}, false); return 1; })()`);
  await sleep(1500);
  const f = await ev(fps);
  await ev("(() => { window.__game.scene.getScene('Ranked').closeOverlay(); return 1; })()");
  await sleep(800);
  console.log('antes de prune manual', await ev(tw), 'tiene prune:', await ev("typeof window.__game.scene.getScene('Ranked').pruneDeadTweens"), await ev("(() => { const sc = window.__game.scene.getScene('Ranked'); const t = sc.tweens.getTweens().find(t => (t.targets||[])[0]?.type === 'Text'); if (!t) return 'sin'; const x = t.targets[0]; return JSON.stringify({ hasType: 'type' in x, scene: String(x.scene), len: t.targets.length }); })()")); console.log('prune:', await ev("(() => { try { const sc = window.__game.scene.getScene('Ranked'); sc.pruneDeadTweens(); return 'ok ' + sc.tweens.getTweens().length + ' ' + sc.pruneDeadTweens.toString().slice(0, 600); } catch (e) { return 'ERR ' + e.message; } })()")); console.log('despues', await ev(tw)); console.log('cofre #' + (k + 1), '| fps con el cofre:', f, '| tweens tras cerrarlo:', await ev(tw));
}
console.log(logs.slice(0, 30).join('\n') || 'sin errores');
ws.close(); spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });



