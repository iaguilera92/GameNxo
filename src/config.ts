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




