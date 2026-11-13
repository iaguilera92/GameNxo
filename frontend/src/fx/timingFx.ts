import Phaser from 'phaser';
import { textStyle } from '../ui/theme';
import { TIMING, type TimingGrade } from '../logic/PerfectTiming';

/**
 * Feedback de Perfect Timing, todo por código (sin sprites):
 *  - PERFECTO: texto "¡PERFECTO!", destello pequeño en el contacto, sonido sintetizado, vibración breve
 *    y un temblor mínimo de cámara (no tapa la pelota).
 *  - BIEN: sin texto (13-11-2026), solo un "tic" limpio. PRONTO / TARDE: texto naranja / rojo y un golpe sordo y grave.
 *    Cada nota suena distinta para aprender el ritmo de oído.
 */
/** `remote` = nota del rival en red: se ve y se oye, sin vibración ni temblor de cámara. */
export function playTimingFx(scene: Phaser.Scene, grade: TimingGrade, head: { x: number; y: number }, contact: { x: number; y: number }, remote = false) {
  const text = TIMING.fx.text[grade];
  if (!text) {
    // nota sin texto (BIEN): solo su sonido
    if (grade === 'good' && TIMING.fx.sound) gradeSound(scene, grade);
    return;
  }
  const perfect = grade === 'perfect';
  const t = scene.add
    .text(head.x, head.y - 8, text, textStyle(TIMING.fx.size[grade] ?? 20, TIMING.fx.color[grade] ?? '#ffffff'))
    .setOrigin(0.5)
    .setDepth(4000)
    .setAlpha(perfect ? 1 : 0.8)
    .setScale(perfect ? 0.4 : 0.8);
  scene.tweens.add({ targets: t, scale: 1, y: t.y - (perfect ? 46 : 26), duration: perfect ? 300 : 240, ease: perfect ? 'Back.easeOut' : 'Quad.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, delay: perfect ? 600 : 380, duration: 220, onComplete: () => t.destroy() });
  if (!perfect) {
    if (TIMING.fx.sound) gradeSound(scene, grade);
    return;
  }

  // destello pequeño en el punto de contacto (estrella blanca + aro dorado)
  const star = scene.add.star(contact.x, contact.y, 4, 4, 22, 0xffffff).setDepth(3700).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
  scene.tweens.add({ targets: star, scale: 1.2, angle: 45, alpha: 0, duration: 200, ease: 'Quad.easeOut', onComplete: () => star.destroy() });
  const ring = scene.add.circle(contact.x, contact.y, 10, 0xffe066, 0).setStrokeStyle(3, 0xffe066).setDepth(3700).setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 240, onComplete: () => ring.destroy() });

  if (!remote) {
    scene.cameras.main.shake(TIMING.fx.shake.ms, TIMING.fx.shake.intensity);
    vibrate(TIMING.fx.vibrateMs);
  }
  if (TIMING.fx.sound) perfectSound(scene);
}

/** BIEN = "tic" corto y limpio (una nota media); PRONTO / TARDE = golpe sordo y grave que cae. */
function gradeSound(scene: Phaser.Scene, grade: TimingGrade) {
  const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager)?.context as AudioContext | undefined;
  if (!ctx || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  if (grade === 'good') {
    o.type = 'sine';
    o.frequency.setValueAtTime(1046, now);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(TIMING.fx.volume * 0.5, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  } else if (grade === 'early' || grade === 'late') {
    o.type = 'triangle';
    o.frequency.setValueAtTime(grade === 'early' ? 240 : 200, now);
    o.frequency.exponentialRampToValueAtTime(90, now + 0.14);
    g.gain.setValueAtTime(TIMING.fx.volume * 0.6, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  } else return;
  o.connect(g).connect(ctx.destination);
  o.start(now);
  o.stop(now + 0.18);
}

/** RACHA de PERFECTO (desde la 3.ª): texto dorado "RACHA ×N" que late sobre la cabeza y un arpegio que sube con la racha. */
export function playStreakFx(scene: Phaser.Scene, n: number, head: { x: number; y: number }) {
  const t = scene.add
    .text(head.x, head.y - 64, `RACHA ×${n}`, textStyle(26, '#ffc42e'))
    .setOrigin(0.5)
    .setDepth(4001)
    .setScale(0.5);
  scene.tweens.add({ targets: t, scale: 1, y: t.y - 30, duration: 320, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: t, alpha: 0, delay: 800, duration: 260, onComplete: () => t.destroy() });
  const ctx = (scene.sound as Phaser.Sound.WebAudioSoundManager)?.context as AudioContext | undefined;
  if (!TIMING.fx.sound || !ctx || ctx.state !== 'running') return;
  const base = 784 * Math.pow(2, Math.min(6, n - 3) / 12); // un semitono más por cada perfecto extra
  [1, 1.26, 1.5].forEach((m, i) => {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t0 = ctx.currentTime + 0.12 + i * 0.06;
    o.type = 'square';
    o.frequency.value = base * m;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(TIMING.fx.volume * 0.18, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + 0.14);
  });
}

/**
 * ANILLO GUÍA del Perfect Timing sobre la pelota: un aro que se cierra hasta encajar en el aro interior justo en el
 * instante ideal del toque. `left` = segundos que faltan para ese instante (negativo = ya pasó).
 */
export class TimingRing {
  private g: Phaser.GameObjects.Graphics;
  constructor(scene: Phaser.Scene) {
    this.g = scene.add.graphics().setDepth(3650).setVisible(false);
  }
  hide() {
    this.g.clear().setVisible(false);
  }
  /** (x, y) pelota en pantalla, `k` escala de la perspectiva. */
  show(x: number, y: number, k: number, left: number) {
    const R = TIMING.ring;
    const kk = Math.max(0.6, Math.min(1.4, k));
    const q = Math.max(0, Math.min(1, left / R.showS)); // 1 = recién aparece, 0 = momento ideal
    const inPerfect = Math.abs(left) * 1000 <= TIMING.perfectMs;
    const r = (R.endR + (R.startR - R.endR) * q) * kk;
    const a = left < 0 ? Math.max(0, 1 + left / 0.15) : Math.min(1, (1 - q) * 3); // entra suave y se apaga al pasar
    const g = this.g.clear().setVisible(true);
    // aro objetivo (fijo) y aro que se cierra
    g.lineStyle(2.5 * kk, 0xffffff, 0.45 * a).strokeCircle(x, y, R.endR * kk);
    g.lineStyle((inPerfect ? 5 : 3) * kk, inPerfect ? 0xffe066 : 0x8fe3ff, (inPerfect ? 1 : 0.85) * a).strokeCircle(x, y, r);
    if (inPerfect) g.fillStyle(0xffe066, 0.25 * a).fillCircle(x, y, R.endR * kk);
  }
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
