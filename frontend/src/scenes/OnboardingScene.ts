import Phaser from 'phaser';
import { FONT } from '../ui/theme';
import { arcadeButton } from '../ui/modeButtons';
import { showConfirm } from '../ui/ConfirmDialog';
import { commit } from '../domain/playerStore';
import { USERNAME, completeOnboarding, validUsername } from '../domain/operations';
import { CATALOG } from '../characters/catalog';
import { addPortrait } from '../characters/portrait';
import { rosterPortrait } from '../characters/passPortrait';
import { passiveOf } from '../domain/characterPassives';
import type { SkinId } from '../characters/skins';

const NAVY = 0x0b1a3d;
const NEON = 0x3a7bff;
const GOLD = 0xffd23f;

/**
 * (24-11-2026, usuario) PANTALLA DE INICIO (antes del menú, una sola vez por cuenta; operations.needsOnboarding):
 *   1. NOMBRE DE USUARIO (3 a 12 caracteres).
 *   2. ELIGE TU PERSONAJE: los 10 (5 hombres arriba, 5 mujeres abajo). Se regala SOLO UNO; los demás se desbloquean en la Tienda. Hoy solo se
 *      pueden elegir los jugables (CATALOG); el resto sale con "PRONTO". Se confirma porque no hay vuelta atrás.
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
const PLAYABLE = CATALOG.map((c) => c.id as string);

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
    for (const id of ROSTER.flat().map((r) => r.id)) {
      const p = id && id !== 'nxo' && id !== 'mai' ? rosterPortrait(id) : undefined;
      if (p && !this.textures.exists(p.key)) this.load.image(p.key, p.file);
    }
  }

  create() {
    const W = this.scale.width;
    const H = this.scale.height;
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
    c.add(this.add.text(W / 2, H * 0.3, '¿CÓMO TE LLAMAS?', { fontFamily: FONT, fontSize: '50px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5));
    c.add(this.add.text(W / 2, H * 0.3 + 56, 'Así te verán tus rivales', { fontFamily: FONT, fontSize: '24px', color: '#9fb4e0' }).setOrigin(0.5));
    // caja del nombre (el texto lo escribe un <input> encima, para tener el teclado del teléfono)
    const bw = W - 120;
    const by = H * 0.3 + 150;
    const g = this.add.graphics();
    g.fillStyle(NAVY, 1).fillRoundedRect(W / 2 - bw / 2, by - 40, bw, 80, 18);
    g.lineStyle(3, NEON, 1).strokeRoundedRect(W / 2 - bw / 2, by - 40, bw, 80, 18);
    c.add(g);
    const err = this.add.text(W / 2, by + 66, '', { fontFamily: FONT, fontSize: '20px', color: '#ff8a8a' }).setOrigin(0.5);
    c.add(err);
    c.add(this.add.text(W / 2, by + 100, `De ${USERNAME.min} a ${USERNAME.max} letras o números`, { fontFamily: FONT, fontSize: '18px', color: '#7f93bf' }).setOrigin(0.5));
    this.makeInput(W / 2, by, bw - 40, 56);
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
    c.add(arcadeButton(this, W / 2, by + 200, 320, 88, 'SIGUIENTE', next, { palette: 'yellow' }));
  }

  /** <input> de HTML sobre el lienzo (Phaser no trae cajas de texto), en coordenadas del juego. */
  private makeInput(x: number, y: number, w: number, h: number) {
    this.removeInput();
    const canvas = this.game.canvas;
    const r = canvas.getBoundingClientRect();
    const k = r.width / this.scale.width;
    const el = document.createElement('input');
    el.type = 'text';
    el.maxLength = USERNAME.max;
    el.placeholder = 'Tu nombre';
    el.value = this.name;
    el.autocomplete = 'off';
    el.setAttribute('autocapitalize', 'words');
    Object.assign(el.style, {
      position: 'fixed',
      left: `${r.left + (x - w / 2) * k}px`,
      top: `${r.top + (y - h / 2) * k}px`,
      width: `${w * k}px`,
      height: `${h * k}px`,
      fontSize: `${Math.round(34 * k)}px`,
      fontFamily: '"Lilita One", sans-serif',
      textAlign: 'center',
      color: '#ffffff',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      zIndex: '10',
    } as Partial<CSSStyleDeclaration>);
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
    c.add(this.add.text(W / 2, 120, 'ELIGE TU PERSONAJE', { fontFamily: FONT, fontSize: '46px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5));
    c.add(
      this.add
        .text(W / 2, 200, 'Solo puedes elegir UNO: es gratis y queda guardado en tu cuenta.\nLos demás los desbloqueas después en la Tienda.', { fontFamily: FONT, fontSize: '21px', color: '#ffe680', align: 'center', lineSpacing: 6, wordWrap: { width: W - 60 } })
        .setOrigin(0.5),
    );
    const gap = 10;
    const cw = (W - 40 - gap * 4) / 5;
    const ch = 220;
    const top = 270;
    let selected = '';
    const frames: { id: string; g: Phaser.GameObjects.Graphics; x: number; y: number }[] = [];
    const draw = () => {
      for (const f of frames) {
        const on = f.id === selected;
        const play = PLAYABLE.includes(f.id);
        f.g.clear();
        f.g.fillStyle(on ? 0x3a2a08 : NAVY, play ? 1 : 0.7).fillRoundedRect(f.x - cw / 2, f.y - ch / 2, cw, ch, 14);
        f.g.lineStyle(on ? 5 : 3, on ? GOLD : play ? NEON : 0x2c3d66, 1).strokeRoundedRect(f.x - cw / 2, f.y - ch / 2, cw, ch, 14);
      }
    };
    ROSTER.forEach((row, ri) =>
      row.forEach((r, i) => {
        const x = 20 + cw / 2 + i * (cw + gap);
        const y = top + ch / 2 + ri * (ch + 40);
        const play = PLAYABLE.includes(r.id);
        const g = this.add.graphics();
        c.add(g);
        frames.push({ id: r.id, g, x, y });
        const pic = this.portrait(r.id, x, y + ch / 2 - 34, ch - 50);
        if (pic) {
          c.add(pic);
          if (!play) (pic as Phaser.GameObjects.Image).setAlpha(0.35);
        }
        c.add(this.add.text(x, y + ch / 2 - 18, r.name.toUpperCase(), { fontFamily: FONT, fontSize: '20px', color: play ? '#ffffff' : '#7f93bf' }).setOrigin(0.5));
        if (!play) c.add(this.add.text(x, y - 20, 'PRONTO', { fontFamily: FONT, fontSize: '18px', color: '#9fb4e0', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setAngle(-12));
        const hit = this.add.rectangle(x, y, cw, ch, 0x000000, 0.001).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          if (!play) return this.toastMsg('Este personaje llegará pronto');
          selected = r.id;
          draw();
          info();
        });
        c.add(hit);
      }),
    );
    draw();
    // lo elegido: nombre, pasiva y botón
    const iy = top + ch * 2 + 40 + 70;
    const nameT = this.add.text(W / 2, iy, '', { fontFamily: FONT, fontSize: '34px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5);
    const pasT = this.add.text(W / 2, iy + 46, 'Toca un personaje', { fontFamily: FONT, fontSize: '21px', color: '#cfe0ff', align: 'center', wordWrap: { width: W - 80 } }).setOrigin(0.5, 0);
    c.add([nameT, pasT]);
    const btn = arcadeButton(this, W / 2, H - 130, 380, 92, 'ELEGIR', () => {
      if (!selected) return this.toastMsg('Toca un personaje');
      this.confirmPick(selected);
    }, { palette: 'yellow' });
    c.add(btn);
    const info = () => {
      const r = ROSTER.flat().find((x) => x.id === selected);
      const pas = passiveOf(selected);
      nameT.setText(r ? r.name.toUpperCase() : '');
      pasT.setText(pas ? `PASIVA · ${pas.name}\n${pas.short}` : '');
    };
  }

  private portrait(id: string, x: number, feetY: number, h: number): Phaser.GameObjects.GameObject | undefined {
    if (!id) return this.add.text(x, feetY - h / 2, '?', { fontFamily: FONT, fontSize: '64px', color: '#3a4a6e' }).setOrigin(0.5);
    if (id === 'nxo' || id === 'mai') return addPortrait(this, id as SkinId, x, feetY, h);
    const p = rosterPortrait(id);
    if (!p || !this.textures.exists(p.key)) return undefined;
    const { x0, y0, x1, y1 } = p.box;
    return this.add.image(x, feetY, p.key).setOrigin((x0 + x1) / 2 / p.w, y1 / p.h).setScale(h / (y1 - y0));
  }

  private confirmPick(skin: string) {
    const r = ROSTER.flat().find((x) => x.id === skin);
    this.dialog.forEach((o) => o.destroy());
    this.dialog = showConfirm(this, {
      title: `¿ELEGIR A ${(r?.name ?? skin).toUpperCase()}?`,
      message: 'No hay vuelta atrás: será tu personaje.',
      detail: 'Los demás se desbloquean en la Tienda',
      confirmLabel: 'ELEGIR',
      cancelLabel: 'VOLVER',
      onConfirm: () => this.finish(skin),
      onCancel: () => {
        this.dialog.forEach((o) => o.destroy());
        this.dialog = [];
      },
      depth: 9000,
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
