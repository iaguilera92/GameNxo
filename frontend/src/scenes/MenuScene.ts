import Phaser from 'phaser';
import { C, FONT, restartOnResize, textStyle } from '../ui/theme';
import { Character, playerLook } from '../objects/Character';
import { getProfile, levelProgress } from '../logic/Profile';
import { addPortrait } from '../characters/portrait';
import type { SkinId } from '../characters/skins';
import { roundedPoly } from '../ui/shapes';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { showRankList } from '../ui/RankListDialog';
import { arcadeButton, lockedModeButton } from '../ui/modeButtons';
import { fitText } from '../ui/fitText';
import { myLeague, myPosition, rankedState, syncRanked } from '../logic/Ranked';
import { dailyLoginButton } from '../ui/DailyLoginButton';
import { rankedPlayButton } from '../ui/PlayEntry';
import { serverUrl } from '../net/config';
import { getPlayer, onPlayerChange } from '../domain/playerStore';
import { DailyWheels } from '../ui/DailyWheels';
import { showSettings } from '../ui/SettingsDialog';
import { BP_TIERS, bpClaimable, bpLevel, syncSeason } from '../domain/battlePass';
import type { PlayerState } from '../domain/player';
import { openWheel } from './WheelScene';
import { markWheelPresented, syncWheels, wheelToPresent } from '../logic/Wheels';

/** ancho máximo del número en los contadores (entre el icono y el botón +) */
/** ancho de los contadores de monedas / dinero y del texto de su cifra */
const COUNTER_W = 172;
const COUNTER_TEXT_W = 92;


/**
 * Menú principal (vertical) estilo app de juego:
 *   barra de perfil (avatar + nivel + XP) · monedas/gemas · ajustes
 *   personaje grande al centro
 *   accesos laterales (Personaje, Tienda)
 *   botón JUGAR
 *   barra inferior (Ranking · Inicio · Eventos)
 * Monedas, gemas, tienda, ranking y eventos son visuales por ahora (sin lógica).
 */
/** Alto visible del personaje del menú (px) y desplazamiento a la derecha del centro. */
const HERO_H = 760;
const HERO_SHIFT_X = 112;
const BG_ZOOM = 1.12;

/**
 * Barra inferior en imagen (public/assets/nav-bar.png). `box` = contenido visible en píxeles
 * de la imagen (sin el margen transparente); `split` = límites entre las 3 pestañas (0..1).
 * Si la imagen no existe se dibuja la barra vectorial de antes.
 */
const NAV = {
  key: 'nav-home',
  file: 'assets/barra-inicio.png',
  w: 2172,
  h: 724,
  box: { x0: 46, y0: 170, x1: 2124, y1: 540 },
  split: [0.33, 0.67] as [number, number],
  side: 6, // margen lateral en pantalla
  bottom: 26, // margen inferior en pantalla
};

export class MenuScene extends Phaser.Scene {
  constructor() {
    super('Menu');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    if (!this.textures.exists('btn-jugar')) this.load.image('btn-jugar', 'assets/btn-jugar.png');
    if (!this.textures.exists('daily-coins-art')) this.load.image('daily-coins-art', 'assets/monedas.png');
    if (!this.textures.exists('daily-cash-art')) this.load.image('daily-cash-art', 'assets/billetes.png');
    if (!this.textures.exists('daily-title-art')) this.load.image('daily-title-art', 'assets/premio-diario.png');
    if (!this.textures.exists(NAV.key)) this.load.image(NAV.key, NAV.file);
    preloadRankBadges(this.load, [myLeague()]);
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    restartOnResize(this);
    this.cameras.main.fadeIn(250, 0, 0, 0);

    const p = getProfile();
    this.drawBg(W, H);

    const go = (key: string) => {
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start(key));
    };

    // Anclas fijas (funciona en pantallas muy altas como iPhone 16 Pro Max):
    const navH = this.textures.exists(NAV.key) ? this.navImageHeight(W) : 112; // barra inferior
    const navTop = H - navH;
    const playY = navTop - 130; // botón JUGAR sobre la barra
    const feetY = playY - 175;  // pies del personaje sobre JUGAR

    // --- personaje (pies anclados; se apoya sobre un disco de luz)
    // desplazado a la derecha para no chocar con los botones PERSONAJE y TIENDA
    const px = W / 2 + HERO_SHIFT_X;
    this.add.ellipse(px, feetY, 460, 90, 0x0a1a3a, 0.5);
    // retrato estático si la skin lo tiene; si no, el personaje animado de siempre
    if (!addPortrait(this, p.skin as SkinId, px, feetY + 8, HERO_H)) {
      const hero = new Character(this, px - 10, feetY, playerLook(p.skin), 'front').setScale(4.8);
      this.time.addEvent({ delay: 2800, loop: true, callback: () => hero.swing() });
    }

    this.profileBar(W, p);    // botones laterales a media altura, sin chocar con el personaje
    // nunca encima del widget del PASE (termina en y≈242): si no, en pantallas bajas/anchas lo tapan
    const sideY = Math.max(242 + 16 + 68, Math.min(H * 0.4, feetY - 300));
    this.sideButton(128, sideY, 'PERSONAJE', 'user', false, () => go('Customize'));
    this.sideButton(128, sideY + 166, 'TIENDA', 'shop', false, () => go('Shop'));
    // premio diario: bajo TIENDA, mitad de su ancho (214/2); se marca en dorado pero NUNCA se abre solo
    // (sin pisar el panel de ruletas en pantallas bajas)
    const dailyH = 84;
    const dailyW = 214 / 2;
    // misma separación que PERSONAJE–TIENDA (166 entre centros con 136 de alto = 30 de hueco)
    const gapSide = 166 - 136;
    const dailyY = Math.min(sideY + 166 + 136 / 2 + gapSide + dailyH / 2, playY - 124 - 52 - 30 - dailyH / 2);
    // alineado a la izquierda con TIENDA (su borde izquierdo está en 128 − 214/2)
    dailyLoginButton(this, 128 - 214 / 2 + dailyW / 2, dailyY, (m) => this.toast(m), dailyW, dailyH);

    // --- JUGAR
    // JUGAR = partida Ranked en tu liga con la apuesta elegida (monto tocable + info). Sin monedas: amistosa gratis
    this.playRow(W, playY, (bet) => {
      // datos del flujo BOT de siempre: Ranked con la apuesta elegida, o AMISTOSO sin monedas
      const botFlow = bet ? { ranked: { bet }, from: 'Menu' } : { unranked: true, from: 'Menu' };
      // con servidor multijugador configurado: primero se busca un rival real 5 s (LanSearch); sin rival, el BOT
      const lan = serverUrl() !== null;
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => (lan ? this.scene.start('LanSearch', { fallback: botFlow }) : this.scene.start('Matchmaking', botFlow)));
    });

    // --- ruletas diarias (encima de JUGAR). Una ruleta recién ganada se abre sola UNA vez.
    this.dailyWheels(W, playY);

    if (this.textures.exists(NAV.key)) this.navImage(W, H);
    else this.bottomBar(W, navTop, navH);
  }

  // ---------------------------------------------------------------- barra inferior (imagen)
  /** Alto que ocupa la barra-imagen (contenido visible + margen inferior) para un ancho W. */
  private navImageHeight(W: number) {
    const { x0, y0, x1, y1 } = NAV.box;
    return ((W - NAV.side * 2) / (x1 - x0)) * (y1 - y0) + NAV.bottom;
  }

  /**
   * Barra RANKING · INICIO · EVENTOS como imagen: ocupa todo el ancho (responsivo, se escala
   * con el ancho de la pantalla) y se apoya abajo. Cada tercio tiene su zona táctil.
   */
  private navImage(W: number, H: number) {
    const { x0, y0, x1, y1 } = NAV.box;
    const s = (W - NAV.side * 2) / (x1 - x0);
    const bottom = H - NAV.bottom;
    const top = bottom - (y1 - y0) * s;
    // origen = esquina inferior izquierda del contenido visible (la imagen trae margen transparente)
    this.add.image(NAV.side, bottom, NAV.key).setOrigin(x0 / NAV.w, y1 / NAV.h).setScale(s).setDepth(100);

    const zone = (from: number, to: number, onClick: () => void) => {
      const zx = NAV.side + (W - NAV.side * 2) * from;
      const zw = (W - NAV.side * 2) * (to - from);
      const hit = this.add.rectangle(zx + zw / 2, (top + bottom) / 2, zw, bottom - top + 16, 0x000000, 0.001).setDepth(102);
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    };
    zone(0, NAV.split[0], () => this.openRanked());
    zone(NAV.split[0], NAV.split[1], () => undefined); // INICIO (activa)
    zone(NAV.split[1], 1, () => this.toast('Eventos: próximamente'));
  }

  // ---------------------------------------------------------------- Ranked
  /** RANKING: abre el modo Ranked (desde nivel RANK_UNLOCK_LEVEL); antes, la lista informativa de ligas. */
  private openRanked() {
    syncRanked();
    const p = getProfile();
    if (!rankedState().unlocked) {
      showRankList(this, { current: myLeague(), level: p.level });
      return;
    }
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Ranked'));
  }

  // ---------------------------------------------------------------- ruletas diarias
  private dailyWheels(W: number, playY: number) {
    syncWheels();
    // mismo ancho que la fila JUGAR + 2v2 (márgenes 26) y su misma forma inclinada
    const w = W - 52;
    new DailyWheels(this, W / 2, playY - 54 - 18 - 52, w, {
      onOpen: (i) => openWheel(this, i),
      onToast: (m) => this.toast(m),
    });
    const auto = wheelToPresent();
    if (auto >= 0) {
      markWheelPresented(auto); // antes de abrir: no se repite aunque se cierre o se reinicie el menú
      this.time.delayedCall(650, () => openWheel(this, auto));
    }
  }

  // ---------------------------------------------------------------- fila JUGAR + 2v2
  /**
   * Fila de modos: JUGAR (≈70 %, amarillo, principal) y 2v2 (≈30 %, gris, bloqueado).
   * Ambos comparten la misma forma inclinada del botón JUGAR original, dibujada por código.
   */
  private playRow(W: number, y: number, onPlay: (bet: number | null) => void) {
    const margin = 26;
    const gap = 14;
    const h = 108;
    const avail = W - margin * 2 - gap;
    const jw = Math.round(avail * 0.7);
    const vw = avail - jw;
    rankedPlayButton(this, margin + jw / 2, y, jw, h, onPlay);
    lockedModeButton(this, margin + jw + gap + vw / 2, y, vw, h, '2v2');
  }

  // ---------------------------------------------------------------- fondo
  private drawBg(W: number, H: number) {
    // un poco más grande y anclado abajo: sube la cancha para que el personaje pise el suelo
    const bg = this.add.image(W / 2, H, 'menu-bg').setOrigin(0.5, 1);
    const s = Math.max(W / bg.width, H / bg.height) * BG_ZOOM;
    bg.setScale(s).setScrollFactor(0);
    // oscurecido sutil para que resalte la UI
    this.add.rectangle(0, 0, W, H, 0x04122e, 0.25).setOrigin(0);
  }

  // ---------------------------------------------------------------- barra de perfil
  private profileBar(W: number, p: ReturnType<typeof getProfile>) {
    const y = 58;
    // monedas doradas + dinero (billetes). Decorativos.
    // ajustes (engranaje) a la derecha del todo, alineado con los dos contadores
    const gs = 86; // lado del botón
    const gx = W - 22 - gs / 2;
    const gy = y + 4 + 90 / 2; // centro vertical de los dos contadores (y+4 .. y+94)
    // el perfil ocupa el espacio libre hasta los contadores (132 = ancho de un contador)
    const countersLeft = gx - gs / 2 - 10 - COUNTER_W;
    this.profileCard(24, y, Math.min(440, countersLeft - 24 - 14), p);
    // justo bajo el perfil y con su mismo ancho
    this.passWidget(24, y + 96 + 12, Math.min(380, Math.min(440, countersLeft - 24 - 14)));
    this.coinCounter(gx - gs / 2 - 10, y + 4);
    // dinero (billetes): saldo real, en vivo; al tocarlo lleva a la Tienda
    const cash = this.counter(gx - gs / 2 - 10, y + 52, 'cash', getPlayer().gems.toLocaleString('es-CL'));
    const cashTxt = cash.getData('text') as Phaser.GameObjects.Text;
    const offCash = onPlayerChange((s) => {
      cashTxt.setText(s.gems.toLocaleString('es-CL'));
      fitText(cashTxt, COUNTER_TEXT_W);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offCash());
    cash.setSize(COUNTER_W, 42).setInteractive(new Phaser.Geom.Rectangle(0, 0, COUNTER_W, 42), Phaser.Geom.Rectangle.Contains);
    cash.on('pointerup', () => this.scene.start('Shop'));
    this.gearButton(gx, gy, gs, () => showSettings(this));
  }

  /** Acceso al PASE DE BATALLA: nivel del pase, barra de progreso y aviso de premios por reclamar. */
  private passWidget(x: number, y: number, w: number) {
    const s = syncSeason(getPlayer() as PlayerState);
    const { level, progress } = bpLevel(s.bp.xp);
    const ready = bpClaimable(s);
    const h = 76;
    const c = this.add.container(x, y);
    // halo dorado que respira (invita a tocar)
    const halo = this.add.graphics();
    halo.lineStyle(12, 0xffd23f, 0.55).strokeRoundedRect(-2, -2, w + 4, h + 4, 22);
    halo.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25);
    c.add(halo);
    this.tweens.add({ targets: halo, alpha: 0.75, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const g = this.add.graphics();
    // cuerpo DORADO brillante (capas: base ámbar, mitad alta oro, reflejo claro) + doble borde
    g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 6, w, h, 20);
    g.fillStyle(0xe58a00, 1).fillRoundedRect(0, 0, w, h, 20);
    g.fillStyle(0xffc42e, 1).fillRoundedRect(0, 0, w, h * 0.62, { tl: 20, tr: 20, bl: 8, br: 8 });
    g.fillStyle(0xffe680, 1).fillRoundedRect(4, 3, w - 8, h * 0.3, { tl: 17, tr: 17, bl: 6, br: 6 });
    g.fillStyle(0xffffff, 0.45).fillRoundedRect(14, 5, w - 28, 6, 3);
    g.lineStyle(3, 0x7a4a00, 1).strokeRoundedRect(0, 0, w, h, 20);
    g.lineStyle(2, 0xfff1b8, 0.9).strokeRoundedRect(3, 3, w - 6, h - 6, 17);
    // insignia (corona + nivel del pase): disco azul noche con corona dorada
    const bx0 = 10 + 43;
    g.fillStyle(0x7a4a00, 1).fillCircle(bx0, h / 2, 31);
    g.fillStyle(0x0a1638, 1).fillCircle(bx0, h / 2, 27);
    g.fillStyle(0x1f3a7a, 0.6).fillEllipse(bx0 - 4, h / 2 - 12, 30, 10);
    g.fillStyle(0xffd23f, 1).fillPoints([{ x: bx0 - 11, y: h / 2 - 8 }, { x: bx0 - 13, y: h / 2 - 19 }, { x: bx0 - 6, y: h / 2 - 13 }, { x: bx0, y: h / 2 - 21 }, { x: bx0 + 6, y: h / 2 - 13 }, { x: bx0 + 13, y: h / 2 - 19 }, { x: bx0 + 11, y: h / 2 - 8 }], true);
    c.add(g);
    c.add(this.add.text(bx0, h / 2 + 7, String(level), { fontFamily: FONT, fontSize: '24px', color: '#ffd23f' }).setOrigin(0.5));
    // chevron que empuja hacia la derecha
    const chev = this.add.graphics({ x: w - 22, y: h / 2 });
    chev.lineStyle(5, 0x5a3200, 1).beginPath().moveTo(-5, -10).lineTo(5, 0).lineTo(-5, 10).strokePath();
    c.add(chev);
    this.tweens.add({ targets: chev, x: w - 16, duration: 420, yoyo: true, repeat: -1, repeatDelay: 500, ease: 'Sine.easeInOut' });
    // textos + barra alineados con los del perfil
    const tx = bx0 + 43 + 10;
    const tw = w - tx - 40;
    const title = this.add.text(tx, 12, 'PASE DE BATALLA', { fontFamily: FONT, fontSize: '23px', color: '#ffffff', stroke: '#7a4a00', strokeThickness: 5 }).setOrigin(0, 0);
    fitText(title, tw);
    c.add(title);
    const done = level >= BP_TIERS;
    c.add(this.add.text(tx, 40, done ? 'COMPLETADO' : `NIVEL ${level + 1} DE ${BP_TIERS}`, { fontFamily: FONT, fontSize: '14px', color: '#5a3200' }).setOrigin(0, 0).setLetterSpacing(1));
    const by = 58;
    const bar = this.add.graphics();
    bar.fillStyle(0x5a3200, 1).fillRoundedRect(tx, by, tw, 10, 5).lineStyle(1, 0x7a4a00, 1).strokeRoundedRect(tx, by, tw, 10, 5);
    const fw = Math.max(10, tw * (done ? 1 : progress));
    bar.fillStyle(0xffffff, 1).fillRoundedRect(tx, by, fw, 10, 5);
    bar.fillStyle(0xfff1b8, 1).fillRoundedRect(tx, by + 5, fw, 5, { tl: 0, tr: 0, bl: 5, br: 5 });
    c.add(bar);
    // brillo que cruza el cuadro (recortado a su forma)
    const shine = this.add.graphics();
    shine.fillStyle(0xffffff, 0.5).fillPoints([{ x: 0, y: 0 }, { x: 34, y: 0 }, { x: 10, y: h }, { x: -24, y: h }], true);
    shine.fillStyle(0xffffff, 0.25).fillPoints([{ x: 44, y: 0 }, { x: 56, y: 0 }, { x: 32, y: h }, { x: 20, y: h }], true);
    shine.setBlendMode(Phaser.BlendModes.ADD).setX(-90);
    const maskG = this.make.graphics({}, false);
    maskG.fillStyle(0xffffff).fillRoundedRect(x, y, w, h, 20);
    shine.setMask(maskG.createGeometryMask());
    c.add(shine);
    this.tweens.add({ targets: shine, x: w + 60, duration: 1100, repeat: -1, repeatDelay: 1500, ease: 'Sine.easeInOut' });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => maskG.destroy());
    // destellos (estrellitas que aparecen y desaparecen)
    const star = (sx: number, sy: number, r: number, delay: number) => {
      const st = this.add.graphics({ x: sx, y: sy });
      st.fillStyle(0xffffff, 1).fillPoints([{ x: 0, y: -r }, { x: r * 0.25, y: -r * 0.25 }, { x: r, y: 0 }, { x: r * 0.25, y: r * 0.25 }, { x: 0, y: r }, { x: -r * 0.25, y: r * 0.25 }, { x: -r, y: 0 }, { x: -r * 0.25, y: -r * 0.25 }], true);
      st.setBlendMode(Phaser.BlendModes.ADD).setScale(0);
      c.add(st);
      this.tweens.add({ targets: st, scale: 1, angle: 90, duration: 380, yoyo: true, repeat: -1, repeatDelay: 1700, delay, ease: 'Sine.easeInOut' });
    };
    star(w * 0.62, 12, 9, 0);
    star(bx0 + 22, h / 2 - 22, 7, 700);
    star(w - 48, h - 16, 8, 1300);
    if (ready > 0) {
      const badge = this.add.container(w - 10, 8);
      const bg = this.add.graphics();
      bg.fillStyle(0x0a1638, 1).fillCircle(0, 0, 15).fillStyle(0xff3b4f, 1).fillCircle(0, 0, 12);
      badge.add([bg, this.add.text(0, 0, String(Math.min(99, ready)), { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)]);
      c.add(badge);
      this.tweens.add({ targets: badge, scale: 1.2, duration: 380, yoyo: true, repeat: -1 });
    }
    // zona táctil = TODO el cuadro (un rectángulo hijo con origen arriba-izquierda: el área de un Container
    // se mide desde su centro y dejaba fuera parte del cuadro)
    const hit = this.add.rectangle(0, 0, w, h, 0x000000, 0.001).setOrigin(0).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerup', () => {
      this.tweens.add({ targets: c, scale: { from: 0.96, to: 1 }, duration: 160 });
      this.cameras.main.fadeOut(200, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('BattlePass'));
    });
  }

  /**
   * Cuadro de perfil: [insignia de rango] [nombre · nivel · barra XP].
   * Datos reales del perfil; la barra se anima cuando la XP sube (también en vivo).
   */
  private profileCard(x: number, y: number, maxW: number, p: ReturnType<typeof getProfile>) {
    const ch = 96;
    const cw = Math.min(maxW, 380); // compacto
    const card = this.add.container(x, y);

    // fondo (mismo lenguaje que el botón de ajustes y las tarjetas laterales)
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(3, 5, cw, ch, 20);
    g.lineStyle(8, 0x3a7bff, 0.18).strokeRoundedRect(0, 0, cw, ch, 20);
    g.fillStyle(0x0b1733, 0.94).fillRoundedRect(0, 0, cw, ch, 20);
    g.fillStyle(0x1b2d5c, 0.5).fillRoundedRect(3, 3, cw - 6, ch * 0.45, { tl: 17, tr: 17, bl: 0, br: 0 });
    g.lineStyle(3, 0x3a7bff, 1).strokeRoundedRect(0, 0, cw, ch, 20);
    card.add(g);

    // insignia de rango a la izquierda (en lugar del avatar)
    const badgeH = 86;
    const badgeX = 10 + badgeH / 2;
    const rank = myLeague();
    const position = myPosition();
    card.add(
      new RankBadge(this, badgeX, ch / 2, {
        rank,
        level: p.level,
        size: badgeH,
        position,
        // tocar la insignia abre la lista de rangos (informativa si aún no se desbloqueó Ranked)
        openWhenLocked: true,
        onOpen: () => showRankList(this, { current: rank, level: p.level, position }),
      }),
    );

    // textos + barra a la derecha de la insignia
    const tx = badgeX + badgeH / 2 + 10;
    const tw = cw - 18 - tx;
    const name = this.add.text(tx, 12, p.name, textStyle(26)).setOrigin(0, 0);
    fitText(name, tw);
    card.add(name);
    const lvl = this.add.text(tx, 45, `Nivel ${p.level}`, textStyle(17, '#9fc0ff')).setOrigin(0, 0);
    card.add(lvl);

    const by = 72;
    const bh = 12;
    const bar = this.add.graphics();
    card.add(bar);
    const drawXp = (prog: number) => {
      const fw = Math.max(bh, tw * Phaser.Math.Clamp(prog, 0, 1));
      bar.clear();
      bar.fillStyle(0x05112c, 1).fillRoundedRect(tx, by, tw, bh, bh / 2);
      bar.lineStyle(1, 0x2a4a8a, 1).strokeRoundedRect(tx, by, tw, bh, bh / 2);
      if (prog <= 0) return;
      bar.fillStyle(0x1f7bff, 1).fillRoundedRect(tx, by, fw, bh, bh / 2);
      bar.fillStyle(0x5fd0ff, 1).fillRoundedRect(tx, by, fw, bh * 0.5, { tl: bh / 2, tr: bh / 2, bl: 0, br: 0 });
      bar.fillStyle(0xffffff, 0.6).fillRoundedRect(tx + 4, by + 2, Math.max(0, fw - 8), 2, 1);
    };

    // animación suave desde lo último que se mostró (sobrevive a cambiar de escena)
    const KEY = 'profile.xpShown';
    const shown = { v: 0 };
    let current = { level: p.level, prog: levelProgress(p) };
    const prev = this.registry.get(KEY) as { level: number; prog: number } | undefined;
    const animateTo = (from: { level: number; prog: number }, to: { level: number; prog: number }) => {
      this.tweens.killTweensOf(shown);
      const steps: { to: number; reset?: boolean }[] =
        to.level > from.level ? [{ to: 1 }, { to: to.prog, reset: true }] : [{ to: to.prog }];
      shown.v = from.prog;
      drawXp(shown.v);
      const run = (i: number) => {
        const s = steps[i];
        if (!s) return;
        if (s.reset) shown.v = 0;
        this.tweens.add({
          targets: shown,
          v: s.to,
          duration: 700,
          ease: 'Cubic.easeOut',
          onUpdate: () => drawXp(shown.v),
          onComplete: () => run(i + 1),
        });
      };
      run(0);
      this.registry.set(KEY, to);
    };
    if (prev && (prev.level < current.level || (prev.level === current.level && prev.prog < current.prog))) animateTo(prev, current);
    else {
      drawXp(current.prog);
      this.registry.set(KEY, current);
    }

    // actualización en vivo si el perfil cambia mientras el menú está abierto
    const off = onPlayerChange((s) => {
      const next = { level: s.level, prog: levelProgress(s) };
      lvl.setText(`Nivel ${s.level}`);
      name.setText(s.name);
      fitText(name, tw);
      animateTo(current, next);
      current = next;
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off());
  }

  /** Botón de ajustes: cuadrado redondeado con borde neón y engranaje relleno. */
  private gearButton(x: number, y: number, size: number, onClick: () => void) {
    const c = this.add.container(x, y);
    const g = this.add.graphics();
    const h = size / 2;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-h + 3, -h + 5, size, size, 20);
    g.lineStyle(8, 0x3a7bff, 0.2).strokeRoundedRect(-h, -h, size, size, 20);
    g.fillStyle(0x0b1733, 0.94).fillRoundedRect(-h, -h, size, size, 20);
    g.fillStyle(0x1b2d5c, 0.55).fillRoundedRect(-h + 3, -h + 3, size - 6, size * 0.45, { tl: 17, tr: 17, bl: 0, br: 0 });
    g.lineStyle(3, 0x3a7bff, 1).strokeRoundedRect(-h, -h, size, size, 20);
    c.add(g);

    // engranaje: 8 dientes trapezoidales + agujero central
    const teeth = 8;
    const rOut = 27;
    const rIn = 20;
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      const step = (Math.PI * 2) / teeth;
      for (const [da, r] of [[-0.5, rIn], [-0.28, rOut], [0.28, rOut], [0.5, rIn]] as [number, number][])
        pts.push({ x: Math.cos(a + da * step) * r, y: Math.sin(a + da * step) * r });
    }
    const gear = this.add.graphics();
    gear.fillStyle(0x000000, 0.3).fillPoints(pts.map((p) => ({ x: p.x + 1.5, y: p.y + 2.5 })), true);
    gear.fillStyle(0xdbe5ff).fillPoints(pts, true);
    gear.fillStyle(0x0b1733).fillCircle(0, 0, 9);
    c.add(gear);

    c.setSize(size, size).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: { from: 0.9, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      this.tweens.add({ targets: gear, angle: gear.angle + 45, duration: 300, ease: 'Back.easeOut' });
      onClick();
    });
  }

  /**
   * Contador de MONEDAS con el saldo real. Al volver de un partido cuenta desde lo último que se
   * mostró hasta el saldo nuevo (con un pequeño salto); también se actualiza en vivo.
   */
  private coinCounter(right: number, y: number) {
    const KEY = 'profile.coinsShown';
    const fmt = (n: number) => Math.round(n).toLocaleString('es-CL');
    const now = getPlayer().coins;
    const prev = this.registry.get(KEY) as number | undefined;
    const c = this.counter(right, y, 'coin', fmt(prev ?? now));
    const txt = c.getData('text') as Phaser.GameObjects.Text;
    const shown = { v: prev ?? now };
    const animateTo = (to: number) => {
      this.registry.set(KEY, to);
      this.tweens.killTweensOf(shown);
      if (to === shown.v) return;
      const up = to > shown.v;
      this.tweens.add({
        targets: shown,
        v: to,
        delay: 350,
        duration: 900,
        ease: 'Cubic.easeOut',
        onUpdate: () => {
          txt.setText(fmt(shown.v));
          fitText(txt, COUNTER_TEXT_W);
        },
        onComplete: () => {
          if (up) this.tweens.add({ targets: txt, scale: { from: txt.scale * 1.25, to: txt.scale }, duration: 320, ease: 'Back.easeOut' });
        },
      });
      if (up) txt.setColor('#ffe27a');
      this.time.delayedCall(1500, () => txt.setColor('#ffffff'));
    };
    animateTo(now);
    const off = onPlayerChange((s) => animateTo(s.coins));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => off());
  }

  /** Contador de recurso, alineado a la derecha (x = borde derecho). */
  private counter(right: number, y: number, kind: 'coin' | 'cash', value: string) {
    const w = COUNTER_W;
    const h = 42;
    const c = this.add.container(right - w, y);
    const g = this.add.graphics();
    // más visible: fondo más opaco, brillo arriba y borde del color de la moneda (dorado / verde)
    const accent = kind === 'coin' ? 0xffc42e : 0x3fae5a;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(2, 4, w, h, h / 2);
    g.fillStyle(0x0a1838, 0.96).fillRoundedRect(0, 0, w, h, h / 2);
    g.fillStyle(0xffffff, 0.08).fillRoundedRect(8, 3, w - 16, h * 0.35, h * 0.17);
    g.lineStyle(2.5, accent, 1).strokeRoundedRect(0, 0, w, h, h / 2);
    // icono
    if (kind === 'coin') {
      g.fillStyle(C.outline).fillCircle(h / 2, h / 2, 15);
      g.fillStyle(C.yellow).fillCircle(h / 2, h / 2, 11);
      g.fillStyle(C.yellowDark).fillRect(h / 2 - 2, h / 2 - 6, 4, 12);
    } else {
      // billete
      g.fillStyle(C.outline).fillRoundedRect(h / 2 - 15, h / 2 - 9, 30, 18, 4);
      g.fillStyle(0x3fae5a).fillRoundedRect(h / 2 - 13, h / 2 - 7, 26, 14, 3);
      g.fillStyle(0xcdeccf).fillCircle(h / 2, h / 2, 4);
    }
    c.add(g);
    const txt = this.add.text(h - 2, h / 2, value, { ...textStyle(23), color: kind === 'coin' ? '#ffe28a' : '#c9f5d2' }).setOrigin(0, 0.5);
    fitText(txt, COUNTER_TEXT_W);
    c.add(txt);
    c.setData('text', txt);
    c.setData('icon', g);
    // (i): qué es, para qué sirve y cómo conseguirla (antes, un "+" sin función)
    const info = this.add.container(w - 19, h / 2);
    const ig = this.add.graphics();
    ig.fillStyle(0x0a1638, 1).fillCircle(0, 0, 14);
    ig.fillStyle(accent, 1).fillCircle(0, 0, 12);
    // dinero: "+" (conseguir más); monedas: "i". Los dos abren la ventana de cómo conseguirla y para qué sirve
    info.add([ig, this.add.text(0, kind === 'cash' ? 0 : 1, kind === 'cash' ? '+' : 'i', { fontFamily: FONT, fontSize: kind === 'cash' ? '24px' : '18px', color: kind === 'cash' ? '#ffffff' : '#0a1638' }).setOrigin(0.5)]);
    info.setSize(40, 42).setInteractive({ useHandCursor: true });
    info.on('pointerup', () => this.currencyInfo(kind));
    c.add(info);
    return c;
  }

  /** Ventana de información de la moneda: para qué sirve y cómo se consigue. */
  private currencyInfo(kind: 'coin' | 'cash') {
    const coin = kind === 'coin';
    const W = this.scale.width;
    const H = this.scale.height;
    const objs: Phaser.GameObjects.GameObject[] = [];
    const close = () => objs.forEach((o) => o.destroy());
    const shade = this.add.rectangle(0, 0, W, H, 0x02060f, 0.72).setOrigin(0).setDepth(8000).setInteractive();
    shade.on('pointerup', close);
    objs.push(shade);
    const pw = Math.min(600, W - 40);
    const ph = 470;
    const accent = coin ? 0xffc42e : 0x3fae5a;
    const p = this.add.container(W / 2, H / 2).setDepth(8001);
    objs.push(p);
    p.add(this.add.rectangle(0, 0, pw, ph, 0, 0.001).setInteractive());
    const g = this.add.graphics();
    g.lineStyle(10, accent, 0.22).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.fillStyle(0x0b1733, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    g.lineStyle(3, accent, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
    // icono grande
    g.fillStyle(0x0a1638, 1).fillCircle(0, -ph / 2 + 64, 36);
    g.fillStyle(accent, 1).fillCircle(0, -ph / 2 + 64, 32);
    if (coin) {
      g.fillStyle(0xd99400, 1).fillCircle(0, -ph / 2 + 64, 22);
      g.fillStyle(0xffd23f, 1).fillCircle(0, -ph / 2 + 62, 20);
    } else {
      g.fillStyle(0x0a1638, 1).fillRoundedRect(-22, -ph / 2 + 50, 44, 28, 5);
      g.fillStyle(0x2f8f48, 1).fillRoundedRect(-19, -ph / 2 + 53, 38, 22, 4);
      g.fillStyle(0xcdeccf, 1).fillCircle(0, -ph / 2 + 64, 6);
    }
    p.add(g);
    p.add(this.add.text(0, -ph / 2 + 126, coin ? 'MONEDAS' : 'DINERO', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(3));
    const section = (y: number, title: string, body: string) => {
      p.add(this.add.text(-pw / 2 + 34, y, title, { fontFamily: FONT, fontSize: '18px', color: coin ? '#ffd23f' : '#9fe8a0' }).setOrigin(0, 0.5).setLetterSpacing(1));
      p.add(this.add.text(-pw / 2 + 34, y + 16, body, { fontFamily: FONT, fontSize: '17px', color: '#dbe5ff', wordWrap: { width: pw - 68 }, lineSpacing: 2 }).setOrigin(0, 0));
    };
    if (coin) {
      section(-ph / 2 + 172, 'PARA QUÉ SIRVEN', 'Son tu oro competitivo: pagan la entrada de las partidas Ranked y deciden tu posición en la tabla de tu liga. No se usan en la Tienda.');
      section(-ph / 2 + 290, 'CÓMO CONSEGUIRLAS', 'Ganando partidas Ranked, en las ruletas diarias, el premio diario, el pase de batalla y la recompensa semanal de tu liga.');
    } else {
      section(-ph / 2 + 172, 'PARA QUÉ SIRVE', 'Es la moneda de la Tienda: compra estilos y el Pase Premium.');
      section(-ph / 2 + 290, 'CÓMO CONSEGUIRLO', 'En el pase de batalla (también el gratis), el premio diario y la recompensa semanal de tu liga (desde Plata).');
    }
    p.add(arcadeButton(this, 0, ph / 2 - 52, 240, 66, 'ENTENDIDO', close, { palette: coin ? 'yellow' : 'blue' }));
    p.setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: p, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  }

  // ---------------------------------------------------------------- botones laterales
  /**
   * Tarjeta lateral (PERSONAJE / TIENDA): paralelogramo con esquinas redondeadas, borde neón,
   * icono grande y texto. `locked` = apagada (sección sin construir) con pestaña de candado.
   */
  private sideButton(x: number, y: number, label: string, icon: 'user' | 'shop', locked: boolean, onClick: () => void) {
    const c = this.add.container(x, y);
    const w = 214;
    const h = 136;
    const k = 14; // inclinación (la parte de arriba se corre a la derecha)
    const shape = roundedPoly([[-w / 2 + k, -h / 2], [w / 2, -h / 2], [w / 2 - k, h / 2], [-w / 2, h / 2]], 16);
    const pal = locked
      ? { fill: 0x0a1226, top: 0x141f3a, line: 0x2c3d66, lineA: 0.8, icon: 0x8391b3, text: '#9aa6c4', glow: 0 }
      : { fill: 0x0b1733, top: 0x1b2d5c, line: 0x3a7bff, lineA: 1, icon: 0xdbe5ff, text: '#ffffff', glow: 0.22 };

    const g = this.add.graphics();
    // sombra
    g.fillStyle(0x000000, 0.35).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
    // halo neón (solo activa)
    if (pal.glow) g.lineStyle(10, pal.line, pal.glow).strokePoints(shape, true, true);
    // cuerpo + brillo superior (degradado vertical aproximado con la misma forma encogida)
    g.fillStyle(pal.fill, locked ? 0.9 : 0.94).fillPoints(shape, true);
    g.fillStyle(pal.top, 0.55).fillPoints(shape.filter((p) => p.y < 0).map((p) => ({ x: p.x * 0.97, y: p.y * 0.96 })), true);
    // borde
    g.lineStyle(3, pal.line, pal.lineA).strokePoints(shape, true, true);
    // filo de luz arriba
    g.lineStyle(2, 0xffffff, locked ? 0.08 : 0.22).lineBetween(-w / 2 + k + 18, -h / 2 + 4, w / 2 - 18, -h / 2 + 4);
    c.add(g);

    // icono
    const ig = this.add.graphics({ x: 0, y: -22 });
    ig.fillStyle(pal.icon);
    if (icon === 'user') {
      ig.fillCircle(0, -10, 16);
      ig.fillRoundedRect(-26, 8, 52, 28, { tl: 22, tr: 22, bl: 6, br: 6 });
    } else {
      ig.lineStyle(5, pal.icon);
      ig.beginPath().moveTo(-34, -20).lineTo(-24, -20).lineTo(-16, 14).lineTo(22, 14).strokePath(); // asa + base
      ig.fillPoints([{ x: -22, y: -12 }, { x: 30, y: -12 }, { x: 24, y: 8 }, { x: -17, y: 8 }], true); // cesta
      ig.fillStyle(pal.fill);
      for (let i = 0; i < 3; i++) ig.fillRect(-12 + i * 13, -8, 6, 12); // rejilla
      ig.fillStyle(pal.icon).fillCircle(-10, 24, 5.5).fillCircle(18, 24, 5.5); // ruedas
    }
    c.add(ig);

    c.add(this.add.text(locked ? 0 : -14, locked ? 26 : 34, label, { ...textStyle(24, pal.text), strokeThickness: 0 }).setOrigin(0.5));
    if (locked) {
      c.add(this.add.text(0, 52, 'PRÓXIMAMENTE', { ...textStyle(15, '#7d8bb0'), strokeThickness: 0 }).setOrigin(0.5));
      // pestaña con candado en la esquina superior derecha
      const tab = this.add.graphics({ x: w / 2 - 34, y: -h / 2 + 4 });
      tab.fillStyle(0x16223f, 1).fillPoints(roundedPoly([[-26, -14], [32, -14], [26, 26], [-32, 26]], 9), true);
      tab.lineStyle(2, 0x2c3d66, 1).strokePoints(roundedPoly([[-26, -14], [32, -14], [26, 26], [-32, 26]], 9), true, true);
      tab.lineStyle(4, 0xb7c2de).beginPath().arc(0, 2, 7, Math.PI, 0).strokePath(); // arco del candado
      tab.fillStyle(0xb7c2de).fillRoundedRect(-11, 2, 22, 17, 4);
      tab.fillStyle(0x16223f).fillCircle(0, 9, 3).fillRect(-1.5, 9, 3, 6);
      c.add(tab);
    } else {
      // chevron ›
      const ch = this.add.graphics({ x: w / 2 - 30, y: 34 });
      ch.lineStyle(5, 0xffffff).beginPath().moveTo(-5, -9).lineTo(4, 0).lineTo(-5, 9).strokePath();
      c.add(ch);
    }

    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => {
      this.tweens.add({ targets: c, scale: { from: 0.94, to: 1 }, duration: 200, ease: 'Back.easeOut' });
      onClick();
    });
  }

  // ---------------------------------------------------------------- barra inferior
  private bottomBar(W: number, top: number, h: number) {
    // panel oscuro con borde superior cyan
    const bar = this.add.graphics();
    bar.fillStyle(0x030c22, 0.96).fillRect(0, top, W, h);
    bar.fillStyle(0x3a8bff, 0.9).fillRect(0, top, W, 3);
    const cy = top + h / 2 - 6;

    const tab = (label: string, x: number, icon: 'rank' | 'home' | 'event', active: boolean, onClick: () => void) => {
      // resalte de la pestaña activa
      if (active) {
        const hl = this.add.graphics();
        hl.fillStyle(0x1b5fc2, 0.5).fillRoundedRect(x - 58, top + 8, 116, h - 16, 16);
        hl.fillStyle(0x3a8bff, 1).fillRoundedRect(x - 30, top, 60, 4, 2); // indicador superior
      }
      const col = active ? 0xffffff : 0x7f93bf;
      const ig = this.add.graphics({ x, y: cy - 2 });
      ig.fillStyle(col);
      if (icon === 'home') ig.fillTriangle(-16, 4, 16, 4, 0, -16).fillRect(-11, 2, 22, 13);
      else if (icon === 'rank') {
        // podio
        ig.fillRect(-16, 0, 10, 12).fillRect(-5, -8, 10, 20).fillRect(6, -4, 10, 16);
      } else {
        // calendario
        ig.fillRoundedRect(-15, -12, 30, 26, 4);
        ig.fillStyle(0x030c22).fillRect(-11, -4, 22, 2);
        ig.fillStyle(col).fillRect(-11, -14, 4, 6).fillRect(7, -14, 4, 6);
      }
      this.add.text(x, cy + 30, label, { fontFamily: FONT, fontSize: '17px', color: active ? '#ffffff' : '#7f93bf' }).setOrigin(0.5);
      const hit = this.add.rectangle(x, top + h / 2, W / 3 - 6, h, 0x000000, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => {
        this.tweens.add({ targets: ig, scale: { from: 0.85, to: 1 }, duration: 180, ease: 'Back.easeOut' });
        onClick();
      });
    };

    tab('RANKING', W * 0.2, 'rank', false, () => this.openRanked());
    tab('INICIO', W * 0.5, 'home', true, () => undefined);
    tab('EVENTOS', W * 0.8, 'event', false, () => this.toast('Eventos: próximamente'));
  }

  // ---------------------------------------------------------------- aviso temporal
  private toast(msg: string) {
    const W = this.scale.width;
    const H = this.scale.height;
    const t = this.add.text(W / 2, H * 0.68, msg, textStyle(26, '#ffffff')).setOrigin(0.5).setDepth(9000).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, y: t.y - 20, duration: 200 });
    this.tweens.add({ targets: t, alpha: 0, delay: 1100, duration: 300, onComplete: () => t.destroy() });
  }
}
