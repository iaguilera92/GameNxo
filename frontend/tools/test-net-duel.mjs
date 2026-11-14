// Pruebas del DUELO RED (lógica pura). Uso: node tools/test-net-duel.mjs
import assert from 'node:assert/strict';
import {
  NET_DUEL,
  NO_TAP,
  botTapMs,
  isDecisive,
  msTier,
  ringMsOf,
  tapIsEarly,
  cleanPlan,
  duelHitSide,
  duelLungeHit,
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
test('activa: los dos en la red y la pelota a punto de llegar', () => assert.equal(shouldStartDuel(base), true));
test('no activa: los DOS tienen que estar cerca de la red (<= triggerDist de media cancha); nadie corre a ella para el duelo', () => {
  const lim = NET_DUEL.triggerDist * 470;
  assert.equal(shouldStartDuel({ ...base, botNetDist: lim + 1 }), false);
  assert.equal(shouldStartDuel({ ...base, playerNetDist: lim + 1 }), false);
  assert.equal(shouldStartDuel({ ...base, playerNetDist: lim, botNetDist: lim }), true); // justo en el límite
  assert.equal(shouldStartDuel({ ...base, receiver: 'bot', playerNetDist: lim + 1 }), false); // da igual quién reciba
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
  assert.equal(shouldStartDuel({ ...far, shots: 500, botNetDist: NET_DUEL.triggerDist * 470 + 1 }), false); // y solo si los dos están en la red
});
test('SHOW: cada uno cambia de lado en cada golpe suyo y la pelota cruza en diagonal; hay estiradas en el peloteo', () => {
  const sides = [0, 1, 2, 3, 4, 5].map(duelHitSide);
  assert.deepEqual(sides, [1, -1, -1, 1, 1, -1]);
  assert.notEqual(sides[0], sides[2]); // el mismo jugador cambia de lado
  assert.notEqual(sides[1], sides[3]);
  assert.notEqual(sides[0], sides[1]); // y el golpe cruza la red de un lado al otro
  for (let r = 0; r < 3; r++) assert.ok([0, 1, 2].some((j) => duelLungeHit(r, j)) === (r < 2), `estirada en la ronda ${r}`);
  assert.equal(duelLungeHit(NET_DUEL.showRound, 1) && duelLungeHit(NET_DUEL.showRound, 2), true);
});
// ---- calendario
test('siempre 3 rondas, con 2 o 3 golpes de peloteo cada una', () => {
  assert.equal(NET_DUEL.rounds, 3);
  for (let i = 0; i < 200; i++) {
    const plan = rollPlan(Math.random);
    assert.equal(plan.length, 3);
    for (const n of plan) assert.ok(n === 2 || n === 3, `golpes ${n}`);
    assert.equal(plan[NET_DUEL.showRound], 3, 'antes del segundo aro, 3 peloteos rápidos');
    const sch = duelSchedule(plan);
    assert.equal(sch.rounds.length, 3);
    sch.rounds.forEach((r, k) => assert.equal(r.hitAt.length, plan[k]));
  }
});
test('cleanPlan corrige lo que llega por la red (siempre 3 rondas de 2-3 golpes)', () => {
  assert.deepEqual(cleanPlan([2, 3, 2]), [2, 3, 2]);
  assert.deepEqual(cleanPlan([9, 0, NaN]), [3, 3, 2]); // la ronda del show (2ª) siempre es de 3 golpes
  assert.deepEqual(cleanPlan([]), [2, 3, 2]);
  assert.deepEqual(cleanPlan([3, 3, 3, 3, 3]), [3, 3, 3]);
});
test('las rondas van seguidas: cada una empieza cuando se cierra el aro de la anterior; el aro dura ringMsOf(ronda)', () => {
  const { rounds, total } = duelSchedule([2, 3, 2]);
  assert.equal(rounds[0].start, 0);
  rounds.forEach((r, k) => {
    assert.equal(r.close - r.ringStart, ringMsOf(k));
    assert.equal(r.ringMs, ringMsOf(k));
    assert.ok(r.hitAt[0] >= r.start + (k === 0 ? NET_DUEL.leadMs : NET_DUEL.leadAfterMs) - 1e-9);
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
test('ARO QUE SE ACELERA: 1100, 900 y 700 ms (cada ronda más rápido)', () => {
  assert.deepEqual([0, 1, 2].map(ringMsOf), [1100, 900, 700]);
  assert.ok(ringMsOf(0) > ringMsOf(1) && ringMsOf(1) > ringMsOf(2));
  assert.equal(ringMsOf(9), 700); // fuera de rango: la última
  assert.equal(ringMsOf(-1), 1100);
  const s = duelSchedule([3, 3, 3]).rounds;
  s.forEach((r, k) => assert.equal(r.close - r.ringStart, [1100, 900, 700][k]));
});
test('cada ronda dura entre 1,3 y 2,3 s (2-3 golpes + su aro)', () => {
  for (let k = 0; k < 3; k++) {
    const two = duelSchedule([2, 3, 2]).rounds[k];
    const three = duelSchedule([3, 3, 3]).rounds[k];
    assert.ok(two.close - two.start >= 1300 && three.close - three.start <= 2300, `ronda ${k}`);
  }
});
test('el peloteo de las rondas 2 y 3 espera a que se decida la anterior (se sabe quién ganó antes del primer golpe)', () => {
  assert.ok(NET_DUEL.leadAfterMs >= NET_DUEL.lateMs + NET_DUEL.graceMs);
});
// ---- toques (precisión al ms)
test('error del toque en ms: negativo antes del cierre, positivo después', () => {
  assert.equal(tapDiffMs(1990, 2000), -10);
  assert.equal(tapDiffMs(2012, 2000), 12);
  assert.equal(tapDiffMs(2000, 2000), 0);
});
test('ventana de toques: desde que empieza el aro hasta lateMs después del cierre (según el aro de la ronda)', () => {
  assert.equal(tapInWindow(-1100), true);
  assert.equal(tapInWindow(-1101), false);
  assert.equal(tapInWindow(-700, 700), true);
  assert.equal(tapInWindow(-701, 700), false);
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
// ---- indicador de precisión, toque temprano, ronda decisiva
test('color del indicador por ms: verde <= 30, amarillo <= 90, rojo más lejos (antes o después del cierre)', () => {
  assert.equal(NET_DUEL.msGood, 30);
  assert.equal(NET_DUEL.msOk, 90);
  for (const [ms, t] of [[0, 'good'], [12, 'good'], [-30, 'good'], [30, 'good'], [31, 'ok'], [-31, 'ok'], [90, 'ok'], [-90, 'ok'], [91, 'bad'], [-91, 'bad'], [150, 'bad'], [-400, 'bad']]) assert.equal(msTier(ms), t, String(ms));
  assert.equal(msTier(40), msTier(-40)); // tarde o pronto, la misma distancia = el mismo color
  assert.equal(diffLabel(40), '+40 ms'); // después del cierre: +
  assert.equal(diffLabel(-40), '−40 ms'); // antes: −
});
test('toque demasiado PRONTO (antes de earlyMin del recorrido del aro) = fallo, en cada aro', () => {
  for (let k = 0; k < 3; k++) {
    const ring = ringMsOf(k);
    const lim = -ring * (1 - NET_DUEL.earlyMin); // justo en earlyMin del recorrido
    assert.equal(tapIsEarly(lim, ring), false, 'justo en el límite todavía vale');
    assert.equal(tapIsEarly(lim - 1, ring), true);
    assert.equal(tapIsEarly(-ring, ring), true); // nada más empezar
    assert.equal(tapIsEarly(0, ring), false);
    assert.equal(tapIsEarly(NET_DUEL.lateMs, ring), false);
    assert.equal(tapIsEarly(-50, ring), false);
  }
  // un toque fallado cuenta como sin toque: la ronda es del otro
  assert.equal(roundWinner(null, 80), 'bot');
  assert.equal(roundWinner(-5, null), 'player');
  assert.equal(roundWinner(null, null), 'tie'); // si ninguno toca, empate
});
test('RONDA DECISIVA solo con 1-1 antes de la tercera', () => {
  assert.equal(isDecisive(['player', 'bot']), true);
  assert.equal(isDecisive(['bot', 'player']), true);
  assert.equal(isDecisive(['player', 'player']), false);
  assert.equal(isDecisive(['bot', 'bot']), false);
  assert.equal(isDecisive(['tie', 'tie']), false);
  assert.equal(isDecisive(['player', 'tie']), false);
  assert.equal(isDecisive(['tie', 'bot']), false);
  assert.equal(isDecisive(['player']), false);
  assert.equal(isDecisive([null, null]), false);
  assert.equal(isDecisive([]), false);
});
test('el bot nunca toca "pronto" ni fuera de la ventana de su aro (700 / 900 / 1100)', () => {
  for (let k = 0; k < 3; k++) {
    const ring = ringMsOf(k);
    for (const lv of [0, 0.5, 1]) for (let i = 0; i < 1500; i++) {
      const d = botTapMs(lv, Math.random, ring);
      if (d === null) continue;
      assert.ok(tapInWindow(d, ring), 'fuera de la ventana: ' + d);
      assert.equal(tapIsEarly(d, ring), false, 'el bot tocó pronto: ' + d);
    }
  }
});
test('el duelo completo sigue por debajo de 8 s (peor caso con aros 1100 / 900 / 700)', () => {
  const total = duelSchedule([3, 3, 3]).total;
  assert.equal(total, 80 + 690 + 1100 + (210 + 690 + 900) + (210 + 690 + 700));
  assert.ok(duelWorstMs() <= NET_DUEL.maxMs, 'peor caso ' + duelWorstMs());
  assert.ok(duelWorstMs() < 8000);
});
console.log(`\n${ok} pruebas OK`);
