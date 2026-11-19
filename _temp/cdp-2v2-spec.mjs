// Prueba temporal (no es del juego): 2v2 online con DOS navegadores contra el servidor local (puerto 3002). Fuerza ESPECIAL y ULTI
// (humanos y bots), y mide: marcador igual, pelota igual, cinemáticas que congelan los dos teléfonos y avisos que se envían / reciben.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SAMPLES = Number(process.env.SAMPLES || 150);

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

const join2v2 = (p, nm) => p.ev(`(async () => {
  const e = await import('/src/net/__e2e.ts');
  const { MatchNet } = await import('/src/net/MatchNet.ts');
  const tr = await e.make('http://127.0.0.1:3002');
  window.__tr = tr;
  tr.on('mm:matched', (m) => {
    const net = new MatchNet(tr, m.roomId, m.role, m.opponent, m.gamesToWin, m.token, m.mode ?? '1v1');
    window.__net = net;
    window.__game.scene.start('Match', { botName: 'x', net, ambiente: '' });
  });
  tr.emit('mm:find', { mode: '2v2', profile: { name: '${nm}', level: 60, skin: 'nxo' } });
  return 'buscando';
})()`);

console.log(await join2v2(A, 'Ana'));
await sleep(600);
console.log(await join2v2(B, 'Beto'));
await sleep(5000);

// autoPlay + conteo de avisos (por tipo) + carga de ULTI
for (const p of [A, B]) {
  console.log(p.name, await p.ev(`(() => {
    const m = window.__game.scene.getScene('Match');
    m.autoPlay = true;
    window.__cnt = {};
    window.__log = []; window.__t0 = performance.now();
    window.__net.trace = (d, ty, k, x) => { if (ty !== 'state' && k !== 'ping' && k !== 'pong' && k !== 'sprint-start' && k !== 'sprint-end') { window.__log.push(Math.round(performance.now() - window.__t0) + ' ' + d + ' ' + ty + ' ' + k + ' ' + JSON.stringify(x ?? {})); if (window.__log.length > 400) window.__log.shift(); } if (ty === 'action' && k !== 'ping' && k !== 'pong') { const key = d + ' ' + k; window.__cnt[key] = (window.__cnt[key] || 0) + 1; } if (ty === 'hit' && x && (x.power || x.inferno)) { const key = d + ' hit-' + (x.inferno ? 'ulti' : 'esp') + (x.impact ? '-impacto' : ''); window.__cnt[key] = (window.__cnt[key] || 0) + 1; } };
    return JSON.stringify({ especial: m.unlocked('special'), ulti: m.unlocked('ulti') });
  })()`));
}
const charge = (p, bots) => p.ev(`(() => {
  const m = window.__game.scene.getScene('Match');
  for (let i = 0; i < 3; i++) m.onInfernoPoint();
  ${bots ? 'for (const b of m.rivalBrains) for (let i = 0; i < 3; i++) b.onPointWon();' : ''}
  return 'ok';
})()`);

// el host da a sus bots el ESPECIAL de hielo: si `el` viaja con el golpe, el invitado dibuja la bola de hielo (si no, la de su propio kit)
await A.ev(`(() => { const m = window.__game.scene.getScene('Match'); m.botKit.smash = 'comet'; return 1; })()`);
await B.ev(`(() => { const m = window.__game.scene.getScene('Match'); m.botKit.smash = 'fire'; window.__botEl = {}; return 1; })()`);
const snap = async (p) => JSON.parse(await p.ev(`(() => { const m = window.__game.scene.getScene('Match'); const s = m.ball.s; return JSON.stringify({ wt: performance.timeOrigin + performance.now(), vx: s.vx, vy: s.vy, ph: m.phase, hit: m.lastHitter, x: Math.round(s.x), y: Math.round(s.y), sc: m.score.points + '/' + m.score.games, cine: m.cineLock, inf: m.infernoFlight, pw: m.ball.power, st: m.player.stun > 0 ? 1 : 0, ar: m.ally ? (m.ally.stun > 0 ? 1 : 0) : 0 }); })()`));
let bad = 0, worst = 0, rally = 0, cineA = 0, cineB = 0, cineMis = 0, longMis = 0, run = 0;
for (let i = 0; i < SAMPLES; i++) {
  if (i % 12 === 0 && !process.env.NOULTI) { await charge(A, true); await charge(B, false); }
  await sleep(300);
  if (process.env.FORCE) for (const p of [A, B]) await p.ev(`(() => { const m = window.__game.scene.getScene('Match'); if (m && m.phase === 'rally' && m.smashBtn.ready && !m.smashBtn.inferno && !m.smashArmed && m.lastHitter === 'bot') m.smashBtn.tryActivate(); })()`);
  const [a, b] = await Promise.all([snap(A), snap(B)]); // a la vez: la bola del ESPECIAL va muy rápido y un desfase de 50 ms ya son ~150 px
  await B.ev(`(() => { const m = window.__game.scene.getScene('Match'); if (m.ball.power && !m.infernoFlight && m.lastHitter === 'bot') window.__botEl[m.smashFlightEl] = (window.__botEl[m.smashFlightEl] || 0) + 1; })()`);
  if (a.cine) cineA++;
  if (b.cine) cineB++;
  if (a.cine !== b.cine) { cineMis++; run++; if (run > 6) longMis++; } else run = 0;
  // la posición del invitado llevada a la hora real del host con la velocidad de la pelota (las dos páginas no se leen en el mismo instante)
  const dtS = (a.wt - b.wt) / 1000;
  const d = Math.hypot(a.x - (b.x + b.vx * dtS), a.y - (b.y + b.vy * dtS));
  if (a.sc !== b.sc) console.log(i, 'MARCADOR DISTINTO', a.sc, b.sc);
  if (a.ph === 'rally' && b.ph === 'rally' && !a.cine && !b.cine) {
    rally++;
    worst = Math.max(worst, d);
    if (d > 250) {
      bad++;
      if (bad <= 4) {
        console.log(i, 'DESINCRONÍA', JSON.stringify(a), JSON.stringify(b), 'd=' + Math.round(d));
        console.log('  H:', await A.ev('window.__log.slice(-7).join(" | ")'));
        console.log('  G:', await B.ev('window.__log.slice(-7).join(" | ")'));
      }
    }
  }
}
console.log('muestras en juego:', rally, ' pelota >250px:', bad, ' peor:', Math.round(worst));
console.log('muestras con cinemática: host', cineA, ' invitado', cineB, ' | una sí y otra no:', cineMis, ' (rachas >1,8 s:', longMis + ')');
console.log('marcador final H:', (await snap(A)).sc, ' G:', (await snap(B)).sc);
console.log('avisos host:', await A.ev('JSON.stringify(window.__cnt)'));
console.log('avisos invitado:', await B.ev('JSON.stringify(window.__cnt)'));
console.log('poder de la bola de un bot visto por el invitado (esperado comet):', await B.ev('JSON.stringify(window.__botEl)'));
console.log('errores:', [...A.logs, ...B.logs].join('\n') || '(ninguno)');
A.close();
B.close();
process.exit(0);
