// Prueba temporal (no es del juego): 1v1 ONLINE con dos navegadores. El INVITADO lleva TIEMPO LENTO y lo activa con las pelotas del anfitrión.
// Mide lo que ve cada teléfono mientras dura: fase, pelota, marcador, tiempo lento, cinemática.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function phone(name) {
  const port = 9300 + Math.floor(Math.random() * 600);
  const proc = spawn(chrome, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${mkdtempSync(join(tmpdir(), 'cdp-'))}`, '--window-size=540,960', 'about:blank'], { stdio: 'ignore' });
  let ws;
  for (let i = 0; i < 60; i++) {
    try {
      const l = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      const p = l.find((t) => t.type === 'page');
      if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; }
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
    else if (m.method === 'Runtime.exceptionThrown') logs.push(name + ' EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 400));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    return r.result?.exceptionDetails ? 'ERR ' + (r.result.exceptionDetails.exception?.description ?? '').slice(0, 300) : r.result?.result?.value;
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
  for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
  return { name, ev, logs, close: () => { ws.close(); proc.kill(); } };
}
const A = await phone('host');
const B = await phone('guest');
const enter = (p, nm, slow) => p.ev(`(async () => {
  const ps = await import('/src/domain/playerStore.ts');
  ps.commit((s) => ({ ok: true, state: { ...s, level: 30, ${slow ? "owned: [...s.owned, 'defensive:slowmo'], equipped: { ...s.equipped, defensive: 'slowmo' }" : 'owned: s.owned'} } }));
  const e = await import('/src/net/__e2e.ts');
  const { MatchNet } = await import('/src/net/MatchNet.ts');
  const tr = await e.make('http://127.0.0.1:3002');
  tr.on('mm:matched', (m) => {
    const net = new MatchNet(tr, m.roomId, m.role, m.opponent, m.gamesToWin, m.token, m.mode ?? '1v1');
    window.__net = net;
    window.__game.scene.start('Match', { botName: 'x', net, ambiente: '' });
  });
  tr.emit('mm:find', { mode: '1v1', profile: { name: '${nm}', level: 30, skin: 'nxo' } });
  return 'buscando';
})()`);
console.log(await enter(A, 'Ana', false));
await sleep(600);
console.log(await enter(B, 'Beto', true));
await sleep(5000);
const snap = async (p) => JSON.parse(await p.ev(`(() => { const m = window.__game.scene.getScene('Match'); const s = m.ball.s; return JSON.stringify({ t: Date.now(), ph: m.phase, hit: m.lastHitter, x: Math.round(s.x), y: Math.round(s.y), vx: Math.round(s.vx), sc: m.score.points + '/' + m.score.games, slow: m.slowMo, cine: m.cineLock, sm: !!(m.dashHit && m.dashHit.slowmo), bo: m.bounces }); })()`));
for (const p of [A, B]) await p.ev(`(() => { const m = window.__game.scene.getScene('Match'); m.autoPlay = true; })()`);
let uses = 0;
for (let i = 0; i < 400 && uses < 3; i++) {
  await sleep(120);
  const ready = await B.ev(`(() => { const m = window.__game.scene.getScene('Match'); m.autoPlay = true; return m.phase === 'rally' && m.lastHitter === 'bot' && !m.cineLock && !m.player.vanished && m.dashBtn.ready && m.ball.s.vx < 0; })()`);
  if (!ready) continue;
  const ok = await B.ev(`(() => { const m = window.__game.scene.getScene('Match'); return m.activateDash(); })()`);
  if (!ok) continue;
  uses++;
  console.log(`\n=== uso ${uses} del TIEMPO LENTO (invitado)`);
  const t0 = Date.now();
  let last = '';
  for (let k = 0; k < 70; k++) {
    await sleep(100);
    const [a, b] = await Promise.all([snap(A), snap(B)]);
    const line = `${String(Date.now() - t0).padStart(5)}ms  anfitrión: ${a.ph}/${a.hit} x${a.x} vx${a.vx} bo${a.bo} ${a.sc} ${a.cine ? 'CINE' : ''} | invitado: ${b.ph}/${b.hit} x${b.x} vx${b.vx} bo${b.bo} ${b.sc} slow${b.slow} ${b.sm ? 'RUN' : ''} ${b.cine ? 'CINE' : ''}`;
    if (line.slice(8) !== last) console.log(line);
    last = line.slice(8);
    if (b.hit === 'player' && !b.sm && !b.cine && b.slow === 1 && k > 5) break;
  }
}
console.log('\nerrores:', [...A.logs, ...B.logs].join('\n') || '(ninguno)');
A.close(); B.close(); process.exit(0);

