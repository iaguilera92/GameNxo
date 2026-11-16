import Phaser from 'phaser';
import { Character, playerLook } from '../objects/Character';
import { HyperAura } from '../objects/HyperAura';
import { ZoneFx, zoneEyes } from './ZoneFx';
import { applyCharColor } from './CharColorFx';
import { getProfile } from '../logic/Profile';
import { ZONE_SKINS, type ZoneSkinDef, isZoneSkin } from '../domain/zoneSkins';
import type { DemoRect, PowerDemo } from '../ui/PowerDialog';

/**
 * Demostración de un ESTILO DE ZONA (Tienda, "VER EN ACCIÓN"; 16-11-2026): tu personaje de frente, en guardia sobre un fondo oscuro, entra en
 * Zona cada pocos segundos con el destello, el aura y el rayo de los ojos de ese estilo (los mismos objetos del partido: HyperAura y ZoneFx).
 * Todo vive en un escenario (`stage`) dentro de la pantalla de la televisión: los efectos se crean con un proxy de la escena que los mete ahí.
 */
class ZoneDemo implements PowerDemo {
  private readonly stage: Phaser.GameObjects.Container;
  private readonly ch: Character;
  private aura: HyperAura;
  /** la escena con `add` hacia el escenario (para rehacer el aura al cambiar de estilo) */
  private readonly st: Phaser.Scene;
  private readonly fx: ZoneFx;
  private readonly flash: Phaser.GameObjects.Rectangle;
  private active = false;
  private destroyed = false;
  private t = 0;
  private on = false;
  private readonly tick = (_t: number, delta: number) => this.frame(Math.min(0.05, delta / 1000));

  constructor(private readonly scene: Phaser.Scene, parent: Phaser.GameObjects.Container, outer: DemoRect, inner: DemoRect, private readonly skin: string, private look: ZoneSkinDef) {
    this.stage = scene.add.container(0, 0);
    parent.add(this.stage);
    const stage = this.stage;
    const add = new Proxy(scene.add, {
      get(target, prop) {
        const v = Reflect.get(target, prop, target) as unknown;
        if (typeof v !== 'function') return v;
        return (...args: unknown[]) => {
          const o = (v as (...a: unknown[]) => unknown).apply(target, args);
          if (o instanceof Phaser.GameObjects.GameObject) stage.add(o);
          return o;
        };
      },
    });
    const st = { add, make: scene.make, tweens: scene.tweens, textures: scene.textures, time: scene.time } as unknown as Phaser.Scene;
    this.st = st;
    // fondo: noche con un suelo de cancha que se pierde
    const bg = scene.add.graphics();
    bg.fillStyle(0x070d22, 1).fillRect(outer.x, outer.y, outer.w, outer.h);
    bg.fillStyle(0x12306e, 0.55).fillEllipse(inner.x + inner.w / 2, inner.y + inner.h * 0.9, inner.w * 0.9, inner.h * 0.28);
    bg.lineStyle(3, 0xffffff, 0.12).lineBetween(inner.x + inner.w * 0.1, inner.y + inner.h * 0.82, inner.x + inner.w * 0.9, inner.y + inner.h * 0.82);
    stage.add(bg);
    // tu personaje, de frente, grande y centrado
    const k = (inner.h * 0.78) / 150;
    this.ch = new Character(scene, inner.x + inner.w / 2, inner.y + inner.h * 0.9, playerLook(skin), 'front').setScale(k);
    stage.add(this.ch);
    const color = getProfile().color;
    if (color !== 'classic') applyCharColor(this.ch, color, skin);
    // (16-11-2026) en REPOSO, no en guardia: setReady pone la pose de carga del golpe (agachado) y el rayo, medido en el reposo
    // (ZONE_EYES), quedaba en el pelo
    this.aura = new HyperAura(st, this.ch, look.aura, look.auraPal);
    this.fx = new ZoneFx(st);
    this.fx.setLook(look);
    this.fx.eyeDot = 2.5; // (usuario 16-11-2026) punto del ojo más chico en la demo
    this.flash = scene.add.rectangle(outer.x + outer.w / 2, outer.y + outer.h / 2, outer.w, outer.h, look.flash, 0).setBlendMode(Phaser.BlendModes.ADD);
    stage.add(this.flash);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick);
  }

  /**
   * (16-11-2026) cambia de ESTILO al elegir otro en el diálogo de Personalizar (la demo se crea una vez y luego solo recibe el id): antes
   * no hacía nada y se seguía viendo el primero (sin el aura ni el color del elegido)
   */
  setPower(id: string | undefined) {
    if (this.destroyed || !id || !isZoneSkin(id) || id === this.look.id) return;
    const was = this.on;
    this.zone(false);
    this.look = ZONE_SKINS[id];
    this.aura.destroy();
    this.aura = new HyperAura(this.st, this.ch, this.look.aura, this.look.auraPal);
    this.fx.setLook(this.look);
    this.flash.setFillStyle(this.look.flash, 1).setAlpha(0);
    if (was) this.zone(true);
  }

  setActive(on: boolean) {
    if (this.destroyed) return;
    this.active = on;
    if (!on) this.zone(false);
    else this.t = 0.6; // entra en Zona enseguida
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick);
    this.aura.destroy();
    this.fx.destroy();
    const all: Phaser.GameObjects.GameObject[] = [];
    const walk = (o: Phaser.GameObjects.GameObject) => {
      all.push(o);
      (o as Phaser.GameObjects.Container).list?.forEach(walk);
    };
    walk(this.stage);
    this.scene.tweens.killTweensOf(all);
    if (this.stage.scene) this.stage.destroy(true);
  }

  /** Enciende / apaga la Zona (con el destello del estilo al encender). */
  private zone(on: boolean) {
    if (on === this.on) return;
    this.on = on;
    if (on) {
      if (!this.look.noAura) this.aura.start(this.look.aura);
      this.fx.start();
      this.flash.setAlpha(0.45);
      this.scene.tweens.add({ targets: this.flash, alpha: 0, duration: 520 });
      this.scene.tweens.add({ targets: this.ch, scaleX: this.ch.scaleX * 1.05, scaleY: this.ch.scaleY * 1.05, duration: 120, yoyo: true });
    } else {
      this.aura.stop();
      this.fx.stop();
    }
  }

  /**
   * (16-11-2026, usuario) el reposo sube y baja (frames del idle y rebote del torso) y el rayo no atinaba al ojo: se congela en el frame 1
   * del reposo, donde se midieron los ojos (ZONE_EYES), y sin rebote del torso. El aura y el rayo siguen animados.
   */
  private freezePose() {
    const t = this.ch.torso;
    if (t.y !== 0 || t.scaleY !== 1) {
      this.scene.tweens.killTweensOf(t);
      t.y = 0;
      t.scaleY = 1;
    }
    const walk = (o: Phaser.GameObjects.GameObject) => {
      if (o instanceof Phaser.GameObjects.Sprite) {
        const a = o.anims.currentAnim;
        if (a && !o.anims.isPaused) o.anims.pause(a.frames[0]);
      }
      (o as Phaser.GameObjects.Container).list?.forEach(walk);
    };
    walk(t);
  }

  private frame(dt: number) {
    if (!this.active || this.destroyed || !this.stage.scene) return;
    // (usuario 16-11-2026) la Zona queda SIEMPRE encendida (antes: 4 s sí, 1,2 s no y el rayo desaparecía)
    this.t += dt;
    this.zone(true);
    // (16-11-2026, usuario) QUIETO y de frente: con el vaivén el rayo no atinaba al ojo. El rayo sale SOLO del ojo del lado IZQUIERDO de la
    // pantalla y la estela se va hacia afuera (izquierda), sin cruzar la cara: dx negativo y lado +1 (ZoneFx: ojo = pies + lado·dx; estela hacia −lado)
    this.ch.facing = 1;
    this.freezePose();
    this.aura.update(dt);
    const k = this.ch.scaleY;
    const head = { x: this.ch.x, y: this.ch.y - 150 * k };
    const e = zoneEyes(this.skin, 'front');
    this.fx.update(dt, head, { x: this.ch.x, y: this.ch.y }, k, this.ch.depth, 1, false, { up: e.up - 4, dx: -e.dx + 3 }); // (usuario 16-11-2026) un poco más abajo y a la derecha: justo en el ojo
  }
}

export function createZoneDemo(scene: Phaser.Scene, parent: Phaser.GameObjects.Container, outer: DemoRect, inner: DemoRect, skin: string, look: ZoneSkinDef): PowerDemo {
  return new ZoneDemo(scene, parent, outer, inner, skin, look);
}
