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
import { FRAME_IDS, type FrameId, bestLeague, equipFrame, equipFrame2v2, equippedFrame, equippedFrame2v2, frame2v2Unlocked, frameUnlocked } from '../domain/profileFrames';
import { type FrameSet, addProfileFrameArt } from './profileFrameArt';
import { bestLeague2v2 } from '../domain/league2v2';
import { commit, getPlayer, onPlayerChange } from '../domain/playerStore';
import { totalPlayed, totalWins } from '../logic/Stats';
import { markTutorialSeen } from '../domain/operations';
import { GUIDE, guidedStep } from '../domain/tutorial';
import { clockTimer } from './TutorialDialog';
import { tapHint } from './guideFocus';

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
    streak: s.ranked.total.streak, // (26-11-2026, usuario) racha actual
    frame: equippedFrame(s),
    frame2v2: equippedFrame2v2(s),
    best2v2: bestLeague2v2(s),
  };
}

/** Posiciones (relativas al borde superior del panel) y alto total del perfil: todo cabe sin pisarse. */
function layout(pw: number) {
  const headH = 172;
  const statsY = headH + 16;
  const rh = 66;
  const framesY = statsY + 3 * (rh + 10) + 18;
  const tabGap = 26;
  const tabH = 50;
  const sw = (pw - 48 - 28 - 20) / 3;
  const sh = Math.min(56, sw / 3.3);
  const panelH = 18 + 2 * (sh + 28) + 24;
  const collY = framesY + tabGap + tabH + panelH + 22;
  const closeY = collY + 104 + 26 + 32;
  return { headH, statsY, rh, framesY, tabGap, tabH, sw, sh, panelH, collY, closeY, ph: closeY + 32 + 26 };
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
  const left = W / 2 - pw / 2;
  // (21-11-2026, usuario) el alto sale del contenido (antes 850 fijo y no cabía todo); si la pantalla es más baja, el panel se escala
  const L = layout(pw);
  const ph = L.ph;
  const top = Math.max(12, (H - ph) / 2);
  const fit = Math.min(1, (H - 24) / ph);
  if (fit < 1) body.setScale(fit).setPosition((W / 2) * (1 - fit), H / 2 - fit * (top + ph / 2));

  // pestaña de los marcos: los de LIGA o los de LIGA 2V2 (abre en la del marco que se está usando)
  let frameTab: FrameSet = getPlayer().equipped.frame2v2 ? '2v2' : '1v1';
  const paint = () => {
    body.removeAll(true);
    const d = accountData();
    // panel con el MARCO elegido como borde (vista previa en grande)
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.45).fillRoundedRect(left + 5, top + 10, pw, ph, 26);
    g.fillStyle(NAVY, 0.98).fillRoundedRect(left, top, pw, ph, 26);
    // cabecera con franjas de luz (degradado hecho a mano: funciona también en Canvas)
    const hh = L.headH;
    for (let i = 0; i < 6; i++) g.fillStyle(0x24407e, 0.16 - i * 0.022).fillRoundedRect(left + 4, top + 4, pw - 8, hh - i * (hh / 7), { tl: 22, tr: 22, bl: 0, br: 0 });
    g.fillStyle(0xffffff, 0.06).fillRoundedRect(left + 18, top + 10, pw - 36, 4, 2);
    g.lineStyle(2, 0x2c4a8c, 0.9).lineBetween(left + 24, top + hh, left + pw - 24, top + hh);
    const fg = scene.add.graphics({ x: left, y: top });
    drawProfileFrame(fg, pw, ph, 26, d.frame2v2 ?? d.frame);
    const block = scene.add.zone(W / 2, top + ph / 2, pw, ph).setInteractive(); // tocar el panel no cierra
    body.add([g, fg, block]);

    // cabecera: insignia de liga (con halo del color de la liga), nombre, nivel y liga en "píldoras"
    const lst = LEAGUE_STYLE[d.league];
    const halo = scene.add.graphics();
    for (let i = 0; i < 5; i++) halo.fillStyle(lst.color, 0.05 + i * 0.025).fillCircle(left + 86, top + hh / 2 + 2, 70 - i * 10);
    body.add(halo);
    body.add(new RankBadge(scene, left + 86, top + hh / 2 + 2, { rank: d.league, level: d.level, size: 116 }));
    const tx = left + 162;
    const nm = scene.add.text(tx, top + 50, d.name, { fontFamily: FONT, fontSize: '38px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0, 0.5);
    fitText(nm, pw - (tx - left) - 28);
    body.add(nm);
    const pill = (x: number, y: number, label: string, fill: number, stroke: number, css: string) => {
      const t = scene.add.text(0, 0, label, { fontFamily: FONT, fontSize: '17px', color: css }).setOrigin(0.5).setLetterSpacing(1);
      const w = t.width + 30;
      const pg = scene.add.graphics();
      pg.fillStyle(fill, 1).fillRoundedRect(x, y - 15, w, 30, 15);
      pg.fillStyle(0xffffff, 0.08).fillRoundedRect(x + 3, y - 13, w - 6, 11, 6);
      pg.lineStyle(2, stroke, 1).strokeRoundedRect(x, y - 15, w, 30, 15);
      t.setPosition(x + w / 2, y);
      body.add([pg, t]);
      return w;
    };
    const lw = pill(tx, top + 100, `NIVEL ${d.level}`, 0x15306a, 0x3a7bff, '#cfe0ff');
    pill(tx + lw + 10, top + 100, `LIGA ${rankDef(d.league).name.toUpperCase()}`, lst.dark, lst.color, lst.css);
    if (d.best2v2) pill(tx, top + 138, `MEJOR 2V2 · ${rankDef(d.best2v2).name.toUpperCase()}`, 0x2a1450, 0xb06bff, '#e2c8ff');

    // datos de la cuenta: rejilla de 2 columnas (sin derrotas)
    const stats: { label: string; value: string; color?: string }[] = [
      { label: 'PARTIDAS JUGADAS', value: fmtCoins(d.played) },
      { label: 'PARTIDAS GANADAS', value: fmtCoins(d.wins), color: '#62ef89' },
      { label: 'PERSONAJES', value: `${d.chars} / ${d.charsTotal}` },
      { label: 'MEJOR LIGA', value: rankDef(d.best).name.toUpperCase(), color: LEAGUE_STYLE[d.best].css },
      { label: 'MONEDAS', value: fmtCoins(d.coins), color: '#ffd23f' },
      { label: 'MEJOR RACHA', value: `${d.bestStreak}` },
    ];
    const gy0 = top + L.statsY;
    const cw2 = (pw - 48 - 14) / 2;
    const rh = L.rh;
    stats.forEach((st, i) => {
      const x = left + 24 + (i % 2) * (cw2 + 14);
      const y = gy0 + Math.floor(i / 2) * (rh + 10);
      const accent = st.color ? Phaser.Display.Color.HexStringToColor(st.color).color : 0x3a7bff;
      const sg = scene.add.graphics();
      sg.fillStyle(0x000000, 0.25).fillRoundedRect(x + 2, y + 4, cw2, rh, 14);
      sg.fillStyle(0x10224b, 1).fillRoundedRect(x, y, cw2, rh, 14);
      sg.fillStyle(0x1a3166, 0.7).fillRoundedRect(x + 2, y + 2, cw2 - 4, rh * 0.42, { tl: 12, tr: 12, bl: 0, br: 0 });
      sg.fillStyle(accent, 1).fillRoundedRect(x + 6, y + 12, 5, rh - 24, 2.5); // franja de color a la izquierda
      sg.lineStyle(2, 0x2a4a8a, 1).strokeRoundedRect(x, y, cw2, rh, 14);
      body.add(sg);
      if (st.label === 'MEJOR RACHA') {
        // (26-11-2026, usuario) la celda dividida en dos: MEJOR RACHA | RACHA ACTUAL
        const half = (cw2 - 22) / 2;
        sg.lineStyle(2, 0x2a4a8a, 1).lineBetween(x + 22 + half, y + 10, x + 22 + half, y + rh - 10);
        [['MEJOR RACHA', `${d.bestStreak}`, '#ffffff'], ['RACHA ACTUAL', `${d.streak}`, '#ff9a4a']].forEach(([lb, val, colr], k) => {
          const hx = x + 22 + k * (half + 8);
          const l = scene.add.text(hx, y + 22, lb, { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0' }).setOrigin(0, 0.5).setLetterSpacing(1);
          fitText(l, half - 12);
          const vv = scene.add.text(hx, y + 50, val, { fontFamily: FONT, fontSize: '27px', color: colr, stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5);
          body.add([l, vv]);
        });
        return;
      }
      body.add(scene.add.text(x + 22, y + 22, st.label, { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0' }).setOrigin(0, 0.5).setLetterSpacing(1));
      const v = scene.add.text(x + 22, y + 50, st.value, { fontFamily: FONT, fontSize: '27px', color: st.color ?? '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5);
      fitText(v, cw2 - 56);
      body.add(v);
      if (st.label === 'MONEDAS') {
        body.add(coinIcon(scene, x + cw2 - 26, y + rh / 2, 12)); // (17-11-2026) moneda: imagen moneda-1.webp
      }
    });

    // MARCOS (21-11-2026, usuario): dos juegos, los de LIGA y los de LIGA 2V2 (se ganan al subir de liga en la semanal).
    // (21-11-2026, usuario) las pestañas parecían botones sueltos: ahora son PESTAÑAS de carpeta pegadas al panel de los marcos
    // (la activa sobresale, con el color del juego: oro LIGA, morado LIGA 2V2; la otra queda atrás, apagada).
    const fy = top + L.framesY;
    const tg = scene.add.graphics();
    tg.fillStyle(GOLD, 1).fillPoints([{ x: left + 30, y: fy }, { x: left + 37, y: fy - 7 }, { x: left + 44, y: fy }, { x: left + 37, y: fy + 7 }], true);
    body.add(tg);
    body.add(scene.add.text(left + 54, fy, 'MARCO DEL PERFIL', { fontFamily: FONT, fontSize: '21px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(1.5));
    const none = d.frame == null && d.frame2v2 == null;
    body.add(
      arcadeButton(scene, left + pw - 28 - 70, fy, 140, 34, 'SIN MARCO', () => {
        if (!none) commit((st) => equipFrame(st as never, null) as never);
      }, { palette: none ? 'yellow' : 'grey', noShadow: true }),
    );
    const accentOf = (t: FrameSet) => (t === '2v2' ? 0xb06bff : GOLD);
    const acc = accentOf(frameTab);
    const PANEL = 0x132a5c;
    const tabTop = fy + L.tabGap;
    const tabH = L.tabH;
    const tabW = (pw - 48 - 10) / 2;
    const panelY = tabTop + tabH;
    const panelH = L.panelH;
    const px0 = left + 24;
    const pW = pw - 48;
    // panel de los marcos (borde del color de la pestaña activa)
    const pg = scene.add.graphics();
    pg.fillStyle(0x000000, 0.3).fillRoundedRect(px0 + 2, panelY + 5, pW, panelH, 16);
    pg.fillStyle(PANEL, 1).fillRoundedRect(px0, panelY, pW, panelH, 16);
    pg.fillStyle(acc, 0.07).fillRoundedRect(px0 + 3, panelY + 3, pW - 6, 40, { tl: 13, tr: 13, bl: 0, br: 0 });
    pg.lineStyle(2.5, acc, 0.9).strokeRoundedRect(px0, panelY, pW, panelH, 16);
    body.add(pg);
    const unlockedCount = (t: FrameSet) => FRAME_IDS.filter((f) => (t === '2v2' ? frame2v2Unlocked(getPlayer(), f) : frameUnlocked(getPlayer(), f))).length;
    (['1v1', '2v2'] as const).forEach((t, i) => {
      const on = frameTab === t;
      const a = accentOf(t);
      const x = px0 + i * (tabW + 10);
      const y = on ? tabTop : tabTop + 8;
      const h = on ? tabH + 3 : tabH - 8;
      const tgr = scene.add.graphics();
      if (on) {
        tgr.fillStyle(PANEL, 1).fillRoundedRect(x, y, tabW, h, { tl: 14, tr: 14, bl: 0, br: 0 });
        tgr.fillStyle(a, 0.16).fillRoundedRect(x + 3, y + 3, tabW - 6, h * 0.5, { tl: 11, tr: 11, bl: 0, br: 0 });
        tgr.lineStyle(2.5, a, 0.9).strokeRoundedRect(x, y, tabW, h + 12, { tl: 14, tr: 14, bl: 0, br: 0 });
        tgr.fillStyle(PANEL, 1).fillRect(x + 1.5, y + h - 1, tabW - 3, 14); // tapa el borde del panel bajo la pestaña: quedan unidos
        tgr.fillStyle(a, 1).fillRoundedRect(x + tabW / 2 - 26, y + 4, 52, 4, 2); // filo de luz arriba
      } else {
        tgr.fillStyle(0x0a1430, 1).fillRoundedRect(x, y, tabW, h, { tl: 12, tr: 12, bl: 0, br: 0 });
        tgr.lineStyle(2, 0x23396b, 1).strokeRoundedRect(x, y, tabW, h, { tl: 12, tr: 12, bl: 0, br: 0 });
      }
      body.add(tgr);
      const name = scene.add.text(x + tabW / 2, y + h / 2 + (on ? 0 : 1), t === '1v1' ? 'LIGA' : 'LIGA 2V2', {
        fontFamily: FONT,
        fontSize: on ? '21px' : '18px',
        color: on ? '#ffffff' : '#6f82ad',
        stroke: on ? '#0a1638' : '#050b1c',
        strokeThickness: on ? 5 : 3,
      }).setOrigin(0.5).setLetterSpacing(1.5);
      body.add(name);
      const cnt = scene.add.text(x + tabW - 14, y + h / 2, `${unlockedCount(t)}/${FRAME_IDS.length}`, { fontFamily: FONT, fontSize: '13px', color: on ? Phaser.Display.Color.IntegerToColor(a).rgba : '#56607a' }).setOrigin(1, 0.5);
      body.add(cnt);
      if (!on) {
        const hit = scene.add.zone(x + tabW / 2, tabTop + tabH / 2, tabW, tabH).setInteractive({ useHandCursor: true });
        hit.on('pointerup', () => {
          frameTab = t;
          paint();
        });
        body.add(hit);
      }
    });
    const gap = 10;
    const cols = 3;
    const sw = (pW - 28 - gap * (cols - 1)) / cols;
    const sh = L.sh;
    const gridTop = panelY + 18;
    const rowPitch = sh + 28;
    body.add(
      scene.add.text(W / 2, panelY + panelH - 18, frameTab === '2v2' ? 'Sube de liga 2V2 en la semanal para ganar su marco' : 'Llega a una liga para ganar su marco', { fontFamily: FONT, fontSize: '13px', color: '#8a9ccc' }).setOrigin(0.5),
    );
    FRAME_IDS.forEach((f, i) => {
      const x = px0 + 14 + (i % cols) * (sw + gap);
      const y = gridTop + Math.floor(i / cols) * rowPitch;
      const unlocked = frameTab === '2v2' ? frame2v2Unlocked(getPlayer(), f) : frameUnlocked(getPlayer(), f);
      const sel = frameTab === '2v2' ? d.frame2v2 === f : d.frame === f && !d.frame2v2;
      const sg = scene.add.graphics({ x, y });
      sg.fillStyle(0x0b1733, 1).fillRoundedRect(0, 0, sw, sh, 10);
      body.add(sg);
      const img = addProfileFrameArt(scene, sw, sh, f, frameTab);
      if (img) {
        const holder = scene.add.container(x, y, [img]);
        body.add(holder);
      } else drawProfileFrame(sg, sw, sh, 10, f);
      if (!unlocked) {
        const dim = scene.add.graphics({ x, y });
        dim.fillStyle(0x000000, 0.55).fillRoundedRect(0, 0, sw, sh, 10);
        body.add(dim);
      }
      if (sel) {
        const ring = scene.add.graphics({ x, y });
        ring.lineStyle(7, acc, 0.25).strokeRoundedRect(-5, -5, sw + 10, sh + 10, 14);
        ring.lineStyle(3, 0xffffff, 1).strokeRoundedRect(-5, -5, sw + 10, sh + 10, 14);
        body.add(ring);
      }
      const lbl = scene.add.text(x + sw / 2, y + sh + 13, rankDef(f).name.toUpperCase(), { fontFamily: FONT, fontSize: '12px', color: sel ? '#ffffff' : unlocked ? '#9fb4e0' : '#56607a' }).setOrigin(0.5);
      body.add(lbl);
      if (!unlocked) {
        const lk = scene.add.graphics({ x: x + sw / 2, y: y + sh / 2 });
        lk.lineStyle(3, 0xb7c2de).beginPath().arc(0, -3, 6, Math.PI, 0).strokePath();
        lk.fillStyle(0xb7c2de).fillRoundedRect(-8, -3, 16, 12, 2);
        body.add(lk);
      } else if (sel) {
        body.add(scene.add.text(x + sw / 2, y + sh / 2, '✓', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5));
      }
      const hit = scene.add.zone(x + sw / 2, y + (sh + 22) / 2, sw + gap, sh + 22).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (!unlocked) return onToast(frameTab === '2v2' ? `Sube a ${rankDef(f).name.toUpperCase()} en la LIGA 2V2 para ganar este marco` : `Llega a ${rankDef(f).name.toUpperCase()} para ganar este marco`);
        if (sel) return;
        commit((st) => (frameTab === '2v2' ? equipFrame2v2(st as never, f) : equipFrame(st as never, f)) as never);
      });
      body.add(hit);
    });
    // COLECCIÓN (destacada, al final): cuántos objetos de la Tienda tiene, con barra
    const cy = top + L.collY; // al final, bajo los marcos (16-11-2026)
    const cg = scene.add.graphics();
    cg.fillStyle(0x000000, 0.3).fillRoundedRect(left + 26, cy + 5, pw - 48, 104, 20);
    cg.fillStyle(0x2a1d04, 1).fillRoundedRect(left + 24, cy, pw - 48, 104, 20);
    cg.fillStyle(0x4a3408, 0.6).fillRoundedRect(left + 27, cy + 3, pw - 54, 44, { tl: 17, tr: 17, bl: 0, br: 0 });
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


    body.add(arcadeButton(scene, W / 2, top + L.closeY, Math.min(300, pw - 60), 64, 'CERRAR', close, { palette: 'yellow' }));
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
  // (26-11-2026, usuario) una sola vez, en la guía del perfil del nivel 2
  if (!getPlayer().tutorial?.includes(PROFILE_INFO) && guidedStep(getPlayer().level, getPlayer().tutorial) === 'profile') {
    // (25-11-2026, usuario) al cerrarse el resumen, la mano señala CERRAR
    profileInfo(scene, root, () => {
      if (!root.active) return;
      const f = body.scaleX;
      const hand = tapHint(scene, body.x + (W / 2) * f, body.y + (top + L.closeY) * f, 9600);
      root.once('destroy', () => hand.destroy());
    });
  }
  return root;
}

const PROFILE_INFO = GUIDE.profileInfo;
const PROFILE_INFO_MS = 3000;

/** (25-11-2026, usuario) la primera vez que se abre el perfil: explicación breve (se cierra al tocar) */
function profileInfo(scene: Phaser.Scene, root: Phaser.GameObjects.Container, onDone: () => void) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const box = scene.add.container(0, 0);
  const dim = scene.add.rectangle(0, 0, W, H, 0x03091a, 0.72).setOrigin(0).setInteractive();
  const cw = Math.min(460, W - 60);
  const ch = 330;
  const cx = W / 2;
  const cy = H / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x0a1638, 0.98).fillRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 24);
  g.lineStyle(4, 0xffd23f).strokeRoundedRect(cx - cw / 2, cy - ch / 2, cw, ch, 24);
  const title = scene.add.text(cx, cy - ch / 2 + 50, 'AQUÍ PODRÁS VER', { fontFamily: FONT, fontSize: '32px', color: '#fff3bb', stroke: '#071332', strokeThickness: 7 }).setOrigin(0.5);
  const items = ['TU NIVEL', 'TUS PARTIDAS', 'TUS LIGAS'].map((t, i) =>
    scene.add.text(cx - cw / 2 + 70, cy - ch / 2 + 115 + i * 52, `•  ${t}`, { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#071332', strokeThickness: 6 }).setOrigin(0, 0.5).setAlpha(0));
  // (25-11-2026, usuario) se cierra solo a los 3 s: el reloj (como el de BIENVENID@) se vacía
  const hint = clockTimer(scene, cx, cy + ch / 2 - 40, PROFILE_INFO_MS);
  box.add([dim, g, title, ...items, hint]);
  root.add(box);
  items.forEach((t, i) => scene.tweens.add({ targets: t, alpha: 1, x: { from: t.x + 30, to: t.x }, delay: 250 + i * 180, duration: 260, ease: 'Back.easeOut' }));
  let done = false;
  const finish = () => {
    if (done || !box.active) return;
    done = true;
    commit((s) => markTutorialSeen(s, PROFILE_INFO));
    scene.tweens.add({ targets: box, alpha: 0, duration: 200, onComplete: () => { box.destroy(); onDone(); } });
  };
  dim.once('pointerup', finish);
  scene.time.delayedCall(PROFILE_INFO_MS, finish);
}
