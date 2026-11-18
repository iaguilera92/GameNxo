/**
 * PODERES del DEFENSIVO (la habilidad que te lleva a la pelota cuando no llegas). Datos puros, sin Phaser.
 *
 * - DASH: el sprint de siempre. Es de todos y no se puede quitar.
 * - DESTELLO: te teletransportas hasta la pelota en un destello (estela de movimiento rápido) y devuelves con un
 *   revés. Se compra en la Tienda (ítem `defensive:blink`).
 * - Se elige en PERSONALIZACIÓN (tarjeta DEFENSIVO › PODERES) y se guarda en `PlayerState.equipped.defensive`.
 *   Todos usan el mismo botón y la misma recarga (DASH_COOLDOWN); solo cambia lo que hace al activarse.
 */
export type DefensivePower = 'dash' | 'blink' | 'shadow' | 'jump' | 'flip' | 'skate' | 'lightning' | 'slowmo';

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
  // (Claude, 11-11-2026) los dos nuevos: también te dejan en el punto de la pelota y aseguran la devolución
  { id: 'shadow', name: 'SOMBRA', desc: 'Un clon de sombra corre hasta la pelota y cambias tu lugar con él para devolverla.', color: 0x9a6bff, css: '#d4bfff' },
  { id: 'jump', name: 'SUPERSALTO', desc: 'Un salto enorme hasta la pelota: caes con una onda de choque y la devuelves.', color: 0xff9a3d, css: '#ffd0a0' },
  // (12-11-2026) VOLTERETA y PATINAJE: lo mismo (te dejan en la pelota y devuelves) con otro movimiento, como una skin
  { id: 'flip', name: 'VOLTERETA', desc: 'Llegas a la pelota con dos volteretas laterales en arco, caes agachado y devuelves con un revés.', color: 0x5dff8a, css: '#c4ffd4' },
  { id: 'skate', name: 'PATINAJE', desc: 'Patinas hasta la pelota dejando un camino de hielo que se derrite.', color: 0xa6dcff, css: '#e6f7ff' },
  // (18-11-2026) RELÁMPAGO: DEFENSIVO ÉPICO (solo dinero real)
  { id: 'lightning', name: 'RELÁMPAGO', desc: 'Te vuelves azul neón y te conviertes en un rayo que llega a la pelota dejando una estela de rayos en el suelo; devuelves con un revés.', color: 0x2f9bff, css: '#bfe3ff' },
  // (18-11-2026) TIEMPO LENTO: DEFENSIVO LEGENDARIO (precio de toda legendaria)
  { id: 'slowmo', name: 'TIEMPO LENTO', desc: 'El tiempo se frena mientras corres a la pelota; al llegar, la cámara se acerca y la devuelves con una estirada y un golpe a máxima potencia.', color: 0x9be7ff, css: '#e3f8ff' },
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
