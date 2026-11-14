// Pruebas del DUELO RED (lógica pura). Uso: node tools/test-net-duel.mjs
import assert from 'node:assert/strict';
import {
  NET_DUEL,
  NO_TAP,
  botTapMs,
  cleanPlan,
  defaultAimSide,
  diffLabel,
  duelSchedule,
  duelWinner,
  duelWorstMs,
  lobFlightS,
  lobTarget,
  mirrorSide,
  rollPlan,
  roundFromWire,
  roundWinner,
  roundWire,
  shouldStartDuel,
  sideFromJoystick,
  tapDiffMs,
  tapInWindow,
} from '../src/logic/NetDuel.ts';
let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};
// ---- activación
const base = { rally: true, serveLock: false, used: false, busy: false, incapacitated: false, powerOrLob: false, playerNetDist: 60, botNetDist: 70, halfLen: 470, receiver: 'player', ballDist: 100, hitRange: 78, shots: 3 };
test('activa: el que recibe en la red y la pelota a punto de llegar', () => assert.equal(shouldStartDuel(base), true));
test('no activa: el que recibe lejos de la red (> 25 % de media cancha); el otro da igual (sube a la red)', () => {
  assert.equal(shouldStartDuel({ ...base, botNetDist: 0.25 * 470 + 1 }), true);
  assert.equal(shouldStartDuel({ ...base, playerNetDist: 0.25 * 470 + 1 }), false);
  assert.equal(shouldStartDuel({ ...base, playerNetDist: 0.25 * 470 }), true); // justo en el límite
});
test('no activa: en el saque / su devolución, fuera de peloteo, ya usado, ocupado, sin raqueta o con pelota de poder o globo', () => {
  for (const k of ['serveLock', 'used', 'busy', 'incapacitated', 'powerOrLob']) assert.equal(shouldStartDuel({ ...base, [k]: true }), false, k);
  assert.equal(shouldStartDuel({ ...base, rally: false }), false);
});
test('no activa: la pelota no va hacia nadie o aún está lejos', () => {
  assert.equal(shouldStartDuel({ ...base, receiver: null }), false);
  assert.equal(shouldStartDuel({ ...base, ballDist: 78 * NET_DUEL.reachK + 1 }), false);
  assert.equal(shouldStartDuel({ ...base, ballDist: 78 * NET_DUEL.reachK }), true);
});
test('un peloteo en la red NO se alarga: tras forceAfterShots golpes sale aunque la pelota esté lejos', () => {
  const far = { ...base, ballDist: 1e9 };
  assert.equal(shouldStartDuel({ ...far, shots: NET_DUEL.forceAfterShots - 1 }), false);
  assert.equal(shouldStartDuel({ ...far, shots: NET_DUEL.forceAfterShots }), true);
  assert.equal(shouldStartDuel({ ...far, shots: 500 }), true); // "cientos de pelotazos": sale
  assert.equal(shouldStartDuel({ ...far, shots: 500, used: true }), false); // pero una sola vez por punto
  assert.equal(shouldStartDuel({ ...far, shots: 500, playerNetDist: 0.25 * 470 + 1 }), false); // y solo si el que recibe está en la red
});
// ---- calendario
test('siempre 3 rondas, con 2 o 3 golpes de peloteo cada una', () => {
  assert.equal(NET_DUEL.rounds, 3);
  for (let i = 0; i < 200; i++) {
    const plan = rollPlan(Math.random);
    assert.equal(plan.length, 3);
    for (const n of plan) assert.ok(n === 2 || n === 3, `golpes ${n}`);
    const sch = duelSchedule(plan);
    assert.equal(sch.rounds.length, 3);
    sch.rounds.forEach((r, k) => assert.equal(r.hitAt.length, plan[k]));
  }
});
test('cleanPlan corrige lo que llega por la red (siempre 3 rondas de 2-3 golpes)', () => {
  assert.deepEqual(cleanPlan([2, 3, 2]), [2, 3, 2]);
  assert.deepEqual(cleanPlan([9, 0, NaN]), [3, 2, 2]);
  assert.deepEqual(cleanPlan([]), [2, 2, 2]);
  assert.deepEqual(cleanPlan([3, 3, 3, 3, 3]), [3, 3, 3]);
});
test('las rondas van seguidas: cada una empieza cuando se cierra el aro de la anterior; el aro dura ringMs', () => {
  const { rounds, total } = duelSchedule([2, 3, 2]);
  assert.equal(rounds[0].start, 0);
  rounds.forEach((r, k) => {
    assert.equal(r.close - r.ringStart, NET_DUEL.ringMs);
    assert.ok(r.hitAt[0] >= r.start + NET_DUEL.leadMs - 1e-9);
    for (let j = 1; j < r.hitAt.length; j++) assert.ok(Math.abs(r.hitAt[j] - r.hitAt[j - 1] - NET_DUEL.hitMs) < 1e-9);
    assert.ok(r.ringStart > r.hitAt[r.hitAt.length - 1]); // el aro sale después del último golpe
    if (k > 0) assert.equal(r.start, rounds[k - 1].close);
  });
  assert.equal(total, rounds[2].close);
});
test('el duelo NUNCA pasa de maxMs (8 s) ni de 3 rondas, ni en el peor caso (3 golpes por ronda)', () => {
  assert.ok(duelWorstMs() <= NET_DUEL.maxMs, `peor caso ${duelWorstMs()} ms`);
  assert.ok(duelWorstMs() < 8000);
  assert.ok(NET_DUEL.maxMs <= 8000);
  assert.equal(duelSchedule([3, 3, 3]).rounds.length, 3);
  // aunque llegue un plan con más golpes / más rondas, el calendario se queda en 3 rondas de 2-3 golpes
  assert.equal(duelSchedule([9, 9, 9, 9, 9]).rounds.length, 3);
  assert.ok(duelSchedule([9, 9, 9]).total <= duelSchedule([3, 3, 3]).total);
});
test('cada ronda dura ≈ 1,7 s (2-3 golpes + el aro de 1 s)', () => {
  const two = duelSchedule([2, 2, 2]).rounds[0];
  const three = duelSchedule([3, 3, 3]).rounds[0];
  assert.ok(two.close - two.start >= 1500 && three.close - three.start <= 1900);
});
// ---- toques (precisión al ms)
test('error del toque en ms: negativo antes del cierre, positivo después', () => {
  assert.equal(tapDiffMs(1990, 2000), -10);
  assert.equal(tapDiffMs(2012, 2000), 12);
  assert.equal(tapDiffMs(2000, 2000), 0);
});
test('ventana de toques: desde que empieza el aro hasta lateMs después del cierre', () => {
  assert.equal(tapInWindow(-NET_DUEL.ringMs), true);
  assert.equal(tapInWindow(-NET_DUEL.ringMs - 1), false);
  assert.equal(tapInWindow(0), true);
  assert.equal(tapInWindow(NET_DUEL.lateMs), true);
  assert.equal(tapInWindow(NET_DUEL.lateMs + 1), false);
});
test('gana la ronda el más cercano al cierre (por ms), sea antes o después', () => {
  assert.equal(roundWinner(12, -35), 'player');
  assert.equal(roundWinner(-35, 12), 'bot');
  assert.equal(roundWinner(-8, 40), 'player');
  assert.equal(roundWinner(90, -20), 'bot');
});
test('tieMs: diferencia de errores exactamente 5 ms = empate, 6 ms = gana el más cercano', () => {
  assert.equal(roundWinner(10, -15), 'tie');
  assert.equal(roundWinner(-10, 15), 'tie');
  assert.equal(roundWinner(10, -16), 'player');
  assert.equal(roundWinner(-16, 10), 'bot');
  assert.equal(roundWinner(20, 20), 'tie');
  assert.equal(roundWinner(20, -20), 'tie');
});
test('sin toque pierde la ronda; si ninguno toca, empate', () => {
  assert.equal(roundWinner(null, 150), 'bot');
  assert.equal(roundWinner(150, null), 'player');
  assert.equal(roundWinner(null, null), 'tie');
});
// ---- ganador del duelo
test('gana el duelo el que gane más rondas', () => {
  assert.equal(duelWinner(['player', 'player', 'bot'], 'bot'), 'player');
  assert.equal(duelWinner(['bot', 'tie', 'bot'], 'player'), 'bot');
  assert.equal(duelWinner(['player', 'tie', 'tie'], 'bot'), 'player');
});
test('si quedan igualados gana el que RECIBÍA la pelota cuando empezó (incluidos 3 empates)', () => {
  assert.equal(duelWinner(['player', 'bot', 'tie'], 'bot'), 'bot');
  assert.equal(duelWinner(['player', 'bot', 'tie'], 'player'), 'player');
  assert.equal(duelWinner(['tie', 'tie', 'tie'], 'bot'), 'bot');
  assert.equal(duelWinner(['tie', 'tie', 'tie'], 'player'), 'player');
});
// ---- bot
test('bot: a más nivel, error medio menor y menos toques fallidos; nunca fuera de la ventana', () => {
  const avg = (lv) => {
    let s = 0;
    let n = 0;
    let miss = 0;
    for (let i = 0; i < 4000; i++) {
      const d = botTapMs(lv, Math.random);
      if (d === null) miss++;
      else {
        assert.ok(tapInWindow(d), `fuera de la ventana: ${d}`);
        s += Math.abs(d);
        n++;
      }
    }
    return { err: s / n, miss: miss / 4000 };
  };
  const low = avg(0);
  const hi = avg(1);
  assert.ok(hi.err < low.err / 3, `nivel 1: ${hi.err.toFixed(0)} ms, nivel 0: ${low.err.toFixed(0)} ms`);
  assert.ok(hi.miss === 0 && low.miss > 0.08 && low.miss < 0.25);
});
test('bot nivel 1 casi siempre toca a menos de 40 ms del cierre', () => {
  let close = 0;
  for (let i = 0; i < 2000; i++) if (Math.abs(botTapMs(1, Math.random)) <= 40) close++;
  assert.ok(close / 2000 > 0.85);
});
// ---- globo disparado
test('lado del globo por defecto: el contrario de donde está el rival', () => {
  assert.equal(defaultAimSide(300, 200), -1);
  assert.equal(defaultAimSide(100, 200), 1);
});
test('lado con el joystick: zona muerta y sin elección', () => {
  assert.equal(sideFromJoystick(0.8), 1);
  assert.equal(sideFromJoystick(-0.8), -1);
  assert.equal(sideFromJoystick(0.1), null);
  assert.equal(sideFromJoystick(-0.29), null);
});
test('esquina del globo: fondo del campo del perdedor, dentro de la cancha', () => {
  const court = { left: 80, right: 1010 };
  const a = lobTarget('player', -1, court, 270, 190);
  assert.equal(a.x, court.right - NET_DUEL.lob.inset);
  assert.equal(a.y, 270 - (190 - NET_DUEL.lob.inset));
  const b = lobTarget('bot', 1, court, 270, 190);
  assert.equal(b.x, court.left + NET_DUEL.lob.inset);
  assert.equal(b.y, 270 + (190 - NET_DUEL.lob.inset));
});
test('vuelo del globo ajustado al rival: corriendo NO llega antes de caer (hace falta estirada), con la estirada sí', () => {
  const LUNGE = 78 * 1.9;
  for (const [dist, speed] of [[450, 330], [520, 330], [380, 250], [500, 200]]) {
    const T = lobFlightS(dist, speed, LUNGE);
    assert.ok(T >= NET_DUEL.lob.minS && T <= NET_DUEL.lob.maxS, `T=${T}`);
    if (T > NET_DUEL.lob.minS && T < NET_DUEL.lob.maxS) {
      assert.ok(T < dist / speed + NET_DUEL.lob.reactS, `corriendo llega antes: T=${T} run=${dist / speed}`);
      assert.ok(T > (dist - LUNGE) / speed, `ni con estirada: T=${T}`);
    }
  }
});
test('vuelo del globo: más lejos o rival más lento = más tiempo; siempre dentro de [minS, maxS]', () => {
  const LUNGE = 148;
  assert.ok(lobFlightS(600, 330, LUNGE) >= lobFlightS(450, 330, LUNGE));
  assert.ok(lobFlightS(450, 200, LUNGE) >= lobFlightS(450, 330, LUNGE));
  assert.equal(lobFlightS(10, 330, LUNGE), NET_DUEL.lob.minS);
  assert.equal(lobFlightS(5000, 10, LUNGE), NET_DUEL.lob.maxS);
});
// ---- red
test('el lado del globo se espeja entre teléfonos', () => {
  assert.equal(mirrorSide(-1), 1);
  assert.equal(mirrorSide(1), -1);
});
test('resultado de ronda por la red: el emisor ve lo contrario del receptor', () => {
  assert.equal(roundWire('player'), 1);
  assert.equal(roundWire('bot'), 2);
  assert.equal(roundWire('tie'), 0);
  // el emisor ganó (w = 1: su jugador) → para el receptor ganó el rival
  assert.equal(roundFromWire(roundWire('player')), 'bot');
  assert.equal(roundFromWire(roundWire('bot')), 'player');
  assert.equal(roundFromWire(roundWire('tie')), 'tie');
  assert.equal(NO_TAP, 9999);
});
test('texto del error en ms', () => {
  assert.equal(diffLabel(12), '+12 ms');
  assert.equal(diffLabel(-35), '−35 ms');
  assert.equal(diffLabel(0), '±0 ms');
  assert.equal(diffLabel(null), 'SIN TOQUE');
});
console.log(`\n${ok} pruebas OK`);
