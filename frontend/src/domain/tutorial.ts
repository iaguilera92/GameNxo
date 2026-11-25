/**
 * TUTORIAL POR NIVEL (14-11-2026, decidido con el usuario). Datos puros, sin Phaser.
 *
 * Solo con el MODO DESARROLLO apagado. Un aviso corto, UNA sola vez por cuenta, la primera vez que el jugador entra al menú tras
 * alcanzar el nivel del paso. La marca de "ya visto" vive en `PlayerState.tutorial` (ids de pasos): va con la cuenta.
 * Los niveles con desbloqueo coinciden con domain/unlocks.ts; los demás enseñan mecánicas que no tienen candado.
 * Tabla completa y explicación: docs/TUTORIAL.md.
 */
import { UNLOCK_LEVEL } from './unlocks';

export interface TutorialStep {
  /** id estable (se guarda en la cuenta: no se cambia nunca) */
  id: string;
  /** nivel con el que aparece */
  level: number;
  title: string;
  /** lo que se desbloquea con este nivel (se ve como una banda "NUEVO"); ausente = sin desbloqueo */
  unlock?: string;
  /** páginas del aviso (texto corto cada una) */
  pages: string[];
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'l01-bienvenida',
    level: 1,
    title: 'BIENVENIDO',
    pages: [
      'Mueve a tu personaje con el joystick y golpea la pelota con un toque cuando llegue a ti.',
      'Para sacar, lanza la pelota y golpéala en el momento justo. Si aciertas, ¡SAQUE PERFECTO!',
      'Cada partida completada te da una ruleta y EXP. Sube de nivel para desbloquear habilidades.',
    ],
  },
  {
    id: 'l02-defensivo',
    level: UNLOCK_LEVEL.defensive,
    title: 'DEFENSIVO',
    unlock: 'DEFENSIVO (DASH)',
    pages: [
      'Cuando la pelota va lejos, pulsa el botón DEFENSIVO: te lleva hasta ella y devuelves seguro.',
      'Tiene recarga: úsalo en el momento justo. En la Tienda hay otros poderes defensivos.',
    ],
  },
  {
    id: 'l03-direcciones',
    level: 3,
    title: 'DIRECCIÓN DEL GOLPE',
    pages: ['Al golpear, el joystick decide hacia dónde va: abajo = cortita, arriba = globo, izquierda o derecha = a esa esquina.'],
  },
  {
    id: 'l04-especial',
    level: UNLOCK_LEVEL.special,
    title: 'ESPECIAL',
    unlock: 'ESPECIAL (SMASH)',
    pages: [
      'Pulsa ESPECIAL para armar tu golpe: el siguiente sale como una bola de poder.',
      'Si el rival la toca, sale despedido y queda aturdido. Tiene recarga. Más poderes en la Tienda.',
    ],
  },
  {
    id: 'l05-timing',
    level: 5,
    title: 'PERFECT TIMING',
    pages: ['Fíjate en el aro: si tocas justo cuando la pelota llega, el golpe es BIEN o PERFECTO. Los perfectos seguidos hacen una racha.'],
  },
  {
    id: 'l06-ulti',
    level: UNLOCK_LEVEL.ulti,
    title: 'ULTI',
    unlock: 'ULTI',
    pages: [
      'La ULTI se carga ganando puntos. Cuando está lista, el botón ESPECIAL cambia: púlsalo para lanzar tu golpe más espectacular.',
      'Si alcanza al rival, lo aturde y le hace perder la raqueta.',
    ],
  },
  {
    id: 'l07-globo',
    level: 7,
    title: 'GLOBO Y REMATE',
    pages: ['Si el rival te tira un globo, aparece un círculo en el suelo: colócate dentro y remata con un golpe fuerte.'],
  },
  {
    id: 'l08-estilos',
    level: UNLOCK_LEVEL.styles,
    title: 'ESTILOS DE COLOR',
    unlock: 'ESTILOS',
    pages: ['En PERSONAJE puedes cambiar el color de la ropa de tu personaje. Algunos estilos se ganan en el Pase de Batalla.'],
  },
  {
    id: 'l09-estirada-tienda',
    level: 9,
    title: 'ESTIRADA Y TIENDA',
    pages: [
      'Si la pelota está lejos, tu personaje se lanza a por ella: es la estirada.',
      'La TIENDA vende poderes. Los normales y especiales se compran con el dinero que ganas jugando; los demás, con dinero real.',
    ],
  },
  {
    id: 'l10-efecto-pelota',
    level: UNLOCK_LEVEL.trail,
    title: 'EFECTO PELOTA',
    unlock: 'EFECTO PELOTA',
    pages: ['Tu pelota puede dejar una estela de color. Se compra en la Tienda y se equipa en PERSONAJE.'],
  },
  {
    id: 'l11-duelo',
    level: 11,
    title: 'DUELO EN LA RED',
    pages: ['Cuando tú y el rival llegan a la red empieza un DUELO: toca en el momento justo para ganar la ronda.'],
  },
  {
    id: 'l12-cargando',
    level: UNLOCK_LEVEL.charge,
    title: 'CARGANDO GOLPE',
    unlock: 'CARGANDO GOLPE',
    pages: [
      'Mantén pulsado para cargar un golpe más fuerte.',
      'Con la carga al máximo, mueve el joystick: arriba lanza un GLOBO DISPARADO y abajo una DEJADA con efecto (DROP SHOT 0).',
    ],
  },
  {
    id: 'l13-poderes',
    level: 13,
    title: 'TUS PODERES',
    pages: ['En PERSONAJE cambias tu ESPECIAL, tu DEFENSIVO y tu ULTI por los que compres en la Tienda. Cada uno tiene su rareza.'],
  },
  {
    id: 'l14-pase',
    level: 14,
    title: 'PASE DE BATALLA',
    pages: ['El PASE da premios por jugar: gratis y premium. Toda la EXP que ganas lo llena.'],
  },
  {
    id: 'l15-zona',
    level: UNLOCK_LEVEL.zone,
    title: 'ZONA Y SAQUE CON EFECTO',
    unlock: 'ZONA y SAQUE CON EFECTO',
    pages: [
      'La ZONA te hace más fuerte durante un rato del partido. Mejora sus atributos con Rayos en PERSONAJE.',
      'Al sacar, el botón violeta saca con efecto: la pelota curva.',
    ],
  },
  {
    id: 'l16-ranked',
    level: 16,
    title: 'LIGA',
    pages: ['En la LIGA apuestas monedas: ganar paga el doble de la entrada. Tu puesto en la liga es lo que ganas en la semana: llega a la meta y el domingo subes de liga.'],
  },
  {
    id: 'l17-ligas',
    level: 17,
    title: 'LIGAS',
    pages: ['Cada semana que juegues al menos 3 partidas cobras el premio de tu liga. Cuanto más alto, mejor el premio.'],
  },
  {
    id: 'l18-rivales',
    level: 18,
    title: 'RIVALES MÁS FUERTES',
    pages: ['Cuanto más subes de nivel, más fuertes son tus rivales. Usa tus poderes con cabeza.'],
  },
  {
    id: 'l19-combinar',
    level: 19,
    title: 'COMBINA TUS PODERES',
    pages: ['DEFENSIVO, ESPECIAL y ULTI tienen recarga. Elige bien cuándo usar cada uno.'],
  },
  {
    id: 'l20-maximo',
    level: 20,
    title: '¡NIVEL MÁXIMO!',
    pages: ['Lo tienes todo desbloqueado. Ahora sube de liga y consigue todos los poderes de la Tienda.'],
  },
];

/**
 * (24-11-2026, usuario) REGALOS del tutorial: al llegar al nivel se le dan (si aún no los tiene). GRIS = color de ropa para todos sus personajes
 * (ítem `color:gris`); AZUL = estela de pelota. Los da `grantTutorialGifts` (domain/operations.ts).
 */
export const TUTORIAL_GIFTS: { level: number; item: string }[] = [
  { level: 8, item: 'color:gris' },
  { level: 10, item: 'style:blue' },
];

export const GUIDE = {
  welcome: 'guide-welcome',
  firstMatch: 'guide-first-match',
  defensive: 'guide-defensive',
  profile: 'guide-profile',
  spin: 'guide-spin',
  l3: 'guide-l3', // (25-11-2026, usuario) partido guiado del nivel 3: cortita, remate, ESPECIAL del rival
} as const;
export type GuidedMatch = 'first' | 'spin' | 'l3';
export const GUIDE_FIRST_WHEEL = 'guide-first-wheel';
export function guidedStep(level: number, seen: readonly string[] = []) {
  if (level === 1 && !seen.includes(GUIDE.firstMatch)) return 'play';
  if (!seen.includes(GUIDE.firstMatch)) return null;
  if (!seen.includes(GUIDE.defensive)) return 'defensive';
  if (!seen.includes(GUIDE.profile)) return 'profile';
  if (!seen.includes(GUIDE.spin)) return 'spin';
  return level === 3 && !seen.includes(GUIDE.l3) ? 'l3' : null;
}

/**
 * (24-11-2026, usuario) PROBAR TUTORIAL LVL (AJUSTES, solo modo desarrollo): lo que ya habría visto un jugador que llega al nivel `level`
 * jugando el tutorial entero (avisos de los niveles anteriores y los pasos guiados ya hechos). Al añadir pasos nuevos, que entren aquí.
 */
export function tutorialSeenBefore(level: number): string[] {
  const seen = TUTORIAL_STEPS.filter((s) => s.level < level).map((s) => s.id);
  if (level >= 2) seen.push(GUIDE.welcome, GUIDE.firstMatch);
  if (level >= 3) seen.push(GUIDE.defensive, GUIDE.profile, GUIDE.spin);
  if (level >= 4) seen.push(GUIDE.l3);
  return seen;
}

const IDS = new Set([...TUTORIAL_STEPS.map((s) => s.id), ...Object.values(GUIDE)]);

/** ¿Es el id de un paso que existe? (para validar lo guardado). */
export function isTutorialId(v: unknown): v is string {
  return typeof v === 'string' && IDS.has(v);
}

/** Primer paso con nivel <= `level` que aún no se vio (en orden de nivel); null = nada pendiente. */
export function pendingTutorial(level: number, seen: readonly string[] | undefined): TutorialStep | null {
  const done = new Set(seen ?? []);
  return TUTORIAL_STEPS.find((s) => s.level <= level && !done.has(s.id)) ?? null;
}
