// ===== Constantes de juego ajustables =====

export const GAME_NAME = 'GAME NXO';

/**
 * Personajes con imágenes (public/assets/characters):
 *  - 'auto' cada vista usa imágenes si tiene cuerpo + brazo; si no, el personaje vectorial
 *  - 'off'  siempre personajes vectoriales (también con ?skins=off en la URL, para comparar)
 */
export const CHARACTER_SKINS: 'auto' | 'off' = 'auto';

/** Dificultad del bot: 0 = muy fácil, 1 = muy difícil. */
export const BOT_DIFFICULTY = 0.45;

/** Juegos necesarios para ganar el partido (mejor de 3 => 2). */
export const GAMES_TO_WIN = 2;

/**
 * Regla de iguales (40-40):
 *  - false: ventaja simplificada (Ventaja -> Juego, o vuelve a Iguales).
 *  - true: "punto de oro" (el siguiente punto gana el juego).
 */
export const GOLDEN_POINT = false;

// Habilidades
/** Dash: el jugador desaparece y reaparece donde llegará la pelota. */
export const DASH_COOLDOWN = 10; // s
/** Smash de fuego: si el rival llega a la bola, sale despedido y queda aturdido. */
export const SMASH_COOLDOWN = 30; // s
export const SMASH_SPEED_MULT = 1.75;
export const STUN_DURATION = 1.0; // s
export const KNOCKBACK_DIST = 110; // en profundidad de cancha

// Progresión
export const MAX_LEVEL = 30;
export const XP_WIN = 60;
export const XP_LOSS = 25;
/** XP necesaria para pasar del nivel `lvl` al siguiente. */
export const xpToNext = (lvl: number) => 100 + (lvl - 1) * 50;

// Cancha en coordenadas lógicas (x = largo: jugador en x pequeños, rival en x grandes;
// y = ancho). La vista vertical en perspectiva se calcula en src/view/projection.ts.
export const COURT = {
  left: 170,
  right: 1110,
  top: 230,
  bottom: 590,
};
/** Pasillos de dobles a cada lado de la cancha de individuales (1.37 m de 8.23 m). */
export const ALLEY = 60;
export const NET_X = (COURT.left + COURT.right) / 2;
export const NET_HEIGHT = 34; // altura de la red en "z"

// Física
export const GRAVITY = 950; // en eje z
export const BOUNCE_DAMP = 0.62;
export const SHOT_SPEED = 640; // velocidad horizontal base del golpe
export const SERVE_SPEED = 580;

// Jugadores
export const PLAYER_SPEED = 330;
export const HIT_RANGE = 78; // radio de alcance de la raqueta (suelo)
export const HIT_MAX_Z = 135; // altura máxima alcanzable
/** Estirada (solo cargando): alcance ampliado para llegar 'in extremis' con un globo. */
export const LUNGE_RANGE = HIT_RANGE * 1.9;
export const LUNGE_MAX_Z = HIT_MAX_Z * 1.15;
/** Tiempo (s) que el jugador tarda en recuperarse tras estirarse. */
export const LUNGE_RECOVER = 0.45;
/** Límites de movimiento lateral (más allá de las líneas laterales). */
export const SIDE_MARGIN = 50;





/**
 * Saque manual (ver src/logic/ServeController.ts). Todos los tiempos en segundos desde el lanzamiento.
 * La pelota usa la física normal (GRAVITY): con tossVz = 680 sube ~0,72 s hasta su punto más alto.
 */
export const SERVE = {
  /** Velocidad vertical del lanzamiento. Define la altura máxima y el tiempo hasta ella. */
  tossVz: 680,
  /** Tras lanzar se ignora la 2ª pulsación este tiempo (evita doble toque / saque accidental). */
  tossLock: 0.12,
  /** Ventana de saque perfecto alrededor del punto más alto (dura before + after ≈ 0,8 s; se ilumina el botón). */
  perfectBefore: 0.4,
  perfectAfter: 0.4,
  /** El saque con efecto es más exigente: la ventana se reduce a esta fracción. */
  spinWindowScale: 0.7,
  /** Altura de contacto alcanzable. Con la pelota subiendo hace falta más altura (brazo extendido). */
  reachMinZ: 95,
  reachMinRisingZ: 240,
  reachMaxZ: 340,
  /** Por debajo de esta altura (pelota cayendo) el contacto es débil. */
  weakBelowZ: 170,
  /** Contacto con la pelota ya muy baja (cayendo): la manda a la red y se pierde el punto. */
  lowHitZ: 140,
  /** Si la pelota lanzada baja hasta esta altura sin golpearla, el jugador la atrapa y puede reintentar. */
  catchZ: 75,
  /** Tiempo total (s) para sacar; si se agota es falta. No se reinicia al atrapar la pelota. */
  timeLimit: 5,
  /** Tras sacar, DASH y SMASH quedan bloqueados este tiempo (s) para no pulsarlos por error. */
  abilityLock: 1.5,
  /** Multiplicador de velocidad (sobre SERVE_SPEED) según calidad; [primer saque, segundo saque]. */
  speed: { perfect: [1.3, 1.05], normal: [1.1, 0.88], weak: [0.9, 0.75] },
  /** El saque con efecto es algo más lento. */
  spinSpeedMult: 0.9,
  /** Error de ejecución (fracción del cuadro de saque, desviación típica): lateral y de profundidad. */
  error: { perfect: [0.03, 0.04], normal: [0.13, 0.13], weak: [0.26, 0.24] },
  /** Probabilidad de golpe defectuoso (sale más bajo: red / let / corto) y cuánta velocidad vertical pierde. */
  flawChance: { perfect: 0, normal: 0.06, weak: 0.3 },
  flawDrop: [150, 290],
  /** Profundidad objetivo dentro del cuadro (0 = red, 1 = línea de saque). */
  depth: { normal: 0.76, spin: 0.7 },
  /** Aceleración lateral del saque con efecto (px/s²) y su "patada" al botar (ver stepBall). */
  spinAy: 260,
  /** Zona de cinta de la red: un saque que roza la red por encima y cae bien es let. */
  letBand: 8,
  /** El jugador se mueve más despacio mientras se coloca para sacar (fracción de PLAYER_SPEED). */
  positionSpeed: 0.8,
};

/** Saque del rival (IA): probabilidades y tiempos. Las decisiones están en src/logic/ServeAI.ts. */
export const BOT_SERVE = {
  /** Espera antes de lanzar (s). */
  waitMin: 0.9,
  waitMax: 1.5,
  /** Probabilidad de elegir saque con efecto [primer saque, segundo saque]. */
  spinChance: [0.3, 0.55],
  /** Probabilidad de intentar el saque perfecto [primer saque, segundo saque] (se suma 0.2·dificultad). */
  perfectChance: [0.2, 0.1],
  /** Probabilidad de fallar el golpe en vacío (muy baja). */
  whiffChance: [0.03, 0.01],
};
