// DUELO RED ("subir a la red"): constantes y lógica PURA (sin Phaser ni imports: la prueba la importa tal cual,
// tools/test-net-duel.mjs). La escena (MatchScene) y sus efectos (fx/NetDuelFx.ts) solo aplican estos números.
//
// Un peloteo en la red NUNCA se alarga: en cuanto el que RECIBE está en la red, el punto pasa al DUELO RED (1 vez por punto,
// dura < 8 s) y SIEMPRE termina con un GLOBO DISPARADO. Después el punto sigue normal.
//
//   1. INICIO (introMs): pausa con las dos miradas, viñeta, aviso "DUELO RED"; la cámara se acerca a la red.
//   2. 3 RONDAS (siempre 3): peloteo automático de 2 o 3 golpes (hitMs cada uno) y la pelota se transforma en el ARO, que se
//      cierra en ringMsOf(ronda) (1100, 900, 700 ms). Cada uno toca el botón de golpe; gana la ronda quien toca más cerca del cierre (medido en ms con
//      performance.now()). Diferencia ≤ tieMs = ronda empatada; sin toque = la pierde.
//   3. GANA el que gane más rondas; empate → el que RECIBÍA la pelota cuando empezó.
//   4. GLOBO DISPARADO del ganador (aimMs para elegir lado con el joystick) a la esquina del fondo, con un tiempo de vuelo
//      ajustado al rival (corriendo llega justo, normalmente con estirada; con DEFENSIVO llega bien).
//
// QUÉ AJUSTAR (también en NOTAS-CLAUDE.txt):
//   · sale demasiado seguido   → bajar `triggerDist` (fracción de media cancha) o `reachK`
//   · dura mucho / poco        → introMs, hitMs, ringMs (el test comprueba que el peor caso no pasa de maxMs)
//   · el aro es muy exigente   → subir `tieMs` o bajar `botErrMinMs/botErrMaxMs` si es el bot
//   · el globo es imposible    → subir `lob.slackS` (más tiempo de vuelo) o `lob.inset`
//   · el globo es muy fácil    → bajar `lob.slackS`
//   · la cámara                → camZoom (cuánto se acerca), camRate (qué tan rápido), camLift

export type DuelWho = 'player' | 'bot';
/** resultado de una ronda: gana uno o empatan */
export type RoundWho = DuelWho | 'tie';

export const NET_DUEL = {
  /**
   * distancia máxima a la red de CADA UNO de los dos, como fracción de media cancha (≈ 117 u de 470). Los dos tienen que estar
   * ya cerca de la red: nadie corre hacia ella para el duelo.
   */
  triggerDist: 0.4, // (14-11-2026) 0,25 -> 0,4: costaba llegar tan pegado a la red (≈ 188 u de 470)
  /** en el duelo, los dos quedan a esta distancia de la red (unidades de cancha) */
  netGap: 60,
  /** la pelota debe estar a menos de HIT_RANGE × reachK del que la recibe ("a punto de llegar a su alcance") */
  reachK: 2.2,
  /** si el peloteo ya lleva tantos golpes en el punto, el duelo sale aunque la pelota aún no esté al alcance (nunca se alarga) */
  forceAfterShots: 6,

  // ---- tiempos (ms)
  /** INICIO: pausa con las miradas */
  introMs: 1200,
  /** RONDA: lo que tarda la pelota en llegar al primer golpeador, y cada golpe automático del peloteo */
  leadMs: 80,
  /** en las rondas 2 y 3 el peloteo espera a que se decida la ronda anterior (lateMs + graceMs): así el golpe del GANADOR ya se sabe */
  leadAfterMs: 210,
  hitMs: 230,
  /** el aro se cierra en este tiempo, por ronda (1, 2, 3): cada ronda más rápido (cámara lenta). Usar ringMsOf(ronda) */
  ringMs: [1100, 900, 700] as readonly number[],
  /** un toque hasta tantos ms DESPUÉS del cierre todavía cuenta (más tarde = sin toque) */
  lateMs: 150,
  /** el juez (red) espera esto tras la ventana de toques el valor del rival antes de decidir la ronda */
  graceMs: 50,
  /** el ganador elige el lado del globo con el joystick durante este tiempo */
  aimMs: 1000,
  /** tope absoluto del duelo, desde el inicio hasta que sale el globo (el test comprueba el peor caso) */
  maxMs: 8000,
  /** red: tras el aviso del globo, esto se espera su golpe (game:hit) antes de simularlo aquí */
  hitWaitMs: 1500,
  /** red: el no-juez espera esto el aviso de cada ronda / el resultado final del juez antes de usar lo que sabe */
  netWaitMs: 1200,

  // ---- reglas
  /** rondas: SIEMPRE 3 */
  rounds: 3,
  /** golpes del peloteo por ronda: 2 o 3 */
  rallyMin: 2,
  rallyMax: 3,
  /** ronda (0 = la primera) cuyo peloteo es SIEMPRE de 3 golpes rápidos: el SHOW de antes del segundo aro */
  showRound: 1,
  /** SHOW del peloteo: los golpes cruzan la red de lado a lado (± esta distancia desde el centro, u de cancha) y en algunos golpes el que pega se ESTIRA (duelLungeHit): la pelota va más lejos (× lungeReach) y más baja, pero siempre con un sprite de GOLPE (nunca el de tirado en el suelo) */
  showSpread: 85,
  lungeReach: 1.35,
  /** cuadro del resultado de cada ronda y del duelo (ms) */
  boxMs: 1100,
  /** dos toques cuyos errores (en ms) difieren menos de esto empatan la ronda */
  tieMs: 5,
  /** nivel del bot (BotAI.d, 0..1): error de su toque en ms (a más nivel, más cerca del cierre) y probabilidad de no tocar (a nivel 0) */
  botErrMaxMs: 240,
  botErrMinMs: 18,
  botMissMax: 0.15,

  // ---- efectos
  /** miradas: ancho de cada franja (fracción del ancho de pantalla) y entrada / salida (ms) */
  gazeW: 1 / 3,
  gazeInMs: 180,
  gazeOutMs: 200,
  /** viñeta de los lados (alfa máximo) */
  vignette: 0.42,
  /** RONDA DECISIVA (1-1 antes de la tercera): viñeta más oscura, aviso grande (ms que se queda) y aro dorado */
  vignetteDecisive: 0.78,
  decisiveMs: 800,
  /** destello del ganador de cada ronda: su primer golpe del peloteo siguiente (solo visual): la pelota sale más rápida (exponente de la curva), estela de su color y sonido más alto */
  boostCurve: 2.4,
  boostVol: 1,
  boostTrailMs: 260,
  /** indicador de precisión: verde hasta msGood, amarillo hasta msOk, rojo más lejos */
  msGood: 30,
  msOk: 90,
  /** un toque antes de esta fracción del recorrido del aro es un FALLO (¡PRONTO!) */
  earlyMin: 0.4,
  /** online: ping (ms) a partir del cual se avisa 'DUELO CON RETRASO' (solo informativo) y cuánto se queda el aviso */
  lagWarnMs: 180,
  lagNoticeMs: 2600,
  /** cámara: cuánto se acerca a la red (+0,22 = 22 %), qué tan rápido entra / sale y cuánto sube el encuadre (px) */
  camZoom: 0.5,
  /** PRESIÓN: el zoom se cierra otro tanto por cada ronda que pasa y el borde late (viñeta roja) cada vez más rápido */
  camPress: 0.07,
  /** el marcador principal se esconde al empezar el duelo (s⁻¹ de suavizado) y vuelve despacio al terminar */
  hudOut: 7,
  hudBack: 1.6,
  camRate: 4,
  camRelease: 3.5,
  camLift: 0,

  // ---- globo disparado
  /**
   * GLOBO DISPARADO: margen a la esquina (unidades de cancha), colchón de tiempo (s) sobre lo que necesita el rival, reacción
   * del que defiende (s) y margen sobre la red de la trayectoria
   */
  // (14-11-2026) vuelo como el de un GLOBO NORMAL (~1-1,2 s): rápido aunque suba alto (lobApex)
  lob: { inset: 22, slackS: 0.15, reactS: 0.2, minS: 1.0, maxS: 1.2, margin: 60 },
  /** GLOBO DISPARADO del duelo: cuánto se aleja la cámara mientras vuela (0,32 = 32 %); el globo sube alto (minS: tiempo de vuelo mínimo) */
  lobZoomOut: 0.12, // (14-11-2026) 0,38 alejaba demasiado: se veía poca imagen
  /** altura que sube el GLOBO DISPARADO sobre el punto de golpe (u): ~el triple del de antes (~150); el tiempo de vuelo no cambia (gravedad propia del vuelo) */
  lobApex: 420,
  /** EFECTO del globo cargado al máximo (duelo y golpe normal): sale casi recto (esta fracción del desvío lateral) y se ABRE hacia su esquina del fondo con aceleración lateral, como el saque con efecto */
  lobCurve: 0.15,
  /** tras salir el globo nadie lo alcanza durante este tiempo (ms): el que defiende está pegado a la red y el globo pasa por su alcance al salir */
  lobGraceMs: 450,
  /** estirada del BOT defensor: probabilidad = base + k × nivel (0..1); alcance y altura como LUNGE_RANGE / LUNGE_MAX_Z */
  botLunge: { base: 0.35, k: 0.5 },
} as const;

/** Entradas de la decisión de empezar (todo lo que sabe la escena en un instante). */
export interface DuelTriggerCtx {
  /** fase 'rally' */
  rally: boolean;
  /** saque o su devolución (MatchScene.serveLock) */
  serveLock: boolean;
  /** ya hubo un duelo en este punto */
  used: boolean;
  /** hay una cinemática, REMATE, DASH, estirada, ULTI o ESPECIAL en curso / armado */
  busy: boolean;
  /** alguno sin raqueta, aturdido o desaparecido */
  incapacitated: boolean;
  /** la pelota es de poder (SMASH / ULTI) o es un globo */
  powerOrLob: boolean;
  /** distancia a la red (en x) de cada jugador (positiva) */
  playerNetDist: number;
  botNetDist: number;
  /** largo de media cancha */
  halfLen: number;
  /** quién va a recibir la pelota (null = nadie: la pelota no va hacia ellos) */
  receiver: DuelWho | null;
  /** distancia (suelo) de la pelota a la raqueta del que recibe, y el alcance normal */
  ballDist: number;
  hitRange: number;
  /** golpes del punto hasta ahora (para que un peloteo en la red no se alargue) */
  shots: number;
}

/** ¿Empieza el duelo ahora? */
export function shouldStartDuel(c: DuelTriggerCtx): boolean {
  if (!c.rally || c.serveLock || c.used || c.busy || c.incapacitated || c.powerOrLob) return false;
  if (c.receiver === null) return false;
  const lim = NET_DUEL.triggerDist * c.halfLen;
  // REGLA: los DOS ya están cerca de la red (nadie corre hacia ella para el duelo)
  if (c.playerNetDist > lim || c.botNetDist > lim) return false;
  // la pelota a punto de llegar a su alcance; y si el peloteo ya es largo, sale igual (nunca se alarga)
  return c.ballDist <= c.hitRange * NET_DUEL.reachK || c.shots >= NET_DUEL.forceAfterShots;
}

// ---------------------------------------------------------------- calendario de las rondas

/** Una ronda en ms desde el inicio de las rondas. */
export interface RoundPlan {
  start: number;
  /** instante de cada golpe automático del peloteo */
  hitAt: number[];
  /** el aro empieza a cerrarse / se cierra */
  ringStart: number;
  close: number;
  /** lo que tarda el aro de ESTA ronda en cerrarse (close - ringStart) */
  ringMs: number;
}

/** Golpes del peloteo de cada ronda (2 o 3), sorteados con `rnd` () => [0,1). */
export function rollPlan(rnd: () => number): number[] {
  const out: number[] = [];
  for (let r = 0; r < NET_DUEL.rounds; r++) out.push(r === NET_DUEL.showRound ? NET_DUEL.rallyMax : rnd() < 0.5 ? NET_DUEL.rallyMin : NET_DUEL.rallyMax);
  return out;
}

/** Fuerza un plan válido (llegó por la red): siempre 3 rondas con 2 o 3 golpes. */
export function cleanPlan(plan: ArrayLike<number>): number[] {
  const out: number[] = [];
  for (let r = 0; r < NET_DUEL.rounds; r++) {
    const n = Math.floor(Number(plan[r]));
    out.push(r === NET_DUEL.showRound || n >= NET_DUEL.rallyMax ? NET_DUEL.rallyMax : NET_DUEL.rallyMin);
  }
  return out;
}

/**
 * Lado (-1 / +1 = y menor / mayor) del golpe `g` del peloteo (0 = el primero del duelo; los golpes alternan entre los dos).
 * Cada uno cambia de lado en cada golpe suyo y la pelota cruza la red en diagonal: A derecha, B izquierda, A izquierda, B derecha…
 */
export function duelHitSide(g: number): -1 | 1 {
  return ((g >> 1) + (g & 1)) % 2 ? -1 : 1;
}

/** ¿El golpe `j` (0..) de la ronda `r` es una ESTIRADA? Show del peloteo: 2º golpe de las dos primeras rondas y 3º de la ronda del show. */
export function duelLungeHit(r: number, j: number): boolean {
  return (r < 2 && j === 1) || (r === NET_DUEL.showRound && j === 2);
}

/** Calendario de las 3 rondas seguidas (sin pausas: la siguiente empieza cuando se cierra el aro). `total` = cierre de la última. */
export function duelSchedule(plan: readonly number[]): { rounds: RoundPlan[]; total: number } {
  const rounds: RoundPlan[] = [];
  let t = 0;
  for (let r = 0; r < NET_DUEL.rounds; r++) {
    const n = r === NET_DUEL.showRound ? NET_DUEL.rallyMax : Math.max(NET_DUEL.rallyMin, Math.min(NET_DUEL.rallyMax, Math.floor(plan[r] ?? NET_DUEL.rallyMin)));
    const start = t;
    const hitAt: number[] = [];
    const lead = r === 0 ? NET_DUEL.leadMs : NET_DUEL.leadAfterMs;
    for (let k = 0; k < n; k++) hitAt.push(start + lead + k * NET_DUEL.hitMs);
    const ringStart = start + lead + n * NET_DUEL.hitMs;
    const ringMs = ringMsOf(r);
    const close = ringStart + ringMs;
    rounds.push({ start, hitAt, ringStart, close, ringMs });
    t = close;
  }
  return { rounds, total: t };
}

/**
 * Peor caso del duelo en ms, hasta que SALE el globo: inicio + 3 rondas de 3 golpes + la ventana de toques tardíos (y la espera
 * del juez) de la última + elegir el lado. No debe pasar de NET_DUEL.maxMs (lo comprueba la prueba).
 */
export function duelWorstMs(): number {
  const worst = duelSchedule([NET_DUEL.rallyMax, NET_DUEL.rallyMax, NET_DUEL.rallyMax]).total;
  return NET_DUEL.introMs + worst + NET_DUEL.lateMs + NET_DUEL.graceMs + NET_DUEL.aimMs;
}

// ---------------------------------------------------------------- toques y ganadores

/** Error de un toque en ms respecto al cierre del aro: negativo = antes del cierre, positivo = después. */
export function tapDiffMs(tapAt: number, closeAt: number): number {
  return tapAt - closeAt;
}

/** Duración del aro de la ronda `r` (0 = la primera): [1100, 900, 700] ms. */
export function ringMsOf(r: number): number {
  const a = NET_DUEL.ringMs;
  return a[Math.max(0, Math.min(a.length - 1, Math.floor(r) || 0))] ?? a[0] ?? 1000;
}

/** ¿Es un toque DEMASIADO PRONTO (antes de earlyMin del recorrido del aro)? Cuenta como fallo: ¡PRONTO!, sin toque. */
export function tapIsEarly(diffMs: number, ringMs: number): boolean {
  return diffMs < -ringMs * (1 - NET_DUEL.earlyMin);
}

/** Color del indicador de precisión según los ms de error (sin importar si es antes o después del cierre). */
export function msTier(diffMs: number): 'good' | 'ok' | 'bad' {
  const a = Math.abs(diffMs);
  return a <= NET_DUEL.msGood ? 'good' : a <= NET_DUEL.msOk ? 'ok' : 'bad';
}

/** ¿Ronda decisiva? Va 1-1 (cada uno ganó una; los empates no cuentan) antes de la tercera. */
export function isDecisive(done: readonly (RoundWho | null)[]): boolean {
  if (done.length < 2) return false;
  const first = done.slice(0, 2);
  return first.filter((w) => w === 'player').length === 1 && first.filter((w) => w === 'bot').length === 1;
}

/** ¿Cuenta un toque con ese error? Desde que empieza a cerrarse el aro hasta lateMs después del cierre. */
export function tapInWindow(diffMs: number, ringMs: number = ringMsOf(0)): boolean {
  return diffMs >= -ringMs && diffMs <= NET_DUEL.lateMs;
}

/**
 * Quién gana una ronda. `p` / `b` = error en ms del toque de cada uno (null = no tocó). Gana el de menor |error|; si sus
 * errores difieren ≤ tieMs, empate; sin toque la pierde; si ninguno toca, empate.
 */
export function roundWinner(p: number | null, b: number | null): RoundWho {
  if (p === null && b === null) return 'tie';
  if (p === null) return 'bot';
  if (b === null) return 'player';
  const ap = Math.abs(p);
  const ab = Math.abs(b);
  if (Math.abs(ap - ab) <= NET_DUEL.tieMs) return 'tie';
  return ap < ab ? 'player' : 'bot';
}

/** Quién gana el duelo: más rondas; si igualan, el que RECIBÍA la pelota cuando empezó. */
export function duelWinner(rounds: readonly RoundWho[], receiver: DuelWho): DuelWho {
  let p = 0;
  let b = 0;
  for (const r of rounds) {
    if (r === 'player') p++;
    else if (r === 'bot') b++;
  }
  if (p === b) return receiver;
  return p > b ? 'player' : 'bot';
}

/**
 * Toque del BOT: error en ms respecto al cierre (null = no toca). `level` = BotAI.d (0..1), `rnd` = () => [0,1).
 * La magnitud baja con el nivel; el signo sale al azar (algo más a menudo pronto que tarde).
 */
export function botTapMs(level: number, rnd: () => number, ringMs: number = ringMsOf(0)): number | null {
  const lv = Math.max(0, Math.min(1, level));
  if (rnd() < NET_DUEL.botMissMax * (1 - lv)) return null;
  const mag = NET_DUEL.botErrMinMs + (NET_DUEL.botErrMaxMs - NET_DUEL.botErrMinMs) * (1 - lv);
  // suma de dos uniformes: casi siempre cerca de su error medio
  const e = ((rnd() + rnd()) / 2) * 2 * mag;
  const err = Math.min(e, ringMs * (1 - NET_DUEL.earlyMin), ringMs - 1) // el bot nunca toca PRONTO;
  const sign = rnd() < 0.6 ? -1 : 1;
  return Math.round(sign === 1 ? Math.min(err, NET_DUEL.lateMs) : -err);
}

/** Texto del error de un toque: "+12 ms" / "−35 ms" (null = "SIN TOQUE"). */
export function diffLabel(d: number | null): string {
  if (d === null) return 'SIN TOQUE';
  const r = Math.round(d);
  return `${r > 0 ? '+' : r < 0 ? '−' : '±'}${Math.abs(r)} ms`;
}

// ---------------------------------------------------------------- globo disparado

/** Lado del globo si el ganador no elige: el contrario de donde está el rival (-1 = y menor / izquierda de la pantalla, +1 = derecha). */
export function defaultAimSide(rivalY: number, latC: number): -1 | 1 {
  return rivalY > latC ? -1 : 1;
}

/** Lado del joystick: x ≥ deadzone = derecha, ≤ -deadzone = izquierda, si no null (sin elección). */
export function sideFromJoystick(x: number, deadzone = 0.3): -1 | 1 | null {
  if (x >= deadzone) return 1;
  if (x <= -deadzone) return -1;
  return null;
}

/**
 * Esquina del GLOBO DISPARADO: el fondo del campo del PERDEDOR, dentro de la cancha, a `inset` de la línea de fondo y de la
 * lateral. `side` = -1 / +1 (y menor / mayor).
 */
export function lobTarget(winner: DuelWho, side: -1 | 1, court: { left: number; right: number }, latC: number, halfW: number, inset: number = NET_DUEL.lob.inset) {
  return {
    x: winner === 'player' ? court.right - inset : court.left + inset,
    y: latC + side * (halfW - inset),
  };
}

/**
 * Tiempo de vuelo (s) del globo AJUSTADO AL RIVAL: lo que tarda en correr hasta la esquina SIN el alcance de la estirada
 * (`lungeRange`), más su reacción y un colchón. Corriendo llega justo (normalmente con estirada); con DEFENSIVO llega bien.
 * `dist` = distancia del rival a la esquina, `speed` = su velocidad (u/s).
 */
export function lobFlightS(dist: number, speed: number, lungeRange: number): number {
  const L = NET_DUEL.lob;
  const run = Math.max(0, dist - lungeRange * 0.85) / Math.max(1, speed);
  return Math.max(L.minS, Math.min(L.maxS, run + L.reactS + L.slackS));
}

/** Espeja el lado de un aviso de red (cada teléfono ve la cancha del otro por la red y el eje lateral). */
export function mirrorSide(side: number): -1 | 1 {
  return side < 0 ? 1 : -1;
}

/** Ronda que se ve desde el otro teléfono: 1 = ganó el jugador del emisor, 2 = ganó su rival, 0 = empate (y al revés). */
export function roundWire(w: RoundWho): 0 | 1 | 2 {
  return w === 'player' ? 1 : w === 'bot' ? 2 : 0;
}

/** Lo que llegó por la red ('duel-round' w) en las coordenadas de ESTE teléfono: lo del emisor se invierte. */
export function roundFromWire(w: number): RoundWho {
  return w === 1 ? 'bot' : w === 2 ? 'player' : 'tie';
}

/** Valor "sin toque" en los mensajes de red (los datos solo admiten números). */
export const NO_TAP = 9999;
