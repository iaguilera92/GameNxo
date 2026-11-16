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

const { newPlayer } = await import('../src/domain/player.ts');
const { gainChest, chestStatus, openChest, CHEST } = await import('../src/domain/chest.ts');
const { migratePlayer } = await import('../src/domain/migrate.ts');
const { WHEEL, validateWheelConfig } = await import('../src/domain/wheelConfig.ts');
const W = await import('../src/domain/dailyWheel.ts');

let ok = 0;
const t = (name, fn) => { fn(); ok++; };
const D2 = CHEST.unlockMs;

t('la ruleta sigue válida y tiene el sector COFRE', () => {
  assert.deepEqual(validateWheelConfig(), []);
  assert.ok(WHEEL.slots.some((s) => s.prize.kind === 'chest'));
});
t('primer cofre: normal, se abre a los 2 días', () => {
  const g = gainChest(newPlayer(), 1000);
  assert.equal(g.state.chest.level, 0);
  assert.equal(g.state.chest.readyAt, 1000 + D2);
  assert.equal(chestStatus(g.state, 1000 + D2 - 1).kind, 'locked');
  assert.equal(chestStatus(g.state, 1000 + D2).kind, 'ready');
});
t('evoluciona sin reiniciar el tiempo: normal → especial → épico → monedas', () => {
  let s = gainChest(newPlayer(), 1000).state;
  s = gainChest(s, 5000).state;
  assert.equal(s.chest.level, 1);
  assert.equal(s.chest.readyAt, 1000 + D2);
  s = gainChest(s, 9000).state;
  assert.equal(s.chest.level, 2);
  const c0 = s.coins;
  const g = gainChest(s, 9999);
  assert.equal(g.gain.kind, 'coins');
  assert.equal(g.state.coins, c0 + CHEST.maxedCoins);
  assert.equal(g.state.chest.level, 2);
});
t('no se abre antes de tiempo; al abrir entrega premio y desaparece', () => {
  let s = gainChest(newPlayer(), 0).state;
  assert.equal(openChest(s, D2 - 1), null);
  const c0 = s.coins, g0 = s.gems;
  const o = openChest(s, D2);
  assert.ok(o);
  assert.equal(o.state.coins, c0 + CHEST.rewards[0].coins);
  assert.equal(o.state.gems, g0 + CHEST.rewards[0].cash);
  assert.equal(o.state.chest, undefined);
});
t('el ÉPICO trae un cosmético que no tienes', () => {
  let s = newPlayer();
  for (let i = 0; i < 3; i++) s = gainChest(s, 0).state;
  const o = openChest(s, D2);
  assert.ok(o.reward.item);
  assert.ok(o.state.owned.includes(o.reward.item.id));
});
t('el cofre se guarda y se recupera (migrate)', () => {
  const s = gainChest(newPlayer(), 1234).state;
  const back = migratePlayer(JSON.parse(JSON.stringify(s)));
  assert.deepEqual(back.chest, s.chest);
  assert.equal(migratePlayer({ ...JSON.parse(JSON.stringify(s)), chest: { level: 7, readyAt: 'x' } }).chest, undefined);
});
t('cobrar una ruleta con premio COFRE crea el cofre', () => {
  let s = newPlayer();
  const now = Date.parse('2026-11-15T12:00:00Z');
  s = W.recordWin(s, 'm1', now).state;
  const chestSlot = WHEEL.slots.findIndex((x) => x.prize.kind === 'chest');
  // rng que cae en el sector COFRE
  let acc = 0;
  for (let i = 0; i < chestSlot; i++) acc += WHEEL.slots[i].weight;
  const v = (acc + 1) / 10000;
  const sp = W.spin(s, 0, now, () => v);
  assert.ok(sp.ok);
  assert.equal(sp.reward.kind, 'chest');
  const cl = W.claim(sp.state, 0, now);
  assert.equal(cl.state.chest.level, 0);
});
t('ABRIR YA con anuncio: abre el cofre aún cerrado (skipWait)', () => {
  const s = gainChest(newPlayer(), 0).state;
  assert.equal(openChest(s, 1000), null);
  const o = openChest(s, 1000, true);
  assert.ok(o);
  assert.equal(o.state.chest, undefined);
  assert.equal(o.state.coins, s.coins + CHEST.rewards[0].coins);
  assert.equal(openChest(newPlayer(), 1000, true), null);
});
t('RULETA TEST: forceSlot elige el sector', () => {
  let s = newPlayer();
  const now = Date.parse('2026-11-15T12:00:00Z');
  s = W.grantBonusSpin(s, 'test:1').state;
  const sp = W.spin(s, 0, now, () => 0, true, 'chest');
  assert.ok(sp.ok);
  assert.equal(sp.slot.id, 'chest');
});
console.log(`${ok} pruebas OK`);
