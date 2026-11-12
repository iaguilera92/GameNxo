// SIMULADOR DE ECONOMÍA: 4 perfiles de jugador durante N días con los módulos REALES de src/domain (sin copiar números).
// Qué mide y por qué: ECONOMIA.txt (raíz del repo).
//   node tools/sim-economy.mjs                  (60 días, semilla 1, los 4 perfiles)
//   node tools/sim-economy.mjs --days=60 --seed=7 --profile=casual
//   node tools/sim-economy.mjs --runs=20        (20 semillas: días de nivel / compras = mediana)
//   node tools/sim-economy.mjs --runs=20 --propuesta   (+ lo aprobado que aún no está en src/domain)
// Variantes para probar números sin tocar archivos (se pueden combinar):
//   --inicio=5000 (monedas iniciales) --pase=350 (XP por nivel del pase) --semBronce=6000 --semBronceDinero=0
//   --semPlata=8000 --domingo=3500 (monedas del domingo) --premio=1.9 (premio Ranked = entrada × N)
//   --posDinero=50,20,5 (dinero Top 1 / 10 / 50) --xp=100,120 (curva: XP del nivel 1 y cuánto sube por nivel)
// Igual que tools/test-ranked.mjs: Node carga los .ts del dominio directamente (un hook añade ".ts" al resolver).
//
// Supuestos (los mismos para todos los perfiles; cambian por perfil solo las partidas, sesiones, anuncios y apuesta):
//   - JUGAR = Ranked con la apuesta del perfil si le alcanza la entrada (como el botón del menú); si no, amistoso.
//   - Cada partida: XP y monedas de MatchEndScene (XP_WIN/XP_LOSS, COINS_WIN/COINS_LOSS), liquidación Ranked y ruleta
//     (recordWin: 1 por partida completada, hasta WHEEL.perDay). No hay rendiciones.
//   - Se reclama todo lo que se puede del Pase (camino GRATIS), los premios semanales de Ranked y, si el perfil lo hace,
//     el premio diario. Los Rayos se gastan en la ZONA en cuanto está desbloqueada (UNLOCK_LEVEL.zone).
//   - Tienda: compra el ítem más barato que pueda (nivel mínimo incluido), en cuanto le alcanza el dinero.
//   - Anuncios x2: premio diario y/o ruletas (los únicos x2 que existen hoy).
//   - Pase MENSUAL (BP_SEASON.month): cada mes del calendario es una temporada nueva con los mismos premios (los
//     cosméticos ya obtenidos salen como "repetido"). El reloj del juego (gameClock) sigue al de la simulación.
//   - Empieza el lunes 01-03-2027: el primer mes de pase es completo (marzo) y el segundo también (abril).
//   - COLCHÓN RANKED: antes de cada partida se mira cuántas entradas x1 de su liga puede pagar con su saldo.
import { register } from 'node:module';

// --xp=a,b: otra curva de XP. xpToNext vive en src/config.ts (no es del dominio) y un export no se cambia en memoria:
// se reescribe esa línea al cargar el archivo
const XP_ARG = process.argv.find((a) => a.startsWith('--xp='))?.slice(5).split(',').map(Number);
const XP_PROPOSED = XP_ARG ? `${XP_ARG[0]} + (lvl - 1) * ${XP_ARG[1]};` : '';
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
    const src = String(r.source).replace(/(xpToNext = \\(lvl: number\\) => )[^;]+;/, '$1' + x);
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
const TS = await import('../src/domain/timeSource.ts');
const CFG = await import('../src/config.ts');

// ---------------------------------------------------------------- argumentos
const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const DAYS = Number(args.days ?? 60);
const SEED = Number(args.seed ?? 1);
const RUNS = Math.max(1, Number(args.runs ?? 1));
const ONLY = args.profile ?? null;
/**
 * Rival de Ranked como en el juego: MatchmakingScene usa nivel = tuyo ±2 + 2 por liga (tope MAX_LEVEL) y BotProfile.TIERS da
 * su dificultad (copiado aquí: BotProfile importa Phaser y no carga en Node; mantener igual a src/ai/BotProfile.ts).
 * El % de victorias del perfil es contra un rival de SU nivel; cada punto de dificultad de más resta DIFF_TO_WIN puntos
 * (un tramo, 0,45 → 0,60, ≈ −10 %). Con nivel 17+ el rival ya es Experto en todas las ligas: la liga no cambia nada.
 */
const BOT_TIERS = [[1, 0.24], [3, 0.34], [6, 0.45], [11, 0.6], [17, 0.75]];
const botDifficulty = (lvl) => BOT_TIERS.reduce((d, [from, v]) => (lvl >= from ? v : d), BOT_TIERS[0][1]);
const DIFF_TO_WIN = 0.67;
function winChance(base, playerLevel, league, rnd) {
  const delta = Math.floor(rnd() * 5) - 2;
  const own = Math.max(1, Math.min(CFG.MAX_LEVEL, playerLevel + delta));
  const rival = Math.min(CFG.MAX_LEVEL, own + 2 * RC.LEAGUE_ORDER.indexOf(league));
  return Math.max(0.25, base - DIFF_TO_WIN * (botDifficulty(rival) - botDifficulty(own)));
}

// ---------------------------------------------------------------- propuesta y variantes (EN MEMORIA, sin tocar archivos)
// --propuesta: lo APROBADO que aún no está en src/domain. Al pasarlo a src/domain, se quita de aquí.
//   Hoy: el pase de la Temporada 2 en adelante pide 350 XP por nivel (battlePassConfig.ts dice 100 hasta entonces).
const PROPOSAL = {};
if (args.propuesta) BP.BP_SEASON.xpPerTier = 350;
applyVariants();
/** Variantes sueltas (--inicio, --pase, …; ver la cabecera): cambian solo lo que se pasa. */
function applyVariants() {
  const has = (k) => args[k] != null;
  const n = (k) => Number(args[k]);
  if (has('inicio')) PROPOSAL.startingCoins = n('inicio');
  if (has('pase')) BP.BP_SEASON.xpPerTier = n('pase');
  const lg = RC.RANKED.leagues;
  if (has('semBronce')) lg.bronze.weekly = { ...lg.bronze.weekly, coins: n('semBronce') };
  if (has('semBronceDinero')) lg.bronze.weekly = { ...lg.bronze.weekly, cash: n('semBronceDinero') };
  if (has('semPlata')) lg.silver.weekly = { ...lg.silver.weekly, coins: n('semPlata') };
  if (has('domingo')) L.LOGIN.rewards[6] = { ...L.LOGIN.rewards[6], coins: n('domingo') };
  if (has('premio')) RC.RANKED.prizeMult = n('premio');
  if (has('posDinero')) args.posDinero.split(',').map(Number).forEach((c, i) => RC.RANKED.positionPrizes[i] && (RC.RANKED.positionPrizes[i].cash = c));
}

// ---------------------------------------------------------------- perfiles
const PROFILES = {
  casual: { label: 'CASUAL', sessions: [12], matches: [3], winRate: 0.45, bet: 1, login: false, adLogin: false, adWheels: 0 },
  regular: { label: 'REGULAR', sessions: [12, 20], matches: [4, 4], winRate: 0.5, bet: 1, login: true, adLogin: true, adWheels: 1 },
  intenso: { label: 'INTENSO', sessions: [10, 15, 20], matches: [7, 7, 6], winRate: 0.55, bet: 2, login: true, adLogin: true, adWheels: 99 },
  // prueba de estrés: juega como el casual pero pierde 6 de cada 10 (el peor caso para el colchón de Ranked)
  novato: { label: 'NOVATO (estrés)', sessions: [12], matches: [3], winRate: 0.4, bet: 1, login: false, adLogin: false, adWheels: 0 },
};

// ---------------------------------------------------------------- utilidades
const H = 3_600_000;
const D = 24 * H;
/** lunes 01-03-2027 00:00 de Chile (UTC-3): mes de pase completo desde el primer día */
const START = Date.UTC(2027, 2, 1, 3);
/** pase mensual: la temporada es el mes del calendario (hora de Chile) */
const monthOf = (ms) => W.cycleIdAt(ms).slice(0, 7);
function syncPassSeason(now) {
  TS.setServerTime(now); // bpSeasonInfo() / bpAddXpInPlace usan el reloj del juego
  const m = monthOf(now);
  if (BP.BP_SEASON.month !== m) {
    BP.BP_SEASON.month = m;
    BP.BP_SEASON.id = `S-${m}`;
  }
}
/** Costo mínimo en CLP de juntar al menos `n` de dinero con los paquetes (combinando paquetes). */
function cheapestPacks(n) {
  const packs = SHOP.CASH_PACKS;
  const max = n + Math.max(...packs.map((p) => p.cash));
  const best = new Array(max + 1).fill(Infinity);
  best[0] = 0;
  for (let i = 1; i <= max; i++) for (const p of packs) best[i] = Math.min(best[i], (best[Math.max(0, i - p.cash)] ?? Infinity) + p.clp);
  let m = Infinity;
  for (let i = n; i <= max; i++) m = Math.min(m, best[i]);
  return m;
}
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
  let allOwnedDay = null; // día en que tiene toda la tienda (comprada o regalada)
  const leagueDay = {};
  // colchón Ranked: entradas x1 de su liga que puede pagar antes de cada partida (fase de subir de nivel / nivel máximo)
  const cush = { lev: { min: Infinity, low: 0, n: 0 }, end: { min: Infinity, low: 0, n: 0 } };
  // pase mensual: nivel alcanzado y día en que lo completa, por temporada
  const passBy = {};
  syncPassSeason(START);

  for (let day = 0; day < DAYS; day++) {
    let brokeToday = false;
    for (let si = 0; si < pr.sessions.length; si++) {
      const now = START + day * D + pr.sessions[si] * H;
      syncPassSeason(now);
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
        {
          const c = cush[s.level < CFG.MAX_LEVEL ? 'lev' : 'end'];
          const n = Math.floor(s.coins / entry1);
          if (n < c.min) c.minDay = day + 1;
          c.min = Math.min(c.min, n);
          c.n++;
          if (n < 10) c.low++;
        }
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
        // amistoso: rival de tu nivel (sin el +2 por liga); Ranked: sube con la liga
        const win = rnd() < winChance(pr.winRate, s.level, ranked ? s.ranked.league : 'bronze', rnd);
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
        // un nivel con cosmético cuenta como novedad aunque salga repetido: una temporada nueva trae premios nuevos
        if (BP.BP_SEASON.tiers[t - 1].free.kind !== 'cash') events.push(day + 1);
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
    if (allOwnedDay == null && SHOP.SHOP_ITEMS.every((it) => P.owns(s, it.id))) allOwnedDay = day + 1;
    if (passDay == null && BP.bpLevel(s.bp.xp).level >= BP.BP_TIERS) passDay = day + 1;
    {
      const id = BP.BP_SEASON.month;
      const lvl = s.bp.season === BP.BP_SEASON.id ? BP.bpLevel(s.bp.xp).level : 0;
      const p = (passBy[id] ??= { level: 0, doneDay: null, days: 0, firstDay: day + 1 });
      p.level = lvl;
      p.days++;
      if (p.doneDay == null && lvl >= BP.BP_TIERS) p.doneDay = day + 1 - p.firstDay + 1; // día del mes en que lo completa
    }
    // dinero ganado total (para "cuándo podría comprar cada ítem ahorrando solo para él")
    const earned = Object.entries(led.gems).filter(([k, v]) => v > 0 && k !== 'tienda').reduce((a, [, v]) => a + v, 0);
    for (const it of SHOP.SHOP_ITEMS) if (earned >= it.price) firstAffordDay[it.id] ??= day + 1;
    for (const [, lvl] of UNLOCK_AT) if (s.level >= lvl && levelDay[lvl] === day + 1) events.push(day + 1);
    if ([7, 14, 30, 60, DAYS].includes(day + 1))
      balances[day + 1] = { coins: s.coins, gems: s.gems, level: s.level, pass: BP.bpLevel(s.bp.xp).level, league: s.ranked.league, rays: s.zone.rays, zone: Z.ZONE_STAT_KEYS.reduce((a, k) => a + s.zone.stats[k], 0) };
  }
  const evDays = [...new Set(events)].sort((a, b) => a - b);
  const gaps = evDays.map((d, i) => d - (i ? evDays[i - 1] : 0));
  return { s, passDay, passBy, cush, allOwnedDay, led, levelDay, bought, balances, firstAffordDay, rankedMatches, friendly, maxLossStreak, brokeDays, leagueDay, evDays, maxGap: Math.max(0, ...gaps, DAYS - (evDays.at(-1) ?? 0)), avgGap: evDays.length ? DAYS / evDays.length : null };
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
  const allDay = med((r) => r.allOwnedDay);
  console.log(`Toda la tienda (comprada o regalada): ${allDay ? `día ${allDay}` : `no (tiene ${fmt(mean((r) => SHOP.SHOP_ITEMS.filter((it) => P.owns(r.s, it.id)).length))} de ${SHOP.SHOP_ITEMS.length})`} · algo nuevo (compra, premio del pase, cosmético o desbloqueo) cada ${mean((r) => r.avgGap ?? DAYS).toFixed(1)} días de media; la mayor espera ${fmt(mean((r) => r.maxGap))} días`);
  // pase mensual: % al cerrar cada mes y día del mes en que se completa
  const months = Object.keys(r0.passBy);
  console.log(`Pase gratis (mensual): ${months.map((m) => `${m} (${r0.passBy[m].days} días): ${Math.round((mean((r) => r.passBy[m]?.level ?? 0) / BP.BP_TIERS) * 100)} %, completo el día ${med((r) => r.passBy[m]?.doneDay ?? null) ?? '—'} del mes`).join(' · ')}`);
  // colchón Ranked (meta: al menos 10 entradas de su liga en todo momento mientras sube del nivel 1 al 20)
  for (const [ph, name] of [['lev', 'subiendo del nivel 1 al 20'], ['end', 'ya en nivel 20']]) {
    const withData = runs.filter((r) => r.cush[ph].n > 0);
    if (!withData.length) continue;
    const worst = Math.min(...withData.map((r) => r.cush[ph].min));
    const medMin = median(withData.map((r) => r.cush[ph].min));
    const low = withData.reduce((a, r) => a + r.cush[ph].low, 0) / withData.reduce((a, r) => a + r.cush[ph].n, 0);
    console.log(`COLCHÓN Ranked ${name}: mínimo ${medMin} entradas (mediana, el día ${median(withData.map((r) => r.cush[ph].minDay))}) · peor semilla ${worst} · partidas con menos de 10 entradas: ${(low * 100).toFixed(1)} %`);
  }
  // dinero ganado (sin restar gastos) y su valor al precio del paquete más chico
  const small = SHOP.CASH_PACKS.reduce((a, p) => (p.cash < a.cash ? p : a));
  const earned = mean((r) => Object.entries(r.led.gems).filter(([k, v]) => v > 0 && k !== 'tienda').reduce((a, [, v]) => a + v, 0));
  console.log(`DINERO ganado en ${DAYS} días: ${fmt(earned)} (${fmt((earned / DAYS) * 7)} por semana) · vale ${SHOP.clpLabel(Math.round((earned * small.clp) / small.cash))} al precio del paquete "${small.name}"`);
}

// ---------------------------------------------------------------- referencia fija del inventario
console.log(`ECONOMÍA${args.propuesta ? ' (PROPUESTA)' : ''} · ${DAYS} días · semilla ${SEED}${RUNS > 1 ? ` (+${RUNS - 1})` : ''} · inicio lunes 01-03-2027`);
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
{
  // precio directo en CLP vs juntar ese dinero con paquetes: el directo nunca debería ser más caro
  const bad = SHOP.SHOP_ITEMS.map((it) => ({ it, packs: cheapestPacks(it.price) })).filter((x) => x.it.clp > x.packs);
  console.log(`Precio directo en CLP más caro que comprar el dinero en paquetes: ${bad.length ? bad.map((x) => `${x.it.id} ${SHOP.clpLabel(x.it.clp)} > ${SHOP.clpLabel(x.packs)}`).join(' · ') : 'ninguno'}`);
}
for (const k of Object.keys(PROFILES)) if (!ONLY || ONLY === k) report(k);




