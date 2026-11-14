import Phaser from 'phaser';
import { FONT } from './theme';
import { roundedPoly } from './shapes';
import { arcadeButton } from './modeButtons';
import { drawCoinIcon, drawGiftIcon } from './wheelArt';
import { drawCashIcon } from '../scenes/BattlePassScene';
import { LOGIN, type LoginReward } from '../domain/dailyLogin';
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

/** Panel diario: los siete días de la semana en curso (lunes a domingo), con su fecha y su premio. */
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
  p.add(scene.add.text(0, subtitleY, 'Un premio por cada día de la semana', { fontFamily: FONT, fontSize: '16px', color: '#e1ecff', stroke: '#061431', strokeThickness: 3 }).setOrigin(0.5));
  const closeBtn = scene.add.container(pw / 2 - 42, -ph / 2 + 42);
  const closeG = scene.add.graphics();
  closeG.fillStyle(0x590f27, 1).fillRoundedRect(-28, -25, 56, 50, 13);
  closeG.fillStyle(0xf3324a, 1).fillRoundedRect(-24, -29, 48, 48, 12);
  closeG.lineStyle(3, 0xffa3ad, 1).strokeRoundedRect(-24, -29, 48, 48, 12);
  closeG.lineStyle(6, 0xffffff, 1).beginPath().moveTo(-8, -13).lineTo(8, 3).moveTo(8, -13).lineTo(-8, 3).strokePath();
  closeBtn.add(closeG);
  closeBtn.setSize(58, 58).setInteractive({ useHandCursor: true }).on('pointerup', close);
  p.add(closeBtn);

  // Los 7 días de la semana en curso (lunes a domingo) en dos filas (4 + 3), al estilo Brawl Stars: cabecera con el día y
  // su fecha, el premio grande al centro y el estado (HOY, reclamado, perdido o por venir). El domingo es el premio mayor.
  const n = LOGIN.rewards.length;
  const showTestDay = import.meta.env.DEV; // 8.ª tarjeta de prueba, solo en desarrollo
  const WD = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM'];
  const loops: Phaser.Tweens.Tween[] = [];
  const cw = (pw - 52 - 3 * 12) / 4;
  const chh = 156;
  const rowY = (row: number) => -ph / 2 + 160 + chh / 2 + row * (chh + 16);
  // reclamar el premio de HOY: lo usan el botón RECLAMAR y la tarjeta de hoy (tocar el premio también lo reclama)
  let doClaim: (() => void) | null = null;
  LOGIN.rewards.forEach((r, i) => {
    const row = i < 4 ? 0 : 1;
    const col = row ? i - 4 : i;
    const cols = row ? (showTestDay ? 4 : 3) : 4;
    const cx = (col - (cols - 1) / 2) * (cw + 12);
    const cy = rowY(row);
    const date = st.week.days[i].date;
    const done = st.claimedDays.includes(i);
    const today = i === st.week.index;
    const missed = !done && i < st.week.index;
    const special = i === n - 1;
    const top = cy - chh / 2;
    // colores: hoy dorado, domingo morado, el resto azul
    const [fillTop, fillBot, line] = today ? [0xffc23a, 0xe0820c, 0xfff1a8] : special ? [0xb156ff, 0x6a1fc4, 0xe9b8ff] : [0x4aa3ff, 0x1d5fd0, 0x9fd2ff];
    if (today && !done) {
      const glow = scene.add.graphics();
      glow.lineStyle(14, GOLD, 0.45).strokeRoundedRect(cx - cw / 2, top, cw, chh, 16);
      p.add(glow);
      loops.push(scene.tweens.add({ targets: glow, alpha: { from: 0.35, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    }
    const box = scene.add.graphics();
    box.fillStyle(0x000000, 0.35).fillRoundedRect(cx - cw / 2 + 3, top + 5, cw, chh, 16);
    box.fillStyle(0x0a1638, 1).fillRoundedRect(cx - cw / 2 - 3, top - 3, cw + 6, chh + 6, 18);
    box.fillStyle(fillBot, 1).fillRoundedRect(cx - cw / 2, top, cw, chh, 16);
    box.fillStyle(fillTop, 1).fillRoundedRect(cx - cw / 2, top, cw, chh * 0.6, { tl: 16, tr: 16, bl: 8, br: 8 });
    box.fillStyle(0xffffff, 0.18).fillRoundedRect(cx - cw / 2 + 4, top + 4, cw - 8, chh * 0.22, { tl: 13, tr: 13, bl: 6, br: 6 });
    box.lineStyle(2, line, 0.9).strokeRoundedRect(cx - cw / 2, top, cw, chh, 16);
    // cabecera: día y fecha del mes
    box.fillStyle(0x0a1638, 0.55).fillRoundedRect(cx - cw / 2 + 6, top + 6, cw - 12, 30, 10);
    p.add(box);
    const head = scene.add.text(cx, top + 21, today ? `HOY · ${date}` : `${WD[i]} ${date}`, { fontFamily: FONT, fontSize: '18px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
    if (head.width > cw - 18) head.setScale((cw - 18) / head.width);
    p.add(head);
    if (special) p.add(scene.add.text(cx + cw / 2 - 14, top + 50, '★', { fontFamily: FONT, fontSize: '22px', color: '#fff1a8', stroke: '#3a0a6a', strokeThickness: 4 }).setOrigin(0.5));

    // premio: moneda grande + cantidad; con dinero, una segunda línea con los billetes
    const iy = r.cash ? cy - 12 : cy;
    const coin = scene.add.graphics({ x: cx, y: iy });
    drawCoinIcon(coin, 24);
    p.add(coin);
    const amt = scene.add.text(cx, cy + (r.cash ? 30 : 38), r.coins.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5);
    if (amt.width > cw - 14) amt.setScale((cw - 14) / amt.width);
    p.add(amt);
    if (r.cash) {
      const ci = scene.add.graphics({ x: cx - 16, y: cy + 56 });
      drawCashIcon(ci, 0.62);
      p.add(ci);
      p.add(scene.add.text(cx + 2, cy + 56, `+${r.cash}`, { fontFamily: FONT, fontSize: '20px', color: '#b6ffc8', stroke: '#0a3a18', strokeThickness: 4 }).setOrigin(0, 0.5));
    }

    if (done) {
      // reclamado: velo y un check grande
      p.add(scene.add.rectangle(cx, cy, cw, chh, 0x02060f, 0.45));
      const check = scene.add.graphics({ x: cx, y: cy + 6 });
      check.fillStyle(0x0a3a18, 1).fillCircle(0, 0, 30).fillStyle(0x35c85a, 1).fillCircle(0, 0, 25);
      check.lineStyle(6, 0xffffff, 1).beginPath().moveTo(-11, 0).lineTo(-3, 9).lineTo(12, -9).strokePath();
      p.add(check);
    } else if (missed) {
      // día pasado sin reclamar: perdido
      p.add(scene.add.rectangle(cx, cy, cw, chh, 0x10131c, 0.68));
      const lost = scene.add.text(cx, cy + 6, 'PERDIDO', { fontFamily: FONT, fontSize: '18px', color: '#9aa6c2', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setAngle(-12);
      if (lost.width > cw - 16) lost.setScale((cw - 16) / lost.width);
      p.add(lost);
    } else if (today) {
      loops.push(scene.tweens.add({ targets: coin, scale: { from: 1, to: 1.12 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
      // tocar la tarjeta de hoy = RECLAMAR (igual que el botón)
      const hit = scene.add.rectangle(cx, cy, cw, chh, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => e.stopPropagation());
      hit.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) => {
        e.stopPropagation();
        doClaim?.();
      });
      p.add(hit);
    }
  });
  // las animaciones de las tarjetas se paran al cerrar
  objs.push({ destroy: () => loops.forEach((t) => t.remove()) } as unknown as Phaser.GameObjects.GameObject);

  if (showTestDay) {
    const testReward: LoginReward = { coins: 250, cash: 5 };
    const cx = 1.5 * (cw + 12);
    const cy = rowY(1);
    const box = scene.add.graphics();
    box.fillStyle(0x073e59, 1).fillRoundedRect(cx - cw / 2, cy - chh / 2, cw, chh, 16);
    box.lineStyle(4, 0x45e7ff, 1).strokeRoundedRect(cx - cw / 2, cy - chh / 2, cw, chh, 16);
    p.add(box);
    p.add(scene.add.text(cx, cy - chh / 2 + 21, 'DÍA TEST', { fontFamily: FONT, fontSize: '18px', color: '#d8fbff' }).setOrigin(0.5).setLetterSpacing(1));
    const testCoin = scene.add.graphics({ x: cx, y: cy - 8 });
    drawCoinIcon(testCoin, 22);
    p.add(testCoin);
    p.add(scene.add.text(cx, cy + 40, `${testReward.coins}`, { fontFamily: FONT, fontSize: '26px', color: '#ffe45c', stroke: '#053044', strokeThickness: 5 }).setOrigin(0.5));
    const hit = scene.add.rectangle(cx, cy, cw, chh, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
      event.stopPropagation();
      let preview!: Phaser.GameObjects.Container;
      preview = showDailyRewardReveal(scene, 'TEST', testReward, () => preview.destroy(), async (animateDouble) => {
        // Vista local de desarrollo: simula completar el anuncio, sin acreditar monedas ni dinero.
        animateDouble();
        return true;
      }, true);
      objs.push(preview);
    });
    p.add(hit);
  }

  // semana: cuántos días se reclamaron y cuándo se reinicia
  const infoY = ph / 2 - 142;
  const got = st.claimedDays.length;
  p.add(scene.add.text(0, infoY, `${got}/${n} DÍAS RECLAMADOS  ·  NUEVA SEMANA EL LUNES`, { fontFamily: FONT, fontSize: '16px', color: '#cfe0ff', stroke: '#061431', strokeThickness: 3 }).setOrigin(0.5).setLetterSpacing(1));

  const by = ph / 2 - 67;
  if (st.claimed) {
    p.add(arcadeButton(scene, 0, by, 310, 72, 'VUELVE MAÑANA', close, { palette: 'blue' }));
  } else {
    let claimBtn!: Phaser.GameObjects.Container;
    let claimed = false;
    doClaim = () => {
        if (claimed) return; // una sola vez (botón o tarjeta)
        claimed = true;
        const res = claimLogin();
        onChange();
        if (!res.given) return;
        claimBtn.destroy();
        objs.push(showDailyRewardReveal(scene, res.day, res.given, () => {
          void showInterstitial('daily_reward');
          close();
        }, async (animateDouble) => {
          const watched = await showRewarded('daily_reward_bonus');
          // Sin anuncio: el aviso sale dentro de la pantalla del premio (showDailyRewardReveal).
          if (!watched) return false;
          const bonus = claimLoginRewardAdBonus();
          if (!bonus.given) return false;
          animateDouble();
          return true;
        }));
      };
    claimBtn = arcadeButton(scene, 0, by, 330, 78, 'RECLAMAR', () => doClaim?.(), { palette: 'yellow' });
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

/** Presentación de premio diario con el mismo destello, rebote, conteo y explosión de la ruleta. */
function showDailyRewardReveal(
  scene: Phaser.Scene,
  day: number | string,
  reward: LoginReward,
  onContinue: () => void,
  onDouble: (animateDouble: () => void) => Promise<boolean>,
  testMode = false,
) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setScrollFactor(0).setDepth(8100);
  // Fondo de pantalla completa, igual al de resultado de la ruleta: oculta el Diario y da foco al premio.
  const bgKey = `daily-reward-bg-${W}x${H}`;
  if (!scene.textures.exists(bgKey)) {
    const tex = scene.textures.createCanvas(bgKey, W, H);
    if (tex) {
      const ctx = tex.getContext();
      const glow = ctx.createRadialGradient(W / 2, H * 0.43, 10, W / 2, H * 0.43, Math.max(W, H) * 0.78);
      glow.addColorStop(0, '#2f5fd6');
      glow.addColorStop(0.32, '#16398f');
      glow.addColorStop(0.68, '#0b1733');
      glow.addColorStop(1, '#03070f');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, W, H);
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
      tex.refresh();
    }
  }
  if (scene.textures.exists(bgKey)) root.add(scene.add.image(0, 0, bgKey).setOrigin(0));
  else root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x0b1733, 1));
  const continueZone = scene.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
  root.add(continueZone);

  const rays = scene.add.graphics({ x: W / 2, y: H * 0.43 });
  const rayLength = Math.max(W, H);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    rays.fillStyle(i % 2 ? 0x3a7bff : 0xffc42e, 0.1).slice(0, 0, rayLength, a, a + Math.PI / 18, false).fillPath();
  }
  rays.setAlpha(0);
  root.add(rays);
  scene.tweens.add({ targets: rays, alpha: 1, duration: 500 });
  scene.tweens.add({ targets: rays, angle: 360, duration: 40_000, repeat: -1 });
  for (let i = 0; i < 22; i++) {
    const size = Phaser.Math.FloatBetween(3, 7);
    const star = scene.add.star(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 4, size * 0.4, size, Phaser.Utils.Array.GetRandom([0xffe9a0, 0xbfe0ff, 0xffffff]), 0.8).setBlendMode(Phaser.BlendModes.ADD);
    root.add(star);
    scene.tweens.add({ targets: star, y: star.y - Phaser.Math.Between(120, 360), alpha: { from: 0.15, to: 0.9 }, angle: 180, duration: Phaser.Math.Between(2600, 5200), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2500), ease: 'Sine.easeInOut' });
  }

  const title = scene.add.text(W / 2, H * 0.25, '¡PREMIO DIARIO!', { fontFamily: FONT, fontSize: '48px', color: '#ffffff', stroke: '#061431', strokeThickness: 9 }).setOrigin(0.5).setLetterSpacing(2);
  if (title.width > W - 40) title.setScale((W - 40) / title.width);
  root.add(title);
  const subtitle = scene.add.text(W / 2, H * 0.30, testMode ? 'DÍA TEST · NO ALTERA TU RACHA' : `DÍA ${day} · ¡RECOMPENSA CONSEGUIDA!`, { fontFamily: FONT, fontSize: '20px', color: testMode ? '#a9f7ff' : '#ffe45c', stroke: '#061431', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(1);
  if (subtitle.width > W - 48) subtitle.setScale((W - 48) / subtitle.width);
  root.add(subtitle);

  // Cada premio se presenta en su propia tarjeta, siguiendo la referencia visual.
  const hasCash = reward.cash > 0;
  const gap = 14;
  const cardW = hasCash ? Math.min(250, (W - 40 - gap) / 2) : Math.min(280, W - 48);
  const cardH = Math.min(330, H * 0.32);
  const cardY = H * 0.51;
  const centers = hasCash
    ? [W / 2 - (cardW + gap) / 2, W / 2 + (cardW + gap) / 2]
    : [W / 2];
  const makeRewardCard = (x: number, kind: 'coins' | 'cash', value: number, delay: number) => {
    const top = cardY - cardH / 2;
    const g = scene.add.graphics();
    g.fillStyle(0x061b4c, 0.98).fillRoundedRect(x - cardW / 2, top, cardW, cardH, 27);
    g.fillStyle(0x0b3b91, 0.55).fillRoundedRect(x - cardW / 2 + 6, top + 6, cardW - 12, cardH - 12, 23);
    g.lineStyle(8, 0x087aff, 0.38).strokeRoundedRect(x - cardW / 2, top, cardW, cardH, 27);
    g.lineStyle(4, 0x4ad9ff, 1).strokeRoundedRect(x - cardW / 2 + 3, top + 3, cardW - 6, cardH - 6, 24);
    g.lineStyle(2, 0xffdb55, 0.95).strokeRoundedRect(x - cardW / 2 + 10, top + 10, cardW - 20, cardH - 20, 19);
    root.add(g);

    // Pequeños destellos alrededor del arte, como en la referencia.
    for (let i = 0; i < 4; i++) {
      const sx = x + (i % 2 === 0 ? -1 : 1) * cardW * (0.34 + (i % 2) * 0.08);
      const sy = top + cardH * (0.22 + Math.floor(i / 2) * 0.22);
      const sparkle = scene.add.star(sx, sy, 4, 3, 8, 0xffed99, 0.95).setBlendMode(Phaser.BlendModes.ADD);
      root.add(sparkle);
      scene.tweens.add({ targets: sparkle, alpha: 0.2, scale: 0.55, duration: 650 + i * 70, yoyo: true, repeat: -1, delay: i * 90 });
    }

    const artY = top + cardH * 0.39;
    let art: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
    if (kind === 'coins' && scene.textures.exists('daily-coins-art')) {
      art = scene.add.image(x, artY, 'daily-coins-art').setDisplaySize(cardW * 0.78, cardH * 0.49);
    } else if (kind === 'cash' && scene.textures.exists('daily-cash-art')) {
      art = scene.add.image(x, artY, 'daily-cash-art').setDisplaySize(cardW * 0.82, cardH * 0.43);
    } else {
      art = scene.add.graphics({ x, y: artY });
      if (kind === 'coins') drawCoinIcon(art, Math.min(43, cardW * 0.21));
      else drawCashIcon(art, Math.min(1, cardW / 220));
    }
    root.add(art);
    const artScale = { x: art.scaleX, y: art.scaleY };
    art.setAlpha(0).setScale(artScale.x * 0.3, artScale.y * 0.3);
    scene.tweens.add({ targets: art, alpha: 1, scaleX: artScale.x, scaleY: artScale.y, delay, duration: 520, ease: 'Back.easeOut' });

    const plateY = top + cardH * 0.73;
    const plate = scene.add.graphics();
    plate.fillStyle(0x472600, 1).fillRoundedRect(x - cardW * 0.44, plateY - 26, cardW * 0.88, 56, 18);
    plate.fillStyle(0xffb900, 1).fillRoundedRect(x - cardW * 0.44 + 3, plateY - 29, cardW * 0.88 - 6, 50, 16);
    plate.lineStyle(3, 0xffed74, 1).strokeRoundedRect(x - cardW * 0.44 + 3, plateY - 29, cardW * 0.88 - 6, 50, 16);
    root.add(plate);
    const amount = scene.add.text(x, plateY - 2, '+0', { fontFamily: FONT, fontSize: `${Math.round(Math.min(48, cardW * 0.22))}px`, color: '#ffffff', stroke: '#09275b', strokeThickness: 7 }).setOrigin(0.5).setAlpha(0);
    const label = scene.add.text(x, top + cardH * 0.875, kind === 'coins' ? 'MONEDAS' : 'DINERO', { fontFamily: FONT, fontSize: `${Math.round(Math.min(20, cardW * 0.09))}px`, color: '#ffffff', stroke: '#061431', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1).setAlpha(0);
    root.add([amount, label]);
    scene.tweens.add({ targets: [plate, amount, label], alpha: 1, delay: delay + 250, duration: 260 });
    const state = { value: 0 };
    scene.tweens.add({ targets: state, value, delay: delay + 280, duration: 820, ease: 'Cubic.easeOut', onUpdate: () => amount.setText(`+${Math.round(state.value).toLocaleString('es-CL')}`) });
    return amount;
  };
  const coinX = centers[0];
  const cashX = hasCash ? centers[1] : W / 2;
  const coinsValue = makeRewardCard(coinX, 'coins', reward.coins, 120);
  const cashValue = hasCash ? makeRewardCard(cashX, 'cash', reward.cash, 240) : undefined;
  const count = (text: Phaser.GameObjects.Text, from: number, to: number, delay = 0) => {
    const state = { value: from };
    text.setText(`+${from.toLocaleString('es-CL')}`);
    scene.tweens.add({ targets: state, value: to, delay, duration: 820, ease: 'Cubic.easeOut', onUpdate: () => text.setText(`+${Math.round(state.value).toLocaleString('es-CL')}`) });
  };
  scene.cameras.main.flash(220, 255, 235, 170);
  scene.cameras.main.shake(180, 0.006);
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2;
    const dist = Phaser.Math.Between(90, 210);
    const star = scene.add.star(W / 2 + Math.cos(a) * 24, cardY + Math.sin(a) * 24, 5, 5, 12, Phaser.Utils.Array.GetRandom([0xffd23f, 0xfff1b8, 0xffffff, 0x6fd0ff])).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    root.add(star);
    scene.tweens.add({ targets: star, x: W / 2 + Math.cos(a) * dist, y: cardY + Math.sin(a) * dist, angle: 360, alpha: 0, scale: 0.35, delay: 120, duration: 700, ease: 'Cubic.easeOut', onStart: () => star.setAlpha(1), onComplete: () => star.destroy() });
  }

  let busy = false;
  let canContinue = false;
  let noAdText: Phaser.GameObjects.Text | undefined;
  const prompt = scene.add.text(W / 2, H * 0.9, 'TOCA PARA CONTINUAR', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setLetterSpacing(2).setAlpha(0);
  if (prompt.width > W - 40) prompt.setScale((W - 40) / prompt.width);
  root.add(prompt);
  scene.time.delayedCall(1450, () => {
    if (!root.active) return;
    canContinue = true;
    scene.tweens.add({ targets: prompt, alpha: 1, duration: 280, onComplete: () => scene.tweens.add({ targets: prompt, alpha: 0.45, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
  });
  continueZone.on('pointerup', () => { if (canContinue && !busy) onContinue(); });

  // `busy` = anuncio EN CURSO (no se puede salir mientras tanto); `doubled` = el x2 ya se usó (no se repite)
  let doubled = false;
  const bonusBtn = arcadeButton(scene, W / 2, H * 0.8, Math.min(300, W - 80), 82, 'x2', async () => {
    if (busy || doubled) return;
    busy = true;
    bonusBtn.disableInteractive();
    try {
      const earned = await onDouble(() => {
        count(coinsValue, reward.coins, reward.coins * 2);
        if (cashValue) count(cashValue, reward.cash, reward.cash * 2, 120);
        const status = scene.add.text(W / 2, H * 0.68, testMode ? 'VISTA TEST · x2 SIMULADO' : '¡RECOMPENSA x2!', { fontFamily: FONT, fontSize: '22px', color: '#8dffad', stroke: '#061431', strokeThickness: 5 }).setOrigin(0.5).setScale(0.6).setAlpha(0);
        root.add(status);
        scene.tweens.add({ targets: status, alpha: 1, scale: 1, duration: 360, ease: 'Back.easeOut' });
        const buttonLabel = bonusBtn.getData('label') as Phaser.GameObjects.Text | undefined;
        buttonLabel?.setText('x2 ✓');
      });
      if (earned) {
        // premio doblado: el botón queda como "x2 ✓" y ya se puede salir (antes `busy` quedaba en true y "TOCA PARA
        // CONTINUAR" no respondía nunca)
        doubled = true;
        busy = false;
        return;
      }
    } catch {
      // Si el anuncio falla, el premio base queda intacto y se permite reintentar.
    }
    // Aviso dentro de esta pantalla (el toast del menú queda tapado por el fondo del premio).
    if (root.active) {
      noAdText?.destroy();
      noAdText = scene.add.text(W / 2, H * 0.68, 'ANUNCIO NO DISPONIBLE · INTÉNTALO MÁS TARDE', { fontFamily: FONT, fontSize: '18px', color: '#ffb3a8', stroke: '#061431', strokeThickness: 5 }).setOrigin(0.5).setAlpha(0);
      if (noAdText.width > W - 40) noAdText.setScale((W - 40) / noAdText.width);
      root.add(noAdText);
      scene.tweens.add({ targets: noAdText, alpha: 1, duration: 220, hold: 2200, yoyo: true, onComplete: () => noAdText?.destroy() });
    }
    busy = false;
    bonusBtn.setInteractive({ useHandCursor: true });
  }, { palette: 'blue' });
  const adLabel = bonusBtn.getData('label') as Phaser.GameObjects.Text | undefined;
  if (adLabel) adLabel.x = -18;
  const videoIcon = scene.add.graphics({ x: 38, y: 0 });
  videoIcon.fillStyle(0x0a1638, 1).fillRoundedRect(-16, -12, 32, 24, 5);
  videoIcon.fillStyle(0xffffff, 1).fillPoints([{ x: -4, y: -7 }, { x: 8, y: 0 }, { x: -4, y: 7 }], true);
  bonusBtn.add(videoIcon);
  bonusBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
  bonusBtn.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => event.stopPropagation());
  root.add(bonusBtn);
  // Sin anuncios (web / sin AdMob) no se ofrece el x2; la vista TEST lo muestra siempre.
  if (!testMode && !canShowRewardedAds()) bonusBtn.setVisible(false).disableInteractive();
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 260 });
  return root;
}
