// SIMULADOR DE ECONOMÍA: 3 perfiles de jugador durante N días con los módulos REALES de src/domain (sin copiar números).
//   node tools/sim-economy.mjs                  (60 días, semilla 1, los 3 perfiles)
//   node tools/sim-economy.mjs --days=60 --seed=7 --profile=casual
//   node tools/sim-economy.mjs --runs=20        (promedia 20 semillas: días de nivel / compras = mediana)
// Igual que tools/test-ranked.mjs: Node carga los .ts del dominio directamente (un hook añade ".ts" al resolver).
//
// Supuestos (los mismos para todos los perfiles; cambian por perfil solo las partidas, sesiones, anuncios y apuesta):
//   - JUGAR = Ranked con la apuesta del perfil si le alcanza la entrada (como el botón del menú); si no, amistoso.
//   - Cada partida: XP y monedas de MatchEndScene (XP_WIN/XP_LOSS, COINS_WIN/COINS_LOSS), liquidación Ranked y ruleta
//     (recordWin: 1 por partida completada, hasta WHEEL.perDay). No hay rendiciones.
//   - Se reclama todo lo que se puede del Pase (camino GRATIS), los premios semanales de Ranked y, si el perfil lo hace,
//     el premio diario. Los Rayos se gastan en la ZONA en cuanto está desbloqueada (nivel 10).
//   - Tienda: compra el ítem más barato que pueda (nivel mínimo incluido), en cuanto le alcanza el dinero.
//   - Anuncios x2: premio diario y/o ruletas (los únicos x2 que existen hoy).
//   - Temporada del pase = los días simulados (BP_SEASON no tiene fecha de cierre).
import { register } from 'node:module';

// con --propuesta la curva de XP propuesta (src/config.ts no es del dominio y su export no se puede cambiar en memoria)
// se simula reescribiendo esa línea al cargar el archivo
const XP_PROPOSED = process.argv.includes('--propuesta') ? 'return 200 + (lvl - 1) * 100' : '';
const hook = `
export async function resolve(spec, ctx, next) {
  if ((spec.startsWith('./') || spec.startsWith('../')) && !/\\.[cm]?[jt]s$/.test(spec)) {
    try { return await next(spec + '.ts', ctx); } catch {}
  }
  return next(spec, ctx);
}
export async function load(url, ctx, next) {
  const r = await next(url, ctx);
  const x = ${JSON.stringify(XP_PROPOSED)};
  if (x && url.endsWith('/src/config.ts')) {
    const src = String(r.source).replace('100 + (lvl - 1) * 50', x.replace('return ', ''));
    return { ...r, source: src };
  }
  return r;
}`;
register('data:text/javascript,' + encodeURIComponent(hook), import.meta.url);

const P = await import('../src/domain/player.ts');
const OPS = await import('../src/domain/operations.ts');
const R = await import('../src/domain/ranked.ts');
const RC = await import('../src/domain/rankedConfig.ts');
const W = await import('../src/domain/dailyWheel.ts');
const WC = await import('../src/domain/wheelConfig.ts');
const L = await import('../src/domain/dailyLogin.ts');
const BP = await import('../src/domain/battlePass.ts');
const SHOP = await import('../src/domain/shopCatalog.ts');
const Z = await import('../src/domain/zoneProgress.ts');
const U = await import('../src/domain/unlocks.ts');
const CFG = await import('../src/config.ts');

// ---------------------------------------------------------------- argumentos
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const DAYS = Number(args.days ?? 60);
const SEED = Number(args.seed ?? 1);
const RUNS = Math.max(1, Number(args.runs ?? 1));
const ONLY = args.profile ?? null;
/** probabilidad de ganar: la del perfil en Bronce y LEAGUE_PENALTY menos por cada liga de más (el rival sube con la liga) */
const LEAGUE_PENALTY = 0.05;

// ---------------------------------------------------------------- propuesta (se prueba EN MEMORIA, sin tocar archivos)
// Con --propuesta se cambian los objetos de configuración exportados antes de simular. Así se comparan antes/después.
// Cuando el usuario apruebe, estos números se escriben en src/domain y este bloque se vacía.
const PROPOSAL = {};
if (args.propuesta) applyProposal();
function applyProposal() {
  PROPOSAL.startingCoins = 3000;
  BP.BP_SEASON.xpPerTier = 300;
  const lg = RC.RANKED.leagues;
  const wk = { bronze: [6000, 10], silver: [8000, 15], gold: [9000, 20], platinum: [12000, 40], diamond: [15000, 60], challenger: [20000, 80] };
  for (const [k, [c, g]] of Object.entries(wk)) lg[k].weekly = { coins: c, cash: g };
  const prices = { 'style:red': 8, 'style:green': 8, 'style:gold': 20, 'style:pink': 12, 'inferno:ice': 35, 'inferno:wind': 50, 'inferno:lightning': 65, 'inferno:tulip': 65, 'smash:ice': 40, 'smash:wind': 45, 'smash:lightning': 50, 'charge:fire': 30, 'charge:energy': 30, 'charge:tulip': 40, 'defensive:blink': 45, 'defensive:shadow': 45, 'defensive:jump': 45 };
  for (const it of SHOP.SHOP_ITEMS) it.price = prices[it.id];
  L.LOGIN.rewards[6] = { coins: 2500, cash: 10 };}

// ---------------------------------------------------------------- perfiles
const PROFILES = {
  casual: { label: 'CASUAL', sessions: [12], matches: [3], winRate: 0.45, bet: 1, login: false, adLogin: false, adWheels: 0 },
  regular: { label: 'REGULAR', sessions: [12, 20], matches: [4, 4], winRate: 0.5, bet: 1, login: true, adLogin: true, adWheels: 1 },
  intenso: { label: 'INTENSO', sessions: [10, 15, 20], matches: [7, 7, 6], winRate: 0.55, bet: 2, login: true, adLogin: true, adWheels: 99 },
};

// ---------------------------------------------------------------- utilidades
const H = 3_600_000;
const D = 24 * H;
/** lunes 09-11-2026 00:00 de Chile (UTC-3) */
const START = Date.UTC(2026, 10, 9, 3);
function rngFrom(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const fmt = (n) => Math.round(n).toLocaleString('es-CL');
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);
const median = (a) => {
  const v = a.filter((x) => x != null).sort((x, y) => x - y);
  if (!v.length) return null;
  if (v.length < a.length / 2) return null; // menos de la mitad de las semillas lo logra: "no llega"
  return v[Math.floor(v.length / 2)];
};

/** Nivel con el que se desbloquea algo en el partido / PERSONALIZACIÓN (domain/unlocks.ts) */
const UNLOCK_AT = Object.entries(U.UNLOCK_LEVEL);
const SHOP_BY_PRICE = [...SHOP.SHOP_ITEMS].sort((a, b) => a.price - b.price || a.id.localeCompare(b.id));

// ---------------------------------------------------------------- una partida simulada
function simulate(profileKey, seed) {
  const pr = PROFILES[profileKey];
  const rnd = rngFrom(seed * 7919 + profileKey.length);
  let s = P.newPlayer();
  if (PROPOSAL.startingCoins != null) s.coins = PROPOSAL.startingCoins;
  let matchN = 0;
  let passDay = null;
  // libro de cuentas: monedas / dinero / XP por origen
  const led = { coins: {}, gems: {}, xp: {}, rays: {} };
  const add = (cur, key, v) => {
    if (!v) return;
    led[cur][key] = (led[cur][key] ?? 0) + v;
  };
  /** aplica `fn(s)` y anota las diferencias de saldo con la etiqueta `key` */
  const book = (key, next) => {
    if (!next) return;
    add('coins', key, next.coins - s.coins);
    add('gems', key, next.gems - s.gems);
    add('rays', key, next.zone.rays - s.zone.rays);
    s = next;
  };
  const levelDay = { 1: 0 };
  const events = []; // días con algo nuevo (compra, cosmético, desbloqueo)
  const bought = []; // { id, day }
  const balances = {};
  let gemsEarned = 0; // dinero ganado (sin restar gastos)
  const firstAffordDay = {};
  let rankedMatches = 0;
  let friendly = 0;
  let maxLossStreak = 0;
  let lossStreak = 0;
  let brokeDays = 0; // días que empezó sin poder pagar la entrada de su liga
  const leagueDay = {};

  for (let day = 0; day < DAYS; day++) {
    let brokeToday = false;
    for (let si = 0; si < pr.sessions.length; si++) {
      const now = START + day * D + pr.sessions[si] * H;
      s = R.syncRanked(s, now);
      s = W.syncCycle(s, now);
      if (!leagueDay[s.ranked.league]) leagueDay[s.ranked.league] = day + 1;
      // premios semanales de Ranked
      for (const w of s.ranked.rewards) if (!w.claimed) {
        const r = R.claimWeekly(s, w.week);
        if (r.ok) book('semanal Ranked', r.state);
      }
      // premio diario (+ x2 con anuncio)
      if (pr.login && si === 0) {
        book('premio diario', L.claimLogin(s, now).state);
        if (pr.adLogin) book('anuncio x2 (diario)', L.claimLoginAdBonus(s, now).state);
      }
      let adWheelsLeft = pr.adWheels;
      for (let m = 0; m < pr.matches[si]; m++) {
        const id = `m${++matchN}`;
        const entry1 = RC.matchStakes(s.ranked.league, 1).entry;
        if (s.coins < entry1) brokeToday = true;
        // JUGAR: Ranked con la apuesta del perfil si alcanza (si no, x1; si no, amistoso)
        let ranked = false;
        for (const bet of pr.bet === 2 ? [2, 1] : [1]) {
          const e = R.enterRanked(s, id, bet, now);
          if (e.ok) {
            book('Ranked: entradas', e.state);
            ranked = true;
            break;
          }
        }
        const win = rnd() < Math.max(0.3, pr.winRate - LEAGUE_PENALTY * RC.LEAGUE_ORDER.indexOf(s.ranked.league));
        lossStreak = win ? 0 : lossStreak + 1;
        maxLossStreak = Math.max(maxLossStreak, lossStreak);
        // recompensas del final de partida (MatchEndScene)
        const xp = win ? CFG.XP_WIN : CFG.XP_LOSS;
        const before = s.level;
        s = OPS.addXp(s, xp).state;
        add('xp', 'partidas', xp);
        book('partidas', OPS.addCoins(s, win ? CFG.COINS_WIN : CFG.COINS_LOSS).state);
        if (ranked) {
          rankedMatches++;
          const r = R.settleRanked(s, id, win ? 'win' : 'loss', now);
          if (r.ok) book('Ranked: premios', r.state);
        } else friendly++;
        // ruleta de esa partida
        const rw = W.recordWin(s, id, now);
        if (rw.ok) {
          s = rw.state;
          if (rw.unlocked != null) {
            const sp = W.spin(s, rw.unlocked, now, rnd);
            if (sp.ok) {
              s = sp.state;
              const lvl0 = s.level;
              const c = W.claim(s, rw.unlocked, now);
              if (c.ok && c.given) {
                if (c.given.kind === 'xp') add('xp', 'ruleta', c.given.amount);
                if (c.given.kind === 'item') events.push(day + 1);
                book(c.given.kind === 'coins' && 'duplicateOf' in c.given ? 'ruleta (cosmético repetido)' : 'ruleta', c.state);
                if (s.level > lvl0) for (let l = lvl0 + 1; l <= s.level; l++) levelDay[l] ??= day + 1;
              }
              if (adWheelsLeft > 0) {
                adWheelsLeft--;
                const a = W.claimAdBonus(s, rw.unlocked, now);
                if (a.ok && a.given) {
                  if (a.given.kind === 'xp') add('xp', 'anuncio x2 (ruleta)', a.given.amount);
                  book('anuncio x2 (ruleta)', a.state);
                }
              }
            }
          }
        }
        for (let l = before + 1; l <= s.level; l++) levelDay[l] ??= day + 1;
      }
      // pase de batalla (camino GRATIS): bienvenida + todos los niveles alcanzados
      const wl = BP.bpClaimWelcome(s, 'free');
      if (wl.ok) {
        book('pase', wl.state);
        if (wl.given.kind !== 'cash') events.push(day + 1);
      }
      for (let t = 1; t <= BP.BP_TIERS; t++) {
        const r = BP.bpClaim(s, 'free', t);
        if (!r.ok) continue;
        const gemsBefore = s.gems;
        book(r.given.kind === 'cash' && BP.BP_SEASON.tiers[t - 1].free.kind !== 'cash' ? 'pase (repetido)' : 'pase', r.state);
        if (r.given.kind !== 'cash') events.push(day + 1);
        gemsEarned += Math.max(0, s.gems - gemsBefore);
      }
      // ZONA: los Rayos se gastan en cuanto se desbloquea
      if (U.isUnlocked('zone', s.level))
        for (const k of Z.ZONE_STAT_KEYS) while (s.zone.rays > 0 && s.zone.stats[k] < Z.ZONE_STAT_MAX && s.zone.stats[k] <= Math.min(...Z.ZONE_STAT_KEYS.map((q) => s.zone.stats[q]))) book('ZONA', OPS.upgradeZoneStat(s, k).state);
      // tienda: el más barato que alcance
      let again = true;
      while (again) {
        again = false;
        for (const it of SHOP_BY_PRICE) {
          if (P.owns(s, it.id) || s.level < it.minLevel || s.gems < it.price) continue;
          const r = OPS.purchase(s, it.id);
          if (r.ok) {
            book('tienda', r.state);
            bought.push({ id: it.id, day: day + 1 });
            events.push(day + 1);
            again = true;
            break;
          }
        }
      }
    }
    if (brokeToday) brokeDays++;
    if (passDay == null && BP.bpLevel(s.bp.xp).level >= BP.BP_TIERS) passDay = day + 1;
    // dinero ganado total (para "cuándo podría comprar cada ítem ahorrando solo para él")
    const earned = Object.entries(led.gems).filter(([k, v]) => v > 0 && k !== 'tienda').reduce((a, [, v]) => a + v, 0);
    for (const it of SHOP.SHOP_ITEMS) if (earned >= it.price) firstAffordDay[it.id] ??= day + 1;
    for (const [, lvl] of UNLOCK_AT) if (s.level >= lvl && levelDay[lvl] === day + 1) events.push(day + 1);
    if ([7, 14, 30, 60, DAYS].includes(day + 1))
      balances[day + 1] = { coins: s.coins, gems: s.gems, level: s.level, pass: BP.bpLevel(s.bp.xp).level, league: s.ranked.league, rays: s.zone.rays, zone: Z.ZONE_STAT_KEYS.reduce((a, k) => a + s.zone.stats[k], 0) };
  }
  const evDays = [...new Set(events)].sort((a, b) => a - b);
  const gaps = evDays.map((d, i) => d - (i ? evDays[i - 1] : 0));
  return { s, passDay, led, levelDay, bought, balances, firstAffordDay, rankedMatches, friendly, maxLossStreak, brokeDays, leagueDay, evDays, maxGap: Math.max(0, ...gaps, DAYS - (evDays.at(-1) ?? 0)), avgGap: evDays.length ? DAYS / evDays.length : null };
}

// ---------------------------------------------------------------- informe
function report(key) {
  const pr = PROFILES[key];
  const runs = Array.from({ length: RUNS }, (_, i) => simulate(key, SEED + i));
  const r0 = runs[0];
  const med = (f) => median(runs.map(f));
  const mean = (f) => runs.reduce((a, r) => a + f(r), 0) / runs.length;
  const totalMatches = pr.matches.reduce((a, b) => a + b, 0);
  console.log(`\n================ ${pr.label}: ${pr.sessions.length} sesión(es)/día · ${totalMatches} partidas/día · gana ${Math.round(pr.winRate * 100)} % · apuesta x${pr.bet} · diario ${pr.login ? 'sí' : 'no'} · anuncios x2: ${pr.adLogin ? 'diario' : ''}${pr.adWheels ? (pr.adWheels > 9 ? ' + todas las ruletas' : ` + ${pr.adWheels} ruleta`) : ''}${!pr.adLogin && !pr.adWheels ? 'ninguno' : ''} ================`);
  // niveles
  const lv = [];
  for (let l = 2; l <= CFG.MAX_LEVEL; l++) lv.push(`${l}:${med((r) => r.levelDay[l]) ?? '—'}`);
  console.log(`Día en que llega a cada nivel (mediana de ${RUNS} semilla(s)):\n  ${lv.join('  ')}`);
  // saldos
  console.log('Saldo   día | monedas  | dinero | nivel | pase (niveles) | liga      | rayos sin gastar / puntos ZONA');
  for (const d of Object.keys(r0.balances)) {
    const b = (f) => mean((r) => f(r.balances[d]));
    console.log(`        ${padL(d, 3)} | ${padL(fmt(b((x) => x.coins)), 8)} | ${padL(fmt(b((x) => x.gems)), 6)} | ${padL(b((x) => x.level).toFixed(1), 5)} | ${padL(Math.round((b((x) => x.pass) / BP.BP_TIERS) * 100) + ' %', 14)} | ${pad(r0.balances[d].league, 9)} | ${fmt(b((x) => x.rays))} / ${fmt(b((x) => x.zone))}`);
  }
  // libro de cuentas (promedio por día)
  for (const [cur, name] of [['coins', 'MONEDAS'], ['gems', 'DINERO'], ['xp', 'XP']]) {
    const keys = [...new Set(runs.flatMap((r) => Object.keys(r.led[cur])))];
    const rows = keys.map((k) => [k, mean((r) => r.led[cur][k] ?? 0) / DAYS]).sort((a, b) => b[1] - a[1]);
    // ingreso "de regalo" (sin las apuestas de Ranked, que se ganan o pierden): la base para medir cuánto suman los anuncios
    const inc = rows.filter(([k, v]) => v > 0 && !k.startsWith('Ranked:')).reduce((a, [, v]) => a + v, 0);
    const ads = rows.filter(([k, v]) => v > 0 && k.startsWith('anuncio')).reduce((a, [, v]) => a + v, 0);
    console.log(`${name} por día: ${rows.map(([k, v]) => `${k} ${v > 0 ? '+' : ''}${fmt(v)}`).join(' · ')}` + (inc ? `   (ingreso sin apuestas ${fmt(inc)}/día; anuncios = +${Math.round((ads / Math.max(1e-9, inc - ads)) * 100)} %)` : ''));
  }
  // ranked
  console.log(`Ranked: ${fmt(mean((r) => r.rankedMatches))} partidas Ranked y ${fmt(mean((r) => r.friendly))} amistosas · peor racha de derrotas ${fmt(mean((r) => r.maxLossStreak))} · días sin poder pagar la entrada: ${fmt(mean((r) => r.brokeDays))} · ligas: ${Object.entries(r0.leagueDay).map(([k, v]) => `${k} día ${v}`).join(', ')}`);
  // tienda
  const items = SHOP.SHOP_ITEMS.map((it) => {
    const b = med((r) => r.bought.find((x) => x.id === it.id)?.day ?? null);
    const a = med((r) => r.firstAffordDay[it.id] ?? null);
    // sin comprarlo pero lo tiene: le llegó por el pase o la ruleta
    const gift = runs.filter((r) => P.owns(r.s, it.id) && !r.bought.some((x) => x.id === it.id)).length >= runs.length / 2;
    return `${pad(it.id, 18)} ${padL(it.price, 3)} (${SHOP.clpLabel(it.clp)}) · ${gift ? 'REGALO (pase / ruleta)' : `compra día ${b ?? '—'}`} · ahorrando solo para él: día ${a ?? '—'}`;
  });
  console.log(`Tienda (compra el más barato que alcance; "—" = no en ${DAYS} días):\n  ${items.join('\n  ')}`);
  const allDay = med((r) => (r.bought.length === SHOP.SHOP_ITEMS.length ? Math.max(...r.bought.map((x) => x.day)) : null));
  console.log(`Toda la tienda: ${allDay ? `día ${allDay}` : `no (compra ${fmt(mean((r) => r.bought.length))} de ${SHOP.SHOP_ITEMS.length})`} · algo nuevo (compra, premio del pase, cosmético o desbloqueo) cada ${mean((r) => r.avgGap ?? DAYS).toFixed(1)} días de media; la mayor espera ${fmt(mean((r) => r.maxGap))} días`);
  console.log(`Pase (gratis) al final: ${Math.round((mean((r) => BP.bpLevel(r.s.bp.xp).level) / BP.BP_TIERS) * 100)} % · completo el día ${med((r) => r.passDay) ?? '—'}`);
}

// ---------------------------------------------------------------- referencia fija del inventario
console.log(`ECONOMÍA · ${DAYS} días · semilla ${SEED}${RUNS > 1 ? ` (+${RUNS - 1})` : ''} · inicio lunes 09-11-2026`);
console.log(`XP total al nivel ${CFG.MAX_LEVEL}: ${fmt(Array.from({ length: CFG.MAX_LEVEL - 1 }, (_, i) => CFG.xpToNext(i + 1)).reduce((a, b) => a + b, 0))} · pase: ${BP.BP_TIERS} niveles × ${BP.BP_SEASON.xpPerTier} XP · tienda completa: ${SHOP.SHOP_ITEMS.reduce((a, i) => a + i.price, 0)} de dinero`);
const ev = WC.WHEEL.slots.reduce((acc, sl) => {
  const p = sl.weight / 10000;
  if (sl.prize.kind === 'coins') acc.coins += p * sl.prize.amount;
  if (sl.prize.kind === 'xp') acc.xp += p * sl.prize.amount;
  if (sl.prize.kind === 'epic') {
    const tw = sl.prize.options.reduce((a, o) => a + o.weight, 0);
    for (const o of sl.prize.options) acc[o.kind] += (p * o.weight * o.amount) / tw;
  }
  if (sl.prize.kind === 'cosmetic') acc.cos += p;
  return acc;
}, { coins: 0, xp: 0, cos: 0 });
console.log(`Ruleta (valor esperado por giro): ${fmt(ev.coins)} monedas · ${fmt(ev.xp)} XP · cosmético ${(ev.cos * 100).toFixed(0)} %`);
{
  const lr = L.LOGIN.rewards;
  const six = lr.slice(0, -1);
  const avgC = six.reduce((a, r) => a + r.coins, 0) / six.length;
  const avgG = six.reduce((a, r) => a + r.cash, 0) / six.length;
  console.log(`Premio diario: días 1-6 = ${fmt(avgC)} monedas + ${avgG.toFixed(1)} dinero de media; día 7 = ${fmt(lr.at(-1).coins)} + ${lr.at(-1).cash} (equivale a ${(lr.at(-1).coins / avgC).toFixed(1)} diarios en monedas, ${avgG ? (lr.at(-1).cash / avgG).toFixed(1) : '∞'} en dinero) · semana completa: ${fmt(lr.reduce((a, r) => a + r.coins, 0))} + ${lr.reduce((a, r) => a + r.cash, 0)}`);
  console.log(`Ranked: entrada Bronce ${RC.matchStakes('bronze', 1).entry} · saldo inicial ${fmt(PROPOSAL.startingCoins ?? P.STARTING_COINS)} (= ${Math.floor((PROPOSAL.startingCoins ?? P.STARTING_COINS) / RC.matchStakes('bronze', 1).entry)} entradas) · semanal por liga (monedas/dinero): ${RC.LEAGUE_ORDER.map((k) => `${k} ${fmt(RC.RANKED.leagues[k].weekly.coins)}/${RC.RANKED.leagues[k].weekly.cash}`).join(', ')}`);
}
for (const k of Object.keys(PROFILES)) if (!ONLY || ONLY === k) report(k);




