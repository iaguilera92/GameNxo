import Phaser from 'phaser';
import { C, FONT, restartOnResize, textStyle } from '../ui/theme';
import { Character, playerLook } from '../objects/Character';
import { getProfile, levelProgress } from '../logic/Profile';
import { addPortrait } from '../characters/portrait';
import type { SkinId } from '../characters/skins';
import { roundedPoly } from '../ui/shapes';
import { RankBadge, preloadRankBadges } from '../ui/RankBadge';
import { showRankList } from '../ui/RankListDialog';
import { lockedModeButton, playButton } from '../ui/modeButtons';
import { fitText } from '../ui/fitText';import { playerRank, playerRankPosition } from '../domain/ranks';
import { getPlayer, onPlayerChange } from '../domain/playerStore';

/** ancho máximo del número en los contadores (entre el icono y el botón +) */
const COUNTER_TEXT_W = 62;


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
  key: 'nav-bar',
  file: 'assets/nav-bar.png',
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
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.png');
    if (!this.textures.exists('btn-jugar')) this.load.image('btn-jugar', 'assets/btn-jugar.png');
    if (!this.textures.exists(NAV.key)) this.load.image(NAV.key, NAV.file);
    preloadRankBadges(this.load, [playerRank(getProfile())]);
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
    const sideY = Math.min(H * 0.4, feetY - 300);
    this.sideButton(128, sideY, 'PERSONAJE', 'user', false, () => go('Customize'));
    this.sideButton(128, sideY + 166, 'TIENDA', 'shop', true, () => this.toast('Tienda: próximamente'));

    // --- JUGAR
    this.playRow(W, playY, () => go('Matchmaking'));

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
      const flash = this.add.rectangle(zx + zw / 2, (top + bottom) / 2, zw * 0.9, (bottom - top) * 0.8, 0x9fd0ff, 0)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setDepth(101);
      const hit = this.add.rectangle(zx + zw / 2, (top + bottom) / 2, zw, bottom - top + 16, 0x000000, 0.001).setDepth(102);
      hit.setInteractive({ useHandCursor: true }).on('pointerdown', () => {
        this.tweens.killTweensOf(flash);
        this.tweens.add({ targets: flash, fillAlpha: { from: 0.22, to: 0 }, duration: 260, ease: 'Quad.easeOut' });
        onClick();
      });
    };
    zone(0, NAV.split[0], () => this.toast('Ranking: próximamente'));
    zone(NAV.split[0], NAV.split[1], () => undefined); // INICIO (activa)
    zone(NAV.split[1], 1, () => this.toast('Eventos: próximamente'));
  }

  // ---------------------------------------------------------------- fila JUGAR + 2v2
  /**
   * Fila de modos: JUGAR (≈70 %, amarillo, principal) y 2v2 (≈30 %, gris, bloqueado).
   * Ambos comparten la misma forma inclinada del botón JUGAR original, dibujada por código.
   */
  private playRow(W: number, y: number, onPlay: () => void) {
    const margin = 26;
    const gap = 14;
    const h = 108;
    const avail = W - margin * 2 - gap;
    const jw = Math.round(avail * 0.7);
    const vw = avail - jw;
    playButton(this, margin + jw / 2, y, jw, h, onPlay);
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
    const countersLeft = gx - gs / 2 - 10 - 132;
    this.profileCard(24, y, Math.min(440, countersLeft - 24 - 14), p);
    this.coinCounter(gx - gs / 2 - 10, y + 4);
    this.counter(gx - gs / 2 - 10, y + 52, 'cash', '50'); // dinero: decorativo por ahora
    this.gearButton(gx, gy, gs, () => this.toast('Ajustes: próximamente'));
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
    const rank = playerRank(p);
    const position = playerRankPosition(p);
    card.add(
      new RankBadge(this, badgeX, ch / 2, {
        rank,
        level: p.level,
        size: badgeH,
        position,
        // tocar la insignia abre la lista de rangos (informativa si aún no es nivel 30)
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
    const w = 132;
    const h = 42;
    const c = this.add.container(right - w, y);
    const g = this.add.graphics();
    g.fillStyle(0x0a1838, 0.88).fillRoundedRect(0, 0, w, h, h / 2);
    g.lineStyle(2, 0x2f6fe0, 0.9).strokeRoundedRect(0, 0, w, h, h / 2);
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
    const txt = this.add.text(h - 2, h / 2, value, textStyle(20)).setOrigin(0, 0.5);
    fitText(txt, COUNTER_TEXT_W);
    c.add(txt);
    c.setData('text', txt);
    c.setData('icon', g);
    // botón +
    const plus = this.add.graphics();
    plus.fillStyle(0x3fae5a).fillCircle(w - 18, h / 2, 13);
    plus.lineStyle(3, 0xffffff).lineBetween(w - 24, h / 2, w - 12, h / 2).lineBetween(w - 18, h / 2 - 6, w - 18, h / 2 + 6);
    c.add(plus);
    return c;
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

    tab('RANKING', W * 0.2, 'rank', false, () => this.toast('Ranking: próximamente'));
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
