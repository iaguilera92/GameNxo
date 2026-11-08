import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { arcadeButton } from './modeButtons';
import { drawCoinIcon, drawGiftIcon } from './wheelArt';
import { drawCashIcon } from '../scenes/BattlePassScene';
import { LOGIN } from '../domain/dailyLogin';
import { claimLogin, loginStatus } from '../logic/Ranked';

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

/** Panel de la racha de 7 días con el botón RECLAMAR. */
export function openDailyLogin(scene: Phaser.Scene, onChange: () => void, onToast: (m: string) => void) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const close = () => objs.forEach((o) => o.destroy());
  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.72).setOrigin(0).setDepth(8000).setInteractive();
  shade.on('pointerup', close);
  objs.push(shade);

  const st = loginStatus();
  const pw = Math.min(640, W - 40);
  const ph = 470;
  const p = scene.add.container(W / 2, H / 2).setDepth(8001);
  objs.push(p);
  p.add(scene.add.rectangle(0, 0, pw, ph, 0, 0.001).setInteractive());
  const g = scene.add.graphics();
  g.lineStyle(10, GOLD, 0.25).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  g.fillStyle(NAVY, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  g.lineStyle(3, GOLD, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  p.add(g);
  p.add(scene.add.text(0, -ph / 2 + 44, 'PREMIO DIARIO', { fontFamily: FONT, fontSize: '36px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  p.add(scene.add.text(0, -ph / 2 + 84, 'Entra cada día: la racha sube el premio', { fontFamily: FONT, fontSize: '18px', color: '#9fb4e0' }).setOrigin(0.5));

  // 7 casillas (4 arriba, 3 abajo)
  const n = LOGIN.rewards.length;
  const cw = (pw - 40 - 3 * 10) / 4;
  const chh = 112;
  LOGIN.rewards.forEach((r, i) => {
    const row = i < 4 ? 0 : 1;
    const col = row ? i - 4 : i;
    const cols = row ? 3 : 4;
    const cx = (col - (cols - 1) / 2) * (cw + 10);
    const cy = -ph / 2 + 170 + row * (chh + 12);
    const day = i + 1;
    const done = st.claimed ? day <= st.day : day < st.day;
    const today = day === st.day;
    const box = scene.add.graphics();
    box.fillStyle(done ? 0x173a26 : today ? 0x3a2a08 : 0x14224a, 1).fillRoundedRect(cx - cw / 2, cy - chh / 2, cw, chh, 14);
    box.lineStyle(today ? 3 : 2, today ? GOLD : done ? 0x62d935 : 0x2c4a8a, 1).strokeRoundedRect(cx - cw / 2, cy - chh / 2, cw, chh, 14);
    p.add(box);
    p.add(scene.add.text(cx, cy - chh / 2 + 16, day === n ? 'DÍA 7 ★' : `DÍA ${day}`, { fontFamily: FONT, fontSize: '15px', color: today ? '#ffd23f' : '#9fb4e0' }).setOrigin(0.5));
    const ic = scene.add.graphics({ x: cx - 30, y: cy + 4 });
    drawCoinIcon(ic, 11);
    p.add(ic);
    p.add(scene.add.text(cx - 14, cy + 4, r.coins.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '20px', color: '#ffd23f' }).setOrigin(0, 0.5));
    if (r.cash) {
      const ci = scene.add.graphics({ x: cx - 26, y: cy + 32 });
      drawCashIcon(ci, 0.55);
      p.add(ci);
      p.add(scene.add.text(cx - 10, cy + 32, `${r.cash}`, { fontFamily: FONT, fontSize: '18px', color: '#9fe8a0' }).setOrigin(0, 0.5));
    }
    if (done) p.add(scene.add.text(cx + cw / 2 - 16, cy - chh / 2 + 16, '✓', { fontFamily: FONT, fontSize: '20px', color: '#62d935' }).setOrigin(0.5));
  });

  const by = ph / 2 - 56;
  if (st.claimed) {
    p.add(scene.add.text(0, by - 4, '¡Vuelve mañana por el siguiente!', { fontFamily: FONT, fontSize: '22px', color: '#9aa6c4' }).setOrigin(0.5));
  } else {
    p.add(
      arcadeButton(scene, 0, by, 280, 76, 'RECLAMAR', () => {
        const res = claimLogin();
        close();
        onChange();
        if (res.given) onToast(`+${res.given.coins.toLocaleString('es-CL')} monedas${res.given.cash ? ` · +${res.given.cash} dinero` : ''}`);
      }, { palette: 'yellow' }),
    );
  }
  p.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: p, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
}
