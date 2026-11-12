/**
 * DESBLOQUEO DE HABILIDADES POR NIVEL (datos puros, sin Phaser). Decidido con el usuario el 11-11-2026.
 *
 *   DEFENSIVO (DASH / DESTELLO)  nivel 2
 *   ESPECIAL (SMASH)             nivel 4
 *   ULTI (INFERNO DRIVE)         nivel 6
 *   ESTILOS (color personaje)    nivel 8
 *   EFECTO PELOTA (estela)       nivel 10
 *   CARGANDO GOLPE               nivel 12   (antes: el toque golpea sin cargar)
 *   ZONA                         nivel 15
 *   SAQUE CON EFECTO             nivel 15   (antes: solo el saque normal)
 * (niveles de defensivo a zona: decididos con el usuario el 11-11-2026, segunda vuelta)
 *
 * Con el MODO DESARROLLO activado el perfil de pruebas está en nivel 20 (domain/devMode.ts): todo queda abierto. Con el modo
 * apagado se aplica el nivel real del jugador.
 */
export const UNLOCK_LEVEL = {
  defensive: 2,
  special: 4,
  ulti: 6,
  styles: 8,
  trail: 10,
  charge: 12,
  zone: 15,
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
