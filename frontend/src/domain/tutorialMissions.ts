/**
 * (24-11-2026, usuario) MISIONES DEL TUTORIAL (datos puros, sin Phaser). Solo existen en los partidos del tutorial; cada nivel tiene las suyas,
 * acordes a lo que enseña o desbloquea, y NUNCA más de 4 por partido. Las ids son fijas (van a la cuenta como progreso): no se cambian nunca.
 * Las que se repiten entre niveles (usa el DEFENSIVO, haz un PERFECTO…) comparten id.
 *
 * Obligatorias solo en los niveles que traen su ejercicio guiado (1 a 4, `required`): allí, si el jugador no lo logra en 10 s, el juego lo hace
 * por él y la misión cuenta igual; el nivel no sube sin todas. En el resto son un premio extra (no bloquean), hasta tener su ejercicio.
 * "Gana el partido" solo hasta el nivel 9 (allí se gana siempre). Premios moderados (usuario: "que no se desfasen"): 10 o 15 monedas, menos
 * que ganar el partido (50).
 */
export type TutorialMissionId =
  | 'tWin'
  | 't02Def'
  | 't02DefReturn'
  | 't02Lob'
  | 't03Left'
  | 't03Right'
  | 't03Drop'
  | 't04Arm'
  | 't04Stun'
  // (24-11-2026) niveles 5 a 15
  | 'tGood'
  | 'tPerfect'
  | 'tStreak2'
  | 'tUlti'
  | 'tRacket'
  | 'tRemate'
  | 'tSpecial'
  | 'tDef'
  | 'tDive'
  | 'tTeamPoint'
  | 'tPoints3'
  | 'tDuel'
  | 'tCharge'
  | 'tChargedLob'
  | 'tDrop0'
  | 'tSpinServe'
  | 'tZone';

/** regla del usuario: como mucho 4 misiones por partido */
export const TUTORIAL_MISSIONS_MAX = 4;

export const TUTORIAL_MISSION_DEFS: Record<TutorialMissionId, { title: string; coins: number }> = {
  tWin: { title: 'Gana el partido', coins: 10 },
  t02Def: { title: 'Defensivo', coins: 10 }, // (25-11-2026, usuario) antes 'Usa el DEFENSIVO'
  t02DefReturn: { title: 'Devuélvela', coins: 10 },
  t02Lob: { title: 'Haz un globo', coins: 10 },
  t03Left: { title: 'A la izquierda', coins: 10 },
  t03Right: { title: 'A la derecha', coins: 10 },
  t03Drop: { title: 'Drop shot', coins: 10 }, // (25-11-2026, usuario) antes 'Cortita'
  t04Arm: { title: 'Arma el ESPECIAL', coins: 10 },
  t04Stun: { title: 'Aturde al rival', coins: 15 },
  tGood: { title: 'Golpe BIEN', coins: 10 },
  tPerfect: { title: 'Golpe PERFECTO', coins: 10 },
  tStreak2: { title: '2 PERFECTOS seguidos', coins: 15 },
  tUlti: { title: 'Lanza la ULTI', coins: 10 },
  tRacket: { title: 'Rival sin raqueta', coins: 15 },
  tRemate: { title: 'Remata un globo', coins: 15 },
  tSpecial: { title: 'Usa el ESPECIAL', coins: 10 },
  tDef: { title: 'Usa el DEFENSIVO', coins: 10 },
  tDive: { title: 'Haz una estirada', coins: 15 },
  tTeamPoint: { title: 'Punto de tu compañero', coins: 10 },
  tPoints3: { title: 'Gana 3 puntos', coins: 10 },
  tDuel: { title: 'Gana un Duelo', coins: 15 },
  tCharge: { title: 'Golpe cargado', coins: 10 },
  tChargedLob: { title: 'Globo disparado', coins: 15 },
  tDrop0: { title: 'DROP SHOT 0', coins: 15 },
  tSpinServe: { title: 'Saca con efecto', coins: 10 },
  tZone: { title: 'Entra en ZONA', coins: 15 },
};

/** Misiones del partido del tutorial de cada nivel (orden de las cards). 16 a 19: las normales (partidos completos). */
const BY_LEVEL: Record<number, string[]> = {
  1: ['guideJoystick', 'guideJoystickUpDown', 'guideDirectServe', 'tWin'], // primer partido guiado
  2: ['t02Def', 't02Lob', 'tWin'], // DEFENSIVO y globo (25-11-2026, usuario: sin Devuélvela, repetía el DEFENSIVO)
  3: ['t03Drop', 'tRemate', 'tWin'], // (25-11-2026, usuario) cortita, remate en la red (el ESPECIAL del rival no es misión)
  4: ['t04Arm', 't04Stun', 'tWin'], // ESPECIAL
  5: ['tGood', 'tPerfect', 'tStreak2', 'tWin'], // PERFECT TIMING
  6: ['tUlti', 'tRacket', 'tWin'], // ULTI
  7: ['tRemate', 'tSpecial', 'tWin'], // globo del rival y remate
  8: ['tCharge', 'tChargedLob', 'tDrop0'], // CARGANDO GOLPE (25-11-2026: antes en el 12)
  9: ['tDive', 'tUlti', 'tWin'], // estirada
  10: ['tTeamPoint', 'tPoints3', 'tSpecial'], // 2v2
  11: ['tDuel', 'tDef', 'tSpecial'], // Duelo en la Red
  12: ['tPerfect', 'tDef', 'tWin'], // partido libre
  13: ['tDef', 'tSpecial', 'tUlti'], // tus poderes
  14: ['tTeamPoint', 'tUlti', 'tPoints3'], // Pase (partido 2v2)
  15: ['tSpinServe', 'tPerfect', 'tWin'], // saque con efecto y ESTILOS (la ZONA pasó al 10)
};

/** niveles cuyo partido trae ejercicio guiado: allí las misiones son obligatorias para subir */
export const TUTORIAL_REQUIRED_LEVELS = new Set([1, 2, 3, 4]);

export function isTutorialMissionId(v: string): v is TutorialMissionId {
  return v in TUTORIAL_MISSION_DEFS;
}

/** Misiones del tutorial de un nivel; null = ese nivel usa las normales. */
export function tutorialMissionsFor(level: number): string[] | null {
  const list = BY_LEVEL[level];
  if (!list) return null;
  if (list.length > TUTORIAL_MISSIONS_MAX) throw new Error(`nivel ${level}: más de ${TUTORIAL_MISSIONS_MAX} misiones`);
  return [...list];
}
