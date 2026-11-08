import Phaser from 'phaser';

/**
 * Sonidos de la ruleta sintetizados con Web Audio (el juego no tiene archivos de audio).
 * Si el navegador no tiene Web Audio, no suena nada (no falla).
 */
function ctxOf(scene: Phaser.Scene): AudioContext | null {
  const sm = scene.sound as Phaser.Sound.WebAudioSoundManager;
  const ctx = (sm as unknown as { context?: AudioContext }).context;
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

function blip(ctx: AudioContext, freq: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + dur + 0.02);
}

/** "Clac" del indicador al pasar por un sector. */
export function wheelTick(scene: Phaser.Scene, pitch = 1) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  blip(ctx, 1400 * pitch, ctx.currentTime, 0.035, 'square', 0.05);
}

/** Arranque del giro (zumbido ascendente). */
export function wheelStart(scene: Phaser.Scene) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  blip(ctx, 180, ctx.currentTime, 0.35, 'sawtooth', 0.05, 720);
}

/** Premio: arpegio. `special` = fanfarria más larga y brillante. */
export function wheelWin(scene: Phaser.Scene, special: boolean) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  const t = ctx.currentTime;
  const notes = special ? [523, 659, 784, 1047, 784, 1047, 1319, 1568] : [523, 659, 784, 1047];
  notes.forEach((f, i) => {
    blip(ctx, f, t + i * (special ? 0.09 : 0.08), special ? 0.3 : 0.22, 'triangle', 0.12);
    if (special) blip(ctx, f * 2, t + i * 0.09 + 0.02, 0.18, 'sine', 0.04);
  });
}

/** Cobro: tintineo de monedas. */
export function wheelClaim(scene: Phaser.Scene) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  const t = ctx.currentTime;
  for (let i = 0; i < 6; i++) blip(ctx, 1800 + i * 220, t + i * 0.05, 0.09, 'sine', 0.06);
}
