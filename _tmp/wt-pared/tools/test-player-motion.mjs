// Pruebas y estudios del movimiento del jugador. Uso: node tools/test-player-motion.mjs
//  1. Pruebas de PlayerMotion (inercia, FPS, bordes, diagonales, frenadas, giros, joystick).
//  2. Estudio de alcance: cuántas devoluciones se pierden por la inercia (tiros del rival simulados).
//  3. Estudio de compensación de perspectiva (solo números; no cambia el juego).
import assert from 'node:assert/strict';
import { JOY, MOTION, createMotion, joyResponse, runAnimRate, stepMotion, stopMotion } from '../src/logic/PlayerMotion.ts';

const MAX = 330; // PLAYER_SPEED
let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} ${a} vs ${b} (±${tol})`);

/** Simula `secs` con una entrada constante (tx, ty en fracción de la máxima). Devuelve historial. */
function run(m, tx, ty, secs, fps, jitter = 0, seed = 7) {
  let t = 0, x = 0, y = 0, r = seed;
  const rnd = () => ((r = (r * 1103515245 + 12345) % 2147483648) / 2147483648);
  const hist = [];
  const evts = [];
  while (t < secs - 1e-9) {
    const dt = Math.min(Math.min(0.05, (1 / fps) * (1 + (rnd() - 0.5) * jitter)), secs - t);
    const e = stepMotion(m, tx * MAX, ty * MAX, MAX, dt);
    if (e) evts.push({ e, t });
    x += m.dx;
    y += m.dy;
    t += dt;
    hist.push({ t, vx: m.vx, vy: m.vy, x, y });
  }
  return { hist, evts, x, y };
}
const timeTo = (hist, pred) => (hist.find(pred) ?? { t: Infinity }).t;
const FPSS = [30, 60, 90, 144];

console.log('PlayerMotion');

test('arranque: velocidad máxima en ~70 ms a 30/60/90/144 fps', () => {
  for (const fps of FPSS) {
    const m = createMotion();
    const { hist } = run(m, 1, 0, 0.3, fps);
    near(timeTo(hist, (h) => h.vx >= MAX - 1e-6), MOTION.accelTime, 1 / fps + 1e-6, `fps=${fps}`);
  }
});

test('frenada al soltar: de máxima a 0 en ~50 ms', () => {
  for (const fps of FPSS) {
    const m = createMotion();
    m.vx = MAX;
    const { hist } = run(m, 0, 0, 0.3, fps);
    near(timeTo(hist, (h) => Math.abs(h.vx) < 1e-6), MOTION.decelTime, 1 / fps + 1e-6, `fps=${fps}`);
  }
});

test('cambio de sentido: frena el doble de rápido (~25 ms) y arranca normal (total ~95 ms); nunca pasa de la máxima', () => {
  for (const fps of FPSS) {
    const m = createMotion();
    m.vx = MAX;
    const { hist } = run(m, -1, 0, 0.4, fps);
    const zero = timeTo(hist, (h) => h.vx <= 0);
    near(zero, MOTION.decelTime / MOTION.reverseMult, 1 / fps + 1e-6, `cruce fps=${fps}`);
    near(timeTo(hist, (h) => h.vx <= -MAX + 1e-6), MOTION.decelTime / MOTION.reverseMult + MOTION.accelTime, 1 / fps + 1e-6, `máx fps=${fps}`);
    assert.ok(hist.every((h) => Math.hypot(h.vx, h.vy) <= MAX + 1e-6));
  }
});

test('diagonal: misma velocidad máxima que en recto y dirección exacta (45°)', () => {
  const m = createMotion();
  const d = Math.SQRT1_2;
  const { hist } = run(m, d, d, 0.3, 60);
  const last = hist.at(-1);
  near(Math.hypot(last.vx, last.vy), MAX, 1e-6);
  near(Math.atan2(last.vy, last.vx), Math.PI / 4, 1e-9);
  assert.ok(hist.every((h) => Math.hypot(h.vx, h.vy) <= MAX + 1e-6));
});

test('giro de 90°: sin derrape ni exceso de velocidad, orientado en ≤ 90 ms (≈ 83 ms a cualquier FPS)', () => {
  for (const fps of FPSS) {
    const m = createMotion();
    m.vx = MAX;
    const { hist } = run(m, 0, 1, 0.3, fps);
    assert.ok(hist.every((h) => Math.hypot(h.vx, h.vy) <= MAX + 1e-6));
    assert.ok(timeTo(hist, (h) => h.vy >= MAX * 0.99 && Math.abs(h.vx) < 1) <= 0.09 + 1 / fps);
  }
});

test('FPS: misma secuencia (arrancar, girar, invertir, soltar) → misma posición (±1,5 px) a 30–144 fps y con tirones', () => {
  const seq = (fps, jitter) => {
    const m = createMotion();
    let x = 0, y = 0;
    for (const [tx, ty, s] of [[1, 0, 0.4], [0, -1, 0.3], [-1, 0, 0.35], [Math.SQRT1_2, Math.SQRT1_2, 0.3], [0, 0, 0.2]]) {
      const r = run(m, tx, ty, s, fps, jitter);
      x += r.x;
      y += r.y;
    }
    return { x, y };
  };
  const ref = seq(960, 0);
  for (const fps of FPSS) for (const j of [0, 0.4]) {
    const p = seq(fps, j);
    assert.ok(Math.hypot(p.x - ref.x, p.y - ref.y) <= 1.5, `fps=${fps} j=${j}: Δ=${Math.hypot(p.x - ref.x, p.y - ref.y).toFixed(2)}`);
  }
});

test('bordes: empujando contra la pared no acumula velocidad; al salir arranca desde 0', () => {
  // misma regla que MatchScene: si la posición se recorta, esa componente de velocidad = 0
  const m = createMotion();
  let y = 630; const WALL = 640;
  for (let i = 0; i < 60; i++) {
    stepMotion(m, MAX, 0, MAX, 1 / 60);
    const ny = y + m.dx;
    y = Math.min(ny, WALL);
    if (y !== ny) m.vx = 0;
  }
  assert.equal(y, WALL);
  assert.equal(m.vx, 0);
  // cambiar de sentido pegado a la pared: no hay frenada pendiente (no "rebota" ni se pega)
  stepMotion(m, -MAX, 0, MAX, 1 / 60);
  near(m.vx, -MAX / MOTION.accelTime / 60, 1e-6);
});

test('eventos: frenada solo al soltar rápido (una vez); giro solo al invertir corriendo (una vez)', () => {
  let m = createMotion();
  m.vx = MAX;
  assert.deepEqual(run(m, 0, 0, 0.2, 60).evts.map((e) => e.e), ['skid']);
  m = createMotion();
  m.vx = MAX * 0.4;
  assert.deepEqual(run(m, 0, 0, 0.2, 60).evts, []); // paso corto: para en reposo, sin frenada
  m = createMotion();
  m.vx = MAX;
  assert.deepEqual(run(m, -1, 0, 0.3, 144).evts.map((e) => e.e), ['turn']);
  m = createMotion();
  m.vx = MAX * 0.3;
  assert.deepEqual(run(m, -1, 0, 0.3, 60).evts, []); // invertir despacio: volteo normal
  m = createMotion();
  m.vx = MAX;
  assert.deepEqual(run(m, 0, -1, 0.3, 60).evts, []); // girar 90° no es cambio de sentido lateral
});

test('parar() deja la velocidad a 0 al instante (carga, DASH, saque: como antes)', () => {
  const m = createMotion();
  run(m, 1, 1, 0.3, 60);
  stopMotion(m);
  assert.deepEqual([m.vx, m.vy], [0, 0]);
});

test('joystick: 0 en la zona muerta, sin salto al salir, creciente, máxima desde el 85 %', () => {
  assert.equal(joyResponse(0.11), 0);
  assert.ok(joyResponse(0.121) < 0.01); // antes saltaba a 0,12
  let prev = 0;
  for (let m = JOY.dead; m <= 1; m += 0.001) {
    const v = joyResponse(m);
    assert.ok(v >= prev - 1e-12);
    prev = v;
  }
  assert.equal(joyResponse(0.85), 1);
  assert.equal(joyResponse(1), 1);
  assert.ok(joyResponse(0.4) < 0.4); // más control fino a media inclinación
});

test('animación de carrera: ritmo = velocidad (acotado 0,45–1,1); a tope = ritmo de siempre (1)', () => {
  assert.equal(runAnimRate(1), 1);
  assert.equal(runAnimRate(0.1), MOTION.runAnimMin);
  assert.equal(runAnimRate(2), MOTION.runAnimMax);
});

console.log(`\n${ok} pruebas OK`);

// =====================================================================================
// 2) ESTUDIO DE ALCANCE: tiros del rival simulados con la física real del juego (copia de
//    stepBall / aimShot de src/objects/Ball.ts y constantes de src/config.ts).
// =====================================================================================
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 };
const ALLEY = 60, NET_X = 640, NET_HEIGHT = 34, GRAVITY = 950, BOUNCE_DAMP = 0.62, SHOT_SPEED = 640;
const HIT_RANGE = 78, HIT_MAX_Z = 135, SIDE_MARGIN = 50;
const P_X = [COURT.left - 70, NET_X - 45], Y_MIN = COURT.top - SIDE_MARGIN, Y_MAX = COURT.bottom + SIDE_MARGIN;
const LAT_C = 410, HALF_W = 180;

function stepBall(s, dt) {
  const prevX = s.x;
  s.x += s.vx * dt; s.y += s.vy * dt; s.z += s.vz * dt; s.vz -= GRAVITY * dt;
  if (s.ay) s.vy += s.ay * dt;
  const crossed = (prevX - NET_X) * (s.x - NET_X) < 0;
  if (crossed && s.y > COURT.top - ALLEY - 6 && s.y < COURT.bottom + ALLEY + 6 && s.z < NET_HEIGHT) return 'net';
  if (s.z <= 0 && s.vz < 0) {
    s.z = 0; s.vz = -s.vz * (s.damp ?? BOUNCE_DAMP);
    const f = s.fric ?? 0.88; s.vx *= f; s.vy *= f;
    if (s.vz < 40) s.vz = 0;
    return 'bounce';
  }
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

let seed = 2026;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const rr = (a, b) => a + (b - a) * rnd();

/** Tiro del rival con la forma de BotBrain.planShot (profundo / cruzado / dejada / globo / normal). */
function botShot(d) {
  const s = { x: rr(NET_X + 180, COURT.right + 80), y: rr(COURT.top + 20, COURT.bottom - 20), z: rr(35, 80), vx: 0, vy: 0, vz: 0 };
  const q = rr(0.6, 1);
  let speed = SHOT_SPEED * (0.82 + 0.3 * d) * (0.85 + 0.15 * q), margin = 18, tx, ty;
  const ownLen = NET_X - COURT.left;
  const k = rnd();
  const side = () => LAT_C + (rnd() < 0.5 ? -1 : 1) * rr(0.2, 0.95) * (HALF_W - 40);
  if (k < 0.35) { tx = NET_X - ownLen * rr(0.8, 0.95); ty = side(); speed *= 1.12; }
  else if (k < 0.7) { tx = NET_X - ownLen * rr(0.45, 0.75); ty = LAT_C + (rnd() < 0.5 ? -1 : 1) * rr(0.75, 1) * (HALF_W - 40); }
  else if (k < 0.8) { tx = NET_X - ownLen * rr(0.1, 0.25); ty = side(); speed = SHOT_SPEED * 0.78; margin = 8; }
  else if (k < 0.9) { tx = NET_X - ownLen * rr(0.82, 0.94); ty = side(); speed = SHOT_SPEED * 0.85; margin = 75; }
  else { tx = NET_X - ownLen * rr(0.55, 0.88); ty = side(); }
  aimShot(s, tx, ty, speed, margin);
  return s;
}

/** Distancia (en línea recta) que puede recorrer el jugador en τ s partiendo de vel. inicial v0 (fracción, + = hacia el objetivo). */
function capability(model, v0) {
  const dt = 1 / 480, table = [];
  if (model === 'instant') return (tau) => (tau <= 0 ? 0 : MAX * tau);
  const saved = { ...MOTION };
  Object.assign(MOTION, model);
  const m = createMotion();
  m.vx = v0 * MAX;
  let x = 0;
  for (let t = 0; t <= 2; t += dt) {
    table.push(x);
    stepMotion(m, MAX, 0, MAX, dt);
    x += m.dx;
  }
  Object.assign(MOTION, saved);
  return (tau) => (tau <= 0 ? Math.min(0, v0) : table[Math.min(table.length - 1, Math.floor(tau / dt))]);
}

/** ¿Llega el jugador (con su modelo de movimiento) a tener la pelota en el alcance antes del 2º bote? */
function reachable(ball, pl, react, cap) {
  const s = { ...ball };
  let bounces = 0;
  const dt = 1 / 240;
  for (let t = 0; t < 4; t += dt) {
    const ev = stepBall(s, dt);
    if (ev === 'net') return null; // a la red: no cuenta
    if (ev === 'bounce' && s.x < NET_X) {
      if (bounces === 0 && (s.x < COURT.left || s.y < COURT.top || s.y > COURT.bottom)) return null; // fuera: no cuenta
      if (++bounces >= 2) return false;
    }
    if (s.x >= NET_X || s.z >= HIT_MAX_Z) continue;
    // punto de raqueta necesario (el jugador está limitado a su zona)
    const dx = s.x - (pl.x + 15), dy = s.y - pl.y;
    const dS = Math.hypot(dx, dy * 1.25);
    const need = dS < HIT_RANGE ? 0 : ((dS - HIT_RANGE) * Math.hypot(dx, dy)) / dS;
    if (need <= cap(t - react) + 1e-9) return true;
  }
  return false;
}

const N = 6000;
const shots = [];
for (let i = 0; i < N; i++) {
  const d = [0.3, 0.6, 0.9][i % 3];
  shots.push({ ball: botShot(d), pl: { x: rr(130, 230), y: LAT_C + rr(-130, 130) }, react: rr(0.15, 0.3) });
}
const variants = [
  ['Instantáneo (antes)', 'instant'],
  ['Inercia 70/50 ms (nueva)', {}],
  ['  + impulso de arranque 30 %', { startImpulse: 0.3 }],
  ['  + aceleración 55 ms', { accelTime: 0.055 }],
];
console.log('\nEstudio de alcance: devoluciones alcanzables de 6000 tiros del rival (dificultad 0,3/0,6/0,9)');
console.log('  modelo                          parado     corriendo en contra   pérdida en devoluciones');
const base = {};
for (const [name, model] of variants) {
  const res = [];
  for (const v0 of [0, -1]) {
    const cap = capability(model, v0);
    let yes = 0, valid = 0;
    for (const sh of shots) {
      const r = reachable(sh.ball, sh.pl, sh.react, model === 'instant' && v0 === -1 ? (tau) => (tau <= 0 ? 0 : MAX * tau) : cap);
      if (r === null) continue;
      valid++;
      if (r) yes++;
    }
    res.push({ yes, valid });
  }
  if (model === 'instant') Object.assign(base, { r0: res[0].yes, r1: res[1].yes });
  const lost0 = ((base.r0 - res[0].yes) / base.r0) * 100, lost1 = ((base.r1 - res[1].yes) / base.r1) * 100;
  console.log(`  ${name.padEnd(30)}  ${String(res[0].yes).padStart(5)}/${res[0].valid}   ${String(res[1].yes).padStart(5)}/${res[1].valid}          parado −${lost0.toFixed(2)} %  en contra −${lost1.toFixed(2)} %`);
}
// margen (px) con el movimiento instantáneo en el MEJOR instante: cuánto le sobra al jugador
function slackOf(ball, pl, react) {
  const s = { ...ball };
  let bounces = 0, best = -Infinity;
  for (let t = 0; t < 4; t += 1 / 240) {
    const ev = stepBall(s, 1 / 240);
    if (ev === 'net') return null;
    if (ev === 'bounce' && s.x < NET_X) {
      if (bounces === 0 && (s.x < COURT.left || s.y < COURT.top || s.y > COURT.bottom)) return null;
      if (++bounces >= 2) break;
    }
    if (s.x >= NET_X || s.z >= HIT_MAX_Z) continue;
    const dx = s.x - (pl.x + 15), dy = s.y - pl.y, dS = Math.hypot(dx, dy * 1.25);
    const need = dS < HIT_RANGE ? 0 : ((dS - HIT_RANGE) * Math.hypot(dx, dy)) / dS;
    best = Math.max(best, MAX * Math.max(0, t - react) - need);
  }
  return best;
}
const slacks = shots.map((sh) => slackOf(sh.ball, sh.pl, sh.react)).filter((v) => v !== null);
const pctBelow = (px) => ((slacks.filter((v) => v >= 0 && v < px).length / slacks.length) * 100).toFixed(1);
console.log(`  tiros ajustados (margen instantáneo < 12 px): ${pctBelow(12)} %   (< 24 px): ${pctBelow(24)} %   (< 78 px): ${pctBelow(78)} %`);
for (const [label, v0] of [['parado', 0], ['en contra', -1]]) {
  const c = capability({}, v0);
  console.log(`  recorrido perdido vs instantáneo a 0,3 s (${label}): ${(MAX * 0.3 - c(0.3)).toFixed(1)} px = ${((MAX * 0.3 - c(0.3)) / HIT_RANGE * 100).toFixed(0)} % del alcance (78)`);
}

// =====================================================================================
// 3) ESTUDIO DE PERSPECTIVA (constantes de src/view/projection.ts). No cambia nada del juego.
// =====================================================================================
const VIEW = { NEAR_Y: 900, FAR_Y: 330, NEAR_W: 700, RATIO: 0.48 };
const CAM_X = (COURT.left - VIEW.RATIO * COURT.right) / (1 - VIEW.RATIO);
const D1 = COURT.left - CAM_X, D2 = COURT.right - CAM_X;
const F = (VIEW.NEAR_W * D1) / (COURT.bottom - COURT.top);
const K = (VIEW.NEAR_Y - VIEW.FAR_Y) / (1 / D1 - 1 / D2);
const latPx = (x) => F / (x - CAM_X); // px de pantalla por unidad lateral
const depPx = (x) => K / (x - CAM_X) ** 2; // px de pantalla por unidad de profundidad
const ratio = (x) => latPx(x) / depPx(x); // > 1: en pantalla lo lateral se ve más rápido

const alts = [
  ['A. Sin compensación (actual)', () => 1],
  ['B. Profundidad ×1,15 fija', () => 1.15],
  ['C. Profundidad ×1,25 fija', () => 1.25],
  ['D. Según posición: ratio^0,3', (x) => ratio(x) ** 0.3],
  ['E. Según posición: ratio^0,5', (x) => ratio(x) ** 0.5],
];
const XS = [[150, 'fondo'], [400, 'media pista'], [580, 'junto a la red']];
console.log('\nEstudio de perspectiva (velocidad en pantalla lateral / profundidad; ángulo en pantalla al empujar a 45°)');
console.log('  alternativa                       ' + XS.map(([, n]) => n.padEnd(22)).join('') + 'fondo→red   diagonal');
for (const [name, k] of alts) {
  const cells = XS.map(([x]) => {
    const r = ratio(x) / k(x);
    const ang = (Math.atan2(depPx(x) * k(x), latPx(x)) * 180) / Math.PI;
    return `${r.toFixed(2)}× ${ang.toFixed(0)}°`.padEnd(22);
  });
  // tiempo fondo (150) → volea (560) a velocidad máxima en profundidad
  let x = 150, t = 0;
  while (x < 560) { x += MAX * k(x) / 240; t += 1 / 240; }
  const diag = Math.hypot(Math.SQRT1_2, Math.SQRT1_2 * k(400));
  console.log(`  ${name.padEnd(33)} ${cells.join('')}${t.toFixed(2)} s    ${(diag * 100).toFixed(0)} %`);
}
console.log('  (ideal = 1,00× y 45°; "diagonal" = velocidad real en diagonal sobre la máxima: >100 % = más cobertura)');
