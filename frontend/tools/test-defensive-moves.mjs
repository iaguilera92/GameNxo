// Pruebas de los defensivos VOLTERETA y PATINAJE (lógica pura). Uso: node tools/test-defensive-moves.mjs
import assert from 'node:assert/strict';
import { FLIP, SKATE, flipPose, flipSide, skateEase, skateLean } from '../src/logic/DefensiveMoves.ts';

let ok = 0;
function test(name, fn) {
  fn();
  ok++;
  console.log('  ✓ ' + name);
}
const A = { x: 300, y: 300 };
const B = { x: 500, y: 460 };
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

test('VOLTERETA: sale y llega exactamente a los puntos, sin altura ni giro sobrante al llegar', () => {
  const p0 = flipPose(A, B, 0);
  const p1 = flipPose(A, B, 1);
  assert.ok(near(p0.x, A.x) && near(p0.y, A.y) && near(p0.lift, 0));
  assert.ok(near(p1.x, B.x, 1e-6) && near(p1.y, B.y, 1e-6) && near(p1.lift, 0, 1e-6));
});
test('VOLTERETA: dos saltos que tocan el suelo en 0, 0,5 y 1 (altura máxima FLIP.height a 0,25 y 0,75)', () => {
  assert.ok(near(flipPose(A, B, 0.5).lift, 0, 1e-6));
  assert.ok(near(flipPose(A, B, 0.25).lift, FLIP.height, 1e-6));
  assert.ok(near(flipPose(A, B, 0.75).lift, FLIP.height, 1e-6));
  for (let k = 0; k <= 1; k += 0.01) assert.ok(flipPose(A, B, k).lift >= 0);
});
test('VOLTERETA: gira FLIP.turns vueltas completas (2) hacia el lado en que se mueve', () => {
  assert.equal(FLIP.turns, 2);
  assert.ok(near(Math.abs(flipPose(A, B, 1).spin), Math.PI * 2 * FLIP.turns, 1e-9));
  assert.ok(flipPose(A, B, 0.5).spin > 0); // hacia +y: sentido positivo
  assert.ok(flipPose(B, A, 0.5).spin < 0); // hacia -y: al revés
  assert.equal(flipSide(A, B), 1);
  assert.equal(flipSide(B, A), -1);
  assert.equal(flipSide(A, { x: 400, y: A.y }), 1); // sin movimiento lateral: +1
});
test('VOLTERETA: el arco se separa de la línea recta (a la mitad) pero nunca más de FLIP.arc', () => {
  const m = flipPose(A, B, 0.5);
  // distancia del punto medio a la recta A-B
  const dx = B.x - A.x;
  const dy = B.y - A.y;
  const d = Math.abs(dy * (m.x - A.x) - dx * (m.y - A.y)) / Math.hypot(dx, dy);
  assert.ok(d > 5 && d <= FLIP.arc + 1e-6, `separación ${d}`);
  const far = flipPose({ x: 0, y: 0 }, { x: 2000, y: 0 }, 0.5);
  assert.ok(Math.abs(far.y) <= FLIP.arc + 1e-6);
});
test('PATINAJE: sale rápido y frena suave (monótono, 0 → 1, más de la mitad del camino en el primer tercio)', () => {
  assert.equal(skateEase(0), 0);
  assert.equal(skateEase(1), 1);
  let prev = 0;
  for (let k = 0.01; k <= 1; k += 0.01) {
    const e = skateEase(k);
    assert.ok(e >= prev - 1e-12);
    prev = e;
  }
  assert.ok(skateEase(1 / 3) > 0.5);
});
test('PATINAJE: el cuerpo se inclina al arrancar hacia su lado y se endereza al llegar', () => {
  assert.ok(near(skateLean(A, B, 0), SKATE.lean));
  assert.ok(near(skateLean(B, A, 0), -SKATE.lean));
  assert.ok(near(skateLean(A, B, 1), 0, 1e-12));
});
test('tiempos: el recorrido cabe en lo que tarda la pelota y el hielo se derrite', () => {
  assert.ok(FLIP.airMin < FLIP.airMax && SKATE.minT < SKATE.maxT);
  assert.ok(SKATE.holdMs > 0 && SKATE.fadeMs > 0 && SKATE.width > 0);
});
console.log(`\n${ok} pruebas OK`);
