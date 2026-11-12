// Pruebas de Ranked, rivales simulados y premio diario. Uso: node tools/test-ranked.mjs
// Los módulos de src/domain importan sin extensión (Vite): este cargador añade ".ts" al resolver.
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

const { newPlayer, clonePlayer, PLAYER_SCHEMA_VERSION } = await import('../src/domain/player.ts');
const R = await import('../src/domain/ranked.ts');
const C = await import('../src/domain/rankedConfig.ts');
const B = await import('../src/domain/rankedBots.ts');
const L = await import('../src/domain/dailyLogin.ts');
const { migratePlayer } = await import('../src/domain/migrate.ts');
const { RANK_UNLOCK_LEVEL } = await import('../src/domain/ranks.ts');
const { purchase } = await import('../src/domain/operations.ts');

let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};

// Horas fijas (Chile, UTC-3 en noviembre): miércoles 2026-11-04 12:00 y siguientes
const H = 3_600_000, D = 24 * H;
const WED = Date.UTC(2026, 10, 4, 15); // 12:00 Chile
const nextMonday = Date.UTC(2026, 10, 9, 15);
const nextMonth = Date.UTC(2026, 11, 2, 15);

function player({ level = 20, coins = 10_000 } = {}) {
  const p = newPlayer();
  p.level = level;
  p.coins = coins;
  return R.syncRanked(p, WED);
}
const play = (s, outcome, bet = 1, now = WED, id = Math.random().toString(36)) => {
  const e = R.enterRanked(s, id, bet, now);
  assert.ok(e.ok, `entrada: ${e.error}`);
  const r = R.settleRanked(e.state, id, outcome, now);
  assert.ok(r.ok);
  return r;
};

console.log('Ranked');
test('configuración válida y nivel de desbloqueo coherente', () => {
  assert.deepEqual(C.validateRankedConfig(), []);
  assert.equal(RANK_UNLOCK_LEVEL, C.RANKED.unlockLevel);
});

test('todos compiten desde el nivel 1 en Bronce y el saldo inicial alcanza para entrar', () => {
  const p = newPlayer();
  const q = R.syncRanked(p, WED);
  assert.equal(q.ranked.unlocked, true);
  assert.equal(q.ranked.league, 'bronze');
  assert.ok(R.enterRanked(q, 'm1', 1, WED).ok);
  assert.ok(p.coins >= 3 * C.matchStakes('bronze', 1).entry);
});

test('Bronce: entrada 500 / premio 1.000; x2: 1.000 / 2.000', () => {
  assert.deepEqual(C.matchStakes('bronze', 1), { entry: 500, prize: 1000 });
  assert.deepEqual(C.matchStakes('bronze', 2), { entry: 1000, prize: 2000 });
  let s = player({ coins: 5000 });
  let r = play(s, 'win');
  assert.equal(r.state.coins, 5500);
  r = play(s, 'loss', 2);
  assert.equal(r.state.coins, 4000);
});

test('sin saldo suficiente no se entra; apuesta inválida rechazada', () => {
  const s = player({ coins: 400 });
  assert.deepEqual(R.enterRanked(s, 'a', 1, WED), { ok: false, error: 'not_enough_coins' });
  assert.deepEqual(R.enterRanked(player(), 'b', 3, WED), { ok: false, error: 'invalid_bet' });
});

test('liquidar dos veces la misma partida no paga dos veces; no se entra con otra pendiente', () => {
  const s = player();
  const e = R.enterRanked(s, 'x', 1, WED);
  assert.equal(R.enterRanked(e.state, 'y', 1, WED).error, 'pending');
  const a = R.settleRanked(e.state, 'x', 'win', WED);
  const b = R.settleRanked(a.state, 'x', 'win', WED);
  assert.equal(b.settlement.duplicate, true);
  assert.equal(b.state.coins, a.state.coins);
  assert.equal(R.enterRanked(a.state, 'x', 1, WED).error, 'pending'); // id ya usado
});

test('rendición y abandono: pierde la entrada, no cuentan y cortan la racha', () => {
  let s = play(player(), 'win').state;
  assert.equal(s.ranked.season.streak, 1);
  const r = play(s, 'surrender');
  assert.equal(r.state.ranked.weekMatches, 1);
  assert.equal(r.state.ranked.season.streak, 0);
  assert.equal(r.settlement.delta, -500);
  const e = R.enterRanked(r.state, 'z', 1, WED);
  const ab = R.abandonPending(e.state, WED + H);
  assert.equal(ab.ranked.pending, null);
  assert.equal(ab.ranked.weekMatches, 1);
  assert.equal(ab.coins, e.state.coins);
});

test('ascenso al terminar una partida con saldo >= objetivo (puede encadenar ligas)', () => {
  let s = player({ coins: 29_800 });
  const r = play(s, 'win'); // 29.800 − 500 + 1.000 = 30.300
  assert.equal(r.settlement.promotedTo, 'silver');
  assert.equal(r.state.ranked.league, 'silver');
  // monedas de ruletas no ascienden sin jugar
  s = player({ coins: 200_000 });
  assert.equal(R.syncRanked(s, WED + H).ranked.league, 'bronze');
  assert.equal(play(s, 'loss').state.ranked.league, 'platinum'); // 199.500: Bronce → Plata → Oro → Platino
});

test('semana: >= 3 partidas cobra liga + posición; < 3 no cobra pero mantiene liga', () => {
  let s = player({ coins: 20_000 });
  for (let i = 0; i < 3; i++) s = play(s, i ? 'loss' : 'win').state;
  const w = R.syncRanked(s, nextMonday);
  assert.equal(w.ranked.weekMatches, 0);
  const rw = w.ranked.rewards.at(-1);
  assert.equal(rw.eligible, true);
  assert.ok(rw.coins >= 3000);
  const c = R.claimWeekly(w, rw.week);
  assert.equal(c.state.coins, w.coins + rw.coins);
  assert.equal(c.state.gems, w.gems + rw.cash);
  assert.equal(R.claimWeekly(c.state, rw.week).given, false); // una sola vez

  let t = play(player(), 'win').state;
  t = play(t, 'loss').state;
  const w2 = R.syncRanked(t, nextMonday);
  assert.equal(w2.ranked.rewards.at(-1).eligible, false);
  assert.equal(w2.ranked.rewards.at(-1).coins, 0);
  assert.equal(w2.ranked.league, 'bronze');
});

test('mes: baja una liga y recorta el saldo a la mitad de la liga siguiente', () => {
  const s = clonePlayer(player());
  s.ranked.league = 'silver';
  s.coins = 58_000;
  const m = R.syncRanked(s, nextMonth);
  assert.equal(m.ranked.league, 'bronze');
  assert.equal(m.coins, 45_000);
  assert.deepEqual(m.ranked.demotion, { from: 'silver', to: 'bronze', coinsCut: 13_000 });
  // con una partida vuelve a subir
  assert.equal(play(m, 'loss', 1, nextMonth).state.ranked.league, 'silver');
  // saldo bajo: no se recorta; Bronce no baja
  const b = clonePlayer(player({ coins: 1000 }));
  b.ranked.league = 'diamond';
  assert.equal(R.syncRanked(b, nextMonth).coins, 1000);
  assert.equal(R.syncRanked(b, nextMonth).ranked.league, 'platinum');
  assert.equal(R.syncRanked(player(), nextMonth).ranked.league, 'bronze');
  assert.equal(C.demotionCap('diamond'), 720_000);
});

test('la hora no retrocede el calendario', () => {
  const s = R.syncRanked(player(), nextMonday);
  assert.equal(R.syncRanked(s, WED), s);
});

console.log('Rivales simulados');
test('100 por liga (incluye al jugador), deterministas y marcados como bots', () => {
  const clk = R.botClockAt(WED);
  const a = R.boardFor(player(), 'bronze', clk);
  const b = R.boardFor(player(), 'bronze', clk);
  assert.equal(a.length, 100);
  assert.equal(a.filter((e) => !e.bot).length, 1);
  assert.deepEqual(a.map((e) => e.id), b.map((e) => e.id));
  assert.ok(a.filter((e) => e.bot).every((e) => e.id.startsWith('bot:')));
  assert.equal(R.boardFor(player(), 'gold', clk).length, 100); // en otra liga: solo bots
});

test('bots por debajo del objetivo y suben durante el mes', () => {
  const early = B.botsFor('bronze', { month: '2026-11', progress: 0.1, tick: 1 });
  const late = B.botsFor('bronze', { month: '2026-11', progress: 0.9, tick: 1 });
  assert.ok(late.every((e) => e.coins < 30_000));
  const sum = (x) => x.reduce((a, e) => a + e.coins, 0);
  assert.ok(sum(late) > sum(early));
  assert.equal(B.botsFor('bronze', { month: '2026-11', progress: 0.5, tick: 1 }, 40).length, 60);
});

test('posición de premio: los bots no reciben premios; el jugador sí según su puesto', () => {
  const s = player({ coins: 29_000 });
  const v = R.rankedView(s, WED);
  assert.ok(v.position >= 1 && v.position <= 100);
  assert.equal(v.weekMatches, 0);
  assert.equal(v.estimate.eligible, false);
});

console.log('Premio diario');
test('un premio por día de la semana (lunes a domingo) y semana nueva el lunes', () => {
  let s = newPlayer();
  // miércoles 4: tercer día de la semana (lunes 2)
  let r = L.claimLogin(s, WED);
  assert.equal(r.day, 3);
  assert.equal(r.state.coins, s.coins + L.LOGIN.rewards[2].coins);
  assert.equal(L.claimLogin(r.state, WED + H).given, null);
  r = L.claimLogin(r.state, WED + D);
  assert.equal(r.day, 4);
  // sábado (se saltó el viernes): toca el premio del sábado
  r = L.claimLogin(r.state, WED + 3 * D);
  assert.equal(r.day, 6);
  assert.deepEqual(L.loginStatus(r.state, WED + 3 * D).claimedDays, [2, 3, 5]);
  // lunes siguiente: semana nueva, nada reclamado
  const mon = L.loginStatus(r.state, WED + 5 * D);
  assert.equal(mon.day, 1);
  assert.equal(mon.claimed, false);
  assert.deepEqual(mon.claimedDays, []);
  assert.equal(mon.week.days[0].date, 9);
});

console.log('Datos y Tienda');
test('migración v4 → versión actual y datos corruptos', () => {
  const v4 = { version: 4, name: 'Ana', level: 22, xp: 0, coins: 900, gems: 3, owned: [], equipped: {}, wheel: {}, bp: {} };
  const p = migratePlayer(v4);
  // migra a la versión ACTUAL del guardado (antes fija en 5: se rompía cada vez que subía el esquema)
  assert.equal(p.version, PLAYER_SCHEMA_VERSION);
  assert.equal(p.coins, 900);
  assert.equal(p.ranked.unlocked, false);
  const q = migratePlayer({ ...v4, version: 5, ranked: { unlocked: true, league: 'xx', weekMatches: -4, pending: { matchId: 'k' } }, login: { streak: 99 } });
  assert.equal(q.ranked.league, 'bronze');
  assert.equal(q.ranked.weekMatches, 0);
  assert.equal(q.ranked.pending.matchId, 'k');
  assert.equal(q.login.streak, 7);
});

test('la Tienda cobra DINERO, no monedas', () => {
  const s = newPlayer();
  s.coins = 99_999;
  s.gems = 0;
  assert.equal(purchase(s, 'style:red').error, 'not_enough_cash');
  s.gems = 100;
  const r = purchase(s, 'style:red');
  assert.ok(r.ok);
  assert.equal(r.state.coins, 99_999);
});

console.log(`\n${ok} pruebas OK`);
