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
  /** (25-11-2026, usuario) el PASE DE BATALLA: antes no recibe EXP ni la anima el menú */
  pass: 5, // (26-11-2026, usuario) se muestra en el nivel 5 (suma EXP desde el primer partido)
  special: 4,
  ulti: 6,
  // (25-11-2026, usuario) CARGANDO GOLPE pasa al 8 (antes 12), ZONA al 10 (antes 15) y ESTILOS al 15 (antes 8)
  styles: 15,
  trail: 12, // (25-11-2026, usuario) antes 10
  charge: 8,
  zone: 10,
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
