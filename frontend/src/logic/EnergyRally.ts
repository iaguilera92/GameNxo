import type { CineProfile } from '../fx/SmashCinematic';
import { ALLEY, COURT, NET_X } from '../config';

/**
 * (17-11-2026) ULTI LEGENDARIA BOLA DE ENERGÍA (`energy`): guion de su CINEMÁTICA EXTRA (lógica pura, sin Phaser).
 *
 *   1) CARGA de 6 s (ENERGY_CINE, el motor de siempre fx/SmashCinematic.ts con la pantalla más oscura y un aura más fuerte)
 *      + la carga propia (fx/energyBallCine.ts), la ZONA del que la lanza encendida y la franja de su mirada. Al final, el
 *      desplazamiento fantasma de la ULTI hasta su sitio de peloteo (al fondo).
 *   2) PELOTEO AUTOMÁTICO desde DONDE ESTÁN los dos (17-11-2026: ya no se van al fondo; el rival se mueve solo en su fila) con la pelota
 *      del golpe cargado al máximo; las devoluciones del rival botan antes de llegar (como en PERSONALIZAR). El rival solo llega
 *      ESTIRÁNDOSE (3 estiradas, lados alternos) y tras la 3.ª se queda TENDIDO en el suelo (con la raqueta).
 *   3) GOLPE FINAL: la BOLA DE ENERGÍA gigante le pega al rival tendido → lo de siempre de la ULTI (aturdido + raqueta fuera).
 *
 * SOLO VISUAL: nada de esto cambia el marcador, las estadísticas ni la física (el partido está congelado mientras dura). Todo
 * sale de la posición del que golpea, la del rival y una SEMILLA: en red los dos teléfonos calculan EXACTAMENTE el mismo
 * guion con los datos de 'inferno-cine' (cada uno lo espeja a su vista).
 * Coordenadas "canónicas": las del teléfono que LANZA la ULTI (él abajo, x pequeñas; el rival arriba, x grandes).
 */

/** Carga de la ULTI LEGENDARIA: 6 s. Mismo motor que la del INFERNO (oscuridad, aura, destello) con su propio ritmo. */
export const ENERGY_CINE: CineProfile = {
  durationMs: 6000,
  hitAtMs: 6000,
  activateMs: 500,
  focusMs: 2600,
  peakMs: 4800,
  // sin las líneas ni los puntos de la carga normal: la carga LEGENDARIA la dibuja fx/energyBallCine.ts
  raysUntilMs: 0,
  releaseFromMs: 6000,
  flashAtMs: 5650,
  flashMs: 350,
  darken: 0.72, // más negro que la ULTI normal (0,45)
  rays: 0,
  particles: 0,
  glow: 1.8, // aura más fuerte
  pulseEveryMs: 100,
  colors: { core: 0xffffff, gold: 0xc8f8ff, hot: 0x1f8cff, cyan: 0x5fe8ff },
  aura: [
    [1.6, 0x1f8cff, 0.26],
    [1.25, 0x5fe8ff, 0.3],
    [0.95, 0xe8fdff, 0.3],
  ],
  flashTint: 0xf0fdff,
};

/**
 * (17-11-2026, usuario: "dura mucho antes del peloteo") La carga DEL PARTIDO: la de ENERGY_CINE (6 s, la línea de tiempo del dibujo de
 * fx/energyBallCine.ts) acortada a 1,8 s, como hace la demostración. El dibujo se llama con el tiempo reescalado: e / ENERGY_MATCH_K.
 */
export const ENERGY_MATCH_K = 1800 / ENERGY_CINE.hitAtMs; // (17-11-2026, usuario) 1,8 s (antes 2,4 s): el peloteo ya dura varios segundos
export const ENERGY_MATCH_CINE: CineProfile = {
  ...ENERGY_CINE,
  durationMs: ENERGY_CINE.durationMs * ENERGY_MATCH_K,
  hitAtMs: ENERGY_CINE.hitAtMs * ENERGY_MATCH_K,
  activateMs: ENERGY_CINE.activateMs * ENERGY_MATCH_K,
  focusMs: ENERGY_CINE.focusMs * ENERGY_MATCH_K,
  peakMs: ENERGY_CINE.peakMs * ENERGY_MATCH_K,
  releaseFromMs: ENERGY_CINE.releaseFromMs * ENERGY_MATCH_K,
  flashAtMs: ENERGY_CINE.flashAtMs * ENERGY_MATCH_K,
  flashMs: ENERGY_CINE.flashMs * ENERGY_MATCH_K,
};

/** (17-11-2026) carga del HURACÁN: la misma (1,8 s) con su color (oro y viento) */
export const HURRICANE_MATCH_CINE: CineProfile = {
  ...ENERGY_MATCH_CINE,
  colors: { core: 0xffffff, gold: 0xffd23f, hot: 0xe0a400, cyan: 0x9cf5c8 },
  aura: [
    [1.6, 0xe0a400, 0.24],
    [1.25, 0xffd23f, 0.28],
    [0.95, 0xfff6c8, 0.3],
  ],
  flashTint: 0xfff6c8,
};

export const ENERGY_RALLY = {
  /**
   * el desplazamiento fantasma de la ULTI (INFERNO.dash 1000-1650, el MISMO acercamiento a la pelota que las demás ULTIS) se corre a este
   * instante de la carga del partido (1800 − 1650: termina justo al empezar el peloteo)
   */
  dashShiftMs: 150,
  /** pausa al empezar el peloteo (la pelota espera en la raqueta: la primera raqueta llega a su frame de golpe) */
  startMs: 160,
  /** vuelo de cada pelota del peloteo (fondo a fondo, rapidísimo) */
  // (17-11-2026, usuario) los 3 peloteos duran 3,5 s: startMs + 6 vuelos = 160 + 6 × 557 ≈ 3500 ms (antes 450 → 2,9 s; antes aún 620)
  // (18-11-2026, usuario) el doble de rápido: 279 ms (antes 557)
  flightMs: 279,
  /** vuelo de la BOLA DE ENERGÍA final (más lenta: se tiene que ver) */
  finalMs: 900,
  /**
   * (17-11-2026) antes del golpe final la BOLA DE ENERGÍA CRECE en la raqueta (fx/energyBallCine.ts drawGrow): la pelota espera
   * en la raqueta este tiempo entre la llegada de la última devolución y la salida de la bola final
   */
  growMs: 700,
  /** estiradas del rival (la última lo deja tendido) */
  returns: 3,
  /** el rival empieza a tirarse este tiempo antes de llegar la pelota */
  diveLeadMs: 180, // (18-11-2026) < flightMs (paleteo x2)
  /** los golpes del que lanza la ULTI empiezan este tiempo antes del contacto (la raqueta llega a su frame) */
  swingLeadMs: 110,
  /**
   * (21-11-2026, usuario) tras el golpe final de la BOLA DE ENERGIA el que la lanza se queda con el ULTIMO frame del clip inferno-swing (frame 9 = indice 8: la
   * raqueta del ultimo golpe) durante `finishHoldMs` y luego siguen sus sprites de siempre.
   */
  finishFrame: 8,
  finishHoldMs: 1000,
  /** la pelota llega a esta distancia lateral del sitio del rival (fuera de su alcance normal: solo llega estirándose) */
  diveReach: 115,
  /** donde queda el cuerpo del rival al final de la estirada (respecto a su sitio) */
  diveBody: 70,
  /** altura (z) de la pelota en la raqueta del que golpea / en la del rival estirado */
  zHit: 34,
  zDive: 14,
  /** devoluciones del rival: botan a esta fracción del camino y en esta fracción del tiempo del tiro (17-11-2026) */
  bounceAt: 0.78,
  bounceTime: 0.78, // = bounceAt: la pelota avanza a velocidad constante en el suelo (la escena dibuja su estela con esa velocidad)
  /** altura máxima extra del arco de cada pelota (pasa sobre la red) */
  arc: 70,
  arcFinal: 55,
};

export interface P3 {
  x: number;
  y: number;
  z: number;
}
export interface P2 {
  x: number;
  y: number;
}

export interface RallyShot {
  /** 'att' = el que lanza la ULTI; 'vic' = el rival */
  by: 'att' | 'vic';
  from: P3;
  to: P3;
  /** contacto (sale la pelota) y llegada, en ms desde el inicio del peloteo */
  t0: number;
  t1: number;
  arc: number;
  /** estirada del rival al recibirla: lado (+1 = hacia y mayor) y si es la última (se queda tendido) */
  side?: 1 | -1;
  lie?: boolean;
  /** la BOLA DE ENERGÍA final */
  final?: boolean;
  /**
   * (17-11-2026) BOTE antes de llegar (las devoluciones del rival, como en la demostración de PERSONALIZAR): punto del bote, fracción del
   * tiempo del tiro en que bota y altura del arco de cada tramo
   */
  bounce?: P3;
  tb?: number;
  arc2?: number;
}

export interface EnergyRallyPlan {
  /** sitio de peloteo del que lanza (fondo de su campo): el desplazamiento de la ULTI lo deja aquí */
  att: P2;
  /** sitio del rival (fondo del suyo) */
  vic: P2;
  shots: RallyShot[];
  /** el rival tendido (centro del cuerpo) y el punto donde le pega la bola final */
  lie: P2;
  hit: P3;
  /** fin del guion (llega la bola final) en ms desde el inicio del peloteo */
  endMs: number;
  /** (17-11-2026) 'hurricane' = guion del HURACÁN (planHurricane); sin él, el de la BOLA DE ENERGÍA */
  kind?: 'energy' | 'hurricane';
  /** HURACÁN: el rival sale despedido de `vic` a `knockTo` entre t0 y t1 (ms) y queda tendido; `side` = hacia dónde cae */
  knock?: { t0: number; t1: number; to: P2; side: 1 | -1 };
  /** HURACÁN: el tornado sube al que la lanza `lift` (z) entre t0 y t1; baja tras el smash (de down0 a endMs) */
  lift?: { t0: number; t1: number; down0: number; z: number };
  /** (18-11-2026) HURACÁN: el que la lanza corre de `from` a `to` (detrás de la T) entre t0 y t1 */
  move?: { t0: number; t1: number; from: P2; to: P2 };
}

/**
 * (17-11-2026) ULTI LEGENDARIA HURACÁN: los MISMOS tiempos que la BOLA DE ENERGÍA (carga 1,8 s; 3,5 s de "peloteo"; 0,7 s; 0,9 s de vuelo
 * final) con otro guion:
 *   1) golpe cargado al máximo con viento potente al rival (shot 0) → sale despedido contra el fondo y queda en el suelo (knock)
 *   2) la pelota vuelve en un GLOBITO que se queda alto sobre el que la lanza (shot 1, hasta el final de los 3,5 s)
 *   3) un TORNADO lo sube hasta la pelota (lift, durante growMs) y sale envuelto en una esfera amarilla
 *   4) SMASH final desde arriba al rival tendido (shot final, finalMs) → el impacto de siempre de la ULTI
 */
export const HURRICANE = {
  /** vuelo del golpe de viento hasta el rival */
  shotMs: 650,
  /** el rival sale despedido hasta el fondo en este tiempo */
  knockMs: 420,
  /** hasta dónde sale despedido (canónico: x del fondo del rival) */
  backX: COURT.right + 125,
  /** altura (z) a la que queda el globito y donde se pega el smash; y cuánto sube el tornado al jugador */
  // (18-11-2026, usuario) salto más alto (120 → 240) y el smash más arriba (240 → 330), como en la demostración
  apexZ: 330,
  liftZ: 240,
  /** el que la lanza baja tras el smash a partir de aquí (ms después de su contacto) */
  downAfterMs: 260,
  /**
   * (18-11-2026, usuario) como en la demostración: `toTMs` después de su golpe se va corriendo (`runMs`) a un poco detrás de la T (`tDepth` del
   * campo desde la red) y desde ahí salta; el salto sube en `riseMs`; el TORNADO (hoja de 8 cuadros) dura `tornadoMs` (desde la mitad ya es la
   * esfera amarilla) y luego se le ve `hoverMs` con la pose del smash antes de golpear.
   */
  toTMs: 300,
  runMs: 600,
  tDepth: 0.64,
  riseMs: 750,
  tornadoMs: 960,
  hoverMs: 500,
  /**
   * (21-11-2026, usuario) 1.er golpe tras la carga (el viento potente): su efecto sale al DOBLE de tamano (`k`), con mas sacudida y un destello, y suena
   * inferno.mp3 (clave 'inferno-hit'); el rival recibe un viento algo mayor (`blast`).
   */
  // (21-11-2026, usuario) "sigue muy pequeno": k 2 -> 3,2 y mas viento sobre el rival (2,2). Luego "no veo el primer golpe": con 3,2 el destello cubria
  // toda la pantalla y tapaba la raqueta y la pelota; queda k 2,6 con el destello mas chico y sin el flash de cámara completo.
  // (19-11-2026, usuario) "no se ve el primer golpe": la pelota vuela como BOLA DE ENERGÍA del huracán, algo MÁS GRANDE que la del smash final
  // (`ball` × la esfera de la ULTI; el smash usa 1,25) y al llegar al rival / máquina explota con un impacto (`impactK`, sacudida `impactShake`)
  // (20-11-2026, usuario) bola del 1.er golpe un poco más chica (ball 1,6 -> 1,35) y con los rayos girando AL REVÉS que en el smash final (hurricaneSpin)
  firstHit: { k: 2.6, shakeMs: 340, shake: 0.024, blast: 2.2, sound: 'inferno-hit', volume: 0.5 /* (26-11-2026, usuario) más suave */, ball: 1.35, impactK: 1.8, impactShakeMs: 320, impactShake: 0.03 },
  /**
   * (21-11-2026, usuario) tras el SMASH final el que la lanza se queda en el aire con la pose del golpe (frame 7 del clip smash-power = indice 6: raqueta a
   * la izquierda) hasta que cae al suelo; entonces sigue con sus sprites de siempre.
   */
  finishFrame: 6,
};

/** Guion del HURACÁN. `a` = sitio del que la lanza (su contacto de la ULTI); `v` = el rival (canónico, como planEnergyRally). */
export function planHurricane(a: P2, v: P2, seed: number): EnergyRallyPlan {
  const R = ENERGY_RALLY;
  const H = HURRICANE;
  const rnd = seeded(seed);
  const att: P2 = { x: clamp(a.x, COURT.left - 120, NET_X - 60), y: clamp(a.y, COURT.top, COURT.bottom) };
  const vic: P2 = { x: clamp(v.x, NET_X + 60, COURT.right + 140), y: clamp(v.y, COURT.top - ALLEY + R.diveReach * 0.5, COURT.bottom + ALLEY - R.diveReach * 0.5) };
  // cae hacia el centro de la cancha (si está al medio, a un lado al azar)
  const side: 1 | -1 = Math.abs(vic.y - LAT_C) > HALF_W * 0.2 ? (vic.y < LAT_C ? 1 : -1) : rnd() < 0.5 ? 1 : -1;
  const peloteo = 2 * R.returns * R.flightMs; // lo que duran los 3 peloteos de la BOLA DE ENERGÍA
  // golpe, despedida y globito caben en ese tiempo (se reparten en proporción; el globito, como mínimo 0,45 s)
  const fit = Math.min(1, Math.max(0.35, (peloteo - 450) / (H.shotMs + H.knockMs)));
  const rallyEnd = R.startMs + peloteo;
  const t0 = R.startMs;
  const t1 = t0 + H.shotMs * fit;
  const knockTo: P2 = { x: Math.max(vic.x, H.backX), y: vic.y + side * R.diveBody * 0.6 };
  const k1 = t1 + H.knockMs * fit;
  // (18-11-2026) se va a un poco detrás de la T de su campo; el globito cae ahí
  const spot: P2 = { x: NET_X - (NET_X - COURT.left) * H.tDepth, y: LAT_C };
  const move = { t0: t0 + H.toTMs, t1: t0 + H.toTMs + H.runMs, from: { ...att }, to: spot };
  const apex: P3 = { x: spot.x + 26, y: spot.y, z: H.apexZ };
  const shots: RallyShot[] = [
    { by: 'att', from: { x: att.x + 18, y: att.y, z: R.zHit }, to: { x: vic.x - 12, y: vic.y, z: 52 }, t0, t1, arc: 26 },
    // el globito: rebota en el rival y sube despacio hasta quedar alto sobre el que la lanza
    { by: 'vic', from: { x: knockTo.x - 10, y: knockTo.y, z: 40 }, to: apex, t0: k1, t1: rallyEnd, arc: 150 },
  ];
  const fin0 = rallyEnd + R.growMs;
  const lie: P2 = { ...knockTo };
  const hit: P3 = { x: lie.x - 6, y: lie.y, z: 12 };
  shots.push({ by: 'att', from: apex, to: hit, t0: fin0, t1: fin0 + R.finalMs, arc: 20, final: true });
  return {
    kind: 'hurricane',
    att,
    vic,
    shots,
    lie,
    hit,
    endMs: fin0 + R.finalMs,
    knock: { t0: t1, t1: k1, to: knockTo, side },
    // (18-11-2026) salta antes: tornado + pose del smash terminan justo en el golpe final (fin0)
    lift: { t0: fin0 - H.tornadoMs - H.hoverMs, t1: fin0 - H.tornadoMs - H.hoverMs + H.riseMs, down0: fin0 + H.downAfterMs, z: H.liftZ },
    move,
  };
}

/** HURACÁN: altura extra (z) del que la lanza en `t` (el tornado lo sube; baja tras el smash). 0 en la BOLA DE ENERGÍA. */
export function attackerLiftAt(plan: EnergyRallyPlan, t: number): number {
  const L = plan.lift;
  if (!L || t < L.t0) return 0;
  if (t < L.t1) return L.z * easeOut((t - L.t0) / Math.max(1, L.t1 - L.t0));
  if (t < L.down0) return L.z;
  const u = clamp((t - L.down0) / Math.max(1, plan.endMs - L.down0), 0, 1);
  return L.z * (1 - u * u);
}

/** PRNG pequeño y determinista (mulberry32): mismo `seed` → misma secuencia en los dos teléfonos. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const LAT_C = (COURT.top + COURT.bottom) / 2;
const HALF_W = (COURT.bottom - COURT.top) / 2;

/**
 * Guion del peloteo. `a` = donde golpearía la ULTI el que la lanza; `v` = el rival; coordenadas canónicas (las del que lanza).
 * Los dos quedan en el FONDO de su campo (larga distancia) y cerca del centro (las estiradas no se salen de la cancha).
 */
export function planEnergyRally(a: P2, v: P2, seed: number): EnergyRallyPlan {
  const R = ENERGY_RALLY;
  const rnd = seeded(seed);
  // (17-11-2026, usuario) los dos se quedan DONDE ESTÁN (ya no se van al fondo): el que lanza, en su sitio; el rival, en su FILA (su x),
  // y solo se mueve de lado al estirarse. La y se acota lo justo para que las estiradas no se salgan de la cancha.
  const att: P2 = { x: clamp(a.x, COURT.left - 120, NET_X - 60), y: clamp(a.y, COURT.top, COURT.bottom) };
  const vic: P2 = { x: clamp(v.x, NET_X + 60, COURT.right + 140), y: clamp(v.y, COURT.top - ALLEY + R.diveReach * 0.5, COURT.bottom + ALLEY - R.diveReach * 0.5) };
  // raqueta del que lanza: delante de su cuerpo, hacia la red; se mueve un poco de lado entre golpes
  const attHit = (k: number): P3 => {
    const off = k === 0 ? 0 : (rnd() < 0.5 ? -1 : 1) * (18 + rnd() * 16);
    return { x: att.x + 18, y: clamp(att.y + off, COURT.top + 30, COURT.bottom - 30), z: R.zHit };
  };
  // la 1.ª estirada, hacia el centro si el rival está cerca de una banda (así no se tira fuera de la cancha); luego alternan
  const r0 = rnd();
  let side: 1 | -1 = Math.abs(vic.y - LAT_C) > HALF_W * 0.35 ? (vic.y < LAT_C ? 1 : -1) : r0 < 0.5 ? 1 : -1;
  const shots: RallyShot[] = [];
  let t = R.startMs;
  let from = attHit(0);
  let lie: P2 = { ...vic };
  for (let i = 0; i < R.returns; i++) {
    const last = i === R.returns - 1;
    const c: P3 = { x: vic.x - 12, y: vic.y + side * R.diveReach, z: R.zDive };
    shots.push({ by: 'att', from, to: c, t0: t, t1: t + R.flightMs, arc: R.arc, side, lie: last });
    t += R.flightMs;
    const back = attHit(i + 1);
    // la devolución del rival BOTA en el campo del que lanza antes de llegarle (como en PERSONALIZAR)
    const bounce: P3 = { x: c.x + (back.x - c.x) * R.bounceAt, y: c.y + (back.y - c.y) * R.bounceAt, z: 0 };
    shots.push({ by: 'vic', from: c, to: back, t0: t, t1: t + R.flightMs, arc: R.arc + 40, bounce, tb: R.bounceTime, arc2: 26 });
    t += R.flightMs;
    from = back;
    if (last) lie = { x: vic.x, y: vic.y + side * R.diveBody };
    side = side === 1 ? -1 : 1;
  }
  const hit: P3 = { x: lie.x - 6, y: lie.y, z: 12 };
  t += R.growMs; // la bola crece en la raqueta (la pelota espera ahí: shotAt sigue en la devolución anterior, ya llegada)
  shots.push({ by: 'att', from, to: hit, t0: t, t1: t + R.finalMs, arc: R.arcFinal, final: true });
  return { att, vic, shots, lie, hit, endMs: t + R.finalMs };
}

/** Posición de la pelota en `t` dentro del tiro `sh` (escribe en `out`, sin crear objetos). Antes del contacto, en la raqueta. */
export function shotBallAt(sh: RallyShot, t: number, out: P3): P3 {
  const u = clamp((t - sh.t0) / (sh.t1 - sh.t0), 0, 1);
  if (sh.bounce && sh.tb) {
    // dos tramos: hasta el bote y del bote a la raqueta
    const b = sh.bounce;
    const first = u < sh.tb;
    const a = first ? sh.from : b;
    const z = first ? b : sh.to;
    const k = first ? u / sh.tb : (u - sh.tb) / (1 - sh.tb);
    const h = first ? sh.arc : (sh.arc2 ?? 20);
    out.x = a.x + (z.x - a.x) * k;
    out.y = a.y + (z.y - a.y) * k;
    out.z = a.z + (z.z - a.z) * k + 4 * h * k * (1 - k);
    return out;
  }
  out.x = sh.from.x + (sh.to.x - sh.from.x) * u;
  out.y = sh.from.y + (sh.to.y - sh.from.y) * u;
  out.z = sh.from.z + (sh.to.z - sh.from.z) * u + 4 * sh.arc * u * (1 - u);
  return out;
}

/** Tiro en curso en `t` (el último que ya salió o, antes del primero, el primero). */
export function shotAt(plan: EnergyRallyPlan, t: number): RallyShot {
  let cur = plan.shots[0];
  for (const sh of plan.shots) if (t >= sh.t0) cur = sh;
  return cur;
}

const easeOut = (u: number) => 1 - (1 - u) * (1 - u);

/**
 * Dónde está el RIVAL en `t`: en su sitio; en cada estirada se lanza de lado (llega con el cuerpo a `diveBody` justo al tocar
 * la pelota) y en la recuperación vuelve a su sitio; tras la última se queda tendido. Escribe en `out`.
 */
export function victimAt(plan: EnergyRallyPlan, t: number, out: P2): P2 {
  const R = ENERGY_RALLY;
  out.x = plan.vic.x;
  out.y = plan.vic.y;
  if (plan.knock) {
    // HURACÁN: en su sitio hasta el golpe; sale despedido hacia el fondo (frenando) y se queda tendido allí
    const K = plan.knock;
    if (t <= K.t0) return out;
    const u = easeOut(clamp((t - K.t0) / Math.max(1, K.t1 - K.t0), 0, 1));
    out.x = plan.vic.x + (K.to.x - plan.vic.x) * u;
    out.y = plan.vic.y + (K.to.y - plan.vic.y) * u;
    return out;
  }
  for (const sh of plan.shots) {
    if (sh.by !== 'att' || sh.final || !sh.side) continue;
    const d0 = sh.t1 - R.diveLeadMs;
    if (t < d0) break;
    const body = plan.vic.y + sh.side * R.diveBody;
    if (t <= sh.t1) {
      out.y = plan.vic.y + (body - plan.vic.y) * easeOut((t - d0) / R.diveLeadMs);
      return out;
    }
    if (sh.lie) {
      out.y = body;
      return out;
    }
    // recuperación: vuelve a su sitio antes de la siguiente estirada
    const back = R.flightMs * 2 - R.diveLeadMs - 40;
    const u = clamp((t - sh.t1 - 80) / Math.max(1, back - 80), 0, 1);
    out.y = body + (plan.vic.y - body) * u;
  }
  return out;
}

/** Dónde está el que lanza en `t`: va de lado a la raqueta de cada golpe suyo (cuerpo = raqueta − 18 en x). */
export function attackerAt(plan: EnergyRallyPlan, t: number, out: P2): P2 {
  // (18-11-2026) HURACÁN: en su sitio, corre a detrás de la T y se queda ahí (salta desde ahí)
  const M = plan.move;
  if (M) {
    const u = clamp((t - M.t0) / Math.max(1, M.t1 - M.t0), 0, 1);
    const e = u * u * (3 - 2 * u);
    out.x = M.from.x + (M.to.x - M.from.x) * e;
    out.y = M.from.y + (M.to.y - M.from.y) * e;
    return out;
  }
  out.x = plan.att.x;
  out.y = plan.att.y;
  let prevY = plan.att.y;
  for (const sh of plan.shots) {
    if (sh.by !== 'att') continue;
    const y = sh.from.y;
    // llega a su raqueta durante el vuelo de la pelota anterior (los 400 ms antes del contacto)
    const m0 = sh.t0 - 250; // (18-11-2026) paleteo x2 (antes 400)
    if (t < m0) break;
    out.y = t >= sh.t0 ? y : prevY + (y - prevY) * easeOut((t - m0) / 250);
    prevY = y;
    if (t < sh.t0) break;
  }
  return out;
}

/** Espejo de un punto canónico a la vista del otro teléfono (mismo espejo que net/mirror.ts). */
export function mirrorP<T extends P2>(p: T, out: T): T {
  out.x = COURT.left + COURT.right - p.x;
  out.y = 2 * LAT_C - p.y;
  return out;
}
