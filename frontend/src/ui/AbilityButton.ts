import Phaser from 'phaser';
import { C, textStyle } from './theme';
import { drawAbilityIcon, drawDisc } from './icons';
import type { AbilityIcon } from '../logic/Abilities';
import type { SmashPower } from '../domain/smashPowers';

/** Botón de habilidad circular con cooldown visible (relleno radial + anillo + segundos). */
export class AbilityButton extends Phaser.GameObjects.Container {
  private remaining = 0;
  private overlay: Phaser.GameObjects.Graphics;
  private ring: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Arc;
  private secs: Phaser.GameObjects.Text;
  private face: Phaser.GameObjects.Container;
  private armed = false;
  private hintGlow: Phaser.GameObjects.Arc;
  private hinting = false;
  enabled = true;
  // variante INFERNO DRIVE (mismo botón): aspecto de fuego, sin enfriamiento, con medidor de carga
  private infernoMode = false;
  private hyperWave?: Phaser.GameObjects.Arc;
  private labelText!: Phaser.GameObjects.Text;
  private subText!: Phaser.GameObjects.Text;
  private baseLabel = '';
  private baseSub = '';
  private fireRing?: Phaser.GameObjects.Arc;
  private meter?: Phaser.GameObjects.Container;
  private meterPips?: Phaser.GameObjects.Graphics;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    private readonly radius: number,
    private readonly cooldown: number,
    color: number,
    colorDark: number,
    icon: AbilityIcon,
    label: string,
    /** Devuelve false si ahora no se puede usar (no consume el cooldown). */
    private readonly onActivate: () => boolean,
  ) {
    super(scene, x, y);
    this.setScrollFactor(0).setDepth(5000);
    const R = radius;

    this.glow = scene.add.circle(0, 0, R + 20, 0xff9a2e, 0.0);
    this.add(this.glow);
    // aviso dorado (p. ej. SMASH potenciado disponible); independiente del brillo de "armado"
    this.hintGlow = scene.add.circle(0, 0, R + 16, 0xffc42e, 0).setStrokeStyle(5, 0xfff1b8, 0);
    this.add(this.hintGlow);

    this.face = scene.add.container(0, 0);
    this.add(this.face);
    const g = scene.add.graphics();
    drawDisc(g, R, color, colorDark);
    drawAbilityIcon(g, icon, R);
    this.face.add(g);

    this.overlay = scene.add.graphics();
    this.ring = scene.add.graphics();
    this.add([this.overlay, this.ring]);
    this.secs = scene.add.text(0, 0, '', textStyle(Math.round(R * 0.6))).setOrigin(0.5);
    this.add(this.secs);
    this.baseLabel = label;
    this.labelText = scene.add.text(0, R + 22, label, textStyle(20)).setOrigin(0.5);
    this.add(this.labelText);
    // nombre del poder equipado, en pequeño bajo la etiqueta
    this.subText = scene.add.text(0, R + 43, '', { fontFamily: '"Lilita One", "Arial Black", sans-serif', fontSize: '14px', color: '#cfe0ff', stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0.5);
    this.add(this.subText);

    this.setSize(R * 2 + 20, R * 2 + 20);
    this.setInteractive(new Phaser.Geom.Circle(R + 10, R + 10, R + 14), Phaser.Geom.Circle.Contains);
    this.on('pointerdown', () => this.tryActivate());
    scene.add.existing(this);
    this.redraw();
  }

  /** color del aro y del brillo con el botón armado (SMASH: el del poder elegido, SMASH_LOOK[el].ring) */
  private armedColor = 0xff9a2e;

  /** Cambia el color del aro y del brillo de "armado" (fuego = naranja de siempre). */
  setArmedColor(color: number) {
    this.armedColor = color;
    this.glow.setFillStyle(color, this.glow.fillAlpha);
    this.redraw();
  }

  /** Sustituye el dibujo por una imagen (si la textura no existe, se queda el dibujo). */
  setArt(key: string) {
    if (!this.scene.textures.exists(key)) return;
    this.face.removeAll(true);
    const d = this.radius * 2 + 16; // mismo tamaño que el disco dibujado (con su borde)
    this.face.add(this.scene.add.image(0, 0, key).setDisplaySize(d, d));
  }

  /** Bloquea / libera el botón (se ve atenuado y vibra si se pulsa mientras está bloqueado). */
  setEnabled(on: boolean) {
    this.enabled = on;
    this.redraw();
  }

  get ready() {
    // INFERNO DRIVE no depende del enfriamiento del SMASH
    return (this.infernoMode || this.remaining <= 0) && this.enabled;
  }

  get inferno() {
    return this.infernoMode;
  }

  /**
   * Cambia el botón a INFERNO DRIVE (tonos de fuego, aura y texto) o lo devuelve a su aspecto original.
   * Misma posición, tamaño y zona táctil.
   */
  /** Nombre del poder equipado (FUEGO, HIELO, DESTELLO…), bajo la etiqueta del botón. */
  setSubLabel(text: string) {
    this.baseSub = text;
    if (!this.infernoMode) this.subText.setText(text);
  }

  /** `sub` = nombre del poder de la ULTI mientras el botón está en ese modo. */
  setInferno(on: boolean, sub = '') {
    if (on === this.infernoMode) {
      if (on) this.subText.setText(sub);
      return;
    }
    this.infernoMode = on;
    const R = this.radius;
    for (const o of this.face.list) {
      const img = o as Phaser.GameObjects.Image;
      if (typeof img.setTexture !== 'function' || !img.texture) continue;
      // arte del botón en MORADO (hipercarga): copia del arte con el tono girado, creada una vez
      if (on) {
        const src = img.texture.key;
        if (!img.getData('baseKey')) img.setData('baseKey', src);
        const key = hyperTexture(this.scene, img.getData('baseKey') as string);
        if (key) img.setTexture(key);
        else img.setTint(0xb46bff, 0xe0b0ff, 0x6a1fe0, 0x9a45ff);
      } else {
        const base = img.getData('baseKey') as string | undefined;
        if (base) img.setTexture(base);
        img.clearTint();
      }
    }
    if (!this.fireRing) {
      this.fireRing = this.scene.add.circle(0, 0, R + 14, 0x7a2dff, 0.45).setStrokeStyle(6, 0xc77dff, 1).setVisible(false); // sin ADD: morado puro sobre cualquier cancha
      this.addAt(this.fireRing, 1);
      // onda de "hipercarga": anillo morado que sale del botón una y otra vez
      this.hyperWave = this.scene.add.circle(0, 0, R + 6, 0x000000, 0).setStrokeStyle(5, 0xb46bff, 1).setVisible(false);
      this.addAt(this.hyperWave, 1);
    }
    this.scene.tweens.killTweensOf(this.hyperWave!);
    this.hyperWave!.setVisible(on).setScale(1).setAlpha(1);
    if (on) this.scene.tweens.add({ targets: this.hyperWave, scale: 1.75, alpha: 0, duration: 750, repeat: -1, ease: 'Cubic.easeOut' });
    this.scene.tweens.killTweensOf(this.fireRing);
    this.fireRing.setVisible(on).setScale(1).setAlpha(1);
    if (on) {
      this.scene.tweens.add({ targets: this.fireRing, scale: 1.18, alpha: 0.5, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      // disponible: rebote + destello
      this.scene.tweens.add({ targets: this.face, scale: { from: 1.3, to: 1 }, duration: 420, ease: 'Back.easeOut' });
    }
    this.labelText.setText(on ? 'ULTI' : this.baseLabel).setColor(on ? '#e0b0ff' : '#ffffff');
    this.subText.setText(on ? sub : this.baseSub).setColor(on ? '#e0b0ff' : '#cfe0ff');
    this.redraw();
  }

  /**
   * Carga de la ULTI: anillo exterior del botón partido en `max` tramos (uno por punto ganado). Cada punto llena el
   * tramo siguiente (con un pequeño destello); con todos llenos, pulseMeter() avisa que la ULTI está cargada.
   */
  setMeter(n: number, max: number) {
    if (!this.meter) {
      this.meter = this.scene.add.container(0, 0);
      this.meterPips = this.scene.add.graphics();
      this.meter.add(this.meterPips);
      this.addAt(this.meter, 1); // detrás de la cara del botón y de su anillo de enfriamiento
      // la etiqueta y el poder bajan un poco para que el anillo no los tape
      const { r, w } = this.meterGeo;
      this.labelText.setY(r + w / 2 + 12);
      this.subText.setY(r + w / 2 + 32);
    }
    const prev = this.meterN;
    this.meterN = Math.max(0, Math.min(n, max));
    this.meterMax = max;
    this.drawMeter();
    // el tramo recién ganado se enciende con un destello
    if (this.meterN > prev && this.meterN < max) this.flashSegment(this.meterN - 1);
  }
  private meterN = 0;
  private meterMax = 3;

  /** radio y grosor del anillo de carga (por fuera del enfriamiento y del aro de "armado") */
  private get meterGeo() {
    return { r: this.radius + 25, w: 7, gap: 0.2 };
  }
  private segArc(i: number) {
    const { gap } = this.meterGeo;
    const span = (Math.PI * 2) / this.meterMax;
    const a0 = -Math.PI / 2 + i * span + gap / 2;
    return { a0, a1: a0 + span - gap };
  }

  private drawMeter() {
    const g = this.meterPips!.clear();
    const { r, w } = this.meterGeo;
    const full = this.meterN >= this.meterMax;
    for (let i = 0; i < this.meterMax; i++) {
      const { a0, a1 } = this.segArc(i);
      const on = i < this.meterN;
      // contorno oscuro + tramo (vacío = azul apagado; lleno = morado; todo lleno = morado claro)
      g.lineStyle(w + 4, C.outline, 0.9).beginPath().arc(0, 0, r, a0, a1, false).strokePath();
      g.lineStyle(w, on ? (full ? 0xd59bff : 0x9a45ff) : 0x2a3a66, 1).beginPath().arc(0, 0, r, a0, a1, false).strokePath();
      if (on) g.lineStyle(2, 0xf0d6ff, 0.8).beginPath().arc(0, 0, r - w / 2 + 1.5, a0 + 0.04, a1 - 0.04, false).strokePath();
    }
  }

  /** Destello sobre un tramo recién llenado. */
  private flashSegment(i: number) {
    const { r, w } = this.meterGeo;
    const { a0, a1 } = this.segArc(i);
    const f = this.scene.add.graphics();
    f.lineStyle(w + 6, 0xf0d6ff, 1).beginPath().arc(0, 0, r, a0, a1, false).strokePath();
    this.addAt(f, 2);
    this.scene.tweens.add({ targets: f, alpha: 0, scale: 1.12, duration: 420, ease: 'Cubic.easeOut', onComplete: () => f.destroy() });
  }

  /** ULTI cargada (los 3 tramos llenos): el anillo y el botón laten y sale una onda morada. */
  pulseMeter() {
    if (!this.meter) return;
    this.scene.tweens.killTweensOf(this.meter);
    this.meter.setScale(1);
    this.scene.tweens.add({ targets: this.meter, scale: { from: 1.22, to: 1 }, duration: 520, ease: 'Back.easeOut' });
    this.scene.tweens.add({ targets: this.face, scale: { from: 1.25, to: 1 }, duration: 520, ease: 'Back.easeOut' });
    const { r } = this.meterGeo;
    for (let k = 0; k < 2; k++) {
      const wave = this.scene.add.circle(0, 0, r, 0x000000, 0).setStrokeStyle(6, 0xd59bff, 1);
      this.addAt(wave, 1);
      this.scene.tweens.add({ targets: wave, scale: 1.6, alpha: 0, delay: k * 160, duration: 600, ease: 'Cubic.easeOut', onComplete: () => wave.destroy() });
    }
  }

  private shake() {
    this.scene.tweens.add({ targets: this.face, x: { from: -6, to: 6 }, duration: 50, yoyo: true, repeat: 2, onComplete: () => (this.face.x = 0) });
  }

  tryActivate(): boolean {
    if (!this.ready) {
      this.shake();
      return false;
    }
    this.scene.tweens.killTweensOf(this.face);
    this.face.setScale(1);
    this.face.x = 0;
    if (!this.onActivate()) {
      this.shake();
      return false;
    }
    if (!this.infernoMode) this.remaining = this.cooldown;
    this.scene.tweens.add({ targets: this.face, scale: 0.82, duration: 70, yoyo: true, ease: 'Quad.easeOut' });
    this.redraw();
    return true;
  }

  /** Adelanta la recarga `s` segundos (premio de la racha de PERFECTO). true = estaba recargando. */
  reduceCooldown(s: number): boolean {
    if (this.infernoMode || this.remaining <= 0) return false;
    this.remaining = Math.max(0, this.remaining - s);
    this.redraw();
    return true;
  }

  /** Aviso dorado pulsante (sin cambiar el cooldown ni el estado armado). */
  setHint(on: boolean) {
    if (on === this.hinting) return;
    this.hinting = on;
    this.scene.tweens.killTweensOf(this.hintGlow);
    if (on) {
      this.hintGlow.setScale(1).setFillStyle(0xffc42e, 0.35).setStrokeStyle(5, 0xfff1b8, 0.95);
      this.scene.tweens.add({ targets: this.hintGlow, scale: 1.18, alpha: { from: 1, to: 0.45 }, duration: 260, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    } else {
      this.hintGlow.setScale(1).setAlpha(1).setFillStyle(0xffc42e, 0).setStrokeStyle(5, 0xfff1b8, 0);
    }
  }

  setArmed(a: boolean) {
    this.armed = a;
    this.scene.tweens.killTweensOf(this.glow);
    if (a) {
      this.glow.setAlpha(0.6);
      this.scene.tweens.add({ targets: this.glow, alpha: 0.15, scale: 1.15, duration: 350, yoyo: true, repeat: -1 });
    } else {
      this.glow.setAlpha(0).setScale(1);
    }
    this.redraw();
  }

  update(dt: number) {
    if (this.remaining > 0) {
      this.remaining = Math.max(0, this.remaining - dt);
      if (this.remaining === 0) {
        // listo: rebote + destello
        this.scene.tweens.add({ targets: this.face, scale: { from: 1.25, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      }
      this.redraw();
    }
  }

  private redraw() {
    const R = this.radius;
    this.overlay.clear();
    this.ring.clear();
    // en modo INFERNO no se muestra el enfriamiento del SMASH (sigue contando por detrás)
    const busy = this.remaining > 0 && !this.infernoMode;
    this.face.setAlpha(busy || !this.enabled ? 0.55 : 1);
    if (busy) {
      const frac = this.remaining / this.cooldown; // parte que falta
      const start = -Math.PI / 2;
      // relleno oscuro radial (lo que falta por cargar)
      this.overlay.fillStyle(0x0b0620, 0.6);
      this.overlay.slice(0, 0, R - 2, start, start + frac * Math.PI * 2, false).fillPath();
      // anillo de progreso (lo ya cargado)
      this.ring.lineStyle(8, C.outline, 1).strokeCircle(0, 0, R + 12);
      this.ring.lineStyle(5, 0xffe066, 1);
      this.ring.beginPath();
      this.ring.arc(0, 0, R + 12, start, start + (1 - frac) * Math.PI * 2, false);
      this.ring.strokePath();
      this.secs.setText(String(Math.ceil(this.remaining)));
    } else {
      this.secs.setText('');
    }
    if (this.armed) this.ring.lineStyle(6, this.armedColor, 1).strokeCircle(0, 0, R + 16);
  }
}

/**
 * Copia de una textura con el tono girado a morado (canvas con filtro hue-rotate). null si no se puede
 * (sin canvas / sin filtros): entonces se usa un tinte.
 */
export function hyperTexture(scene: Phaser.Scene, key: string): string | null {
  const out = `${key}-hyper`;
  if (scene.textures.exists(out)) return out;
  const srcImg = scene.textures.get(key)?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!srcImg || !srcImg.width) return null;
  const tex = scene.textures.createCanvas(out, srcImg.width, srcImg.height);
  const ctx = tex?.getContext();
  if (!tex || !ctx || !('filter' in ctx)) return null;
  // rojo/naranja → morado
  ctx.filter = 'hue-rotate(-95deg) saturate(1.25) brightness(1.05)';
  ctx.drawImage(srcImg, 0, 0);
  ctx.filter = 'none';
  tex.refresh();
  return out;
}

/** Filtro de canvas por poder del SMASH (sobre el arte rojo/naranja del botón). */
const ELEMENT_FILTER: Record<Exclude<SmashPower, 'fire'>, string> = {
  ice: 'hue-rotate(205deg) saturate(1.15) brightness(1.1)', // azul hielo
  wind: 'hue-rotate(110deg) saturate(1.05) brightness(1.1)', // verde
  // amarillo eléctrico: girar el tono del rojo deja manchas naranja y verdes; se pasa a luz, se tiñe en sepia y se satura
  lightning: 'grayscale(1) sepia(1) saturate(5) hue-rotate(14deg) brightness(1.45)',
};

/**
 * Copia de una textura con el tono girado al color de un poder del SMASH (hielo = azul, viento = verde, rayo = amarillo). El fuego devuelve la misma textura.
 * null si no se puede (sin canvas / sin filtros): quien llama deja el arte como está.
 */
export function elementTexture(scene: Phaser.Scene, key: string, el: SmashPower): string | null {
  if (el === 'fire') return key;
  const out = `${key}-${el}`;
  if (scene.textures.exists(out)) return out;
  const srcImg = scene.textures.get(key)?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!srcImg || !srcImg.width) return null;
  const tex = scene.textures.createCanvas(out, srcImg.width, srcImg.height);
  const ctx = tex?.getContext();
  if (!tex || !ctx || !('filter' in ctx)) return null;
  // el arte es rojo/naranja: se gira el tono al color de cada poder
  ctx.filter = ELEMENT_FILTER[el];
  ctx.drawImage(srcImg, 0, 0);
  ctx.filter = 'none';
  tex.refresh();
  return out;
}
