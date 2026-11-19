// Prueba temporal (no es del juego): ULTI HURACÁN en partido contra el bot. Mide: sonido del 1.er golpe (inferno-hit), capturas del golpe de viento y
// del golpe final, y el sprite del que la lanza durante el golpe final (frame / pausado / altura) hasta que cae y sigue con sus sprites.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const SKIN = process.env.SKIN || 'nxo';
const POWER = process.env.POWER || 'hurricane';
const port = 9300 + Math.floor(Math.random() * 500);
const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--window-size=540,960', '--autoplay-policy=no-user-gesture-required', 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let ws;
for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); const p = l.find((t) => t.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch {} await sleep(250); }
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const logs = [];
ws.addEventListener('message', (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') logs.push('EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text)); else if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') logs.push('error ' + m.params.args.map((a) => a.value ?? a.description).join(' ')); });
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expr) => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); return r.result?.exceptionDetails ? 'ERR ' + r.result.exceptionDetails.exception?.description : r.result?.result?.value; };
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`_temp/${name}.png`, Buffer.from(r.result.data, 'base64')); };
await send('Runtime.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
console.log(await ev(`(async () => { const ps = await import('/src/domain/playerStore.ts'); ps.commit((s) => ({ ok: true, state: { ...s, level: 30, skin: '${SKIN}', owned: [...s.owned, 'inferno:${POWER}'], equipped: { ...s.equipped, inferno: '${POWER}', skin: '${SKIN}' } } })); return 'perfil ok'; })()`));
await ev(`window.__game.scene.start('Match', { botName: 'BOT' })`);
let ph = '';
for (let i = 0; i < 120; i++) {
  ph = await ev(`(() => { const m = window.__game.scene.getScene('Match'); return m && m.sys.isActive() ? m.phase : 'none'; })()`);
  if (ph === 'rally') break;
  await ev(`(() => { const m = window.__game.scene.getScene('Match'); if (m && m.phase === 'serve' && m.onServeButton) m.onServeButton('normal'); return 1; })()`);
  await sleep(250);
}
console.log('fase', ph);
console.log('lanzar:', await ev(`(() => {
  const m = window.__game.scene.getScene('Match');
  window.__snd = []; window.__t0 = performance.now();
  const orig = m.sound.play.bind(m.sound);
  m.sound.play = (k, ...a) => { window.__snd.push(Math.round(performance.now() - window.__t0) + ' ' + k); return orig(k, ...a); };
  m.phase = 'rally'; m.serving = false; m.lastHitter = 'bot'; m.inferno.charge = 99;
  m.startLegend({ x: m.player.x + 10, y: m.player.y });
  return m.legend ? m.legend.power + ' fin ' + Math.round(m.legend.plan.endMs) : 'sin legend';
})()`));
const info = () => ev(`JSON.stringify((() => { const m = window.__game.scene.getScene('Match'); const L = m.legend; const d = m.player.ch.debugInfo(); return { t: L ? Math.round(L.t) : -1, st: L && L.stage, lift: Math.round(m.player.lift || 0), anim: d.anim.replace(/^.*[-_]v2[-_]?/, ''), fr: d.frame, paused: d.paused, state: d.state, sounds: window.__snd.length, fh: m.player.ch.nxo && m.player.ch.nxo.followHold, fk: m.player.ch.nxo && m.player.ch.nxo.followHeld, hd: m.player.ch.nxo && m.player.ch.nxo.swingHitDone, ph: m.phase }; })())`);
let shotFirst = false, shotFinal = false, heldSeen = 0, heldFrames = new Set(), lastLine = '';
const t0 = Date.now();
for (let i = 0; i < 400 && Date.now() - t0 < 30000; i++) {
  await sleep(60);
  const s = JSON.parse(await info());
  const snd = await ev('window.__snd.join(" | ")');
  if (!shotFirst && snd.includes('inferno-hit')) { shotFirst = true; for (let k = 0; k < 3; k++) { await shot(`hur-first-${SKIN}-${k}`); await sleep(40); } console.log('1.er golpe: sonidos hasta ahora →', snd); }
  if (s.st === 'rally' && s.t > 0) {
    const line = `t${String(s.t).padStart(5)} lift${String(s.lift).padStart(4)} ${s.state}/${s.anim} fr${s.fr}${s.paused ? ' PAUSADO' : ''} fh${s.fh} fk${s.fk} hd${s.hd}`;
    if (POWER === 'energy' && s.t > 2300 && s.t < 3500) console.log('  dbg', line);
    if (line !== lastLine && (s.state === 'swing' || s.lift > 0)) console.log(line);
    lastLine = line;
    if (s.state === 'swing' && s.paused && s.fr === (POWER === 'energy' ? 8 : 6)) { globalThis.__h0 ??= Date.now(); globalThis.__h1 = Date.now(); heldSeen++; heldFrames.add(s.lift); if (!shotFinal && s.lift > 100) { shotFinal = true; await shot(`hur-held-${SKIN}`); } }
  }
  if (s.st === null || s.t === -1) {
    // la cinemática ya terminó: se sigue mirando 2,5 s al personaje (la pose de la BOLA DE ENERGÍA se suelta sola 1 s después del golpe)
    globalThis.__endAt ??= Date.now();
    const line = `fin+${String(Date.now() - globalThis.__endAt).padStart(4)}ms ${s.state}/${s.anim} fr${s.fr}${s.paused ? ' PAUSADO' : ''}`;
    if (line.slice(14) !== lastLine.slice(14)) console.log(line);
    lastLine = line;
    if (s.state === 'swing' && s.paused && s.fr === (POWER === 'energy' ? 8 : 6)) { globalThis.__h0 ??= Date.now(); globalThis.__h1 = Date.now(); heldSeen++; }
    if (i > 30 && Date.now() - globalThis.__endAt > 2500) break;
  }
}
await sleep(1500);
const end = JSON.parse(await info());
console.log('tras terminar:', JSON.stringify(end));
console.log('duracion del congelado (ms, de la primera a la ultima muestra):', globalThis.__h0 ? globalThis.__h1 - globalThis.__h0 : 0);
console.log('muestras con el golpe congelado en el frame 7 (indice 6):', heldSeen, ' alturas vistas:', [...heldFrames].join(','));
console.log('sonidos:', await ev('window.__snd.join(" | ")'));
console.log('errores:\n' + (logs.slice(0, 10).join('\n') || '(ninguno)'));
ws.close(); proc.kill(); process.exit(0);


