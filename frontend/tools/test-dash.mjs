// Pruebas del DASH sprint. Uso: node tools/test-dash.mjs
import assert from 'node:assert/strict';
import { DASH, arrivalTime, createRun, guaranteeStep, phaseAt, planSprint, positionAt, sampleTrajectory, shouldCancelRun, stepRun } from '../src/logic/DashSprint.ts';
import { DashFx } from '../src/fx/dashFx.ts';

let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};
const FPSS = [30, 60, 90, 144];
const MAX = 330;

// ---- física copiada de src/objects/Ball.ts + constantes de src/config.ts (como en test-player-motion)
const COURT = { left: 170, right: 1110, top: 230, bottom: 590 };
const ALLEY = 60, NET_X = 640, NET_HEIGHT = 34, GRAVITY = 950, BOUNCE_DAMP = 0.62, SHOT_SPEED = 640, HIT_MAX_Z = 135, HIT_RANGE = 78;
const P_X = [COURT.left - 70, NET_X - 45], Y_MIN = COURT.top - 50, Y_MAX = COURT.bottom + 50, LAT_C = 410, HALF_W = 180;
const BOUNDS = { xMin: P_X[0], xMax: P_X[1], yMin: Y_MIN, yMax: Y_MAX };
const BOX = { xMin: P_X[0] - 20, xMax: P_X[1] + 30, yMin: Y_MIN - 30, yMax: Y_MAX + 30 };
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
let seed = 4242;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const rr = (a, b) => a + (b - a) * rnd();
function botShot(d) {
  const s = { x: rr(NET_X + 180, COURT.right + 80), y: rr(COURT.top + 20, COURT.bottom - 20), z: rr(35, 80), vx: 0, vy: 0, vz: 0 };
  let speed = SHOT_SPEED * (0.82 + 0.3 * d) * rr(0.94, 1), margin = 18, tx, ty;
  const own = NET_X - COURT.left, k = rnd(), side = () => LAT_C + (rnd() < 0.5 ? -1 : 1) * rr(0.2, 0.95) * (HALF_W - 40);
  if (k < 0.35) { tx = NET_X - own * rr(0.8, 0.95); ty = side(); speed *= 1.12; }
  else if (k < 0.7) { tx = NET_X - own * rr(0.45, 0.75); ty = LAT_C + (rnd() < 0.5 ? -1 : 1) * rr(0.75, 1) * (HALF_W - 40); }
  else if (k < 0.8) { tx = NET_X - own * rr(0.1, 0.25); ty = side(); speed = SHOT_SPEED * 0.78; margin = 8; }
  else if (k < 0.9) { tx = NET_X - own * rr(0.82, 0.94); ty = side(); speed = SHOT_SPEED * 0.85; margin = 75; }
  else { tx = NET_X - own * rr(0.55, 0.88); ty = side(); }
  aimShot(s, tx, ty, speed, margin);
  return s;
}
/** DASH de teletransporte de siempre (MatchScene.dashPlan + activateDash), para comparar el alcance. */
function legacyPlan(ball) {
  const smp = sampleTrajectory(ball, 0, stepBall, NET_X, HIT_MAX_Z, BOX);
  if (!smp) return null;
  const pick = (minT) => smp.find((p) => p.t >= minT && p.good) ?? smp.find((p) => p.t >= minT) ?? null;
  return pick(0.11 + 0.04 + 0.18 + 0.02) ?? pick(0.05 + 0.07 + 0.02);
}

console.log('DASH sprint');

const cases = [];
for (let i = 0; i < 6000; i++) {
  const b = botShot([0.3, 0.6, 0.9][i % 3]);
  const press = rr(0.05, 0.6);
  let dead = false;
  for (let t = 0; t < press; t += 1 / 120) if (stepBall(b, 1 / 120) === 'net') dead = true;
  if (!dead) cases.push({ ball: b, from: { x: rr(P_X[0], 420), y: rr(Y_MIN + 30, Y_MAX - 30) } });
}

test('alcance: el sprint llega en todos los casos en que llegaba el teletransporte (6000 tiros)', () => {
  let legacy = 0, sprint = 0, boosted = 0, quick = 0;
  for (const c of cases) {
    if (!legacyPlan(c.ball)) continue;
    legacy++;
    const smp = sampleTrajectory(c.ball, 0, stepBall, NET_X, HIT_MAX_Z, BOX);
    const p = planSprint(smp, c.from, MAX, BOUNDS);
    if (!p) continue;
    sprint++;
    if (p.mult > DASH.baseMult + 1e-9) boosted++;
    if (p.startS === DASH.quick.startS) quick++;
    assert.ok(p.mult >= DASH.baseMult - 1e-9 && p.mult <= DASH.maxMult + 1e-9, `velocidad ${p.mult}`);
    assert.ok(arrivalTime(p.dist, p.mult, MAX, { startS: p.startS, landS: p.landS }) <= p.t + 1e-6, 'llega antes que la pelota');
    assert.ok(p.x >= BOUNDS.xMin && p.x <= BOUNDS.xMax && p.y >= BOUNDS.yMin && p.y <= BOUNDS.yMax);
  }
  assert.equal(sprint, legacy, `${sprint}/${legacy}`);
  console.log(`      ${sprint}/${legacy} igual que antes · por encima de 2,5×: ${((boosted / sprint) * 100).toFixed(2)} % · DASH de urgencia: ${((quick / sprint) * 100).toFixed(2)} %`);
});

test('pelotas lejanas: esquina contraria → llega antes que la pelota, con 2,5× o la velocidad justa ≤ 3,5×', () => {
  let n = 0;
  for (const c of cases) {
    const smp = sampleTrajectory(c.ball, 0, stepBall, NET_X, HIT_MAX_Z, BOX);
    if (!smp || !smp.length) continue;
    const last = smp.at(-1);
    const from = { x: last.x < 400 ? P_X[1] : P_X[0], y: last.y < LAT_C ? Y_MAX - 30 : Y_MIN + 30 }; // lo más lejos posible
    const p = planSprint(smp, from, MAX, BOUNDS);
    if (!p) continue;
    n++;
    assert.ok(p.mult <= DASH.maxMult + 1e-9);
    assert.ok(arrivalTime(p.dist, p.mult, MAX, { startS: p.startS, landS: p.landS }) <= p.t + 1e-6);
  }
  assert.ok(n > 100);
});

test('sprint a 30/60/90/144 fps (y con tirones): misma trayectoria, llega exacto, fases a tiempo', () => {
  const plan = { x: 300, y: 560, t: 1.2, mult: 2.5, dist: 0 };
  const from = { x: 140, y: 300 };
  const ref = createRun(from, plan, MAX);
  const total = DASH.startS + ref.sprintS + DASH.landS;
  for (const fps of FPSS) for (const jit of [0, 0.4]) {
    const r = createRun(from, plan, MAX);
    let t = 0, landAt = null, maxErr = 0, sr = 7;
    const rand = () => ((sr = (sr * 1103515245 + 12345) % 2147483648) / 2147483648);
    while (r.phase !== 'done') {
      const dt = Math.min(0.05, (1 / fps) * (1 + (rand() - 0.5) * jit));
      const st = stepRun(r, dt);
      t += dt;
      const exact = positionAt(ref, t);
      maxErr = Math.max(maxErr, Math.hypot(st.pos.x - exact.x, st.pos.y - exact.y));
      if (st.entered === 'land') landAt = t;
      // nunca se sale del segmento ni pasa del destino
      assert.ok(Math.hypot(st.pos.x - from.x, st.pos.y - from.y) <= r.dist + 1e-9);
    }
    assert.ok(maxErr < 1e-9, `fps=${fps} error ${maxErr}`);
    const end = positionAt(r, r.elapsed);
    assert.ok(Math.hypot(end.x - plan.x, end.y - plan.y) < 1e-9);
    assert.ok(Math.abs(landAt - (DASH.startS + ref.sprintS)) <= 0.05 + 1e-9);
    assert.ok(t >= total - 1e-9 && t <= total + 0.05 + 1e-9);
  }
});

test('sombras: exactamente 3 por DASH, en posiciones reales del recorrido y en orden; ninguna si el recorrido es corto', () => {
  for (const fps of FPSS) {
    const r = createRun({ x: 140, y: 300 }, { x: 420, y: 520, t: 2, mult: 2.5 }, MAX);
    const made = [];
    while (r.phase !== 'done') {
      const st = stepRun(r, 1 / fps);
      for (const i of st.ghosts) made.push({ i, d: Math.hypot(st.pos.x - 140, st.pos.y - 300) });
    }
    assert.deepEqual(made.map((g) => g.i), [0, 1, 2]);
    assert.ok(made[0].d < made[1].d && made[1].d < made[2].d && made[2].d < r.dist);
  }
  const short = createRun({ x: 140, y: 300 }, { x: 150, y: 320, t: 2, mult: 2.5 }, MAX);
  let n = 0;
  while (short.phase !== 'done') n += stepRun(short, 1 / 60).ghosts.length;
  assert.equal(n, 0);
});

// ---- simulador de escenarios con el MISMO orden que MatchScene.update:
// updateDashSprint (cancelar / avanzar) → movimiento libre → subpasos de pelota (contacto normal) → updateDashHit
function scenario({ fps, natural = null, walk = null, inferno = null, rallyEnds = null, planT = 0.9 }) {
  const plan = { x: 300, y: 520, t: planT, mult: 2.5, dist: 0 };
  let run = createRun({ x: 140, y: 300 }, plan, MAX);
  let g = { t: plan.t, elapsed: 0, x: plan.x, y: plan.y };
  const pl = { x: 140, y: 300 };
  let t = 0, lastHitter = 'bot', rally = true, cine = 0, hits = [], ghostsLive = 0, movedAfterCancel = false;
  for (let f = 0; f < 5000 && t < 3; f++) {
    const dt = 1 / fps;
    // cinemática especial (INFERNO): el partido no avanza (update retorna); al terminar golpea INFERNO
    if (inferno && t >= inferno && cine === 0) cine = 2.0;
    if (cine > 0) {
      cine -= dt;
      if (cine <= 0) { hits.push('inferno'); lastHitter = 'player'; cine = -1; }
      t += dt;
      continue;
    }
    if (rallyEnds !== null && t >= rallyEnds) rally = false;
    if (run) {
      if (shouldCancelRun({ rally, playerHit: lastHitter === 'player', specialActive: cine > 0 })) {
        run = null;
      } else {
        const before = { ...pl };
        const st = stepRun(run, dt);
        pl.x = st.pos.x; pl.y = st.pos.y;
        if (lastHitter === 'player' && (before.x !== pl.x || before.y !== pl.y)) movedAfterCancel = true;
        ghostsLive += st.ghosts.length;
        if (st.phase === 'done') run = null;
      }
    } else if (walk && lastHitter !== 'player') {
      // tras llegar, el jugador se aleja `walk` unidades a velocidad normal
      const d = Math.hypot(pl.x - plan.x, pl.y - plan.y);
      if (d < walk) pl.y += Math.min(MAX * dt, walk - d);
    }
    if (natural !== null && t >= natural && lastHitter !== 'player' && rally) { hits.push('normal'); lastHitter = 'player'; }
    if (g) {
      const r = guaranteeStep(g, dt, { rally, playerHit: lastHitter === 'player', running: run !== null, px: pl.x, py: pl.y, ballOk: true });
      if (r === 'drop') g = null;
      else if (r === 'force') { g = null; hits.push('forzado'); lastHitter = 'player'; }
    }
    t += dt;
  }
  return { hits, run, g, ghostsLive, movedAfterCancel, pl };
}

test('devolución garantizada: exactamente UN golpe forzado al esperar en el punto (30–144 fps)', () => {
  for (const fps of FPSS) assert.deepEqual(scenario({ fps }).hits, ['forzado']);
});

test('pérdida voluntaria: alejarse > 45 → sin golpe forzado; moverse ≤ 40 → se mantiene', () => {
  for (const fps of FPSS) {
    assert.deepEqual(scenario({ fps, walk: 60 }).hits, []);
    assert.deepEqual(scenario({ fps, walk: 40 }).hits, ['forzado']);
  }
});

test('contacto normal durante el sprint o la espera: se respeta y no hay segundo golpe', () => {
  for (const fps of FPSS) {
    const during = scenario({ fps, natural: 0.15 }); // en pleno sprint
    assert.deepEqual(during.hits, ['normal']);
    assert.equal(during.run, null);
    assert.equal(during.movedAfterCancel, false, 'el sprint no sigue moviendo tras el golpe');
    assert.deepEqual(scenario({ fps, natural: 0.6 }).hits, ['normal']); // esperando
  }
});

test('INFERNO DRIVE en pleno sprint: tiene prioridad, cancela el DASH, un solo golpe, sin estados colgados', () => {
  for (const fps of FPSS) {
    const r = scenario({ fps, inferno: 0.12 });
    assert.deepEqual(r.hits, ['inferno']);
    assert.equal(r.run, null);
    assert.equal(r.g, null);
    assert.equal(r.movedAfterCancel, false);
  }
});

test('fin del peloteo en pleno sprint: se cancela sin golpe', () => {
  for (const fps of FPSS) {
    const r = scenario({ fps, rallyEnds: 0.12 });
    assert.deepEqual(r.hits, []);
    assert.equal(r.run, null);
    assert.equal(r.g, null);
  }
});

// ---- efectos con una escena simulada (sin Phaser): se crean y se destruyen todos
function fakeScene() {
  const tweens = [];
  const objs = [];
  const mk = () => {
    const o = { destroyed: false, x: 0, y: 0, props: {} };
    const chain = new Proxy(o, {
      get(t, k) {
        if (k in t) return t[k];
        if (k === 'destroy') return () => (t.destroyed = true);
        return (...a) => { t.props[k] = a; return chain; };
      },
    });
    objs.push(o);
    return chain;
  };
  return {
    objs,
    tweens,
    add: { image: (x, y) => Object.assign(mk(), { x, y }), ellipse: (x, y) => Object.assign(mk(), { x, y }) },
    tweens: { add: (cfg) => tweens.push(cfg), killTweensOf: () => {} },
    runTweens() { while (tweens.length) tweens.shift().onComplete?.(); },
  };
}
const sprite = (a, b, c, d, flip = false) => ({
  visible: true, texture: { key: 'nxo-run' }, frame: { name: 3 }, originX: 0.4, originY: 0.9, flipX: flip,
  getWorldTransformMatrix: () => ({ a, b, c, d, tx: 100, ty: 200 }),
});

test('sombras: copian la pose (volteo por escala negativa = flipX, no giro de 180°) y no quedan objetos vivos', () => {
  const sc = fakeScene();
  sc.tweens = sc.tweens ?? [];
  const fx = new DashFx(sc, DASH);
  const ch = { visible: true, list: [sprite(-0.6, 0, 0, 0.6), { visible: true, list: [sprite(0.6, 0, 0, 0.6, true)] }, { visible: false, list: [sprite(1, 0, 0, 1)] }] };
  for (let k = 0; k < 50; k++) {
    for (const i of [0, 1, 2]) fx.ghost(ch, i, 500);
    fx.burst(100, 200, 0.9, 500);
  }
  assert.ok(fx.count > 0);
  const g = sc.objs[0].props;
  assert.equal(g.setFlipX[0], true); // escala negativa → volteado
  assert.ok(Math.abs(g.setRotation[0]) < 1e-9); // sin giro
  assert.deepEqual(g.setScale, [0.6, 0.6]);
  assert.equal(sc.objs[1].props.setFlipX[0], true); // ya volteado y escala positiva → sigue volteado
  sc.runTweens();
  assert.equal(fx.count, 0);
  assert.ok(sc.objs.every((o) => o.destroyed), 'todo destruido');
  // clear() al cancelar
  fx.ghost(ch, 0, 500);
  fx.clear();
  assert.equal(fx.count, 0);
});

test('DASH de urgencia: mismas fases y llegada exacta con transiciones cortas', () => {
  for (const fps of FPSS) {
    const r = createRun({ x: 140, y: 300 }, { x: 480, y: 560, t: 0.45, mult: 3.5, startS: DASH.quick.startS, landS: DASH.quick.landS }, MAX);
    let t = 0, phases = new Set();
    while (r.phase !== 'done') {
      const st = stepRun(r, 1 / fps);
      t += 1 / fps;
      phases.add(st.phase);
    }
    assert.ok(phases.has('sprint') && phases.has('done'));
    const end = positionAt(r, r.elapsed);
    assert.ok(Math.hypot(end.x - 480, end.y - 560) < 1e-9);
    assert.ok(t <= DASH.quick.startS + r.sprintS + DASH.quick.landS + 1 / fps + 1e-9);
  }
});

test('fases: phaseAt coherente con la duración total', () => {
  const r = createRun({ x: 140, y: 300 }, { x: 400, y: 300, t: 2, mult: 3 }, MAX);
  assert.equal(phaseAt(r, 0), 'start');
  assert.equal(phaseAt(r, DASH.startS + r.sprintS / 2), 'sprint');
  assert.equal(phaseAt(r, DASH.startS + r.sprintS + DASH.landS / 2), 'land');
  assert.equal(phaseAt(r, DASH.startS + r.sprintS + DASH.landS + 1e-6), 'done');
  assert.ok(Math.abs(r.speed - MAX * 3) < 1e-9);
});

console.log(`\n${ok} pruebas OK`);
