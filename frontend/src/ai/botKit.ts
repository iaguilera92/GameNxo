/**
 * KIT DEL BOT según su personaje (lo que se ve al frente: MatchScene.rivalSkin()). Datos puros, sin Phaser.
 * El bot no elige en PERSONALIZACIÓN: cada personaje trae su juego completo.
 *
 *   MAI  defensivo DESTELLO · especial HIELO · ulti HIELO · carga TULIPÁN
 *   NXO  defensivo DASH     · especial FUEGO · ulti FUEGO · carga FUEGO
 *
 * Personaje desconocido: el kit de NXO. Solo cambia lo que se ve y cómo llega a la pelota; la IA (BotBrain: cuándo usa
 * cada habilidad, potencia, recargas) es la misma.
 */
import type { ChargeFxId } from '../domain/chargeFx';
import type { DefensivePower } from '../domain/defensivePowers';
import type { InfernoPower } from '../domain/infernoPowers';
import type { SmashPower } from '../domain/smashPowers';
import type { CharColorId } from '../domain/charColors';
import { itemRarity } from '../domain/shopCatalog';

export interface BotKit {
  defensive: DefensivePower;
  smash: SmashPower;
  inferno: InfernoPower;
  charge: ChargeFxId;
  /** CROMA (estilo de color del personaje, fx/CharColorFx.ts); 'classic' = colores de siempre */
  color?: CharColorId;
}

// (24-11-2026, usuario) el kit de base del bot es el DEFAULT de todos (antes Nxo = fuego, Mai = hielo / destello / tulipán)
const NXO: BotKit = { defensive: 'dash', smash: 'default', inferno: 'default', charge: 'classic' };
const KITS: Record<string, BotKit> = {
  nxo: NXO,
  mai: NXO,
};

export function botKitFor(skin: string | undefined): BotKit {
  return (skin && KITS[skin]) || NXO;
}

/**
 * KIT VARIADO del bot (16-11-2026, pedido del usuario): cada partida el bot sale con su CROMA, ESPECIAL, ULTI, DEFENSIVO y
 * efecto de CARGA elegidos al azar, como un jugador que personalizó su personaje. NUNCA usa nada de rareza ÉPICA ni LEGENDARIA
 * (domain/shopCatalog.ts). A veces conserva lo de su personaje (Mai = hielo / destello, Nxo = fuego / dash).
 * DEFENSIVO: los 6 (DASH y DESTELLO propios del bot; SOMBRA, SUPERSALTO, VOLTERETA y PATINAJE con MatchScene.botFly).
 */
const BOT_DEFENSIVES: DefensivePower[] = ['dash', 'blink', 'shadow', 'jump', 'flip', 'skate'];
const SMASHES: SmashPower[] = ['default', 'fire', 'ice', 'wind', 'lightning', 'shadow', 'light', 'comet', 'dragon']; // comet (épica) y dragon (legendaria) quedan fuera por `allowed`
const INFERNOS: InfernoPower[] = ['default', 'fire', 'ice', 'wind', 'lightning', 'tulip', 'shadow', 'light', 'ultra', 'barrage']; // shadow = ULTI de SOMBRA, light = ULTI de LUZ, ultra = ULTRA EFECTO, barrage = RÁFAGA (17-11-2026)
const CHARGES: ChargeFxId[] = ['classic', 'fire', 'energy', 'tulip'];
const COLORS: CharColorId[] = ['azul', 'verde', 'morado', 'dorado', 'sombra'];

/** fuera lo de rareza ÉPICA o LEGENDARIA (sin rareza = de todos, p. ej. FUEGO y DASH) */
const allowed = <T extends string>(kind: string, ids: T[]) =>
  ids.filter((id) => {
    const r = itemRarity(`${kind}:${id}`);
    return r !== 'epica' && r !== 'legendaria';
  });

/** sin rareza LEGENDARIA (la ÉPICA sí vale): regla del 2v2 contra bots (23-11-2026, usuario) */
const notLegendary = <T extends string>(kind: string, ids: T[]) => ids.filter((id) => itemRarity(`${kind}:${id}`) !== 'legendaria');

/**
 * (23-11-2026, usuario) KITS DEL 2v2 CONTRA BOTS: "a cada personaje poderes diferentes al azar, nunca legendarios". Un kit por bot
 * (`skins`: el personaje de cada uno), con ESPECIAL, ULTI y DEFENSIVO distintos entre todos y, si se puede, distintos de los del
 * jugador (`avoid`). La ÉPICA vale; la LEGENDARIA no. Carga y croma, como randomBotKit (sin épicos ni legendarios).
 */
export function randomDoublesKits(
  skins: (string | undefined)[],
  avoid: { smash?: string; inferno?: string; defensive?: string } = {},
  rnd: () => number = Math.random,
): BotKit[] {
  const used = { smash: new Set<string>(), inferno: new Set<string>(), defensive: new Set<string>() };
  for (const k of ['smash', 'inferno', 'defensive'] as const) if (avoid[k]) used[k].add(avoid[k]!);
  const pickFree = <T extends string>(kind: 'smash' | 'inferno' | 'defensive', ids: T[]): T => {
    const free = ids.filter((id) => !used[kind].has(id));
    const pool = free.length ? free : ids; // más bots que poderes: se repite (hoy no pasa: 7 ESPECIALES, 9 ULTIS, 6 DEFENSIVOS)
    const id = pool[Math.floor(rnd() * pool.length)];
    used[kind].add(id);
    return id;
  };
  const smashes = notLegendary('smash', SMASHES);
  const infernos = notLegendary('inferno', INFERNOS);
  const defensives = notLegendary('defensive', BOT_DEFENSIVES);
  return skins.map((skin) => {
    const base = randomBotKit(skin, rnd); // carga y croma
    return { ...base, smash: pickFree('smash', smashes), inferno: pickFree('inferno', infernos), defensive: pickFree('defensive', defensives) };
  });
}

export function randomBotKit(skin: string | undefined, rnd: () => number = Math.random): BotKit {
  const base = botKitFor(skin);
  const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const keepOwn = (p: number) => rnd() < p;
  const smashes = allowed('smash', SMASHES);
  const infernos = allowed('inferno', INFERNOS);
  const charges = allowed('charge', CHARGES);
  const defensives = allowed('defensive', BOT_DEFENSIVES);
  return {
    defensive: keepOwn(0.4) && defensives.includes(base.defensive) ? base.defensive : pick(defensives),
    smash: keepOwn(0.3) && smashes.includes(base.smash) ? base.smash : pick(smashes),
    inferno: keepOwn(0.3) && infernos.includes(base.inferno) ? base.inferno : pick(infernos),
    charge: charges.includes(base.charge) && keepOwn(0.3) ? base.charge : pick(charges),
    // croma: 1 de cada 3 con los colores de siempre
    color: keepOwn(0.33) ? 'classic' : pick(allowed('color', COLORS)),
  };
}
