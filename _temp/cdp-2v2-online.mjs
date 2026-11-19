// Prueba temporal (no es del juego): DOS navegadores, cada uno un telÃ©fono, contra el servidor local (puerto 3002): 2v2 online
// (2 humanos del mismo equipo + 2 bots que simula el host). Con autoPlay en los dos. Mira estados y capturas.
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
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
    else if (m.method === 'Runtime.exceptionThrown') logs.push(name + ' EXC ' + (m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text).slice(0, 300));
  });
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    return r.result?.exceptionDetails ? 'ERR ' + (r.result.exceptionDetails.exception?.description ?? '').slice(0, 300) : r.result?.result?.value;
  };
  const shot = async (n) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`_temp/e2e-${name}-${n}.png`, Buffer.from(r.result.data, 'base64')); };
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: 'http://127.0.0.1:5199/' });
  for (let i = 0; i < 80 && !(await ev('!!window.__game && window.__game.scene.isActive("Menu")')); i++) await sleep(250);
  return { name, ev, shot, logs, close: () => { ws.close(); proc.kill(); } };
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
  tr.emit('mm:find', { mode: '${process.env.MODE || '2v2'}', profile: { name: '${nm}', level: 5, skin: 'nxo' } });
  return 'buscando';
})()`);

console.log(await join2v2(A, 'Ana'));
await sleep(600);
console.log(await join2v2(B, 'Beto'));
await sleep(5000);

const stat = (p) => p.ev(`(() => { const m = window.__game.scene.getScene('Match'); if (!m || !m.sys.isActive()) return 'none'; return JSON.stringify({ ph: m.phase, role: m.net && m.net.role, n2: m.net2, hit: m.lastHitter, ball: Math.round(m.ball.s.x) + ',' + Math.round(m.ball.s.y), sc: m.score.points + '/' + m.score.games, pl: Math.round(m.player.x) + ',' + Math.round(m.player.y), ally: Math.round(m.ally.x) + ',' + Math.round(m.ally.y), r1: Math.round(m.rivalActors[0].x) + ',' + Math.round(m.rivalActors[0].y), r2: Math.round(m.rivalActors[1].x) + ',' + Math.round(m.rivalActors[1].y), allyRemote: m.allyRemote }); })()`);
for (const p of [A, B]) await p.ev(`(() => { const m = window.__game.scene.getScene('Match'); if (m) m.autoPlay = true; window.__log = []; const t0 = performance.now(); window.__net.trace = (d, ty, k, x) => window.__log.push(Math.round(performance.now() - t0) + ' ' + d + ' ' + ty + ' ' + k + ' ' + JSON.stringify(x ?? {})); })()`);
const snap = async (p) => JSON.parse(await p.ev(`(() => { const m = window.__game.scene.getScene('Match'); const s = m.ball.s; return JSON.stringify({ ph: m.phase, hit: m.lastHitter, x: Math.round(s.x), y: Math.round(s.y), z: Math.round(s.z), sc: m.score.points + '/' + m.score.games }); })()`));
// la reconexión real va al servidor de producción; en la prueba se reemplaza por la misma lógica hacia el servidor local
if (process.env.DROP) {
  console.log(await B.ev(`(async () => {
    const e = await import('/src/net/__e2e.ts');
    const { EV } = await import('/src/net/protocol.ts');
    const net = window.__net;
    net.onDrop = async function () {
      if (this.ended || this.reconnecting) return;
      this.reconnecting = true;
      this.handlers?.onReconnecting?.();
      await new Promise((r) => setTimeout(r, 4000));
      const next = await e.make('http://127.0.0.1:3002');
      for (const [ev, f] of [...this.early, ...this.bound]) { this.tr.off(ev, f); next.on(ev, f); }
      this.tr = next;
      window.__tr = next;
      next.on(EV.RESUMED, (m) => { this.reconnecting = false; window.__resumed = true; this.handlers?.onReconnected?.(m.score); });
      next.on(EV.ERROR, (m) => { window.__resumeErr = JSON.stringify(m); });
      next.emit(EV.RESUME, { roomId: this.roomId, token: this.token });
    };
    return 'parche de reconexión listo';
  })()`));
}
let bad = 0, worst = 0, rally = 0;
for (let i = 0; i < 120; i++) {
  await sleep(400);
  const a = await snap(A);
  const b = await snap(B);
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  if (a.sc !== b.sc) console.log(i, 'MARCADOR DISTINTO', a.sc, b.sc);
  if (a.ph === 'rally' && b.ph === 'rally') {
    rally++;
    worst = Math.max(worst, d);
    if (d > 250) {
      bad++;
      if (bad <= 3) {
        console.log(i, 'DESINCRONÃA', JSON.stringify(a), JSON.stringify(b), 'd=' + Math.round(d));
        console.log('  H log:', await A.ev('window.__log.slice(-6).join(" | ")'));
        console.log('  G log:', await B.ev('window.__log.slice(-6).join(" | ")'));
      }
    }
  }
  if (process.env.DROP) {
    if (i === 20) { console.log('corta al invitado'); await B.ev('window.__tr.socket.io.engine.close()'); }
    if (i >= 20 && i % 3 === 0 && i <= 60) {
      const hostAlly = await A.ev('window.__game.scene.getScene("Match").allyRemote');
      const guestUp = await B.ev('window.__tr.connected');
      const guestPh = await B.ev('(() => { const m = window.__game.scene.getScene("Match"); return m && m.sys.isActive() ? m.phase : "none"; })()');
      console.log(i, 'host allyRemote=', hostAlly, ' invitado conectado=', guestUp, ' fase invitado=', guestPh, ' resumed=', await B.ev('window.__resumed'), ' err=', await B.ev('window.__resumeErr'));
    }
  }
  if (i === 40) { await A.shot('x'); await B.shot('x'); }
}
console.log('muestras en juego:', rally, ' con desincronÃ­a >200px:', bad, ' peor:', Math.round(worst));
console.log('marcador final H:', (await snap(A)).sc, ' G:', (await snap(B)).sc);
console.log('errores:', [...A.logs, ...B.logs].join('\n') || '(ninguno)');
A.close();
B.close();
process.exit(0);
