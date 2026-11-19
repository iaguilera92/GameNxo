// Pruebas del MODO RIESGO x2 (domain/riskMode.ts + su uso en domain/ranked.ts). Uso: node tools/test-risk-mode.mjs
import { register } from 'node:module';
import assert from 'node:assert/strict';

const hook = `
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith('./') || spec.startsWith('../')) && !/\\.[cm]?[jt]s$/.test(spec)) {
    try { return await next(spec + '.ts', ctx); } catch {}
  }
  return next(spec, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);

const { newPlayer, clonePlayer } = await import('../src/domain/player.ts');
const R = await import('../src/domain/ranked.ts');
const K = await import('../src/domain/riskMode.ts');
const { migratePlayer } = await import('../src/domain/migrate.ts');

let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};

// Chile en noviembre = UTC-3. Lunes 16-11-2026 12:00 Chile; martes 17; lunes siguiente 23-11
const H = 3_600_000, MIN = 60_000, D = 24 * H;
const MON = Date.UTC(2026, 10, 16, 15);
const TUE = MON + D;
const NEXT_MON = MON + 7 * D;
const DUR = K.RISK_MODE.durationMs;

function player(coins = 10_000) {
  const p = newPlayer();
  p.level = 20;
  p.coins = coins;
  return R.syncRanked(p, MON);
}
/** activa como lo haría el servidor y guarda en la cuenta */
function withRisk(s, at = MON) {
  const a = K.activateRisk(s.riskMode, at);
  assert.ok(a.ok, a.error);
  return K.applyServerRisk(s, a.state);
}
const play = (s, outcome, bet, enterAt, settleAt = enterAt, id = Math.random().toString(36).slice(2)) => {
  const e = R.enterRanked(s, id, bet, enterAt);
  assert.ok(e.ok, `entrada: ${e.error}`);
  const r = R.settleRanked(e.state, id, outcome, settleAt);
  assert.ok(r.ok);
  return { e, r };
};

console.log('MODO RIESGO x2');

test('calendario: lunes de Chile (corte 23:59) y semana', () => {
  assert.equal(K.isRiskDay(MON), true);
  assert.equal(K.isRiskDay(TUE), false);
  assert.equal(K.isRiskDay(MON - D), false, 'domingo');
  // domingo 23:59 Chile ya es el ciclo del lunes (mismo corte que la semana Ranked)
  assert.equal(K.isRiskDay(Date.UTC(2026, 10, 16, 2, 59)), true);
  assert.equal(K.isRiskDay(Date.UTC(2026, 10, 17, 2, 59)), false, 'lunes 23:59 ya es martes');
  assert.equal(K.riskWeekAt(MON), '2026-11-16');
  assert.equal(K.riskWeekAt(TUE + 3 * D), '2026-11-16');
  assert.equal(K.riskWeekAt(NEXT_MON), '2026-11-23');
  assert.equal(K.riskWeekAt(MON), R.weekIdAt(MON), 'misma semana que Ranked');
});

test('disponible el lunes sin usar; cerrado los demás días', () => {
  assert.equal(K.riskStatus(null, MON).phase, 'available');
  assert.equal(K.riskStatus(null, TUE).phase, 'closed');
  assert.equal(K.riskStatus(undefined, MON).multiplier, 1, 'disponible no es activo');
});

test('activación un lunes; martes se rechaza', () => {
  const a = K.activateRisk(null, MON);
  assert.ok(a.ok);
  assert.deepEqual(a.state, { week: '2026-11-16', activatedAt: MON });
  assert.deepEqual(K.activateRisk(null, TUE), { ok: false, error: 'not_monday' });
});

test('rechazo de la segunda activación de la semana (activo y ya terminado)', () => {
  const st = K.activateRisk(null, MON).state;
  assert.deepEqual(K.activateRisk(st, MON + MIN), { ok: false, error: 'active' });
  assert.deepEqual(K.activateRisk(st, MON + DUR + MIN), { ok: false, error: 'already_used' });
  assert.deepEqual(K.activateRisk(st, MON + 8 * H), { ok: false, error: 'already_used' });
});

test('dura exactamente 10 minutos y se apaga solo', () => {
  const st = K.activateRisk(null, MON).state;
  assert.equal(K.riskStatus(st, MON).phase, 'active');
  assert.equal(K.riskStatus(st, MON).msLeft, 10 * MIN);
  assert.equal(K.riskStatus(st, MON + DUR - 1).phase, 'active');
  assert.equal(K.riskStatus(st, MON + DUR - 1).multiplier, 2);
  const end = K.riskStatus(st, MON + DUR);
  assert.equal(end.phase, 'used');
  assert.equal(end.multiplier, 1);
  assert.equal(K.riskStatus(st, TUE).phase, 'closed');
});

test('reconexión: el tiempo restante es el real (no se pausa al salir)', () => {
  let s = withRisk(player());
  // cierra el juego 4 min; al volver (datos guardados y migrados) quedan 6 min
  const saved = JSON.parse(JSON.stringify(s));
  const back = migratePlayer(saved);
  assert.deepEqual(back.riskMode, s.riskMode);
  const st = K.riskStatus(back.riskMode, MON + 4 * MIN);
  assert.equal(st.phase, 'active');
  assert.equal(st.msLeft, 6 * MIN);
  assert.equal(K.formatRiskLeft(st.msLeft), '6:00');
  assert.equal(K.formatRiskLeft(61_001), '1:01');
});

test('activación un lunes tarde sigue sus 10 min aunque pase la medianoche', () => {
  const late = Date.UTC(2026, 10, 17, 2, 55); // lunes 23:55 Chile
  const st = K.activateRisk(null, late).state;
  assert.equal(K.riskStatus(st, late + 6 * MIN).phase, 'active');
  assert.equal(K.riskStatus(st, late + DUR).phase, 'closed');
});

test('nueva disponibilidad el lunes siguiente', () => {
  const st = K.activateRisk(null, MON).state;
  assert.equal(K.riskStatus(st, NEXT_MON).phase, 'available');
  const b = K.activateRisk(st, NEXT_MON);
  assert.ok(b.ok);
  assert.equal(b.state.week, '2026-11-23');
});

test('apuesta x1 con evento: descuenta y paga el doble (ejemplo del pedido: 10.000 / 500)', () => {
  const s = withRisk(player(10_000));
  const e = R.enterRanked(s, 'a1', 1, MON + MIN);
  assert.ok(e.ok);
  assert.equal(e.entry, 1000);
  assert.equal(e.prize, 2000);
  assert.equal(e.risk, 2);
  assert.equal(e.state.coins, 9000);
  assert.equal(e.state.ranked.pending.risk, 2);
  const w = R.settleRanked(e.state, 'a1', 'win', MON + 2 * MIN);
  assert.equal(w.state.coins, 11_000, 'global 11.000');
  assert.equal(w.state.ranked.weekNet, 1000, 'semanal +1.000');
  assert.equal(w.settlement.delta, 1000);
  assert.equal(w.settlement.risk, 2);
  const l = R.settleRanked(e.state, 'a1', 'loss', MON + 2 * MIN);
  assert.equal(l.state.coins, 9000, 'global 9.000');
  assert.equal(l.settlement.delta, -1000);
});

test('apuesta x2 con evento: entrada 2.000 y premio 4.000 (Bronce)', () => {
  const s = withRisk(player(10_000));
  const { e, r } = play(s, 'win', 2, MON + MIN);
  assert.equal(e.entry, 2000);
  assert.equal(e.state.coins, 8000);
  assert.equal(r.state.coins, 12_000);
  assert.equal(r.state.ranked.weekNet, 2000);
  const lost = play(s, 'loss', 2, MON + MIN).r;
  assert.equal(lost.state.coins, 8000);
  assert.equal(lost.settlement.delta, -2000);
});

test('derrota con evento resta del resultado semanal el doble (nunca baja de 0, regla de la liga)', () => {
  let s = withRisk(player(10_000));
  s = play(s, 'win', 1, MON + MIN).r.state; // neto +1.000
  s = play(s, 'win', 1, MON + MIN).r.state; // neto +2.000
  const l = play(s, 'loss', 1, MON + 2 * MIN).r;
  assert.equal(l.state.ranked.weekNet, 1000, '2.000 − 1.000');
  assert.equal(l.state.coins, 11_000);
  const l2 = play(l.state, 'loss', 2, MON + 2 * MIN).r;
  assert.equal(l2.state.ranked.weekNet, 0, 'mínimo 0 (docs/RANKED-V2.md)');
});

test('sin evento: todo x1; una partida empezada antes del evento no se duplica al liquidar durante él', () => {
  const s0 = player(10_000);
  const e = R.enterRanked(s0, 'b1', 1, MON - MIN);
  assert.equal(e.entry, 500);
  const s1 = withRisk(e.state, MON); // se activa con la partida en curso
  const w = R.settleRanked(s1, 'b1', 'win', MON + MIN);
  assert.equal(w.settlement.prize, 1000, 'paga x1: el multiplicador es el de la entrada');
  assert.equal(w.state.coins, 10_500);
});

test('una partida empezada durante el evento cobra x2 aunque termine después, y una sola vez', () => {
  const s = withRisk(player(10_000));
  const e = R.enterRanked(s, 'c1', 1, MON + DUR - MIN);
  const w = R.settleRanked(e.state, 'c1', 'win', MON + DUR + 5 * MIN);
  assert.equal(w.state.coins, 11_000);
  const again = R.settleRanked(w.state, 'c1', 'win', MON + DUR + 6 * MIN);
  assert.equal(again.settlement.duplicate, true);
  assert.equal(again.state.coins, 11_000, 'sin pago doble');
});

test('al terminar el evento las apuestas vuelven a x1', () => {
  const s = withRisk(player(10_000));
  const e = R.enterRanked(s, 'd1', 1, MON + DUR);
  assert.equal(e.entry, 500);
  assert.equal(e.risk, 1);
});

test('saldo insuficiente para la entrada doble: no entra', () => {
  const s = withRisk(player(900));
  const e = R.enterRanked(s, 'e1', 1, MON + MIN);
  assert.deepEqual(e, { ok: false, error: 'not_enough_coins' });
});

test('la vista Ranked muestra las apuestas x2 y el estado del evento', () => {
  const s = withRisk(player(10_000));
  const v = R.rankedView(s, MON + MIN);
  assert.equal(v.risk.phase, 'active');
  assert.deepEqual(v.stakes.map((x) => [x.bet, x.entry, x.prize]), [[1, 1000, 2000], [2, 2000, 4000]]);
  const v1 = R.rankedView(s, TUE);
  assert.deepEqual(v1.stakes.map((x) => [x.bet, x.entry, x.prize]), [[1, 500, 1000], [2, 1000, 2000]]);
});

test('el cliente no puede manipular el multiplicador', () => {
  const s = player(10_000);
  // 1) no hay parámetro de multiplicador: un 5.º argumento se ignora
  const e = R.enterRanked(s, 'f1', 1, MON, { risk: 2, multiplier: 10 });
  assert.equal(e.entry, 500);
  // 2) un pending manipulado en los datos guardados se limita a 1 o 2 y no cambia la entrada guardada
  const raw = clonePlayer(e.state);
  raw.ranked.pending.risk = 50;
  const m = migratePlayer(JSON.parse(JSON.stringify(raw)));
  assert.equal(m.ranked.pending.risk, 1);
  // 3) una activación inventada fuera del lunes no activa nada
  const fake = { ...s, riskMode: { week: '2026-11-16', activatedAt: TUE } };
  assert.equal(R.enterRanked(fake, 'f2', 1, TUE + MIN).entry, 500, 'activación fuera del lunes: x1');
  const fake2 = { ...s, riskMode: { week: '2026-11-09', activatedAt: MON } };
  assert.equal(R.enterRanked(fake2, 'f4', 1, MON + MIN).entry, 500, 'semana que no corresponde: x1');
  const fixed = K.applyServerRisk(fake, null); // el servidor dice "sin activación"
  assert.equal(fixed.riskMode, undefined);
  assert.equal(R.enterRanked(fixed, 'f3', 1, TUE + MIN).entry, 500);
  // 4) datos basura
  assert.equal(K.sanitizeRisk({ week: 'x', activatedAt: 1 }), null);
  assert.equal(K.sanitizeRisk({ week: '2026-11-16', activatedAt: -5 }), null);
});

test('no afecta a nada fuera del Ranked: recompensa semanal x1', () => {
  let s = withRisk(player(10_000));
  for (let i = 0; i < 3; i++) s = play(s, 'win', 1, MON + MIN).r.state;
  const closed = R.syncRanked(s, NEXT_MON);
  const w = closed.ranked.rewards.at(-1);
  assert.equal(w.net, 3000);
  const plain = (() => {
    let p = player(10_000);
    for (let i = 0; i < 3; i++) p = play(p, 'win', 1, MON + MIN).r.state;
    return R.syncRanked(p, NEXT_MON).ranked.rewards.at(-1);
  })();
  assert.equal(w.coins, plain.coins, 'mismo premio de liga (sin x2)');
});

console.log(`\n${ok} pruebas OK`);
