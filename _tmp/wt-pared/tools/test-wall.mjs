// Pruebas de la pared del fondo. Uso: node tools/test-wall.mjs
import assert from 'node:assert/strict';
import { WALL, wallFromArt, wallHit, wallOutcome } from '../src/logic/BackWall.ts';

let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};

// ---- copia de src/config.ts, src/view/projection.ts y stepBall / aimShot de src/objects/Ball.ts
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 };
const ALLEY = 60, NET_X = 640, NET_HEIGHT = 34, GRAVITY = 950, BOUNCE_DAMP = 0.62, SHOT_SPEED = 640, HIT_MAX_Z = 135, HIT_RANGE = 78;
const LAT_C = 410, HALF_W = 180, B_X1 = COURT.right + 130;
const VIEW = { W: 720, NEAR_Y: 900, FAR_Y: 330, NEAR_W: 700, RATIO: 0.48, Z_K: 0.75 };
const CAM_X = (COURT.left - VIEW.RATIO * COURT.right) / (1 - VIEW.RATIO);
const D1 = COURT.left - CAM_X, D2 = COURT.right - CAM_X;
const F = (VIEW.NEAR_W * D1) / (COURT.bottom - COURT.top);
const K = (VIEW.NEAR_Y - VIEW.FAR_Y) / (1 / D1 - 1 / D2);
const H0 = VIEW.NEAR_Y - K / D1;
const project = (x, y, z = 0) => { const D = Math.max(80, x - CAM_X), s = F / D; return { sx: VIEW.W / 2 + (y - LAT_C) * s, sy: H0 + K / D - VIEW.Z_K * z * s, s }; };
function stepBall(s, dt) {
  const prevX = s.x;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vz -= GRAVITY * dt;
  const crossed = (prevX - NET_X) * (s.x - NET_X) < 0;
  if (crossed && s.y > COURT.top - ALLEY - 6 && s.y < COURT.bottom + ALLEY + 6 && s.z < NET_HEIGHT) { s.x = NET_X - Math.sign(s.vx) * 6; s.vx = -s.vx * 0.15; s.vy *= 0.3; return 'net'; }
  if (s.z <= 0 && s.vz < 0) { s.z = 0; s.vz = -s.vz * BOUNCE_DAMP; s.vx *= 0.88; s.vy *= 0.88; if (s.vz < 40) s.vz = 0; return 'bounce'; }
  return null;
}
function aimShot(from, tx, ty, speed, netMargin = 18) {
  const dx = tx - from.x, dy = ty - from.y, dist = Math.hypot(dx, dy);
  let T = Math.max(0.35, dist / speed);
  for (let i = 0; i < 25; i++) {
    const vx = dx / T, vz = (0.5 * GRAVITY * T * T - from.z) / T, tn = (NET_X - from.x) / vx;
    const zn = from.z + vz * tn - 0.5 * GRAVITY * tn * tn;
    if (tn <= 0 || tn >= T || zn > NET_HEIGHT + netMargin) break;
    T *= 1.08;
  }
  from.vx = dx / T; from.vy = dy / T; from.vz = (0.5 * GRAVITY * T * T - from.z) / T;
}
// geometría real de los dos ambientes (CourtView: WALL_AT_Y = 302; escala de la imagen en pantalla 720×1280)
const SCALE = Math.max(1280 / 1536, (720 + 400) / 1024);
const AMB = {
  'ambiente-1': wallFromArt(project, LAT_C, 302, (370 - 308) * SCALE, (370 - 240) * SCALE, VIEW.Z_K),
  'ambiente-2': wallFromArt(project, LAT_C, 302, (372 - 285) * SCALE, (372 - 210) * SCALE, VIEW.Z_K),
};

console.log('Pared del fondo');

test('geometría: la pared está donde se dibuja (base en y = 302 de pantalla) y con su altura', () => {
  for (const [name, w] of Object.entries(AMB)) {
    assert.ok(Math.abs(project(w.x, LAT_C).sy - 302) < 1e-6, name);
    assert.ok(w.x > COURT.right + 60 && w.x < COURT.right + 160, `${name} x=${w.x.toFixed(0)}`);
    assert.ok(w.padZ > 60 && w.fenceZ > w.padZ, `${name} padZ=${w.padZ.toFixed(0)} fenceZ=${w.fenceZ.toFixed(0)}`);
  }
  const w = AMB['ambiente-1'];
  console.log(`      ambiente-1: x=${w.x.toFixed(0)} muro z<${w.padZ.toFixed(0)} valla z<${w.fenceZ.toFixed(0)} · ambiente-2: muro z<${AMB['ambiente-2'].padZ.toFixed(0)} valla z<${AMB['ambiente-2'].fenceZ.toFixed(0)}`);
});

test('choque: solo al cruzar el plano yendo hacia la pared, por debajo de la valla; rebota hacia la pista', () => {
  const w = { x: 1212, padZ: 100, fenceZ: 210 };
  const s = { x: 1214, y: 400, z: 40, vx: 600, vy: 80, vz: -100 };
  assert.equal(wallHit(1205, s, w), 'pad');
  assert.ok(s.x < w.x && s.vx < 0);
  assert.ok(Math.abs(s.vx + 600 * WALL.restitution) < 1e-9);
  assert.ok(Math.abs(s.vy - 80 * WALL.keepY) < 1e-9 && Math.abs(s.vz + 100 * WALL.keepZ) < 1e-9);
  assert.equal(wallHit(s.x, { ...s, x: s.x + s.vx / 180 }, w), null, 'ya rebotada no vuelve a chocar');
  assert.equal(wallHit(1205, { x: 1214, y: 400, z: 150, vx: 600, vy: 0, vz: 0 }, w), 'fence');
  assert.equal(wallHit(1205, { x: 1214, y: 400, z: 230, vx: 600, vy: 0, vz: 0 }, w), null, 'por encima de la valla');
  assert.equal(wallHit(1213, { x: 1215, y: 400, z: 40, vx: 600, vy: 0, vz: 0 }, w), null, 'ya estaba detrás');
  assert.equal(wallHit(1214, { x: 1210, y: 400, z: 40, vx: -300, vy: 0, vz: 0 }, w), null, 'alejándose');
});

test('reglas: tras botar → punto de quien golpeó; sin botar → fuera; saque → falta; punto ya decidido → nada', () => {
  assert.deepEqual(wallOutcome({ rally: true, hitter: 'player', serving: false, bounces: 1 }), { kind: 'point', winner: 'hitter', reason: 'winner' });
  assert.deepEqual(wallOutcome({ rally: true, hitter: 'player', serving: false, bounces: 0 }), { kind: 'point', winner: 'receiver', reason: 'out' });
  assert.deepEqual(wallOutcome({ rally: true, hitter: 'player', serving: true, bounces: 0 }), { kind: 'fault' });
  assert.deepEqual(wallOutcome({ rally: false, hitter: 'player', serving: false, bounces: 1 }), { kind: 'none' });
  assert.deepEqual(wallOutcome({ rally: true, hitter: null, serving: false, bounces: 1 }), { kind: 'none' });
});

// ---- golpes del jugador simulados (bucle de MatchScene: 3 subpasos/fotograma, pared tras los golpes)
let seed = 77;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const rr = (a, b) => a + (b - a) * rnd();
function playerShot() {
  const s = { x: rr(110, 560), y: rr(COURT.top - 40, COURT.bottom + 40), z: rr(22, 110), vx: 0, vy: 0, vz: 0 };
  const own = COURT.right - NET_X, k = rnd();
  // como playerHit: normal / cargado (1,25–1,85×) / globo / SMASH (1,75×) / algunos largos (fuera)
  const tx = k < 0.1 ? COURT.right + rr(10, 160) : NET_X + own * rr(0.1, 0.95);
  const ty = LAT_C + rr(-1, 1) * (HALF_W - 20);
  const speed = SHOT_SPEED * [1, 1.3, 1.55, 1.85, 0.85, 1.75][Math.floor(rnd() * 6)];
  const margin = rnd() < 0.15 ? 75 : rr(6, 18);
  aimShot(s, tx, ty, speed, margin);
  return s;
}
/** Resultado del punto si el rival no llega: con pared o sin ella (como hasta ahora). */
function outcome(b0, wall, fps) {
  const s = { ...b0 };
  let bounces = 0, t = 0, hits = 0, maxX = -Infinity;
  const dt = Math.min(0.05, 1 / fps);
  for (let f = 0; f < 4 * fps; f++) {
    for (let i = 0; i < 3; i++) {
      const px = s.x;
      const ev = stepBall(s, dt / 3);
      t += dt / 3;
      if (ev === 'net') return { res: 'red', t };
      if (ev === 'bounce') {
        if (bounces === 0) {
          if (!(s.x >= COURT.left && s.x <= COURT.right && s.y >= COURT.top && s.y <= COURT.bottom) || s.x < NET_X) return { res: 'fuera', t, x: s.x, hits };
          bounces = 1;
        } else return { res: 'punto', t, x: s.x, hits };
      }
      if (wall) {
        const k = wallHit(px, s, wall);
        if (k) {
          hits++;
          const o = wallOutcome({ rally: true, hitter: 'player', serving: false, bounces });
          return { res: o.reason === 'out' ? 'fuera' : 'punto', t, x: s.x, wall: k, hits };
        }
        if (s.z < wall.fenceZ) maxX = Math.max(maxX, s.x);
      }
    }
  }
  return { res: 'nada', t, hits };
}

const shots = Array.from({ length: 6000 }, playerShot);

test('mismo resultado del punto que antes en todos los golpes (6000) y ambos estadios; nunca atraviesa la pared', () => {
  for (const [name, w] of Object.entries(AMB)) {
    let same = 0, n = 0;
    for (const b of shots) {
      const before = outcome(b, null, 60);
      const after = outcome(b, w, 60);
      if (before.res === 'red' || before.res === 'nada') continue;
      n++;
      if (before.res === after.res) same++;
      if (after.wall) assert.ok(after.x < w.x, 'queda delante de la pared');
      assert.ok(after.hits <= 1, 'un solo choque decide');
    }
    assert.equal(same, n, `${name}: ${same}/${n}`);
  }
});

// La física de siempre (stepBall, Euler) ya cambia un poco con los FPS: eso no lo decide la pared. Lo correcto es
// comprobar, A CADA tasa, que la pared no cambia el resultado frente a esa misma tasa sin pared.
let physDrift = 0;
test('30 / 60 / 120 / 144 fps: a cada tasa, mismo resultado con y sin pared, sin atravesarla, un solo choque', () => {
  for (const [name, w] of Object.entries(AMB)) {
    for (const fps of [30, 60, 120, 144]) {
      for (const b of shots.slice(0, 2000)) {
        const before = outcome(b, null, fps);
        if (before.res === 'red' || before.res === 'nada') continue;
        const after = outcome(b, w, fps);
        assert.equal(after.res, before.res, `${name} fps=${fps}`);
        assert.ok(after.hits <= 1);
        if (after.wall) assert.ok(after.x < w.x);
        // informe: cuánto mueve la física de siempre el 2º bote entre 30 fps y 240 fps (sin pared)
        if (fps === 30 && name === 'ambiente-1' && before.x !== undefined) {
          const ref = outcome(b, null, 240);
          if (ref.x !== undefined && ref.res === before.res) physDrift = Math.max(physDrift, Math.abs(ref.x - before.x));
        }
      }
    }
  }
});

// ---- informe: cuántos golpes chocan, cuánto antes se ve el final, y lo que el rival alcanzaba "detrás" de la pared
const w = AMB['ambiente-1'];
let toWall = 0, wallPad = 0, wallFence = 0, valid = 0, earlier = [], behind = 0;
for (const b of shots) {
  const before = outcome(b, null, 60);
  if (before.res === 'red' || before.res === 'nada') continue;
  valid++;
  const after = outcome(b, w, 60);
  if (after.wall) {
    toWall++;
    after.wall === 'pad' ? wallPad++ : wallFence++;
    earlier.push(before.t - after.t);
  }
  // ¿La pared le quita una devolución al rival? Rival colocado donde lo pone su IA (predictIntercept, como BotAI) o,
  // si no hay punto, en su posición de espera. Devuelve en el PRIMER subpaso en que la pelota entra en su alcance
  // (checkHits); con pared, solo si eso ocurre antes de que la pelota llegue a la pared.
  const bot = botSpot(b);
  const reach = (s) => Math.hypot(s.x - (bot.x - 15), (s.y - bot.y) * 1.25) < HIT_RANGE && s.z < HIT_MAX_Z;
  const hitWithout = firstReach(b, null, reach), hitWith = firstReach(b, w, reach);
  if (hitWithout && !hitWith) behind++;
}
/** Punto de intercepción del rival: copia de predictIntercept (Ball.ts, lado 'far', minT 0.3), dentro de B_X / Y. */
function botSpot(b0) {
  const s = { ...b0 };
  let bounces = 0, fallback = null;
  for (let t = 0; t < 4; t += 1 / 120) {
    const ev = stepBall(s, 1 / 120);
    if (ev === 'net') break;
    if (ev === 'bounce') bounces++;
    if (bounces >= 2) break;
    if (t < 0.3 || !(s.x > NET_X + 30)) continue;
    if (bounces >= 1 && s.z < HIT_MAX_Z * 0.7) { fallback = { x: s.x, y: s.y }; break; }
    if (!fallback && s.z < HIT_MAX_Z * 0.8) fallback = { x: s.x, y: s.y };
  }
  const p = fallback ?? { x: COURT.right + 40, y: LAT_C };
  return { x: Math.min(B_X1, Math.max(NET_X + 45, p.x + 15)), y: Math.min(640, Math.max(180, p.y)) };
}
/** ¿Entra la pelota en el alcance del rival antes de decidirse el punto? (con o sin pared; 3 subpasos a 60 fps) */
function firstReach(b0, wall, reach) {
  const s = { ...b0 };
  let bounces = 0;
  for (let i = 0; i < 4 * 180; i++) {
    const px = s.x;
    const ev = stepBall(s, 1 / 180);
    if (ev === 'net') return false;
    if (ev === 'bounce') { if (bounces === 0 && (s.x > COURT.right || s.x < NET_X)) return false; if (++bounces >= 2) return false; }
    if (s.x > NET_X && s.vx > 0 && reach(s)) return true; // checkHits va antes que la pared
    if (wall && wallHit(px, s, wall)) return false;
  }
  return false;
}
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] ?? 0; };
console.log(`\n${ok} pruebas OK`);
console.log(`\nInforme (6000 golpes del jugador, estadio ambiente-1):`);
console.log(`  llegan a la pared antes de decidirse el punto: ${((toWall / valid) * 100).toFixed(1)} %  (muro ${wallPad}, valla ${wallFence})`);
console.log(`  el final del punto se ve antes: mediana ${(med(earlier) * 1000).toFixed(0)} ms`);
console.log(`  (física de siempre, sin pared) a 30 fps el bote se desplaza hasta ${physDrift.toFixed(1)} u respecto a 240 fps`);
console.log(`  devoluciones del rival que la pared le quita (rival donde lo coloca su IA): ${((behind / valid) * 100).toFixed(2)} %`);
