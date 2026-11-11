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

export interface BotKit {
  defensive: DefensivePower;
  smash: SmashPower;
  inferno: InfernoPower;
  charge: ChargeFxId;
}

const NXO: BotKit = { defensive: 'dash', smash: 'fire', inferno: 'fire', charge: 'fire' };
const KITS: Record<string, BotKit> = {
  nxo: NXO,
  mai: { defensive: 'blink', smash: 'ice', inferno: 'ice', charge: 'tulip' },
};

export function botKitFor(skin: string | undefined): BotKit {
  return (skin && KITS[skin]) || NXO;
}
