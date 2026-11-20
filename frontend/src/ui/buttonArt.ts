import type Phaser from 'phaser';

/**
 * Arte de los botones del partido (DASH, SMASH y los dos saques).
 * Los originales (public/assets/btn-*.webp, 1312x1199) se reducen con `node tools/make-button-sprites.mjs`
 * a public/assets/ui/*.webp (256x256, recortados al círculo): son los que carga MatchScene.
 * Si una imagen falta, el botón se dibuja con formas (como antes), así que nunca queda vacío.
 */
export const BUTTON_ART = {
  dash: { key: 'ui-btn-dash', file: 'assets/ui/btn-dash.webp' },
  smash: { key: 'ui-btn-smash', file: 'assets/ui/btn-smash.webp' },
  serve: { key: 'ui-btn-saque', file: 'assets/ui/btn-saque.webp' },
  spin: { key: 'ui-btn-saque-efecto', file: 'assets/ui/btn-saque-efecto.webp' },
  // (21-11-2026, usuario) la ULTI: el botón del ESPECIAL pasa a este arte (rayo blanco sobre azul noche) cuando hay una ULTI equipada (AbilityButton.setInferno)
  ulti: { key: 'ui-btn-ulti', file: 'assets/ui/btn-ulti.webp' },
  // (21-11-2026, usuario) botones de EMOTES y RENDIRSE del partido: se ven opacos en reposo (no estorban) y se aclaran al pulsarlos
  emotes: { key: 'ui-btn-emotes', file: 'assets/ui/btn-emotes.webp' },
  surrender: { key: 'ui-btn-rendirse', file: 'assets/ui/btn-rendirse.webp' },
} as const;

export function queueButtonArt(load: Phaser.Loader.LoaderPlugin) {
  for (const a of Object.values(BUTTON_ART)) if (!load.textureManager.exists(a.key)) load.image(a.key, a.file);
}
