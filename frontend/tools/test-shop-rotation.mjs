// Pruebas de la rotación de la Tienda (domain/shopRotation.ts). Uso: node tools/test-shop-rotation.mjs
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
const R = await import('../src/domain/shopRotation.ts');
const { SHOP_ITEMS } = await import('../src/domain/shopCatalog.ts');
const { newPlayer } = await import('../src/domain/player.ts');
let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};
const HOUR = 3600_000;
const t0 = Date.UTC(2026, 10, 15, 15, 0); // 12:00 en Chile (verano)
const ids = (kind, now) => R.shopOffers(kind, now).map((i) => i.id);
const count = (kind) => SHOP_ITEMS.filter((i) => i.kind === kind && i.available).length;

test('cada categoría con rotación muestra 3 (o los que haya)', () => {
  for (const kind of ['charge', 'smash', 'defensive', 'inferno']) assert.equal(R.shopOffers(kind, t0).length, Math.min(3, count(kind)), kind);
});
test('EFECTO PELOTA no rota: están todos los que se venden', () => {
  assert.equal(R.shopOffers('style', t0).length, count('style'));
  assert.equal(R.offersChangeIn('style', t0), null);
});
test('CARGANDO GOLPE tiene 3: se ven todas siempre y el contador sale igual (21-11-2026)', () => {
  if (count('charge') <= 3) {
    assert.notEqual(R.offersChangeIn('charge', t0), null);
    assert.deepEqual(ids('charge', t0), ids('charge', t0 + 13 * HOUR));
  }
});
test('la misma hora da lo mismo (igual para todos)', () => {
  assert.deepEqual(ids('smash', t0), ids('smash', t0 + 1000));
});
test('ESPECIAL y DEFENSIVO cambian cada 12 h; ULTI cada 24 h', () => {
  const w12 = R.rotationWindow(t0, 12);
  const w24 = R.rotationWindow(t0, 24);
  assert.ok(w12.nextMs > 0 && w12.nextMs <= 12 * HOUR);
  assert.ok(w24.nextMs > 0 && w24.nextMs <= 25 * HOUR);
  const a = R.rotationWindow(t0 + w12.nextMs + 1000, 12);
  assert.equal(a.id, w12.id + 1);
  const b = R.rotationWindow(t0 + w24.nextMs + 1000, 24);
  assert.equal(b.id, w24.id + 1);
  assert.ok(R.rotationWindow(t0 + 1000, 12).id === w12.id);
});
test('al cambiar de ventana se ven otros (ningún cambio deja lo mismo)', () => {
  for (const [kind, hours] of [['smash', 12], ['defensive', 12], ['inferno', 24]]) {
    let now = t0;
    let prev = ids(kind, now).join();
    for (let i = 0; i < 12; i++) {
      now += R.rotationWindow(now, hours).nextMs + 1000;
      const cur = ids(kind, now).join();
      assert.notEqual(cur, prev, `${kind} ventana ${i}`);
      prev = cur;
    }
  }
});
test('con el tiempo salen todos los ítems de la categoría', () => {
  for (const [kind, hours] of [['smash', 12], ['defensive', 12], ['inferno', 24]]) {
    const seen = new Set();
    let now = t0;
    for (let i = 0; i < 12; i++) {
      for (const id of ids(kind, now)) seen.add(id);
      now += R.rotationWindow(now, hours).nextMs + 1000;
    }
    assert.equal(seen.size, count(kind), kind);
  }
});
test('purchaseOffered rechaza lo que no está en la Tienda ahora y deja pasar lo que sí', () => {
  const s = newPlayer();
  s.gems = 1000;
  s.level = 20;
  const shown = new Set(ids('smash', t0));
  const hidden = SHOP_ITEMS.find((i) => i.kind === 'smash' && i.available && !shown.has(i.id));
  const visible = SHOP_ITEMS.find((i) => shown.has(i.id));
  assert.equal(R.purchaseOffered(s, hidden.id, t0).error, 'not_in_shop');
  assert.ok(R.purchaseOffered(s, visible.id, t0).ok);
});
test('ZONA: 2 a la vez, ventana semanal que cambia el domingo y contador siempre', () => {
  assert.equal(R.shopOffers('zone', t0).length, Math.min(2, count('zone')));
  assert.notEqual(R.offersChangeIn('zone', t0), null);
  const sat = Date.UTC(2026, 10, 21, 15, 0); // sabado
  const sun = Date.UTC(2026, 10, 22, 15, 0); // domingo
  const nextSat = Date.UTC(2026, 10, 28, 15, 0);
  assert.equal(R.rotationWindow(sun, 168).id, R.rotationWindow(nextSat, 168).id);
  assert.equal(R.rotationWindow(sat, 168).id + 1, R.rotationWindow(sun, 168).id);
});
test('CAMBIO de ofertas: cobra 100, trae otros ítems y solo una vez por categoría y semana', () => {
  const s = { ...newPlayer(), gems: 250 };
  const before = ids('smash', t0);
  const r = R.rerollShop(s, 'smash', t0);
  assert.ok(r.ok);
  assert.equal(r.state.gems, 250 - R.REROLL_PRICE);
  const after = R.shopOffers('smash', t0, r.state).map((i) => i.id);
  assert.notDeepEqual(after, before); // otros ítems
  assert.equal(R.rerollShop(r.state, 'smash', t0 + 1000).error, 'already_rerolled');
  assert.equal(r.state.gems, 150);
  // otra categoría sí se puede cambiar esa semana
  assert.ok(R.rerollShop(r.state, 'defensive', t0 + 1000).ok);
});
test('CAMBIO: sin más ítems que mostrar o sin dinero no cobra', () => {
  const s = { ...newPlayer(), gems: 250 };
  assert.equal(R.rerollShop(s, 'charge', t0).error, 'nothing_to_change');
  assert.equal(R.rerollShop(s, 'zone', t0).error, 'nothing_to_change');
  assert.equal(R.rerollShop({ ...s, gems: 99 }, 'smash', t0).error, 'not_enough_cash');
  assert.equal(s.gems, 250);
});
test('CAMBIO: lo que se ve ahora es lo comprable (purchaseOffered usa el cambio)', () => {
  const s = { ...newPlayer(), gems: 5000, level: 30 };
  const r = R.rerollShop(s, 'smash', t0);
  const shown = R.shopOffers('smash', t0, r.state)[0];
  const old = ids('smash', t0).find((id) => !R.shopOffers('smash', t0, r.state).some((o) => o.id === id));
  assert.ok(R.purchaseOffered(r.state, shown.id, t0).ok);
  assert.equal(R.purchaseOffered(r.state, old, t0).error, 'not_in_shop');
});
test('CAMBIO: se reinicia el lunes (semana siguiente se puede de nuevo y vuelve la rotación normal)', () => {
  const s = { ...newPlayer(), gems: 500 };
  const r = R.rerollShop(s, 'smash', t0);
  const nextWeek = t0 + 8 * 24 * HOUR;
  assert.equal(R.rerolledThisWeek(r.state, 'smash', nextWeek), false);
  assert.deepEqual(R.shopOffers('smash', nextWeek, r.state).map((i) => i.id), ids('smash', nextWeek));
  const again = R.rerollShop(r.state, 'smash', nextWeek);
  assert.ok(again.ok);
  assert.deepEqual(again.state.shopReroll.kinds, ['smash']); // de la semana nueva solo
});console.log(`${ok} pruebas OK`);
