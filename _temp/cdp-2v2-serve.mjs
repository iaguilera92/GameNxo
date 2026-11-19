// Prueba temporal (no es del juego): 2v2 online con DOS navegadores. Comprueba la ROTACIÓN AL AZAR DEL SAQUE entre los dos humanos:
// quién saca en cada juego, que solo uno tenga el saque, posiciones iguales en los dos teléfonos, que nada se quede atascado,
// y (TIMEOUT=1) que si el invitado no saca a tiempo el host juzga la falta / doble falta.
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SAMPLES = Number(process.env.SAMPLES || 500);
const TIMEOUT = !!process.env.TIMEOUT;

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
  tr.emit('mm:find', { mode: '2v2', profile: { name: '${nm}', level: 5, skin: 'nxo' } });
  return 'buscando';
})()`);
console.log(await join2v2(A, 'Ana'));
await sleep(600);
console.log(await join2v2(B, 'Beto'));
await sleep(4000);
for (const p of [A, B]) await p.ev(`(() => { const m = window.__game.scene.getScene('Match'); m.autoPlay = true; window.__log = []; const t0 = performance.now(); window.__net.trace = (d, ty, k, x) => { if (ty !== 'state' && k !== 'ping' && k !== 'pong' && k !== 'sprint-start' && k !== 'sprint-end') { window.__log.push(Math.round(performance.now() - t0) + ' ' + d + ' ' + ty + ' ' + k + ' ' + JSON.stringify(x ?? {})); if (window.__log.length > 300) window.__log.shift(); } }; })()`);

const snap = async (p) => JSON.parse(await p.ev(`(() => { const m = window.__game.scene.getScene('Match'); return JSON.stringify({ ph: m.phase, srv: m.server, ms: m.meServes, gi: m.score.gameIndex, sc: m.score.points + '/' + m.score.games, px: Math.round(m.player.x), py: Math.round(m.player.y), ax: Math.round(m.ally.x), ay: Math.round(m.ally.y), faults: m.faults, hit: m.lastHitter, tag: m.srvActor() === m.player ? 'yo' : m.srvActor() === m.ally ? 'comp' : 'bot' }); })()`));
const serveStats = { hostGames: new Set(), guestGames: new Set(), botGames: new Set() };
let bothServe = 0, noneServe = 0, posBad = 0, posOk = 0, stall = 0, scoreDiff = 0, timeoutTests = 0, tagBad = 0;
let phaseSince = { t: Date.now(), key: '' };
let lastLog = '';
for (let i = 0; i < SAMPLES; i++) {
  await sleep(250);
  const [a, b] = await Promise.all([snap(A), snap(B)]);
  const key = a.ph + '/' + b.ph + '/' + a.gi + '/' + a.sc;
  if (key !== phaseSince.key) phaseSince = { t: Date.now(), key };
  if ((a.ph === 'serve' || a.ph === 'toss') && Date.now() - phaseSince.t > 25000) { stall++; if (stall <= 2) console.log('ATASCADO', JSON.stringify(a), JSON.stringify(b)); phaseSince.t = Date.now(); }
  if (a.sc !== b.sc && a.ph !== 'pointover' && b.ph !== 'pointover') scoreDiff++;
  if (a.ph === 'serve' && b.ph === 'serve') {
    if (a.srv === 'player') {
      if (a.ms && b.ms) bothServe++;
      else if (!a.ms && !b.ms) noneServe++;
      else (a.ms ? serveStats.hostGames : serveStats.guestGames).add(a.gi);
      // la etiqueta del sacador debe ser él mismo en su teléfono y su compañero en el otro
      if (a.ms && !(a.tag === 'yo' && b.tag === 'comp')) tagBad++;
      if (b.ms && !(b.tag === 'yo' && a.tag === 'comp')) tagBad++;
    } else {
      if (a.ms || b.ms) bothServe++;
      serveStats.botGames.add(a.gi);
    }
    // posiciones de saque: mi jugador en un teléfono = su compañero en el otro
    // el sacador queda quieto: su sitio debe ser el mismo en los dos teléfonos (el compañero ya corre mientras se saca)
    let ds = 0;
    if (a.srv === 'player') ds = a.ms ? Math.hypot(a.px - b.ax, a.py - b.ay) : Math.hypot(a.ax - b.px, a.ay - b.py);
    else ds = Math.hypot(a.px - b.ax, a.py - b.ay) < 400 ? 0 : 999;
    if (ds > 25) { posBad++; if (posBad <= 3) console.log('SACADOR EN OTRO SITIO', ds | 0, JSON.stringify(a), JSON.stringify(b)); } else posOk++;
    // prueba del tiempo: el invitado no saca (autoPlay apagado) mientras le toca
    if (TIMEOUT && b.ms && timeoutTests < 2) {
      timeoutTests++;
      console.log(`--- el invitado NO saca (juego ${b.gi}, falta ${a.faults}) ---`);
      await B.ev(`window.__game.scene.getScene('Match').autoPlay = false`);
      let before = a.sc;
      for (let k = 0; k < 90; k++) {
        await sleep(250);
        const [a2, b2] = await Promise.all([snap(A), snap(B)]);
        if (k % 8 === 0) console.log(`   ${k * 250}ms host: ${a2.ph} faults${a2.faults} ${a2.sc} | invitado: ${b2.ph} faults${b2.faults} ${b2.sc}`);
        if (a2.sc !== before && a2.ph === 'pointover') { console.log('   punto decidido:', a2.sc, '/', b2.sc); break; }
      }
      await B.ev(`window.__game.scene.getScene('Match').autoPlay = true`);
    }
  }
  // CUT=1: al invitado (que iba a sacar) se le corta la conexión justo antes de sacar: el host debe sacar él; al volver, todo sigue
  if (process.env.CUT && b.ms && a.ph === 'serve' && !globalThis.__cut) {
    globalThis.__cut = true;
    console.log(`--- se corta al invitado cuando le tocaba sacar (juego ${b.gi}) ---`);
    await B.ev(`(async () => {
      const e = await import('/src/net/__e2e.ts');
      const { EV } = await import('/src/net/protocol.ts');
      const net = window.__net;
      net.onDrop = async function () {
        if (this.ended || this.reconnecting) return;
        this.reconnecting = true;
        this.handlers?.onReconnecting?.();
        await new Promise((r) => setTimeout(r, 5000));
        const next = await e.make('http://127.0.0.1:3002');
        for (const [ev, f] of [...this.early, ...this.bound]) { this.tr.off(ev, f); next.on(ev, f); }
        this.tr = next;
        next.on(EV.RESUMED, (m) => { this.reconnecting = false; window.__resumed = true; this.handlers?.onReconnected?.(m.score); });
        next.emit(EV.RESUME, { roomId: this.roomId, token: this.token });
      };
      window.__tr.socket.io.engine.close();
      return 1;
    })()`);
    for (let k = 0; k < 60; k++) {
      await sleep(500);
      const h = await snap(A);
      const gUp = await B.ev('window.__tr.connected');
      const gr = await B.ev('window.__resumed');
      if (k % 4 === 0) console.log(`   ${k * 500}ms host: ${h.ph} H.sirve:${h.ms} ${h.sc} | invitado conectado: ${gUp} vuelto: ${gr}`);
    }
  }
  // LONG=1: cuando saca el invitado, el host alarga el saque (sale largo = falta; dos seguidas = doble falta)
  if (process.env.LONG && a.srv === 'player' && !a.ms && a.ph === 'rally') {
    const r = await A.ev(`(() => { const m = window.__game.scene.getScene('Match'); if (m.serving && m.phase === 'rally' && m.bounces === 0 && m.ball.s.x < 800) { m.ball.s.vx = 3400; return 'alargado f' + m.faults; } return ''; })()`);
    if (r) console.log('  ', r, '| host', a.sc, '| invitado', b.sc, 'juego', a.gi);
  }
  if (i % 40 === 0) { const l = `${i} ${a.ph}/${b.ph} srv:${a.srv} H.sirve:${a.ms} G.sirve:${b.ms} ${a.sc}`; if (l !== lastLog) console.log(l); lastLog = l; }
  if (a.ph === 'over' || b.ph === 'over') { console.log('partido terminado', a.sc, b.sc); break; }
}
console.log('\nsaques del HOST en juegos:', [...serveStats.hostGames].join(',') || '-', ' | del INVITADO en juegos:', [...serveStats.guestGames].join(',') || '-', ' | juegos que saca un bot:', [...serveStats.botGames].join(',') || '-');
console.log('muestras con los dos sacando:', bothServe, ' con nadie sacando (le toca al equipo):', noneServe);
console.log('posiciones de saque iguales:', posOk, ' distintas:', posBad, ' | etiqueta SERVICIO mal:', tagBad);
console.log('atascos:', stall, ' marcador distinto fuera de pointover:', scoreDiff);
console.log('errores:', [...A.logs, ...B.logs].join('\n') || '(ninguno)');
A.close(); B.close(); process.exit(0);
