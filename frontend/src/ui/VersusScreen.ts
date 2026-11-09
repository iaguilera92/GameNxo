import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { Character, type CharacterLook } from '../objects/Character';
import { addPortrait } from '../characters/portrait';
import type { SkinId } from '../characters/skins';

/**
 * Pantalla VS (vertical, estilo juego de pelea): pantalla partida en diagonal, TÚ arriba en azul
 * y RIVAL abajo en rojo, personajes grandes, placas de nombre/nivel y un VS dorado con impacto.
 * Solo presentación: la escena que la llama decide cuándo pasar al partido.
 */
export interface VersusSide {
  name: string;
  level: number;
  look: CharacterLook;
  /** skin para usar su retrato estático si existe (solo el jugador) */
  portraitSkin?: SkinId;
}

const BLUE = { main: 0x2f7bff, deep: 0x0b2a78, glow: 0x6fb2ff, text: '#9fd0ff' };
const RED = { main: 0xff3b4e, deep: 0x6e0c1c, glow: 0xff8a96, text: '#ffb3ba' };

export function showVersus(scene: Phaser.Scene, player: VersusSide, rival: VersusSide) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  // línea diagonal que parte la pantalla (sube hacia la derecha)
  const yL = H * 0.56;
  const yR = H * 0.44;
  const midY = (yL + yR) / 2;

  // ---------------------------------------------------------------- mitades de color
  const half = (top: boolean) => {
    const pal = top ? BLUE : RED;
    const c = scene.add.container(top ? -W : W, 0).setDepth(2);
    const g = scene.add.graphics();
    const poly = top
      ? [{ x: 0, y: 0 }, { x: W, y: 0 }, { x: W, y: yR }, { x: 0, y: yL }]
      : [{ x: 0, y: yL }, { x: W, y: yR }, { x: W, y: H }, { x: 0, y: H }];
    g.fillStyle(pal.deep, 0.88).fillPoints(poly, true);
    // degradado: banda más clara junto a la diagonal
    const band = top
      ? [{ x: 0, y: yL - H * 0.16 }, { x: W, y: yR - H * 0.16 }, { x: W, y: yR }, { x: 0, y: yL }]
      : [{ x: 0, y: yL }, { x: W, y: yR }, { x: W, y: yR + H * 0.16 }, { x: 0, y: yL + H * 0.16 }];
    g.fillStyle(pal.main, 0.28).fillPoints(band, true);
    c.add(g);

    // líneas de velocidad (se redibujan cada fotograma)
    const lines = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    c.add(lines);
    const streaks = Array.from({ length: 22 }, () => ({
      x: Math.random() * W,
      y: top ? Math.random() * (yR - 30) : yL + 30 + Math.random() * (H - yL - 30),
      len: 80 + Math.random() * 220,
      v: 900 + Math.random() * 900,
      a: 0.05 + Math.random() * 0.12,
    }));
    const dir = top ? 1 : -1;
    const ev = scene.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        lines.clear();
        for (const s of streaks) {
          s.x += (dir * s.v) / 60;
          if (dir > 0 && s.x - s.len > W) s.x = -10;
          if (dir < 0 && s.x + s.len < 0) s.x = W + 10;
          lines.lineStyle(3, pal.glow, s.a).lineBetween(s.x, s.y, s.x - dir * s.len, s.y);
        }
      },
    });
    c.once(Phaser.GameObjects.Events.DESTROY, () => ev.remove());
    scene.tweens.add({ targets: c, x: 0, duration: 380, ease: 'Cubic.easeOut' });
    return c;
  };
  half(true);
  half(false);

  // ---------------------------------------------------------------- personajes
  const fighter = (side: VersusSide, top: boolean) => {
    const x = top ? W * 0.33 : W * 0.67;
    const feetY = top ? yL - H * 0.04 : H - Math.max(24, H * 0.03);
    const height = Math.min(H * 0.4, 560);
    const fromX = top ? -W * 0.5 : W * 1.5;
    // sombra en el suelo
    const sh = scene.add.ellipse(x, feetY, height * 0.62, height * 0.1, 0x000000, 0.4).setDepth(4).setAlpha(0);
    scene.tweens.add({ targets: sh, alpha: 1, delay: 300, duration: 300 });
    const portrait = side.portraitSkin ? addPortrait(scene, side.portraitSkin, fromX, feetY + 6, height) : undefined;
    const obj: Phaser.GameObjects.Image | Character =
      portrait ?? new Character(scene, fromX, feetY, side.look, 'front').setScale(height / 150);
    obj.setDepth(5);
    // el rival (abajo a la derecha) mira hacia la izquierda, hacia el jugador
    if (!top && obj instanceof Character) obj.facing = -1;
    if (!top && portrait) portrait.setFlipX(true);
    scene.tweens.add({ targets: obj, x, delay: 140, duration: 520, ease: 'Back.easeOut', easeParams: [1.2] });
    // respiración
    scene.tweens.add({ targets: obj, y: obj.y - 6, delay: 700, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (obj instanceof Character) scene.time.delayedCall(800, () => obj.swing());
  };
  fighter(player, true);
  fighter(rival, false);

  // ---------------------------------------------------------------- placas de nombre
  const plate = (side: VersusSide, top: boolean) => {
    const pal = top ? BLUE : RED;
    const pw = Math.min(330, W * 0.46);
    const ph = 132;
    const x = top ? W - pw / 2 - 20 : pw / 2 + 20;
    const y = top ? H * 0.2 : H * 0.72;
    const c = scene.add.container(top ? W + pw : -pw, y).setDepth(8);
    const k = 18;
    const shape = roundedPoly([[-pw / 2 + k, -ph / 2], [pw / 2, -ph / 2], [pw / 2 - k, ph / 2], [-pw / 2, ph / 2]], 14);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.4).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
    g.lineStyle(10, pal.main, 0.22).strokePoints(shape, true, true);
    g.fillStyle(0x0a1430, 0.95).fillPoints(shape, true);
    g.lineStyle(3, pal.main, 1).strokePoints(shape, true, true);
    c.add(g);
    // etiqueta TÚ / RIVAL
    const tw = 104;
    const tag = scene.add.graphics();
    const tagPts = roundedPoly([[-tw / 2 + 8, -16], [tw / 2, -16], [tw / 2 - 8, 16], [-tw / 2, 16]], 7);
    tag.fillStyle(pal.main, 1).fillPoints(tagPts, true);
    tag.setPosition(-pw / 2 + tw / 2 + 18, -ph / 2);
    c.add(tag);
    c.add(
      scene.add
        .text(-pw / 2 + tw / 2 + 18, -ph / 2, top ? 'TÚ' : 'RIVAL', { fontFamily: FONT, fontSize: '22px', color: '#ffffff' })
        .setOrigin(0.5)
        .setLetterSpacing(2),
    );
    // nombre (se reduce si es largo)
    const name = scene.add
      .text(0, -10, side.name.toUpperCase(), { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#050b1c', strokeThickness: 6 })
      .setOrigin(0.5);
    if (name.width > pw - 40) name.setScale((pw - 40) / name.width);
    c.add(name);
    // nivel
    const lv = scene.add.graphics();
    lv.fillStyle(pal.deep, 1).fillRoundedRect(-62, 22, 124, 32, 16);
    lv.lineStyle(2, pal.main, 1).strokeRoundedRect(-62, 22, 124, 32, 16);
    c.add(lv);
    c.add(scene.add.text(0, 38, `NIVEL ${side.level}`, { fontFamily: FONT, fontSize: '20px', color: pal.text }).setOrigin(0.5).setLetterSpacing(1));
    scene.tweens.add({ targets: c, x, delay: 260, duration: 460, ease: 'Back.easeOut' });
  };
  plate(player, true);
  plate(rival, false);

  // ---------------------------------------------------------------- corte diagonal + VS
  const slash = scene.add.graphics().setDepth(10).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
  slash.lineStyle(26, 0xffffff, 0.12).lineBetween(0, yL, W, yR);
  slash.lineStyle(12, 0xffe08a, 0.35).lineBetween(0, yL, W, yR);
  slash.lineStyle(4, 0xffffff, 1).lineBetween(0, yL, W, yR);

  // estallido de rayos detrás del VS
  const burst = scene.add.graphics({ x: W / 2, y: midY }).setDepth(11).setBlendMode(Phaser.BlendModes.ADD).setScale(0);
  const rays = 18;
  for (let i = 0; i < rays; i++) {
    const a = (i / rays) * Math.PI * 2;
    const a2 = a + (Math.PI / rays) * 0.55;
    const r = i % 2 ? 190 : 260;
    burst.fillStyle(0xffc42e, i % 2 ? 0.18 : 0.3).fillTriangle(0, 0, Math.cos(a) * r, Math.sin(a) * r, Math.cos(a2) * r, Math.sin(a2) * r);
  }
  burst.fillStyle(0xfff1b8, 0.35).fillCircle(0, 0, 70);

  const vs = scene.add
    .text(W / 2, midY, 'VS', { fontFamily: FONT, fontSize: '170px', color: '#ffc42e', stroke: '#1a0f00', strokeThickness: 14 })
    .setOrigin(0.5)
    .setDepth(12)
    .setAngle(-8)
    .setScale(3.2)
    .setAlpha(0)
    .setShadow(0, 8, '#000000', 0, true, false);
  // degradado dorado en el texto
  const grad = vs.context.createLinearGradient(0, 0, 0, vs.height);
  grad.addColorStop(0.15, '#fff6c8');
  grad.addColorStop(0.5, '#ffc42e');
  grad.addColorStop(0.9, '#e07b00');
  vs.setFill(grad);

  const impactAt = 520;
  scene.tweens.add({ targets: slash, alpha: 1, delay: impactAt - 120, duration: 160 });
  scene.tweens.add({
    targets: vs,
    scale: 1,
    alpha: 1,
    delay: impactAt,
    duration: 260,
    ease: 'Back.easeOut',
    onComplete: () => {
      scene.cameras.main.shake(220, 0.012);
      const f = scene.add.rectangle(0, 0, W, H, 0xffffff, 0.45).setOrigin(0).setDepth(30);
      scene.tweens.add({ targets: f, alpha: 0, duration: 260, onComplete: () => f.destroy() });
      scene.tweens.add({ targets: vs, scale: 1.06, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    },
  });
  scene.tweens.add({ targets: burst, scale: 1, delay: impactAt + 60, duration: 300, ease: 'Back.easeOut' });
  scene.tweens.add({ targets: burst, angle: 360, delay: impactAt, duration: 9000, repeat: -1 });

  // destello de entrada
  const flash = scene.add.rectangle(0, 0, W, H, 0xffffff, 0).setOrigin(0).setDepth(50);
  scene.tweens.add({ targets: flash, alpha: { from: 0.55, to: 0 }, duration: 300 });
}
