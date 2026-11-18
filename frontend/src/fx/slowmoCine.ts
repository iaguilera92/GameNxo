import type { CineProfile } from './SmashCinematic';
import { SLOWMO } from '../logic/DefensiveMoves';

/**
 * (18-11-2026) Cinemática del DEFENSIVO LEGENDARIO TIEMPO LENTO (SmashCinematic): `SLOWMO.hitMs` ms con el partido congelado mientras el
 * personaje se estira a por la pelota; aura azul hielo y rayos de luz que convergen. La cámara la acerca MatchScene / la demo (onFrame).
 */
export const SLOWMO_CINE: CineProfile = {
  durationMs: SLOWMO.hitMs + 400,
  hitAtMs: SLOWMO.hitMs,
  activateMs: 400,
  focusMs: 1000,
  peakMs: 1700,
  raysUntilMs: 1800,
  releaseFromMs: 1750,
  flashAtMs: 1850,
  flashMs: 200,
  darken: 0, // la penumbra de TIEMPO LENTO la dibuja quien la lanza (EnergyCineFx.drawDark): dura toda la carrera y la cinemática
  rays: 16,
  particles: 26,
  glow: 1,
  pulseEveryMs: 130,
  colors: { core: 0xffffff, gold: 0x9be7ff, hot: 0x4aa8ff, cyan: 0xd9f7ff },
  flashTint: 0xd9f7ff,
};
