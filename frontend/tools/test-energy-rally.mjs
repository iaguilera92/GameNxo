// Pruebas del guion de la ULTI LEGENDARIA BOLA DE ENERGÍA (logic/EnergyRally.ts, 17-11-2026). Uso: node tools/test-energy-rally.mjs
// Los módulos de src importan sin extensión (Vite): este cargador añade ".ts" al resolver.
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
const E = await import('../src/logic/EnergyRally.ts');
const { COURT, NET_X } = await import('../src/config.ts');
const { SHOP_ITEMS } = await import('../src/domain/shopCatalog.ts');
const P = await import('../src/domain/infernoPowers.ts');

let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};
const a = { x: 420, y: 380 };
const v = { x: 980, y: 450 };

test('mismo guion con la misma semilla (los dos teléfonos ven lo mismo)', () => {
  assert.deepEqual(E.planEnergyRally(a, v, 1234), E.planEnergyRally(a, v, 1234));
});
test('3 estiradas del rival en lados alternos; la última lo deja tendido', () => {
  for (const seed of [1, 7, 99, 4242, 99990]) {
    const p = E.planEnergyRally(a, v, seed);
    const dives = p.shots.filter((s) => s.side);
    assert.equal(dives.length, E.ENERGY_RALLY.returns);
    for (let i = 1; i < dives.length; i++) assert.equal(dives[i].side, -dives[i - 1].side);
    assert.deepEqual(dives.map((d) => !!d.lie), [false, false, true]);
    // golpes alternos y el último es la bola final
    p.shots.forEach((s, i) => assert.equal(s.by, i % 2 === 0 ? 'att' : 'vic'));
    assert.equal(p.shots.at(-1).final, true);
    assert.equal(p.shots.filter((s) => s.final).length, 1);
  }
});
test('se quedan donde están (17-11-2026): el que lanza en su sitio y el rival en su fila', () => {
  const p = E.planEnergyRally(a, v, 5);
  assert.deepEqual(p.att, a);
  assert.deepEqual(p.vic, v);
  assert.ok(p.att.x < NET_X && p.vic.x > NET_X);
  // el rival solo se mueve de lado (su x no cambia en todo el peloteo)
  const o = { x: 0, y: 0 };
  for (let t = 0; t <= p.endMs; t += 50) assert.equal(E.victimAt(p, t, o).x, v.x);
});
test('cerca de una banda: la 1.ª estirada va hacia el centro', () => {
  const p = E.planEnergyRally(a, { x: 980, y: COURT.top + 10 }, 9);
  assert.equal(p.shots.find((s) => s.side).side, 1);
  const q = E.planEnergyRally(a, { x: 980, y: COURT.bottom - 10 }, 9);
  assert.equal(q.shots.find((s) => s.side).side, -1);
});
test('las devoluciones del rival botan antes de llegar (como en PERSONALIZAR)', () => {
  const p = E.planEnergyRally(a, v, 21);
  const o = { x: 0, y: 0, z: 0 };
  for (const s of p.shots.filter((s) => s.by === 'vic')) {
    assert.ok(s.bounce);
    E.shotBallAt(s, s.t0 + s.tb * (s.t1 - s.t0), o);
    assert.ok(Math.abs(o.z) < 1e-6 && o.x < NET_X, 'bota en el campo del que lanza');
  }
});
test('tiempos encadenados y fin = llegada de la bola final', () => {
  const p = E.planEnergyRally(a, v, 77);
  // (17-11-2026) antes de la bola final, la pausa en que crece (growMs)
  for (let i = 1; i < p.shots.length; i++) assert.equal(p.shots[i].t0, p.shots[i - 1].t1 + (p.shots[i].final ? E.ENERGY_RALLY.growMs : 0));
  assert.equal(p.endMs, p.shots.at(-1).t1);
  assert.ok(p.endMs < 6000, `peloteo corto: ${p.endMs} ms`);
});
test('la pelota sale de la raqueta y llega al punto (y pasa por encima de la red)', () => {
  const p = E.planEnergyRally(a, v, 3);
  const o = { x: 0, y: 0, z: 0 };
  for (const s of p.shots) {
    E.shotBallAt(s, s.t0, o);
    assert.deepEqual(o, { ...s.from });
    E.shotBallAt(s, s.t1, o);
    assert.ok(Math.abs(o.x - s.to.x) < 1e-6 && Math.abs(o.y - s.to.y) < 1e-6 && Math.abs(o.z - s.to.z) < 1e-6);
    // a la altura de la red
    const u = (NET_X - s.from.x) / (s.to.x - s.from.x);
    E.shotBallAt(s, s.t0 + u * (s.t1 - s.t0), o);
    assert.ok(o.z > 60, `pasa la red alta: ${o.z}`);
  }
});
test('el rival: en su sitio, estirado al contacto y tendido al final (donde le pega la bola)', () => {
  const p = E.planEnergyRally(a, v, 11);
  const o = { x: 0, y: 0 };
  assert.deepEqual(E.victimAt(p, 0, o), { x: p.vic.x, y: p.vic.y });
  const d0 = p.shots.find((s) => s.side);
  E.victimAt(p, d0.t1, o);
  assert.ok(Math.abs(o.y - (p.vic.y + d0.side * E.ENERGY_RALLY.diveBody)) < 1e-6);
  E.victimAt(p, p.endMs, o);
  assert.deepEqual(o, p.lie);
  assert.ok(Math.abs(p.hit.y - p.lie.y) < 1e-6);
});
test('espejo (vista del otro teléfono) ida y vuelta', () => {
  const q = E.mirrorP({ x: 300, y: 260 }, { x: 0, y: 0 });
  assert.deepEqual(E.mirrorP(q, { x: 0, y: 0 }), { x: 300, y: 260 });
  assert.equal(q.x, COURT.left + COURT.right - 300);
});
test('semilla dentro del límite del servidor (±1e5) y PRNG en [0, 1)', () => {
  const r = E.seeded(99990);
  for (let i = 0; i < 1000; i++) {
    const x = r();
    assert.ok(x >= 0 && x < 1);
  }
});
test('BOLA DE ENERGÍA: ULTI legendaria, solo dinero real', () => {
  const it = SHOP_ITEMS.find((i) => i.id === 'inferno:energy');
  assert.ok(it);
  assert.equal(it.rarity, 'legendaria');
  assert.equal(it.realMoneyOnly, true);
  assert.equal(P.isLegendaryInferno('energy'), true);
  assert.equal(P.isLegendaryInferno('fire'), false);
});
console.log(`\n${ok} pruebas OK`);
