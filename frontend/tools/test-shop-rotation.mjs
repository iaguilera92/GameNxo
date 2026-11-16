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
test('CARGANDO GOLPE tiene 3: no hay otros que mostrar, no cambia', () => {
  if (count('charge') <= 3) assert.equal(R.offersChangeIn('charge', t0), null);
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
console.log(`${ok} pruebas OK`);
