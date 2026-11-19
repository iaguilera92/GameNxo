// Pruebas de las MISIONES POR PARTIDA (domain/matchMissions.ts). Uso: node tools/test-match-missions.mjs
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

const M = await import('../src/domain/matchMissions.ts');

let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};
const win = (reason = '¡PUNTO!', extra = {}) => ({ winner: 'player', reason, ...extra });
const lose = (reason = 'Punto rival', extra = {}) => ({ winner: 'rival', reason, ...extra });

console.log('Misiones por partida');

test('premios: 20 + 40 + 20 + 20 = 100', () => {
  assert.deepEqual(M.MISSIONS.map((m) => [m.id, m.coins]), [['dropZero', 20], ['skyLaunch', 40], ['netDuel', 20], ['specialLob', 20]]);
  assert.equal(M.MISSIONS_MAX, 100);
});

test('DROP SHOT 0: solo el punto ganado con ese motivo', () => {
  const t = M.createMissionTracker();
  assert.deepEqual(M.missionPoint(t, win('¡PUNTO!')), []);
  assert.deepEqual(M.missionPoint(t, lose('¡DROP SHOT 0!')), [], 'el DROP SHOT 0 del rival no cuenta');
  assert.deepEqual(M.missionPoint(t, win('¡DROP SHOT 0!')), ['dropZero']);
});

test('¡A LAS ESTRELLAS!: rival que sale volando y punto tuyo', () => {
  const t = M.createMissionTracker();
  assert.deepEqual(M.missionPoint(t, lose('¡BUEN PUNTO!', { rivalLaunched: true })), []);
  assert.deepEqual(M.missionPoint(t, win('¡BUEN PUNTO!', { rivalLaunched: true })), ['skyLaunch']);
});

test('DUELO EN LA RED: punto ganado en el que hubo duelo', () => {
  const t = M.createMissionTracker();
  assert.deepEqual(M.missionPoint(t, win('¡PUNTO!', { duel: false })), []);
  assert.deepEqual(M.missionPoint(t, lose('Punto rival', { duel: true })), [], 'perder el punto del duelo no cuenta');
  assert.deepEqual(M.missionPoint(t, win('¡FUERA!', { duel: true })), ['netDuel']);
});

test('ESPECIAL + GLOBO MÁXIMO: ESPECIAL → rival devuelve → GLOBO al máximo → punto', () => {
  const t = M.createMissionTracker();
  M.missionPointStart(t);
  M.missionHit(t, 'rival'); // saque rival
  M.missionHit(t, 'player', 'special');
  M.missionHit(t, 'rival'); // la devuelve (débil)
  M.missionHit(t, 'player', 'maxLob');
  assert.deepEqual(M.missionPoint(t, win('¡PUNTO!')), ['specialLob']);
});

test('ESPECIAL + GLOBO MÁXIMO: lo que NO cuenta', () => {
  const run = (seq, p = win()) => {
    const t = M.createMissionTracker();
    M.missionPointStart(t);
    for (const [who, shot] of seq) M.missionHit(t, who, shot);
    return M.missionPoint(t, p);
  };
  assert.deepEqual(run([['player', 'maxLob']]), [], 'globo máximo sin ESPECIAL antes');
  assert.deepEqual(run([['player', 'special'], ['player', 'maxLob']]), [], 'sin devolución del rival');
  assert.deepEqual(run([['player', 'special'], ['rival'], ['player', null]]), [], 'devolución con golpe normal');
  assert.deepEqual(run([['player', 'special'], ['rival'], ['player', 'maxLob'], ['rival']]), [], 'el rival devolvió el globo');
  assert.deepEqual(run([['player', 'special'], ['rival'], ['player', null], ['rival'], ['player', 'maxLob']]), [], 'golpes entre medio');
  assert.deepEqual(run([['player', 'special'], ['rival'], ['player', 'maxLob']], lose()), [], 'punto perdido');
  // la cadena no pasa al punto siguiente
  const t = M.createMissionTracker();
  M.missionHit(t, 'player', 'special');
  M.missionHit(t, 'rival');
  M.missionPoint(t, lose());
  M.missionPointStart(t);
  M.missionHit(t, 'player', 'maxLob');
  assert.deepEqual(M.missionPoint(t, win()), []);
});

test('cada misión cuenta una sola vez por partida', () => {
  const t = M.createMissionTracker();
  assert.deepEqual(M.missionPoint(t, win('¡DROP SHOT 0!')), ['dropZero']);
  assert.deepEqual(M.missionPoint(t, win('¡DROP SHOT 0!')), []);
  assert.deepEqual(M.missionPoint(t, win('¡PUNTO!', { duel: true })), ['netDuel']);
  assert.deepEqual(M.missionPoint(t, win('¡PUNTO!', { duel: true })), []);
  assert.deepEqual(t.done, ['dropZero', 'netDuel']);
  assert.equal(M.missionCoins(t.done), 40);
});

test('varias a la vez en un punto y total 100 con las 4', () => {
  const t = M.createMissionTracker();
  M.missionHit(t, 'player', 'special');
  M.missionHit(t, 'rival');
  M.missionHit(t, 'player', 'maxLob');
  assert.deepEqual(M.missionPoint(t, win('¡PUNTO!', { duel: true })), ['netDuel', 'specialLob']);
  M.missionPoint(t, win('¡BUEN PUNTO!', { rivalLaunched: true }));
  M.missionPoint(t, win('¡DROP SHOT 0!'));
  assert.equal(t.done.length, 4);
  assert.equal(M.missionCoins(t.done), 100);
});

test('partida nueva = misiones de cero; total sin repetidos', () => {
  const t = M.createMissionTracker();
  assert.deepEqual(t.done, []);
  assert.equal(M.missionCoins([]), 0);
  assert.equal(M.missionCoins(['skyLaunch', 'skyLaunch']), 40);
  assert.equal(M.missionCoins(['skyLaunch', 'nada']), 40);
});

console.log(`\n${ok} pruebas OK`);
