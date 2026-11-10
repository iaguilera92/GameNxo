import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { arcadeButton } from './modeButtons';
import { drawCoinIcon, drawGiftIcon } from './wheelArt';
import { drawCashIcon } from '../scenes/BattlePassScene';
import { LOGIN } from '../domain/dailyLogin';
import { claimLogin, claimLoginRewardAdBonus, loginStatus } from '../logic/Ranked';
import { canShowRewardedAds, showInterstitial, showRewarded } from '../ads/ads';

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;

/**
 * Botón del PREMIO DIARIO (bajo TIENDA, misma forma, mitad de ancho). NUNCA se abre solo: con un premio por
 * reclamar se marca en dorado (borde, brillo y punto que late); al tocarlo abre el panel de la racha.
 */
export function dailyLoginButton(scene: Phaser.Scene, x: number, y: number, onToast: (m: string) => void, w = 76, h = 76) {
  const c = scene.add.container(x, y).setDepth(50);
  const draw = () => {
    c.removeAll(true);
    const ready = !loginStatus().claimed;
    // misma forma que PERSONAJE / TIENDA (MenuScene.sideButton): paralelogramo inclinado redondeado
    const k = 14 * (h / 136) + 4;
    const shape = roundedPoly([[-w / 2 + k, -h / 2], [w / 2, -h / 2], [w / 2 - k, h / 2], [-w / 2, h / 2]], 14);
    const line = ready ? GOLD : NEON;
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
    g.lineStyle(10, line, ready ? 0.3 : 0.22).strokePoints(shape, true, true);
    g.fillStyle(NAVY, 0.94).fillPoints(shape, true);
    g.fillStyle(0x1b2d5c, 0.55).fillPoints(shape.filter((p) => p.y < 0).map((p) => ({ x: p.x * 0.97, y: p.y * 0.96 })), true);
    g.lineStyle(3, line, 1).strokePoints(shape, true, true);
    g.lineStyle(2, 0xffffff, 0.22).lineBetween(-w / 2 + k + 12, -h / 2 + 4, w / 2 - 12, -h / 2 + 4);
    // icono arriba y texto abajo (como TIENDA)
    const ic = scene.add.graphics({ y: -h * 0.14 });
    drawGiftIcon(ic, Math.min(20, h * 0.24));
    if (!ready) ic.setAlpha(0.55);
    const t = scene.add.text(0, h / 2 - 15, 'DIARIO', { fontFamily: FONT, fontSize: '17px', color: ready ? '#ffd23f' : '#ffffff' }).setOrigin(0.5);
    c.add([g, ic, t]);
    if (ready) {
      const dot = scene.add.circle(w / 2 - 8, -h / 2 + 4, 9, GOLD).setStrokeStyle(3, NAVY);
      c.add(dot);
      scene.tweens.add({ targets: dot, scale: 1.3, duration: 420, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      scene.tweens.add({ targets: ic, angle: { from: -8, to: 8 }, duration: 260, yoyo: true, repeat: -1, repeatDelay: 1400 });
    }
  };
  draw();
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerup', () => {
    scene.tweens.add({ targets: c, scale: { from: 0.88, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    openDailyLogin(scene, () => draw(), onToast);
  });
  return c;
}

/** Panel diario de siete días, con premios destacados y progreso de racha. */
export function openDailyLogin(scene: Phaser.Scene, onChange: () => void, onToast: (m: string) => void) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const close = () => objs.forEach((o) => o.destroy());
  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.8).setOrigin(0).setDepth(8000).setInteractive();
  shade.on('pointerup', close);
  objs.push(shade);

  const st = loginStatus();
  const pw = Math.min(660, W - 28);
  const ph = Math.min(660, H - 48);
  const p = scene.add.container(W / 2, H / 2).setDepth(8001);
  objs.push(p);
  p.add(scene.add.rectangle(0, 0, pw, ph, 0, 0.001).setInteractive());
  const g = scene.add.graphics();
  g.lineStyle(18, 0x08cfff, 0.13).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 30);
  g.fillGradientStyle(0x102b78, 0x0a1a48, 0x08183d, 0x06122f, 1).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 30);
  g.fillStyle(0x173b9d, 0.22).fillRoundedRect(-pw / 2 + 9, -ph / 2 + 9, pw - 18, ph - 18, 24);
  g.lineStyle(5, 0x08caff, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 30);
  g.lineStyle(2, 0x95efff, 0.75).strokeRoundedRect(-pw / 2 + 8, -ph / 2 + 8, pw - 16, ph - 16, 24);
  p.add(g);
  if (scene.textures.exists('daily-title-art')) {
    const titleW = Math.min(450, pw - 124);
    p.add(scene.add.image(0, -ph / 2 + 56, 'daily-title-art').setDisplaySize(titleW, titleW / 3));
  }
  const subtitleY = -ph / 2 + 133;
  const subtitleLine = scene.add.graphics();
  subtitleLine.lineStyle(3, 0x08caff, 0.95).lineBetween(-pw / 2 + 42, subtitleY, -184, subtitleY);
  subtitleLine.lineBetween(184, subtitleY, pw / 2 - 42, subtitleY);
  p.add(subtitleLine);
  p.add(scene.add.text(0, subtitleY, 'Entra cada día: la racha sube el premio', { fontFamily: FONT, fontSize: '16px', color: '#e1ecff', stroke: '#061431', strokeThickness: 3 }).setOrigin(0.5));
  const closeBtn = scene.add.container(pw / 2 - 42, -ph / 2 + 42);
  const closeG = scene.add.graphics();
  closeG.fillStyle(0x590f27, 1).fillRoundedRect(-28, -25, 56, 50, 13);
  closeG.fillStyle(0xf3324a, 1).fillRoundedRect(-24, -29, 48, 48, 12);
  closeG.lineStyle(3, 0xffa3ad, 1).strokeRoundedRect(-24, -29, 48, 48, 12);
  closeG.lineStyle(6, 0xffffff, 1).beginPath().moveTo(-8, -13).lineTo(8, 3).moveTo(8, -13).lineTo(-8, 3).strokePath();
  closeBtn.add(closeG);
  closeBtn.setSize(58, 58).setInteractive({ useHandCursor: true }).on('pointerup', close);
  p.add(closeBtn);

  // Siete tarjetas: cuatro arriba y tres abajo.
  const n = LOGIN.rewards.length;
  const cw = (pw - 52 - 3 * 10) / 4;
  const chh = 106;
  LOGIN.rewards.forEach((r, i) => {
    const row = i < 4 ? 0 : 1;
    const col = row ? i - 4 : i;
    const cols = row ? 3 : 4;
    const cx = (col - (cols - 1) / 2) * (cw + 10);
    const cy = -ph / 2 + 238 + row * (chh + 15);
    const day = i + 1;
    const done = st.claimed ? day <= st.day : day < st.day;
    const today = day === st.day;
    const special = day === n;
    const box = scene.add.graphics();
    if (today) box.lineStyle(12, GOLD, 0.3).strokeRoundedRect(cx - cw / 2, cy - chh / 2, cw, chh, 18);
    box.fillStyle(done ? 0x0b3e2b : today ? 0x805208 : special ? 0x4b168b : 0x0b2867, 1).fillRoundedRect(cx - cw / 2, cy - chh / 2, cw, chh, 18);
    box.fillStyle(0xffffff, today ? 0.12 : 0.07).fillRoundedRect(cx - cw / 2 + 3, cy - chh / 2 + 3, cw - 6, 31, { tl: 15, tr: 15, bl: 4, br: 4 });
    box.lineStyle(today || special ? 4 : 3, today ? 0xffe451 : special ? 0xe58dff : done ? 0x39ea68 : 0x188fff, 1).strokeRoundedRect(cx - cw / 2, cy - chh / 2, cw, chh, 18);
    box.fillStyle(today ? GOLD : special ? 0x9e32ef : done ? 0x087448 : 0x123b82, 0.8).fillRoundedRect(cx - cw / 2 + 2, cy - chh / 2 + 2, cw - 4, 30, { tl: 15, tr: 15, bl: 5, br: 5 });
    p.add(box);
    const dayLabel = today ? `HOY · DÍA ${day}` : special ? '★  DÍA 7  ★' : `DÍA ${day}`;
    const dayTitle = scene.add.text(cx, cy - chh / 2 + 16, dayLabel, { fontFamily: FONT, fontSize: '18px', color: today || special ? '#fff4c4' : '#e0ebff' }).setOrigin(0.5).setLetterSpacing(1);
    if (dayTitle.width > cw - 12) dayTitle.setScale((cw - 12) / dayTitle.width);
    p.add(dayTitle);
    const coinY = r.cash ? cy + 1 : cy + 10;
    const ic = scene.add.graphics({ x: cx - 28, y: coinY });
    drawCoinIcon(ic, 13);
    p.add(ic);
    p.add(scene.add.text(cx - 9, coinY, r.coins.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '23px', color: '#ffe45c', stroke: '#392000', strokeThickness: 3 }).setOrigin(0, 0.5));
    if (r.cash) {
      const ci = scene.add.graphics({ x: cx - 24, y: cy + 34 });
      drawCashIcon(ci, 0.68);
      p.add(ci);
      p.add(scene.add.text(cx - 6, cy + 34, `${r.cash}`, { fontFamily: FONT, fontSize: '20px', color: '#9fffb5', stroke: '#064321', strokeThickness: 3 }).setOrigin(0, 0.5));
    }
    if (done) {
      const check = scene.add.graphics({ x: cx + cw / 2 - 17, y: cy - chh / 2 + 16 });
      check.fillStyle(0x061f18, 1).fillCircle(0, 0, 12).fillStyle(0x4bea6c, 1).fillCircle(0, 0, 9);
      check.lineStyle(2.5, 0xffffff, 1).beginPath().moveTo(-4, 0).lineTo(-1, 3).lineTo(5, -4).strokePath();
      p.add(check);
    }
  });

  // Progreso visual de la racha.
  const barY = ph / 2 - 168;
  const streak = st.claimed ? st.day : Math.max(0, st.day - 1);
  const track = scene.add.graphics();
  track.fillStyle(0x061431, 0.98).fillRoundedRect(-pw / 2 + 28, barY - 38, pw - 56, 76, 28);
  track.lineStyle(3, 0x087fff, 1).strokeRoundedRect(-pw / 2 + 28, barY - 38, pw - 56, 76, 28);
  p.add(track);
  const badgeX = -pw / 2 + 88;
  const badge = scene.add.graphics({ x: badgeX, y: barY });
  badge.fillStyle(0x171d36, 1).fillRoundedRect(-54, -29, 108, 58, 17);
  badge.lineStyle(2, GOLD, 1).strokeRoundedRect(-54, -29, 108, 58, 17);
  badge.fillStyle(0xff4b1f, 1).fillPoints([{ x: -38, y: 17 }, { x: -43, y: -3 }, { x: -31, y: 4 }, { x: -25, y: -20 }, { x: -12, y: 1 }, { x: -8, y: -13 }, { x: 1, y: 17 }], true);
  badge.fillStyle(0xffdc36, 1).fillPoints([{ x: -33, y: 16 }, { x: -35, y: 1 }, { x: -26, y: 7 }, { x: -22, y: -9 }, { x: -14, y: 5 }, { x: -12, y: 16 }], true);
  p.add(badge);
  p.add(scene.add.text(badgeX + 28, barY - 11, 'RACHA', { fontFamily: FONT, fontSize: '15px', color: '#ffd23f' }).setOrigin(0.5));
  p.add(scene.add.text(badgeX + 28, barY + 11, `${streak} ${streak === 1 ? 'DÍA' : 'DÍAS'}`, { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }).setOrigin(0.5));
  const firstX = -pw / 2 + 186;
  const lastX = pw / 2 - 48;
  const step = (lastX - firstX) / 6;
  track.lineStyle(8, 0x536c9c, 1).beginPath().moveTo(firstX, barY - 2).lineTo(lastX, barY - 2).strokePath();
  if (streak > 0) track.lineStyle(8, 0x48df74, 1).beginPath().moveTo(firstX, barY - 2).lineTo(firstX + Math.min(streak - 1, 6) * step, barY - 2).strokePath();
  for (let i = 0; i < n; i++) {
    const x = firstX + i * step;
    const completed = i < streak;
    const current = !st.claimed && i === st.day - 1;
    track.fillStyle(completed ? 0x31cf65 : current ? GOLD : 0x263b62, 1).fillCircle(x, barY - 2, current ? 13 : 11);
    track.lineStyle(3, completed || current ? 0xffffff : 0x7288b2, 1).strokeCircle(x, barY - 2, current ? 13 : 11);
    p.add(scene.add.text(x, barY + 23, `D${i + 1}`, { fontFamily: FONT, fontSize: '12px', color: current ? '#ffd23f' : completed ? '#b9ffd0' : '#8ea3ce' }).setOrigin(0.5));
    if (completed) p.add(scene.add.text(x, barY - 3, '✓', { fontFamily: FONT, fontSize: '15px', color: '#ffffff' }).setOrigin(0.5));
  }

  const by = ph / 2 - 67;
  if (st.claimed) {
    p.add(arcadeButton(scene, 0, by, 310, 72, 'VUELVE MAÑANA', close, { palette: 'blue' }));
  } else {
    let claimBtn!: Phaser.GameObjects.Container;
    claimBtn = arcadeButton(scene, 0, by, 330, 78, 'RECLAMAR', () => {
        const res = claimLogin();
        onChange();
        if (!res.given) return;
        onToast(`+${res.given.coins.toLocaleString('es-CL')} monedas${res.given.cash ? ` · +${res.given.cash} dinero` : ''}`);
        void showInterstitial('daily_reward');
        if (!canShowRewardedAds()) { close(); return; }
        claimBtn.destroy();
        let bonusBtn!: Phaser.GameObjects.Container;
        bonusBtn = arcadeButton(scene, 0, by, 360, 72, 'VER ANUNCIO · PREMIO x2', async () => {
          bonusBtn.disableInteractive();
          if (await showRewarded('daily_reward_bonus')) {
            const bonus = claimLoginRewardAdBonus();
            if (bonus.given) {
              onToast(`Bonus: +${bonus.given.coins.toLocaleString('es-CL')} monedas${bonus.given.cash ? ` · +${bonus.given.cash} dinero` : ''}`);
              bonusBtn.destroy();
            }
          } else {
            bonusBtn.setInteractive({ useHandCursor: true });
            onToast('Anuncio no disponible; conservas tu premio diario');
          }
        }, { palette: 'blue' });
        bonusBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
        bonusBtn.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
        p.add(bonusBtn);
      }, { palette: 'yellow' });
    claimBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    claimBtn.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
    p.add(claimBtn);
  }
  if (scene.textures.exists('daily-coins-art')) {
    p.add(scene.add.image(-pw / 2 + 82, ph / 2 - 61, 'daily-coins-art').setDisplaySize(88, 88));
  }
  if (scene.textures.exists('daily-cash-art')) {
    p.add(scene.add.image(pw / 2 - 82, ph / 2 - 61, 'daily-cash-art').setDisplaySize(120, 80));
  }
  p.setScale(0.9).setAlpha(0);
  scene.tweens.add({ targets: p, scale: 1, alpha: 1, duration: 280, ease: 'Back.easeOut' });
}
