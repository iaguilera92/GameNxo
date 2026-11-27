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

await ev("window.__lt = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(Math.round(e.duration)); }).observe({ entryTypes: ['longtask'] }); 1");
await go('Customize', {}, 6000);
const measure = async (label, before) => {
  urls = [];
  await ev("window.__lt = []; 1");
  const ms = await ev(`new Promise(async (res) => { ${before} const sc = window.__game.scene.getScene('Customize'); (await import('/src/ui/sceneTextures.ts')).markSceneRestart(sc); const t0 = performance.now(); sc.events.once('create', () => res(Math.round(performance.now() - t0))); sc.scene.restart(); setTimeout(() => res(-1), 30000); })`);
  await sleep(4000);
  const lt = await ev("JSON.stringify(window.__lt)");
  const dirs = {}; for (const u of urls) { const m = u.match(/assets\/(?:characters\/)?([^/]+)/); const k = m ? m[1] : 'otro'; dirs[k] = (dirs[k] ?? 0) + 1; }
  console.log('  no-blob:', urls.filter(u => !u.startsWith('blob:') && !/characters/.test(u)).map(u => u.replace('http://localhost:4180/','')).slice(0, 40).join(' ')); console.log(label, 'ms hasta create:', ms, '| pedidos:', urls.length, JSON.stringify(Object.fromEntries(Object.entries(dirs).filter(([k]) => /-(v2|inferno)$|otro/.test(k)))), '| tareas largas (ms):', lt);
};
await measure('reinicio sin cambiar', '');
await measure('cambio a MAT       ', "const P = await import('/src/logic/Profile.ts'); P.setSkin('mat');");

console.log(logs.slice(0, 30).join('\n') || 'sin errores');
ws.close(); spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });




