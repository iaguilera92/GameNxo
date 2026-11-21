// Pruebas de la LIGA 2v2 (domain/league2v2.ts). Uso: node tools/test-liga-2v2.mjs
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
const L = await import('../src/domain/league2v2.ts');
const S = await import('../src/domain/league2v2State.ts');
const { newPlayer } = await import('../src/domain/player.ts');
const { weekIdAt } = await import('../src/domain/ranked.ts');
let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};
const DAY = 86_400_000;
const t0 = Date.UTC(2026, 10, 18, 15, 0); // miércoles 18-11-2026
const nextWeek = t0 + 7 * DAY;
const play = (s, now, win, delta) => L.recordMatch2v2(s, now, win, delta);

test('sin datos: la liga sale de las monedas 2v2 que ya tenía y no baja nadie', () => {
  const s = newPlayer();
  assert.equal(L.league2v2Of(s), 'bronze');
  assert.equal(L.league2v2Of({ ...s, coins2v2: 900 }), 'platinum');
  const synced = L.syncLeague2v2({ ...s, coins2v2: 900 }, t0);
  assert.equal(synced.league2v2.league, 'platinum');
  assert.equal(synced.league2v2.week, weekIdAt(t0));
});

test('un partido suma al neto de la semana (nunca baja de 0) y a victorias / derrotas', () => {
  let s = newPlayer();
  s = play(s, t0, true, 30);
  s = play(s, t0, false, -15);
  assert.equal(s.league2v2.weekNet, 15);
  s = play(s, t0, false, -60);
  assert.equal(s.league2v2.weekNet, 0);
  assert.deepEqual([s.league2v2.weekWins, s.league2v2.weekLosses, s.league2v2.weekMatches], [1, 2, 3]);
  assert.equal(s.league2v2.season.bestStreak, 1);
});

test('syncLeague2v2 es pura: mismo objeto si no cambia nada', () => {
  const s = L.syncLeague2v2(newPlayer(), t0);
  assert.equal(L.syncLeague2v2(s, t0 + 1000), s);
});

test('cierre de semana con la meta: sube UNA liga, desbloquea su marco 2v2 y deja la recompensa', () => {
  let s = newPlayer();
  const target = L.league2v2Economy('bronze').target;
  for (let i = 0; i < target / 30; i++) s = play(s, t0, true, 30);
  assert.ok(s.league2v2.weekWins >= L.LEAGUE_2V2.minWinsForReward);
  const after = L.syncLeague2v2(s, nextWeek);
  assert.equal(after.league2v2.league, 'silver');
  assert.equal(L.bestLeague2v2(after), 'silver');
  assert.equal(after.league2v2.weekNet, 0);
  assert.equal(after.league2v2.rewards.length, 1);
  assert.equal(after.league2v2.rewards[0].promotedTo, 'silver');
  assert.equal(after.league2v2.rewards[0].eligible, true);
  assert.equal(after.league2v2.rewards[0].coins, L.league2v2Economy('bronze').weekly.coins);
  assert.notEqual(after.league2v2.seenLeague, after.league2v2.league); // el ascenso queda por celebrar
});

test('sin llegar a la meta no se sube; con menos victorias no hay premio pero la semana queda registrada', () => {
  let s = newPlayer();
  s = play(s, t0, true, 30);
  s = play(s, t0, false, -15);
  const after = L.syncLeague2v2(s, nextWeek);
  assert.equal(after.league2v2.league, 'bronze');
  assert.equal(after.league2v2.rewards[0].eligible, false);
  assert.equal(after.league2v2.rewards[0].coins, 0);
});

test('una semana sin partidas no deja recompensa', () => {
  const s = L.syncLeague2v2(newPlayer(), t0);
  const after = L.syncLeague2v2(s, nextWeek);
  assert.equal(after.league2v2.rewards.length, 0);
});

test('solo sube UNA liga aunque se haya pasado la meta varias veces', () => {
  let s = newPlayer();
  for (let i = 0; i < 100; i++) s = play(s, t0, true, 30);
  const after = L.syncLeague2v2(s, nextWeek);
  assert.equal(after.league2v2.league, 'silver');
});

test('cobrar la recompensa suma MONEDAS 2v2, dinero y rayos, una sola vez', () => {
  let s = newPlayer();
  for (let i = 0; i < 12; i++) s = play(s, t0, true, 30);
  s = L.syncLeague2v2(s, nextWeek);
  const week = s.league2v2.rewards[0].week;
  const r = L.claimWeekly2v2(s, week);
  assert.ok(r.ok && r.given);
  assert.equal(r.state.coins2v2 ?? 0, (s.coins2v2 ?? 0) + s.league2v2.rewards[0].coins);
  assert.equal(r.state.gems, s.gems + s.league2v2.rewards[0].cash);
  const again = L.claimWeekly2v2(r.state, week);
  assert.ok(again.ok && !again.given);
  assert.equal(L.claimWeekly2v2(s, '1999-01-04').ok, false);
});

test('marcar el ascenso como visto', () => {
  let s = newPlayer();
  for (let i = 0; i < 10; i++) s = play(s, t0, true, 30);
  s = L.syncLeague2v2(s, nextWeek);
  const seen = L.markLeague2v2Seen(s);
  assert.equal(seen.league2v2.seenLeague, seen.league2v2.league);
  assert.equal(L.markLeague2v2Seen(seen), seen);
});

test('la vista trae meta, progreso, tabla con el jugador y el reloj de la semana', () => {
  let s = newPlayer();
  s = play(s, t0, true, 30);
  const v = L.view2v2(s, t0);
  assert.equal(v.league, 'bronze');
  assert.equal(v.target, 300);
  assert.ok(Math.abs(v.progress - 0.1) < 1e-9);
  assert.equal(v.promoting, false);
  assert.ok(v.board.some((e) => e.id === 'me'));
  assert.ok(v.board.length >= 100);
  assert.ok(v.msLeft > 0 && v.msLeft <= 7 * DAY);
  // la misma tabla en cualquier dispositivo (simulados deterministas)
  assert.deepEqual(L.view2v2(s, t0).board.map((e) => e.name), v.board.map((e) => e.name));
});

test('Challenger no tiene meta: la barra queda llena', () => {
  const s = L.syncLeague2v2({ ...newPlayer(), coins2v2: 5000 }, t0);
  const v = L.view2v2(s, t0);
  assert.equal(v.league, 'challenger');
  assert.equal(v.target, null);
  assert.equal(v.progress, 1);
});

test('las metas suben con la liga y la última no tiene', () => {
  const ids = ['bronze', 'silver', 'gold', 'platinum', 'diamond'];
  const t = ids.map((i) => L.league2v2Economy(i).target);
  assert.ok(t.every((x, i) => i === 0 || x > t[i - 1]));
  assert.equal(L.league2v2Economy('challenger').target, null);
});

test('lo guardado se valida (migración): lo inválido se limpia y sin datos no hay liga guardada', () => {
  assert.equal(S.sanitizeLeague2v2(undefined), undefined);
  assert.equal(S.sanitizeLeague2v2('x'), undefined);
  const bad = S.sanitizeLeague2v2({ league: 'oro', bestLeague: 'bronze', weekNet: -50, weekWins: 'x', rewards: [{ week: 5 }] });
  assert.equal(bad.league, 'bronze');
  assert.equal(bad.weekNet, 0);
  assert.equal(bad.weekWins, 0);
  assert.deepEqual(bad.rewards, []);
  // la mejor liga nunca es menor que la actual
  assert.equal(S.sanitizeLeague2v2({ league: 'gold', bestLeague: 'silver' }).bestLeague, 'gold');
  // ida y vuelta
  let s = newPlayer();
  s = play(s, t0, true, 30);
  assert.deepEqual(S.sanitizeLeague2v2(JSON.parse(JSON.stringify(s.league2v2))), s.league2v2);
});
console.log(`${ok} pruebas OK`);
