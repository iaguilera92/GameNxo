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
const F = await import('../src/domain/profileFrames.ts');
const K = await import('../src/ai/botKit.ts');
const { itemRarity } = await import('../src/domain/shopCatalog.ts');
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

test('neto semanal separado del saldo: 10.000 / 0 → 9.000 / 0 (en juego) → 11.000 / +1.000; nunca baja de 0', () => {
  const s = player({ coins: 10_000 });
  const e = R.enterRanked(s, 'n1', 2, WED); // Bronce x2: entrada 1.000
  assert.equal(e.state.coins, 9_000);
  assert.equal(e.state.ranked.weekNet, 0); // se ajusta al liquidar
  // perder con neto 0: sigue en 0 (mínimo)
  const l = R.settleRanked(e.state, 'n1', 'loss', WED);
  assert.equal(l.state.ranked.weekNet, 0);
  assert.equal(l.state.coins, 9_000);
  const w = R.settleRanked(R.enterRanked(s, 'n1', 2, WED).state, 'n1', 'win', WED);
  assert.equal(w.state.coins, 11_000);
  assert.equal(w.state.ranked.weekNet, 1_000);
  assert.equal(w.state.ranked.weekWins, 1);
  // ganar y luego perder: +1.000 → 0
  const w2 = R.settleRanked(R.enterRanked(w.state, 'n2', 2, WED).state, 'n2', 'loss', WED);
  assert.equal(w2.state.ranked.weekNet, 0);
  // monedas de fuera de Ranked (ruleta, cofre…) no tocan el neto
  const x = clonePlayer(w.state);
  x.coins += 5_000;
  assert.equal(R.rankedView(x, WED).weekNet, 1_000);
  assert.equal(R.rankedView(x, WED).coins, 16_000);
});

test('rendición y abandono: pierden la entrada y cuentan como DERROTA (D9)', () => {
  let s = play(player(), 'win').state;
  assert.equal(s.ranked.season.streak, 1);
  const r = play(s, 'surrender');
  assert.equal(r.state.ranked.weekMatches, 2);
  assert.equal(r.state.ranked.weekLosses, 1);
  assert.equal(r.state.ranked.season.streak, 0);
  assert.equal(r.settlement.delta, -500);
  const e = R.enterRanked(r.state, 'z', 1, WED);
  const ab = R.abandonPending(e.state, WED + H);
  assert.equal(ab.ranked.pending, null);
  assert.equal(ab.ranked.weekLosses, 2);
  assert.equal(ab.coins, e.state.coins);
});

test('se va el rival: con un juego ganado cobra entrada + mitad (500 → 750); sin juegos recupera la entrada', () => {
  const s = player({ coins: 5_000 });
  const e = R.enterRanked(s, 'f1', 1, WED);
  const a = R.settleRanked(e.state, 'f1', 'opponent_left', WED, { gamesWon: 1 });
  assert.equal(a.settlement.prize, 750);
  assert.equal(a.state.coins, 5_250);
  assert.equal(a.state.ranked.weekNet, 250);
  assert.equal(a.state.ranked.weekWins, 1);
  const e2 = R.enterRanked(s, 'f2', 1, WED);
  const b = R.settleRanked(e2.state, 'f2', 'opponent_left', WED, { gamesWon: 0 });
  assert.equal(b.state.coins, 5_000);
  assert.equal(b.state.ranked.weekNet, 0);
  assert.equal(b.state.ranked.weekMatches, 0);
});

test('ya no se asciende al terminar la partida: el ascenso es semanal y de UNA liga', () => {
  let s = player({ coins: 200_000 });
  const r = play(s, 'win');
  assert.equal(r.settlement.promotedTo, null);
  assert.equal(r.state.ranked.league, 'bronze');
  // neto semanal 40.000 (más de dos metas de Bronce): solo sube a Plata
  s = clonePlayer(r.state);
  s.ranked.weekNet = 40_000;
  assert.equal(R.rankedView(s, WED).promoting, true);
  const w = R.syncRanked(s, nextMonday);
  assert.equal(w.ranked.league, 'silver');
  assert.equal(w.ranked.weekNet, 0);
  assert.equal(w.ranked.rewards.at(-1).promotedTo, 'silver');
  assert.equal(w.coins, s.coins); // el saldo global no se reinicia
  // bajo la meta: se queda
  const t = clonePlayer(r.state);
  t.ranked.weekNet = 14_500;
  assert.equal(R.syncRanked(t, nextMonday).ranked.league, 'bronze');
  // Challenger no sube
  const c = clonePlayer(r.state);
  c.ranked.league = 'challenger';
  c.ranked.weekNet = 9_999_999;
  assert.equal(R.syncRanked(c, nextMonday).ranked.league, 'challenger');
});

test('semana: >= 3 VICTORIAS cobra liga + posición; con menos no cobra pero mantiene liga', () => {
  let s = player({ coins: 20_000 });
  for (let i = 0; i < 4; i++) s = play(s, i < 3 ? 'win' : 'loss').state;
  const w = R.syncRanked(s, nextMonday);
  assert.equal(w.ranked.weekMatches, 0);
  assert.equal(w.ranked.weekWins, 0);
  const rw = w.ranked.rewards.at(-1);
  assert.equal(rw.eligible, true);
  assert.equal(rw.wins, 3);
  assert.ok(rw.coins >= C.RANKED.leagues.bronze.weekly.coins);
  const c = R.claimWeekly(w, rw.week);
  assert.equal(c.state.coins, w.coins + rw.coins);
  assert.equal(c.state.gems, w.gems + rw.cash);
  assert.equal(R.claimWeekly(c.state, rw.week).given, false); // una sola vez

  // 2 victorias y muchas partidas: no basta (el requisito son victorias, no partidas)
  let t = player();
  for (let i = 0; i < 6; i++) t = play(t, i < 2 ? 'win' : 'loss').state;
  const w2 = R.syncRanked(t, nextMonday);
  assert.equal(w2.ranked.rewards.at(-1).eligible, false);
  assert.equal(w2.ranked.rewards.at(-1).coins, 0);
  assert.equal(w2.ranked.league, 'bronze');
});

test('mes: descenso EN PAUSA y las monedas nunca se recortan (D6)', () => {
  const s = clonePlayer(player());
  s.ranked.league = 'silver';
  s.coins = 58_000;
  const m = R.syncRanked(s, nextMonth);
  assert.equal(m.ranked.league, 'silver');
  assert.equal(m.coins, 58_000);
  assert.equal(m.ranked.demotion, null);
});

test('la hora no retrocede el calendario', () => {
  const s = R.syncRanked(player(), nextMonday);
  assert.equal(R.syncRanked(s, WED), s);
});

console.log('Rivales simulados');
test('100 por liga (incluye al jugador), deterministas y marcados como bots', () => {
  const clk = R.botClockAt(WED);
  assert.deepEqual(clk, { week: '2026-11-02', day: 2 });
  const a = R.boardFor(player(), 'bronze', clk);
  const b = R.boardFor(player(), 'bronze', clk);
  assert.equal(a.length, 100);
  assert.equal(a.filter((e) => !e.bot).length, 1);
  assert.deepEqual(a.map((e) => [e.id, e.coins]), b.map((e) => [e.id, e.coins]));
  assert.ok(a.filter((e) => e.bot).every((e) => e.id.startsWith('bot:')));
  assert.equal(R.boardFor(player(), 'gold', clk).length, 100); // en otra liga: solo bots
  assert.equal(B.botsFor('bronze', clk, 40).length, 60);
});

test('bots: ciclo semanal, avance diario, tope 120 % y cuántos llegan a la meta varía por semana', () => {
  const goal = C.RANKED.leagues.bronze.target;
  const reachedBy = new Set();
  for (const week of ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']) {
    let prev = null;
    for (let day = 0; day < 7; day++) {
      const bots = B.botsFor('bronze', { week, day });
      assert.ok(bots.every((e) => e.coins <= goal * 1.2), 'tope 120 %');
      assert.ok(bots.every((e) => e.wins >= 0 && e.losses >= 0));
      if (prev) assert.ok(bots.some((e, i) => e.coins !== prev[i].coins), 'avanzan día a día');
      prev = bots;
    }
    reachedBy.add(prev.filter((e) => e.coins >= goal).length);
    // misma semana y día ⇒ misma tabla (estable durante el día)
    assert.deepEqual(B.botsFor('bronze', { week, day: 3 }), B.botsFor('bronze', { week, day: 3 }));
  }
  assert.ok(reachedBy.size > 1, 'el número de bots que llega a la meta cambia entre semanas');
  // semana nueva = bots nuevos
  assert.notDeepEqual(B.botsFor('bronze', { week: '2026-11-02', day: 6 }).map((e) => e.name), B.botsFor('bronze', { week: '2026-11-09', day: 6 }).map((e) => e.name));
});

test('un real que pasa la meta queda PRIMERO (los bots se muestran por debajo)', () => {
  const s = clonePlayer(player());
  s.ranked.weekNet = 15_500; // pasó la meta de Bronce (15.000)
  s.ranked.weekWins = 31;
  // domingo de una semana con bots sobre la meta
  const board = R.boardFor(s, 'bronze', { week: '2026-11-02', day: 6 });
  assert.equal(board[0].id, R.ME);
  assert.ok(board.filter((e) => e.bot).every((e) => e.coins < 15_500));
});

test('desempate: neto, más victorias, menos derrotas, quien llegó antes', () => {
  const e = (id, coins, wins, losses, reachedAt) => ({ id, coins, wins, losses, reachedAt, bot: false });
  const rows = [e('a', 1000, 5, 3, 50), e('b', 1000, 6, 3, 90), e('c', 1000, 6, 2, 99), e('d', 1000, 6, 2, 10), e('x', 2000, 0, 0, 0)];
  assert.deepEqual(rows.sort(B.compareEntries).map((r) => r.id), ['x', 'd', 'c', 'b', 'a']);
});

test('posición de premio y estimación', () => {
  const s = player({ coins: 29_000 });
  const v = R.rankedView(s, WED);
  assert.ok(v.position >= 1 && v.position <= 100);
  assert.equal(v.prizePosition, v.position); // sin servidor los bots cuentan (botsCountForPositionPrizes)
  assert.equal(v.weekWins, 0);
  assert.equal(v.estimate.eligible, false);
  // Ranking Global: con bots hasta 100 y el jugador siempre dentro
  assert.equal(v.globalBoard.length, 100);
  assert.equal(v.globalBoard.find((e) => e.id === R.ME).coins, 29_000);
  assert.deepEqual(C.RANKED.positionPrizes.map((p) => p.upTo), [1, 3, 10, 50]);
});

test('ranking global: bots estables que cambian una vez al día; el jugador real se muestra siempre', () => {
  const day1 = B.buildGlobalBoard([], '2026-11-16');
  const again = B.buildGlobalBoard([], '2026-11-16');
  const day2 = B.buildGlobalBoard([], '2026-11-17');
  assert.equal(day1.length, 100);
  assert.deepEqual(day1.map((e) => [e.id, e.coins]), again.map((e) => [e.id, e.coins]));
  assert.deepEqual(new Set(day1.map((e) => e.name)), new Set(day2.map((e) => e.name))); // mismos nombres
  assert.ok(day1.some((e, i) => e.coins !== day2.find((x) => x.id === e.id).coins)); // saldos de otro día
  // un jugador pobre (0 monedas) sigue en la tabla, al final, con su posición real
  const me = { id: R.ME, name: 'Yo', bot: false, level: 1, coins: 0, wins: 0, losses: 0, reachedAt: 0, avatar: { skin: 'nxo', color: 0 } };
  const b = B.buildGlobalBoard([me], '2026-11-16');
  assert.ok(b.some((e) => e.id === R.ME));
  assert.equal(b.filter((e) => !e.bot).length, 1);
});

console.log('Marcos del perfil');
test('marcos: se ganan al llegar a la liga, no se pierden al bajar y no se equipan bloqueados', () => {
  let s = clonePlayer(player());
  assert.equal(F.frameUnlocked(s, 'bronze'), true);
  assert.equal(F.frameUnlocked(s, 'silver'), false);
  assert.equal(F.equipFrame(s, 'silver').ok, false);
  s.ranked.weekNet = 16_000;
  s = R.syncRanked(s, nextMonday); // sube a Plata
  assert.equal(s.ranked.bestLeague, 'silver');
  assert.equal(F.frameUnlocked(s, 'silver'), true);
  const e = F.equipFrame(s, 'silver');
  assert.ok(e.ok);
  assert.equal(F.equippedFrame(e.state), 'silver');
  // baja de liga (p. ej. descenso futuro): el marco sigue
  const d = clonePlayer(e.state);
  d.ranked.league = 'bronze';
  assert.equal(F.equippedFrame(d), 'silver');
  // guardado y migración
  const back = migratePlayer(JSON.parse(JSON.stringify(e.state)));
  assert.equal(back.equipped.frame, 'silver');
  assert.equal(back.ranked.bestLeague, 'silver');
  assert.equal(F.equipFrame(e.state, null).state.equipped.frame, undefined);
});
console.log('Kit del bot');
test('kit del bot: varía entre partidas y nunca usa nada épico ni legendario', () => {
  const seen = { smash: new Set(), inferno: new Set(), defensive: new Set(), charge: new Set(), color: new Set() };
  for (let i = 0; i < 400; i++) {
    const k = K.randomBotKit(i % 2 ? 'mai' : 'nxo');
    for (const key of Object.keys(seen)) seen[key].add(k[key]);
    for (const [kind, id] of [['smash', k.smash], ['inferno', k.inferno], ['defensive', k.defensive], ['charge', k.charge]]) {
      const r = itemRarity(`${kind}:${id}`);
      assert.ok(r !== 'epica' && r !== 'legendaria', `${kind}:${id} es ${r}`);
    }
    assert.ok(['dash', 'blink', 'shadow', 'jump', 'flip', 'skate'].includes(k.defensive));
  }
  for (const key of Object.keys(seen)) assert.ok(seen[key].size > 1, `${key} no varía`);
  assert.equal(seen.charge.has('tulip'), false); // CARGA Tulipán = épica
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
  const q = migratePlayer({ ...v4, version: 5, ranked: { unlocked: true, league: 'xx', weekMatches: -4, weekNet: -2500, weekWins: 'x', pending: { matchId: 'k' } }, login: { streak: 99 } });
  assert.equal(q.ranked.league, 'bronze');
  assert.equal(q.ranked.weekMatches, 0);
  assert.equal(q.ranked.weekNet, 0); // el neto de la liga nunca es negativo
  assert.equal(q.ranked.weekWins, 0);
  assert.equal(q.ranked.pending.matchId, 'k');
  assert.equal(q.login.streak, 7);
});

test('la Tienda cobra DINERO, no monedas', () => {
  const s = newPlayer();
  s.level = 10; // el estilo (EFECTO PELOTA) se compra desde su nivel de desbloqueo (domain/unlocks.ts)
  s.coins = 99_999;
  s.gems = 0;
  assert.equal(purchase(s, 'style:red').error, 'not_enough_cash');
  s.gems = 100;
  const r = purchase(s, 'style:red');
  assert.ok(r.ok);
  assert.equal(r.state.coins, 99_999);
});

console.log(`\n${ok} pruebas OK`);
