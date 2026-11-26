import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { arcadeButton } from '../ui/modeButtons';
import { showConfirm } from '../ui/ConfirmDialog';
import { commit } from '../domain/playerStore';
import { USERNAME, completeOnboarding, validUsername } from '../domain/operations';
import { CATALOG } from '../characters/catalog';
import { addPortrait } from '../characters/portrait';
import { passHeroSkin, rosterPortrait } from '../characters/passPortrait';
import { passiveOf } from '../domain/characterPassives';
import { startIntroMusic } from '../fx/introMusic';
import { sfx } from '../fx/sfx';
import { uiSound } from '../fx/uiSound';
import { drawPassiveIcon } from '../ui/passiveInfo';
import type { SkinId } from '../characters/skins';

const NAVY = 0x0b1a3d;
const NEON = 0x3a7bff;
const GOLD = 0xffd23f;

/**
 * (24-11-2026, usuario) PANTALLA DE INICIO (antes del menú, una sola vez por cuenta; operations.needsOnboarding):
 *   1. NOMBRE DE USUARIO (3 a 12 caracteres).
 *   2. ELIGE TU PERSONAJE: los 10 (5 hombres arriba, 5 mujeres abajo). Se regala SOLO UNO; los demás se desbloquean en la Tienda. Hoy solo se
 *      pueden elegir los jugables, incluido Jun aunque también sea premio del Pase. Se confirma porque no hay vuelta atrás.
 * Lo elegido queda en la cuenta (PlayerState: name, owned, equipped.skin, onboarded). Hoy la cuenta se guarda en el teléfono; con la base de
 * datos irá al servidor (docs/BASE-DE-DATOS.md).
 */
const ROSTER: { id: string; name: string }[][] = [
  // hombres (el 5.º aún sin personaje)
  [
    { id: 'nxo', name: 'Nxo' },
    { id: 'jun', name: 'Jun' },
    { id: 'mat', name: 'Mat' },
    { id: 'zac', name: 'Zac' },
    { id: '', name: '???' },
  ],
  // mujeres
  [
    { id: 'mai', name: 'Mai' },
    { id: 'net', name: 'Net' },
    { id: 'isa', name: 'Isa' },
    { id: 'rin', name: 'Rin' },
    { id: 'flo', name: 'Flo' },
  ],
];
const PASS_HERO = passHeroSkin();
const PLAYABLE: readonly string[] = CATALOG.filter((c) => c.id !== PASS_HERO || c.id === 'jun').map((c) => c.id);
/**
 * (24-11-2026, usuario) COLOR de la ficha de cada personaje: [tono 0-360, × saturación, × brillo]. NXO = la roja de la imagen. ISA = el fucsia de
 * su raqueta; FLO = el verde azulado de su raqueta (el usuario no lo definió: se toma de su ropa y raqueta).
 */
const CARD_HUE: Record<string, [number, number, number]> = {
  mai: [335, 0.85, 1.15], // rosado
  jun: [25, 1, 1.2], // naranja
  mat: [130, 0.95, 0.95], // verde
  zac: [50, 1, 1.35], // amarillo
  net: [275, 0.95, 1.1], // morado
  isa: [315, 1, 1.05], // fucsia (su raqueta)
  rin: [195, 0.95, 1.3], // celeste
  flo: [178, 0.85, 0.95], // verde azulado (su raqueta)
};
/** (24-11-2026, usuario) los dos pasos con el título y el botón a la misma altura: centro del título y distancia del botón al borde de abajo */
const TITLE_Y = 140;
const BTN_Y = 110;

export class OnboardingScene extends Phaser.Scene {
  private nameBox?: HTMLInputElement;
  private name = '';
  private layer?: Phaser.GameObjects.Container;
  private dialog: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super('Onboarding');
  }

  preload() {
    if (!this.textures.exists('menu-bg')) this.load.image('menu-bg', 'assets/menu-bg.webp');
    // (24-11-2026, usuario) título y ficha del personaje (fuentes PNG en _temp/respaldo_oficial/ui/)
    if (!this.textures.exists('ob-title')) this.load.image('ob-title', 'assets/ui/elige-tu-pj.webp');
    if (!this.textures.exists('ob-name-title')) this.load.image('ob-name-title', 'assets/ui/como-te-llamas.webp');
    if (!this.textures.exists('ob-name-box')) this.load.image('ob-name-box', 'assets/ui/caja-nombre.webp');
    if (!this.textures.exists('ob-card')) this.load.image('ob-card', 'assets/ui/perfil-pj.webp');
    for (const id of ROSTER.flat().map((r) => r.id)) {
      const p = id && id !== 'nxo' && id !== 'mai' ? rosterPortrait(id) : undefined;
      if (p && !this.textures.exists(p.key)) this.load.image(p.key, p.file);
    }
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
    startIntroMusic(this); // (26-11-2026, usuario) la música del menú desde ¿CÓMO TE LLAMAS? (sigue al llegar al menú)
    if (this.textures.exists('menu-bg')) {
      const bg = this.add.image(W / 2, H, 'menu-bg').setOrigin(0.5, 1);
      bg.setScale(Math.max(W / bg.width, H / bg.height));
    }
    this.add.rectangle(0, 0, W, H, 0x04122e, 0.72).setOrigin(0);
    this.cameras.main.fadeIn(300, 0, 0, 0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.removeInput());
    this.stepName();
  }

  // ---------------------------------------------------------------- 1. nombre
  private stepName() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.layer?.destroy();
    const c = (this.layer = this.add.container(0, 0));
    // (24-11-2026, usuario) arte de como-te-llamas.png: el título (assets/ui/como-te-llamas.webp) y la caja del nombre (assets/ui/caja-nombre.webp)
    // (24-11-2026, usuario) a la misma altura que el título de ELIGE TU PERSONAJE (TITLE_Y) y del mismo ancho
    const ty = TITLE_Y;
    let titleBottom = ty + 60;
    if (this.textures.exists('ob-name-title')) {
      const t = this.add.image(W / 2, ty, 'ob-name-title');
      t.setScale((W - 60) / t.width);
      titleBottom = ty + t.displayHeight / 2;
      c.add(t);
    } else c.add(this.add.text(W / 2, ty, '¿CÓMO TE LLAMAS?', { fontFamily: FONT, fontSize: '50px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5));
    // subtítulo entre dos líneas doradas
    const sy = titleBottom + 30; // (24-11-2026, usuario) justo bajo el título
    const sub = this.add.text(W / 2, sy, 'Así te verán tus rivales', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5);
    const lg = this.add.graphics();
    const half = sub.width / 2 + 18;
    const LINE = 34; // (24-11-2026, usuario) líneas más cortas (antes 70)
    lg.fillStyle(GOLD, 1).fillRoundedRect(W / 2 - half - LINE, sy - 2, LINE, 4, 2).fillRoundedRect(W / 2 + half, sy - 2, LINE, 4, 2);
    c.add([lg, sub]);
    // caja del nombre: la imagen (con su barra amarilla) y encima el <input> del teléfono; a la derecha, el lápiz
    const bw = W - 60;
    const by = sy + 120;
    let bh = 100;
    let textL = W / 2 - bw / 2 + 60;
    if (this.textures.exists('ob-name-box')) {
      const b = this.add.image(W / 2, by, 'ob-name-box');
      b.setScale(bw / b.width);
      bh = b.displayHeight;
      textL = W / 2 - bw / 2 + (130 / 1579) * bw; // justo después de la barra amarilla (x 99 de 1579 en la imagen)
      c.add(b);
    } else {
      const g = this.add.graphics();
      g.fillStyle(NAVY, 1).fillRoundedRect(W / 2 - bw / 2, by - 50, bw, 100, 18);
      g.lineStyle(4, NEON, 1).strokeRoundedRect(W / 2 - bw / 2, by - 50, bw, 100, 18);
      c.add(g);
    }
    const pen = this.add.graphics({ x: W / 2 + bw / 2 - 62, y: by });
    // lápiz: cuerpo inclinado, punta y goma
    pen.lineStyle(4, 0xcfe0ff, 1);
    pen.beginPath().moveTo(-14, 14).lineTo(-10, 2).lineTo(8, -16).lineTo(16, -8).lineTo(-2, 10).closePath().strokePath();
    pen.lineBetween(4, -12, 12, -4);
    pen.lineBetween(-10, 2, -2, 10);
    c.add(pen);
    // (25-11-2026, usuario) el lápiz aparece cuando termina de escribirse "Tu nombre" (makeInput: 250 + 9 × 110 ms)
    pen.setAlpha(0).setScale(0.4);
    this.tweens.add({ targets: pen, alpha: 1, scale: 1, delay: 1300, duration: 260, ease: 'Back.easeOut' });
    // aviso de las reglas: píldora con (i)
    const iy = by + bh / 2 + 52;
    const rule = this.add.text(W / 2 + 22, iy, `De ${USERNAME.min} a ${USERNAME.max} letras o números`, { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0.5);
    const pw = rule.width + 100;
    const pill = this.add.graphics();
    pill.fillStyle(0x060f2a, 0.85).fillRoundedRect(W / 2 - pw / 2, iy - 24, pw, 48, 24);
    const ix = W / 2 - pw / 2 + 32;
    pill.lineStyle(3, 0x6fb2ff, 1).strokeCircle(ix, iy, 15);
    pill.fillStyle(0x6fb2ff, 1).fillCircle(ix, iy - 7, 2.6).fillRoundedRect(ix - 2, iy - 2, 4, 11, 2);
    c.add([pill, rule]);
    const err = this.add.text(W / 2, iy + 48, '', { fontFamily: FONT, fontSize: '20px', color: '#ff8a8a', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5);
    c.add(err);
    // el texto de Lilita One queda bajo en un <input>: se sube un poco para que quede al medio de la caja
    this.makeInput(textL, by - bh * 0.05, W / 2 + bw / 2 - 110 - textL, bh * 0.56);
    const next = () => {
      const n = validUsername(this.nameBox?.value ?? '');
      if (!n) {
        err.setText(`Escribe un nombre de ${USERNAME.min} a ${USERNAME.max} letras o números`);
        return;
      }
      this.name = n;
      this.removeInput();
      this.stepCharacter();
    };
    this.nameBox?.addEventListener('keydown', (e) => e.key === 'Enter' && next());
    // SIGUIENTE: como el JUGAR del menú, sin la sombra
    // (24-11-2026, usuario) a la misma altura que ELEGIR de la pantalla siguiente (BTN_Y) y del mismo tamaño
    c.add(arcadeButton(this, W / 2, H - BTN_Y, 420, 108, 'SIGUIENTE', next, { palette: 'yellow', noShadow: true }));
  }

  /** <input> de HTML sobre el lienzo (Phaser no trae cajas de texto), en coordenadas del juego. */
  /** `x` = borde IZQUIERDO del texto, `y` = centro. */
  private makeInput(x: number, y: number, w: number, h: number) {
    this.removeInput();
    const canvas = this.game.canvas;
    const r = canvas.getBoundingClientRect();
    const k = r.width / this.scale.width;
    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = USERNAME.max;
    // (25-11-2026, usuario) el placeholder "Tu nombre" se escribe letra a letra al abrir la pantalla
    const ph = 'Tu nombre';
    el.placeholder = '';
    for (let i = 1; i <= ph.length; i++) setTimeout(() => el.isConnected && (el.placeholder = ph.slice(0, i)), 250 + i * 110);
    el.value = this.name;
    // (25-11-2026, usuario) solo letras y números (sin espacios ni símbolos)
    el.addEventListener('input', () => {
      const clean = el.value.replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ]/g, '');
      if (clean !== el.value) el.value = clean;
    });
    el.autocomplete = 'off';
    el.setAttribute('autocapitalize', 'words');
    Object.assign(el.style, {
      position: 'fixed',
      left: `${r.left + x * k}px`,
      top: `${r.top + (y - h / 2) * k}px`,
      width: `${w * k}px`,
      height: `${h * k}px`,
      fontSize: `${Math.round(38 * k)}px`,
      fontFamily: '"Lilita One", sans-serif',
      textAlign: 'left',
      caretColor: '#ffd23f',
      lineHeight: `${h * k}px`,
      padding: '0',
      margin: '0',
      color: '#ffffff',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      zIndex: '10',
    } as Partial<CSSStyleDeclaration>);
    el.className = 'ob-name';
    if (!document.getElementById('ob-name-css')) {
      const css = document.createElement('style');
      css.id = 'ob-name-css';
      css.textContent = '.ob-name::placeholder{color:#7f8fb3;opacity:1;font-style:italic}';
      document.head.appendChild(css);
    }
    document.body.appendChild(el);
    this.nameBox = el;
    setTimeout(() => el.focus(), 50);
  }

  private removeInput() {
    this.nameBox?.remove();
    this.nameBox = undefined;
  }

  // ---------------------------------------------------------------- 2. personaje
  private stepCharacter() {
    const W = this.scale.width;
    const H = this.scale.height;
    this.layer?.destroy();
    const c = (this.layer = this.add.container(0, 0));
    // (24-11-2026, usuario) título con su imagen (assets/ui/elige-tu-pj.webp); sin ella, el texto
    if (this.textures.exists('ob-title')) {
      const t = this.add.image(W / 2, TITLE_Y, 'ob-title');
      t.setScale((W - 60) / t.width);
      c.add(t);
    } else c.add(this.add.text(W / 2, TITLE_Y, 'ELIGE TU PERSONAJE', { fontFamily: FONT, fontSize: '46px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5));
    // (24-11-2026, usuario) aviso en un panel como los demás (azul oscuro, borde neón), letras blancas con UNO y TIENDA en amarillo, y el
    // icono de información a la izquierda, entre las dos filas
    this.notice(c, W / 2, 304, W - 40, [ // (24-11-2026, usuario) más abajo (antes 272)
      [['Solo puedes elegir ', '#ffffff'], ['UNO', '#ffd23f'], [': es gratis y queda guardado en tu cuenta.', '#ffffff']],
      [['Los demás los desbloqueas después en la ', '#ffffff'], ['Tienda', '#ffd23f'], ['.', '#ffffff']],
    ]);
    const gap = 10;
    const cw = (W - 40 - gap * 4) / 5;
    const ch = 200;
    const top = 366;
    let selected = '';
    const frames: { id: string; g: Phaser.GameObjects.Graphics; b: Phaser.GameObjects.Graphics; x: number; y: number }[] = [];
    // (24-11-2026, usuario) CARD de cada personaje: marco grueso (dorado el elegido, azul los demás, gris los que aún no llegan), fondo azul
    // oscuro con un brillo detrás del retrato, placa del nombre abajo y, en el elegido, un brillo exterior y el ✓ dorado arriba a la derecha
    const PLATE_H = 34;
    const draw = () => {
      for (const f of frames) {
        const on = f.id === selected;
        const play = PLAYABLE.includes(f.id);
        const g = f.g;
        const L = f.x - cw / 2;
        const T = f.y - ch / 2;
        const edge = on ? GOLD : play ? NEON : 0x2c3d66;
        const edgeDark = on ? 0xb87a08 : play ? 0x1a4fb0 : 0x1a2440;
        g.clear();
        if (on) {
          g.fillStyle(GOLD, 0.18).fillRoundedRect(L - 9, T - 9, cw + 18, ch + 18, 22);
          g.fillStyle(GOLD, 0.28).fillRoundedRect(L - 5, T - 5, cw + 10, ch + 10, 19);
        }
        g.fillStyle(0x050d22, 0.55).fillRoundedRect(L + 2, T + 5, cw, ch, 16); // sombra
        g.fillStyle(edgeDark, 1).fillRoundedRect(L, T, cw, ch, 16); // marco (oscuro abajo)
        g.fillStyle(edge, 1).fillRoundedRect(L, T, cw, ch - 3, 16); // marco
        const b = on ? 6 : 4; // grosor del marco
        g.fillStyle(play ? 0x0c1d47 : 0x0a1430, 1).fillRoundedRect(L + b, T + b, cw - b * 2, ch - b * 2, 12);
        // brillo detrás del retrato y reflejo arriba
        g.fillStyle(on ? 0x3a6fd6 : 0x2a56b0, play ? (on ? 0.55 : 0.4) : 0.15).fillEllipse(f.x, T + ch * 0.42, cw * 0.95, ch * 0.62);
        g.fillStyle(0xffffff, 0.06).fillRoundedRect(L + b + 3, T + b + 3, cw - b * 2 - 6, ch * 0.22, 9);
        // placa del nombre
        const py = T + ch - b - PLATE_H - 3;
        g.fillStyle(0x060f2a, 0.95).fillRoundedRect(L + b + 3, py, cw - b * 2 - 6, PLATE_H, 9);
        g.lineStyle(2, edge, on ? 1 : 0.7).strokeRoundedRect(L + b + 3, py, cw - b * 2 - 6, PLATE_H, 9);
        // ✓ del elegido (encima del retrato)
        f.b.clear();
        if (on) {
          const bx = L + cw - 17;
          const by = T + 17;
          f.b.fillStyle(0x0a1638, 1).fillCircle(bx, by, 15);
          f.b.fillStyle(0xb87a08, 1).fillCircle(bx, by + 1, 12.5);
          f.b.fillStyle(GOLD, 1).fillCircle(bx, by, 12);
          f.b.lineStyle(3.5, 0xffffff, 1).beginPath().moveTo(bx - 5.5, by).lineTo(bx - 1.5, by + 4.5).lineTo(bx + 6, by - 4.5).strokePath();
        }
      }
    };
    ROSTER.forEach((row, ri) =>
      row.forEach((r, i) => {
        const x = 20 + cw / 2 + i * (cw + gap);
        const y = top + ch / 2 + ri * (ch + 40);
        const play = PLAYABLE.includes(r.id);
        const inPass = r.id === PASS_HERO;
        // (25-11-2026, usuario) las cards entran de a una desde la derecha (todas en menos de 1,5 s)
        const cc = this.add.container(W, 0).setAlpha(0);
        c.add(cc);
        this.tweens.add({ targets: cc, x: 0, alpha: 1, delay: 80 + (ri * row.length + i) * 105, duration: 300, ease: 'Cubic.easeOut', onStart: () => uiSound(this, 'card') }); // (26-11-2026, usuario) con sonido
        const g = this.add.graphics();
        cc.add(g);
        const badge = this.add.graphics();
        frames.push({ id: r.id, g, b: badge, x, y });
        // retrato con los pies sobre la placa del nombre
        const pic = this.portrait(r.id, x, y + ch / 2 - PLATE_H - 8, ch - PLATE_H - 12); // (25-11-2026, usuario) un poco más grandes (antes - 28)
        if (pic) {
          cc.add(pic);
          if (!play) (pic as Phaser.GameObjects.Image).setAlpha(0.35);
        }
        cc.add(this.add.text(x, y + ch / 2 - 6 - PLATE_H / 2 - 3, r.name.toUpperCase(), { fontFamily: FONT, fontSize: '21px', color: play ? '#ffffff' : '#6f7fa6', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1));
        if (!play) cc.add(this.add.text(x, y - 20, inPass ? 'DEL PASE' : 'PRONTO', { fontFamily: FONT, fontSize: '18px', color: '#9fb4e0', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setAngle(-12));
        cc.add(badge);
        const hit = this.add.rectangle(x, y, cw, ch, 0x000000, 0.001).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          if (!play) return this.toastMsg(inPass ? 'Consíguelo en el Pase de Batalla' : 'Este personaje llegará pronto');
          selected = r.id;
          draw();
          info();
        });
        c.add(hit);
      }),
    );
    draw();
    // (24-11-2026, usuario) FICHA del elegido sobre assets/ui/perfil-pj.webp: la cara a la izquierda, arriba al medio el nombre, debajo la
    // pasiva y abajo su descripción. Las zonas se miden en la imagen original (2172 × 724).
    const cardW = W - 40;
    const k = cardW / 2172;
    const cardH = 724 * k;
    const cardTop = top + ch * 2 + 30 + 14 + 44; // (25-11-2026, usuario) +44: la cabeza que sale por arriba no choca con las cards
    const cardL = W / 2 - cardW / 2;
    const P = (x: number, y: number) => ({ x: cardL + x * k, y: cardTop + y * k });
    const hint = this.add.text(W / 2, cardTop + cardH / 2, 'Toca un personaje', { fontFamily: FONT, fontSize: '26px', color: '#cfe0ff' }).setOrigin(0.5);
    c.add(hint);
    const card = this.add.container(0, 0).setVisible(false);
    c.add(card);
    const cardImg = this.textures.exists('ob-card') ? this.add.image(W / 2, cardTop, 'ob-card').setOrigin(0.5, 0).setDisplaySize(cardW, cardH) : null;
    if (cardImg) card.add(cardImg);
    // la cara: el retrato grande recortado a la zona izquierda de la ficha
    const faceA = P(60, 96);
    const faceB = P(700, 650);
    // (25-11-2026, usuario) la cabeza sale un poco POR ENCIMA de la ficha: la máscara sube sobre su borde de arriba
    const popY = cardTop - 34;
    const maskG = this.make.graphics({}, false).fillStyle(0xffffff).fillRect(faceA.x, popY, faceB.x - faceA.x, faceB.y - popY);
    let faceMask: Phaser.Display.Masks.GeometryMask | Phaser.Display.Masks.BitmapMask = maskG.createGeometryMask();
    /** (25-11-2026, usuario) MAI e ISA: el desvanecido de la derecha empieza más tarde (se ve más cara) */
    let faceMaskLate: Phaser.Display.Masks.GeometryMask | Phaser.Display.Masks.BitmapMask = faceMask;
    const LATE_FADE = new Set(['mai', 'isa']);
    // (25-11-2026, usuario) el borde DERECHO del personaje se desvanece en degradado (sin corte limpio); solo con WebGL (si no, el corte de siempre)
    if (this.renderer.type === Phaser.WEBGL) {
      const mw = Math.round(faceB.x - faceA.x);
      const mh = Math.round(faceB.y - popY);
      if (this.textures.exists('ob-face-fade')) this.textures.remove('ob-face-fade');
      const tex = this.textures.createCanvas('ob-face-fade', mw, mh);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createLinearGradient(0, 0, mw, 0);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.68, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, mw, mh);
        tex.refresh();
        const mImg = this.make.image({ x: faceA.x, y: popY, key: 'ob-face-fade' }, false).setOrigin(0, 0);
        faceMask = mImg.createBitmapMask();
      }
      if (this.textures.exists('ob-face-fade-late')) this.textures.remove('ob-face-fade-late');
      const texL = this.textures.createCanvas('ob-face-fade-late', mw, mh);
      if (texL) {
        const ctx = texL.getContext();
        const grad = ctx.createLinearGradient(0, 0, mw, 0);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.8, 'rgba(255,255,255,1)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, mw, mh);
        texL.refresh();
        faceMaskLate = this.make.image({ x: faceA.x, y: popY, key: 'ob-face-fade-late' }, false).setOrigin(0, 0).createBitmapMask();
      }
    }
    let face: Phaser.GameObjects.GameObject | undefined;
    const nm = P(1062, 152);
    const nameT = this.add.text(nm.x, nm.y, '', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setLetterSpacing(2);
    const ps = P(1140, 340);
    const pasT = this.add.text(ps.x, ps.y, '', { fontFamily: FONT, fontSize: '19px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
    const ds = P(745, 430);
    const descT = this.add.text(ds.x, ds.y, '', { fontFamily: FONT, fontSize: '20px', color: '#ffffff', lineSpacing: 4, wordWrap: { width: (1640 - 745) * k } }).setOrigin(0, 0);
    card.add([nameT, pasT, descT]);
    // ELEGIR: como el JUGAR del menú (mismo alto), sin la sombra de color
    const btn = arcadeButton(this, W / 2, H - BTN_Y, 420, 108, 'ELEGIR', () => {
      if (!selected) return this.toastMsg('Toca un personaje');
      this.confirmPick(selected);
    }, { palette: 'yellow', noShadow: true });
    c.add(btn);
    // (24-11-2026, usuario) VOLVER a ¿CÓMO TE LLAMAS? (conserva el nombre escrito)
    c.add(this.backButton(64, H - BTN_Y, () => this.stepName()));
    const info = () => {
      const r = ROSTER.flat().find((x) => x.id === selected);
      const pas = passiveOf(selected);
      hint.setVisible(false);
      card.setVisible(true);
      cardImg?.setTexture(this.cardTexture(selected)).setDisplaySize(cardW, cardH); // la ficha del color del personaje
      face?.destroy();
      // la cabeza centrada en la zona y de la cabeza a los hombros dentro de ella (antes se centraba el retrato entero y la cabeza, que está a
      // un lado de la raqueta, se cortaba a la izquierda)
      const fd = this.faceOf(selected);
      if (fd) {
        const zw = faceB.x - faceA.x;
        const zh = faceB.y - popY;
        const sc = (zh * 0.98) / fd.fh;
        face = this.add.image(faceA.x + zw / 2, popY + 4, fd.key).setOrigin(fd.cx / fd.w, fd.top / fd.h).setScale(sc);
      } else face = undefined;
      if (face) {
        (face as Phaser.GameObjects.Image).setMask(LATE_FADE.has(selected) ? faceMaskLate : faceMask);
        card.addAt(face, 1);
      }
      nameT.setText(r ? r.name.toUpperCase() : '');
      const nk = Math.min(1, (640 * k) / Math.max(1, nameT.width));
      nameT.setScale(nk);
      pasT.setText(pas ? `PASIVA · ${pas.name}` : 'SIN PASIVA');
      pasT.setScale(Math.min(1, (780 * k) / Math.max(1, pasT.width)));
      descT.setText(pas?.short ?? '');
    };
  }

  /**
   * (24-11-2026, usuario) La ficha (perfil-pj, roja = NXO) del COLOR de cada personaje: se cambia el tono de lo rojo (marco, caja del nombre,
   * franjas y raqueta del fondo) y se deja igual lo azul. Se hace una vez por personaje (textura `ob-card-<id>`).
   */
  private cardTexture(id: string): string {
    const hue = CARD_HUE[id];
    if (hue === undefined || !this.textures.exists('ob-card')) return 'ob-card';
    const key = `ob-card-${id}`;
    if (this.textures.exists(key)) return key;
    const src = this.textures.get('ob-card').getSourceImage() as HTMLImageElement;
    const tex = this.textures.createCanvas(key, src.width, src.height);
    if (!tex) return 'ob-card';
    const ctx = tex.getContext();
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, src.width, src.height);
    const d = img.data;
    const [th, ts, tv] = hue;
    let dh = th - 355; // giro de tono desde el rojo de la ficha
    if (dh > 180) dh -= 360;
    if (dh < -180) dh += 360;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), dl = mx - mn;
      if (dl < 0.02) continue;
      let h = mx === r ? ((g - b) / dl) % 6 : mx === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
      h *= 60;
      if (h < 0) h += 360;
      const sat = dl / mx;
      const dist = Math.min(Math.abs(h - 355), 360 - Math.abs(h - 355));
      // peso suave: hacia el naranja se corta pronto (el borde dorado no cambia); hacia el morado, degradado
      const wh = h < 180 ? (h <= 12 ? 1 : h >= 22 ? 0 : 1 - (h - 12) / 10) : dist <= 30 ? 1 : dist >= 70 ? 0 : 1 - (dist - 30) / 40;
      const wsat = sat <= 0.12 ? 0 : sat >= 0.3 ? 1 : (sat - 0.12) / 0.18;
      const w = wh * wsat;
      if (w <= 0) continue;
      // se GIRA el tono (conserva los degradados); saturación y brillo según el color
      const nh = (((h + dh * w) % 360) + 360) % 360;
      const ns = Math.min(1, sat * (1 + (ts - 1) * w));
      const nv = Math.min(1, mx * (1 + (tv - 1) * w));
      const c = nv * ns, x = c * (1 - Math.abs(((nh / 60) % 2) - 1)), m = nv - c;
      const [rr, gg, bb] = nh < 60 ? [c, x, 0] : nh < 120 ? [x, c, 0] : nh < 180 ? [0, c, x] : nh < 240 ? [0, x, c] : nh < 300 ? [x, 0, c] : [c, 0, x];
      d[i] = (rr + m) * 255;
      d[i + 1] = (gg + m) * 255;
      d[i + 2] = (bb + m) * 255;
    }
    ctx.putImageData(img, 0, 0);
    tex.refresh();
    return key;
  }

  /** Botón redondo con flecha hacia atrás (azul, sin sombra). */
  private backButton(x: number, y: number, onTap: () => void) {
    const R = 44;
    const b = this.add.container(x, y);
    const g = this.add.graphics();
    g.fillStyle(0x0a1638, 1).fillCircle(0, 0, R + 4);
    g.fillStyle(0x153f9e, 1).fillCircle(0, 2, R);
    g.fillStyle(0x2f7bff, 1).fillCircle(0, 0, R - 2);
    g.fillStyle(0xffffff, 0.18).fillEllipse(0, -R * 0.45, R * 1.3, R * 0.6);
    g.lineStyle(7, 0xffffff, 1);
    g.beginPath().moveTo(8, -16).lineTo(-10, 0).lineTo(8, 16).strokePath();
    b.add(g);
    b.setSize(R * 2 + 16, R * 2 + 16).setInteractive({ useHandCursor: true });
    b.on('pointerup', () => {
      this.tweens.add({ targets: b, scale: { from: 0.9, to: 1 }, duration: 140, ease: 'Back.easeOut' });
      onTap();
    });
    return b;
  }

  /** Panel de aviso estándar con (i) a la izquierda y filas de texto con trozos de color ([texto, color]). */
  private notice(c: Phaser.GameObjects.Container, cx: number, cy: number, w: number, rows: [string, string][][]) {
    const fs = 20;
    const lineH = 28;
    const iconW = 54;
    const h = rows.length * lineH + 22;
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.35).fillRoundedRect(cx - w / 2 + 3, cy - h / 2 + 5, w, h, 16);
    g.fillStyle(NAVY, 0.95).fillRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(cx - w / 2, cy - h / 2, w, h, 16);
    // (i)
    const ix = cx - w / 2 + 30;
    g.fillStyle(0x0a1638, 1).fillCircle(ix, cy, 17);
    g.lineStyle(3, 0x6fb2ff, 1).strokeCircle(ix, cy, 15);
    g.fillStyle(0x6fb2ff, 1).fillCircle(ix, cy - 7, 2.8).fillRoundedRect(ix - 2.2, cy - 2, 4.4, 11, 2);
    c.add(g);
    const left = cx - w / 2 + iconW;
    const avail = w - iconW - 14;
    rows.forEach((parts, i) => {
      const y = cy - ((rows.length - 1) * lineH) / 2 + i * lineH;
      const line = this.add.container(0, y);
      let x = 0;
      for (const [t, col] of parts) {
        const tx = this.add.text(x, 0, t, { fontFamily: FONT, fontSize: `${fs}px`, color: col, stroke: '#0a1638', strokeThickness: 3 }).setOrigin(0, 0.5);
        line.add(tx);
        x += tx.width;
      }
      const k = Math.min(1, avail / Math.max(1, x));
      line.setScale(k).setX(left + (avail - x * k) / 2);
      c.add(line);
    });
  }

  /**
   * (24-11-2026, usuario) CARA de un personaje para la ficha: centro de la cabeza (x) y arriba del pelo (y) en px de su retrato, y el alto
   * de la cabeza a los hombros. Sin datos: el centro y el tercio de arriba de la caja visible.
   */
  private faceOf(id: string): { key: string; w: number; h: number; cx: number; top: number; fh: number } | null {
    const FACE: Record<string, { cx: number; top: number; fh: number }> = { nxo: { cx: 450, top: 18, fh: 690 }, mai: { cx: 440, top: 10, fh: 690 } }; // (26-11-2026, usuario) Mai un poco mas pequena (fh 600 -> 690)
    const key = id === 'nxo' ? 'portrait-nxo' : id === 'mai' ? 'portrait-mai' : rosterPortrait(id)?.key;
    if (!key || !this.textures.exists(key)) return null;
    const src = this.textures.get(key).getSourceImage() as { width: number; height: number };
    const p = rosterPortrait(id);
    // (25-11-2026, usuario) Mat: la cara un poco más a la derecha para que se vea la oreja (la raqueta puede cortarse)
    // (25-11-2026, usuario) Jun: también a la derecha (se ve la oreja) y un poco más pequeño (FH: más alto de cara = dibujo más chico)
    const SHIFT: Record<string, number> = { mat: 0.1, isa: 0.16, jun: 0.1, net: 0.12, zac: 0.09 };
    const FH: Record<string, number> = { jun: 1.15, isa: 1.15, mat: 1.15 }; // (26-11-2026, usuario) Mat también un poco más pequeño
    const f = FACE[id] ?? (p ? { cx: (p.box.x0 + p.box.x1) / 2 - (p.box.x1 - p.box.x0) * (SHIFT[id] ?? 0), top: p.box.y0, fh: (p.box.y1 - p.box.y0) * 0.42 * (FH[id] ?? 1) } : { cx: src.width / 2, top: 0, fh: src.height * 0.42 });
    return { key, w: src.width, h: src.height, ...f };
  }

  private portrait(id: string, x: number, feetY: number, h: number): Phaser.GameObjects.GameObject | undefined {
    if (!id) return this.add.text(x, feetY - h / 2, '?', { fontFamily: FONT, fontSize: '64px', color: '#3a4a6e' }).setOrigin(0.5);
    if (id === 'nxo' || id === 'mai') return addPortrait(this, id as SkinId, x, feetY, h);
    const p = rosterPortrait(id);
    if (!p || !this.textures.exists(p.key)) return undefined;
    const { x0, y0, x1, y1 } = p.box;
    return this.add.image(x, feetY, p.key).setOrigin((x0 + x1) / 2 / p.w, y1 / p.h).setScale(h / (y1 - y0));
  }

  /** (26-11-2026, usuario) en el diálogo de confirmar: el personaje a la IZQUIERDA y su PASIVA a la derecha */
  private pickArt(skin: string, x: number, feetY: number, h: number, w: number) {
    const c = this.add.container(0, 0);
    const pas = passiveOf(skin);
    const px = pas ? x - w * 0.2 : x;
    const por = this.portrait(skin, px, feetY, h);
    if (por) c.add(por);
    if (!pas) return c;
    const rx = x + w * 0.2;
    const cy = feetY - h / 2;
    const ic = this.add.graphics({ x: rx, y: cy - 60 });
    ic.fillStyle(0x07152f, 1).fillCircle(0, 0, 32).lineStyle(3, pas.color, 1).strokeCircle(0, 0, 32);
    drawPassiveIcon(ic, pas.id, 18, pas.color);
    const tag = this.add.text(rx, cy - 12, 'PASIVA', { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(2);
    const nm = this.add.text(rx, cy + 16, pas.name, { fontFamily: FONT, fontSize: '28px', color: pas.css, stroke: '#061431', strokeThickness: 5 }).setOrigin(0.5);
    const ds = this.add.text(rx, cy + 46, pas.short, { fontFamily: FONT, fontSize: '17px', color: '#dbe5ff', align: 'center', wordWrap: { width: w * 0.4 } }).setOrigin(0.5, 0);
    c.add([ic, tag, nm, ds]);
    return c;
  }

  private confirmPick(skin: string) {
    const r = ROSTER.flat().find((x) => x.id === skin);
    this.dialog.forEach((o) => o.destroy());
    this.dialog = showConfirm(this, {
      title: `¿ELEGIR A ${(r?.name ?? skin).toUpperCase()}?`,
      // (26-11-2026, usuario) texto nuevo, el personaje sobre los botones y CONFIRMO (con el sonido de equipar)
      message: '¡Este será tu personaje para empezar! Los demás los podrás ir desbloqueando en la Tienda.',
      confirmLabel: 'CONFIRMO',
      cancelLabel: 'VOLVER',
      artH: 290,
      highlight: 'Tienda', // (26-11-2026, usuario) en amarillo
      badge: 'ball', // (26-11-2026, usuario) pelota de tenis girando (no la bandera)
      art: (x, feetY, h, w) => this.pickArt(skin, x, feetY, h, w),
      onConfirm: () => {
        sfx(this, 'equipar');
        this.finish(skin);
      },
      onCancel: () => {
        this.dialog.forEach((o) => o.destroy());
        this.dialog = [];
      },
      depth: 9000,
      noShadow: true, // (24-11-2026, usuario) ELEGIR y VOLVER sin la sombra 3D
    });
  }

  private finish(skin: string) {
    const res = commit((s) => completeOnboarding(s, this.name, skin, PLAYABLE));
    this.dialog.forEach((o) => o.destroy());
    this.dialog = [];
    if (!res.ok) return this.toastMsg('No se pudo guardar. Inténtalo otra vez');
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
  }

  private toastMsg(msg: string) {
    const W = this.scale.width;
    const t = this.add.text(W / 2, this.scale.height - 240, msg, { fontFamily: FONT, fontSize: '24px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setDepth(9500);
    this.tweens.add({ targets: t, alpha: 0, delay: 1400, duration: 400, onComplete: () => t.destroy() });
  }
}
