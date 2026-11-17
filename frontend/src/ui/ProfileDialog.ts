import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { arcadeButton } from './modeButtons';
import { RankBadge } from './RankBadge';
import { LEAGUE_STYLE, fmtCoins } from './leagueStyle';
import { coinIcon } from './wheelArt';
import { rankDef } from '../domain/ranks';
import { owns } from '../domain/player';
import { SHOP_ITEMS } from '../domain/shopCatalog';
import { FRAME_IDS, type FrameId, bestLeague, equipFrame, equippedFrame, frameUnlocked } from '../domain/profileFrames';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { totalPlayed, totalWins } from '../logic/Stats';

const NAVY = 0x0b1733;
const GOLD = 0xffc42e;
/** personajes jugables (los demás ids de skin son internos) */
const PLAYABLE = ['nxo', 'mai'] as const;

/**
 * MARCO del perfil (borde de la card): el de la liga elegida, o el azul de siempre. Dibuja sobre `g` un rectángulo redondeado
 * de (0,0) a (w,h). Marcos de liga: aro grueso del color de la liga, filo claro por dentro, sombra oscura por fuera, brillo y
 * cuatro remaches en las esquinas (más vistoso cuanto más alta la liga).
 */
export function drawProfileFrame(g: Phaser.GameObjects.Graphics, w: number, h: number, r: number, frame: FrameId | null) {
  if (!frame) {
    g.lineStyle(8, 0x3a7bff, 0.18).strokeRoundedRect(0, 0, w, h, r);
    g.lineStyle(3, 0x3a7bff, 1).strokeRoundedRect(0, 0, w, h, r);
    return;
  }
  const st = LEAGUE_STYLE[frame];
  const tier = FRAME_IDS.indexOf(frame); // 0 bronce … 5 challenger
  g.lineStyle(12 + tier, st.color, 0.22).strokeRoundedRect(-2, -2, w + 4, h + 4, r + 2); // brillo
  g.lineStyle(7, st.dark, 1).strokeRoundedRect(0, 0, w, h, r);
  g.lineStyle(4.5, st.color, 1).strokeRoundedRect(0, 0, w, h, r);
  g.lineStyle(1.6, st.light, 0.95).strokeRoundedRect(3.2, 3.2, w - 6.4, h - 6.4, Math.max(2, r - 3));
  // remaches en las esquinas (gemas desde Oro)
  const gem = tier >= 2;
  for (const [cx, cy] of [[r * 0.45, r * 0.45], [w - r * 0.45, r * 0.45], [r * 0.45, h - r * 0.45], [w - r * 0.45, h - r * 0.45]]) {
    g.fillStyle(st.dark, 1).fillCircle(cx, cy, gem ? 6.5 : 5);
    g.fillStyle(gem ? st.light : st.color, 1).fillCircle(cx, cy, gem ? 4.5 : 3.4);
    if (gem) g.fillStyle(0xffffff, 0.9).fillCircle(cx - 1.3, cy - 1.3, 1.4);
  }
}

/** Datos de la cuenta que muestra el perfil. */
function accountData() {
  const s = getPlayer();
  const collection = SHOP_ITEMS.filter((it) => it.available);
  return {
    name: s.name,
    level: s.level,
    played: totalPlayed(),
    wins: totalWins(),
    chars: PLAYABLE.filter((c) => owns(s, `skin:${c}`)).length,
    charsTotal: PLAYABLE.length,
    owned: collection.filter((it) => owns(s, it.id)).length,
    total: collection.length,
    league: s.ranked.league,
    best: bestLeague(s),
    coins: s.coins,
    bestStreak: s.ranked.total.bestStreak,
    frame: equippedFrame(s),
  };
}

/**
 * VENTANA DEL PERFIL (16-11-2026): datos de la cuenta (partidas jugadas, victorias, personajes, COLECCIÓN destacada, liga,
 * mejor liga, monedas, mejor racha) y el selector de MARCO (los de las ligas alcanzadas). Se abre al tocar la card del perfil
 * del menú. No muestra derrotas (decisión del usuario).
 */
export function openProfileDialog(scene: Phaser.Scene, onToast: (m: string) => void) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(9000);
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
  root.add(dim);
  const body = scene.add.container(0, 0);
  root.add(body);
  const pw = Math.min(660, W - 28);
  const ph = Math.min(850, H - 40); // alto justo para el contenido (sin hueco antes de CERRAR)
  const left = W / 2 - pw / 2;
  const top = (H - ph) / 2;

  const paint = () => {
    body.removeAll(true);
    const d = accountData();
    // panel con el MARCO elegido como borde (vista previa en grande)
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.4).fillRoundedRect(left + 4, top + 8, pw, ph, 26);
    g.fillStyle(NAVY, 0.98).fillRoundedRect(left, top, pw, ph, 26);
    g.fillStyle(0x1b2d5c, 0.5).fillRoundedRect(left + 4, top + 4, pw - 8, 150, { tl: 22, tr: 22, bl: 0, br: 0 });
    const fg = scene.add.graphics({ x: left, y: top });
    drawProfileFrame(fg, pw, ph, 26, d.frame);
    const block = scene.add.zone(W / 2, top + ph / 2, pw, ph).setInteractive(); // tocar el panel no cierra
    body.add([g, fg, block]);

    // cabecera: insignia de liga, nombre y nivel
    body.add(new RankBadge(scene, left + 80, top + 84, { rank: d.league, level: d.level, size: 110 }));
    const nm = scene.add.text(left + 150, top + 52, d.name, { fontFamily: FONT, fontSize: '36px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0, 0.5);
    fitText(nm, pw - 190);
    body.add(nm);
    body.add(scene.add.text(left + 150, top + 94, `NIVEL ${d.level}`, { fontFamily: FONT, fontSize: '22px', color: '#9fc0ff' }).setOrigin(0, 0.5).setLetterSpacing(1));
    body.add(scene.add.text(left + 150, top + 126, `LIGA ${rankDef(d.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '18px', color: LEAGUE_STYLE[d.league].css }).setOrigin(0, 0.5).setLetterSpacing(1));

    // datos de la cuenta: rejilla de 2 columnas (sin derrotas)
    const stats: { label: string; value: string; color?: string }[] = [
      { label: 'PARTIDAS JUGADAS', value: fmtCoins(d.played) },
      { label: 'PARTIDAS GANADAS', value: fmtCoins(d.wins), color: '#62ef89' },
      { label: 'PERSONAJES', value: `${d.chars} / ${d.charsTotal}` },
      { label: 'MEJOR LIGA', value: rankDef(d.best).name.toUpperCase(), color: LEAGUE_STYLE[d.best].css },
      { label: 'MONEDAS', value: fmtCoins(d.coins), color: '#ffd23f' },
      { label: 'MEJOR RACHA', value: `${d.bestStreak}` },
    ];
    const gy0 = top + 178;
    const cw2 = (pw - 48 - 14) / 2;
    const rh = 74;
    stats.forEach((st, i) => {
      const x = left + 24 + (i % 2) * (cw2 + 14);
      const y = gy0 + Math.floor(i / 2) * (rh + 10);
      const sg = scene.add.graphics();
      sg.fillStyle(0x10224b, 1).fillRoundedRect(x, y, cw2, rh, 14);
      sg.lineStyle(2, 0x2a4a8a, 1).strokeRoundedRect(x, y, cw2, rh, 14);
      body.add(sg);
      body.add(scene.add.text(x + 16, y + 22, st.label, { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0' }).setOrigin(0, 0.5).setLetterSpacing(1));
      const v = scene.add.text(x + 16, y + 50, st.value, { fontFamily: FONT, fontSize: '26px', color: st.color ?? '#ffffff' }).setOrigin(0, 0.5);
      fitText(v, cw2 - 50);
      body.add(v);
      if (st.label === 'MONEDAS') {
        body.add(coinIcon(scene, x + cw2 - 26, y + rh / 2, 11)); // (17-11-2026) moneda: imagen moneda-1.webp
      }
    });

    // MARCOS: uno por liga; los de ligas no alcanzadas, con candado
    const fy = gy0 + 3 * (rh + 10) + 14;
    body.add(scene.add.text(left + 28, fy, 'MARCO DEL PERFIL', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0, 0.5).setLetterSpacing(1.5));
    body.add(scene.add.text(left + pw - 28, fy, 'Llega a una liga para ganar su marco', { fontFamily: FONT, fontSize: '13px', color: '#7f93bf' }).setOrigin(1, 0.5));
    const opts: (FrameId | null)[] = [null, ...FRAME_IDS];
    const gap = 10;
    const sw = (pw - 48 - gap * (opts.length - 1)) / opts.length;
    const sh = Math.min(70, sw * 0.9);
    opts.forEach((f, i) => {
      const x = left + 24 + i * (sw + gap);
      const y = fy + 24;
      const unlocked = !f || frameUnlocked(getPlayer(), f);
      const sel = d.frame === f;
      const sg = scene.add.graphics({ x, y });
      sg.fillStyle(0x0b1733, 1).fillRoundedRect(0, 0, sw, sh, 12);
      drawProfileFrame(sg, sw, sh, 12, f);
      if (!unlocked) sg.fillStyle(0x000000, 0.55).fillRoundedRect(0, 0, sw, sh, 12);
      if (sel) sg.lineStyle(3, 0xffffff, 1).strokeRoundedRect(-6, -6, sw + 12, sh + 12, 16);
      body.add(sg);
      const lbl = scene.add.text(x + sw / 2, y + sh + 14, f ? rankDef(f).name.toUpperCase() : 'NINGUNO', { fontFamily: FONT, fontSize: '11px', color: sel ? '#ffffff' : unlocked ? '#9fb4e0' : '#56607a' }).setOrigin(0.5);
      fitText(lbl, sw + gap - 2, 0.6);
      body.add(lbl);
      if (!unlocked) {
        const lk = scene.add.graphics({ x: x + sw / 2, y: y + sh / 2 });
        lk.lineStyle(3, 0xb7c2de).beginPath().arc(0, -3, 6, Math.PI, 0).strokePath();
        lk.fillStyle(0xb7c2de).fillRoundedRect(-8, -3, 16, 12, 2);
        body.add(lk);
      } else if (sel) {
        body.add(scene.add.text(x + sw / 2, y + sh / 2, '✓', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5));
      }
      const hit = scene.add.zone(x + sw / 2, y + sh / 2, sw + gap, sh + 28).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (!unlocked) return onToast(`Llega a ${rankDef(f!).name.toUpperCase()} para ganar este marco`);
        if (sel) return;
        commit((s) => equipFrame(s as never, f) as never);
      });
      body.add(hit);
    });

    // COLECCIÓN (destacada, al final): cuántos objetos de la Tienda tiene, con barra
    const cy = fy + 24 + sh + 40; // al final, bajo los marcos (16-11-2026)
    const cg = scene.add.graphics();
    cg.fillStyle(0x2a1d04, 1).fillRoundedRect(left + 24, cy, pw - 48, 104, 20);
    cg.lineStyle(10, GOLD, 0.18).strokeRoundedRect(left + 24, cy, pw - 48, 104, 20);
    cg.lineStyle(3, GOLD, 1).strokeRoundedRect(left + 24, cy, pw - 48, 104, 20);
    const bw = pw - 48 - 44;
    const pct = d.total ? d.owned / d.total : 0;
    cg.fillStyle(0x110c02, 1).fillRoundedRect(left + 46, cy + 70, bw, 16, 8);
    cg.fillStyle(GOLD, 1).fillRoundedRect(left + 46, cy + 70, Math.max(16, bw * pct), 16, 8);
    cg.fillStyle(0xffffff, 0.35).fillRoundedRect(left + 50, cy + 72, Math.max(0, bw * pct - 8), 5, 2.5);
    body.add(cg);
    body.add(scene.add.text(left + 46, cy + 34, 'COLECCIÓN', { fontFamily: FONT, fontSize: '28px', color: '#ffe680', stroke: '#2a1d04', strokeThickness: 5 }).setOrigin(0, 0.5).setLetterSpacing(2));
    body.add(scene.add.text(left + pw - 46, cy + 34, `${d.owned} / ${d.total}`, { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#2a1d04', strokeThickness: 6 }).setOrigin(1, 0.5));
    body.add(scene.add.text(W / 2, cy + 120, 'Estilos, poderes y efectos desbloqueados · consíguelos en la Tienda, el Pase y la Ruleta', { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5, 0));


    body.add(arcadeButton(scene, W / 2, top + ph - 58, Math.min(300, pw - 60), 64, 'CERRAR', close, { palette: 'yellow' }));
  };

  const off = onPlayerChange(() => root.active && paint());
  const close = () => {
    off();
    root.destroy();
  };
  dim.once('pointerup', close);
  paint();
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  return root;
}
