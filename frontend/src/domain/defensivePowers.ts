/**
 * PODERES del DEFENSIVO (la habilidad que te lleva a la pelota cuando no llegas). Datos puros, sin Phaser.
 *
 * - DASH: el sprint de siempre. Es de todos y no se puede quitar.
 * - DESTELLO: te teletransportas hasta la pelota en un destello (estela de movimiento rápido) y devuelves con un
 *   revés. Se compra en la Tienda (ítem `defensive:blink`).
 * - Se elige en PERSONALIZACIÓN (tarjeta DEFENSIVO › PODERES) y se guarda en `PlayerState.equipped.defensive`.
 *   Todos usan el mismo botón y la misma recarga (DASH_COOLDOWN); solo cambia lo que hace al activarse.
 */
export type DefensivePower = 'dash' | 'blink';

export interface DefensivePowerDef {
  id: DefensivePower;
  name: string;
  desc: string;
  /** color de la interfaz (borde, texto) */
  color: number;
  css: string;
}

export const DEFENSIVE_POWERS: DefensivePowerDef[] = [
  { id: 'dash', name: 'DASH', desc: 'Sprint explosivo hasta donde llegará la pelota.', color: 0x8f7cff, css: '#cfc6ff' },
  { id: 'blink', name: 'DESTELLO', desc: 'Te teletransportas hasta la pelota en un destello y devuelves con un revés.', color: 0x45d9ff, css: '#9fecff' },
];

const IDS = new Set<string>(DEFENSIVE_POWERS.map((p) => p.id));

export function isDefensivePower(v: unknown): v is DefensivePower {
  return typeof v === 'string' && IDS.has(v);
}

/** Poder que se usa: el elegido (si es válido) o el DASH. */
export function defensivePowerOf(chosen: unknown): DefensivePower {
  return isDefensivePower(chosen) ? chosen : 'dash';
}

/** ¿Lo tiene el jugador? El DASH es de todos; el resto se compra en la Tienda (ítem `defensive:<poder>`). `owned` = PlayerState.owned. */
export function defensiveOwned(owned: readonly string[], id: DefensivePower): boolean {
  return id === 'dash' || owned.includes(`defensive:${id}`);
}

export function defensivePowerDef(id: DefensivePower): DefensivePowerDef {
  return DEFENSIVE_POWERS.find((p) => p.id === id) ?? DEFENSIVE_POWERS[0];
}
