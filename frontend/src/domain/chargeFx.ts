/**
 * EFECTOS DE CARGA ("cargando golpe"): lo que se ve en el suelo bajo el jugador mientras mantiene la carga de un golpe
 * (la barra de potencia sobre su cabeza no cambia). Datos puros, sin Phaser.
 *
 * - CLÁSICO: el aro y el brillo dibujados por código (fx/shotFx.ts). Lo tienen todos y no se puede quitar: es el de siempre.
 * - FUEGO, ENERGÍA, HIELO, TULIPÁN, RAYO, SOMBRA, VIENTO, LUZ, GLITCH y TIEMPO: hojas de sprites (fx/chargeFx.ts). Se compran en la Tienda; además cada personaje trae el
 *   suyo: Nxo = fuego, Mai = tulipán.
 * - Se elige en PERSONALIZACIÓN y se guarda en `PlayerState.equipped.charge`. Sin elegir se usa el del personaje.
 * - Solo cambia cómo se ve la carga; no cambia el tiempo de carga ni la potencia.
 */
export type ChargeFxId = 'classic' | 'fire' | 'energy' | 'hielo' | 'tulip' | 'light' | 'shadow' | 'wild' | 'luz' | 'glitch' | 'time';

export interface ChargeFxDef {
  id: ChargeFxId;
  name: string;
  desc: string;
  /** color de la interfaz (borde, texto) */
  color: number;
  css: string;
}

export const CHARGE_FX: ChargeFxDef[] = [
  // Normal → especiales → épicos → legendarios. El clásico es gratis, se muestra antes del normal.
  { id: 'classic', name: 'CLÁSICO', desc: 'El aro de energía de siempre.', color: 0x6ec1ff, css: '#9fd8ff' },
  { id: 'fire', name: 'FUEGO', desc: 'Un aro de llamas que crece con tu potencia.', color: 0xff6a2a, css: '#ffbc55' },
  { id: 'energy', name: 'ENERGÍA', desc: 'Un aro de energía azul con destellos.', color: 0x2f9bff, css: '#8fd0ff' },
  { id: 'hielo', name: 'HIELO', desc: 'Un aro helado con cristales y copos de nieve.', color: 0x69dfff, css: '#b8f2ff' },
  { id: 'light', name: 'RAYO', desc: 'Un aro dorado recorrido por descargas eléctricas.', color: 0xffc52e, css: '#ffe37a' },
  { id: 'wild', name: 'VIENTO', desc: 'Un torbellino verde de viento y hojas.', color: 0x68e51f, css: '#b6ff63' },
  { id: 'tulip', name: 'TULIPÁN', desc: 'Tulipanes y pétalos que giran a tu alrededor.', color: 0xff8fc4, css: '#ffc2dd' },
  { id: 'shadow', name: 'SOMBRA', desc: 'Un aro violeta envuelto en energía oscura.', color: 0xa64cff, css: '#d19bff' },
  { id: 'luz', name: 'LUZ', desc: 'Un aro dorado de energía luminosa.', color: 0xffd66b, css: '#fff0ae' },
  { id: 'glitch', name: 'GLITCH', desc: 'Un aro digital con destellos corruptos.', color: 0x30e6cc, css: '#93fff3' },
  { id: 'time', name: 'TIEMPO', desc: 'Un reloj de energía que se expande y se disipa.', color: 0xffb832, css: '#ffe19a' },
];

const IDS = new Set<string>(CHARGE_FX.map((c) => c.id));
/** Efecto de cada personaje (id del catálogo) cuando el jugador no eligió otro. */
const DEFAULT_BY_SKIN: Record<string, ChargeFxId> = { nxo: 'fire', mai: 'tulip' };

export function isChargeFx(v: unknown): v is ChargeFxId {
  return typeof v === 'string' && IDS.has(v);
}

/** Efecto que se usa: el elegido (si es válido) o, si no hay, el del personaje `skin` (o el clásico). */
export function chargeFxOf(chosen: unknown, skin?: string): ChargeFxId {
  if (isChargeFx(chosen)) return chosen;
  return (skin && DEFAULT_BY_SKIN[skin]) || 'classic';
}

export function chargeFxDef(id: ChargeFxId): ChargeFxDef {
  return CHARGE_FX.find((c) => c.id === id) ?? CHARGE_FX[0];
}

/**
 * ¿Tiene el jugador este efecto? El clásico es de todos; el del personaje viene con él; el resto se compra en la Tienda
 * (ítem `charge:<id>`). `owned` = PlayerState.owned.
 */
export function chargeFxOwned(owned: readonly string[], id: ChargeFxId, skin?: string): boolean {
  return id === 'classic' || owned.includes(`charge:${id}`) || chargeFxOf(undefined, skin) === id;
}
