import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { coinIcon } from '../ui/wheelArt';
import { sfx } from './sfx';

/**
 * Alerta de LOGRO de las MISIONES POR PARTIDA (domain/matchMissions.ts, docs/MISIONES.md): placa navy con borde dorado,
 * estrella, "¡LOGRO!", el nombre de la misión y "+N" con la moneda. Centrada entre el joystick (x 150) y los botones de
 * habilidades (MatchScene.layout) y un poco más arriba que ellos, en su propio hueco: no tapa ni toca los botones.
 * Varias a la vez van en fila (una detrás de otra). Fija en pantalla (scrollFactor 0).
 */
const ALERT = {
  /** centro: px sobre el borde de abajo (ESPECIAL en H-225 con radio ~64 → su borde de arriba en H-289) */
  lift: 350,
  w: 330,
  h: 72,
  holdMs: 2100,
  gapMs: 250,
};

const queue = new WeakMap<Phaser.Scene, { busy: boolean; items: { title: string; coins: number }[] }>();

export function showMissionAlert(scene: Phaser.Scene, title: string, coins: number) {
  let q = queue.get(scene);
  if (!q) {
    q = { busy: false, items: [] };
    queue.set(scene, q);
    // la escena se reutiliza entre partidos: al cerrarse, la cola se vacía
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => queue.delete(scene));
  }
  q.items.push({ title, coins });
  if (!q.busy) next(scene, q);
}

function next(scene: Phaser.Scene, q: { busy: boolean; items: { title: string; coins: number }[] }) {
  const it = q.items.shift();
  if (!it || !scene.sys.isActive()) {
    q.busy = false;
    return;
  }
  q.busy = true;
  const c = draw(scene, it.title, it.coins);
  scene.tweens.add({
    targets: c,
    alpha: 0,
    y: c.y - 24,
    delay: ALERT.holdMs,
    duration: 260,
    ease: 'Cubic.easeIn',
    onComplete: () => {
      c.destroy();
      scene.time.delayedCall(ALERT.gapMs, () => next(scene, q));
    },
  });
}

function draw(scene: Phaser.Scene, title: string, coins: number) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const w = Math.min(ALERT.w, W - 60);
  const h = ALERT.h;
  const GOLD = 0xffc42e;
  const c = scene.add.container(W / 2, H - ALERT.lift).setScrollFactor(0).setDepth(6062);

  // halo dorado que late + placa (mismo lenguaje que las cards del resultado)
  const halo = scene.add.graphics();
  halo.lineStyle(12, GOLD, 0.22).strokeRoundedRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4, 20);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4).fillRoundedRect(-w / 2 + 3, -h / 2 + 5, w, h, 18);
  g.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 20);
  g.fillStyle(0x0b1733, 0.97).fillRoundedRect(-w / 2, -h / 2, w, h, 18);
  g.fillStyle(0xffffff, 0.08).fillRoundedRect(-w / 2 + 4, -h / 2 + 4, w - 8, h * 0.42, { tl: 15, tr: 15, bl: 6, br: 6 });
  g.lineStyle(3, GOLD, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

  // insignia: estrella dorada en un círculo
  const bx = -w / 2 + 38;
  const badge = scene.add.graphics({ x: bx, y: 0 });
  badge.fillStyle(0x0a1638, 1).fillCircle(0, 0, 25);
  badge.fillStyle(GOLD, 1).fillCircle(0, 0, 22);
  badge.fillStyle(0xfff1b8, 0.55).fillEllipse(-5, -9, 20, 8);
  const star: Phaser.Types.Math.Vector2Like[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 6 : 14;
    star.push({ x: Math.cos(a) * r, y: Math.sin(a) * r + 1 });
  }
  badge.fillStyle(0x0a1638, 1).fillPoints(star, true);

  // textos: ¡LOGRO! (dorado, chico) y la misión
  const tx = bx + 34;
  const head = scene.add.text(tx, -15, '¡LOGRO!', { fontFamily: FONT, fontSize: '16px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(2);
  const name = scene.add.text(tx, 12, title.toUpperCase(), { fontFamily: FONT, fontSize: '17px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5);
  // premio a la derecha
  const coin = scene.add.container(w / 2 - 26, -12, [coinIcon(scene, 0, 0, 12)]);
  const val = scene.add.text(w / 2 - 26, 14, `+${coins}`, { fontFamily: FONT, fontSize: '20px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
  const maxName = w / 2 - 52 - tx;
  if (name.width > maxName) name.setScale(maxName / name.width);

  // destello del borde al entrar (como las cards del resultado; sin máscaras: la placa va en la cámara de interfaz)
  const flash = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  flash.lineStyle(5, 0xffffff, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, 18);

  c.add([halo, g, badge, head, name, coin, val, flash]);

  // entrada: rebote + estrella que gira + destello
  c.setScale(0.5).setAlpha(0);
  scene.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 360, ease: 'Back.easeOut', easeParams: [2.2] });
  scene.tweens.add({ targets: badge, angle: { from: -180, to: 0 }, scale: { from: 0.3, to: 1 }, duration: 520, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: flash, alpha: { from: 1, to: 0 }, duration: 520, delay: 300, ease: 'Quad.easeOut' });
  scene.tweens.add({ targets: halo, alpha: { from: 1, to: 0.4 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  scene.tweens.add({ targets: coin, scale: { from: 1.4, to: 1 }, duration: 320, delay: 300, ease: 'Back.easeOut' });
  sfx(scene, 'power-up', 0.8);
  return c;
}
