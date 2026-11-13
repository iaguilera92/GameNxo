// DUELO EN LA RED ("subir a la red"): constantes y lógica PURA (sin Phaser ni imports: la prueba la importa tal cual,
// tools/test-net-duel.mjs). La escena (MatchScene) y sus efectos (fx/NetDuelFx.ts) solo aplican estos números.
//
// Cuando los DOS jugadores están muy cerca de la red a la vez y la pelota va a llegar a uno de ellos:
//   1. CARA A CARA (faceMs): partido congelado, las dos miradas a la derecha y un aro que se cierra sobre la pelota.
//      Cada uno toca el botón de golpe; gana quien toca más cerca del cierre.
//   2. 6 VOLEAS automáticas muy rápidas (volleyMs cada una); la 6.ª la da el ganador.
//   3. El ganador elige lado con el joystick (aimMs) y manda un GLOBO a la esquina del fondo de ese lado.
//   4. El perdedor lo devuelve con estirada / defensivo, o pierde el punto.
//
// QUÉ AJUSTAR (también en NOTAS-CLAUDE.txt):
//   · sale demasiado seguido  → bajar `triggerDist` (fracción de media cancha) o `reachK` (qué tan cerca debe llegar la pelota)
//   · el globo es imposible   → subir `lob.inset` (la esquina se acerca a la red) o `lob.margin` (más alto = más tiempo)
//   · el globo es muy fácil   → bajar `lob.inset` (más al fondo) o `lob.margin`
//   · el toque es muy exigente → subir `earlyMin` (admite toques más pronto) o bajar `botErrMin/botErrMax` si es el bot

export type DuelWho = 'player' | 'bot';

export const NET_DUEL = {
  /** distancia máxima a la red de CADA jugador, como fracción de media cancha (≈ 117 u de 470) */
  triggerDist: 0.25,
  /** la pelota debe estar a menos de HIT_RANGE × reachK del que la recibe ("a punto de llegar a su alcance") */
  reachK: 2.2,
  /** CARA A CARA: duración del aro (ms) y margen extra para recibir los toques del rival en red */
  faceMs: 2000,
  graceMs: 300,
  /** un toque antes de esta fracción del recorrido del aro es FALLO ("demasiado pronto") */
  earlyMin: 0.35,
  /** dos toques con menos de esta diferencia de recorrido empatan (gana el que iba a recibir la pelota) */
  tieEps: 0.004,
  /** nivel del bot (BotAI.d, 0..1): error del toque = fracción del recorrido (a más nivel, más cerca del cierre) */
  botErrMax: 0.34,
  botErrMin: 0.04,
  /** probabilidad de que el bot NO toque (nivel 0); a nivel 1 es 0 */
  botMissMax: 0.18,
  /** miradas: ancho de cada franja (fracción del ancho de pantalla) y entrada / salida (ms) */
  gazeW: 1 / 3,
  gazeInMs: 180,
  gazeOutMs: 200,
  /** viñeta de los lados (alfa máximo) */
  vignette: 0.42,
  /** INTERCAMBIO: golpes automáticos (la última la da el ganador) y duración de cada uno (ms) */
  volleys: 6,
  volleyMs: 170,
  /** el ganador elige el lado del globo con el joystick durante este tiempo (ms) */
  aimMs: 1000,
  /** GLOBO final: margen a la esquina (unidades de cancha), velocidad (× SHOT_SPEED) y margen sobre la red de aimShot */
  lob: { inset: 22, speedK: 1.0, margin: 80 },
  /** si no llega el golpe del ganador (red), cuánto se espera antes de seguir sin él (ms) */
  hitWaitMs: 1800,
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
}

/** ¿Empieza el duelo ahora? */
export function shouldStartDuel(c: DuelTriggerCtx): boolean {
  if (!c.rally || c.serveLock || c.used || c.busy || c.incapacitated || c.powerOrLob) return false;
  if (c.receiver === null) return false;
  const lim = NET_DUEL.triggerDist * c.halfLen;
  if (c.playerNetDist > lim || c.botNetDist > lim) return false;
  return c.ballDist <= c.hitRange * NET_DUEL.reachK;
}

/** Recorrido del aro (0 = abierto, 1 = cerrado) a los `ms` del cara a cara. */
export function ringProgress(ms: number, faceMs: number = NET_DUEL.faceMs): number {
  return Math.max(0, Math.min(1, ms / faceMs));
}

/** Clasifica un toque por su recorrido: antes de earlyMin = fallo (demasiado pronto). */
export function judgeTap(p: number | null): 'none' | 'early' | 'ok' {
  if (p === null) return 'none';
  return p < NET_DUEL.earlyMin ? 'early' : 'ok';
}

export interface DuelResult {
  winner: DuelWho;
  /** por qué: 'closer' (toque más cerca del cierre), 'only' (el único toque válido), 'tie' (empate) o 'none' (nadie / ambos fallaron) */
  reason: 'closer' | 'only' | 'tie' | 'none';
}

/**
 * Quién gana el cara a cara. `taps` = recorrido del aro en el toque de cada uno (null = no tocó).
 * Un toque demasiado pronto es fallo. Gana el que toca más cerca del cierre (mayor recorrido). Si nadie toca, ambos
 * fallan o empatan: gana el que iba a recibir la pelota.
 */
export function duelWinner(taps: { player: number | null; bot: number | null }, receiver: DuelWho): DuelResult {
  const jp = judgeTap(taps.player);
  const jb = judgeTap(taps.bot);
  const okP = jp === 'ok';
  const okB = jb === 'ok';
  if (okP && okB) {
    const d = (taps.player as number) - (taps.bot as number);
    if (Math.abs(d) <= NET_DUEL.tieEps) return { winner: receiver, reason: 'tie' };
    return { winner: d > 0 ? 'player' : 'bot', reason: 'closer' };
  }
  if (okP) return { winner: 'player', reason: 'only' };
  if (okB) return { winner: 'bot', reason: 'only' };
  return { winner: receiver, reason: 'none' };
}

/**
 * Toque del BOT: recorrido del aro en que toca (null = no toca). `level` = BotAI.d (0..1), `rnd` = () => [0,1).
 * Error = fracción del recorrido por debajo del cierre; a más nivel, menor.
 */
export function botTapProgress(level: number, rnd: () => number): number | null {
  const lv = Math.max(0, Math.min(1, level));
  if (rnd() < NET_DUEL.botMissMax * (1 - lv)) return null;
  const err = NET_DUEL.botErrMin + (NET_DUEL.botErrMax - NET_DUEL.botErrMin) * (1 - lv);
  // el error se reparte entre 0 y 2·err con más peso cerca de 0 (suma de dos uniformes): casi siempre toca cerca de su error medio
  const e = ((rnd() + rnd()) / 2) * 2 * err;
  return Math.max(0, 1 - e);
}

/**
 * Quién da cada golpe del intercambio: alternan y el ÚLTIMO es del ganador (el primero es del perdedor). Con 6 golpes:
 * perdedor, ganador, perdedor, ganador, perdedor, ganador.
 */
export function volleyHitters(winner: DuelWho, n: number = NET_DUEL.volleys): DuelWho[] {
  const loser: DuelWho = winner === 'player' ? 'bot' : 'player';
  const out: DuelWho[] = [];
  for (let k = 0; k < n; k++) out.push((n - 1 - k) % 2 === 0 ? winner : loser);
  return out;
}

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
 * Esquina del GLOBO final: el fondo del campo del PERDEDOR, dentro de la cancha, a `inset` de la línea de fondo y de la
 * lateral. `side` = -1 / +1 (y menor / mayor). El que gana el duelo y golpea desde su lado manda el globo al campo contrario.
 */
export function lobTarget(winner: DuelWho, side: -1 | 1, court: { left: number; right: number }, latC: number, halfW: number, inset: number = NET_DUEL.lob.inset) {
  return {
    x: winner === 'player' ? court.right - inset : court.left + inset,
    y: latC + side * (halfW - inset),
  };
}

/** Espeja el lado de un aviso de red (cada teléfono ve la cancha del otro por la red y el eje lateral). */
export function mirrorSide(side: number): -1 | 1 {
  return side < 0 ? 1 : -1;
}
