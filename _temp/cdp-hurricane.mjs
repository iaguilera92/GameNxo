// Prueba temporal: partido contra el bot, se lanza la ULTI LEGENDARIA HURACÃN directamente (startLegend) y se sacan capturas del guion.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const ud = mkdtempSync(join(tmpdir(), 'cdp-'));
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${ud}`, '--window-size=540,960', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
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
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`_temp/${name}.png`, Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
console.log(await ev(`(async () => { const ps = await import('/src/domain/playerStore.ts'); ps.commit((s) => ({ ok: true, state: { ...s, level: 30, owned: [...s.owned, 'inferno:hurricane'], equipped: { ...s.equipped, inferno: 'hurricane' } } })); return 'perfil ok'; })()`));
await ev(`window.__game.scene.start('Match', { botName: 'BOT' })`);
// espera a que el punto estÃ© en juego
let ph = '';
for (let i = 0; i < 120; i++) {
  ph = await ev(`(() => { const m = window.__game.scene.getScene('Match'); return m && m.sys.isActive() ? m.phase : 'none'; })()`);
  if (ph === 'rally') break;
  // si toca sacar, que saque el jugador (botÃ³n de saque) o espere al bot
  await ev(`(() => { const m = window.__game.scene.getScene('Match'); if (m && m.phase === 'serve' && m.onServeButton) m.onServeButton('normal'); return 1; })()`);
  await sleep(250);
}
console.log('fase', ph);
console.log('lanzar:', await ev(`(() => { const m = window.__game.scene.getScene('Match'); m.phase = 'rally'; m.serving = false; m.lastHitter = 'bot'; m.inferno.charge = 99; m.startLegend({ x: m.player.x + 10, y: m.player.y }); return m.legend ? m.legend.power + ' ' + m.legend.plan.kind + ' end ' + Math.round(m.legend.plan.endMs) : 'sin legend'; })()`));
const t0 = Date.now();
for (const at of [700, 1500, 2100, 2700, 3200, 3600, 4000, 4400, 5200, 6500]) {
  await sleep(Math.max(0, at - (Date.now() - t0)));
  const st = await ev(`JSON.stringify((() => { const m = window.__game.scene.getScene('Match'); const L = m.legend; return { t: L ? Math.round(L.t) : -1, stage: L?.stage, lift: Math.round(m.player.lift || 0), vx: Math.round(m.bot.x), bstun: +(m.bot.stun || 0).toFixed(2), racket: !!m.bot.racket, phase: m.phase }; })())`);
  console.log(at, st);
  await shot(`hur-${at}`);
}
console.log('errores:\n' + (logs.slice(0, 12).join('\n') || '(ninguno)'));
ws.close(); proc.kill(); process.exit(0);

