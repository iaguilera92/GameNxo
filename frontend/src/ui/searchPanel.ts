import Phaser from 'phaser';
import { FONT } from './theme';
import { rankDef } from '../domain/ranks';
import { rankedView } from '../logic/Ranked';
import { RankBadge } from './RankBadge';
import { LEAGUE_STYLE, fmtCoins } from './leagueStyle';
import { infoIcon } from './PlayEntry';
import { drawCoinIcon } from './wheelArt';

/**
 * Panel de la búsqueda de rival con APUESTA (Ranked) o AMISTOSO: liga arriba (emblema + nombre) y, bajo el contador, lo
 * invertido / el premio. Lo usan las dos búsquedas: contra el BOT (MatchmakingScene) y online (LanSearchScene), así se ven igual.
 * Devuelve sus objetos (para quitarlos al encontrar rival). Las dos pantallas ponen el título en y = H*0.44 + 196.
 */
export function rankedSearchPanel(scene: Phaser.Scene, opts: { bet: number | null; unranked: boolean }, onInfoOpen: () => void, onInfoClose: () => void): Phaser.GameObjects.GameObject[] {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const v = rankedView();
  const bet = opts.bet ?? 1;
  const st = v.stakes.find((s) => s.bet === bet) ?? v.stakes[0];
  const ls = LEAGUE_STYLE[v.league];
  const objs: Phaser.GameObjects.GameObject[] = [];
  // liga
  const topY = Math.max(110, H * 0.44 - 92 - 150);
  objs.push(new RankBadge(scene, W / 2, topY, { rank: v.league, level: 99, size: 120 }));
  objs.push(scene.add.text(W / 2, topY + 78, `LIGA ${rankDef(v.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '26px', color: ls.css, stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  const py = H * 0.44 + 262;
  if (opts.unranked) return [...objs, ...unrankedPanel(scene, W, py, onInfoOpen, onInfoClose)];
  // apuesta: cinta "ESTAMOS APOSTANDO", píldora + (i) y dos casillas INVERTIDO / SI GANAS
  const pw = Math.min(620, W - 40);
  const ph = 168;
  const col = bet > 1 ? 0xff4f5e : 0xffc42e;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(W / 2 - pw / 2 + 3, py + 6, pw, ph, 22);
  g.lineStyle(10, col, 0.18).strokeRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
  g.fillStyle(0x0b1733, 0.95).fillRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
  g.fillStyle(0x1b2d5c, 0.5).fillRoundedRect(W / 2 - pw / 2 + 3, py + 3, pw - 6, ph * 0.4, { tl: 19, tr: 19, bl: 0, br: 0 });
  g.lineStyle(3, col, 1).strokeRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
  // cinta: el texto y el icono de info van DENTRO de ella (el ancho se ajusta al texto)
  const ribbonTxt = scene.add.text(0, py, bet > 1 ? 'ESTAMOS APOSTANDO x2' : 'ESTAMOS APOSTANDO', { fontFamily: FONT, fontSize: '18px', color: bet > 1 ? '#ffffff' : '#3a2200' }).setOrigin(0.5).setLetterSpacing(2);
  const IC = 13; // radio del icono (cabe en los 32 px de alto de la cinta)
  const GAP = 8; // aire entre el texto y el icono
  const PAD = 18; // aire a los lados de la cinta
  const rw = ribbonTxt.width + GAP + 2 * IC + 2 * PAD;
  const left = W / 2 - rw / 2;
  g.fillStyle(0x7a4a00, 1).fillRoundedRect(left, py - 18, rw, 36, 18);
  g.fillStyle(bet > 1 ? 0xff4f5e : 0xffc42e, 1).fillRoundedRect(left + 2, py - 16, rw - 4, 32, 16);
  g.fillStyle(0xffffff, 0.35).fillRoundedRect(left + 12, py - 13, rw - 24, 8, 4);
  objs.push(g);
  // texto a la izquierda y el icono a la derecha, los dos dentro de la cinta
  const iconX = left + PAD + ribbonTxt.width + GAP + IC;
  ribbonTxt.setX(left + PAD + ribbonTxt.width / 2);
  objs.push(ribbonTxt);
  objs.push(infoIcon(scene, iconX, py, IC, undefined, { onOpen: onInfoOpen, onClose: onInfoClose }));  // casillas (más grandes y notorias; el PREMIO late para llamar la atención)
  const bw = (pw - 44) / 2;
  const bh = 112;
  const by = py + 34 + bh / 2;
  const box = (cx: number, lab: string, val: string, fill: number, line: number, color: string, glow: boolean) => {
    if (glow) {
      // halo que late detrás del premio
      const halo = scene.add.graphics();
      halo.lineStyle(12, line, 0.35).strokeRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 18);
      objs.push(halo);
      scene.tweens.add({ targets: halo, alpha: { from: 1, to: 0.25 }, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    const bg = scene.add.graphics();
    bg.fillStyle(0x000000, 0.3).fillRoundedRect(cx - bw / 2 + 3, by - bh / 2 + 5, bw, bh, 18);
    bg.fillStyle(fill, 1).fillRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 18);
    bg.fillStyle(0xffffff, 0.1).fillRoundedRect(cx - bw / 2 + 6, by - bh / 2 + 4, bw - 12, bh * 0.36, { tl: 14, tr: 14, bl: 6, br: 6 });
    bg.lineStyle(4, line, 1).strokeRoundedRect(cx - bw / 2, by - bh / 2, bw, bh, 18);
    objs.push(bg);
    objs.push(scene.add.text(cx, by - bh / 2 + 22, lab, { fontFamily: FONT, fontSize: '21px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1));
    const t = scene.add.text(0, by + 16, val, { fontFamily: FONT, fontSize: '42px', color, stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0, 0.5);
    const iconR = 18;
    const total = t.width + 10 + iconR * 2;
    // que la cifra no se salga de la casilla
    if (total > bw - 16) t.setScale((bw - 16 - 10 - iconR * 2) / t.width);
    const tw = t.displayWidth + 10 + iconR * 2;
    t.setX(cx - tw / 2);
    const ic = scene.add.graphics({ x: cx - tw / 2 + t.displayWidth + 10 + iconR, y: by + 16 });
    drawCoinIcon(ic, iconR);
    objs.push(t, ic);
  };
  box(W / 2 - bw / 2 - 8, 'Invertido:', `−${fmtCoins(st.entry)}`, 0x5a1424, 0xff5a6a, '#ffb0b8', false);
  box(W / 2 + bw / 2 + 8, 'Premio:', `+${fmtCoins(st.prize)}`, 0x17803a, 0x7dff9a, '#ffffff', true);
  return objs;
}

/** AMISTOSO: cinta gris, aviso de que no hay apuesta y lo que sí se gana (EXP y ruleta). */
function unrankedPanel(scene: Phaser.Scene, W: number, py: number, onInfoOpen: () => void, onInfoClose: () => void): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const pw = Math.min(580, W - 50);
  const ph = 190;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.35).fillRoundedRect(W / 2 - pw / 2 + 3, py + 6, pw, ph, 22);
  g.fillStyle(0x0b1733, 0.95).fillRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
  g.lineStyle(3, 0x8d99b5, 1).strokeRoundedRect(W / 2 - pw / 2, py, pw, ph, 22);
  const rw = 200;
  g.fillStyle(0x232a3b, 1).fillRoundedRect(W / 2 - rw / 2, py - 18, rw, 36, 18);
  g.fillStyle(0x8d99b5, 1).fillRoundedRect(W / 2 - rw / 2 + 2, py - 16, rw - 4, 32, 16);
  objs.push(g);
  objs.push(scene.add.text(W / 2, py, 'AMISTOSO', { fontFamily: FONT, fontSize: '18px', color: '#1a2033' }).setOrigin(0.5).setLetterSpacing(2));
  const t = scene.add.text(W / 2, py + 50, 'Juegas sin apostar: no ganas monedas de apuesta', { fontFamily: FONT, fontSize: '18px', color: '#cfd8ee' }).setOrigin(0.5);
  objs.push(t);
  objs.push(infoIcon(scene, W / 2 + t.width / 2 + 24, py + 50, 14, undefined, { onOpen: onInfoOpen, onClose: onInfoClose, unranked: true }));
  const bw = (pw - 48) / 2;
  const by = py + 128;
  const box = (cx: number, lab: string, val: string) => {
    const bg = scene.add.graphics();
    bg.fillStyle(0x0f2a1c, 1).fillRoundedRect(cx - bw / 2, by - 34, bw, 68, 16);
    bg.lineStyle(2, 0x2a7a46, 1).strokeRoundedRect(cx - bw / 2, by - 34, bw, 68, 16);
    objs.push(bg);
    objs.push(scene.add.text(cx, by - 18, lab, { fontFamily: FONT, fontSize: '15px', color: '#9fb4e0' }).setOrigin(0.5).setLetterSpacing(2));
    objs.push(scene.add.text(cx, by + 10, val, { fontFamily: FONT, fontSize: '26px', color: '#7dff9a', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5));
  };
  box(W / 2 - bw / 2 - 8, 'GANAS', 'EXP ✓');
  box(W / 2 + bw / 2 + 8, 'Y TAMBIÉN', 'RULETA ✓');
  return objs;
}

