/**
 * EMOTES (las caritas del partido): datos puros, sin Phaser.
 * Se desbloquean como premios del PASE DE BATALLA (ítem `emote:<id>`); en el partido solo salen los que tienes
 * (ui/Emotes.ts). El rival puede mandarte cualquiera de los que existen.
 */
export type EmoteKind = 'happy' | 'cool' | 'wow' | 'cry' | 'shades' | 'treasure'; // cry = LLORANDO; LEGENDARIOS animados (18-11-2026): shades = LENTES, treasure = TESORO
export const EMOTES: EmoteKind[] = ['happy', 'cool', 'wow', 'cry', 'shades', 'treasure'];
/** Emotes LEGENDARIOS (animados, ui/Emotes.ts EMOTE_ANIM). */
export const LEGENDARY_EMOTES: readonly EmoteKind[] = ['shades', 'treasure'];

/** Emotes que tiene el jugador (`owned` = PlayerState.owned), en el orden de EMOTES. */
export function ownedEmotes(owned: readonly string[]): EmoteKind[] {
  return EMOTES.filter((k) => owned.includes(`emote:${k}`));
}
