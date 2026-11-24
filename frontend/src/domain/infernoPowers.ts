/**
 * PODERES del INFERNO DRIVE: la bola que lanza el golpe (fuego, hielo, viento, rayo). Datos puros, sin Phaser.
 *
 * - FUEGO es de todos y el de cada personaje viene con él; HIELO, VIENTO, RAYO, TULIPÁN, SOMBRA, LUZ, ULTRA EFECTO, RÁFAGA y BOLA DE ENERGÍA (17-11-2026, LEGENDARIA) se compran en la Tienda (CLP).
 *   Se elige en PERSONALIZACIÓN y se guarda en `PlayerState.equipped.inferno`.
 * - Sin elegir, cada personaje usa el suyo: Mai = hielo; el resto = fuego.
 * - Solo cambia cómo se ve la bola y sus efectos (fx/InfernoFx.ts, fx/ImpactFx.ts); el golpe es el mismo.
 */
export type InfernoPower = 'default' | 'fire' | 'ice' | 'wind' | 'lightning' | 'tulip' | 'shadow' | 'light' | 'ultra' | 'barrage' | 'energy' | 'hurricane'; // shadow = SOMBRA, light = LUZ, ultra = ULTRA EFECTO, barrage = RÁFAGA, energy = BOLA DE ENERGÍA (17-11-2026)

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
  /** (17-11-2026) ULTI LEGENDARIA: cinemática extra (carga larga + peloteo automático + bola final), fx/energyBallCine.ts */
  legendary?: boolean;
}

export const INFERNO_POWERS: InfernoPowerDef[] = [
  // (24-11-2026, usuario) DEFAULT: la ULTI inicial de todos (rareza Default). Esfera dorada por código, más que la carga máxima y menos que las de la Tienda.
  { id: 'default', name: 'DEFAULT', ball: 'BOLA DEFAULT', desc: 'Una esfera dorada que deja una estela.', color: 0xffc94a, css: '#ffe48a' },
  { id: 'fire', name: 'FUEGO', ball: 'BOLA DE FUEGO', desc: 'Un golpe de fuego devastador.', color: 0xff6a2a, css: '#ffbc55' },
  { id: 'ice', name: 'HIELO', ball: 'BOLA DE HIELO', desc: 'Un remolino de hielo cristalino.', color: 0x45b8ff, css: '#9fe2ff' },
  { id: 'wind', name: 'VIENTO', ball: 'BOLA DE VIENTO', desc: 'Un torbellino de viento y hojas.', color: 0x3fd68a, css: '#9cf5c2' },
  { id: 'lightning', name: 'RAYO', ball: 'BOLA DE RAYO', desc: 'Una esfera de energía eléctrica.', color: 0xffd23f, css: '#ffe36b' },
  { id: 'tulip', name: 'TULIPÁN', ball: 'BOLA DE TULIPÁN', desc: 'Una ráfaga de pétalos que deja su rastro.', color: 0xff8fc4, css: '#ffc2dd' },
  // (17-11-2026) SOMBRA: bola de oscuridad (núcleo negro, brillo morado). Solo cambia el aspecto, el golpe es el mismo.
  { id: 'shadow', name: 'SOMBRA', ball: 'BOLA DE SOMBRA', desc: 'Una esfera de oscuridad con llamas negras.', color: 0x9b4dff, css: '#d1a8ff' },
  // (17-11-2026) LUZ: bola de luz sagrada (núcleo blanco, halo dorado, anillos de oro). Solo cambia el aspecto, el golpe es el mismo.
  { id: 'light', name: 'LUZ', ball: 'BOLA DE LUZ', desc: 'Una esfera de luz sagrada con anillos dorados.', color: 0xffd86b, css: '#fff1b8' },
  // (17-11-2026) ULTRA EFECTO: SIN hoja de sprites. La pelota normal envuelta en el aire de ventilador del DROP SHOT 0 en grande
  // (fx/InfernoFx.ts UltraAirFx). Solo cambia el aspecto, el golpe es el mismo.
  { id: 'ultra', name: 'ULTRA EFECTO', ball: 'ULTRA EFECTO', desc: 'La pelota con un efecto brutal: un ventilador de aire que arrasa.', color: 0x9cf5d8, css: '#e0fff0' },
  // (17-11-2026) RÁFAGA: SIN hoja de sprites. La pelota real en el centro y una ráfaga de pelotas fantasma alrededor y detrás
  // (fx/InfernoFx.ts BarrageFx). Solo visual, el golpe es el mismo.
  { id: 'barrage', name: 'RÁFAGA', ball: 'RÁFAGA DE PELOTAS', desc: 'Una ráfaga de pelotas que arrasa con todo.', color: 0xd8ff3a, css: '#eaff8a' },
  // (17-11-2026) BOLA DE ENERGÍA: primera ULTI LEGENDARIA. SIN hoja de sprites (esfera blanca y celeste por código, fx/InfernoFx.ts).
  // Trae una CINEMÁTICA EXTRA (fx/energyBallCine.ts + logic/EnergyRally.ts): carga de 6 s con la Zona encendida, peloteo
  // automático a larga distancia con 3 estiradas del rival y la bola gigante final. El golpe (aturdido + raqueta fuera) es el
  // mismo de toda ULTI. `legendary` = usa esa cinemática.
  { id: 'energy', name: 'ENERGÍA', ball: 'BOLA DE ENERGÍA', desc: 'Legendaria: un peloteo imparable y una bola de energía gigante.', color: 0x5fe8ff, css: '#c8f8ff', legendary: true },
  // (17-11-2026) HURACÁN: segunda ULTI LEGENDARIA (decisión del usuario). Sin hoja de sprites (fx/hurricaneFx.ts). Cinemática: golpe de viento
  // que manda al rival contra el fondo, globito, tornado que sube al que la lanza, esfera amarilla y SMASH final (logic/EnergyRally.ts
  // planHurricane). Mismos tiempos que la BOLA DE ENERGÍA y el mismo golpe de toda ULTI.
  { id: 'hurricane', name: 'HURACÁN', ball: 'HURACÁN', desc: 'Legendaria: un golpe de viento que estrella al rival y un smash desde un tornado.', color: 0xffd23f, css: '#fff1a0', legendary: true },
];

const IDS = new Set<string>(INFERNO_POWERS.map((p) => p.id));
/** Poder de cada personaje (id del catálogo) cuando el jugador no eligió otro. */
// (24-11-2026, usuario) ya no hay ULTI inicial por personaje (antes Mai = hielo): todos empiezan con la DEFAULT
const DEFAULT_BY_SKIN: Record<string, InfernoPower> = {};

export function isInfernoPower(v: unknown): v is InfernoPower {
  return typeof v === 'string' && IDS.has(v);
}

/** Poder que se usa: el elegido (si es válido) o, si no hay, el del personaje `skin`. */
export function infernoPowerOf(chosen: unknown, skin?: string): InfernoPower {
  if (isInfernoPower(chosen)) return chosen;
  return (skin && DEFAULT_BY_SKIN[skin]) || 'default';
}

/**
 * ¿Tiene el jugador este poder? FUEGO es de todos; el del personaje (Mai = hielo) viene con él; el resto se compra en la
 * Tienda (ítem `inferno:<poder>`). `owned` = PlayerState.owned.
 */
export function infernoOwned(owned: readonly string[], power: InfernoPower, skin?: string): boolean {
  return power === 'default' || owned.includes(`inferno:${power}`) || infernoPowerOf(undefined, skin) === power;
}

export function infernoPowerDef(id: InfernoPower): InfernoPowerDef {
  return INFERNO_POWERS.find((p) => p.id === id) ?? INFERNO_POWERS[0];
}

/** (17-11-2026) ¿Es una ULTI LEGENDARIA (con la cinemática extra)? BOLA DE ENERGÍA y HURACÁN. */
export function isLegendaryInferno(id: InfernoPower): boolean {
  return !!INFERNO_POWERS.find((p) => p.id === id)?.legendary;
}
