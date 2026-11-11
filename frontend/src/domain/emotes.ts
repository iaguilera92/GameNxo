/**
 * EMOTES (las caritas del partido): datos puros, sin Phaser.
 * Se desbloquean como premios del PASE DE BATALLA (ítem `emote:<id>`); en el partido solo salen los que tienes
 * (ui/Emotes.ts). El rival puede mandarte cualquiera de los que existen.
 */
export type EmoteKind = 'happy' | 'cool' | 'wow';
export const EMOTES: EmoteKind[] = ['happy', 'cool', 'wow'];
/** nombre del emote (premios del pase) */
export const EMOTE_NAME: Record<EmoteKind, string> = { happy: 'Risa', cool: 'Pensando', wow: 'Enojado' };

export function isEmote(v: unknown): v is EmoteKind {
  return typeof v === 'string' && (EMOTES as string[]).includes(v);
}

/** Emotes que tiene el jugador (`owned` = PlayerState.owned), en el orden de EMOTES. */
export function ownedEmotes(owned: readonly string[]): EmoteKind[] {
  return EMOTES.filter((k) => owned.includes(`emote:${k}`));
}
