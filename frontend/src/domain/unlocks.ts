/**
 * DESBLOQUEO DE HABILIDADES POR NIVEL (datos puros, sin Phaser). Decidido con el usuario el 11-11-2026.
 *
 *   DEFENSIVO (DASH / DESTELLO)  nivel 2
 *   ESPECIAL (SMASH)             nivel 3
 *   ULTI (INFERNO DRIVE)         nivel 5
 *   ZONA                         nivel 10
 *   CARGANDO GOLPE               nivel 12   (antes: el toque golpea sin cargar)
 *   EFECTO PELOTA (saque efecto) nivel 15   (antes: solo el saque normal)
 *
 * Con el MODO DESARROLLO activado el perfil de pruebas está en nivel 20 (domain/devMode.ts): todo queda abierto. Con el modo
 * apagado se aplica el nivel real del jugador.
 */
export const UNLOCK_LEVEL = {
  defensive: 2,
  special: 3,
  ulti: 5,
  zone: 10,
  charge: 12,
  spin: 15,
} as const;

export type UnlockKey = keyof typeof UNLOCK_LEVEL;

export function isUnlocked(key: UnlockKey, level: number): boolean {
  return level >= UNLOCK_LEVEL[key];
}

/** Texto corto del bloqueo para la interfaz: "NIVEL 12". */
export function unlockLabel(key: UnlockKey): string {
  return `NIVEL ${UNLOCK_LEVEL[key]}`;
}
