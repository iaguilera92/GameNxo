import Phaser from 'phaser';
import { FONT, textStyle } from './theme';
import type { ArcadePalette } from './modeButtons';
import { sfx } from '../fx/sfx';
import { RARITY_LABEL, type ItemRarity } from '../domain/shopCatalog';
import { RARITY_STYLE, drawRarityFrame } from './rarity';

/** Cuántos huecos muestra el diálogo: 2 filas × 5. */
export const POWER_SLOTS = 10;
const COLS = 5;

/** Crea un dibujo centrado en (x, y) con `size` px de diámetro (lo pone la escena: imagen del botón, bola, aro animado…). */
export type IconFactory = (x: number, y: number, size: number) => Phaser.GameObjects.GameObject;

/** Rectángulo en coordenadas de pantalla. */
export interface DemoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Demostración animada que se ve en la PÁGINA 2 de la televisión (se llega deslizando). La crea la escena (`PowerDialogOpts.demo`) y el diálogo la
 * enciende y apaga, le cambia el poder al elegir otro hueco y la destruye al cerrar.
 */
export interface PowerDemo {
  /** el poder (id del hueco) que debe mostrar */
  setPower(id: string | undefined): void;
  /** true = visible y en marcha; false = en pausa (la página no se ve) */
  setActive(on: boolean): void;
  destroy(): void;
}

/** Un hueco con contenido real (los demás, hasta 10, salen bloqueados y vacíos). */
export interface PowerSlot {
  /** id del poder: la demostración lo usa para saber cuál mostrar */
  id?: string;
  /** nombre real del poder para el rótulo de la demostración (si `name` es "POR DEFECTO") */
  demoName?: string;
  name: string;
  desc: string;
  /** lo tiene el jugador (si no, sale bloqueado y se compra en la Tienda) */
  owned: boolean;
  /** está en uso ahora */
  equipped: boolean;
  /** dibujo grande de la televisión */
  preview: IconFactory;
  /** dibujo pequeño del hueco; sin él se usa `preview` */
  thumb?: IconFactory;
  /**
   * (21-11-2026) bloqueado PERO visible: aunque no lo tenga, su dibujo se ve (apagado) con un candado chico en la esquina, en el hueco y en la televisión
   * (CAMBIAR PERSONAJE: JUN y NET). Sin esto, un hueco bloqueado solo muestra un candado.
   */
  showLocked?: boolean;
  /** rareza del poder: su marco en el hueco (ausente = sin marco: gratis o sin clasificar) */
  rarity?: ItemRarity;
  /** rótulo de la columna RAREZA de la televisión grande cuando el poder no tiene rareza (por defecto, INCLUIDO), p. ej. 'DEL PASE' */
  badge?: string;
  /** equipar este hueco (solo si lo tiene); el diálogo marca el cambio y llama a `onClose({ changed })` al cerrar */
  onEquip?: () => void;
}

export interface PowerDialogOpts {
  /** título, p. ej. "PODERES · SMASH" */
  title: string;
  /** color del borde y de los acentos */
  color: number;
  slots: PowerSlot[];
  /** "side" = dibujo a la izquierda y texto a la derecha (dibujos anchos, como los aros de carga) */
  layout?: 'center' | 'side';
  /** abre la Tienda (botón de los huecos bloqueados que sí existen) */
  onShop?: () => void;
  /** texto del botón y de la nota de los bloqueados (por defecto, la Tienda; p. ej. 'IR AL PASE' / 'Se gana en el PASE DE BATALLA.') */
  shopLabel?: string;
  lockedNote?: string;
  /** al cerrar: `changed` = se equipó algo distinto (la escena puede refrescarse) */
  onClose?: (r: { changed: boolean }) => void;
  /**
   * true = la televisión muestra SOLO el dibujo, grande y centrado, sin nombre ni descripción (p. ej. el color del
   * personaje: se ve cómo queda). `preview` recibe entonces como `size` el alto disponible en la pantalla.
   */
  previewOnly?: boolean;
  /**
   * Diseño especial (la ULTI): rayos de luz que giran detrás del dibujo en la pantalla y destellos que titilan en el
   * marco del diálogo, del color `color`.
   */
  special?: boolean;
  /**
   * true = la televisión ocupa más pantalla y va SIN marco (carcasa, botones y rejilla): solo la pantalla. Con `demo`, además, se puede
   * deslizar hacia un lado para ver la demostración.
   */
  bigTv?: boolean;
  /** (21-11-2026) con `bigTv`: multiplica el tamaño del dibujo de la columna izquierda (1 = el de siempre; CAMBIAR PERSONAJE usa más para ver bien al personaje) */
  iconScale?: number;
  /** (21-11-2026) con `bigTv`: cuánto "palpita" el dibujo de la televisión (1 = como siempre, 0,3 = leve, 0 = quieto; CAMBIAR PERSONAJE y ESTILOS) */
  pulse?: number;
  /** página 2 de la televisión: una demostración en acción (se llega deslizando; ver PowerDemo) */
  demo?: { create: (parent: Phaser.GameObjects.Container, outer: DemoRect, inner: DemoRect, id: string | undefined) => PowerDemo };
}

const NAVY = 0x0b1733;
/** El borde del diálogo mide 3 px centrados en su orilla: la mitad interior (1,5 px) más un pelo de aire. La televisión grande llega hasta ahí para no adelgazarlo. */
const BORDER_IN = 3;
/** verde del poder equipado (borde y sello ✓ del hueco) */
const EQUIP_GREEN = 0x24c25a;

/**
 * Congela lo que ya hay en la escena (lo que queda DETRÁS del diálogo): se esconde (el velo casi negro apenas lo dejaba ver y así no se
 * dibuja), se pausan sus tweens, las animaciones de sus sprites y sus emisores de partículas. Lo que crea el diálogo después (su televisión,
 * la demostración "En acción") no se toca. Devuelve la función que lo deja todo como estaba (se llama al destruir el diálogo).
 */
function freezeBehind(scene: Phaser.Scene): () => void {
  const hidden: Phaser.GameObjects.GameObject[] = [];
  const sprites: Phaser.GameObjects.Sprite[] = [];
  const emitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  const all = new Set<unknown>();
  const walk = (o: Phaser.GameObjects.GameObject) => {
    all.add(o);
    if (o instanceof Phaser.GameObjects.Sprite && o.anims?.isPlaying) {
      o.anims.pause();
      sprites.push(o);
    } else if (o instanceof Phaser.GameObjects.Particles.ParticleEmitter && o.active) {
      o.pause();
      emitters.push(o);
    }
    (o as Phaser.GameObjects.Container).list?.forEach(walk);
  };
  for (const o of [...scene.children.list]) {
    walk(o);
    const v = o as unknown as Phaser.GameObjects.Components.Visible;
    if (typeof v.setVisible === 'function' && v.visible) {
      v.setVisible(false);
      hidden.push(o);
    }
  }
  const tweens = scene.tweens.getTweens().filter((t) => !t.isPaused() && (t.targets.some((x) => all.has(x)) || t.targets.every((x) => !(x instanceof Phaser.GameObjects.GameObject))));
  tweens.forEach((t) => t.pause());
  let done = false;
  return () => {
    if (done || !scene.sys.isActive()) return;
    done = true;
    for (const o of hidden) if (o.active) (o as unknown as Phaser.GameObjects.Components.Visible).setVisible(true);
    for (const s of sprites) if (s.active) s.anims.resume();
    for (const e of emitters) if (e.active) e.resume();
    for (const t of tweens) if (!t.isDestroyed()) t.resume();
  };
}

/** Candado dibujado (cuerpo + argolla) centrado en (0, 0) con `s` de alto aproximado. */
function drawLock(g: Phaser.GameObjects.Graphics, s: number, color: number) {
  const bw = s * 0.62;
  const bh = s * 0.46;
  g.lineStyle(Math.max(3, s * 0.1), color, 1).beginPath().arc(0, -s * 0.08, bw * 0.3, Math.PI, 0).strokePath();
  g.lineBetween(-bw * 0.3, -s * 0.08, -bw * 0.3, s * 0.02).lineBetween(bw * 0.3, -s * 0.08, bw * 0.3, s * 0.02);
  g.fillStyle(color, 1).fillRoundedRect(-bw / 2, s * 0.02, bw, bh, 6);
  g.fillStyle(NAVY, 1).fillCircle(0, s * 0.02 + bh * 0.4, s * 0.06).fillRect(-s * 0.025, s * 0.02 + bh * 0.4, s * 0.05, bh * 0.3);
}

/**
 * Diálogo de PODERES (SMASH, DASH) o de EFECTOS (cargando golpe): una televisión arriba que muestra el hueco seleccionado y
 * debajo 2 filas de 5. Los huecos con contenido se pueden ver y equipar si son tuyos; los que no, salen con candado y
 * estática (llevan a la Tienda); el resto, vacíos y bloqueados.
 * Tocar un hueco lo muestra en la televisión. Se cierra con la X, tocando fuera o al EQUIPAR (al instante: se equipa y se cierra).
 */
export function openPowerDialog(scene: Phaser.Scene, opts: PowerDialogOpts) {
  const { title: titleText, color, slots, layout = 'center', onShop, onClose, shopLabel = 'IR A LA TIENDA', lockedNote = 'Se compra en la TIENDA.', previewOnly = false, special = false, bigTv = false, demo, iconScale = 1, pulse: pulseK = 1 } = opts;
  const W = scene.scale.width;
  const H = scene.scale.height;
  // (17-11-2026, usuario) lo de detrás se CONGELA mientras el diálogo está abierto: así la pantalla "En acción" va fluida
  const unfreeze = freezeBehind(scene);
  const root = scene.add.container(0, 0).setDepth(8000);
  root.once(Phaser.GameObjects.Events.DESTROY, unfreeze);
  const timers: Phaser.Time.TimerEvent[] = [];
  let changed = false;
  let closed = false;

  // fondo oscuro que bloquea lo de detrás; tocar fuera del panel cierra
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x02060f, 0.82).setInteractive();
  root.add(dim);

  const pw = W - 60;
  const px = 30;
  let tvH = 330;
  const slot = Math.floor((pw - 40 - (COLS - 1) * 10) / COLS);
  // 2 filas de 5 como mínimo; con más poderes se añaden filas (EFECTO PELOTA tiene 13)… salvo con la televisión grande (DEFENSIVO): ahí se
  // pagina de a 10 (2 filas × 5) y se desliza hacia un lado para ver los demás
  const paged = bigTv && slots.length > POWER_SLOTS;
  const GPAGES = paged ? Math.ceil(slots.length / POWER_SLOTS) : 1;
  const ROWS = paged ? 2 : Math.max(2, Math.ceil(slots.length / COLS));
  const TOTAL = paged ? GPAGES * POWER_SLOTS : ROWS * COLS;
  const gridH = slot * ROWS + 12 * (ROWS - 1);
  /** franja de los puntos de página bajo la lista (solo si hay varias páginas) */
  const DOTS_H = paged ? 24 : 0;
  /** franja bajo la televisión para el botón de acción (EQUIPAR / EQUIPADO / IR A LA TIENDA) */
  const ACT_H = 124;
  // televisión grande: usa el alto que sobra (sin pasarse de la pantalla)
  if (bigTv) tvH = Phaser.Math.Clamp(H - (70 + ACT_H + gridH + 26 + DOTS_H) - 80, 380, 600);
  const ph = 70 + tvH + ACT_H + gridH + 26 + DOTS_H;
  const py = Math.round((H - ph) / 2);

  const panel = scene.add.container(0, 0);
  root.add(panel);
  const block = scene.add.zone(px + pw / 2, py + ph / 2, pw, ph).setInteractive(); // el panel no cierra al tocarlo
  panel.add(block);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.45).fillRoundedRect(px + 4, py + 8, pw, ph, 24);
  bg.fillStyle(0x0b1a3d, 1).fillRoundedRect(px, py, pw, ph, 24);
  // reflejo de la cabecera hasta el borde de la pantalla (usuario 16-11-2026: antes acababa en 50 y dejaba una franja oscura encima)
  bg.fillStyle(0xffffff, 0.06).fillRoundedRect(px + 3, py + 3, pw - 6, 67, { tl: 21, tr: 21, bl: 0, br: 0 });
  bg.lineStyle(3, color, 1).strokeRoundedRect(px, py, pw, ph, 24);
  panel.add(bg);

  // ---------------------------------------------------------------- cabecera
  const title = scene.add.text(px + pw / 2, py + 36, titleText, { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
  if (title.width > pw - 120) title.setScale((pw - 120) / title.width);
  panel.add(title);

  let pulse: Phaser.Tweens.Tween | null = null;
  /** rayos girando detrás del dibujo (diseño especial) y destellos del marco */
  let raysSpin: Phaser.Tweens.Tween | null = null;
  const sparkTweens: Phaser.Tweens.Tween[] = [];
  /** brillo que recorre el borde (diseño especial) */
  let shine: Phaser.GameObjects.Graphics | null = null;
  const close = () => {
    if (closed) return;
    closed = true;
    for (const t of timers) t.remove(false);
    pulse?.remove();
    pulse = null;
    raysSpin?.remove();
    raysSpin = null;
    for (const t of sparkTweens) t.remove();
    actionPulse?.remove();
    actionPulse = null;
    demoCleanup();
    gridCleanup();
    scene.tweens.killTweensOf(xg);
    dim.disableInteractive();
    scene.tweens.add({ targets: root, alpha: 0, duration: 120, onComplete: () => root.destroy() });
    onClose?.({ changed });
  };
  dim.on('pointerup', close);
  const cx0 = px + pw - 38;
  const cy0 = py + 36;
  // la X sola (sin círculo), centrada en su propio origen para poder girarla; al abrirse da 3 vueltas y frena
  const xg = scene.add.graphics({ x: cx0, y: cy0 });
  xg.lineStyle(9, 0x06112b, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  xg.lineStyle(5, 0xffffff, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  scene.tweens.add({ targets: xg, angle: 1080, delay: 180, duration: 1100, ease: 'Cubic.easeOut' });
  const xHit = scene.add.zone(cx0, cy0, 56, 56).setInteractive({ useHandCursor: true });
  xHit.on('pointerup', close);
  panel.add([xg, xHit]);

  // ---------------------------------------------------------------- televisión
  const tvX = px + (bigTv ? BORDER_IN : 20); // televisión grande: de borde a borde del diálogo, justo hasta el borde (sin taparlo)
  const tvY = py + 70;
  const tvW = pw - (bigTv ? BORDER_IN * 2 : 40);
  const tv = scene.add.graphics();
  // pantalla; la carcasa solo se dibuja en la televisión de siempre (con `bigTv` la pantalla ocupa todo, sin borde)
  const sx = bigTv ? tvX : tvX + 16;
  const sy = bigTv ? tvY : tvY + 16;
  const sw = bigTv ? tvW : tvW - 32;
  const sh = bigTv ? tvH : tvH - 56;
  const sr = bigTv ? 0 : 16;
  if (!bigTv) {
    // (sin antenas: bajo el título se leían como una flecha "v" cortada)
    tv.fillStyle(0x1b2a52, 1).fillRoundedRect(tvX, tvY, tvW, tvH, 26);
    tv.lineStyle(3, 0x3a4f86, 1).strokeRoundedRect(tvX, tvY, tvW, tvH, 26);
  }
  tv.fillStyle(0x040a1a, 1).fillRoundedRect(sx, sy, sw, sh, sr);
  if (!bigTv) {
    tv.lineStyle(3, 0x0a1230, 1).strokeRoundedRect(sx, sy, sw, sh, sr);
    // botoncitos y rejilla del frente
    tv.fillStyle(color, 1).fillCircle(tvX + 34, tvY + tvH - 20, 7);
    tv.fillStyle(0x5a6f9e, 1).fillCircle(tvX + 60, tvY + tvH - 20, 6);
    for (let i = 0; i < 5; i++) tv.fillStyle(0x0a1230, 1).fillRoundedRect(tvX + tvW - 120 + i * 18, tvY + tvH - 30, 8, 20, 3);
  }
  panel.add(tv);

  // contenido de la pantalla (se rehace al elegir un hueco) y máscara para que nada se salga
  const screen = scene.add.container(0, 0);
  panel.add(screen);
  const maskG = scene.make.graphics({}, false);
  maskG.fillRoundedRect(sx, sy, sw, sh, sr);
  const tvMask = maskG.createGeometryMask();
  screen.setMask(tvMask);
  root.once(Phaser.GameObjects.Events.DESTROY, () => maskG.destroy());
  // líneas de barrido sobre la pantalla (encima del contenido, sin máscara: caben dentro de la pantalla)
  const scan = scene.add.graphics();
  scan.fillStyle(0xffffff, 0.035);
  for (let y = sy + 2; y < sy + sh - 2; y += 4) scan.fillRect(sx + 4, y, sw - 8, 1.5);
  panel.add(scan);

  // ---------------------------------------------------------------- página 2: demostración en acción (se llega deslizando)
  // La televisión tiene dos páginas: 0 = el poder (icono, nombre, descripción) y 1 = la demostración (`demo`). Se pasa de una a otra
  // arrastrando de lado (sigue el dedo), tocando la pista de abajo o los puntos. La transición: la página que sale se aleja y se apaga, la que
  // entra llega desde más cerca, un barrido de luz cruza la pantalla y aparecen las barras de cine con el rótulo; al llegar arranca la demostración.
  let gridCleanup: () => void = () => undefined;
  let syncDemo: (i: number) => void = () => undefined;
  let demoCleanup: () => void = () => undefined;
  if (demo) {
    const BAR_H = 42;
    const mid = { x: sx + sw / 2, y: sy + sh / 2 };
    let page: 0 | 1 = 0;
    let curOff = 0; // desplazamiento de la página 0: 0 = poder, -sw = demostración
    let demoCtl: PowerDemo | null = null;
    let offTween: Phaser.Tweens.Tween | null = null;
    let barsTween: Phaser.Tweens.Tween | null = null;
    const barState = { h: 0 };
    const demoRoot = scene.add.container(0, 0).setVisible(false);
    demoRoot.setMask(tvMask);
    panel.add(demoRoot);
    panel.bringToTop(scan);
    // barras de cine con el rótulo (encima de la demostración, dentro de la pantalla)
    const cine = scene.add.container(0, 0);
    cine.setMask(tvMask);
    const barG = scene.add.graphics();
    const capDot = scene.add.circle(sx + 24, sy + 24, 5, 0xff4f5e, 1);
    const cap = scene.add.text(sx + 38, sy + 24, '', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#061431', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(2);
    cine.add([barG, capDot, cap]);
    panel.add(cine);
    // barrido de luz que cruza la pantalla al cambiar de página
    const fxLayer = scene.add.container(0, 0);
    fxLayer.setMask(tvMask);
    const sweep = scene.add.rectangle(0, 0, 150, sh * 1.8, 0xffffff, 0.3).setAngle(16).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    fxLayer.add(sweep);
    panel.add(fxLayer);

    const drawBars = () => {
      const h = barState.h;
      barG.clear();
      const on = h > 0.5;
      capDot.setVisible(on);
      cap.setVisible(on);
      if (!on) return;
      // (sin barras ni líneas de borde arriba y abajo: la demostración ocupa toda la pantalla; solo se anima el rótulo)
      cap.setAlpha(h / BAR_H);
      capDot.setAlpha(h / BAR_H);
    };
    drawBars(); // con las barras a 0 el rótulo ("EN ACCIÓN · …") queda oculto: solo se ve en la página de la demostración
    const setBars = (to: number, delay = 0) => {
      barsTween?.remove();
      barsTween = scene.tweens.add({ targets: barState, h: to, delay, duration: 340, ease: 'Cubic.easeOut', onUpdate: drawBars });
    };

    // pistas: puntos de página y rótulos de abajo (por encima de las barras)
    const hintLayer = scene.add.container(0, 0);
    const dots = scene.add.graphics();
    const hintR = scene.add.text(sx + sw - 20, sy + sh - BAR_H / 2 - (bigTv ? 0 : 0), 'EN ACCIÓN  ›', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#061431', strokeThickness: 4 }).setOrigin(1, 0.5).setLetterSpacing(1);
    const hintL = scene.add.text(sx + 20, sy + sh - BAR_H / 2, '‹  INFORMACIÓN', { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#061431', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(1).setAlpha(0);
    hintL.setVisible(false); // (usuario 16-11-2026) en EN ACCIÓN no se muestra "‹ INFORMACIÓN"
    hintLayer.add([dots, hintR, hintL]);
    panel.add(hintLayer);
    scene.tweens.add({ targets: hintR, x: hintR.x - 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const drawDots = () => {
      dots.clear();
      for (let k = 0; k < 2; k++) {
        const on = k === page;
        dots.fillStyle(on ? 0xffffff : 0x6f86bd, on ? 1 : 0.7).fillCircle(mid.x - 10 + k * 20, sy + sh - BAR_H / 2, on ? 5 : 4);
      }
    };
    drawDots();

    const setOffset = (o: number) => {
      curOff = o;
      const u = Phaser.Math.Clamp(-o / sw, 0, 1);
      const s1 = 1 - 0.07 * u; // la página que sale se aleja un poco…
      const s2 = 1.1 - 0.1 * u; // …y la que entra llega desde más cerca
      screen.setScale(s1).setPosition(o + (1 - s1) * mid.x, (1 - s1) * mid.y).setAlpha(1 - 0.55 * u);
      demoRoot.setVisible(u > 0.001).setScale(s2).setPosition(o + sw + (1 - s2) * mid.x, (1 - s2) * mid.y).setAlpha(0.3 + 0.7 * u);
      sweep.setPosition(sx + (u * 1.5 - 0.25) * sw, mid.y).setAlpha(Math.sin(Math.PI * u) * 0.9);
      hintR.setAlpha(1 - u);
      hintL.setAlpha(u);
    };

    const go = (p: 0 | 1) => {
      if (closed) return;
      if (p === 1 && !slots[selected]) return; // sin poder elegido no hay qué mostrar
      page = p;
      drawDots();
      offTween?.remove();
      if (p === 1 && !demoCtl) {
        demoCtl = demo.create(demoRoot, { x: sx, y: sy, w: sw, h: sh }, { x: sx, y: sy + 30, w: sw, h: sh - 30 - 40 }, slots[selected]?.id);
        cap.setText(`EN ACCIÓN · ${(slots[selected]?.demoName ?? slots[selected]?.name ?? '').toUpperCase()}`);
      }
      if (p === 0) {
        demoCtl?.setActive(false); // al empezar a volver, la demostración se pausa
        setBars(0);
      } else setBars(BAR_H, 300);
      const st = { v: curOff };
      sfx(scene, 'equipar', 0.25);
      offTween = scene.tweens.add({
        targets: st,
        v: p === 1 ? -sw : 0,
        duration: 560,
        ease: 'Cubic.easeInOut',
        onUpdate: () => setOffset(st.v),
        onComplete: () => {
          if (page === 1) demoCtl?.setActive(true);
        },
      });
    };

    // arrastrar de lado sobre la pantalla: la página sigue el dedo y al soltar se decide (por distancia o por velocidad)
    const swipe = scene.add.zone(sx + sw / 2, sy + sh / 2, sw, sh).setInteractive();
    panel.add(swipe);
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startOff = 0;
    let startAt = 0;
    swipe.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (!slots[selected]) return;
      dragging = true;
      moved = false;
      startX = ptr.x;
      startOff = curOff;
      startAt = scene.time.now;
      offTween?.remove();
    });
    const onMove = (ptr: Phaser.Input.Pointer) => {
      if (!dragging) return;
      const dx = ptr.x - startX;
      if (Math.abs(dx) > 8) moved = true;
      if (!moved) return;
      if (!demoCtl && curOff === 0) {
        demoCtl = demo.create(demoRoot, { x: sx, y: sy, w: sw, h: sh }, { x: sx, y: sy + 30, w: sw, h: sh - 30 - 40 }, slots[selected]?.id);
        cap.setText(`EN ACCIÓN · ${(slots[selected]?.demoName ?? slots[selected]?.name ?? '').toUpperCase()}`);
      }
      setOffset(Phaser.Math.Clamp(startOff + dx, -sw, 0));
    };
    const onUp = (ptr: Phaser.Input.Pointer) => {
      if (!dragging) return;
      dragging = false;
      if (!moved) return;
      const dx = ptr.x - startX;
      const vel = dx / Math.max(1, scene.time.now - startAt); // px/ms
      if (page === 0) go(dx < -sw * 0.2 || vel < -0.45 ? 1 : 0);
      else go(dx > sw * 0.2 || vel > 0.45 ? 0 : 1);
    };
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    // pistas tocables
    const zR = scene.add.zone(sx + sw - 90, sy + sh - BAR_H / 2, 180, BAR_H).setInteractive({ useHandCursor: true });
    zR.on('pointerup', () => {
      if (!moved && page === 0) go(1);
    });
    const zL = scene.add.zone(sx + 90, sy + sh - BAR_H / 2, 180, BAR_H).setInteractive({ useHandCursor: true });
    zL.on('pointerup', () => {
      if (!moved && page === 1) go(0);
    });
    panel.add([zR, zL]);

    syncDemo = (i: number) => {
      const sl = slots[i];
      if (!sl) {
        if (page === 1) go(0);
        return;
      }
      cap.setText(`EN ACCIÓN · ${(sl.demoName ?? sl.name).toUpperCase()}`);
      demoCtl?.setPower(sl.id);
    };
    demoCleanup = () => {
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      offTween?.remove();
      barsTween?.remove();
      demoCtl?.setActive(false);
      const ctl = demoCtl;
      scene.time.delayedCall(160, () => ctl?.destroy());
    };
    setOffset(0);
  }

  let noiseTimer: Phaser.Time.TimerEvent | null = null;
  const stopNoise = () => {
    noiseTimer?.remove(false);
    noiseTimer = null;
  };
  /** estática de televisión dentro de la pantalla */
  const noise = () => {
    const g = scene.add.graphics();
    screen.add(g);
    const draw = () => {
      g.clear();
      for (let n = 0; n < 150; n++) {
        g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.03, 0.22)).fillRect(sx + Math.random() * sw, sy + Math.random() * sh, Phaser.Math.Between(6, 26), Phaser.Math.Between(2, 4));
      }
    };
    draw();
    noiseTimer = scene.time.addEvent({ delay: 90, loop: true, callback: draw });
    timers.push(noiseTimer);
  };
  // botón de acción: GRANDE y centrado justo debajo de la televisión (antes, una etiqueta pequeña dentro de la pantalla)
  const action = scene.add.container(px + pw / 2, tvY + tvH + ACT_H / 2);
  panel.add(action);
  let actionPulse: Phaser.Tweens.Tween | null = null;
  /**
   * Botón de acción: UN solo estilo para todos los estados (rectángulo liso, mismo tamaño y letra, sin la forma inclinada del botón arcade).
   *   EQUIPAR          amarillo vivo y quieto (sin latido), con respuesta al pulsar: se nota que se puede tocar
   *   EQUIPADO         verde plano con ✓, quieto: ya está puesto (sin interacción)
   *   IR A LA TIENDA   azul, también tocable (misma respuesta)
   *   BLOQUEADO        gris, quieto
   * `onTap` = tocable; sin él es un estado.
   */
  const FLAT: Record<string, { fill: number; band: number; bandA: number; stroke: string; text: string }> = {
    yellow: { fill: 0xf2a900, band: 0xffe27a, bandA: 0.5, stroke: '#7a4a00', text: '#ffffff' },
    green: { fill: 0x1f9a45, band: 0xffffff, bandA: 0.12, stroke: '#0d4a22', text: '#ffffff' },
    blue: { fill: 0x2f6fe0, band: 0xffffff, bandA: 0.18, stroke: '#0a2a6b', text: '#ffffff' },
    grey: { fill: 0x44506b, band: 0xffffff, bandA: 0.08, stroke: '#1b2338', text: '#c4cfe8' },
  };
  const tag = (label: string, palette: ArcadePalette, onTap?: () => void, check = false) => {
    actionPulse?.remove();
    actionPulse = null;
    for (const o of action.list) scene.tweens.killTweensOf(o); // el latido del botón anterior
    action.removeAll(true).setScale(1);
    const bw = Math.min(380, pw - 110);
    const bh = 80;
    const f = FLAT[palette as string] ?? FLAT.blue;

    const rg = scene.add.graphics();
    rg.fillStyle(f.fill, 1).fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    rg.fillStyle(f.band, f.bandA).fillRoundedRect(-bw / 2, -bh / 2, bw, bh * 0.45, { tl: 8, tr: 8, bl: 0, br: 0 });
    const lab = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: '34px', color: f.text, stroke: f.stroke, strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(2);
    if (lab.width > bw - 40) lab.setScale((bw - 40) / lab.width);
    action.add([rg, lab]);
    if (check) {
      // ✓ delante del texto; el conjunto ✓ + texto queda centrado en el botón
      const ckW = 30;
      const gap = 14;
      const total = ckW + gap + lab.displayWidth;
      lab.x = -total / 2 + ckW + gap + lab.displayWidth / 2;
      const ck = scene.add.graphics({ x: -total / 2 + ckW / 2, y: 0 });
      ck.lineStyle(10, 0x0d4a22, 1).beginPath().moveTo(-13, 0).lineTo(-4, 10).lineTo(14, -11).strokePath();
      ck.lineStyle(6, 0xffffff, 1).beginPath().moveTo(-13, 0).lineTo(-4, 10).lineTo(14, -11).strokePath();
      action.add(ck);
    }
    if (onTap) {
      const hit = scene.add.zone(0, 0, bw, bh).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => scene.tweens.add({ targets: action, scale: 0.95, duration: 70, ease: 'Quad.easeOut' }));
      hit.on('pointerout', () => scene.tweens.add({ targets: action, scale: 1, duration: 120, ease: 'Quad.easeOut' }));
      hit.on('pointerup', () => {
        scene.tweens.add({ targets: action, scale: 1, duration: 120, ease: 'Back.easeOut' });
        onTap();
      });
      action.add(hit);
    }
  };  const clearAction = () => {
    actionPulse?.remove();
    actionPulse = null;
    for (const o of action.list) scene.tweens.killTweensOf(o);
    action.removeAll(true);
  };

  let selected = Math.max(0, slots.findIndex((s) => s.equipped));
  const rings: Phaser.GameObjects.Graphics[] = [];
  /** dibujo y rótulo de cada hueco (para apagar los no seleccionados) */
  const cellItems: Phaser.GameObjects.GameObject[][] = [];
  // con páginas, el hueco i ocupa el lugar (i % 10) de su página y cada página está a un ancho de diálogo de la anterior
  const cellX = (i: number) => px + 20 + (paged ? Math.floor(i / POWER_SLOTS) * pw : 0) + ((paged ? i % POWER_SLOTS : i) % COLS) * (slot + 10) + slot / 2;
  const cellY = (i: number) => py + 70 + tvH + ACT_H + Math.floor((paged ? i % POWER_SLOTS : i) / COLS) * (slot + 12) + slot / 2;
  const paint = () =>
    rings.forEach((g, i) => {
      const on = i === selected;
      const s = slots[i];
      const cx = cellX(i);
      const cy = cellY(i);
      g.clear();
      if (on) g.fillStyle(color, 0.18).fillRoundedRect(cx - slot / 2 - 4, cy - slot / 2 - 4, slot + 8, slot + 8, 20);
      g.fillStyle(s?.owned ? 0x10224d : 0x08122b, 1).fillRoundedRect(cx - slot / 2, cy - slot / 2, slot, slot, 16);
      if (s?.rarity) {
        // el marco de su rareza; lo equipado se marca con un aro exterior del color del diálogo
        drawRarityFrame(g, cx - slot / 2, cy - slot / 2, slot, slot, 16, s.rarity, false, true);
        if (s.equipped) g.lineStyle(4, EQUIP_GREEN, 1).strokeRoundedRect(cx - slot / 2 - 5, cy - slot / 2 - 5, slot + 10, slot + 10, 20);
      } else g.lineStyle(on || s?.equipped ? 4 : 2, s?.equipped ? EQUIP_GREEN : on ? 0x6f86bd : 0x24365f, 1).strokeRoundedRect(cx - slot / 2, cy - slot / 2, slot, slot, 16);
      // equipado: fondo con un toque verde y borde verde (con rareza, el aro verde de fuera)
      if (s?.equipped) g.fillStyle(EQUIP_GREEN, 0.14).fillRoundedRect(cx - slot / 2, cy - slot / 2, slot, slot, 16);
      // los que no se ven ni están equipados, oscurecidos (deshabilitados a la vista)
      if (!on && !s?.equipped && s) g.fillStyle(0x040a1a, 0.5).fillRoundedRect(cx - slot / 2, cy - slot / 2, slot, slot, 16);
      // (17-11-2026) el que se está VIENDO: aro blanco con brillo del color del diálogo y fondo más claro (los demás se apagan un poco)
      if (on) {
        g.fillStyle(0xffffff, 0.1).fillRoundedRect(cx - slot / 2, cy - slot / 2, slot, slot, 16);
        g.lineStyle(10, color, 0.4).strokeRoundedRect(cx - slot / 2 - 4, cy - slot / 2 - 4, slot + 8, slot + 8, 20);
        g.lineStyle(4, 0xffffff, 1).strokeRoundedRect(cx - slot / 2 - 4, cy - slot / 2 - 4, slot + 8, slot + 8, 20);
      }
      // el que está EQUIPADO: sello verde con ✓ en la esquina (además de su aro de color)
      if (s?.equipped) {
        const bx = cx + slot / 2 - 4;
        const by = cy - slot / 2 + 4;
        g.fillStyle(0x06112b, 1).fillCircle(bx, by, 16);
        g.fillStyle(EQUIP_GREEN, 1).fillCircle(bx, by, 13);
        g.lineStyle(4, 0xffffff, 1).beginPath().moveTo(bx - 6, by).lineTo(bx - 2, by + 4.5).lineTo(bx + 6.5, by - 5).strokePath();
      }
      // apaga lo que no está seleccionado (el equipado, algo menos) para que se note cuál es
      const dimA = on ? 1 : s?.equipped ? 0.7 : 0.3;
      for (const o of cellItems[i] ?? []) (o as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(dimA);
      // bloqueado pero visible: su dibujo siempre algo más apagado que el de un personaje que sí tienes
      if (s?.showLocked && !s.owned) (cellItems[i]?.[0] as unknown as Phaser.GameObjects.Components.Alpha | undefined)?.setAlpha?.(Math.max(0.35, dimA * 0.6));
    });

  const show = (i: number) => {
    stopNoise();
    pulse?.remove(); // antes de destruir sus objetos
    pulse = null;
    raysSpin?.remove();
    raysSpin = null;
    screen.removeAll(true);
    clearAction();
    const s = slots[i];
    syncDemo(i);
    const side = layout === 'side';
    // dibujo: centrado arriba, o a la izquierda con el texto a la derecha
    const ix = side ? sx + sw * 0.27 : sx + sw / 2;
    // solo el dibujo: centrado en la pantalla y con casi todo su alto
    const iy = previewOnly ? sy + sh / 2 : side ? sy + sh * 0.72 : bigTv ? sy + sh * 0.34 : sy + 100;
    const big = previewOnly ? sh - 36 : side ? 176 : bigTv ? Math.min(230, sh * 0.44) : 120;
    const glowR = previewOnly ? sh * 0.46 : bigTv ? big : 120;
    const tx = side ? sx + sw * 0.54 : sx + sw / 2;
    const ty = side ? sy + sh * 0.3 : bigTv ? sy + sh * 0.68 : sy + 182;
    const tw = side ? sw * 0.42 : sw - 40;
    const origin = side ? 0 : 0.5;
    const align = side ? 'left' : 'center';
    if (bigTv && s) {
      // TELEVISIÓN GRANDE (DEFENSIVO…): DOS COLUMNAS que explican, sin tarjeta ni fondo. Izquierda: icono y nombre. Derecha: rareza y para qué sirve.
      const midY = sy + (sh - 46) / 2; // el contenido va centrado en el alto libre (abajo quedan la pista y los puntos de página)
      const half = sw / 2;
      const rs = s.rarity ? RARITY_STYLE[s.rarity] : null;
      const accent = rs ? rs.main : color;
      // --- columna izquierda: icono y nombre
      const icx = sx + half / 2;
      const isize = Math.min(half * 0.5 * iconScale, sh * 0.3 * iconScale, 160 * iconScale);
      const icy = midY - 26;
      const glowA = scene.add.graphics({ x: icx, y: icy });
      glowA.fillStyle(accent, 0.12).fillCircle(0, 0, isize * 0.95).fillStyle(accent, 0.16).fillCircle(0, 0, isize * 0.66);
      screen.add(glowA);
      const icon = s.preview(icx, icy, isize);
      screen.add(icon);
      if (s.owned) {
        const base = (o: unknown) => (o as { scaleX?: number }).scaleX ?? 1;
        pulse = scene.tweens.add({
          targets: [icon, glowA],
          scale: { getStart: (o: unknown) => base(o) * (1 - 0.05 * pulseK), getEnd: (o: unknown) => base(o) * (1 + 0.04 * pulseK) },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      } else if (s.showLocked) {
        // bloqueado pero visible: el dibujo algo apagado y un candado en su esquina inferior derecha
        (icon as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(0.6);
        const lk = scene.add.graphics({ x: icx + isize * 0.42, y: icy + isize * 0.34 });
        drawLock(lk, isize * 0.42, 0xaebfe6);
        screen.add(lk);
      } else {
        (icon as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(0.3);
        const lk = scene.add.graphics({ x: icx, y: icy });
        drawLock(lk, isize * 0.8, 0xaebfe6);
        screen.add(lk);
      }
      const showSub = !!s.demoName && s.demoName.toUpperCase() !== s.name.toUpperCase();
      const nm = scene.add.text(icx, icy + isize / 2 + 34, s.name.toUpperCase(), { ...textStyle(30), color: s.owned ? '#ffffff' : '#aebfe6' }).setOrigin(0.5);
      if (nm.width > half - 36) nm.setScale((half - 36) / nm.width);
      screen.add(nm);
      if (showSub) screen.add(scene.add.text(icx, nm.y + 26, (s.demoName ?? '').toUpperCase(), { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(3));
      // --- columna derecha: rareza y para qué sirve
      const bx = sx + half + 26;
      const bw2 = half - 46;
      const top = Math.max(sy + 18, midY - 118);
      // (17-11-2026) sin el rótulo «RAREZA»: solo la etiqueta con la rareza (p. ej. ESPECIAL)
      const label = s.rarity ? RARITY_LABEL[s.rarity] : (s.badge ?? 'INCLUIDO');
      const lcol = rs ? '#' + rs.light.toString(16).padStart(6, '0') : s.badge ? '#ffd9a0' : '#9fe8a0';
      const pillT = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: '18px', color: lcol }).setOrigin(0.5).setLetterSpacing(2);
      const pillW = Math.min(bw2, pillT.width + 34);
      const pillY = top + 4;
      const pg = scene.add.graphics();
      pg.fillStyle(0x040a1a, 0.95).fillRoundedRect(bx, pillY, pillW, 34, 17);
      pg.lineStyle(2.5, rs ? rs.main : s.badge ? 0xffb347 : 0x35c85a, 1).strokeRoundedRect(bx, pillY, pillW, 34, 17);
      pillT.setPosition(bx + pillW / 2, pillY + 17);
      if (pillT.width > pillW - 16) pillT.setScale((pillW - 16) / pillT.width);
      screen.add([pg, pillT]);
      screen.add(scene.add.text(bx, top + 62, 'PARA QUÉ SIRVE', { fontFamily: FONT, fontSize: '14px', color: '#9fb4e0' }).setOrigin(0, 0.5).setLetterSpacing(2));
      const descY = top + 80;
      const room = sy + sh - 56 - descY;
      const desc = scene.add.text(bx, descY, s.owned ? s.desc : `${s.desc}\n${lockedNote}`, { fontFamily: FONT, fontSize: '19px', color: '#e6f0ff', lineSpacing: 4, wordWrap: { width: bw2 } }).setOrigin(0, 0);
      for (let fs = 19; desc.height > room && fs > 12; fs--) desc.setFontSize(fs);
      screen.add(desc);
      // línea fina entre las dos columnas
      screen.add(scene.add.graphics().lineStyle(1.5, 0x2c3d66, 0.9).lineBetween(sx + half, midY - 110, sx + half, midY + 110));
      // --- botón de acción (igual que en la televisión de siempre)
      if (s.owned) {
        if (s.equipped) tag('EQUIPADO', 'green', undefined, true);
        else if (s.onEquip) {
          tag('EQUIPAR', 'yellow', () => {
            s.onEquip?.();
            sfx(scene, 'equipar');
            changed = true;
            slots.forEach((q, k) => (q.equipped = k === i));
            close();
          });
        }
      } else if (onShop) tag(shopLabel, 'blue', () => onShop());
      else tag('BLOQUEADO', 'grey');    } else if (s && s.owned) {
      if (special && !side) {
        // rayos de luz que giran despacio detrás del dibujo
        const rays = scene.add.graphics({ x: ix, y: iy });
        const n = 14;
        const R = Math.max(sw, sh);
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2;
          const a1 = a0 + (Math.PI / n) * 0.8;
          rays.fillStyle(color, 0.13).fillTriangle(0, 0, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R);
        }
        screen.add(rays);
        raysSpin = scene.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
      }
      const glow = scene.add.graphics({ x: ix, y: iy });
      if (!side) glow.fillStyle(color, 0.1).fillCircle(0, 0, glowR).fillStyle(color, 0.14).fillCircle(0, 0, glowR * 0.7);
      screen.add(glow);
      const ic = s.preview(ix, iy, big);
      screen.add(ic);
      // latido RELATIVO a la escala de cada objeto (un retrato ya viene reducido: con 0,94-1,04 absolutos se veía gigante)
      if (!side) {
        const base = (o: unknown) => (o as { scaleX?: number }).scaleX ?? 1;
        pulse = scene.tweens.add({
          targets: [ic, glow],
          scale: { getStart: (t: unknown) => base(t) * 0.94, getEnd: (t: unknown) => base(t) * 1.04 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
      if (!previewOnly) {
        const nm = scene.add.text(tx, ty, s.name.toUpperCase(), { ...textStyle(26), color: '#ffffff', align }).setOrigin(origin, 0.5);
        if (nm.width > tw) nm.setScale(tw / nm.width);
        screen.add(nm);
        screen.add(scene.add.text(tx, ty + (side ? 24 : 32), s.desc, { fontFamily: FONT, fontSize: '14px', color: '#b9d9f2', align, wordWrap: { width: tw } }).setOrigin(origin, 0));
      }
      if (s.equipped) tag('EQUIPADO', 'green', undefined, true);
      else if (s.onEquip) {
        tag('EQUIPAR', 'yellow', () => {
          // se equipa y el diálogo se cierra al instante: la escena (onClose con `changed`) ya muestra lo equipado
          s.onEquip?.();
          sfx(scene, 'equipar');
          changed = true;
          slots.forEach((q, k) => (q.equipped = k === i));
          close();
        });
      }
    } else if (s) {
      // existe pero no lo tiene: estática, el efecto atenuado, candado y aviso de la Tienda
      noise();
      const ic = s.preview(ix, iy, big);
      (ic as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(0.28);
      screen.add(ic);
      const lk = scene.add.graphics({ x: ix, y: iy - (side ? 30 : 0) });
      drawLock(lk, side ? 70 : 90, 0xaebfe6);
      screen.add(lk);
      if (!previewOnly) {
        const nm = scene.add.text(tx, ty, s.name.toUpperCase(), { ...textStyle(26), color: '#aebfe6', align }).setOrigin(origin, 0.5);
        if (nm.width > tw) nm.setScale(tw / nm.width);
        screen.add(nm);
        screen.add(scene.add.text(tx, ty + (side ? 24 : 32), `${s.desc}\n${lockedNote}`, { fontFamily: FONT, fontSize: '14px', color: '#8ea3ce', align, wordWrap: { width: tw } }).setOrigin(origin, 0));
      }
      if (onShop) tag(shopLabel, 'blue', () => onShop());
      else tag('BLOQUEADO', 'grey');
    } else {
      // hueco vacío: estática con un candado
      noise();
      const lk = scene.add.graphics({ x: sx + sw / 2, y: sy + 100 });
      drawLock(lk, 96, 0xaebfe6);
      screen.add(lk);
      screen.add(scene.add.text(sx + sw / 2, sy + 182, 'BLOQUEADO', { ...textStyle(26), color: '#aebfe6' }).setOrigin(0.5));
      screen.add(scene.add.text(sx + sw / 2, sy + 214, `Hueco ${i + 1} de ${TOTAL}. Aún no disponible.`, { fontFamily: FONT, fontSize: '14px', color: '#7f93bf', align: 'center', wordWrap: { width: sw - 40 } }).setOrigin(0.5, 0));
    }
    // etiqueta de RAREZA en la esquina superior derecha de la pantalla (solo los poderes con rareza)
    if (s?.rarity && !bigTv) {
      const RS = RARITY_STYLE[s.rarity];
      const lab = scene.add.text(0, 0, RARITY_LABEL[s.rarity], { fontFamily: FONT, fontSize: '16px', color: '#' + RS.light.toString(16).padStart(6, '0') }).setOrigin(0.5).setLetterSpacing(2);
      const pw2 = lab.width + 28;
      const ph2 = 30;
      const pill = scene.add.graphics();
      pill.fillStyle(0x040a1a, 0.9).fillRoundedRect(-pw2 / 2, -ph2 / 2, pw2, ph2, 15);
      pill.lineStyle(2.5, RS.main, 1).strokeRoundedRect(-pw2 / 2, -ph2 / 2, pw2, ph2, 15);
      const tag2 = scene.add.container(sx + sw - 16 - pw2 / 2, sy + 16 + ph2 / 2, [pill, lab]);
      screen.add(tag2);
    }  };

  // ---------------------------------------------------------------- huecos (2 filas × 5; con varias páginas se desliza de lado)
  const grid = scene.add.container(0, 0);
  panel.add(grid);
  let gridMoved = false;  for (let i = 0; i < TOTAL; i++) {
    const cx = cellX(i);
    const cy = cellY(i);
    const s = slots[i];
    const ring = scene.add.graphics();
    rings.push(ring);
    grid.add(ring);
    const items: Phaser.GameObjects.GameObject[] = [];
    cellItems[i] = items;
    if (s?.owned) {
      const th = (s.thumb ?? s.preview)(cx, cy - 6, slot * 0.66);
      grid.add(th);
      items.push(th);
    } else if (s?.showLocked) {
      // bloqueado pero visible: su dibujo apagado y un candado chico en la esquina
      const th = (s.thumb ?? s.preview)(cx, cy - 6, slot * 0.66);
      (th as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(0.55);
      grid.add(th);
      items.push(th);
      const lk = scene.add.graphics({ x: cx + slot * 0.26, y: cy + slot * 0.1 });
      drawLock(lk, slot * 0.26, 0xaebfe6);
      grid.add(lk);
      items.push(lk);
    } else {
      const lk = scene.add.graphics({ x: cx, y: cy - (s ? 8 : 0) });
      drawLock(lk, slot * 0.46, 0x5d73a6);
      grid.add(lk);
      items.push(lk);
    }
    if (s) {
      const lb = scene.add.text(cx, cy + slot / 2 - 12, s.name.toUpperCase(), { fontFamily: FONT, fontSize: '11px', color: s.owned ? '#dbe5ff' : '#6f84b3' }).setOrigin(0.5);
      if (lb.width > slot - 8) lb.setScale((slot - 8) / lb.width);
      grid.add(lb);
      items.push(lb);
    }
    const hit = scene.add.zone(cx, cy, slot, slot).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      if (gridMoved) return; // era un arrastre de página, no un toque
      selected = i;
      paint();
      show(i);
    });
    grid.add(hit);
  }
  // ---------------------------------------------------------------- páginas de la lista (solo con la televisión grande y más de 10 poderes)
  if (paged) {
    const gTop = py + 70 + tvH + ACT_H - 6;
    const gBottom = gTop + gridH + 12;
    let gridPage = Math.min(GPAGES - 1, Math.floor(Math.max(0, selected) / POWER_SLOTS));
    let gTween: Phaser.Tweens.Tween | null = null;
    const gMask = scene.make.graphics({}, false);
    gMask.fillRect(px + 2, gTop, pw - 4, gBottom - gTop);
    grid.setMask(gMask.createGeometryMask());
    root.once(Phaser.GameObjects.Events.DESTROY, () => gMask.destroy());
    grid.x = -gridPage * pw;
    const dotsG = scene.add.graphics();
    panel.add(dotsG);
    const dotsY = gBottom + DOTS_H / 2 + 2;
    const drawDots = () => {
      dotsG.clear();
      for (let k = 0; k < GPAGES; k++) {
        const on = k === gridPage;
        dotsG.fillStyle(on ? 0xffffff : 0x6f86bd, on ? 1 : 0.7).fillCircle(px + pw / 2 + (k - (GPAGES - 1) / 2) * 20, dotsY, on ? 5 : 4);
      }
    };
    drawDots();
    const goGrid = (pg: number) => {
      gridPage = Phaser.Math.Clamp(pg, 0, GPAGES - 1);
      drawDots();
      gTween?.remove();
      gTween = scene.tweens.add({ targets: grid, x: -gridPage * pw, duration: 360, ease: 'Cubic.easeOut' });
    };
    // arrastrar de lado sobre la lista: las páginas siguen el dedo y al soltar se decide (por distancia o por velocidad)
    let gDown = false;
    let gStartX = 0;
    let gStartOff = 0;
    let gAt = 0;
    const onDown = (ptr: Phaser.Input.Pointer) => {
      gDown = !closed && ptr.x >= px && ptr.x <= px + pw && ptr.y >= gTop && ptr.y <= gBottom;
      gridMoved = false;
      gStartX = ptr.x;
      gStartOff = grid.x;
      gAt = scene.time.now;
      if (gDown) gTween?.remove();
    };
    const onMove = (ptr: Phaser.Input.Pointer) => {
      if (!gDown || !ptr.isDown) return;
      const dx = ptr.x - gStartX;
      if (Math.abs(dx) > 10) gridMoved = true;
      if (!gridMoved) return;
      grid.x = Phaser.Math.Clamp(gStartOff + dx, -(GPAGES - 1) * pw - 50, 50);
    };
    const onUp = (ptr: Phaser.Input.Pointer) => {
      if (!gDown) return;
      gDown = false;
      if (!gridMoved) return;
      const dx = ptr.x - gStartX;
      const vel = dx / Math.max(1, scene.time.now - gAt); // px/ms
      let target = gridPage;
      if (dx < -pw * 0.18 || vel < -0.45) target = gridPage + 1; // hacia la izquierda: las siguientes
      else if (dx > pw * 0.18 || vel > 0.45) target = gridPage - 1; // hacia la derecha: las anteriores
      goGrid(target);
    };
    scene.input.on('pointerdown', onDown);
    scene.input.on('pointermove', onMove);
    scene.input.on('pointerup', onUp);
    gridCleanup = () => {
      scene.input.off('pointerdown', onDown);
      scene.input.off('pointermove', onMove);
      scene.input.off('pointerup', onUp);
      gTween?.remove();
    };
  }
  paint();
  show(selected);

  if (special) {
    // (usuario 16-11-2026) sin estrellitas: brillo que recorre el borde (dos destellos opuestos con estela, como la tarjeta ULTI de Personalizar);
    // se pinta al final, encima del marco (ver `shine` más abajo)
    shine = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    panel.add(shine);
    const R = 24;
    const pts: { x: number; y: number }[] = [];
    // perímetro del rectángulo redondeado (sentido horario), con un punto cada ~4 px
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i <= 8; i++) {
        const a = a0 + (i / 8) * (Math.PI / 2);
        pts.push({ x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R });
      }
    };
    const edgeTo = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 4));
      for (let i = 1; i < n; i++) pts.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n });
    };
    corner(px + R, py + R, Math.PI);
    edgeTo(px + R, py, px + pw - R, py);
    corner(px + pw - R, py + R, -Math.PI / 2);
    edgeTo(px + pw, py + R, px + pw, py + ph - R);
    corner(px + pw - R, py + ph - R, 0);
    edgeTo(px + pw - R, py + ph, px + R, py + ph);
    corner(px + R, py + ph - R, Math.PI / 2);
    edgeTo(px, py + ph - R, px, py + R);
    const N = pts.length;
    const TRAIL = Math.round(N * 0.06);
    const run = { d: 0 };
    const g = shine;
    sparkTweens.push(
      scene.tweens.add({
        targets: run,
        d: N,
        duration: 3200,
        repeat: -1,
        onUpdate: () => {
          if (!g.active) return;
          g.clear();
          for (const off of [0, Math.round(N / 2)]) {
            const head = Math.floor(run.d) + off;
            for (let k = 0; k < TRAIL; k++) {
              const a = pts[(head - k + N * 2) % N];
              const b = pts[(head - k - 1 + N * 2) % N];
              const f = 1 - k / TRAIL;
              g.lineStyle(5 * f + 2, 0xffffff, 0.85 * f).lineBetween(a.x, a.y, b.x, b.y);
            }
            const h = pts[head % N];
            g.fillStyle(0xffffff, 1).fillCircle(h.x, h.y, 4);
          }
        },
      }),
    );
    // halo del borde que late
    const halo = scene.add.graphics();
    halo.lineStyle(10, color, 0.35).strokeRoundedRect(px - 2, py - 2, pw + 4, ph + 4, 26);
    panel.addAt(halo, 1);
    sparkTweens.push(scene.tweens.add({ targets: halo, alpha: { from: 0.3, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
  }

  // (21-11-2026) el BORDE del diálogo, otra vez por encima de todo: la pantalla "En acción" (el fondo azul de la pista, el barrido de luz y la página que
  // entra con escala 1,1) llegaba hasta el borde izquierdo y derecho y lo tapaba; así el borde se ve siempre completo
  if (bigTv) {
    const frame = scene.add.graphics();
    frame.lineStyle(3, color, 1).strokeRoundedRect(px, py, pw, ph, 24);
    panel.add(frame);
    panel.bringToTop(frame);
  }
  if (shine) panel.bringToTop(shine);

  // entrada suave
  panel.setAlpha(0).setScale(0.96);
  panel.setPosition((W * 0.04) / 2, (H * 0.04) / 2);
  scene.tweens.add({ targets: panel, alpha: 1, scale: 1, x: 0, y: 0, duration: 160, ease: 'Back.easeOut' });
  return close;
}
