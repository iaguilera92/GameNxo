// Pruebas de Perfect Timing (lógica pura). Uso: node tools/test-perfect-timing.mjs
// Node 22.6+ (24 sin flags) ejecuta el .ts directamente quitando los tipos.
import assert from 'node:assert/strict';
import { TIMING, TimingTracker, applyError, classify, evaluateCharge, timedSpeed, timingMods } from '../src/logic/PerfectTiming.ts';

const SHOT = 640;
let ok = 0;
const test = (name, fn) => {
  fn();
  ok++;
  console.log(`  ✓ ${name}`);
};

console.log('Perfect Timing');

test('clasificación por ventanas (60 / 150 / 250 ms)', () => {
  assert.equal(classify(0), 'perfect');
  assert.equal(classify(-60), 'perfect');
  assert.equal(classify(60), 'perfect');
  assert.equal(classify(61), 'good');
  assert.equal(classify(-150), 'good');
  assert.equal(classify(-151), 'early');
  assert.equal(classify(-250), 'early');
  assert.equal(classify(200), 'late');
  assert.equal(classify(251), 'off');
  assert.equal(classify(-400), 'off');
});

test('1. PERFECTO es claramente mejor que BUENO', () => {
  const p = timingMods('perfect', 'normal', 'normal');
  const g = timingMods('good', 'normal', 'normal');
  assert.ok(p.speedMult >= 1.19 && g.speedMult === 1);
  assert.ok(p.marginMult < 1 && g.marginMult === 1);
  assert.equal(g.errLat + g.errDep, 0);
});

test('2. TEMPRANO / TARDE siguen siendo jugables (≥ 80 % de velocidad, error moderado)', () => {
  for (const gr of ['early', 'late']) {
    const m = timingMods(gr, 'normal', 'normal');
    assert.ok(m.speedMult >= 0.8 && m.speedMult < 1);
    assert.ok(m.errLat > 0 && m.errLat <= 0.15 && m.errDep <= 0.1);
  }
});

test('3. carga al 100 %: el bonus se reduce (antiacumulación) y no supera el tope', () => {
  const m = timingMods('perfect', 'max', 'normal');
  assert.ok(m.speedMult > 1 && m.speedMult <= 1.1);
  const full = SHOT * (1.45 + 0.4); // drive cargado al máximo (el más rápido del juego sin habilidad)
  const v = timedSpeed(full, m, SHOT, 'max');
  assert.ok(v <= SHOT * TIMING.maxSpeedMult.normal + 1e-9);
  assert.ok(v >= full);
});

test('4. sin impactos dobles: cada toque se consume en el primer contacto', () => {
  const t = new TimingTracker();
  t.registerTap(1.0);
  assert.equal(t.evaluate(1.18).grade, 'perfect');
  assert.equal(t.evaluate(1.2).grade, 'none');
});

test('5. el timing no cambia el alcance (solo modifica velocidad, red y error del bote)', () => {
  assert.deepEqual(Object.keys(timingMods('perfect', 'normal', 'normal')).sort(), ['chargeOnly', 'errDep', 'errLat', 'marginMult', 'speedMult']);
});

test('6. habilidades / remate: efecto reducido y tope propio; nunca baja la velocidad original', () => {
  const smashSuper = SHOT * 1.75 * 1.15;
  const m = timingMods('perfect', 'ability', 'normal');
  assert.ok(m.speedMult <= 1.08 + 1e-9);
  const v = timedSpeed(smashSuper, m, SHOT, 'ability');
  assert.ok(v >= smashSuper && v <= Math.max(smashSuper, SHOT * TIMING.maxSpeedMult.ability) + 1e-9);
  const r = timingMods('perfect', 'remate', 'normal');
  assert.ok(r.speedMult > 1 && r.speedMult < timingMods('perfect', 'normal', 'normal').speedMult);
});

test('golpes de toque (dejada / globo): la potencia no cambia', () => {
  assert.equal(timingMods('perfect', 'normal', 'drop').speedMult, 1);
  assert.equal(timingMods('late', 'normal', 'lob').speedMult, 1);
  assert.ok(timingMods('late', 'normal', 'lob').errLat > 0);
});

test('carga larga o sin toque → "none" (comportamiento original)', () => {
  const t = new TimingTracker();
  assert.equal(t.evaluate(5).grade, 'none');
  t.registerTap(1.0);
  assert.equal(t.evaluate(2.4).grade, 'none'); // toque 1,4 s antes: carga larga
  t.registerTap(3.0);
  assert.equal(t.evaluate(2.9).grade, 'none'); // toque después del contacto
  const n = timingMods('none', 'normal', 'normal');
  assert.deepEqual(n, { speedMult: 1, chargeOnly: false, marginMult: 1, errLat: 0, errDep: 0 });
});

// ---- 7. independencia de los FPS: misma escena simulada a distintas tasas
// La pelota llega al contacto en Tc (s). El jugador toca `lead` s antes (tiempo real).
// Se reproduce el bucle de MatchScene: dt con tope de 0,05 s, 3 subpasos, toques entre fotogramas
// pasados al reloj de simulación con el tiempo real transcurrido (tapClock).
function simulate(fps, lead, Tc = 1.0, jitter = 0) {
  const tr = new TimingTracker();
  let sim = 0, real = 0, simRealAt = 0, tapDone = false, rnd = 12345;
  const rand = () => ((rnd = (rnd * 1103515245 + 12345) % 2147483648) / 2147483648);
  const tapReal = Tc - lead;
  for (let f = 0; f < 10000; f++) {
    const frame = (1 / fps) * (1 + (rand() - 0.5) * jitter);
    // eventos entre fotogramas
    if (!tapDone && tapReal <= real + frame) {
      tapDone = true;
      tr.registerTap(sim + Math.min(Math.max(tapReal - simRealAt, 0), 0.05));
    }
    real += frame;
    const dt = Math.min(frame, 0.05);
    for (let i = 0; i < 3; i++) {
      const c = sim + ((i + 1) * dt) / 3;
      if (c >= Tc) return tr.evaluate(c);
    }
    sim += dt;
    simRealAt = real;
  }
  throw new Error('sin contacto');
}

test('7. mismo toque ideal → PERFECTO a 30 / 60 / 90 / 120 / 144 fps (con y sin variación)', () => {
  for (const fps of [30, 60, 90, 120, 144]) {
    for (const jitter of [0, 0.3]) {
      const r = simulate(fps, TIMING.idealLeadMs / 1000, 1.0, jitter);
      assert.equal(r.grade, 'perfect', `fps=${fps} jitter=${jitter} Δ=${r.deltaMs.toFixed(1)}`);
      assert.ok(Math.abs(r.deltaMs) < 1000 / fps / 3 + 1000 / fps, `fps=${fps} Δ=${r.deltaMs}`);
    }
  }
  // un toque 200 ms antes de lo ideal es TEMPRANO a cualquier tasa
  for (const fps of [30, 60, 144]) assert.equal(simulate(fps, TIMING.idealLeadMs / 1000 + 0.2).grade, 'early');
  // tocar casi encima del contacto es TARDE
  for (const fps of [30, 60, 144]) assert.equal(simulate(fps, 0.0).grade, 'late');
});

test('carga larga compatible: medidor al 100 % justo en el contacto → PERFECTO; antes/después → sin penalizar', () => {
  assert.equal(evaluateCharge(2.0, 2.0).grade, 'perfect');
  assert.equal(evaluateCharge(1.95, 2.0).grade, 'perfect'); // lleno 50 ms antes
  assert.equal(evaluateCharge(2.05, 2.0).grade, 'perfect'); // se llenaría 50 ms después
  assert.equal(evaluateCharge(1.9, 2.0).grade, 'good');
  assert.equal(evaluateCharge(1.5, 2.0).grade, 'none'); // lleno mucho antes: golpe máximo de siempre
  assert.equal(evaluateCharge(null, 2.0).grade, 'none'); // sin llenar: cargado de siempre
  for (const r of [evaluateCharge(1.0, 2.0), evaluateCharge(null, 2.0)]) assert.ok(r.grade !== 'early' && r.grade !== 'late');
});

// pista real (config.ts): COURT 170..1110 × 230..590, red en 640; HALF_W de MatchScene = 180
const COURTB = { netX: 640, right: 1110, top: 230, bottom: 590, halfW: 180 };
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) * 2;

test('error de TEMPRANO/TARDE: 100 000 tiros, nunca fuera, nunca más largo, nunca a su campo', () => {
  const targets = [
    [640 + 470 * 0.95, 230 + 30], // drive profundo a la esquina
    [640 + 470 * 0.95, 590 - 30],
    [640 + 470 * 0.08, 410], // dejada
    [640 + 470 * 0.6, 410],
  ];
  let maxShort = 0, maxSide = 0;
  for (const gr of ['early', 'late']) {
    for (const cls of ['normal', 'max', 'remate', 'ability']) {
      const m = timingMods(gr, cls, 'normal');
      for (const [tx, ty] of targets) {
        for (let i = 0; i < 3000; i++) {
          const r = applyError(tx, ty, m, COURTB, gauss);
          assert.ok(r.tx <= tx + 1e-9, 'más largo');
          assert.ok(r.tx >= Math.min(tx, COURTB.netX + 40) - 1e-9, 'a la red / su campo');
          assert.ok(r.tx <= COURTB.right && r.ty >= COURTB.top && r.ty <= COURTB.bottom, 'fuera');
          maxShort = Math.max(maxShort, tx - r.tx);
          maxSide = Math.max(maxSide, Math.abs(r.ty - ty));
        }
      }
    }
  }
  // tope duro: maxSigma · σ (TARDE: 2 · 0,09 · 470 ≈ 85 de fondo; 2 · 0,14 · 180 ≈ 50 lateral)
  assert.ok(maxShort <= TIMING.maxSigma * 0.09 * 470 + 1e-6 && maxSide <= TIMING.maxSigma * 0.14 * 180 + 1e-6);
});

test('PERFECTO y BUENO no tienen error (resultado determinista)', () => {
  for (const gr of ['perfect', 'good']) {
    const r = applyError(900, 300, timingMods(gr, 'normal', 'normal'), COURTB, gauss);
    assert.deepEqual(r, { tx: 900, ty: 300 });
  }
});

// ---- curva de potencia: golpe cargado según la antelación del toque (= tiempo de carga), como en playerHit
// Perfiles de MatchScene.playerHit (rama cargada): base + extra·c, extra = parte que aporta la carga.
const PROFILES = {
  'neutro 1,25+0,3c': [1.25, 0.3],
  'lateral 1,3+0,3c': [1.3, 0.3],
  'drive 1,45+0,4c': [1.45, 0.4],
  'volea 1,4+0,35c': [1.4, 0.35],
};
const CHARGE_S = 1.1;
/** Velocidad (× SHOT_SPEED) tocando `L` ms antes del contacto. `old` = fórmula anterior (TEMPRANO −15 % de todo). */
function curvePoint([a, b], L, old = false) {
  const contact = 10;
  const tap = contact - L / 1000;
  const c = Math.min(1, L / 1000 / CHARGE_S);
  const tr = new TimingTracker();
  tr.registerTap(tap);
  let r = tr.evaluate(contact);
  let chargeTimed = false;
  if (r.grade === 'none' || r.grade === 'off') {
    const ch = evaluateCharge(tap + CHARGE_S, contact); // llenado real o previsto (chargeFillTime)
    if (ch.grade !== 'none') {
      r = ch;
      chargeTimed = true;
    }
  }
  const cls = chargeTimed || c >= 0.995 ? 'max' : 'normal';
  const base = (a + b * c) * SHOT;
  let v;
  if (old) {
    const p = TIMING.power[r.grade];
    const mult = r.grade === 'none' || r.grade === 'off' || r.grade === 'good' ? 1 : 1 + (p - 1) * TIMING.scale[cls];
    v = mult <= 1 ? base * mult : Math.max(base, Math.min(base * mult, SHOT * TIMING.maxSpeedMult.normal));
  } else {
    v = timedSpeed(base, timingMods(r.grade, cls, 'normal', r.deltaMs), SHOT, cls, b * c * SHOT);
  }
  return { v: v / SHOT, grade: r.grade, c, base: base / SHOT };
}

/** Bajadas entre ms consecutivos de 0 a 1100 que NO son la salida de una ventana PERFECTO. */
function drops(profile, old) {
  const out = [];
  let prev = curvePoint(profile, 0, old);
  for (let L = 1; L <= 1100; L++) {
    const cur = curvePoint(profile, L, old);
    if (cur.v < prev.v - 1e-9 && prev.grade !== 'perfect') out.push({ L, from: prev.v, to: cur.v, g: `${prev.grade}→${cur.grade}` });
    prev = cur;
  }
  return out;
}

test('curva 0–1100 ms (4 golpes): nunca baja al cargar más, salvo al salir de PERFECTO', () => {
  for (const [name, pr] of Object.entries(PROFILES)) {
    const d = drops(pr, false);
    assert.equal(d.length, 0, `${name}: ${JSON.stringify(d.slice(0, 3))}`);
  }
});

test('TEMPRANO nunca resta de la base del golpe; los topes se respetan', () => {
  for (const pr of Object.values(PROFILES)) {
    for (let L = 0; L <= 1100; L++) {
      const p = curvePoint(pr, L);
      // en el borde con BUENO la penalización empieza en 0 (rampa): v ≤ base
      if (p.grade === 'early') assert.ok(p.v >= pr[0] - 1e-9 && p.v <= p.base + 1e-9, `L=${L}`);
      assert.ok(p.v <= Math.max(p.base, TIMING.maxSpeedMult.normal) + 1e-9, `tope L=${L}`);
      assert.ok(p.v >= 1 - 1e-9, `peor que no tocar L=${L}`);
    }
  }
});

test('PERFECTO y carga perfecta conservan su ventaja (≥ +15 % y ≥ +8 % sobre el vecino sin timing)', () => {
  const pr = PROFILES['neutro 1,25+0,3c'];
  assert.ok(curvePoint(pr, 180).v >= curvePoint(pr, 250).v * 1.15);
  assert.ok(curvePoint(pr, 1100).v >= curvePoint(pr, 1300).v * 1.08);
});

console.log(`\n${ok} pruebas OK`);

console.log('\nBajadas al cargar más (excluida la salida de PERFECTO), ANTES → DESPUÉS:');
for (const [name, pr] of Object.entries(PROFILES)) {
  const b = drops(pr, true), a = drops(pr, false);
  const worst = (d) => (d.length ? Math.max(...d.map((x) => (x.from - x.to) / x.from)) * 100 : 0);
  console.log(`  ${name.padEnd(18)} ${String(b.length).padStart(2)} bajadas (peor −${worst(b).toFixed(1)} %) → ${a.length} bajadas`);
}

console.log('\nGolpe cargado neutro (× SHOT_SPEED), ANTES / DESPUÉS de la opción B:');
console.log('  carga(ms)  c     calidad   antes   después  cambio');
for (const L of [0, 29, 30, 60, 119, 120, 180, 240, 241, 300, 330, 331, 380, 429, 430, 431, 500, 700, 830, 831, 1000, 1039, 1040, 1100]) {
  const pr = PROFILES['neutro 1,25+0,3c'];
  const b = curvePoint(pr, L, true), a = curvePoint(pr, L);
  const d = ((a.v - b.v) / b.v) * 100;
  console.log(`  ${String(L).padStart(6)}   ${a.c.toFixed(2)}  ${a.grade.padEnd(8)}  ${b.v.toFixed(3)}   ${a.v.toFixed(3)}   ${d === 0 ? '   =' : (d > 0 ? '+' : '') + d.toFixed(1) + ' %'}`);
}
for (const fps of [30, 60, 144]) {
  const r = simulate(fps, TIMING.idealLeadMs / 1000);
  console.log(`  ${fps} fps: Δ=${r.deltaMs.toFixed(1)} ms → ${r.grade}`);
}
