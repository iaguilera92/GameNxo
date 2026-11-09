import Phaser from 'phaser';
import { FONT, restartOnResize } from '../ui/theme';
import { arcadeButton } from '../ui/modeButtons';
import { GOLD, NAVY, SECTOR, addSectorContent, drawSlotIcon, drawWheelFace, isSpecial, slotColors, sectorCenter } from '../ui/wheelArt';
import { WHEEL, type WheelSlot } from '../domain/wheelConfig';
import type { WheelReward } from '../domain/wheelState';
import { slotById } from '../domain/dailyWheel';
import { claimWheel, spinWheel, wheelSpin } from '../logic/Wheels';
import { wheelClaim, wheelStart, wheelTick, wheelWin } from '../fx/wheelSound';

/**
 * Pantalla de RULETA DIARIA (overlay sobre el menú).
 *
 * Flujo: presentación → GIRAR → el premio se decide y GUARDA antes de animar (logic/Wheels →
 * domain/dailyWheel) → la animación solo representa ese resultado → premio → RECLAMAR (idempotente).
 * Cerrar sin girar conserva el giro; si ya estaba girada, al volver se muestra el resultado.
 */
export interface WheelSceneData {
  index: number;
}

/** Duración del giro (ms) y vueltas completas antes de parar. Solo visual. */
const SPIN_MS = 5200;
const SPIN_TURNS = 7;

/**
 * Marco de la ruleta (public/assets/ruleta-frame.png, sacado de ruleta.png): aro metálico, luces,
 * indicador dorado y centro; fondo e interior del disco transparentes. Medidas en píxeles de la imagen.
 */
const FRAME = { key: 'ruleta-frame', file: 'assets/ruleta-frame.png', size: 900, disc: 336, outer: 450 };

export class WheelScene extends Phaser.Scene {
  static readonly KEY = 'Wheel';
  private index = 0;
  private wheel!: Phaser.GameObjects.Container;
  private pointer!: Phaser.GameObjects.Container;
  private cx = 0;
  private cy = 0;
  private R = 0;
  private busy = false;
  private bulbs: Phaser.GameObjects.Arc[] = [];
  private ui: Phaser.GameObjects.GameObject[] = [];
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
    this.busy = false;
    this.bulbs = [];
    this.ui = [];
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

    // fondo: oscurece el menú y bloquea toques
    const dim = this.add.rectangle(0, 0, W, H, 0x02060f, 0).setOrigin(0).setInteractive();
    this.tweens.add({ targets: dim, fillAlpha: 0.82, duration: 260 });

    this.rays();
    this.title(W);
    this.buildWheel();
    this.closeBtn = this.closeButton(W);

    const sp = wheelSpin(this.index);
    const slot = sp?.slot ? slotById(sp.slot) : undefined;
    if (sp?.reward && slot) {
      // ya girada (cerrada antes de cobrar / app cerrada a mitad): se muestra el resultado
      this.wheel.setRotation(this.restAngle(WHEEL.slots.indexOf(slot)));
      this.showResult(slot, sp.reward, sp.claimed, false);
    } else {
      this.presentIn();
      this.spinButton(W);
    }
  }

  // ---------------------------------------------------------------- montaje
  private rays() {
    const g = this.add.graphics({ x: this.cx, y: this.cy });
    const n = 18;
    const len = Math.max(this.scale.width, this.scale.height);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      g.fillStyle(i % 2 ? 0x3a7bff : 0xffc42e, 0.07).slice(0, 0, len, a0, a0 + Math.PI / n, false).fillPath();
    }
    g.setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: 500 });
    this.tweens.add({ targets: g, angle: 360, duration: 40000, repeat: -1 });
    g.setData('rays', true);
    this.data.set('rays', g);
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
    this.time.addEvent({ delay: this.busy ? 90 : 260, loop: true, callback: () => this.blink() });

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
    this.time.addEvent({ delay: 90, loop: true, callback: () => this.blink() });
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

  private spinButton(W: number) {
    const y = this.cy + this.outerR + 80;
    const btn = arcadeButton(this, W / 2, y, Math.min(420, W - 120), 104, 'GIRAR', () => this.doSpin(), { palette: 'yellow', pulse: true });
    this.ui.push(this.popIn(btn, 500));
  }

  /**
   * Entrada con rebote en un contenedor propio: el botón tiene su latido (tween de escala) y no
   * debe competir con la animación de entrada sobre la misma propiedad.
   */
  private popIn(btn: Phaser.GameObjects.Container, delay: number) {
    const wrap = this.add.container(btn.x, btn.y);
    btn.setPosition(0, 0);
    wrap.add(btn);
    wrap.setScale(0).setAlpha(0);
    this.tweens.add({ targets: wrap, scale: 1, alpha: 1, delay, duration: 380, ease: 'Back.easeOut' });
    return wrap;
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

  private doSpin() {
    if (this.busy) return;
    // 1) el premio se decide y se guarda ANTES de animar (aleatorio seguro y ponderado)
    const res = spinWheel(this.index);
    if (!res) return this.close();
    this.busy = true;
    this.closeBtn.setVisible(false);
    for (const o of this.ui) this.tweens.add({ targets: o, alpha: 0, scale: 0.8, duration: 180, onComplete: () => o.destroy() });
    this.ui = [];
    this.tweens.killTweensOf(this.wheel);
    wheelStart(this);

    // 2) la animación solo representa el resultado: vueltas + desaceleración hasta su sector
    const i = WHEEL.slots.indexOf(res.slot);
    const from = this.wheel.rotation;
    const jitter = (Math.random() - 0.5) * SECTOR * 0.6; // solo visual, dentro del mismo sector
    const base = this.restAngle(i) + jitter;
    const turns = Math.PI * 2 * SPIN_TURNS;
    let to = base + turns;
    while (to - from < turns) to += Math.PI * 2;
    const st = { v: from };
    let lastSector = Math.floor((from + SECTOR / 2) / SECTOR);
    // pequeño "tirón" hacia atrás y luego el giro
    this.tweens.add({
      targets: st,
      v: from - 0.18,
      duration: 220,
      ease: 'Quad.easeOut',
      onUpdate: () => this.wheel.setRotation(st.v),
      onComplete: () =>
        this.tweens.add({
          targets: st,
          v: to,
          duration: SPIN_MS,
          ease: 'Quart.easeOut',
          onUpdate: (tw) => {
            this.wheel.setRotation(st.v);
            const sec = Math.floor((st.v + SECTOR / 2) / SECTOR);
            if (sec !== lastSector) {
              lastSector = sec;
              wheelTick(this, 1 + (1 - tw.progress) * 0.3);
              this.flapPointer();
            }
          },
          onComplete: () => {
            this.busy = false;
            this.showResult(res.slot, res.reward, false, true);
          },
        }),
    });
  }

  private flapPointer() {
    if (!this.pointer) return; // con el marco en imagen el indicador es fijo
    this.tweens.killTweensOf(this.pointer);
    this.pointer.setAngle(-14);
    this.tweens.add({ targets: this.pointer, angle: 0, duration: 140, ease: 'Back.easeOut' });
  }

  // ---------------------------------------------------------------- premio
  private showResult(slot: WheelSlot, reward: WheelReward, claimed: boolean, celebrate: boolean) {
    const special = isSpecial(slot);
    const W = this.scale.width;
    this.closeBtn.setVisible(true);
    // sector ganador iluminado (fijo arriba, encima de la ruleta)
    const hl = this.add.graphics({ x: this.cx, y: this.cy }).setBlendMode(Phaser.BlendModes.ADD);
    hl.fillStyle(0xffffff, 0.35).slice(0, 0, this.R, -Math.PI / 2 - SECTOR / 2, -Math.PI / 2 + SECTOR / 2, false).fillPath();
    hl.lineStyle(6, GOLD, 1).beginPath().arc(0, 0, this.R - 2, -Math.PI / 2 - SECTOR / 2, -Math.PI / 2 + SECTOR / 2).strokePath();
    this.tweens.add({ targets: hl, alpha: { from: 1, to: 0.35 }, duration: 420, yoyo: true, repeat: -1 });

    if (celebrate) {
      wheelWin(this, special);
      this.burst(this.cx, this.cy - this.R * 0.62, special);
      if (special) this.specialCelebration();
    }

    // tarjeta del premio
    const y = this.cy + this.outerR + 62;
    const card = this.add.container(W / 2, y);
    const cw = Math.min(560, W - 60);
    const ch = 116;
    const col = slotColors(slot);
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.35).fillRoundedRect(-cw / 2 + 5, -ch / 2 + 8, cw, ch, 26);
    bg.fillStyle(NAVY, 0.97).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 26);
    bg.lineStyle(4, special ? GOLD : col.fill, 1).strokeRoundedRect(-cw / 2, -ch / 2, cw, ch, 26);
    card.add(bg);
    const icon = this.add.graphics({ x: -cw / 2 + 66, y: 0 });
    const iconSlot = reward.kind === 'coins' && slot.prize.kind !== 'coins' ? WHEEL.slots.find((s) => s.prize.kind === 'coins')! : reward.kind === 'xp' && slot.prize.kind !== 'xp' ? WHEEL.slots.find((s) => s.prize.kind === 'xp')! : slot;
    drawSlotIcon(icon, iconSlot, 30);
    card.add(icon);
    const { line1, line2 } = rewardText(reward);
    const t1 = this.add.text(-cw / 2 + 120, line2 ? -16 : 0, line1, { fontFamily: FONT, fontSize: '38px', color: special ? '#ffd23f' : '#ffffff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0, 0.5);
    const maxW = cw - 140;
    if (t1.width > maxW) t1.setScale(maxW / t1.width);
    card.add(t1);
    if (line2) card.add(this.add.text(-cw / 2 + 122, 24, line2, { fontFamily: FONT, fontSize: '18px', color: '#9fb4e0' }).setOrigin(0, 0.5));
    card.setScale(0.3).setAlpha(0);
    this.tweens.add({ targets: card, scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });

    // RECLAMAR (o CONTINUAR si ya se cobró)
    const by = y + ch / 2 + 74;
    const bw = Math.min(420, W - 120);
    const btn = arcadeButton(this, W / 2, by, bw, 100, claimed ? 'CONTINUAR' : 'RECLAMAR', () => {
      if (claimed) return this.close();
      const r = claimWheel(this.index);
      claimed = true;
      if (r?.given) this.claimFx(r.given);
      (btn.getData('label') as Phaser.GameObjects.Text).setText('CONTINUAR');
    }, { palette: claimed ? 'blue' : 'yellow', pulse: !claimed });
    this.popIn(btn, 300);
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
    this.cameras.main.flash(260, 255, 230, 150);
    const rays = this.data.get('rays') as Phaser.GameObjects.Graphics | undefined;
    if (rays) this.tweens.add({ targets: rays, alpha: 2.5, duration: 400, yoyo: true, repeat: 3 });
    (this.data.get('sub') as Phaser.GameObjects.Text | undefined)?.setVisible(false);
    const banner = this.add
      .text(W / 2, this.cy - this.outerR - 42, '¡PREMIO ESPECIAL!', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#7b2cff', strokeThickness: 10 })
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

  /** Cobro: monedas/estrellas suben hacia el contador del menú. */
  private claimFx(r: WheelReward) {
    wheelClaim(this);
    const W = this.scale.width;
    const from = { x: W / 2 - Math.min(560, W - 60) / 2 + 66, y: this.cy + this.outerR + 62 };
    const target = r.kind === 'xp' ? { x: 150, y: 90 } : { x: W - 200, y: 82 };
    const n = 12;
    for (let i = 0; i < n; i++) {
      const g = this.add.graphics({ x: from.x, y: from.y });
      if (r.kind === 'xp') drawSlotIcon(g, WHEEL.slots.find((s) => s.prize.kind === 'xp')!, 14);
      else if (r.kind === 'item') drawSlotIcon(g, WHEEL.slots.find((s) => s.prize.kind === 'cosmetic')!, 14);
      else drawSlotIcon(g, WHEEL.slots[0], 14);
      this.tweens.add({
        targets: g,
        x: { from: from.x + Phaser.Math.Between(-40, 40), to: target.x },
        y: { from: from.y + Phaser.Math.Between(-30, 30), to: target.y },
        scale: { from: 1.2, to: 0.6 },
        delay: i * 45,
        duration: 650,
        ease: 'Cubic.easeIn',
        onComplete: () => g.destroy(),
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
