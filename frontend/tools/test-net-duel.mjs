// Pruebas del DUELO EN LA RED (lógica pura). Uso: node tools/test-net-duel.mjs
import assert from 'node:assert/strict';
import { NET_DUEL, botTapProgress, defaultAimSide, duelWinner, judgeTap, lobTarget, mirrorSide, ringProgress, shouldStartDuel, sideFromJoystick, volleyHitters } from '../src/logic/NetDuel.ts';

let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};

// ---- activación
const base = { rally: true, serveLock: false, used: false, busy: false, incapacitated: false, powerOrLob: false, playerNetDist: 60, botNetDist: 70, halfLen: 470, receiver: 'player', ballDist: 100, hitRange: 78 };
test('activa: los dos cerca de la red y la pelota a punto de llegar', () => assert.equal(shouldStartDuel(base), true));
test('no activa: uno lejos de la red (> 25 % de media cancha)', () => {
  assert.equal(shouldStartDuel({ ...base, botNetDist: 0.25 * 470 + 1 }), false);
  assert.equal(shouldStartDuel({ ...base, playerNetDist: 0.25 * 470 + 1 }), false);
  assert.equal(shouldStartDuel({ ...base, botNetDist: 0.25 * 470 }), true); // justo en el límite
});
test('no activa: en el saque / su devolución, fuera de peloteo, ya usado, ocupado, sin raqueta o con pelota de poder', () => {
  for (const k of ['serveLock', 'used', 'busy', 'incapacitated', 'powerOrLob']) assert.equal(shouldStartDuel({ ...base, [k]: true }), false, k);
  assert.equal(shouldStartDuel({ ...base, rally: false }), false);
});
test('no activa: la pelota no va hacia nadie o aún está lejos', () => {
  assert.equal(shouldStartDuel({ ...base, receiver: null }), false);
  assert.equal(shouldStartDuel({ ...base, ballDist: 78 * NET_DUEL.reachK + 1 }), false);
  assert.equal(shouldStartDuel({ ...base, ballDist: 78 * NET_DUEL.reachK }), true);
});
test('activa para el que recibe, sea el jugador o el bot', () => {
  assert.equal(shouldStartDuel({ ...base, receiver: 'bot' }), true);
});

// ---- aro y toques
test('recorrido del aro: 0 al inicio, 1 al cierre, nunca fuera de 0..1', () => {
  assert.equal(ringProgress(0), 0);
  assert.equal(ringProgress(NET_DUEL.faceMs), 1);
  assert.equal(ringProgress(NET_DUEL.faceMs * 2), 1);
  assert.equal(ringProgress(-50), 0);
  assert.ok(Math.abs(ringProgress(NET_DUEL.faceMs / 2) - 0.5) < 1e-9);
});
test('toque demasiado pronto = fallo; sin toque = none', () => {
  assert.equal(judgeTap(null), 'none');
  assert.equal(judgeTap(NET_DUEL.earlyMin - 0.01), 'early');
  assert.equal(judgeTap(NET_DUEL.earlyMin), 'ok');
  assert.equal(judgeTap(1), 'ok');
});

// ---- ganador
test('gana el toque más cerca del cierre (el de mayor recorrido), sea jugador o bot', () => {
  assert.deepEqual(duelWinner({ player: 0.97, bot: 0.8 }, 'bot'), { winner: 'player', reason: 'closer' });
  assert.deepEqual(duelWinner({ player: 0.6, bot: 0.95 }, 'player'), { winner: 'bot', reason: 'closer' });
});
test('el único toque válido gana aunque el otro no toque o toque demasiado pronto', () => {
  assert.deepEqual(duelWinner({ player: 0.5, bot: null }, 'bot'), { winner: 'player', reason: 'only' });
  assert.deepEqual(duelWinner({ player: 0.2, bot: 0.5 }, 'player'), { winner: 'bot', reason: 'only' });
});
test('empate: gana el que iba a recibir la pelota', () => {
  assert.deepEqual(duelWinner({ player: 0.9, bot: 0.9 }, 'bot'), { winner: 'bot', reason: 'tie' });
  assert.deepEqual(duelWinner({ player: 0.9, bot: 0.9 + NET_DUEL.tieEps / 2 }, 'player'), { winner: 'player', reason: 'tie' });
});
test('nadie toca, o los dos tocan demasiado pronto: gana el que iba a recibir', () => {
  assert.deepEqual(duelWinner({ player: null, bot: null }, 'player'), { winner: 'player', reason: 'none' });
  assert.deepEqual(duelWinner({ player: 0.1, bot: 0.2 }, 'bot'), { winner: 'bot', reason: 'none' });
});

// ---- bot
const seeded = (seed) => () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
test('bot: a más nivel, toca más cerca del cierre y falla menos', () => {
  const avg = (lv) => {
    const r = seeded(42);
    let n = 0,
      sum = 0,
      miss = 0;
    for (let i = 0; i < 4000; i++) {
      const p = botTapProgress(lv, r);
      if (p === null) miss++;
      else (sum += p), n++;
    }
    return { mean: sum / n, miss: miss / 4000 };
  };
  const lo = avg(0);
  const hi = avg(1);
  assert.ok(hi.mean > lo.mean + 0.1, `nivel alto ${hi.mean.toFixed(3)} vs bajo ${lo.mean.toFixed(3)}`);
  assert.equal(hi.miss, 0);
  assert.ok(lo.miss > 0.1 && lo.miss < 0.26, `fallos nivel 0: ${lo.miss.toFixed(3)}`);
  assert.ok(hi.mean > 0.9);
});
test('bot: el toque siempre queda entre 0 y 1', () => {
  const r = seeded(7);
  for (let i = 0; i < 2000; i++) {
    const p = botTapProgress(Math.random(), r);
    assert.ok(p === null || (p >= 0 && p <= 1));
  }
});
test('bot contra bot de nivel alto: casi siempre gana el de más nivel', () => {
  const r = seeded(99);
  let wins = 0;
  for (let i = 0; i < 2000; i++) {
    const a = botTapProgress(0.95, r);
    const b = botTapProgress(0.1, r);
    if (duelWinner({ player: a, bot: b }, 'bot').winner === 'player') wins++;
  }
  assert.ok(wins / 2000 > 0.7, `gana ${(wins / 20).toFixed(0)} %`);
});

// ---- intercambio
test('6 golpes alternados y el 6.º es siempre del ganador', () => {
  for (const w of ['player', 'bot']) {
    const h = volleyHitters(w);
    assert.equal(h.length, NET_DUEL.volleys);
    assert.equal(h[5], w);
    for (let i = 1; i < h.length; i++) assert.notEqual(h[i], h[i - 1]);
    assert.notEqual(h[0], w); // empieza el perdedor
  }
});

// ---- globo
test('lado por defecto: el contrario de donde está el rival', () => {
  assert.equal(defaultAimSide(500, 410), -1);
  assert.equal(defaultAimSide(300, 410), 1);
  assert.equal(defaultAimSide(410, 410), 1);
});
test('lado con el joystick: derecha / izquierda / sin elección', () => {
  assert.equal(sideFromJoystick(0.8), 1);
  assert.equal(sideFromJoystick(-0.8), -1);
  assert.equal(sideFromJoystick(0.1), null);
  assert.equal(sideFromJoystick(-0.29), null);
});
test('esquina del globo: fondo del campo del perdedor, dentro de la cancha, en el lado elegido', () => {
  const court = { left: 170, right: 1110 };
  const a = lobTarget('player', 1, court, 410, 180);
  assert.ok(a.x > 640 && a.x <= 1110 - NET_DUEL.lob.inset + 1e-9);
  assert.ok(a.y > 410 && a.y < 410 + 180);
  const b = lobTarget('bot', -1, court, 410, 180);
  assert.ok(b.x < 640 && b.x >= 170 + NET_DUEL.lob.inset - 1e-9);
  assert.ok(b.y < 410 && b.y > 410 - 180);
  // a la esquina: casi en la línea de fondo y casi en la lateral
  assert.ok(1110 - a.x <= 30 && 410 + 180 - a.y <= 30);
});
test('espejo del lado (red)', () => {
  assert.equal(mirrorSide(1), -1);
  assert.equal(mirrorSide(-1), 1);
});

console.log(`\n${ok} pruebas OK`);
