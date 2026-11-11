/**
 * PODERES del ESPECIAL (la habilidad SMASH): cómo se ve la pelota prendida y su golpe. Datos puros, sin Phaser.
 *
 * - FUEGO es el de siempre y es de todos. HIELO (y luego RAYO) se compran en la Tienda (dinero o CLP).
 * - Se elige en PERSONALIZACIÓN (tarjeta SMASH → PODERES) y se guarda en `PlayerState.equipped.smash`.
 * - Cambia lo que se ve: la pelota, su estela, el aura al armarlo, la cinemática del golpe y el impacto. El golpe es el mismo
 *   (misma potencia, mismo aturdido). Lo ve también el rival en el 1v1 (acciones `smash-armed` / `smash-cine`, `data.element`).
 */
export type SmashPower = 'fire' | 'ice';

export interface SmashPowerDef {
  id: SmashPower;
  name: string;
  /** nombre de la pelota (tarjeta de la Tienda) */
  ball: string;
  desc: string;
  /** color de la interfaz (borde, texto) */
  color: number;
  css: string;
}

export const SMASH_POWERS: SmashPowerDef[] = [
  { id: 'fire', name: 'FUEGO', ball: 'SMASH DE FUEGO', desc: 'Bola de fuego con humo oscuro. Si el rival la toca, sale despedido.', color: 0xff6a2a, css: '#ffbc55' },
  { id: 'ice', name: 'HIELO', ball: 'SMASH DE HIELO', desc: 'Pelota helada con bruma de escarcha y cristales. Si el rival la toca, sale despedido.', color: 0x45b8ff, css: '#9fe2ff' },
];

const IDS = new Set<string>(SMASH_POWERS.map((p) => p.id));

export function isSmashPower(v: unknown): v is SmashPower {
  return typeof v === 'string' && IDS.has(v);
}

/** Poder que se usa: el elegido (si es válido) o el fuego de siempre. */
export function smashPowerOf(chosen: unknown): SmashPower {
  return isSmashPower(chosen) ? chosen : 'fire';
}

export function smashPowerDef(id: SmashPower): SmashPowerDef {
  return SMASH_POWERS.find((p) => p.id === id) ?? SMASH_POWERS[0];
}

/** ¿Lo tiene el jugador? FUEGO es de todos; el resto se compra en la Tienda (ítem `smash:<poder>`). */
export function smashOwned(owned: readonly string[], id: SmashPower): boolean {
  return id === 'fire' || owned.includes(`smash:${id}`);
}
