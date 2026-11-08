import Phaser from 'phaser';
import { FONT } from './theme';
import { RankBadge, preloadRankBadges } from './RankBadge';
import { arcadeButton } from './modeButtons';
import { RANKS, RANK_UNLOCK_LEVEL, type RankId, isRankUnlocked } from '../domain/ranks';

/**
 * Diálogo RANGOS: los 6 rangos competitivos en orden (insignia + nombre), con el rango actual
 * marcado. Con nivel < RANK_UNLOCK_LEVEL es informativo ("Se desbloquea en nivel 20").
 * Carga las insignias que falten al abrirse (~1,2 MB c/u). Se cierra con CERRAR o tocando fuera.
 */
export interface RankListOpts {
  current: RankId;
  level: number;
  /** posición mundial si es Challenger */
  position?: number;
  depth?: number;
  onClose?: () => void;
}

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
const GOLD = 0xffc42e;

export function showRankList(scene: Phaser.Scene, o: RankListOpts) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const depth = o.depth ?? 9000;
  const unlocked = isRankUnlocked(o.level);
  const objs: Phaser.GameObjects.GameObject[] = [];
  const close = () => {
    objs.forEach((g) => g.destroy());
    objs.length = 0;
    o.onClose?.();
  };

  // velo (tocar fuera cierra)
  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.75).setOrigin(0).setScrollFactor(0).setDepth(depth).setInteractive();
  shade.on('pointerdown', close);
  shade.setAlpha(0);
  scene.tweens.add({ targets: shade, alpha: 1, duration: 160 });
  objs.push(shade);

  // ---------------------------------------------------------------- panel
  const cols = 2;
  const rows = Math.ceil(RANKS.length / cols);
  const pw = Math.min(660, W - 36);
  const gap = 16;
  const cw = (pw - 48 - gap) / cols;
  const ch = 196;
  const headH = unlocked ? 104 : 150;
  const footH = 120;
  const ph = headH + rows * ch + (rows - 1) * gap + footH;
  const cy = H / 2;
  const top = cy - ph / 2;

  const panel = scene.add.container(W / 2, cy).setScrollFactor(0).setDepth(depth + 1);
  // el panel absorbe los toques (que no cierre al tocar dentro)
  panel.add(scene.add.rectangle(0, 0, pw, ph, 0x000000, 0.001).setInteractive());
  const g = scene.add.graphics();
  const x = -pw / 2;
  const y = -ph / 2;
  g.fillStyle(0x000000, 0.45).fillRoundedRect(x + 4, y + 8, pw, ph, 26);
  g.lineStyle(12, NEON, 0.22).strokeRoundedRect(x, y, pw, ph, 26);
  g.fillStyle(0x0a1638, 1).fillRoundedRect(x - 4, y - 4, pw + 8, ph + 8, 29);
  g.fillStyle(NAVY, 0.97).fillRoundedRect(x, y, pw, ph, 26);
  g.fillStyle(0x1b2d5c, 0.55).fillRoundedRect(x + 4, y + 4, pw - 8, 84, { tl: 22, tr: 22, bl: 0, br: 0 });
  g.lineStyle(3, NEON, 1).strokeRoundedRect(x, y, pw, ph, 26);
  g.lineStyle(1.5, GOLD, 0.45).strokeRoundedRect(x + 8, y + 8, pw - 16, ph - 16, 20);
  panel.add(g);
  panel.add(
    scene.add.text(0, y + 46, 'RANGOS', { fontFamily: FONT, fontSize: '44px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(4),
  );
  if (!unlocked) {
    // aviso de desbloqueo (píldora con candado)
    const msg = `SE DESBLOQUEA EN NIVEL ${RANK_UNLOCK_LEVEL}`;
    const t = scene.add.text(14, y + 112, msg, { fontFamily: FONT, fontSize: '20px', color: '#ffd76a' }).setOrigin(0.5).setLetterSpacing(1);
    const pwid = t.width + 76;
    const pill = scene.add.graphics();
    pill.fillStyle(0x0a1638, 1).fillRoundedRect(-pwid / 2, y + 92, pwid, 40, 20);
    pill.lineStyle(2, GOLD, 0.9).strokeRoundedRect(-pwid / 2, y + 92, pwid, 40, 20);
    const lx = -pwid / 2 + 26;
    pill.lineStyle(3, 0xffd76a).beginPath().arc(lx, y + 108, 6, Math.PI, 0).strokePath();
    pill.fillStyle(0xffd76a).fillRoundedRect(lx - 9, y + 108, 18, 14, 3);
    panel.add([pill, t]);
  }
  panel.setScale(0.75).setAlpha(0);
  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 260, ease: 'Back.easeOut' });
  objs.push(panel);

  // ---------------------------------------------------------------- tarjetas (se llenan al tener las imágenes)
  const loading = scene.add.text(W / 2, cy, 'CARGANDO...', { fontFamily: FONT, fontSize: '24px', color: '#9fc0ff' }).setOrigin(0.5).setScrollFactor(0).setDepth(depth + 2);
  objs.push(loading);

  const buildCards = () => {
    if (!panel.active) return;
    loading.destroy();
    RANKS.forEach((r, i) => {
      const cx = x + 24 + (i % cols) * (cw + gap);
      const cyy = y + headH + Math.floor(i / cols) * (ch + gap);
      const isMe = unlocked && r.id === o.current;
      const card = scene.add.graphics();
      card.fillStyle(0x000000, 0.3).fillRoundedRect(cx + 2, cyy + 4, cw, ch, 18);
      card.fillStyle(isMe ? 0x1b2d5c : 0x0f1d40, 1).fillRoundedRect(cx, cyy, cw, ch, 18);
      card.lineStyle(isMe ? 4 : 2, isMe ? GOLD : 0x2c4a8a, 1).strokeRoundedRect(cx, cyy, cw, ch, 18);
      panel.add(card);
      // insignia a color (informativa)
      panel.add(
        new RankBadge(scene, cx + cw / 2, cyy + 78, {
          rank: r.id,
          level: RANK_UNLOCK_LEVEL,
          locked: false,
          size: 128,
          position: isMe ? o.position : undefined,
        }),
      );
      panel.add(scene.add.text(cx + cw / 2, cyy + 156, r.name.toUpperCase(), { fontFamily: FONT, fontSize: '24px', color: '#ffffff' }).setOrigin(0.5));
      const sub = r.topOnly ? `TOP ${r.topOnly} MUNDIAL` : `RANGO ${r.tier}`;
      panel.add(scene.add.text(cx + cw / 2, cyy + 180, sub, { fontFamily: FONT, fontSize: '14px', color: r.topOnly ? '#ffd76a' : '#7f93bf' }).setOrigin(0.5).setLetterSpacing(1));
      if (isMe) {
        const tag = scene.add.graphics();
        tag.fillStyle(GOLD, 1).fillRoundedRect(cx + cw / 2 - 52, cyy - 12, 104, 26, 13);
        panel.add(tag);
        panel.add(scene.add.text(cx + cw / 2, cyy + 1, 'TU RANGO', { fontFamily: FONT, fontSize: '15px', color: '#0a1638' }).setOrigin(0.5));
      }
    });
  };

  const missing = RANKS.filter((r) => r.image && !scene.textures.exists(`rank-${r.id}`));
  if (missing.length === 0) buildCards();
  else {
    preloadRankBadges(scene.load);
    scene.load.once(Phaser.Loader.Events.COMPLETE, buildCards);
    scene.load.start();
  }

  // ---------------------------------------------------------------- cerrar
  const btn = arcadeButton(scene, W / 2, top + ph - footH / 2, Math.min(300, pw - 80), 78, 'CERRAR', close, { palette: 'yellow' })
    .setScrollFactor(0)
    .setDepth(depth + 3);
  objs.push(btn);
  return close;
}
