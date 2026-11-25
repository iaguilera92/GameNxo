/**
 * (24-11-2026, usuario) REGLAS DEL PARTIDO DEL TUTORIAL (datos puros, sin Phaser). Plan completo: docs/TUTORIAL-PLAN.md.
 *
 * - Partido del tutorial = contra el bot (1v1 o 2v2 sin red), con el MODO DESARROLLO apagado y la cuenta por debajo del nivel 20.
 * - Un partido ganado = un nivel: da justo la EXP que falta para el siguiente nivel.
 * - Sin rendirse (ni AUTO): el botón no aparece. Si se cierra la app a mitad, el partido no se guarda y se juega de nuevo.
 * - Hasta el nivel 9, en los puntos libres el bot falla más cuanto mejor va.
 * - (25-11-2026, usuario) Hay que GANAR (a 4 puntos): si se pierde, el nivel se repite sin EXP ni premios (MatchEndScene). Los puntos
 *   guiados también suman al marcador.
 */
import { MAX_LEVEL, xpToNext } from '../config';

/** último nivel en que el partido del tutorial se gana siempre */
export const TUTORIAL_WIN_GUARD_LEVEL = 9;

/** Tiempos del entrenador del partido (tutorial/MatchCoach.ts): la pausa sigue sola y el ejercicio se hace solo si no lo logra. */
export const COACH = {
  /** la pausa con explicación sigue sola pasado este tiempo (si no se toca ENTENDIDO) */
  autoResumeMs: 6000,
  /** tiempo para hacer el ejercicio; pasado, el personaje lo hace solo */
  tryMs: 10000,
};

/** ¿Es un partido del tutorial? (`net` = partido en red, que nunca lo es) */
export function isTutorialMatch(level: number, devMode: boolean, net: boolean): boolean {
  return !devMode && !net && level < MAX_LEVEL;
}

/** ¿El partido de este nivel se gana siempre? */
export function tutorialWinGuard(level: number): boolean {
  return level <= TUTORIAL_WIN_GUARD_LEVEL;
}

/**
 * Probabilidad de que el bot tire FUERA su próximo golpe (solo en los partidos que se ganan siempre y en los puntos libres): nada si el
 * jugador va ganando, la mitad empatados, siempre si el bot va ganando.
 */
export function botForcedOutChance(level: number, playerPoints: number, botPoints: number): number {
  if (!tutorialWinGuard(level)) return 0;
  if (botPoints > playerPoints) return 1;
  return botPoints === playerPoints ? 0.5 : 0;
}

/** EXP que falta para subir un nivel (lo que da un partido del tutorial). */
export function xpToLevelUp(level: number, xp: number): number {
  return level >= MAX_LEVEL ? 0 : Math.max(0, xpToNext(level) - xp);
}
