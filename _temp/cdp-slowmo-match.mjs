// Prueba temporal (no es del juego): partido contra el bot con el DEFENSIVO TIEMPO LENTO equipado. Activa el defensivo en varias pelotas del bot
// (como el botón) y comprueba: cámara lenta, cinemática, golpe de vuelta, y que todo vuelve a la normalidad (tiempo, cámara, personaje).
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--window-size=540,960', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
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
console.log(await ev(`(async () => { const ps = await import('/src/domain/playerStore.ts'); ps.commit((s) => ({ ok: true, state: { ...s, level: 30, owned: [...s.owned, 'defensive:slowmo'], equipped: { ...s.equipped, defensive: 'slowmo' } } })); return 'perfil ok'; })()`));
await ev(`window.__game.scene.start('Match', { botName: 'BOT' })`);
const M = (body) => ev(`(() => { const m = window.__game.scene.getScene('Match'); ${body} })()`);
const state = () => M(`return JSON.stringify({ ph: m.phase, hit: m.lastHitter, slow: m.slowMo, cine: m.cine.active, zoom: +m.cameras.main.zoom.toFixed(2), van: m.player.vanished, sm: !!(m.dashHit && m.dashHit.slowmo), act: m.slowmoActive, px: Math.round(m.player.x), py: Math.round(m.player.y), bx: Math.round(m.ball.s.x), vx: Math.round(m.ball.s.vx), stun: +m.player.stun.toFixed(2), cd: m.dashBtn && m.dashBtn.ready });`);
// que el jugador (autoPlay) saque y devuelva; el defensivo lo disparo yo cuando la pelota del bot viene
await M(`m.autoPlay = true; return 1;`);
let ok = 0, fail = 0, tries = 0;
const t0 = Date.now();
while (ok + fail < 4 && Date.now() - t0 < 150000) {
  await sleep(120);
  await M(`if (m.phase !== 'intro') m.autoPlay = true; return 1;`); // la escena reinicia autoPlay al crearse
  if (process.env.DBG && (Date.now() - t0) % 1000 < 130) console.log('dbg', await M(`return JSON.stringify({ ph: m.phase, hit: m.lastHitter, bx: Math.round(m.ball.s.x), vx: Math.round(m.ball.s.vx), cine: m.cine.active, van: m.player.vanished, ready: m.dashBtn && m.dashBtn.ready, auto: m.autoPlay });`));
  const ready = await M(`return m.phase === 'rally' && m.lastHitter === 'bot' && !m.cine.active && !m.player.vanished && m.ball.s.x > 400 && m.ball.s.vx < 0 && m.dashBtn.ready;`);
  if (!ready) continue;
  tries++;
  const started = await M(`const r = m.activateDash(); return r;`);
  console.log(`\n#${tries} activateDash ->`, started, await state());
  if (!started) { await sleep(600); continue; }
  const trace = [];
  let sawCine = false, sawSlow = false, maxZoom = 0;
  const tt = Date.now();
  while (Date.now() - tt < 7000) {
    await sleep(100);
    const s = JSON.parse(await state());
    if (s.cine) sawCine = true;
    if (s.slow < 0.99) sawSlow = true;
    maxZoom = Math.max(maxZoom, s.zoom);
    trace.push(s);
    if (sawCine && !s.cine && !s.sm && !s.act) break;
    if (!s.cine && !s.sm && !s.act && Date.now() - tt > 500) break;
  }
  if (tries === 1) {
    // capturas del primer intento: se repite quedándose en el momento (solo informativo)
    await shot('slowmo-match-end');
  }
  const last = trace[trace.length - 1];
  await sleep(1200); // la cámara y la penumbra se sueltan solas
  const fin = JSON.parse(await state());
  const good = sawSlow && sawCine && fin.slow === 1 && !fin.van && !fin.act && !fin.sm && Math.abs(fin.zoom - 1) < 0.35 + 5;
  console.log('   cámara lenta:', sawSlow, ' cinemática:', sawCine, ' zoom máx:', maxZoom, ' último:', JSON.stringify(last));
  console.log('   final:', JSON.stringify(fin), good ? 'OK' : 'FALLO');
  good ? ok++ : fail++;
  await sleep(500);
}
console.log('\nresultado: ok', ok, ' fallos', fail, ' intentos', tries);
console.log('errores:\n' + (logs.slice(0, 12).join('\n') || '(ninguno)'));
ws.close(); proc.kill(); process.exit(0);
