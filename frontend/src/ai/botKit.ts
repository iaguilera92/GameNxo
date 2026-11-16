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

const NXO: BotKit = { defensive: 'dash', smash: 'fire', inferno: 'fire', charge: 'fire' };
const KITS: Record<string, BotKit> = {
  nxo: NXO,
  mai: { defensive: 'blink', smash: 'ice', inferno: 'ice', charge: 'tulip' },
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
const SMASHES: SmashPower[] = ['fire', 'ice', 'wind', 'lightning', 'shadow', 'light'];
const INFERNOS: InfernoPower[] = ['fire', 'ice', 'wind', 'lightning', 'tulip'];
const CHARGES: ChargeFxId[] = ['classic', 'fire', 'energy', 'tulip'];
const COLORS: CharColorId[] = ['azul', 'verde', 'morado', 'dorado', 'sombra'];

/** fuera lo de rareza ÉPICA o LEGENDARIA (sin rareza = de todos, p. ej. FUEGO y DASH) */
const allowed = <T extends string>(kind: string, ids: T[]) =>
  ids.filter((id) => {
    const r = itemRarity(`${kind}:${id}`);
    return r !== 'epica' && r !== 'legendaria';
  });

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
