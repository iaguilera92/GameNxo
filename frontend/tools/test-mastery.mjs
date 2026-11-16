// Pruebas de las MAESTRÍAS y la ZONA por personaje (domain/characterPassives.ts, operations.awardMastery, zoneProgress). Uso: node tools/test-mastery.mjs
// Definición: docs/MAESTRIAS.md. Los módulos de src/domain importan sin extensión (Vite): este cargador añade ".ts" al resolver.
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
const P = await import('../src/domain/characterPassives.ts');
const Z = await import('../src/domain/zoneProgress.ts');
const OPS = await import('../src/domain/operations.ts');
const { newPlayer, clonePlayer } = await import('../src/domain/player.ts');
const { migratePlayer } = await import('../src/domain/migrate.ts');
const { MAX_LEVEL } = await import('../src/config.ts');
let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};

test('cada personaje con pasiva: Nxo AGILIDAD, Mai PRECISIÓN', () => {
  assert.equal(P.passiveOf('nxo').id, 'agility');
  assert.equal(P.passiveOf('mai').id, 'precision');
  assert.equal(P.passiveOf('otro'), undefined);
});
test('curva: nivel 1 sin puntos, nivel 10 con el total y nunca más', () => {
  assert.equal(P.masteryLevel(0), 1);
  assert.equal(P.masteryLevel(1), 1);
  assert.equal(P.masteryLevel(2), 2);
  assert.equal(P.masteryLevel(5), 2);
  assert.equal(P.masteryLevel(6), 3);
  assert.equal(P.masteryLevel(P.MASTERY_MAX_POINTS - 1), 9);
  assert.equal(P.masteryLevel(P.MASTERY_MAX_POINTS), 10);
  assert.equal(P.masteryLevel(99999), 10);
  assert.equal(P.masteryLevel(-5), 1);
  assert.equal(P.MASTERY_MAX_POINTS, 157);
});
test('cada nivel vale +1 % (nivel 10 = +10 %)', () => {
  assert.equal(P.passiveValue(0), 0.01);
  assert.equal(P.passiveValue(2), 0.02);
  assert.equal(P.passiveValue(P.MASTERY_MAX_POINTS), 0.1);
});
test('progreso hacia el siguiente nivel', () => {
  const a = P.masteryProgress(0);
  assert.deepEqual([a.level, a.into, a.need, a.max], [1, 0, 2, false]);
  const b = P.masteryProgress(3); // nivel 2 (2 puntos) + 1 de 4
  assert.deepEqual([b.level, b.into, b.need], [2, 1, 4]);
  assert.equal(b.frac, 0.25);
  const m = P.masteryProgress(P.MASTERY_MAX_POINTS);
  assert.ok(m.max && m.frac === 1 && m.need === 0);
});
test('awardMastery: antes del nivel 20 de la cuenta no suma', () => {
  const s = newPlayer();
  s.level = MAX_LEVEL - 1;
  const r = OPS.awardMastery(s, 'nxo');
  assert.ok(r.ok && r.gained === 0);
  assert.equal(r.state.mastery, undefined);
});
test('awardMastery: desde el nivel 20 suma 1 por victoria y solo a ese personaje', () => {
  let s = newPlayer();
  s.level = MAX_LEVEL;
  for (let i = 0; i < 3; i++) s = OPS.awardMastery(s, 'nxo').state;
  assert.equal(s.mastery.nxo, 3);
  assert.equal(s.mastery.mai, undefined);
  assert.equal(P.masteryLevel(s.mastery.nxo), 2);
});
test('awardMastery: no pasa del máximo y no toca el estado recibido', () => {
  const s = newPlayer();
  s.level = MAX_LEVEL;
  s.mastery = { nxo: P.MASTERY_MAX_POINTS };
  const r = OPS.awardMastery(s, 'nxo');
  assert.equal(r.gained, 0);
  assert.equal(r.state.mastery.nxo, P.MASTERY_MAX_POINTS);
  const t = newPlayer();
  t.level = MAX_LEVEL;
  const before = JSON.stringify(t);
  OPS.awardMastery(t, 'mai');
  assert.equal(JSON.stringify(t), before);
});
test('awardMastery: un personaje sin pasiva no suma', () => {
  const s = newPlayer();
  s.level = MAX_LEVEL;
  assert.equal(OPS.awardMastery(s, 'fantasma').gained, 0);
});
test('lo guardado se valida: ids desconocidos fuera, puntos acotados', () => {
  const s = migratePlayer({ ...JSON.parse(JSON.stringify(newPlayer())), mastery: { nxo: 99999, mai: -4, x: 5, 'mal': 'a' } });
  assert.equal(s.mastery.nxo, P.MASTERY_MAX_POINTS);
  assert.equal(s.mastery.mai, undefined);
  assert.equal(s.mastery.x, undefined);
  const c = clonePlayer(s);
  c.mastery.nxo = 1;
  assert.equal(s.mastery.nxo, P.MASTERY_MAX_POINTS);
});
test('ZONA por personaje: los Rayos son de la cuenta, los atributos de cada personaje', () => {
  let s = newPlayer();
  s.zone.rays = 5;
  s = OPS.upgradeZoneStat(s, 'speed', 'nxo').state;
  s = OPS.upgradeZoneStat(s, 'speed', 'mai').state;
  s = OPS.upgradeZoneStat(s, 'speed', 'mai').state;
  assert.equal(s.zone.rays, 2);
  assert.equal(Z.zoneStatsOf(s.zone, 'nxo').speed, 1);
  assert.equal(Z.zoneStatsOf(s.zone, 'mai').speed, 2);
  assert.equal(Z.zoneStatsOf(s.zone, 'nueva').speed, 0);
});
test('ZONA: sin Rayos no sube y cada atributo tiene su tope por personaje', () => {
  const s = newPlayer();
  assert.equal(OPS.upgradeZoneStat(s, 'speed', 'nxo').error, 'not_enough_rays');
  let t = newPlayer();
  t.zone.rays = Z.ZONE_STAT_MAX + 5;
  for (let i = 0; i < Z.ZONE_STAT_MAX; i++) t = OPS.upgradeZoneStat(t, 'agility', 'nxo').state;
  assert.equal(OPS.upgradeZoneStat(t, 'agility', 'nxo').error, 'stat_maxed');
  assert.ok(OPS.upgradeZoneStat(t, 'agility', 'mai').ok); // el otro personaje aún puede
});
test('migración: los atributos de ZONA guardados antes pasan al personaje inicial (Nxo)', () => {
  const old = JSON.parse(JSON.stringify(newPlayer()));
  old.zone = { rays: 3, stats: { strength: 4, speed: 2, precision: 0, agility: 7, resistance: 1 } };
  const s = migratePlayer(old);
  assert.equal(s.zone.rays, 3);
  assert.equal(Z.zoneStatsOf(s.zone, 'nxo').agility, 7);
  assert.equal(Z.zoneStatsOf(s.zone, 'mai').agility, 0);
});
test('migración: el formato nuevo (por personaje) se conserva y se valida', () => {
  const old = JSON.parse(JSON.stringify(newPlayer()));
  old.zone = { rays: 1, stats: { nxo: { strength: 99, speed: 3 }, mai: { precision: 5 }, 'MAL ID!': { speed: 9 } } };
  const s = migratePlayer(old);
  assert.equal(Z.zoneStatsOf(s.zone, 'nxo').strength, Z.ZONE_STAT_MAX);
  assert.equal(Z.zoneStatsOf(s.zone, 'nxo').speed, 3);
  assert.equal(Z.zoneStatsOf(s.zone, 'mai').precision, 5);
  assert.equal(Object.keys(s.zone.stats).length, 2);
});
console.log(`${ok} pruebas OK`);
