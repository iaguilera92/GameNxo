/**
 * Experimentos de balance (ver tools/sim/balance.ts y tools/sim-balance.mjs).
 *   usage   cuántas veces usa cada habilidad por partido y cuánto aprovecha la recarga
 *   impact  cuánto pesa cada habilidad: rival igual SIN habilidades contra otro CON ellas (y con cada una sola)
 *   matrix  cómo cambian las habilidades la distancia entre niveles de rival
 */
import { ALL, CFG, NONE, TIERS, playMatch, type Abilities, type MatchResult } from './balance';
import type { BotTier } from '../../src/ai/BotProfile';
import { DASH_COOLDOWN, SMASH_COOLDOWN } from '../../src/config';
import { INFERNO } from '../../src/logic/InfernoDrive';

export interface RunOpts {
  matches: number;
  exp: string;
  tiers: BotTier[];
  /** pruebas: recarga del Especial / Defensivo (s), puntos de la Ulti y tabla de uso por nivel ('plana' = uso parecido en todos los niveles) */
  smashCd?: number;
  dashCd?: number;
  ultiPts?: number;
  table?: string;
  powerSpeed?: number;
  /** velocidad de los tiros de poder por nivel, de principiante a experto: '0.7,0.75,0.85,0.9,1' */
  powerByTier?: string;
  stunS?: number;
  weakK?: number;
}

interface Side {
  tier: BotTier;
  abil: Abilities;
}
interface Agg {
  n: number;
  xWins: number;
  durationS: number;
  points: number;
  games: number;
  /** sumas por partido de cada lado (x = primer config, y = segundo) */
  x: Record<string, number>;
  y: Record<string, number>;
  rallyS: number;
  hits: number;
  timeouts: number;
  quality: [number, number, number];
}

const FIELDS = ['pointsWon', 'dash', 'smash', 'ulti', 'dashPts', 'dashWon', 'smashPts', 'smashWon', 'ultiPts', 'ultiWon', 'shotReached', 'shotAce', 'shotError', 'gotStunned'] as const;

/** `n` partidos entre X e Y; X juega de lado A en la mitad y de B en la otra (quita la ventaja de sacar primero) */
function batch(X: Side, Y: Side, n: number): Agg {
  const a: Agg = { n, xWins: 0, durationS: 0, points: 0, games: 0, x: {}, y: {}, rallyS: 0, hits: 0, timeouts: 0, quality: [0, 0, 0] };
  for (const f of FIELDS) {
    a.x[f] = 0;
    a.y[f] = 0;
  }
  let rallies = 0;
  for (let i = 0; i < n; i++) {
    const xIsA = i % 2 === 0;
    const m: MatchResult = xIsA ? playMatch(X.tier, X.abil, Y.tier, Y.abil) : playMatch(Y.tier, Y.abil, X.tier, X.abil);
    const xs = xIsA ? m.stats[0] : m.stats[1];
    const ys = xIsA ? m.stats[1] : m.stats[0];
    if ((m.winner === 0) === xIsA) a.xWins++;
    a.durationS += m.durationS;
    a.hits += m.hits;
    a.timeouts += m.timeouts;
    for (let q = 0; q < 3; q++) a.quality[q] += m.quality[q];
    a.points += m.points;
    a.games += m.games[0] + m.games[1];
    for (const f of FIELDS) {
      a.x[f] += xs[f];
      a.y[f] += ys[f];
    }
    for (const r of m.rallyS) {
      a.rallyS += r;
      rallies++;
    }
  }
  a.rallyS = rallies ? a.rallyS / rallies : 0;
  return a;
}

const pct = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(6);
const f1 = (v: number) => v.toFixed(1).padStart(5);
const ci = (p: number, n: number) => `±${(196 * Math.sqrt((p * (1 - p)) / n)).toFixed(1)}`;
const label = (s: Side) => `${s.tier}${s.abil.dash || s.abil.smash || s.abil.ulti ? '' : ' (sin hab.)'}`;

function usage(opts: RunOpts) {
  console.log('\n=== USO DE HABILIDADES POR PARTIDO (mismo nivel contra sí mismo, con las 3 habilidades) ===');
  console.log(`Recargas: Defensivo ${CFG.dashCd || DASH_COOLDOWN} s · Especial ${CFG.smashCd || SMASH_COOLDOWN} s · Ulti = ${INFERNO.pointsToCharge} puntos ganados. ${opts.matches} partidos por nivel.\n`);
  console.log('nivel         dur(min) puntos  rally(s) | Defensivo  Especial  Ulti  por lado/partido | aprovecha recarga (Def/Esp) | tiros de poder: alcanzado / punto directo / error');
  for (const t of opts.tiers) {
    const s: Side = { tier: t, abil: ALL };
    const a = batch(s, s, opts.matches);
    const per = (k: string) => (a.x[k] + a.y[k]) / 2 / a.n; // por lado y partido
    const mins = a.durationS / a.n / 60;
    const dashMax = a.durationS / a.n / (CFG.dashCd || DASH_COOLDOWN);
    const smashMax = a.durationS / a.n / (CFG.smashCd || SMASH_COOLDOWN);
    const shots = per('shotReached') + per('shotAce') + per('shotError');
    const rch = shots ? per('shotReached') / shots : 0;
    const ace = shots ? per('shotAce') / shots : 0;
    const err = shots ? per('shotError') / shots : 0;
    console.log(
      `${t.padEnd(13)} ${f1(mins)}   ${f1(a.points / a.n)}   ${f1(a.rallyS)}   |  ${f1(per('dash'))}     ${f1(per('smash'))}    ${f1(per('ulti'))}                    |   ${pct(per('dash') / dashMax)} / ${pct(per('smash') / smashMax)}          | ${pct(rch)} / ${pct(ace)} / ${pct(err)}  (${f1(shots)} tiros) · golpes/punto ${f1(a.hits / a.points)} · sin resolver ${a.timeouts} · contacto <0,3/<0,6/>=0,6: ${pct(a.quality[0] / a.hits)} ${pct(a.quality[1] / a.hits)} ${pct(a.quality[2] / a.hits)}`,
    );
  }
}

function impact(opts: RunOpts) {
  console.log('\n=== PESO DE CADA HABILIDAD: mismo nivel, un lado CON habilidades y el otro SIN ===');
  console.log(`% de partidos que gana el lado con habilidades (50% = no pesan). ${opts.matches} partidos por celda.\n`);
  console.log('nivel          todas        solo Defensivo  solo Especial    solo Ulti       | punto ganado al usar: Def / Esp / Ulti (con todas)');
  const only = (k: keyof Abilities): Abilities => ({ ...NONE, [k]: true });
  for (const t of opts.tiers) {
    const base: Side = { tier: t, abil: NONE };
    const cells = (['all', 'dash', 'smash', 'ulti'] as const).map((k) => {
      const abil = k === 'all' ? ALL : only(k);
      const a = batch({ tier: t, abil }, base, opts.matches);
      return { a, p: a.xWins / a.n };
    });
    const all = cells[0].a;
    const w = (won: number, pts: number) => (pts ? pct(won / pts) : '   n/a');
    console.log(
      `${t.padEnd(13)} ${pct(cells[0].p)} ${ci(cells[0].p, opts.matches).padEnd(6)} ${pct(cells[1].p)} ${ci(cells[1].p, opts.matches).padEnd(6)}  ${pct(cells[2].p)} ${ci(cells[2].p, opts.matches).padEnd(6)}  ${pct(cells[3].p)} ${ci(cells[3].p, opts.matches).padEnd(6)}  | ${w(all.x.dashWon, all.x.dashPts)} / ${w(all.x.smashWon, all.x.smashPts)} / ${w(all.x.ultiWon, all.x.ultiPts)}   (usos/partido: ${f1(all.x.dash / all.n)} / ${f1(all.x.smash / all.n)} / ${f1(all.x.ulti / all.n)})`,
    );
  }
}

function matrix(opts: RunOpts) {
  console.log('\n=== DISTANCIA ENTRE NIVELES: % de partidos que gana el nivel MÁS ALTO ===');
  console.log(`Sin habilidades en ninguno / con las 3 habilidades en los dos. ${opts.matches} partidos por celda.\n`);
  console.log('más alto vs más bajo        sin hab.        con hab.');
  const t = opts.tiers;
  for (let i = 1; i < t.length; i++) {
    for (let j = 0; j < i; j++) {
      const n0 = batch({ tier: t[i], abil: NONE }, { tier: t[j], abil: NONE }, opts.matches);
      const n1 = batch({ tier: t[i], abil: ALL }, { tier: t[j], abil: ALL }, opts.matches);
      const p0 = n0.xWins / n0.n;
      const p1 = n1.xWins / n1.n;
      console.log(`${`${t[i]} vs ${t[j]}`.padEnd(26)} ${pct(p0)} ${ci(p0, opts.matches).padEnd(6)}  ${pct(p1)} ${ci(p1, opts.matches).padEnd(6)}`);
    }
  }
}

/** Tabla alternativa: uso parecido en todos los niveles (la habilidad no depende tanto del nivel del rival). */
const PLANA = {
  principiante: { dash: 0.3, smash: 0.3, ulti: 0.5, cd: 1.3, power: 1 },
  facil: { dash: 0.45, smash: 0.33, ulti: 0.55, cd: 1.2, power: 1 },
  normal: { dash: 0.6, smash: 0.36, ulti: 0.6, cd: 1.1, power: 1 },
  dificil: { dash: 0.75, smash: 0.4, ulti: 0.65, cd: 1.05, power: 1 },
  experto: { dash: 0.9, smash: 0.45, ulti: 0.7, cd: 1, power: 1 },
};

/** Propuesta P2: el Especial y la Ulti se usan igual en todos los niveles (la recarga efectiva es la misma); el Defensivo sigue subiendo con el nivel. */
const P2 = {
  principiante: { dash: 0, smash: 0.3, ulti: 0.7, cd: 1.5, power: 1 },
  facil: { dash: 0.4, smash: 0.3, ulti: 0.7, cd: 1.5, power: 1 },
  normal: { dash: 0.65, smash: 0.3, ulti: 0.7, cd: 1.5, power: 1 },
  dificil: { dash: 0.85, smash: 0.3, ulti: 0.7, cd: 1.5, power: 1 },
  experto: { dash: 1, smash: 0.3, ulti: 0.7, cd: 1.5, power: 1 },
};

export async function run(opts: RunOpts) {
  const t0 = Date.now();
  if (opts.smashCd) CFG.smashCd = opts.smashCd;
  if (opts.dashCd) CFG.dashCd = opts.dashCd;
  if (opts.ultiPts) INFERNO.pointsToCharge = opts.ultiPts;
  if (opts.table === 'plana') CFG.table = PLANA;
  if (opts.table === 'p2') CFG.table = P2;
  if (opts.powerSpeed) CFG.powerSpeed = opts.powerSpeed;
  if (opts.powerByTier) CFG.powerSpeedByTier = Object.fromEntries(opts.powerByTier.split(',').map((v, i) => [TIERS[i], Number(v)]));
  if (opts.stunS) CFG.stunS = opts.stunS;
  if (opts.weakK) CFG.weakK = opts.weakK;
  console.log(`Ajustes: Especial ${CFG.smashCd || SMASH_COOLDOWN} s · Defensivo ${CFG.dashCd || DASH_COOLDOWN} s · Ulti ${INFERNO.pointsToCharge} puntos · tabla ${opts.table ?? 'actual'} · tiros de poder ×${CFG.powerSpeed} velocidad, aturdido ${CFG.stunS || 0.65} s, devolución floja ${CFG.weakK}`);
  const all = opts.exp === 'all';
  if (all || opts.exp === 'usage') usage(opts);
  if (all || opts.exp === 'impact') impact(opts);
  if (all || opts.exp === 'matrix') matrix(opts);
  void label;
  console.log(`\n(${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

export { TIERS };
