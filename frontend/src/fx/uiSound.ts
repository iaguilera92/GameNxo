import Phaser from 'phaser';

/**
 * SONIDOS DE INTERFAZ (menú, botones). Sintetizados con Web Audio (sin archivos), como fx/wheelSound.ts.
 * El ajuste "Sonido" (logic/Settings.ts) los silencia: suspende el contexto de audio.
 *
 * Para cambiar uno por un archivo de verdad: dejar public/mp3/ui-<tipo>.mp3 (p. ej. ui-play.mp3) y añadir el tipo a
 * UI_SOUND_FILES. Se carga en BootScene (queueUiSounds) y, si existe, suena el archivo en vez del sintetizado.
 */
export type UiSound = 'tap' | 'play' | 'back' | 'duel-hit' | 'duel-tick' | 'duel-win';

/** tipos que tienen archivo en public/mp3/ui-<tipo>.mp3 (vacío = todos sintetizados) */
export const UI_SOUND_FILES: UiSound[] = [];

export function queueUiSounds(load: Phaser.Loader.LoaderPlugin) {
  for (const k of UI_SOUND_FILES) if (!load.cacheManager.audio.exists(`ui-${k}`)) load.audio(`ui-${k}`, `mp3/ui-${k}.mp3`);
}

function ctxOf(scene: Phaser.Scene): AudioContext | null {
  const ctx = (scene.sound as unknown as { context?: AudioContext }).context;
  if (!ctx) return null;
  if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(ctx: AudioContext, out: AudioNode, freq: number, at: number, dur: number, type: OscillatorType, vol: number, slideTo?: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, at);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, at + dur);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.03);
}

/** ruido corto filtrado (golpe de aire / "whoosh") */
function noise(ctx: AudioContext, out: AudioNode, at: number, dur: number, vol: number, from: number, to: number) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(from, at);
  f.frequency.exponentialRampToValueAtTime(to, at + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(vol, at + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f).connect(g).connect(out);
  src.start(at);
  src.stop(at + dur + 0.02);
}

/** Suena un sonido de interfaz. */
export function uiSound(scene: Phaser.Scene, kind: UiSound) {
  if (UI_SOUND_FILES.includes(kind) && scene.cache.audio.exists(`ui-${kind}`)) {
    scene.sound.play(`ui-${kind}`, { volume: kind === 'play' ? 0.9 : 0.6 });
    return;
  }
  const ctx = ctxOf(scene);
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = ctx.destination;
  if (kind === 'tap') {
    // clic corto y redondo (botones del menú)
    tone(ctx, out, 900, t, 0.06, 'triangle', 0.12, 620);
    tone(ctx, out, 1800, t, 0.03, 'sine', 0.04);
  } else if (kind === 'duel-hit') {
    // DUELO RED: golpe corto de cada volea del peloteo (seco, grave y rápido)
    tone(ctx, out, 520, t, 0.05, 'triangle', 0.14, 260);
    noise(ctx, out, t, 0.04, 0.1, 1800, 700);
  } else if (kind === 'duel-tick') {
    // DUELO RED: "tic" al cerrarse el aro
    tone(ctx, out, 1500, t, 0.05, 'square', 0.1);
    tone(ctx, out, 2300, t + 0.012, 0.04, 'sine', 0.07);
  } else if (kind === 'duel-win') {
    // DUELO RED: ronda ganada (dos notas que suben)
    tone(ctx, out, 660, t, 0.1, 'triangle', 0.12);
    tone(ctx, out, 990, t + 0.08, 0.16, 'triangle', 0.12);
  } else if (kind === 'back') {
    // volver / cerrar: dos notas que bajan
    tone(ctx, out, 700, t, 0.07, 'triangle', 0.1);
    tone(ctx, out, 480, t + 0.06, 0.09, 'triangle', 0.1);
  } else {
    // JUGAR: golpe grave + "whoosh" que sube + acorde brillante (sensación de arrancar algo grande)
    tone(ctx, out, 140, t, 0.22, 'sine', 0.35, 60); // golpe
    noise(ctx, out, t, 0.38, 0.22, 400, 4200); // whoosh
    [523, 659, 784, 1047].forEach((f, i) => tone(ctx, out, f, t + 0.06 + i * 0.045, 0.32, 'triangle', 0.1));
    tone(ctx, out, 2093, t + 0.22, 0.25, 'sine', 0.05);
  }
}
/**
 * Clic de interfaz en TODO objeto interactivo de la escena (botones, tarjetas, huecos y diálogos como Estilos o Defensivo).
 * Se llama una vez en create(); se quita solo al cerrar la escena. El menú principal lo hace igual a mano.
 */
export function installTapSound(scene: Phaser.Scene) {
  const onTap = () => uiSound(scene, 'tap');
  scene.input.on(Phaser.Input.Events.GAMEOBJECT_DOWN, onTap);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.off(Phaser.Input.Events.GAMEOBJECT_DOWN, onTap));
}

/** ¡A LAS ESTRELLAS!: "ting" brillante cuando el personaje se convierte en destello en el cielo. */
export function skyTwinkleSound(scene: Phaser.Scene) {
  const ctx = ctxOf(scene);
  if (!ctx) return;
  const t = ctx.currentTime;
  const out = ctx.destination;
  tone(ctx, out, 2093, t, 0.5, 'sine', 0.14);
  tone(ctx, out, 3136, t + 0.05, 0.45, 'sine', 0.08);
  tone(ctx, out, 4186, t + 0.1, 0.35, 'triangle', 0.05);
}
