import Phaser from 'phaser';
import { C } from '../ui/theme';
import { getSkin, type SkinId } from '../characters/skins';

export interface CharacterLook {
  shirt: number;
  shirtDark: number;
  shorts: number;
  hair: number;
  band: number;
  /** 'cap' = gorra; 'spiky' = pelo de picos con cinta */
  style: 'cap' | 'spiky';
  skin: number;
  skinDark: number;
  shoe: number;
  /** personaje con imágenes (si están disponibles); si no, se dibuja el vectorial */
  id?: SkinId;
}

export const PLAYER_LOOK: CharacterLook = {
  id: 'player',
  shirt: C.blue,
  shirtDark: C.blueDark,
  shorts: 0x2a3fa8,
  hair: 0x5a3416,
  band: C.yellow,
  style: 'cap',
  skin: 0xffc58a,
  skinDark: 0xe39a5e,
  shoe: 0xffffff,
};
export const BOT_LOOK: CharacterLook = {
  id: 'rival',
  shirt: C.red,
  shirtDark: C.redDark,
  shorts: 0x2b2b3d,
  hair: C.purple,
  band: 0xffffff,
  style: 'spiky',
  skin: 0xf2b27c,
  skinDark: 0xd1834d,
  shoe: C.yellow,
};

/** 'back' = visto de espaldas (jugador, cámara detrás); 'front' = de frente (rival / menús). */
export type CharacterView = 'front' | 'back';

const O = C.outline;
const PI = Math.PI;
// Tamaños/offsets de las texturas horneadas (origen = pies / hombro)
const BODY_OX = 48, BODY_OY = 152, BODY_W = 96, BODY_H = 156;
const RK_OX = 12, RK_OY = 32, RK_W = 112, RK_H = 64;

/** Mezcla un color con blanco (t>0) o negro (t<0). */
function shade(color: number, t: number) {
  const c = Phaser.Display.Color.IntegerToColor(color);
  const m = t >= 0 ? 255 : 0;
  const k = Math.abs(t);
  return Phaser.Display.Color.GetColor(c.red + (m - c.red) * k, c.green + (m - c.green) * k, c.blue + (m - c.blue) * k);
}

/**
 * Personaje estilo "brawler": cabeza grande, contorno grueso, colores saturados,
 * brillos y sombreado plano. Se dibuja UNA vez en texturas (rápido en runtime).
 * El origen (0,0) está en los pies.
 *   shadow            sombra en el suelo
 *   rig               se voltea (scaleX) para poner la raqueta a izquierda/derecha
 *     torso           cuerpo (rebota en idle/carrera)
 *     racketArm       brazo + raqueta, pivota en el hombro
 */
export class Character extends Phaser.GameObjects.Container {
  readonly shadow: Phaser.GameObjects.Ellipse;
  readonly rig: Phaser.GameObjects.Container;
  readonly torso: Phaser.GameObjects.Container;
  readonly racketArm: Phaser.GameObjects.Container;
  private bobTween?: Phaser.Tweens.Tween;
  private swinging = false;
  private charging = false;
  private moving = false;
  private _facing = 1;
  readonly restAngle = -60;

  constructor(scene: Phaser.Scene, x: number, y: number, look: CharacterLook, view: CharacterView = 'front') {
    super(scene, x, y);

    this.shadow = scene.add.ellipse(0, 0, 78, 26, 0x000000, 0.3);
    this.add(this.shadow);

    this.rig = scene.add.container(0, 0);
    this.add(this.rig);

    this.torso = scene.add.container(0, 0);
    this.rig.add(this.torso);
    // imágenes si el set está completo; si no, el personaje vectorial de siempre
    const skin = getSkin(scene, look.id, view);
    if (skin) {
      const b = skin.body;
      const img = scene.add.image(0, 0, b.key).setScale(b.scale);
      this.torso.add(img.setOrigin(b.ox / img.width, b.oy / img.height));
    } else {
      const bkey = `ch2-body-${view}-${look.style}-${look.shirt}-${look.shorts}-${look.hair}-${look.band}-${look.skin}-${look.shoe}`;
      if (!scene.textures.exists(bkey)) this.bakeBody(scene, bkey, look, view);
      this.torso.add(scene.add.image(0, 0, bkey).setOrigin(BODY_OX / BODY_W, BODY_OY / BODY_H));
    }

    // brazo con raqueta (pivota en el hombro derecho)
    this.racketArm = scene.add.container(skin ? skin.shoulder.x : 22, skin ? skin.shoulder.y : -64);
    if (skin) {
      const a = skin.arm;
      const img = scene.add.image(0, 0, a.key).setScale(a.scale).setAngle(-a.angle);
      this.racketArm.add(img.setOrigin(a.ox / img.width, a.oy / img.height));
    } else {
      const rkey = `ch2-racket-${look.band}-${look.shirt}-${look.skin}`;
      if (!scene.textures.exists(rkey)) this.bakeRacket(scene, rkey, look);
      this.racketArm.add(scene.add.image(0, 0, rkey).setOrigin(RK_OX / RK_W, RK_OY / RK_H));
    }
    this.racketArm.angle = this.restAngle;
    this.rig.add(this.racketArm);

    scene.add.existing(this);
    this.startBob(1100, 3);
  }

  // ------------------------------------------------------------ dibujo
  private bakeRacket(scene: Phaser.Scene, key: string, look: CharacterLook) {
    const r = scene.make.graphics({}, false);
    r.translateCanvas(RK_OX, RK_OY);
    const frame = look.band === 0xffffff ? C.red : look.band;
    // brazo (manga + piel + muñequera)
    r.fillStyle(look.skin).fillRoundedRect(-4, -7, 28, 14, 7);
    r.lineStyle(4, O).strokeRoundedRect(-4, -7, 28, 14, 7);
    r.fillStyle(look.shirt).fillRoundedRect(-9, -10, 14, 20, 7);
    r.lineStyle(4, O).strokeRoundedRect(-9, -10, 14, 20, 7);
    r.fillStyle(0xffffff).fillRoundedRect(14, -8, 8, 16, 3);
    r.lineStyle(3, O).strokeRoundedRect(14, -8, 8, 16, 3);
    // mango
    r.fillStyle(0x3b3358).fillRoundedRect(22, -5, 26, 10, 4);
    r.lineStyle(4, O).strokeRoundedRect(22, -5, 26, 10, 4);
    r.fillStyle(0xffffff, 0.25).fillRect(26, -3, 18, 2);
    // puño sobre el mango
    r.fillStyle(look.skin).fillCircle(26, 0, 8);
    r.lineStyle(4, O).strokeCircle(26, 0, 8);
    r.fillStyle(0xffffff, 0.4).fillCircle(23, -3, 2.5);
    // cabeza de la raqueta
    r.fillStyle(0xf4f7ff).fillEllipse(68, 0, 40, 32);
    r.lineStyle(1.5, 0x9aa0c0, 1);
    for (let i = -10; i <= 10; i += 5) r.lineBetween(68 + i, -13, 68 + i, 13);
    for (let j = -9; j <= 9; j += 4.5) r.lineBetween(52, j, 84, j);
    r.lineStyle(10, O).strokeEllipse(68, 0, 46, 38);
    r.lineStyle(5, frame).strokeEllipse(68, 0, 46, 38);
    r.lineStyle(2, 0xffffff, 0.6).beginPath().arc(68, 0, 21, PI * 1.05, PI * 1.45).strokePath();
    r.generateTexture(key, RK_W, RK_H);
    r.destroy();
  }

  private bakeBody(scene: Phaser.Scene, key: string, look: CharacterLook, view: CharacterView) {
    const g = scene.make.graphics({}, false);
    g.translateCanvas(BODY_OX, BODY_OY);
    const back = view === 'back';
    const { skin, skinDark } = look;

    /** rectángulo redondeado con relleno + contorno grueso */
    const rr = (x: number, y: number, w: number, h: number, r: number, fill: number, lw = 4) => {
      g.fillStyle(fill).fillRoundedRect(x, y, w, h, r);
      g.lineStyle(lw, O).strokeRoundedRect(x, y, w, h, r);
    };
    const circ = (x: number, y: number, r: number, fill: number, lw = 4) => {
      g.fillStyle(fill).fillCircle(x, y, r);
      g.lineStyle(lw, O).strokeCircle(x, y, r);
    };

    // --- piernas
    rr(-18, -32, 14, 24, 6, skin);
    rr(4, -32, 14, 24, 6, skin);
    g.fillStyle(skinDark, 0.5).fillRect(-8, -30, 3, 20).fillRect(14, -30, 3, 20);
    // calcetines
    rr(-19, -18, 16, 10, 4, 0xffffff, 3);
    rr(3, -18, 16, 10, 4, 0xffffff, 3);
    // zapatillas grandes
    for (const sx of [-1, 1]) {
      const cx = sx * 12;
      g.fillStyle(look.shoe).fillEllipse(cx, -6, 28, 17);
      g.fillStyle(shade(look.shoe, -0.25)).fillEllipse(cx, -1, 28, 8);
      g.lineStyle(4, O).strokeEllipse(cx, -6, 28, 17);
      g.fillStyle(0xffffff, 0.55).fillEllipse(cx - 4, -10, 10, 4);
      g.fillStyle(look.shirt).fillRect(cx - 3, -7, 6, 3);
    }

    // --- shorts
    rr(-24, -50, 48, 24, 9, look.shorts);
    g.fillStyle(look.shirt).fillRect(-24 + 3, -46, 5, 16); // franja lateral
    g.fillStyle(shade(look.shorts, 0.25), 0.7).fillRoundedRect(-16, -47, 20, 5, 3);
    g.lineStyle(4, O).strokeRoundedRect(-24, -50, 48, 24, 9);

    // --- brazo izquierdo (el derecho lleva la raqueta)
    rr(-38, -74, 15, 30, 7, skin);
    rr(-39, -82, 18, 18, 8, look.shirt);
    rr(-38, -52, 16, 7, 3, 0xffffff, 3);
    circ(-30, -42, 8, skin);
    g.fillStyle(0xffffff, 0.4).fillCircle(-33, -45, 2.5);

    // --- torso
    g.fillStyle(look.shirtDark).fillRoundedRect(-28, -86, 56, 46, 17);
    g.fillStyle(look.shirt).fillRoundedRect(-28, -86, 56, 35, 17);
    g.fillStyle(shade(look.shirt, 0.45), 0.7).fillRoundedRect(-21, -82, 24, 8, 4); // brillo
    g.lineStyle(4, O).strokeRoundedRect(-28, -86, 56, 46, 17);
    // cuello
    g.fillStyle(0xffffff).fillRoundedRect(-11, -88, 22, 8, 4);
    g.lineStyle(3, O).strokeRoundedRect(-11, -88, 22, 8, 4);
    // emblema / dorsal
    circ(0, -61, 11, 0xffffff, 4);
    circ(0, -61, 6, look.band === 0xffffff ? look.shirtDark : look.band, 3);
    if (back) g.fillStyle(look.shirtDark).fillRect(-1.5, -68, 3, 14);

    // --- cabeza (grande, estilo brawler)
    const HX = 0;
    const HY = -106;
    const HR = 33;
    // orejas
    circ(-HR + 1, HY + 3, 7, skin, 3);
    circ(HR - 1, HY + 3, 7, skin, 3);
    // cara
    circ(HX, HY, HR, skin, 4);
    g.fillStyle(skinDark, 0.4).fillEllipse(0, HY + 25, 44, 14);
    g.fillStyle(skin).fillEllipse(0, HY - 1, 58, 52);

    if (!back) {
      // ojos grandes con brillo
      for (const sx of [-1, 1]) {
        const ex = sx * 11;
        g.fillStyle(0xffffff).fillEllipse(ex, HY + 6, 14, 17);
        g.lineStyle(3, O).strokeEllipse(ex, HY + 6, 14, 17);
        g.fillStyle(O).fillEllipse(ex - sx, HY + 8, 9, 11);
        g.fillStyle(0xffffff).fillCircle(ex - 2, HY + 4, 2.4).fillCircle(ex + 1, HY + 11, 1.2);
      }
      // mejillas
      g.fillStyle(0xff7a8a, 0.55).fillEllipse(-22, HY + 18, 10, 6).fillEllipse(22, HY + 18, 10, 6);
      // boca abierta sonriente
      g.fillStyle(0x6a0f2a).beginPath().arc(0, HY + 19, 8, 0, PI, false).closePath().fillPath();
      g.fillStyle(0xffffff).fillRect(-5, HY + 19, 10, 3);
      g.fillStyle(0xff6f8a).fillEllipse(0, HY + 25, 8, 4);
      g.lineStyle(3, O).beginPath().arc(0, HY + 19, 8, 0, PI, false).closePath().strokePath();
    } else {
      // nuca
      g.fillStyle(skinDark, 0.45).fillEllipse(0, HY + 24, 30, 10);
    }

    // --- pelo / gorra
    if (look.style === 'cap') {
      // domo
      const capCol = look.band;
      g.fillStyle(capCol).beginPath().arc(HX, HY - 2, HR + 1, back ? PI * 0.88 : PI, back ? PI * 2.12 : PI * 2, false).closePath().fillPath();
      g.fillStyle(shade(capCol, -0.18)).beginPath().arc(HX, HY - 2, HR + 1, back ? PI * 0.88 : PI, back ? PI * 2.12 : PI * 2, false).closePath().fillPath();
      g.fillStyle(capCol).beginPath().arc(HX, HY - 6, HR - 2, PI * 1.02, PI * 1.98, false).closePath().fillPath();
      g.lineStyle(4, O).beginPath().arc(HX, HY - 2, HR + 1, back ? PI * 0.88 : PI, back ? PI * 2.12 : PI * 2, false).closePath().strokePath();
      g.fillStyle(0xffffff, 0.45).fillEllipse(-11, HY - 24, 16, 7);
      circ(0, HY - 34, 3.5, shade(capCol, -0.2), 3); // botón
      if (!back) {
        // visera hacia la cámara
        g.fillStyle(shade(capCol, -0.28)).fillEllipse(0, HY - 8, 58, 12);
        g.lineStyle(4, O).strokeEllipse(0, HY - 8, 58, 12);
        g.fillStyle(0xffffff, 0.3).fillEllipse(-10, HY - 10, 20, 3);
      } else {
        // cierre trasero + mechón de pelo
        rr(-12, HY + 2, 24, 7, 3, shade(capCol, -0.3), 3);
        g.fillStyle(look.hair).fillEllipse(0, HY + 14, 36, 12);
        g.lineStyle(3, O).strokeEllipse(0, HY + 14, 36, 12);
      }
    } else {
      // pelo de picos + cinta
      const hc = look.hair;
      const spikes: [number, number, number, number, number, number][] = [
        [-30, HY - 12, -26, HY - 42, -12, HY - 24],
        [-16, HY - 26, -6, HY - 50, 4, HY - 28],
        [0, HY - 28, 14, HY - 50, 20, HY - 24],
        [14, HY - 24, 30, HY - 40, 31, HY - 10],
      ];
      for (const s of spikes) {
        g.fillStyle(hc).fillTriangle(s[0], s[1], s[2], s[3], s[4], s[5]);
        g.lineStyle(4, O).strokeTriangle(s[0], s[1], s[2], s[3], s[4], s[5]);
      }
      const a0 = back ? PI * 0.9 : PI;
      const a1 = back ? PI * 2.1 : PI * 2;
      g.fillStyle(hc).beginPath().arc(HX, HY - 2, HR + 1, a0, a1, false).closePath().fillPath();
      g.lineStyle(4, O).beginPath().arc(HX, HY - 2, HR + 1, a0, a1, false).closePath().strokePath();
      g.fillStyle(0xffffff, 0.4).fillEllipse(-10, HY - 20, 16, 7);
      if (!back) {
        // flequillo en picos sobre la frente
        for (const fx of [-18, -4, 10]) {
          g.fillStyle(hc).fillTriangle(fx, HY - 9, fx + 8, HY - 9, fx + 4, HY - 3);
        }
      }
      // cinta
      rr(-HR - 1, HY - 17, (HR + 1) * 2, 9, 3, look.band, 4);
      g.fillStyle(look.shirt).fillRect(-HR + 8, HY - 15, 6, 5).fillRect(HR - 14, HY - 15, 6, 5);
      if (!back) {
        // cejas enfadadas pero simpáticas
        g.lineStyle(5, O).lineBetween(-20, HY - 6, -4, HY - 1).lineBetween(20, HY - 6, 4, HY - 1);
      }
    }

    g.generateTexture(key, BODY_W, BODY_H);
    g.destroy();
  }

  /** Lado de la raqueta en pantalla: 1 = derecha, -1 = izquierda. */
  get facing() {
    return this._facing;
  }
  set facing(f: number) {
    this._facing = f >= 0 ? 1 : -1;
    this.rig.scaleX = this._facing;
  }

  private startBob(duration: number, amp: number) {
    this.bobTween?.stop();
    this.torso.y = 0;
    this.bobTween = this.scene.tweens.add({
      targets: this.torso,
      y: -amp,
      scaleY: 1 + amp * 0.006,
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Cambia la animación entre idle y carrera. */
  setMoving(m: boolean) {
    if (m === this.moving) return;
    this.moving = m;
    if (m) this.startBob(130, 6);
    else this.startBob(1100, 3);
  }

  /** Pose de tiro cargado: raqueta muy atrás, temblando, hasta golpear o cancelar. */
  setCharging(on: boolean) {
    if (on === this.charging) return;
    this.charging = on;
    if (this.swinging) return;
    this.scene.tweens.killTweensOf(this.racketArm);
    if (on) {
      this.scene.tweens.add({
        targets: this.racketArm,
        angle: -115,
        duration: 160,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (!this.charging) return;
          this.scene.tweens.add({ targets: this.racketArm, angle: -109, duration: 55, yoyo: true, repeat: -1 });
        },
      });
    } else {
      this.scene.tweens.add({ targets: this.racketArm, angle: this.restAngle, duration: 200, ease: 'Quad.easeOut' });
    }
  }

  /** Animación de golpe: preparación hacia atrás y barrido por delante del cuerpo. */
  swing(power = false) {
    if (this.swinging) return;
    this.swinging = true;
    this.charging = false;
    this.scene.tweens.killTweensOf(this.racketArm);
    this.scene.tweens.chain({
      targets: this.racketArm,
      tweens: [
        { angle: -5, duration: 60, ease: 'Quad.easeOut' },
        { angle: power ? 190 : 150, duration: power ? 120 : 100, ease: 'Quad.easeIn' },
        { angle: this.restAngle, duration: 280, ease: 'Back.easeOut' },
      ],
      onComplete: () => (this.swinging = false),
    });
    this.scene.tweens.add({ targets: this.rig, scaleY: 0.9, duration: 80, yoyo: true, ease: 'Quad.easeOut' });
  }
}




