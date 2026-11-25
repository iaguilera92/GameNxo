// Pruebas de las MONEDAS del Pase (1v1 y 2v2), de los premios repetidos y de la ruleta con monedas 2v2 (21-11-2026).
// Uso: node tools/test-pase-monedas.mjs
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
const { BP_SEASON, bpClaim } = await import('../src/domain/battlePass.ts');
const { equipColor, equipSkin } = await import('../src/domain/operations.ts');
const { migratePlayer } = await import('../src/domain/migrate.ts');
const { WHEEL, validateWheelConfig } = await import('../src/domain/wheelConfig.ts');
const W = await import('../src/domain/dailyWheel.ts');
let ok = 0;
const t = (name, fn) => { fn(); ok++; console.log('  ✓ ' + name); };

/** jugador con el pase al máximo (todos los niveles alcanzados) */
const full = () => {
  const s = newPlayer();
  s.bp = { ...s.bp, season: BP_SEASON.id, xp: BP_SEASON.tiers.length * BP_SEASON.xpPerTier };
  return s;
};

t('el nivel 30 entrega a Jun y el premio prémium añade su color Dorado', () => {
  const s = full();
  assert.equal(equipSkin(s, 'jun').error, 'not_owned');
  assert.equal(bpClaim(s, 'prem', 30).error, 'not_premium');
  const free = bpClaim(s, 'free', 30);
  assert.ok(free.ok);
  assert.ok(free.state.owned.includes('skin:jun'));
  assert.ok(!free.state.owned.includes('color:dorado:jun'));
  const premium = bpClaim({ ...free.state, bp: { ...free.state.bp, premium: true } }, 'prem', 30);
  assert.ok(premium.ok);
  assert.ok(premium.state.owned.includes('color:dorado:jun'));
  assert.equal(bpClaim(premium.state, 'prem', 30).error, 'already_claimed');
});

t('el nivel 30 reclamado antes de la activación entrega a Jun al cargar', () => {
  const saved = full();
  saved.bp.free = [30];
  saved.bp.prem = [30];
  saved.bp.premium = true;
  const restored = migratePlayer(saved);
  assert.ok(restored.owned.includes('skin:jun'));
  assert.equal(restored.gems, saved.gems);
  const selected = equipSkin(restored, 'jun');
  assert.ok(selected.ok);
  const painted = equipColor(selected.state, 'dorado');
  assert.ok(painted.ok);
  const reloaded = migratePlayer(painted.state);
  assert.equal(reloaded.equipped.skin, 'jun');
  assert.equal(reloaded.equipped.color, 'dorado');
  assert.equal(reloaded.owned.filter((id) => id === 'skin:jun').length, 1);
});

t('el camino GRATIS trae monedas 1v1 y monedas 2v2, y nunca seguidas del mismo tipo', () => {
  const free = BP_SEASON.tiers.map((x) => x.free);
  assert.ok(free.some((r) => r.kind === 'coins'));
  assert.ok(free.some((r) => r.kind === 'coins2v2'));
  for (let i = 1; i < free.length; i++) if (free[i].kind !== 'cash') assert.notEqual(free[i].kind, free[i - 1].kind, `niveles ${i} y ${i + 1}`);
});
t('reclamar monedas 1v1 las suma a la cuenta', () => {
  const tier = BP_SEASON.tiers.findIndex((x) => x.free.kind === 'coins') + 1;
  const s = full();
  const before = s.coins;
  const r = bpClaim(s, 'free', tier);
  assert.ok(r.ok);
  assert.equal(r.state.coins, before + BP_SEASON.tiers[tier - 1].free.amount);
  assert.equal(r.given.kind, 'coins');
});
t('reclamar monedas 2v2 las suma a coins2v2', () => {
  const tier = BP_SEASON.tiers.findIndex((x) => x.free.kind === 'coins2v2') + 1;
  const s = full();
  s.coins2v2 = 10;
  const r = bpClaim(s, 'free', tier);
  assert.ok(r.ok);
  assert.equal(r.state.coins2v2, 10 + BP_SEASON.tiers[tier - 1].free.amount);
});
t('un emote que ya tienes sigue saliendo como emote (given) y se compensa en dinero aparte', () => {
  const tier = BP_SEASON.tiers.findIndex((x) => x.free.kind === 'item' && x.free.item.startsWith('emote:')) + 1;
  const s = full();
  const item = BP_SEASON.tiers[tier - 1].free.item;
  s.owned = [...s.owned, item];
  const gems = s.gems;
  const r = bpClaim(s, 'free', tier);
  assert.ok(r.ok);
  assert.equal(r.given.kind, 'item');
  assert.equal(r.given.item, item);
  assert.equal(r.dupCash, BP_SEASON.duplicateCash);
  assert.equal(r.state.gems, gems + BP_SEASON.duplicateCash);
});
t('la ruleta sigue válida con el sector de monedas 2v2', () => {
  assert.deepEqual(validateWheelConfig(), []);
  assert.ok(WHEEL.slots.some((x) => x.prize.kind === 'coins2v2'));
});
t('el premio del sector de monedas 2v2 se resuelve y sube con el bonus de la ruleta dorada', () => {
  const s = newPlayer();
  const slot = WHEEL.slots.find((x) => x.prize.kind === 'coins2v2');
  const base = W.resolvePrize(slot, s, () => 0);
  assert.deepEqual(base, { kind: 'coins2v2', amount: slot.prize.amount });
  assert.ok(W.scaleReward(base, 'gold').amount > base.amount);
  assert.equal(W.scaleReward(base, 'normal').amount, base.amount);
});

console.log(`${ok} pruebas OK`);
