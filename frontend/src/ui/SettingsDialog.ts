import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';
import { getServerAddress, setServerAddress } from '../net/config';
import { disconnect } from '../net/NetClient';
import { RIVAL_OPTIONS, type RivalSetting, type ShakeLevel, getSettings, setSettings } from '../logic/Settings';

/**
 * Diálogo AJUSTES (mismo estilo que RANGOS): sonido, vibración y temblor de pantalla.
 * Cada cambio se guarda y se aplica al momento (con una pequeña muestra: sonido, vibración o temblor).
 * Se cierra con CERRAR o tocando fuera.
 */
const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;
const ON = 0x3ccf5a;

const VERSION = '1.0.0';

export function showSettings(scene: Phaser.Scene, o: { depth?: number; onClose?: () => void } = {}) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const depth = o.depth ?? 9000;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const close = () => {
    objs.forEach((g) => g.destroy());
    objs.length = 0;
    o.onClose?.();
  };

  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.75).setOrigin(0).setScrollFactor(0).setDepth(depth).setInteractive();
  shade.on('pointerdown', close);
  shade.setAlpha(0);
  scene.tweens.add({ targets: shade, alpha: 1, duration: 160 });
  objs.push(shade);

  // ---------------------------------------------------------------- panel
  const pw = Math.min(620, W - 40);
  const rowH = 112;
  const headH = 104;
  const footH = 150;
  const rows = 5;
  const ph = headH + rowH * rows + footH;
  const panel = scene.add.container(W / 2, H / 2).setScrollFactor(0).setDepth(depth + 1);
  panel.add(scene.add.rectangle(0, 0, pw, ph, 0x000000, 0.001).setInteractive()); // no cierra al tocar dentro
  const x = -pw / 2;
  const y = -ph / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(x + 4, y + 8, pw, ph, 26);
  g.lineStyle(12, NEON, 0.22).strokeRoundedRect(x, y, pw, ph, 26);
  g.fillStyle(0x0a1638, 1).fillRoundedRect(x - 4, y - 4, pw + 8, ph + 8, 29);
  g.fillStyle(NAVY, 0.97).fillRoundedRect(x, y, pw, ph, 26);
  g.fillStyle(0x1b2d5c, 0.55).fillRoundedRect(x + 4, y + 4, pw - 8, 84, { tl: 22, tr: 22, bl: 0, br: 0 });
  g.lineStyle(3, NEON, 1).strokeRoundedRect(x, y, pw, ph, 26);
  g.lineStyle(1.5, GOLD, 0.45).strokeRoundedRect(x + 8, y + 8, pw - 16, ph - 16, 20);
  panel.add(g);
  panel.add(scene.add.text(0, y + 46, 'AJUSTES', { fontFamily: FONT, fontSize: '44px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(4));

  const rowY = (i: number) => y + headH + rowH * i + rowH / 2;
  const sep = scene.add.graphics();
  for (let i = 1; i < rows; i++) sep.lineStyle(2, 0x2c4a8a, 0.8).lineBetween(x + 28, y + headH + rowH * i, x + pw - 28, y + headH + rowH * i);
  panel.add(sep);

  const label = (i: number, title: string, sub: string, icon: (gr: Phaser.GameObjects.Graphics) => void) => {
    const ic = scene.add.graphics({ x: x + 62, y: rowY(i) });
    ic.fillStyle(0x0a1638, 1).fillCircle(0, 0, 30);
    ic.lineStyle(3, NEON, 1).strokeCircle(0, 0, 30);
    icon(ic);
    panel.add(ic);
    panel.add(scene.add.text(x + 108, rowY(i) - 14, title, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0, 0.5));
    panel.add(scene.add.text(x + 109, rowY(i) + 18, sub, { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(0, 0.5));
  };

  // ---------------------------------------------------------------- filas
  const s = getSettings();
  label(0, 'SONIDO', 'Efectos del juego', speakerIcon);
  panel.add(toggle(scene, x + pw - 92, rowY(0), s.sound, (on) => {
    setSettings({ sound: on });
    if (on) blip(scene);
  }));

  label(1, 'VIBRACIÓN', 'Golpes perfectos y especiales', vibrateIcon);
  panel.add(toggle(scene, x + pw - 92, rowY(1), s.vibration, (on) => {
    setSettings({ vibration: on });
    if (on) navigator.vibrate?.(60);
  }));

  label(2, 'TEMBLOR', 'Sacudida de la pantalla', shakeIcon);
  panel.add(segmented(scene, x + pw - 34, rowY(2), s.shake, (lvl) => {
    setSettings({ shake: lvl });
    if (lvl > 0) scene.cameras.main.shake(220, 0.012); // muestra con el nivel elegido
  }));

  label(3, 'RIVAL', 'AUTO = según tu nivel', rivalIcon);
  panel.add(cycler(scene, x + pw - 34, rowY(3), s.rival, (v) => setSettings({ rival: v })));

  // servidor multijugador (LAN): IPv4 del PC que ejecuta el backend (ipconfig). Vacío = solo BOT.
  label(4, 'SERVIDOR LAN', 'IP del PC (ipconfig) · vacío = BOT', wifiIcon);
  panel.add(serverField(scene, x + pw - 34, rowY(4)));

  // ---------------------------------------------------------------- pie
  const btnY = y + ph - 92;
  const btn = arcadeButton(scene, 0, btnY, Math.min(320, pw - 120), 84, 'CERRAR', close, { palette: 'blue' });
  panel.add(btn);
  panel.add(scene.add.text(0, y + ph - 30, `NXO GAMES · v${VERSION}`, { fontFamily: FONT, fontSize: '15px', color: '#5d6f99' }).setOrigin(0.5).setLetterSpacing(1));

  panel.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });
  objs.push(panel);
  return close;
}

// ---------------------------------------------------------------- controles
/** Interruptor ON/OFF (pastilla con bolita que se desliza). */
function toggle(scene: Phaser.Scene, x: number, y: number, initial: boolean, onChange: (on: boolean) => void) {
  const w = 104;
  const h = 50;
  const c = scene.add.container(x, y);
  const track = scene.add.graphics();
  const knob = scene.add.container(0, 0);
  const kg = scene.add.graphics();
  kg.fillStyle(0x000000, 0.3).fillCircle(1, 3, h / 2 - 5);
  kg.fillStyle(0xffffff, 1).fillCircle(0, 0, h / 2 - 6);
  knob.add(kg);
  const txt = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '17px', color: '#ffffff' }).setOrigin(0.5);
  c.add([track, txt, knob]);
  let on = initial;
  const draw = (anim: boolean) => {
    track.clear();
    track.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, (h + 6) / 2);
    track.fillStyle(on ? ON : 0x3a4560, 1).fillRoundedRect(-w / 2, -h / 2, w, h, h / 2);
    track.fillStyle(0xffffff, on ? 0.18 : 0.06).fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.4, h * 0.2);
    txt.setText(on ? 'SÍ' : 'NO').setX(on ? -w / 4 + 2 : w / 4 - 2).setColor(on ? '#ffffff' : '#9aa6c4');
    const kx = on ? w / 2 - h / 2 : -w / 2 + h / 2;
    scene.tweens.killTweensOf(knob);
    if (anim) scene.tweens.add({ targets: knob, x: kx, duration: 140, ease: 'Quad.easeOut' });
    else knob.x = kx;
  };
  draw(false);
  c.setSize(w + 20, h + 20).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    on = !on;
    draw(true);
    onChange(on);
  });
  return c;
}

/** Selector de 3 opciones del temblor: NORMAL / SUAVE / NO (`right` = borde derecho). */
function segmented(scene: Phaser.Scene, right: number, y: number, initial: ShakeLevel, onChange: (lvl: ShakeLevel) => void) {
  const opts: [ShakeLevel, string][] = [
    [1, 'NORMAL'],
    [0.5, 'SUAVE'],
    [0, 'NO'],
  ];
  const segW = 82;
  const h = 50;
  const w = segW * opts.length;
  const c = scene.add.container(right - w / 2, y);
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 16);
  bg.fillStyle(0x223156, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  c.add(bg);
  const sel = scene.add.graphics();
  c.add(sel);
  const labels = opts.map(([, t], i) => {
    const tx = scene.add.text(-w / 2 + segW * i + segW / 2, 0, t, { fontFamily: FONT, fontSize: '16px', color: '#9aa6c4' }).setOrigin(0.5);
    c.add(tx);
    return tx;
  });
  let cur = Math.max(0, opts.findIndex(([v]) => v === initial));
  const draw = () => {
    sel.clear();
    sel.fillStyle(NEON, 1).fillRoundedRect(-w / 2 + segW * cur + 3, -h / 2 + 3, segW - 6, h - 6, 12);
    sel.fillStyle(0xffffff, 0.16).fillRoundedRect(-w / 2 + segW * cur + 6, -h / 2 + 5, segW - 12, h * 0.36, 8);
    labels.forEach((t, i) => t.setColor(i === cur ? '#ffffff' : '#9aa6c4'));
  };
  draw();
  opts.forEach(([v], i) => {
    const hit = scene.add.rectangle(-w / 2 + segW * i + segW / 2, 0, segW, h + 16, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      if (cur === i) return;
      cur = i;
      draw();
      onChange(v);
    });
    c.add(hit);
  });
  return c;
}

/** Selector con flechas ‹ VALOR › de la dificultad del rival (`right` = borde derecho). */
function cycler(scene: Phaser.Scene, right: number, y: number, initial: RivalSetting, onChange: (v: RivalSetting) => void) {
  const w = 246;
  const h = 50;
  const c = scene.add.container(right - w / 2, y);
  const bg = scene.add.graphics();
  bg.fillStyle(0x0a1638, 1).fillRoundedRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 16);
  bg.fillStyle(0x223156, 1).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
  bg.fillStyle(NEON, 1).fillRoundedRect(-w / 2 + 50, -h / 2 + 3, w - 100, h - 6, 12);
  bg.fillStyle(0xffffff, 0.16).fillRoundedRect(-w / 2 + 53, -h / 2 + 5, w - 106, h * 0.36, 8);
  c.add(bg);
  const COLORS: Record<RivalSetting, string> = { auto: '#ffffff', facil: '#9dffb0', normal: '#ffffff', dificil: '#ffd23f', experto: '#ff8a8a' };
  const txt = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }).setOrigin(0.5);
  c.add(txt);
  let cur = Math.max(0, RIVAL_OPTIONS.findIndex((o) => o.v === initial));
  const draw = () => {
    const o = RIVAL_OPTIONS[cur];
    txt.setText(o.label).setColor(COLORS[o.v]);
  };
  draw();
  const arrow = (dir: -1 | 1) => {
    const ax = dir * (w / 2 - 25);
    const t = scene.add.text(ax, -2, dir < 0 ? '‹' : '›', { fontFamily: FONT, fontSize: '34px', color: '#cfe0ff' }).setOrigin(0.5);
    const hit = scene.add.rectangle(ax, 0, 54, h + 16, 0x000000, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      cur = (cur + dir + RIVAL_OPTIONS.length) % RIVAL_OPTIONS.length;
      draw();
      scene.tweens.add({ targets: txt, scale: { from: 1.18, to: 1 }, duration: 160, ease: 'Back.easeOut' });
      onChange(RIVAL_OPTIONS[cur].v);
    });
    c.add([t, hit]);
  };
  arrow(-1);
  arrow(1);
  return c;
}

// ---------------------------------------------------------------- iconos (dibujados)
/** Campo de la dirección del servidor: muestra la actual; al tocarlo se edita (diálogo del sistema). */
function serverField(scene: Phaser.Scene, right: number, y: number) {
  const c = scene.add.container(0, 0);
  const w = 230;
  const h = 52;
  const g = scene.add.graphics();
  const t = scene.add.text(right - w / 2, y, '', { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }).setOrigin(0.5);
  const draw = () => {
    const v = getServerAddress();
    g.clear();
    g.fillStyle(0x0a1638, 1).fillRoundedRect(right - w, y - h / 2, w, h, 14);
    g.lineStyle(2, v ? 0x62d935 : 0x3a4a6a, 1).strokeRoundedRect(right - w, y - h / 2, w, h, 14);
    t.setText(v || 'SIN CONFIGURAR').setColor(v ? '#ffffff' : '#7f93bf');
    t.setScale(Math.min(1, (w - 20) / Math.max(1, t.width / t.scaleX)));
  };
  draw();
  const hit = scene.add.rectangle(right - w / 2, y, w, h, 0, 0.001).setInteractive({ useHandCursor: true });
  hit.on('pointerup', () => {
    const v = window.prompt('IPv4 del PC con el servidor (ver "ipconfig"), p. ej. 192.168.1.101 o 192.168.1.101:3001. Vacío = solo BOT.', getServerAddress());
    if (v === null) return;
    setServerAddress(v);
    disconnect(); // la próxima búsqueda usa la nueva dirección
    draw();
  });
  c.add([g, t, hit]);
  return c;
}

function wifiIcon(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3.5, 0xffffff, 1);
  for (const r of [16, 10]) g.beginPath().arc(0, 6, r, Math.PI * 1.22, Math.PI * 1.78).strokePath();
  g.fillStyle(0xffffff, 1).fillCircle(0, 6, 3.5);
}

function rivalIcon(g: Phaser.GameObjects.Graphics) {
  // cara de robot (rival)
  g.fillStyle(0xffffff, 1).fillRoundedRect(-13, -10, 26, 22, 6);
  g.fillStyle(0x0a1638, 1).fillCircle(-5, 0, 3.5).fillCircle(5, 0, 3.5);
  g.fillStyle(0xff5a6a, 1).fillRect(-6, 7, 12, 2.5);
  g.lineStyle(3, 0xffffff, 1).lineBetween(0, -10, 0, -16);
  g.fillStyle(0xffd23f, 1).fillCircle(0, -17, 3);
}

function speakerIcon(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0xffffff, 1).fillRect(-14, -6, 8, 12);
  g.fillTriangle(-6, -6, 4, -14, 4, 14).fillTriangle(-6, -6, -6, 6, 4, 14);
  g.lineStyle(3, 0xffffff, 1);
  g.beginPath().arc(4, 0, 9, -0.7, 0.7).strokePath();
  g.beginPath().arc(4, 0, 15, -0.75, 0.75).strokePath();
}

function vibrateIcon(g: Phaser.GameObjects.Graphics) {
  g.fillStyle(0xffffff, 1).fillRoundedRect(-8, -14, 16, 28, 4);
  g.fillStyle(0x0a1638, 1).fillRect(-5, -10, 10, 18);
  g.lineStyle(3, 0xffffff, 1);
  g.lineBetween(-14, -8, -14, 8).lineBetween(14, -8, 14, 8).lineBetween(-19, -4, -19, 4).lineBetween(19, -4, 19, 4);
}

function shakeIcon(g: Phaser.GameObjects.Graphics) {
  g.lineStyle(3, 0xffffff, 1).strokeRoundedRect(-11, -11, 22, 22, 4);
  g.lineStyle(3, 0xffd23f, 1);
  g.lineBetween(-18, -6, -14, -2).lineBetween(-14, -2, -18, 2).lineBetween(-18, 2, -14, 6);
  g.lineBetween(18, -6, 14, -2).lineBetween(14, -2, 18, 2).lineBetween(18, 2, 14, 6);
}

/** Pitido corto de confirmación al activar el sonido. */
function blip(scene: Phaser.Scene) {
  const ctx = (scene.sound as unknown as { context?: AudioContext }).context;
  if (!ctx) return;
  setTimeout(() => {
    if (ctx.state !== 'running') return;
    const o = ctx.createOscillator();
    const gn = ctx.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(880, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gn.gain.setValueAtTime(0.0001, ctx.currentTime);
    gn.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.01);
    gn.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
    o.connect(gn).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.2);
  }, 60);
}
