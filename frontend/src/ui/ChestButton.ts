import Phaser from 'phaser';
import { FONT } from './theme';
import { modeBand, modeShape } from './modeButtons';
import { CHEST_TEX, GOLD, NAVY, chestImage, coinIcon, drawChestIcon } from './wheelArt';
import { CHEST, chestStatus, formatChestClock, formatChestTime, openChest, type ChestReward } from '../domain/chest';
import { commit, getPlayer } from '../domain/playerStore';
import { drawFadingRays } from './fadeRays';
import { gameClock } from '../domain/timeSource';
import { arcadeButton } from './modeButtons';
import { canShowRewardedAds, showRewarded } from '../ads/ads';

/**
 * CARD del COFRE del menú principal (15-11-2026, ajustada a pedido del usuario; 21-11-2026 del tamaño de la card de DIARIO, 102x84): card pequeña con la forma de RULETAS DIARIAS,
 * encima de ella y alineada a su borde derecho. Solo el COFRE dibujado (sin texto dentro); en la etiqueta de arriba, el tiempo
 * que falta para abrirlo (o "¡ABRIR!"). SOLO aparece si el cofre se ganó en la ruleta (sin cofre = null, no se dibuja).
 * Al abrirlo muestra el premio y la card desaparece.
 * (16-11-2026) Con el cofre aún cerrado, tocarlo ofrece ABRIR YA viendo un ANUNCIO (se salta el tiempo).
 */
export function chestButton(scene: Phaser.Scene, x: number, y: number, onToast: (m: string) => void, w = 102, h = 84): Phaser.GameObjects.Container | null {
  if (chestStatus(getPlayer() as never, gameClock.now()).kind === 'none') return null;
  const c = scene.add.container(x, y).setDepth(50);
  const off = (pts: Phaser.Math.Vector2[], dx: number, dy: number) => pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  const g = scene.add.graphics();
  const glow = scene.add.circle(0, 3, 30, 0xffffff, 0).setBlendMode(Phaser.BlendModes.ADD);
  const icon = scene.add.graphics({ x: 0, y: 3 });
  // (17-11-2026, usuario) el COFRE en imagen, del nivel actual (normal / oro / épico); sin textura, el dibujado (icon)
  const iconImg = scene.textures.exists(CHEST_TEX[0]) ? scene.add.image(0, 3, CHEST_TEX[0]).setDisplaySize(60, 60) : null;
  // etiqueta de arriba (como "RULETAS DIARIAS"), centrada: el tiempo que falta
  const tag = scene.add.graphics();
  const tagText = scene.add.text(0, -h / 2 - 2, '', { fontFamily: FONT, fontSize: '17px', color: '#ffd23f' }).setOrigin(0.5).setLetterSpacing(1);
  c.add([g, glow, icon, ...(iconImg ? [iconImg] : []), tag, tagText]);
  const base = iconImg ? iconImg.scaleX : 1;
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  let pulse: Phaser.Tweens.Tween | null = null;

  const paint = () => {
    if (!c.active) return;
    const st = chestStatus(getPlayer() as never, gameClock.now());
    if (st.kind === 'none') return void c.destroy();
    const col = CHEST.colors[st.level];
    g.clear();
    g.fillStyle(col, 0.5).fillPoints(off(modeShape(w, h, 4), 6, 9), true);
    g.fillStyle(NAVY, 1).fillPoints(modeShape(w, h, 5), true);
    g.fillStyle(0x0b1733, 0.97).fillPoints(modeShape(w, h), true);
    g.fillStyle(col, 0.22).fillPoints(modeBand(w, h, -h * 0.44, -h * 0.02, 6, 9), true);
    g.lineStyle(2.5, col, 0.95).strokePoints(modeShape(w, h), true, true);
    icon.clear();
    if (iconImg) iconImg.setTexture(CHEST_TEX[st.level]);
    else drawChestIcon(icon, 22);
    glow.setFillStyle(col, st.kind === 'ready' ? 0.4 : 0.12);
    tagText.setText(st.kind === 'ready' ? '¡ABRIR!' : formatChestTime(st.msLeft)).setColor(st.kind === 'ready' ? '#ffe680' : '#ffd23f');
    const tw = Math.max(80, tagText.width + 30);
    tag.clear();
    tag.fillStyle(NAVY, 1).fillRoundedRect(-tw / 2, -h / 2 - 17, tw, 30, 15);
    tag.lineStyle(2, st.kind === 'ready' ? 0xffe680 : GOLD, 1).strokeRoundedRect(-tw / 2, -h / 2 - 17, tw, 30, 15);
    if (st.kind === 'ready') {
      if (!pulse) {
        pulse = scene.tweens.add({ targets: [icon, glow], scale: { from: 1, to: 1.15 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        if (iconImg) scene.tweens.add({ targets: iconImg, scale: { from: base, to: base * 1.15 }, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      }
    } else {
      pulse?.remove();
      pulse = null;
      icon.setScale(1);
      glow.setScale(1);
      if (iconImg) {
        scene.tweens.killTweensOf(iconImg);
        iconImg.setScale(base);
      }
    }
  };
  paint();
  const tick = scene.time.addEvent({ delay: 1000, loop: true, callback: paint });
  c.once(Phaser.GameObjects.Events.DESTROY, () => tick.remove());

  /** abre el cofre (skipWait: tras ver el anuncio) y muestra el premio; la card desaparece */
  const open = (skipWait: boolean) => {
    const now = gameClock.now();
    let got: { reward: ChestReward; level: number } | null = null;
    commit((s) => {
      const o = openChest(s as never, now, skipWait);
      if (!o) return { ok: false as const, error: 'not_ready' };
      got = { reward: o.reward, level: o.level };
      return { ok: true as const, state: o.state };
    });
    if (!got) return false;
    showChestReward(scene, got);
    if (c.active) scene.tweens.add({ targets: c, scale: 0, alpha: 0, duration: 260, ease: 'Back.easeIn', onComplete: () => c.destroy() });
    return true;
  };

  c.on('pointerup', () => {
    scene.tweens.add({ targets: c, scale: { from: 0.96, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    const st = chestStatus(getPlayer() as never, gameClock.now());
    if (st.kind === 'none') return;
    if (st.kind === 'locked') return showOpenNow(scene, st.level, () => open(true), onToast);
    open(false);
  });
  return c;
}

/** Anuncio para abrir ya: en desarrollo sin anuncios se simula (como el DÍA TEST del premio diario). */
async function watchAd(): Promise<boolean> {
  if (canShowRewardedAds()) return showRewarded('chest_open_now');
  return import.meta.env.DEV;
}

/**
 * Cofre aún cerrado: ventana con el tiempo que falta y el botón ABRIR YA (anuncio). Completar el anuncio abre el cofre al
 * instante; cancelarlo o que falle no cambia nada. Se cierra tocando fuera o con la X.
 */
function showOpenNow(scene: Phaser.Scene, level: 0 | 1 | 2, openNow: () => boolean, onToast: (m: string) => void) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const col = CHEST.colors[level];
  const root = scene.add.container(0, 0).setDepth(8500);
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.65).setOrigin(0).setInteractive();
  const pw = Math.min(520, W - 48);
  const ph = 470;
  const cx = W / 2;
  const cy = H / 2;
  const panel = scene.add.graphics();
  panel.fillStyle(col, 0.35).fillRoundedRect(cx - pw / 2 + 6, cy - ph / 2 + 9, pw, ph, 26);
  panel.fillStyle(0x0b1733, 0.98).fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 26);
  panel.lineStyle(4, col, 1).strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 26);
  const block = scene.add.zone(cx, cy, pw, ph).setInteractive(); // tocar el panel no lo cierra
  const title = scene.add.text(cx, cy - ph / 2 + 50, CHEST.names[level], { fontFamily: FONT, fontSize: '38px', color: '#ffe680', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5);
  const glow = scene.add.circle(cx, cy - 50, 70, col, 0.3).setBlendMode(Phaser.BlendModes.ADD);
  // (17-11-2026) el cofre en imagen de su nivel (en un contenedor: las animaciones de escala siguen igual)
  const icon = scene.add.container(cx, cy - 50, [chestImage(scene, 0, 0, 150, level)]);
  const time = scene.add.text(cx, cy + 52, '', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5);
  const paintTime = () => {
    const st = chestStatus(getPlayer() as never, gameClock.now());
    time.setText(st.kind === 'locked' ? formatChestClock(st.msLeft) : '¡Ya se puede abrir!');
  };
  paintTime();
  const tick = scene.time.addEvent({ delay: 1000, loop: true, callback: paintTime });
  let busy = false;
  const close = () => {
    tick.remove();
    root.destroy();
  };
  const btn = arcadeButton(scene, cx, cy + ph / 2 - 90, Math.min(330, pw - 60), 82, 'ABRIR YA', () => {
    if (busy) return;
    busy = true;
    void watchAd().then((earned) => {
      if (!root.active) return;
      busy = false;
      if (!earned) return onToast('Anuncio no disponible · inténtalo más tarde');
      close();
      openNow();
    });
  }, { palette: 'blue' });
  const label = btn.getData('label') as Phaser.GameObjects.Text | undefined;
  if (label) label.x = -22;
  const video = scene.add.graphics({ x: 112, y: 0 });
  video.fillStyle(0x0a1638, 1).fillRoundedRect(-16, -12, 32, 24, 5);
  video.fillStyle(0xffffff, 1).fillPoints([{ x: -4, y: -7 }, { x: 8, y: 0 }, { x: -4, y: 7 }], true);
  btn.add(video);
  const hint = scene.add.text(cx, cy + 96, 'Mira un anuncio y ábrelo ahora', { fontFamily: FONT, fontSize: '18px', color: '#7f93bf' }).setOrigin(0.5);
  const x = scene.add.container(cx + pw / 2 - 30, cy - ph / 2 + 30);
  const xg = scene.add.graphics();
  xg.fillStyle(NAVY, 1).fillCircle(0, 0, 24);
  xg.lineStyle(3, 0x3a7bff, 1).strokeCircle(0, 0, 24);
  xg.lineStyle(6, 0xffffff, 1).lineBetween(-9, -9, 9, 9).lineBetween(9, -9, -9, 9);
  x.add(xg);
  x.setSize(60, 60).setInteractive({ useHandCursor: true });
  x.on('pointerup', close);
  dim.on('pointerup', close);
  root.add([dim, panel, block, glow, icon, title, time, hint, btn, x]);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  scene.tweens.add({ targets: glow, scale: 1.2, alpha: 0.15, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** Ventana con el premio del cofre recién abierto (encima de todo; se cierra al tocar). */
function showChestReward(scene: Phaser.Scene, got: { reward: ChestReward; level: number }) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const col = CHEST.colors[got.level as 0 | 1 | 2];
  const root = scene.add.container(0, 0).setDepth(9500).setScrollFactor(0);
  const dim = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.88).setOrigin(0).setInteractive();
  root.add(dim);
  // (26-11-2026, usuario) presentación como premio de ruleta: rayos, el cofre y cada premio con su IMAGEN y su cantidad
  const cy = H * 0.34;
  const rays = scene.add.graphics({ x: W / 2, y: cy }).setBlendMode(Phaser.BlendModes.ADD);
  drawFadingRays(rays, 12, 300, col, 0.28, 0.12); // (26-11-2026, usuario) se difuminan al alejarse
  rays.fillStyle(col, 0.25).fillCircle(0, 0, 100);
  root.add(rays);
  scene.tweens.add({ targets: rays, angle: 360, duration: 9000, repeat: -1 });
  const name = scene.add.text(W / 2, cy - 160, `¡${CHEST.names[got.level as 0 | 1 | 2]}!`, { fontFamily: FONT, fontSize: '50px', color: '#ffe680', stroke: '#0a1638', strokeThickness: 10 }).setOrigin(0.5);
  const icon = scene.add.container(W / 2, cy, [chestImage(scene, 0, 0, 190, got.level)]);
  root.add([name, icon]);
  for (const o of [name, icon]) o.setScale(0.3).setAlpha(0);
  scene.tweens.add({ targets: [name, icon], scale: 1, alpha: 1, duration: 420, ease: 'Back.easeOut' });
  // premios: dinero (fardo), monedas y EXP, en fila
  const r = got.reward;
  const items: { key: 'cash' | 'coins' | 'xp'; value: number; label: string; css: string }[] = [];
  if (r.cash > 0) items.push({ key: 'cash', value: r.cash, label: 'DINERO', css: '#8dffad' });
  if (r.coins > 0) items.push({ key: 'coins', value: r.coins, label: 'MONEDAS', css: '#ffd23f' });
  if (r.xp > 0) items.push({ key: 'xp', value: r.xp, label: 'EXP', css: '#7ff0ff' });
  const cardW = Math.min(190, (W - 40) / Math.max(1, items.length) - 12);
  const rowY = cy + 210;
  items.forEach((it, i) => {
    const x = W / 2 + (i - (items.length - 1) / 2) * (cardW + 12);
    const c = scene.add.container(x, rowY);
    const g = scene.add.graphics();
    g.fillStyle(0x061b4c, 0.98).fillRoundedRect(-cardW / 2, -80, cardW, 160, 22);
    g.lineStyle(3, col, 1).strokeRoundedRect(-cardW / 2, -80, cardW, 160, 22);
    c.add(g);
    let art: Phaser.GameObjects.GameObject;
    if (it.key === 'cash' && scene.textures.exists('cash-pack')) {
      const im = scene.add.image(0, -24, 'cash-pack');
      art = im.setScale(70 / Math.max(im.width, im.height));
    } else if (it.key === 'coins' && scene.textures.exists('daily-coins-art')) {
      const im = scene.add.image(0, -24, 'daily-coins-art');
      art = im.setScale(76 / Math.max(im.width, im.height));
    } else if (it.key === 'coins') art = coinIcon(scene, 0, -24, 30);
    else art = scene.add.text(0, -24, 'EXP', { fontFamily: FONT, fontSize: '40px', color: it.css, stroke: '#0a1638', strokeThickness: 8 }).setOrigin(0.5);
    const amt = scene.add.text(0, 36, '+0', { fontFamily: FONT, fontSize: '32px', color: it.css, stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5);
    const lab = scene.add.text(0, 64, it.label, { fontFamily: FONT, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(1);
    c.add([art, amt, lab]);
    root.add(c);
    c.setScale(0.3).setAlpha(0);
    scene.tweens.add({ targets: c, scale: 1, alpha: 1, delay: 350 + i * 160, duration: 380, ease: 'Back.easeOut' });
    const n = { v: 0 };
    scene.tweens.add({ targets: n, v: it.value, delay: 450 + i * 160, duration: 700, ease: 'Cubic.easeOut', onUpdate: () => amt.setText('+' + Math.round(n.v).toLocaleString('es-CL')) });
  });
  if (r.item) root.add(scene.add.text(W / 2, rowY + 110, `¡${r.item.name.toUpperCase()}!`, { fontFamily: FONT, fontSize: '30px', color: '#ffe680', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5));
  const hint = scene.add.text(W / 2, H * 0.9, 'TOCA PARA CONTINUAR', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setAlpha(0);
  root.add(hint);
  scene.cameras.main.flash(200, 255, 230, 160);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 200 });
  scene.time.delayedCall(900, () => {
    if (!root.active) return;
    scene.tweens.add({ targets: hint, alpha: { from: 0.4, to: 1 }, duration: 600, yoyo: true, repeat: -1 });
    dim.once('pointerup', () => scene.tweens.add({ targets: root, alpha: 0, duration: 200, onComplete: () => root.destroy() }));
  });
}
