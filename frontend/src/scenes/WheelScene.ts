import Phaser from 'phaser';
import { FONT, restartOnResize } from '../ui/theme';
import { GOLD, NAVY, SECTOR, addSectorContent, drawSlotIcon, drawWheelFace, isSpecial, sectorCenter } from '../ui/wheelArt';
import { WHEEL, type WheelSlot } from '../domain/wheelConfig';
import type { WheelReward } from '../domain/wheelState';
import { slotById } from '../domain/dailyWheel';
import { claimWheel, spinWheel, wheelSpin } from '../logic/Wheels';
import { wheelClaim, wheelStart, wheelTick, wheelWin } from '../fx/wheelSound';

/**
 * Pantalla de RULETA DIARIA (overlay sobre el menú).
 *
 * Flujo (estilo recompensa de Brawl Stars): pantalla completa con fondo propio → TOCAR cualquier parte para girar
 * (hasta 4 toques: cada uno da más potencia al giro) → el premio se decide y GUARDA en el primer toque (logic/Wheels →
 * domain/dailyWheel) y la animación solo representa ese resultado → la ruleta desaparece y queda solo el premio
 * (icono + cantidad), que se cobra solo (idempotente) → un toque en cualquier parte vuelve al menú.
 * Cerrar (X) sin girar conserva el giro; si ya estaba girada, al volver se muestra el premio.
 */
export interface WheelSceneData {
  index: number;
  bonus?: boolean;
}

/** Toques máximos y, por número de toques, vueltas completas y duración (ms) del giro. Solo visual. */
const MAX_TAPS = 4;
const SPIN_TURNS = [0, 5, 7, 9, 11];
const SPIN_MS = [0, 3400, 4000, 4700, 5500];
const BG_KEY = 'wheel-bg';
const GLOW_KEY = 'wheel-glow';

/**
 * Marco de la ruleta (public/assets/ruleta-frame.png, sacado de ruleta.png): aro metálico, luces,
 * indicador dorado y centro; fondo e interior del disco transparentes. Medidas en píxeles de la imagen.
 */
const FRAME = { key: 'ruleta-frame', file: 'assets/ruleta-frame.png', size: 900, disc: 336, outer: 450 };

export class WheelScene extends Phaser.Scene {
  static readonly KEY = 'Wheel';
  private index = 0;
  private bonus = false;
  private wheel!: Phaser.GameObjects.Container;
  private pointer!: Phaser.GameObjects.Container;
  private cx = 0;
  private cy = 0;
  private R = 0;
  private busy = false;
  private phase: 'idle' | 'spin' | 'result' = 'idle';
  private taps = 0;
  private res: { slot: WheelSlot; reward: WheelReward } | null = null;
  private jitter = 0;
  private lastSector = 0;
  private spinTween?: Phaser.Tweens.Tween;
  private canContinue = false;
  private blinkEv?: Phaser.Time.TimerEvent;
  /** objetos que sobreviven al paso de la ruleta al premio (fondo, rayos, destellos, zona táctil) */
  private keep = new Set<Phaser.GameObjects.GameObject>();
  private hint?: Phaser.GameObjects.Text;
  private pips: Phaser.GameObjects.Arc[] = [];
  private bulbs: Phaser.GameObjects.Arc[] = [];
  private closeBtn!: Phaser.GameObjects.Container;
  /** se usa el marco en imagen */
  private framed = false;
  /** radio exterior de la ruleta (marco incluido): coloca título, botones y tarjeta */
  private outerR = 0;
  private frameGlow?: Phaser.GameObjects.Image;

  constructor() {
    super(WheelScene.KEY);
  }

  preload() {
    if (!this.textures.exists(FRAME.key)) this.load.image(FRAME.key, FRAME.file);
  }

  init(data: WheelSceneData) {
    this.index = data?.index ?? 0;
    this.bonus = data?.bonus === true;
    this.busy = false;
    this.phase = 'idle';
    this.taps = 0;
    this.res = null;
    this.canContinue = false;
    this.bulbs = [];
    this.pips = [];
    this.keep = new Set();
    this.hint = undefined;
    this.frameGlow = undefined;
    this.blinkEv = undefined;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.cx = W / 2;
    this.cy = H * 0.43;
    this.framed = this.textures.exists(FRAME.key);
    // con el marco en imagen el disco es algo menor (el aro y sus pestañas ocupan más)
    this.R = this.framed ? Math.min(W * 0.36, H * 0.215, 280) : Math.min(W * 0.4, H * 0.24, 300);
    this.outerR = this.framed ? (this.R * FRAME.outer) / FRAME.disc : this.R + 30;

    // fondo a pantalla completa (tapa el menú) y zona táctil: cualquier parte de la pantalla es un toque
    this.background(W, H);
    this.rays();
    const zone = this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    zone.on('pointerdown', (p: Phaser.Input.Pointer) => this.onTap(p));
    this.keep.add(zone);
    this.title(W);
    this.buildWheel();
    this.closeBtn = this.closeButton(W);

    const sp = wheelSpin(this.index, this.bonus);
    const slot = sp?.slot ? slotById(sp.slot) : undefined;
    if (sp?.reward && slot) {
      // ya girada (cerrada antes de cobrar / app cerrada a mitad): se muestra el premio directamente
      this.phase = 'result';
      this.wheel.setRotation(this.restAngle(WHEEL.slots.indexOf(slot)));
      this.time.delayedCall(60, () => this.reveal(slot, sp.reward!, sp.claimed, !sp.claimed));
    } else {
      this.presentIn();
      this.tapHint(W);
    }
  }

  // ---------------------------------------------------------------- montaje
  private rays() {
    const g = this.add.graphics({ x: this.cx, y: this.cy });
    const n = 18;
    const len = Math.max(this.scale.width, this.scale.height);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      g.fillStyle(i % 2 ? 0x3a7bff : 0xffc42e, 0.1).slice(0, 0, len, a0, a0 + Math.PI / n, false).fillPath();
    }
    g.setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: 500 });
    this.tweens.add({ targets: g, angle: 360, duration: 40000, repeat: -1 });
    g.setData('rays', true);
    this.data.set('rays', g);
    this.keep.add(g);
  }

  /** Fondo a pantalla completa en la gama del juego (azul marino → azul eléctrico con viñeta) + destellos que suben. */
  private background(W: number, H: number) {
    if (this.textures.exists(BG_KEY)) this.textures.remove(BG_KEY);
    const tex = this.textures.createCanvas(BG_KEY, W, H);
    if (tex) {
      const ctx = tex.getContext();
      const gx = W / 2;
      const gy = H * 0.43;
      const rad = ctx.createRadialGradient(gx, gy, 10, gx, gy, Math.max(W, H) * 0.78);
      rad.addColorStop(0, '#2f5fd6');
      rad.addColorStop(0.32, '#16398f');
      rad.addColorStop(0.68, '#0b1733');
      rad.addColorStop(1, '#03070f');
      ctx.fillStyle = rad;
      ctx.fillRect(0, 0, W, H);
      // franjas diagonales muy suaves (como el menú)
      ctx.globalAlpha = 0.05;
      ctx.fillStyle = '#7fb0ff';
      for (let x = -H; x < W + H; x += 90) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 38, 0);
        ctx.lineTo(x + 38 - H * 0.6, H);
        ctx.lineTo(x - H * 0.6, H);
        ctx.closePath();
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      tex.refresh();
      this.keep.add(this.add.image(0, 0, BG_KEY).setOrigin(0));
    } else {
      this.keep.add(this.add.rectangle(0, 0, W, H, 0x0b1733, 1).setOrigin(0));
    }
    this.ensureGlow();
    // destellos que suben despacio
    for (let i = 0; i < 28; i++) {
      const sz = Phaser.Math.FloatBetween(3, 8);
      const st = this.add.star(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 4, sz * 0.4, sz, Phaser.Utils.Array.GetRandom([0xffe9a0, 0xbfe0ff, 0xffffff]), 0.8).setBlendMode(Phaser.BlendModes.ADD);
      this.keep.add(st);
      this.tweens.add({ targets: st, y: st.y - Phaser.Math.Between(120, 360), alpha: { from: 0.15, to: 0.9 }, angle: 180, duration: Phaser.Math.Between(2600, 5200), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2500), ease: 'Sine.easeInOut' });
    }
  }

  private ensureGlow() {
    if (this.textures.exists(GLOW_KEY)) return;
    const c = this.textures.createCanvas(GLOW_KEY, 256, 256);
    if (!c) return;
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 256);
    c.refresh();
  }

  private title(W: number) {
    const y = this.cy - this.outerR - 88;
    const t = this.add
      .text(W / 2, y, 'RULETA DIARIA', { fontFamily: FONT, fontSize: '52px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 10 })
      .setOrigin(0.5)
      .setShadow(0, 6, '#0a1638', 0, true, true);
    const sub = this.add
      .text(W / 2, y + 46, `${this.index + 1} / ${WHEEL.perDay}  ·  ¡GANASTE UN GIRO!`, { fontFamily: FONT, fontSize: '22px', color: '#cfe0ff', stroke: '#0a1638', strokeThickness: 5 })
      .setOrigin(0.5)
      .setLetterSpacing(1);
    t.setScale(0.4).setAlpha(0);
    sub.setAlpha(0);
    this.data.set('sub', sub);
    this.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
    this.tweens.add({ targets: sub, alpha: 1, delay: 200, duration: 300 });
  }

  private buildWheel() {
    if (this.framed) return this.buildFramedWheel();
    const { cx, cy, R } = this;
    // aro exterior fijo (bombillas)
    const rim = this.add.graphics({ x: cx, y: cy });
    rim.fillStyle(0x000000, 0.35).fillCircle(6, 10, R + 30);
    rim.fillStyle(NAVY, 1).fillCircle(0, 0, R + 30);
    rim.fillStyle(0xd98a00, 1).fillCircle(0, 0, R + 22);
    rim.fillStyle(GOLD, 1).fillCircle(0, 0, R + 18);
    rim.fillStyle(NAVY, 1).fillCircle(0, 0, R + 4);
    const nb = 20;
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2;
      const b = this.add.circle(cx + Math.cos(a) * (R + 13), cy + Math.sin(a) * (R + 13), 5.5, 0xfff6c8, 1);
      this.bulbs.push(b);
    }
    this.blinkEv = this.time.addEvent({ delay: this.busy ? 90 : 260, loop: true, callback: () => this.blink() });

    // ruleta (gira)
    this.wheel = this.add.container(cx, cy);
    const face = this.add.graphics();
    drawWheelFace(face, R, true);
    this.wheel.add(face);
    // brillo de los sectores especiales
    WHEEL.slots.forEach((s, i) => {
      if (!isSpecial(s)) return;
      const a0 = sectorCenter(i) - SECTOR / 2;
      const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      glow.fillStyle(0xffffff, 0.22).slice(0, 0, R, a0, a0 + SECTOR, false).fillPath();
      glow.setAlpha(0.2);
      this.tweens.add({ targets: glow, alpha: 0.9, duration: s.rarity === 'special' ? 520 : 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.wheel.add(glow);
    });
    addSectorContent(this, this.wheel, R);
    // tachuelas en los bordes de sector
    const pegs = this.add.graphics();
    WHEEL.slots.forEach((_, i) => {
      const a = sectorCenter(i) - SECTOR / 2;
      pegs.fillStyle(NAVY, 1).fillCircle(Math.cos(a) * (R - 7), Math.sin(a) * (R - 7), 6.5);
      pegs.fillStyle(0xffffff, 1).fillCircle(Math.cos(a) * (R - 7), Math.sin(a) * (R - 7), 4);
    });
    this.wheel.add(pegs);

    // centro fijo
    const hub = this.add.graphics({ x: cx, y: cy });
    hub.fillStyle(NAVY, 1).fillCircle(0, 0, R * 0.2 + 6);
    hub.fillStyle(0xd98a00, 1).fillCircle(0, 0, R * 0.2);
    hub.fillStyle(GOLD, 1).fillCircle(0, -2, R * 0.18);
    hub.fillStyle(0xffffff, 0.45).fillEllipse(-R * 0.05, -R * 0.08, R * 0.16, R * 0.07);
    this.add.text(cx, cy, 'NXO', { fontFamily: FONT, fontSize: `${Math.round(R * 0.13)}px`, color: '#0a1638' }).setOrigin(0.5);

    // indicador fijo arriba (apunta hacia abajo, al sector ganador)
    this.pointer = this.add.container(cx, cy - R - 16);
    const pg = this.add.graphics();
    const pw = R * 0.12;
    const ph = R * 0.2;
    pg.fillStyle(0x000000, 0.35).fillTriangle(-pw + 4, -ph * 0.35 + 6, pw + 4, -ph * 0.35 + 6, 4, ph + 6);
    pg.fillStyle(NAVY, 1).fillTriangle(-pw - 5, -ph * 0.35 - 4, pw + 5, -ph * 0.35 - 4, 0, ph + 7);
    pg.fillStyle(0xff3b4f, 1).fillTriangle(-pw, -ph * 0.35, pw, -ph * 0.35, 0, ph);
    pg.fillStyle(0xff8a94, 1).fillTriangle(-pw * 0.7, -ph * 0.3, 0, -ph * 0.3, 0, ph * 0.7);
    pg.fillStyle(NAVY, 1).fillCircle(0, -ph * 0.35, pw * 0.62);
    pg.fillStyle(GOLD, 1).fillCircle(0, -ph * 0.35, pw * 0.45);
    this.pointer.add(pg);
  }

  /**
   * Ruleta con el marco en imagen: debajo el disco de 10 sectores que gira (colores del diseño,
   * iconos y premios de siempre); encima el marco fijo con su indicador y centro metálico.
   */
  private buildFramedWheel() {
    const { cx, cy, R } = this;
    const scale = R / FRAME.disc;
    // sombra suave
    this.add.circle(cx + 6, cy + 10, this.outerR * 0.97, 0x000000, 0.35);
    this.wheel = this.add.container(cx, cy);
    const face = this.add.graphics();
    drawWheelFace(face, R + 6, true); // un poco bajo el aro: sin huecos en el borde
    this.wheel.add(face);
    WHEEL.slots.forEach((s, i) => {
      if (!isSpecial(s)) return;
      const a0 = sectorCenter(i) - SECTOR / 2;
      const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
      glow.fillStyle(0xffffff, 0.2).slice(0, 0, R, a0, a0 + SECTOR, false).fillPath();
      glow.lineStyle(3, GOLD, 0.9).beginPath().arc(0, 0, R - 3, a0 + 0.02, a0 + SECTOR - 0.02).strokePath();
      glow.setAlpha(0.25);
      this.tweens.add({ targets: glow, alpha: 0.9, duration: s.rarity === 'special' ? 520 : 760, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.wheel.add(glow);
    });
    addSectorContent(this, this.wheel, R * 0.97);
    // marco fijo (indicador y centro incluidos) + copia aditiva para el parpadeo de las luces
    const d = FRAME.size * scale;
    this.add.image(cx, cy, FRAME.key).setDisplaySize(d, d);
    this.frameGlow = this.add.image(cx, cy, FRAME.key).setDisplaySize(d, d).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    this.blinkEv = this.time.addEvent({ delay: 90, loop: true, callback: () => this.blink() });
  }

  private blink() {
    if (this.frameGlow) {
      // luces del marco: respiración suave en reposo, parpadeo rápido mientras gira
      const t = this.time.now / 1000;
      this.frameGlow.setAlpha(this.busy ? (Math.floor(t * 11) % 2 ? 0.45 : 0.1) : 0.12 + 0.12 * Math.sin(t * 3));
      return;
    }
    const t = Math.floor(this.time.now / (this.busy ? 90 : 260));
    this.bulbs.forEach((b, i) => b.setFillStyle((i + t) % 2 ? 0xfff6c8 : 0xffa51e, (i + t) % 2 ? 1 : 0.75));
  }

  /** Presentación: la ruleta entra girando y rebotando. */
  private presentIn() {
    this.wheel.setScale(0.2).setRotation(-1.2).setAlpha(0);
    this.tweens.add({ targets: this.wheel, scale: 1, alpha: 1, rotation: 0, duration: 750, ease: 'Back.easeOut' });
    // vaivén de espera (invita a girar)
    this.tweens.add({ targets: this.wheel, rotation: { from: -0.05, to: 0.05 }, delay: 800, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const shine = this.add.circle(this.cx, this.cy, this.R, 0xffffff, 0.5).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: shine, alpha: 0, scale: 1.4, delay: 450, duration: 500, onComplete: () => shine.destroy() });
  }

  /** Sin botón: se toca cualquier parte. Indicación pulsante + 4 marcas de potencia. */
  private tapHint(W: number) {
    const y = this.cy + this.outerR + 62;
    const h = this.add
      .text(W / 2, y, 'TOCA LA PANTALLA\nPARA GIRAR', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 9, align: 'center' })
      .setOrigin(0.5)
      .setLineSpacing(2)
      .setAlpha(0);
    this.hint = h;
    this.tweens.add({ targets: h, alpha: 1, delay: 600, duration: 300, onComplete: () => this.tweens.add({ targets: h, alpha: 0.55, scale: 1.06, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
    for (let i = 0; i < MAX_TAPS; i++) {
      const pip = this.add.circle(W / 2 + (i - (MAX_TAPS - 1) / 2) * 52, y + 96, 15, GOLD, 0).setStrokeStyle(4, GOLD, 0.9).setAlpha(0);
      this.tweens.add({ targets: pip, alpha: 1, delay: 700 + i * 60, duration: 250 });
      this.pips.push(pip);
    }
  }

  /** Un toque en cualquier parte: gira (1.º), da más potencia (2.º a 4.º) o continúa (con el premio ya a la vista). */
  private onTap(p: Phaser.Input.Pointer) {
    if (this.phase === 'result') {
      if (this.canContinue) this.close();
      return;
    }
    if (this.taps >= MAX_TAPS) return;
    if (this.phase === 'idle') {
      // 1) el premio se decide y se guarda ANTES de animar (aleatorio seguro y ponderado)
      const res = spinWheel(this.index, this.bonus);
      if (!res) return this.close();
      this.res = { slot: res.slot, reward: res.reward };
      this.jitter = (Math.random() - 0.5) * SECTOR * 0.6; // solo visual, dentro del mismo sector
      this.phase = 'spin';
      this.busy = true;
      this.closeBtn.setVisible(false);
      this.tweens.killTweensOf(this.wheel);
      this.wheel.setScale(1).setAlpha(1); // por si se tocó durante la entrada de la ruleta
      wheelStart(this);
      this.lastSector = Math.floor((this.wheel.rotation + SECTOR / 2) / SECTOR);
    }
    this.taps++;
    this.tapFx(p);
    this.spinTo();
  }

  private tapFx(p: Phaser.Input.Pointer) {
    const n = this.taps;
    const pip = this.pips[n - 1];
    if (pip) {
      pip.setFillStyle(GOLD, 1);
      this.tweens.add({ targets: pip, scale: { from: 1.8, to: 1 }, duration: 260, ease: 'Back.easeOut' });
    }
    if (this.hint) {
      this.tweens.killTweensOf(this.hint);
      this.hint.setAlpha(1).setScale(1).setText(n >= MAX_TAPS ? '¡POTENCIA MÁXIMA!' : '¡TOCA MÁS FUERTE!');
      this.hint.setColor(n >= MAX_TAPS ? '#ffd23f' : '#ffffff');
      this.tweens.add({ targets: this.hint, scale: { from: 1.25, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    }
    const ring = this.add.circle(p.x, p.y, 14, 0xffffff, 0).setStrokeStyle(6, GOLD, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(50);
    this.tweens.add({ targets: ring, scale: 4 + n, alpha: 0, duration: 420, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < 6 + n * 2; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = Phaser.Math.FloatBetween(40, 120 + n * 20);
      const st = this.add.star(p.x, p.y, 5, 3, 8, Phaser.Utils.Array.GetRandom([0xffd23f, 0xfff1b8, 0xffffff]), 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(50);
      this.tweens.add({ targets: st, x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d, alpha: 0, scale: 0.3, angle: 200, duration: Phaser.Math.Between(350, 600), ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
    this.cameras.main.shake(90 + n * 30, 0.002 + n * 0.0015);
    wheelTick(this, 1.2 + n * 0.15);
  }

  /**
   * Giro hacia el sector ya decidido. Cada toque lo relanza desde donde va con más vueltas y más tiempo
   * (empuje inmediato y luego frena), siempre terminando en el mismo sector.
   */
  private spinTo() {
    const res = this.res;
    if (!res) return;
    const i = WHEEL.slots.indexOf(res.slot);
    const turns = Math.PI * 2 * SPIN_TURNS[this.taps];
    const from = this.wheel.rotation;
    const base = this.restAngle(i) + this.jitter;
    let to = base + turns;
    while (to - from < turns) to += Math.PI * 2;
    this.spinTween?.stop();
    const st = { v: from };
    this.spinTween = this.tweens.add({
      targets: st,
      v: to,
      duration: SPIN_MS[this.taps],
      ease: 'Cubic.easeOut',
      onUpdate: (tw) => {
        this.wheel.setRotation(st.v);
        const sec = Math.floor((st.v + SECTOR / 2) / SECTOR);
        if (sec !== this.lastSector) {
          this.lastSector = sec;
          wheelTick(this, 1 + (1 - tw.progress) * 0.3);
          this.flapPointer();
        }
      },
      onComplete: () => this.spinDone(),
    });
  }

  private spinDone() {
    const res = this.res;
    if (!res) return;
    this.busy = false;
    // sector ganador iluminado un instante (fijo arriba, encima de la ruleta) y luego se muestra solo el premio
    // dentro de la ruleta y sobre el sector ganador (gira con ella: queda justo bajo el indicador aunque el giro
    // termine algo desplazado dentro del sector)
    const a0 = sectorCenter(WHEEL.slots.indexOf(res.slot)) - SECTOR / 2;
    const hl = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    hl.fillStyle(0xffffff, 0.35).slice(0, 0, this.R, a0, a0 + SECTOR, false).fillPath();
    hl.lineStyle(6, GOLD, 1).beginPath().arc(0, 0, this.R - 2, a0, a0 + SECTOR).strokePath();
    this.wheel.add(hl);
    this.tweens.add({ targets: hl, alpha: { from: 1, to: 0.35 }, duration: 200, yoyo: true, repeat: -1 });
    this.time.delayedCall(850, () => this.reveal(res.slot, res.reward, false, true));
  }

  private closeButton(W: number) {
    const c = this.add.container(W - 58, this.cy - this.outerR - 120);
    const g = this.add.graphics();
    g.fillStyle(NAVY, 1).fillCircle(0, 0, 30);
    g.lineStyle(4, 0x3a7bff, 1).strokeCircle(0, 0, 30);
    g.lineStyle(7, 0xffffff, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
    c.add(g);
    c.setSize(76, 76).setInteractive({ useHandCursor: true });
    c.on('pointerup', () => {
      if (!this.busy) this.close();
    });
    return c;
  }

  // ---------------------------------------------------------------- giro
  /** Rotación final (rad) para que el sector i quede bajo el indicador (arriba). */
  private restAngle(i: number) {
    return -i * SECTOR;
  }

  private flapPointer() {
    if (!this.pointer) return; // con el marco en imagen el indicador es fijo
    this.tweens.killTweensOf(this.pointer);
    this.pointer.setAngle(-14);
    this.tweens.add({ targets: this.pointer, angle: 0, duration: 140, ease: 'Back.easeOut' });
  }

  // ---------------------------------------------------------------- premio
  /**
   * La ruleta desaparece y queda SOLO el premio: icono grande y la cantidad debajo (cuenta hacia arriba).
   * Se cobra solo (idempotente). Un toque en cualquier parte vuelve al menú.
   */
  private reveal(slot: WheelSlot, reward: WheelReward, claimed: boolean, celebrate: boolean) {
    const special = isSpecial(slot);
    const W = this.scale.width;
    const H = this.scale.height;
    this.phase = 'result';
    this.canContinue = false;
    this.busy = false;
    this.spinTween?.stop();
    this.blinkEv?.remove();
    this.blinkEv = undefined;
    this.frameGlow = undefined;
    // 1) fuera la ruleta, el título y las indicaciones
    for (const o of [...this.children.list]) {
      if (this.keep.has(o)) continue;
      this.tweens.killTweensOf(o);
      this.tweens.add({ targets: o, alpha: 0, scale: (o as unknown as { scale: number }).scale * 0.6, duration: 240, ease: 'Cubic.easeIn', onComplete: () => o.destroy() });
    }
    this.closeBtn.setVisible(false);
    // 2) cobro automático
    if (!claimed) {
      claimWheel(this.index, this.bonus);
      wheelClaim(this);
    }
    const cx = W / 2;
    const cy = H * 0.42;
    const rays = this.data.get('rays') as Phaser.GameObjects.Graphics | undefined;
    if (rays) {
      rays.setPosition(cx, cy);
      this.tweens.add({ targets: rays, alpha: special ? 2.4 : 1.6, duration: 400 });
    }
    if (celebrate) {
      wheelWin(this, special);
      this.cameras.main.flash(220, 255, 235, 170);
    }
    const t0 = 180;
    // 3) resplandor + icono que aparece con rebote
    const glow = this.add.image(cx, cy, GLOW_KEY).setTint(special ? 0xff9bd8 : 0xffd23f).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.5);
    this.tweens.add({ targets: glow, alpha: 0.95, scale: 4.2, delay: t0, duration: 520, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: glow, scale: 4.6, alpha: 0.75, delay: t0 + 520, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const icon = this.add.graphics({ x: cx, y: cy });
    const iconSlot = reward.kind === 'coins' && slot.prize.kind !== 'coins' ? WHEEL.slots.find((s) => s.prize.kind === 'coins')! : reward.kind === 'xp' && slot.prize.kind !== 'xp' ? WHEEL.slots.find((s) => s.prize.kind === 'xp')! : reward.kind === 'item' ? WHEEL.slots.find((s) => s.prize.kind === 'cosmetic')! : slot;
    drawSlotIcon(icon, iconSlot, Math.min(150, W * 0.2));
    icon.setScale(0).setAngle(-25);
    this.tweens.add({ targets: icon, scale: 1, angle: 0, delay: t0, duration: 560, ease: 'Back.easeOut' });
    this.tweens.add({ targets: icon, y: cy - 10, delay: t0 + 600, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (celebrate) this.time.delayedCall(t0 + 120, () => this.burst(cx, cy, special));
    if (special) this.specialCelebration();

    // 4) cantidad debajo (cuenta hacia arriba) y etiqueta
    const n = (v: number) => v.toLocaleString('es-CL');
    let big: string;
    let small: string;
    let note = '';
    let target = 0;
    if (reward.kind === 'item') {
      big = `¡${reward.name.toUpperCase()}!`;
      small = 'NUEVO COSMÉTICO';
    } else {
      target = reward.amount;
      big = `+${n(target)}`;
      small = reward.kind === 'xp' ? 'EXP' : 'MONEDAS';
      if (reward.kind === 'coins' && reward.duplicateOf !== undefined) note = reward.duplicateOf ? 'Ya tenías ese cosmético: compensación' : 'Ya tienes todos los cosméticos: compensación';
    }
    const ty = cy + Math.min(150, W * 0.2) + 90;
    const amount = this.add.text(cx, ty, reward.kind === 'item' ? big : '+0', { fontFamily: FONT, fontSize: reward.kind === 'item' ? '60px' : '110px', color: special ? '#ffd23f' : '#ffffff', stroke: '#0a1638', strokeThickness: 14 }).setOrigin(0.5).setAlpha(0).setScale(0.4);
    if (amount.width > W - 60) amount.setFontSize(Math.floor((parseInt(String(amount.style.fontSize), 10) * (W - 60)) / amount.width));
    amount.setShadow(0, 8, '#0a1638', 0, true, true);
    this.tweens.add({ targets: amount, alpha: 1, scale: 1, delay: t0 + 300, duration: 420, ease: 'Back.easeOut' });
    if (reward.kind !== 'item') {
      const c = { v: 0 };
      this.tweens.add({ targets: c, v: target, delay: t0 + 360, duration: 800, ease: 'Cubic.easeOut', onUpdate: () => amount.setText(`+${n(Math.round(c.v))}`), onComplete: () => amount.setText(big) });
    }
    const label = this.add.text(cx, ty + (reward.kind === 'item' ? 56 : 84), small, { fontFamily: FONT, fontSize: '40px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 9 }).setOrigin(0.5).setAlpha(0).setLetterSpacing(3);
    this.tweens.add({ targets: label, alpha: 1, delay: t0 + 620, duration: 300 });
    if (note) {
      const nt = this.add.text(cx, label.y + 48, note, { fontFamily: FONT, fontSize: '22px', color: '#cfe0ff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: nt, alpha: 1, delay: t0 + 800, duration: 300 });
    }

    // 5) tocar para continuar (cualquier parte)
    const cont = this.add.text(cx, H * 0.9, 'TOCA PARA CONTINUAR', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setAlpha(0).setLetterSpacing(2);
    this.time.delayedCall(t0 + 1100, () => {
      this.canContinue = true;
      this.tweens.add({ targets: cont, alpha: 1, duration: 300, onComplete: () => this.tweens.add({ targets: cont, alpha: 0.4, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
    });
  }

  private burst(x: number, y: number, special: boolean) {
    const ring = this.add.circle(x, y, 30, 0xffffff, 0).setStrokeStyle(8, GOLD, 1).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, scale: special ? 9 : 5, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    const n = special ? 34 : 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const d = Phaser.Math.FloatBetween(90, special ? 320 : 200);
      const col = Phaser.Utils.Array.GetRandom(special ? [0xffd23f, 0xff4fa0, 0x6fd0ff, 0xb27bff, 0xffffff] : [0xffd23f, 0xfff1b8, 0xffffff]);
      const st = this.add.star(x, y, 5, 5, 12, col).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: st, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, angle: 360, alpha: 0, scale: 0.4, duration: Phaser.Math.Between(600, 900), ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
    this.cameras.main.shake(special ? 320 : 160, special ? 0.012 : 0.006);
  }

  /** Premio especial: destellos, confeti y rayos de colores. */
  private specialCelebration() {
    const W = this.scale.width;
    const H = this.scale.height;
    const banner = this.add
      .text(W / 2, H * 0.12, '¡PREMIO ESPECIAL!', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#7b2cff', strokeThickness: 10 })
      .setOrigin(0.5)
      .setScale(0);
    this.tweens.add({ targets: banner, scale: 1, duration: 450, ease: 'Back.easeOut' });
    this.tweens.add({ targets: banner, angle: { from: -3, to: 3 }, duration: 260, yoyo: true, repeat: -1, delay: 450 });
    for (let i = 0; i < 70; i++) {
      const c = this.add.rectangle(Phaser.Math.Between(0, W), -20, Phaser.Math.Between(8, 14), Phaser.Math.Between(14, 22), Phaser.Utils.Array.GetRandom([0xffd23f, 0xff4fa0, 0x6fd0ff, 0x62d935, 0xb27bff]));
      this.tweens.add({
        targets: c,
        y: H + 40,
        x: c.x + Phaser.Math.Between(-120, 120),
        angle: Phaser.Math.Between(-540, 540),
        delay: Phaser.Math.Between(0, 900),
        duration: Phaser.Math.Between(1800, 3000),
        ease: 'Sine.easeIn',
        onComplete: () => c.destroy(),
      });
    }
  }

  private close() {
    this.tweens.killAll();
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.stop());
  }
}

/** Textos del premio. */
export function rewardText(r: WheelReward): { line1: string; line2?: string } {
  const n = (v: number) => v.toLocaleString('es-CL');
  if (r.kind === 'item') return { line1: `¡${r.name.toUpperCase()}!`, line2: 'Nuevo cosmético en tu inventario' };
  if (r.kind === 'xp') return { line1: `+${n(r.amount)} EXP` };
  if (r.duplicateOf !== undefined) return { line1: `+${n(r.amount)} MONEDAS`, line2: r.duplicateOf ? 'Ya tenías ese cosmético: compensación' : 'Ya tienes todos los cosméticos: compensación' };
  return { line1: `+${n(r.amount)} MONEDAS` };
}

/** Abre la ruleta `index` encima de la escena actual. */
export function openWheel(scene: Phaser.Scene, index: number) {
  const key = WheelScene.KEY;
  const data: WheelSceneData = { index };
  if (scene.scene.get(key)) scene.scene.launch(key, data);
  else scene.scene.add(key, WheelScene, true, data);
  scene.scene.bringToTop(key);
}
