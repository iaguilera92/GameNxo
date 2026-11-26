import Phaser from 'phaser';
import { FONT, restartOnResize } from '../ui/theme';
import { GOLD, NAVY, SECTOR, TIER_LOOK, CHEST_TEX, WHEEL_FRAME as FRAME, WHEEL_FRAME_KEYS, type SectorAmountLabel, addSectorContent, addWheelFace, chestImage, coin2v2Image, coinIcon, drawSlotIcon, isSpecial, sectorCenter, wheelFaceKey } from '../ui/wheelArt';
import { WHEEL, type WheelSlot } from '../domain/wheelConfig';
import type { WheelReward, WheelTier } from '../domain/wheelState';
import { scaleReward, slotById } from '../domain/dailyWheel';
import { CHEST } from '../domain/chest';
import { getPlayer } from '../domain/playerStore';
import { boostWheel, claimWheel, claimWheelAdBonus, spinWheel, wheelSpin } from '../logic/Wheels';
import { wheelClaim, wheelStart, wheelTick, wheelWin } from '../fx/wheelSound';
import { canShowRewardedAds, showRewarded } from '../ads/ads';
import { arcadeButton } from '../ui/modeButtons';
import { tapHint } from '../ui/guideFocus';
import { clockTimer } from '../ui/TutorialDialog';
import { GUIDE_FIRST_WHEEL } from '../domain/tutorial';

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
  underlay?: Phaser.Scene;
  bonus?: boolean;
  /** RULETA TEST (solo desarrollo): giro extra con selector de premio (los premios SÍ se entregan) */
  test?: boolean;
}

/** Toques máximos y, por número de toques, vueltas completas y duración (ms) del giro. Solo visual. */
const MAX_TAPS = WHEEL.tiers.maxTaps;
/** (17-11-2026, usuario) pausa de toques tras subir la ruleta de nivel (dorada / épica), para que se vea la evolución (1 s -> 0,8 s) */
const TIER_LOCK_MS = 400; // (26-11-2026, usuario) 0,8 s -> 0,4 s: el jugador sigue apretando y se sentía pegado
/** (17-11-2026, usuario) color del fondo en cada nivel de la ruleta: velo encima del fondo azul (null = sin velo) */
const TIER_BG: Record<WheelTier, { color: number; alpha: number } | null> = {
  normal: null,
  gold: { color: 0xb8860b, alpha: 0.42 },
  epic: { color: 0x6a22c8, alpha: 0.42 },
};
const SPIN_TURNS = [0, 5, 7, 9, 11];
const SPIN_MS = [0, 3400, 4000, 4700, 5500];
const BG_KEY = 'wheel-bg';
const GLOW_KEY = 'wheel-glow';

export class WheelScene extends Phaser.Scene {
  static readonly KEY = 'Wheel';
  private index = 0;
  private underlay?: Phaser.Scene;
  private bonus = false;
  private test = false;
  /** RULETA TEST: sector elegido (undefined = al azar) */
  private force?: string;
  private picker?: Phaser.GameObjects.Container;
  private wheel!: Phaser.GameObjects.Container;
  private pointer?: Phaser.GameObjects.Container;
  private cx = 0;
  private cy = 0;
  private R = 0;
  private busy = false;
  /** hasta cuándo (time.now) se ignoran los toques tras subir de nivel (TIER_LOCK_MS) */
  private tierLockUntil = 0;
  /** velo de color del fondo según el nivel de la ruleta (TIER_BG) */
  private tierTint?: Phaser.GameObjects.Rectangle;
  private phase: 'idle' | 'spin' | 'settling' | 'result' = 'idle';
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
  /** (26-11-2026) mano de la primera ruleta del tutorial */
  private firstHand?: Phaser.GameObjects.Container;
  private pips: Phaser.GameObjects.Arc[] = [];
  private bulbs: Phaser.GameObjects.Arc[] = [];
  private closeBtn!: Phaser.GameObjects.Container;
  /** se usa el marco en imagen */
  private framed = false;
  /** radio exterior de la ruleta (marco incluido): coloca título, botones y tarjeta */
  private outerR = 0;
  private frameGlow?: Phaser.GameObjects.Image;
  /** marco fijo (imagen) y cara de sectores: cambian de color cuando la ruleta sube de nivel */
  private frameImg?: Phaser.GameObjects.Image;
  private face!: Phaser.GameObjects.Image;
  /** nivel actual de la ruleta (normal / dorada / épica): lo decide domain/dailyWheel, aquí solo se muestra */
  private tier: WheelTier = 'normal';
  /** (18-11-2026) textos de las cantidades de los sectores: suben al evolucionar la ruleta (showTierAmounts) */
  private amounts: SectorAmountLabel[] = [];
  /** (18-11-2026) título y subtítulo: cambian con el nivel de la ruleta (showTierTitle) */
  private titleText?: Phaser.GameObjects.Text;
  /** (18-11-2026) ya se pidió cerrar (espera a que se levante el dedo) */
  private closing = false;
  private subText?: Phaser.GameObjects.Text;

  constructor() {
    super(WheelScene.KEY);
  }

  init(data: WheelSceneData) {
    this.index = data?.index ?? 0;
    this.underlay = data?.underlay;
    this.bonus = data?.bonus === true;
    this.closing = false; // (la escena se reutiliza entre aperturas)
    this.test = data?.test === true;
    this.force = undefined;
    this.picker = undefined;
    this.busy = false;
    this.tierLockUntil = 0;
    this.phase = 'idle';
    this.taps = 0;
    this.res = null;
    this.canContinue = false;
    this.bulbs = [];
    this.pips = [];
    this.keep = new Set();
    this.hint = undefined;
    this.firstHand = undefined;
    this.frameGlow = undefined;
    this.frameImg = undefined;
    this.pointer = undefined;
    this.spinTween = undefined;
    this.tier = 'normal';
    this.blinkEv = undefined;
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    // (21-11-2026) el MENÚ espera: mientras la ruleta está abierta no actualiza sus contadores y, al cerrarse, muestra cómo el premio (EXP, monedas) pasa a sus cards
    this.registry.set('wheel.open', true);
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
    // El fondo opaco cubre la escena anterior. Sus timers y suscripciones siguen activos.
    const underlay = this.underlay;
    const wasVisible = underlay?.sys.isVisible();
    const inputEnabled = underlay?.input.enabled;
    if (underlay) {
      underlay.sys.setVisible(false);
      underlay.input.enabled = false;
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (underlay) {
        underlay.sys.setVisible(wasVisible ?? true);
        underlay.input.enabled = inputEnabled ?? true;
      }
      this.registry.set('wheel.open', false);
      this.game.events.emit('wheel-closed');
    });

    const sp = wheelSpin(this.index, this.bonus);
    const slot = sp?.slot ? slotById(sp.slot) : undefined;
    if (sp?.reward && slot) {
      // ya girada (cerrada antes de cobrar / app cerrada a mitad): se muestra el premio directamente
      this.phase = 'result';
      this.applyTier(sp.tier ?? 'normal', false);
      this.wheel.setRotation(this.restAngle(WHEEL.slots.indexOf(slot)));
      this.time.delayedCall(60, () => this.reveal(slot, sp.reward!, sp.claimed, !sp.claimed));
    } else {
      this.presentIn();
      this.tapHint(W);
      if (this.test) this.testPicker(W, H);
    }
  }

  /**
   * RULETA TEST: selector del premio (◀ AL AZAR ▶ recorre los 10 sectores) para ver cada uno y cómo se refleja en la cuenta.
   * Tocarlo no gira la ruleta; desaparece al girar.
   */
  private testPicker(W: number, H: number) {
    const opts: (WheelSlot | undefined)[] = [undefined, ...WHEEL.slots];
    let i = 0;
    const c = this.add.container(W / 2, H - 70).setDepth(60);
    const bg = this.add.graphics();
    bg.fillStyle(0x073e59, 1).fillRoundedRect(-240, -34, 480, 68, 20);
    bg.lineStyle(3, 0x45e7ff, 1).strokeRoundedRect(-240, -34, 480, 68, 20);
    const txt = this.add.text(0, 0, '', { fontFamily: FONT, fontSize: '24px', color: '#d8fbff', stroke: '#053044', strokeThickness: 5 }).setOrigin(0.5);
    const name = (sl?: WheelSlot) => {
      if (!sl) return 'PREMIO: AL AZAR';
      const p = sl.prize;
      const what = p.kind === 'coins' ? 'MONEDAS' : p.kind === 'coins2v2' ? 'MONEDAS 2V2' : p.kind === 'xp' ? 'EXP' : p.kind === 'cash' ? 'DINERO' : '';
      return `PREMIO: ${sl.label}${what ? ' ' + what : ''}`;
    };
    const arrows = this.add.text(0, 0, '◀                              ▶', { fontFamily: FONT, fontSize: '30px', color: '#45e7ff' }).setOrigin(0.5);
    c.add([bg, txt, arrows]);
    const paint = () => {
      this.force = opts[i]?.id;
      txt.setText(name(opts[i]));
    };
    paint();
    const stop = (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation();
    for (const dir of [-1, 1]) {
      const z = this.add.zone(dir * 120, 0, 240, 68).setInteractive({ useHandCursor: true });
      z.on('pointerdown', stop);
      z.on('pointerup', (p: Phaser.Input.Pointer, x: number, y: number, e: Phaser.Types.Input.EventData) => {
        stop(p, x, y, e);
        i = (i + dir + opts.length) % opts.length;
        paint();
      });
      c.add(z);
    }
    this.picker = c;
  }

  // ---------------------------------------------------------------- montaje
  private rays() {
    const g = this.add.graphics({ x: this.cx, y: this.cy });
    const n = 18;
    const len = Math.hypot(this.scale.width, this.scale.height);
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2;
      const a1 = a0 + Math.PI / n;
      g.fillStyle(i % 2 ? 0x3a7bff : 0xffc42e, 0.1)
        .fillTriangle(0, 0, len * Math.cos(a0), len * Math.sin(a0), len * Math.cos(a1), len * Math.sin(a1));
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
    const width = Math.ceil(W / 2);
    const height = Math.ceil(H / 2);
    const cached = this.textures.exists(BG_KEY) ? this.textures.get(BG_KEY).getSourceImage() : undefined;
    if (cached && (cached.width !== width || cached.height !== height)) this.textures.remove(BG_KEY);
    const tex = this.textures.exists(BG_KEY) ? null : this.textures.createCanvas(BG_KEY, width, height);
    if (tex) {
      const ctx = tex.getContext();
      ctx.setTransform(width / W, 0, 0, height / H, 0, 0);
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
    }
    const background = this.textures.exists(BG_KEY)
      ? this.add.image(0, 0, BG_KEY).setDisplaySize(W, H)
      : this.add.rectangle(0, 0, W, H, 0x0b1733);
    this.keep.add(background.setOrigin(0));
    // velo de color del NIVEL de la ruleta (dorada / épica) sobre el fondo; applyTier lo enciende
    this.tierTint = this.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0).setAlpha(0);
    this.keep.add(this.tierTint);
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
      .text(W / 2, y, this.test ? 'RULETA TEST' : 'RULETA DIARIA', { fontFamily: FONT, fontSize: '52px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 10 })
      .setOrigin(0.5)
      .setShadow(0, 6, '#0a1638', 0, true, true);
    // (18-11-2026, usuario) el "1 / 4 · ¡GANASTE UN GIRO!" un poco más abajo (antes y + 46)
    const sub = this.add
      .text(W / 2, y + 60, this.test ? 'PRUEBA · LOS PREMIOS SÍ SE ENTREGAN' : `${this.bonus ? '' : `${this.index + 1} / ${WHEEL.perDay}  ·  `}¡GANASTE UN GIRO!`, { fontFamily: FONT, fontSize: '22px', color: '#cfe0ff', stroke: '#0a1638', strokeThickness: 5 })
      .setOrigin(0.5)
      .setLetterSpacing(1);
    t.setScale(0.4).setAlpha(0);
    sub.setAlpha(0);
    this.data.set('sub', sub);
    this.titleText = t;
    this.subText = sub;
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
    this.face = addWheelFace(this, R);
    this.wheel.add(this.face);
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
    this.amounts = addSectorContent(this, this.wheel, R);
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
    this.face = addWheelFace(this, R + 6); // un poco bajo el aro: sin huecos en el borde
    this.wheel.add(this.face);
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
    this.amounts = addSectorContent(this, this.wheel, R * 0.97);
    // marco fijo (indicador y centro incluidos) + copia aditiva para el parpadeo de las luces
    const d = FRAME.size * scale;
    this.frameImg = this.add.image(cx, cy, FRAME.key).setDisplaySize(d, d);
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
    // (26-11-2026, usuario) primera ruleta del tutorial: la mano de clic a la DERECHA del texto, pulsando hasta los 4 toques
    const sp0 = wheelSpin(this.index, this.bonus);
    if (sp0?.matchId === GUIDE_FIRST_WHEEL && !sp0.claimed) {
      this.time.delayedCall(700, () => {
        if (!this.sys.isActive() || this.taps >= MAX_TAPS) return;
        this.firstHand = tapHint(this, W / 2 + h.width / 2 + 34, y + 10, 200);
      });
    }
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
      if (p.y > this.scale.height * 0.74 && p.y < this.scale.height * 0.86) return; // reserva táctil del botón bonus
      // (18-11-2026, usuario: "al continuar vuelve a salir la ruleta") se cierra al LEVANTAR el dedo: si se cerraba al apoyarlo, el
      // "soltar" caía en el menú de abajo (el botón de la ruleta) y la volvía a abrir
      if (this.canContinue && !this.closing) {
        this.closing = true;
        this.input.once('pointerup', () => this.close());
      }
      return;
    }
    if (this.phase === 'settling' || this.taps >= MAX_TAPS) return;
    // (17-11-2026, usuario) tras SUBIR DE NIVEL la ruleta no acepta toques durante 1 s: así se alcanza a ver la evolución
    if (this.time.now < this.tierLockUntil) return;
    if (this.phase === 'idle') {
      // 1) el premio se decide y se guarda ANTES de animar (aleatorio seguro y ponderado)
      const res = spinWheel(this.index, this.bonus, this.test ? this.force : undefined);
      if (!res) return this.close();
      this.picker?.destroy();
      this.picker = undefined;
      this.res = { slot: res.slot, reward: res.reward };
      this.tier = 'normal';
      this.jitter = (Math.random() - 0.5) * SECTOR * 0.6; // solo visual, dentro del mismo sector
      this.phase = 'spin';
      this.busy = true;
      this.closeBtn.setVisible(false);
      this.tweens.killTweensOf(this.wheel);
      this.wheel.setScale(1).setAlpha(1); // por si se tocó durante la entrada de la ruleta
      wheelStart(this);
      this.lastSector = Math.floor((this.wheel.rotation + SECTOR / 2) / SECTOR);
      // la 1.ª tirada de nivel ya viene con el giro: si la ruleta nace dorada o épica, se transforma al instante
      if (res.tier !== 'normal') {
        this.applyTier(res.tier, true);
        this.tierLockUntil = this.time.now + TIER_LOCK_MS;
      }
    } else {
      // toques 2.º a 4.º: cada uno tira una vez para subir la ruleta de nivel (decide y guarda domain/dailyWheel)
      const up = boostWheel(this.index, this.bonus);
      if (up?.upgraded && this.res) {
        this.res.reward = up.reward;
        this.applyTier(up.tier, true);
        this.tierLockUntil = this.time.now + TIER_LOCK_MS;
      }
    }
    this.taps++;
    if (this.taps >= MAX_TAPS) {
      this.firstHand?.destroy();
      this.firstHand = undefined;
    }
    this.tapFx(p);
    this.spinTo();
  }

  /**
   * La ruleta sube de nivel: cambia las texturas de los sectores y del marco, con destello y aviso.
   * Solo es visual; los premios ya los recalculó domain/dailyWheel.
   */
  private applyTier(tier: WheelTier, animate: boolean) {
    if (tier === this.tier && animate) return;
    this.tier = tier;
    const look = TIER_LOOK[tier];
    this.face.setTexture(wheelFaceKey(tier));
    const key = WHEEL_FRAME_KEYS[tier];
    if (this.textures.exists(key)) {
      const size = this.outerR * 2;
      this.frameImg?.setTexture(key).setDisplaySize(size, size);
      this.frameGlow?.setTexture(key).setDisplaySize(size, size);
    }
    // (17-11-2026, usuario) el FONDO también se tiñe: dorado en la ruleta dorada, morado en la épica
    if (this.tierTint?.active) {
      const tint = TIER_BG[tier];
      this.tweens.killTweensOf(this.tierTint);
      if (tint) this.tierTint.setFillStyle(tint.color, 1);
      this.tweens.add({ targets: this.tierTint, alpha: tint ? tint.alpha : 0, duration: animate ? 450 : 0, ease: 'Sine.easeOut' });
    }
    this.showTierAmounts(tier, animate);
    this.showTierTitle(tier, animate);
    if (!animate || tier === 'normal') return;
    wheelWin(this, tier === 'epic');
    this.cameras.main.flash(tier === 'epic' ? 320 : 220, tier === 'epic' ? 190 : 255, tier === 'epic' ? 140 : 215, tier === 'epic' ? 255 : 110);
    const ring = this.add.circle(this.cx, this.cy, this.R * 0.4, 0xffffff, 0).setStrokeStyle(10, look.glow, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(40);
    this.tweens.add({ targets: ring, scale: 4.2, alpha: 0, duration: 650, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
    for (let i = 0; i < 22; i++) {
      const a = (i / 22) * Math.PI * 2;
      const dist = Phaser.Math.FloatBetween(this.R * 0.6, this.R * 1.5);
      const st = this.add.star(this.cx, this.cy, 5, 4, 11, Phaser.Utils.Array.GetRandom([look.glow, 0xffffff, look.line[1]]), 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(40);
      this.tweens.add({ targets: st, x: this.cx + Math.cos(a) * dist, y: this.cy + Math.sin(a) * dist, angle: 300, alpha: 0, scale: 0.3, duration: Phaser.Math.Between(500, 850), ease: 'Cubic.easeOut', onComplete: () => st.destroy() });
    }
    // (18-11-2026, usuario) sin el aviso flotante encima de los títulos: lo dicen el título y el subtítulo (showTierTitle)
  }

  /**
   * (18-11-2026, usuario) El NIVEL de la ruleta se ve en los títulos: "RULETA DIARIA" pasa a "RULETA DORADA" / "RULETA ÉPICA" (con su color y un
   * salto) y el subtítulo "1 / 4 · ¡GANASTE UN GIRO!" pasa a "1 / 4 · +15 % EN LOS PREMIOS". Así la ruleta queda más limpia.
   */
  private showTierTitle(tier: WheelTier, animate: boolean) {
    if (this.test) return;
    const t = this.titleText;
    const sub = this.subText;
    const W = this.scale.width;
    if (t?.active) {
      const look = TIER_LOOK[tier];
      t.setText(tier === 'normal' ? 'RULETA DIARIA' : look.title.replace(/[¡!]/g, '')).setColor(tier === 'normal' ? '#ffd23f' : look.text).setFontSize(52);
      if (t.width > W - 30) t.setFontSize(Math.floor((52 * (W - 30)) / t.width));
      if (animate) {
        this.tweens.killTweensOf(t);
        t.setAlpha(1);
        this.tweens.add({ targets: t, scale: { from: 1.35, to: 1 }, duration: 380, ease: 'Back.easeOut' });
      }
    }
    if (sub?.active) {
      sub.setText(tier === 'normal' ? `${this.bonus ? '' : `${this.index + 1} / ${WHEEL.perDay}  ·  `}¡GANASTE UN GIRO!` : `${this.bonus ? '' : `${this.index + 1} / ${WHEEL.perDay}  ·  `}+${WHEEL.tiers.bonusPct[tier]}% EN LOS PREMIOS`);
      if (tier !== 'normal') sub.setColor(TIER_LOOK[tier].text);
      if (animate) {
        this.tweens.killTweensOf(sub);
        sub.setAlpha(1);
        this.tweens.add({ targets: sub, scale: { from: 1.25, to: 1 }, duration: 320, ease: 'Back.easeOut' });
      }
    }
  }

  /**
   * (18-11-2026, usuario) La ruleta evolucionó: las cantidades de los sectores (monedas, EXP, dinero) pasan al valor CON el bonus
   * (el mismo cálculo que el cobro, dailyWheel.scaleReward), en el color del nivel, con un salto y un "+N" que sube.
   */
  private showTierAmounts(tier: WheelTier, animate: boolean) {
    const col = tier === 'epic' ? '#e4c8ff' : tier === 'gold' ? '#ffe36b' : '#ffffff';
    for (const a of this.amounts) {
      const p = a.slot.prize;
      if (p.kind !== 'coins' && p.kind !== 'xp' && p.kind !== 'cash') continue;
      const base = p.amount;
      const sr = scaleReward({ kind: p.kind, amount: base }, tier);
      const now = 'amount' in sr ? sr.amount : base;
      const t = a.label;
      if (!t.active) continue;
      t.setText(String(now)).setColor(tier === 'normal' ? '#ffffff' : col).setScale(1);
      const k = t.width > a.maxW ? a.maxW / t.width : 1;
      t.setScale(k);
      if (!animate || now === base) continue;
      this.tweens.killTweensOf(t);
      this.tweens.add({ targets: t, scale: { from: k * 1.7, to: k }, duration: 420, ease: 'Back.easeOut' });
      // "+N" que sube desde el número (dentro del sector, gira con la ruleta)
      const parent = t.parentContainer;
      if (!parent) continue;
      const plus = this.add.text(t.x, t.y - t.height * k * 0.7, `+${now - base}`, { fontFamily: FONT, fontSize: `${Math.round(t.height * k * 0.6)}px`, color: col, stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
      parent.add(plus);
      this.tweens.add({ targets: plus, y: plus.y - 26, alpha: { from: 1, to: 0 }, delay: 250, duration: 700, ease: 'Sine.easeOut', onComplete: () => plus.destroy() });
    }
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
    this.phase = 'settling';
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
    this.tweens.killTweensOf(this.wheel.getAll());
    // 1) fuera la ruleta, el título y las indicaciones
    for (const o of [...this.children.list]) {
      if (this.keep.has(o)) continue;
      this.tweens.killTweensOf(o);
      this.tweens.add({ targets: o, alpha: 0, scale: (o as unknown as { scale: number }).scale * 0.6, duration: 240, ease: 'Cubic.easeIn', onComplete: () => o.destroy() });
    }
    this.closeBtn.setVisible(false);
    // 2) cobro automático
    if (!claimed) {
      this.noteGain(claimWheel(this.index, this.bonus)?.given);
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
    const glow = this.add.image(cx, cy, GLOW_KEY).setTint(this.tier !== 'normal' && !special ? TIER_LOOK[this.tier].glow : special ? 0xff9bd8 : 0xffd23f).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setScale(0.5);
    this.tweens.add({ targets: glow, alpha: 0.95, scale: 4.2, delay: t0, duration: 520, ease: 'Cubic.easeOut' });
    this.tweens.add({ targets: glow, scale: 4.6, alpha: 0.75, delay: t0 + 520, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    // (17-11-2026) contenedor: la MONEDA es una imagen (moneda-1.webp); el resto de premios, dibujados
    const icon = this.add.container(cx, cy);
    const iconSlot = reward.kind === 'coins' && slot.prize.kind !== 'coins' ? WHEEL.slots.find((s) => s.prize.kind === 'coins')! : reward.kind === 'xp' && slot.prize.kind !== 'xp' ? WHEEL.slots.find((s) => s.prize.kind === 'xp')! : reward.kind === 'cash' && slot.prize.kind !== 'cash' ? WHEEL.slots.find((s) => s.prize.kind === 'cash')! : reward.kind === 'item' ? WHEEL.slots.find((s) => s.prize.kind === 'cosmetic')! : reward.kind === 'chest' ? WHEEL.slots.find((s) => s.prize.kind === 'chest')! : slot;
    const iconR = Math.min(150, W * 0.2);
    const cashKey = iconSlot.prize.kind === 'cash' ? (iconSlot.prize.amount > 1 ? 'cash-pack' : 'cash-1') : null;
    if (iconSlot.prize.kind === 'coins' && this.textures.exists('coin-1')) icon.add(coinIcon(this, 0, 0, iconR));
    else if (reward.kind === 'coins2v2') icon.add(coin2v2Image(this, 0, 0, iconR));
    // (17-11-2026) DINERO: billete (1) o fardo chico (más de 1)
    else if (cashKey && this.textures.exists(cashKey)) icon.add(this.add.image(0, 0, cashKey).setDisplaySize(iconR * 2.4, iconR * 2.4));
    // (17-11-2026, usuario) COFRE: la imagen del NIVEL que quedó (el premio puede subir el cofre a oro o épico)
    else if (reward.kind === 'chest' && this.textures.exists(CHEST_TEX[0])) icon.add(chestImage(this, 0, 0, iconR * 2.6, (getPlayer() as { chest?: { level: number } }).chest?.level ?? 0));
    else {
      const ig = this.add.graphics();
      drawSlotIcon(ig, iconSlot, iconR);
      icon.add(ig);
    }
    icon.setScale(0).setAngle(-25);
    this.tweens.add({ targets: icon, scale: 1, angle: 0, delay: t0, duration: 560, ease: 'Back.easeOut' });
    this.tweens.add({ targets: icon, y: cy - 10, delay: t0 + 600, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (celebrate) this.time.delayedCall(t0 + 120, () => this.burst(cx, cy, special));
    if (special) this.specialCelebration();
    // (18-11-2026, usuario) al cobrar ya no sale "RULETA DORADA +15 %" (lo decían los títulos)

    // 4) cantidad debajo (cuenta hacia arriba) y etiqueta
    const n = (v: number) => v.toLocaleString('es-CL');
    let big: string;
    let small: string;
    let note = '';
    let target = 0;
    // COFRE EVOLUTIVO (domain/chest.ts): nuevo o evolucionado (el cobro ya lo aplicó: se lee su estado)
    const chest = reward.kind === 'chest' ? getPlayer().chest : undefined;
    if (reward.kind === 'item') {
      big = `¡${reward.name.toUpperCase()}!`;
      small = 'NUEVO COSMÉTICO';
    } else if (reward.kind === 'chest') {
      big = `¡${CHEST.names[chest?.level ?? 0]}!`;
      small = (chest?.level ?? 0) > 0 ? '¡EVOLUCIONÓ!' : 'SE ABRE EN 2 DÍAS';
      // (23-11-2026, usuario) sin el texto blanco del tiempo ("Se abre en …"): ya lo dice el amarillo

    } else {
      target = reward.amount;
      big = `+${n(target)}`;
      small = reward.kind === 'xp' ? 'EXP' : reward.kind === 'cash' ? 'DINERO' : reward.kind === 'coins2v2' ? 'MONEDAS 2V2' : 'MONEDAS';
      if (reward.kind === 'coins' && reward.duplicateOf !== undefined) note = reward.duplicateOf ? 'Ya tenías ese cosmético: compensación' : 'Ya tienes todos los cosméticos: compensación';
    }
    const ty = cy + Math.min(150, W * 0.2) + 90;
    const textOnly = reward.kind === 'item' || reward.kind === 'chest';
    const amount = this.add.text(cx, ty, textOnly ? big : '+0', { fontFamily: FONT, fontSize: textOnly ? '60px' : '110px', color: special ? '#ffd23f' : '#ffffff', stroke: '#0a1638', strokeThickness: 14 }).setOrigin(0.5).setAlpha(0).setScale(0.4);
    if (amount.width > W - 60) amount.setFontSize(Math.floor((parseInt(String(amount.style.fontSize), 10) * (W - 60)) / amount.width));
    amount.setShadow(0, 8, '#0a1638', 0, true, true);
    this.tweens.add({ targets: amount, alpha: 1, scale: 1, delay: t0 + 300, duration: 420, ease: 'Back.easeOut' });
    if (!textOnly) {
      const c = { v: 0 };
      this.tweens.add({ targets: c, v: target, delay: t0 + 360, duration: 800, ease: 'Cubic.easeOut', onUpdate: () => amount.setText(`+${n(Math.round(c.v))}`), onComplete: () => amount.setText(big) });
    }
    // (23-11-2026, usuario) cofre: el texto amarillo un poco más abajo (56 -> 80)
    const label = this.add.text(cx, ty + (reward.kind === 'chest' ? 80 : textOnly ? 56 : 84), small, { fontFamily: FONT, fontSize: '40px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 9 }).setOrigin(0.5).setAlpha(0).setLetterSpacing(3);
    this.tweens.add({ targets: label, alpha: 1, delay: t0 + 620, duration: 300 });
    if (note) {
      const nt = this.add.text(cx, label.y + 48, note, { fontFamily: FONT, fontSize: '22px', color: '#cfe0ff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: nt, alpha: 1, delay: t0 + 800, duration: 300 });
    }

    // x2 con anuncio: SOLO monedas o EXP (un cosmético no se duplica), mientras el giro no haya usado su bonus.
    // Igual que el x2 del PREMIO DIARIO: solo aparece si hay anuncios (app con AdMob, o dev.adsSim en localhost);
    // si el anuncio falla, avisa y el premio queda igual.
    // Completar el anuncio entrega otra vez el mismo premio (domain/dailyWheel.claimAdBonus).
    const savedSpin = wheelSpin(this.index, this.bonus);
    /** (25-11-2026, usuario) PRIMERA ruleta (nivel 1, tras ganar el 1.er partido): se explica el x2, como en el PREMIO DIARIO */
    let explainX2: ((done: () => void) => void) | null = null;
    if (!textOnly && savedSpin?.claimed && !savedSpin.adBonusClaimed && canShowRewardedAds()) {
      const bx = cx;
      const by = label.y + (note ? 118 : 92);
      let busy = false;
      let msg: Phaser.GameObjects.Text | undefined;
      const x2 = adDoubleButton(this, bx, by, () => {
        if (busy) return;
        busy = true;
        x2.disableInteractive();
        const couldContinue = this.canContinue;
        this.canContinue = false; // mientras se ve el anuncio no se cierra la ruleta
        void showRewarded('wheel_reward_bonus').then((earned) => {
          if (!this.scene.isActive()) return;
          this.canContinue = couldContinue || this.canContinue;
          const extra = earned ? claimWheelAdBonus(this.index, this.bonus) : null;
          this.noteGain(extra);
          if (!extra || extra.kind === 'item' || extra.kind === 'chest') {
            busy = false;
            x2.setInteractive({ useHandCursor: true });
            // un solo aviso aunque se pulse varias veces
            msg?.destroy();
            const shown = this.add.text(cx, by + 64, 'Anuncio no disponible · premio conservado', { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5).setDepth(100);
            msg = shown;
            this.time.delayedCall(2400, () => shown.destroy());
            return;
          }
          // premio doblado: el número sube de +X a +2X y el botón queda como sello "x2"
          msg?.destroy();
          this.tweens.killTweensOf(x2);
          this.tweens.add({ targets: x2, scale: 0, alpha: 0, duration: 220, ease: 'Back.easeIn', onComplete: () => x2.destroy() });
          const total = target + extra.amount;
          const c2 = { v: target };
          this.tweens.add({
            targets: c2,
            v: total,
            duration: 700,
            ease: 'Cubic.easeOut',
            onUpdate: () => amount.setText(`+${n(Math.round(c2.v))}`),
            onComplete: () => {
              amount.setText(`+${n(total)}`).setColor('#ffd23f');
              this.tweens.add({ targets: amount, scale: { from: 1.25, to: 1 }, duration: 320, ease: 'Back.easeOut' });
            },
          });
          const seal = this.add.text(amount.x + amount.width / 2 + 10, amount.y - 40, 'x2', { fontFamily: FONT, fontSize: '44px', color: '#ffffff', stroke: '#b8146a', strokeThickness: 10 }).setOrigin(0, 0.5).setAngle(-12).setScale(0).setDepth(100);
          this.tweens.add({ targets: seal, scale: 1, delay: 200, duration: 360, ease: 'Back.easeOut', easeParams: [3] });
          this.burst(amount.x, amount.y, false);
          wheelClaim(this);
        });
      });
      x2.setAlpha(0).setScale(0.6).setDepth(100);
      this.tweens.add({ targets: x2, alpha: 1, scale: 1, delay: t0 + 1000, duration: 320, ease: 'Back.easeOut' });
      // invita a pulsarlo: late suave (el rebote al pulsar es del contenido interior: no choca con este latido)
      this.tweens.add({ targets: x2, scale: 1.06, delay: t0 + 1400, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (savedSpin.matchId === GUIDE_FIRST_WHEEL && !claimed) { // (solo al cobrarla, no si se vuelve a ver)
        // la mano en el x2, el aviso y un reloj de 1,5 s; luego se puede continuar
        explainX2 = (done) => {
          // (26-11-2026, usuario) todo OPACO menos el x2 (2 s); el aviso un poco más abajo del botón
          const H0 = this.scale.height;
          const dim = this.add.rectangle(0, 0, W, H0, 0x02060f, 0.82).setOrigin(0).setDepth(101).setScrollFactor(0).setInteractive().setAlpha(0);
          this.tweens.add({ targets: dim, alpha: 1, duration: 300 });
          x2.setDepth(102);
          const hand = tapHint(this, bx, by, 103);
          const t = this.add.text(cx, by + 92, 'OPCIONAL: ¡DUPLICA TU RECOMPENSA!', { fontFamily: FONT, fontSize: '28px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 7, align: 'center' }).setOrigin(0.5, 0).setDepth(103);
          if (t.width > W - 40) t.setScale((W - 40) / t.width);
          const clock = clockTimer(this, cx, t.y + t.displayHeight + 46, 2000).setDepth(103);
          this.time.delayedCall(2000, () => {
            [hand, t, clock].forEach((o) => o.destroy());
            this.tweens.add({ targets: dim, alpha: 0, duration: 250, onComplete: () => dim.destroy() });
            if (x2.active) x2.setDepth(100);
            done();
          });
        };
      }
    }
    // 5) tocar para continuar (cualquier parte)
    const cont = this.add.text(cx, H * 0.9, 'TOCA PARA CONTINUAR', { fontFamily: FONT, fontSize: '30px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setAlpha(0).setLetterSpacing(2);
    const release = () => {
      this.canContinue = true;
      this.tweens.add({ targets: cont, alpha: 1, duration: 300, onComplete: () => this.tweens.add({ targets: cont, alpha: 0.4, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
    };
    this.time.delayedCall(t0 + 1100, () => (explainX2 ? explainX2(release) : release()));
  }

  /** (21-11-2026) Apunta lo entregado (monedas / EXP) para que el MENÚ lo muestre llegando a sus cards (registry menu.wheelGain). */
  private noteGain(g: WheelReward | null | undefined) {
    if (!g || (g.kind !== 'coins' && g.kind !== 'xp' && g.kind !== 'coins2v2')) return;
    const cur = (this.registry.get('menu.wheelGain') as { coins: number; xp: number; coins2v2?: number } | undefined) ?? { coins: 0, xp: 0 };
    this.registry.set('menu.wheelGain', { coins: cur.coins + (g.kind === 'coins' ? g.amount : 0), xp: cur.xp + (g.kind === 'xp' ? g.amount : 0), coins2v2: (cur.coins2v2 ?? 0) + (g.kind === 'coins2v2' ? g.amount : 0) });
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

/** Abre la ruleta `index` encima de la escena actual. */
/**
 * Abre la ruleta encima de `scene`. Devuelve la escena, o null si Phaser la dejó EN COLA: añadirla por primera vez a mitad
 * de un fotograma (p. ej. desde el tween de un botón) no la crea hasta el siguiente. Quien necesite la escena (sus eventos)
 * debe esperarla: whenWheelReady.
 */
export function openWheel(scene: Phaser.Scene, index: number, extra?: Omit<WheelSceneData, 'index'>): WheelScene | null {
  const key = WheelScene.KEY;
  const data: WheelSceneData = { index, ...extra, underlay: scene };
  if (scene.scene.get(key)) scene.scene.launch(key, data);
  else scene.scene.add(key, WheelScene, true, data);
  scene.scene.bringToTop(key);
  return (scene.scene.get(key) as WheelScene | null) ?? null;
}

/** Llama a `cb` con la escena de la ruleta en cuanto exista (reintenta cada fotograma, como mucho ~2 s). */
export function whenWheelReady(scene: Phaser.Scene, cb: (w: WheelScene) => void, tries = 120) {
  const w = scene.scene.get(WheelScene.KEY) as WheelScene | null;
  if (w) return cb(w);
  if (tries <= 0 || !scene.sys.isActive()) return;
  scene.time.delayedCall(16, () => whenWheelReady(scene, cb, tries - 1));
}

/**
 * Botón "x2" con icono de anuncio, igual al del PREMIO DIARIO (ui/DailyLoginButton.ts, showDailyRewardReveal): botón
 * arcade azul con "x2" y una pantallita con ▶ a la derecha. `onPress` se llama al soltar. Tocarlo no cuenta como
 * "toca para continuar".
 */
function adDoubleButton(scene: Phaser.Scene, x: number, y: number, onPress: () => void) {
  const btn = arcadeButton(scene, x, y, Math.min(300, scene.scale.width - 80), 82, 'x2', onPress, { palette: 'blue' });
  const label = btn.getData('label') as Phaser.GameObjects.Text | undefined;
  if (label) label.x = -18;
  const videoIcon = scene.add.graphics({ x: 38, y: 0 });
  videoIcon.fillStyle(0x0a1638, 1).fillRoundedRect(-16, -12, 32, 24, 5);
  videoIcon.fillStyle(0xffffff, 1).fillPoints([{ x: -4, y: -7 }, { x: 8, y: 0 }, { x: -4, y: 7 }], true);
  btn.add(videoIcon);
  const stop = (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation();
  btn.on('pointerdown', stop);
  btn.on('pointerup', stop);
  return btn;
}
