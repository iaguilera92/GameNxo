/**
 * PROTOCOLO Socket.IO de NxoGames (multijugador 1v1). Nombres de eventos y forma de sus datos.
 *
 * ESTE ARCHIVO ESTÁ DUPLICADO en frontend/src/net/protocol.ts (cliente y servidor son proyectos
 * independientes). Si cambias uno, copia el otro: deben ser idénticos. Documentación: docs/MULTIJUGADOR.md
 *
 * Modelo de sincronización: "autoridad por posesión".
 *  - Cada teléfono ejecuta el motor de siempre (MatchScene) con SU jugador abajo y el rival como "bot" sin IA.
 *  - Al golpear (o sacar), el cliente envía la pelota resultante (HIT). El otro la aplica como un golpe del rival.
 *  - La pelota en juego tiene UN juez: el cliente que la RECIBE. Él decide punto / falta / let y lo avisa (POINT).
 *  - El servidor reenvía los mensajes, lleva el marcador OFICIAL con los POINT y declara el final (OVER).
 * Coordenadas: cada cliente envía las suyas (su jugador abajo); el receptor las espeja (ver frontend/src/net/mirror.ts).
 */

export const EV = {
  // ---- cliente -> servidor
  /** buscar rival (pulsar JUGAR = listo para jugar) */
  FIND: 'mm:find',
  /** cancelar la búsqueda */
  CANCEL: 'mm:cancel',
  /** la escena del partido ya cargó (cuando están los dos, el servidor manda START) */
  READY: 'game:ready',
  /** volver a un partido tras un corte (data: ResumeRequest) */
  RESUME: 'game:resume',
  /** LOG de diagnóstico del partido (data: { e: [ {ev, ...} ] }): solo lo guarda el servidor, no se reenvía */
  LOG: 'game:log',
  /** estado del propio jugador (~20 Hz): se reenvía al rival */
  STATE: 'game:state',
  /** golpe / saque propio con la pelota resultante: se reenvía al rival */
  HIT: 'game:hit',
  /** acciones visuales y de habilidades (lanzamiento, DASH, carga…): se reenvía al rival */
  ACTION: 'game:action',
  /** el juez de la pelota avisa un punto / falta / let: marcador oficial en el servidor + rival */
  POINT: 'game:point',
  /** rendición / salir del partido */
  LEAVE: 'game:leave',

  // ---- servidor -> cliente
  SEARCHING: 'mm:searching',
  MATCHED: 'mm:matched',
  TIMEOUT: 'mm:timeout',
  CANCELLED: 'mm:cancelled',
  ERROR: 'mm:error',
  START: 'game:start',
  OPPONENT_LEFT: 'game:opponent-left',
  /** el rival se cortó: el partido queda en pausa mientras reconecta (como mucho RECONNECT_GRACE_MS) */
  OPPONENT_AWAY: 'game:opponent-away',
  /** el rival volvió (data: ScoreMsg oficial): se rejuega el punto en curso */
  OPPONENT_BACK: 'game:opponent-back',
  /** reconexión aceptada (data: ResumedMsg) */
  RESUMED: 'game:resumed',
  SCORE: 'game:score',
  OVER: 'game:over',
} as const;

/** rol en la sala: host = quien la creó (saca el primer juego), guest = quien se unió */
export type Role = 'host' | 'guest';

export interface PlayerProfile {
  name: string;
  level: number;
  skin: string;
  zoneStats?: { strength: number; speed: number; precision: number; agility: number; resistance: number };
  /** efecto de carga elegido: classic | fire | energy | tulip (sin él, el rival usa el de su personaje) */
  charge?: string;
  /** ESTILO DE COLOR del personaje (azul, verde…; sin él o 'classic' = colores de siempre) */
  color?: string;
  /** victorias totales del jugador (se muestran bajo su nombre en la pantalla VS; sin dato o 0 = no se muestra) */
  wins?: number;
}

export interface FindRequest {
  profile: PlayerProfile;
}

export interface SearchingMsg {
  roomId: string;
  /** ms hasta que el servidor cancele la búsqueda */
  timeoutMs: number;
  players: number;
}

export interface MatchedMsg {
  roomId: string;
  role: Role;
  opponent: PlayerProfile;
  /** reglas del partido (las mismas que el modo BOT) */
  gamesToWin: number;
  /** clave para reconectar a esta sala si se corta la conexión (game:resume) */
  token?: string;
}

/** Reconexión: la sala y la clave que dio el emparejamiento. */
export interface ResumeRequest {
  roomId: string;
  token: string;
}

/** Reconexión aceptada: marcador oficial (se rejuega el punto en curso desde él). */
export interface ResumedMsg {
  score: ScoreMsg;
}

export interface ErrorMsg {
  code: 'already_searching' | 'already_in_room' | 'invalid' | 'not_in_room' | 'maintenance';
  message: string;
}

/** Pelota (estado físico completo) en coordenadas del emisor. */
export interface BallWire {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  /** amortiguación / fricción especiales (dejada muerta); 0 = normales */
  damp?: number;
  fric?: number;
  /** aceleración lateral del saque con efecto (curva en el aire); el receptor la espeja */
  ay?: number;
  /** gravedad propia de este vuelo (globo disparado); el receptor la usa tal cual */
  g?: number;
}

/** Estado del propio jugador (coordenadas del emisor). */
export interface StateMsg {
  t: number;
  x: number;
  y: number;
  moving: boolean;
  dirX: number;
  facing: number;
  charging: boolean;
  stunned: boolean;
  /**
   * Punto al que pertenece el estado: 2·puntos jugados + 1 si el emisor ya se colocó para el saque de ese punto.
   * El receptor descarta los estados de un punto anterior (el rival "volvía corriendo" al empezar cada punto).
   */
  pt?: number;
}

export type HitKind = 'hit' | 'serve';

export interface HitMsg {
  seq: number;
  /** hora del golpe en el reloj del emisor (el de StateMsg.t): el receptor compensa lo que tardó en llegar */
  t?: number;
  kind: HitKind;
  ball: BallWire;
  /** posición del que golpea en el momento del golpe */
  x: number;
  y: number;
  /** tipo visual de golpe (normal, side, lob, drop) */
  shotKind: string;
  /** bola de fuego (SMASH / INFERNO): al recibirla se aplica el impacto de siempre */
  power: boolean;
  inferno: boolean;
  charged: boolean;
  /** animación: remate por arriba / volea (valores REALES del golpe del emisor) */
  overhead: boolean;
  volley: boolean;
  /** remate con salto (SMASH o remate del globo en el círculo) y choque eléctrico de la carga al 100 %: el receptor los repite */
  special?: boolean;
  shock?: boolean;
  /** saque con efecto (violeta); en saques normales no viene */
  serveSpin?: boolean;
  /** estirada: lado hacia el que se tira, en las coordenadas del EMISOR (+1 / -1); el receptor lo espeja */
  lunge?: number;
  /** devolución del impacto de una bola de fuego: el emisor está aturdido, el receptor NO anima un golpe */
  impact?: boolean;
}

/**
 * Acciones visuales y de habilidades (no cambian la pelota ni el marcador):
 *  toss / catch                 lanzamiento del saque / lo atrapa sin golpear
 *  sprint-start / sprint-end    DASH del emisor (data: dirX)
 *  stunned                      el emisor quedó aturdido por una bola de fuego (data: ms, kind = smash | inferno)
 *  duel-start / duel-tap / duel-round / duel-result / duel-aim   DUELO RED: el juez (el que recibe la pelota) lo empieza (data: x, y, a, b, c = golpes del peloteo de cada ronda) · error en ms de cada toque contra el cierre de SU aro (r, ms) · resultado de cada ronda (r, w: 1 = ganó el jugador del emisor, 2 = su rival, 0 = empate; p, b = errores en ms, 9999 = sin toque) · ganador del duelo (w = 1: el emisor) · lado del globo (side = -1 | 1)
 *  bump                         el emisor recibió un golpe cargado al máximo y retrocede un poco (data: ms)
 *  emote                        carita del chat (data: kind = happy | cool | wow)
 *  smash-armed / smash-disarmed el emisor arma / consume su SMASH (aura en el rival)
 *  smash-cine                   empieza la cinemática del SMASH del emisor (data: x, y, overhead, ms)
 *  inferno-cine                 empieza la cinemática del INFERNO del emisor (data: x, y, tx, ty, ms, power)
 *  defensive                    SOMBRA / SUPERSALTO / DESTELLO / teletransporte del emisor (data: kind = shadow | jump | blink | warp, x, y, tx, ty, ms | out, in, delay)
 *  racket                       raqueta del emisor tras recibir la ULTI (data: lost = true + x, y donde cae · lost = false: la recogió)
 *  timing                       nota del golpe del emisor (data: grade = perfect | good | early | late, streak, ms)
 *  lunge                        el emisor empieza su ESTIRADA (data: side, x, y, tx, ty, ms)
 *  serve-swing                  el emisor golpea su saque (del lanzamiento al golpe, con su salto)
 *  remate-start / remate-end    el emisor empieza a rematar un globo (data: slow = cámara lenta, t = s de juego hasta el contacto) / golpea
 */
export type ActionKind =
  | 'racket'
  | 'sky-launch'
  | 'remate-start'
  | 'remate-end'
  | 'serve-swing'
  | 'lunge'
  | 'timing'
  | 'ping'
  | 'pong'
  | 'toss'
  | 'catch'
  | 'sprint-start'
  | 'sprint-end'
  | 'stunned'
  | 'bump'
  | 'duel-start'
  | 'duel-tap'
  | 'duel-round'
  | 'duel-result'
  | 'duel-aim'
  | 'emote'
  | 'smash-armed'
  | 'smash-disarmed'
  | 'smash-cine'
  | 'inferno-cine'
  | 'defensive';

export interface ActionMsg {
  kind: ActionKind;
  /** datos según la acción (coordenadas en las del EMISOR; el receptor las espeja) */
  data?: Record<string, number | string | boolean>;
}

export type PointKind = 'point' | 'fault' | 'let';

export interface PointMsg {
  seq: number;
  kind: PointKind;
  /** a quién va el punto, desde el punto de vista del EMISOR */
  to: 'me' | 'opponent';
  reason: string;
  color: string;
  /** marcador del emisor tras aplicar el punto (para validar) */
  games?: [number, number];
}

export interface ScoreMsg {
  /** marcador oficial (por rol) */
  points: { host: number; guest: number };
  games: { host: number; guest: number };
}

export interface OverMsg {
  winner: Role;
  reason: 'score' | 'abandon' | 'disconnect' | 'timeout';
  games: { host: number; guest: number };
}

export interface OpponentLeftMsg {
  reason: 'abandon' | 'disconnect';
}
