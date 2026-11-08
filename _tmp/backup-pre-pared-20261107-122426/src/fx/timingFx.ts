import Phaser from 'phaser';
import { textStyle } from '../ui/theme';
import { TIMING, type TimingGrade } from '../logic/PerfectTiming';

/**
 * Feedback de Perfect Timing, todo por código (sin sprites):
 *  - PERFECTO: texto "PERFECT!", destello pequeño en el contacto, sonido sintetizado, vibración breve
 *    y un temblor mínimo de cámara (no tapa la pelota).
 *  - BIEN / PRONTO / TARDE: solo un texto pequeño y discreto.
 */
export function playTimingFx(scene: Phaser.Scene, grade: TimingGrade, head: { x: number; y: number }, contact: { x: number; y: number }) {
  const text = TIMING.fx.text[grade];
  if (!text) return;
  const perfect = grade === 'perfect';
  const t = scene.add
    .text(head.x, head.y - 8, text, textStyle(TIMING.fx.size[grade] ?? 20, TIMING.fx.color[grade] ?? '#ffffff'))
    .setOrigin(0.5)
    .setDepth(4000)
    .setAlpha(perfect ? 1 : 0.8)
    .setScale(perfect ? 0.4 : 0.8);
  scene.tweens.add({ targets: t, scale: 1, y: t.y - (perfect ? 46 : 26), duration: perfect ? 300 : 240, ease: perfect ? 'Back.easeOut' : 'Quad.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, delay: perfect ? 600 : 380, duration: 220, onComplete: () => t.destroy() });
  if (!perfect) return;

  // destello pequeño en el punto de contacto (estrella blanca + aro dorado)
  const star = scene.add.star(contact.x, contact.y, 4, 4, 22, 0xffffff).setDepth(3700).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
  scene.tweens.add({ targets: star, scale: 1.2, angle: 45, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
  const ring = scene.add.circle(contact.x, contact.y, 10, 0xffe066, 0).setStrokeStyle(3, 0xffe066).setDepth(3700).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 240, onComplete: () => ring.destroy() });

  scene.cameras.main.shake(TIMING.fx.shake.ms, TIMING.fx.shake.intensity);
  vibrate(TIMING.fx.vibrateMs);
  if (TIMING.fx.sound) perfectSound(scene);
}

export function vibrate(ms: number) {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* sin soporte */
  }
}

/** "Pock" seco + brillo agudo, sintetizado con WebAudio (el juego no tiene archivos de sonido). */
export function perfectSound(scene: Phaser.Scene) {
  const mgr = scene.sound as Phaser.Sound.WebAudioSoundManager;
  const ctx: AudioContext | undefined = mgr?.context;
  if (!ctx || ctx.state !== 'running') return; // audio bloqueado (sin interacción todavía) o desactivado
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = TIMING.fx.volume;
  out.connect(ctx.destination);

  // golpe: ruido corto filtrado
  const len = Math.floor(ctx.sampleRate * 0.06);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const noise = ctx.createBufferSource();
  noise.buffer = buf;
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 1800;
  bp.Q.value = 0.9;
  noise.connect(bp).connect(out);
  noise.start(now);

  // cuerpo: tono que cae rápido
  const body = ctx.createOscillator();
  const bg = ctx.createGain();
  body.type = 'triangle';
  body.frequency.setValueAtTime(520, now);
  body.frequency.exponentialRampToValueAtTime(180, now + 0.09);
  bg.gain.setValueAtTime(0.8, now);
  bg.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
  body.connect(bg).connect(out);
  body.start(now);
  body.stop(now + 0.13);

  // brillo: dos notas agudas
  [1568, 2349].forEach((f, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = now + 0.02 + i * 0.05;
    o.type = 'sine';
    o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.24);
  });
}
