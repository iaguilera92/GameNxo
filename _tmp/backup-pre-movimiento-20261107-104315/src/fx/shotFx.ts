import Phaser from 'phaser';

/**
 * Efectos visuales de golpe (solo dibujo, sin lógica de partido):
 *  - playImpact: destello / ondas / partículas sobre la pelota según la potencia REAL del golpe (0..1);
 *  - ChargeAura: brillo alrededor del personaje y de su raqueta mientras se carga.
 * Todo son pocos objetos con tween que se destruyen solos; hay un tope de efectos simultáneos para móviles.
 */
export type ImpactTier = 'soft' | 'medium' | 'strong' | 'max';

/** Tramos de potencia: 0-35 % suave, 36-75 % medio, 76-99 % fuerte, 100 % máximo. */
export function tierOf(power: number): ImpactTier {
  if (power >= 0.995) return 'max';
  if (power > 0.75) return 'strong';
  if (power > 0.35) return 'medium';
  return 'soft';
}

/** Cómo se ve la estela de la pelota en cada tramo (intensidad 0..1 y color). */
export const TIER_TRAIL: Record<ImpactTier, { boost: number; color: number }> = {
  soft: { boost: 0, color: 0xffffff },
  medium: { boost: 0.45, color: 0x8fd8ff },
  strong: { boost: 0.8, color: 0x4fb0ff },
  max: { boost: 1, color: 0xffd23f },
};

const BLUE = 0x4fb0ff;
const CYAN = 0xbfe8ff;
const GOLD = 0xffd23f;
const MAX_ACTIVE = 36;
let active = 0;

/** Brillo radial compartido con HyperAura (misma clave); se crea una sola vez. */
export function ensureGlow(scene: Phaser.Scene) {
  if (scene.textures.exists('fx-glow')) return;
  const S = 64;
  const tex = scene.textures.createCanvas('fx-glow', S, S);
  if (!tex) return;
  const ctx = tex.getContext();
  const gr = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, S, S);
  tex.refresh();
}

/** Lanza un objeto con tween y lo cuenta para el tope de efectos simultáneos. */
function fxTween(scene: Phaser.Scene, obj: Phaser.GameObjects.GameObject, props: object, duration: number, delay = 0) {
  active++;
  scene.tweens.add({
    targets: obj,
    ...props,
    duration,
    delay,
    ease: 'Quad.easeOut',
    onComplete: () => {
      active--;
      obj.destroy();
    },
  });
}

/**
 * Efecto de impacto en (x, y) de pantalla. `power` es la potencia real del golpe (0..1).
 * Devuelve el tramo para que la escena ajuste la estela de la pelota.
 */
export function playImpact(scene: Phaser.Scene, x: number, y: number, power: number): ImpactTier {
  ensureGlow(scene);
  const tier = tierOf(power);
  if (active > MAX_ACTIVE) return tier; // móvil: si ya hay muchos efectos, solo se mantiene la estela

  const glow = (color: number, from: number, to: number, ms: number, delay = 0) => {
    const im = scene.add.image(x, y, 'fx-glow').setTint(color).setBlendMode(Phaser.BlendModes.ADD).setDepth(3600).setScale(from);
    fxTween(scene, im, { scale: to, alpha: 0 }, ms, delay);
  };
  const ring = (color: number, w: number, to: number, ms: number, delay = 0) => {
    const r = scene.add.circle(x, y, 14, color, 0).setStrokeStyle(w, color).setDepth(3601).setBlendMode(Phaser.BlendModes.ADD);
    fxTween(scene, r, { scale: to, alpha: 0 }, ms, delay);
  };
  const sparks = (n: number, colors: number[], dist: number, size: number) => {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.5;
      const d = dist * (0.6 + Math.random() * 0.6);
      const p = scene.add.circle(x, y, size, colors[i % colors.length], 1).setDepth(3602).setBlendMode(Phaser.BlendModes.ADD);
      fxTween(scene, p, { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, scale: 0.2, alpha: 0 }, 260 + Math.random() * 120);
    }
  };

  switch (tier) {
    case 'soft':
      glow(0xffffff, 0.35, 0.9, 150);
      break;
    case 'medium':
      glow(CYAN, 0.45, 1.6, 210);
      glow(BLUE, 0.3, 1.1, 260);
      sparks(5, [CYAN, 0xffffff], 34, 3);
      break;
    case 'strong':
      glow(BLUE, 0.5, 2.3, 260);
      glow(GOLD, 0.25, 1.1, 220);
      ring(CYAN, 4, 2.6, 240);
      sparks(8, [BLUE, GOLD, 0xffffff], 50, 3.5);
      break;
    case 'max':
      glow(GOLD, 0.6, 3.4, 340);
      glow(BLUE, 0.4, 2.8, 380);
      glow(0xffffff, 0.3, 1.3, 180);
      ring(GOLD, 6, 3.6, 360);
      ring(BLUE, 4, 4.6, 420, 70);
      sparks(12, [GOLD, BLUE, 0xffffff], 78, 4);
      scene.cameras.main.shake(110, 0.005);
      break;
  }
  return tier;
}

/**
 * Brillo de energía alrededor del personaje y de su raqueta durante la carga.
 * Solo 2 imágenes aditivas (sin partículas): el efecto crece con la carga y late al llegar al máximo.
 */
export class ChargeAura {
  private body: Phaser.GameObjects.Image;
  private racket: Phaser.GameObjects.Image;
  private t = 0;

  constructor(scene: Phaser.Scene) {
    ensureGlow(scene);
    this.body = scene.add.image(0, 0, 'fx-glow').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.racket = scene.add.image(0, 0, 'fx-glow').setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
  }

  /**
   * @param x,y pies del personaje en pantalla; @param k escala del personaje; @param side +1/-1 lado de la raqueta
   * @param value carga 0..1; @param depth profundidad del personaje
   */
  update(dt: number, x: number, y: number, k: number, side: number, value: number, depth: number) {
    this.t += dt;
    const full = value >= 1;
    const beat = full ? 0.5 + 0.5 * Math.sin(this.t * 10) : 0;
    const col = full ? GOLD : BLUE;
    const a = (0.1 + 0.22 * value) * (full ? 1.5 + 0.5 * beat : 1);
    const sz = (1.7 + 1.1 * value + beat * 0.15) * (k / 0.9);
    this.body.setVisible(true).setTint(col).setAlpha(Math.min(0.55, a)).setScale(sz).setPosition(x, y - 70 * k).setDepth(depth - 0.4);
    this.racket
      .setVisible(true)
      .setTint(full ? 0xfff2a8 : CYAN)
      .setAlpha(Math.min(0.7, a * 1.3))
      .setScale(sz * 0.5)
      .setPosition(x + side * 52 * k, y - 62 * k)
      .setDepth(depth + 1);
  }

  hide() {
    this.t = 0;
    this.body.setVisible(false);
    this.racket.setVisible(false);
  }

  destroy() {
    this.body.destroy();
    this.racket.destroy();
  }
}
