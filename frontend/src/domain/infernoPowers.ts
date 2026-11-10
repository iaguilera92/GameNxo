/**
 * PODERES del INFERNO DRIVE: la bola que lanza el golpe (fuego, hielo, viento, rayo). Datos puros, sin Phaser.
 *
 * - Todos están disponibles para todos (sin desbloqueo por ahora). Se elige en PERSONALIZACIÓN y se guarda en
 *   `PlayerState.equipped.inferno`.
 * - Sin elegir, cada personaje usa el suyo: Mai = hielo; el resto = fuego.
 * - Solo cambia cómo se ve la bola y sus efectos (fx/InfernoFx.ts, fx/ImpactFx.ts); el golpe es el mismo.
 */
export type InfernoPower = 'fire' | 'ice' | 'wind' | 'lightning';

export interface InfernoPowerDef {
  id: InfernoPower;
  /** nombre corto (selector) */
  name: string;
  /** nombre de la bola (tarjeta) */
  ball: string;
  desc: string;
  /** color de la interfaz (borde, texto) */
  color: number;
  css: string;
}

export const INFERNO_POWERS: InfernoPowerDef[] = [
  { id: 'fire', name: 'FUEGO', ball: 'BOLA DE FUEGO', desc: 'Un golpe de fuego devastador.', color: 0xff6a2a, css: '#ffbc55' },
  { id: 'ice', name: 'HIELO', ball: 'BOLA DE HIELO', desc: 'Un remolino de hielo cristalino.', color: 0x45b8ff, css: '#9fe2ff' },
  { id: 'wind', name: 'VIENTO', ball: 'BOLA DE VIENTO', desc: 'Un torbellino de viento y hojas.', color: 0x3fd68a, css: '#9cf5c2' },
  { id: 'lightning', name: 'RAYO', ball: 'BOLA DE RAYO', desc: 'Una esfera de energía eléctrica.', color: 0xffd23f, css: '#ffe36b' },
];

const IDS = new Set<string>(INFERNO_POWERS.map((p) => p.id));
/** Poder de cada personaje (id del catálogo) cuando el jugador no eligió otro. */
const DEFAULT_BY_SKIN: Record<string, InfernoPower> = { mai: 'ice' };

export function isInfernoPower(v: unknown): v is InfernoPower {
  return typeof v === 'string' && IDS.has(v);
}

/** Poder que se usa: el elegido (si es válido) o, si no hay, el del personaje `skin`. */
export function infernoPowerOf(chosen: unknown, skin?: string): InfernoPower {
  if (isInfernoPower(chosen)) return chosen;
  return (skin && DEFAULT_BY_SKIN[skin]) || 'fire';
}

export function infernoPowerDef(id: InfernoPower): InfernoPowerDef {
  return INFERNO_POWERS.find((p) => p.id === id) ?? INFERNO_POWERS[0];
}
