import Phaser from 'phaser';
import { FONT } from './theme';
import { type RankId, rankDef } from '../domain/ranks';
import { rankedView } from '../logic/Ranked';
import { RankBadge } from './RankBadge';
import { LEAGUE_STYLE, fmtCoins } from './leagueStyle';
import { infoIcon } from './PlayEntry';
import { coinIcon } from './wheelArt';

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
  objs.push(new RankBadge(scene, W / 2, topY - 30, { rank: v.league, level: 99, size: 200 })); // (21-11-2026, usuario) emblema más grande (antes 120)
  const lt = scene.add.text(W / 2, topY + 102, `LIGA ${rankDef(v.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '33px', color: ls.css, stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setLetterSpacing(2);
  objs.push(goldSideLines(scene, lt), lt);
  const py = H * 0.44 + 290; // (21-11-2026) un poco más abajo: el título lleva ahora línea de luz debajo
  if (opts.unranked) return [...objs, ...unrankedPanel(scene, W, py, onInfoOpen, onInfoClose)];
  // apuesta: cinta "ESTAMOS APOSTANDO", píldora + (i) y dos casillas INVERTIDO / SI GANAS
  return [...objs, ...betBoxes(scene, W, py, { bet, entry: st.entry, prize: st.prize, ribbon: bet > 1 ? 'ESTAMOS APOSTANDO x2' : 'ESTAMOS APOSTANDO', icon: (x, y, r) => coinIcon(scene, x, y, r), info: { open: onInfoOpen, close: onInfoClose } })];
}

/**
 * Cinta + casillas INVERTIDO / PREMIO de la búsqueda con apuesta (1v1 con las monedas de la Liga; 2v2 con las MONEDAS 2V2). `icon` dibuja la
 * moneda de cada casilla; `info`, el (i) de la cinta (si falta, la cinta solo lleva el texto).
 */
function betBoxes(
  scene: Phaser.Scene,
  W: number,
  py: number,
  o: { bet: number; entry: number; prize: number; ribbon: string; icon: (x: number, y: number, r: number) => Phaser.GameObjects.GameObject; info?: { open: () => void; close: () => void }; entryLabel?: string },
): Phaser.GameObjects.GameObject[] {
  const objs: Phaser.GameObjects.GameObject[] = [];
  const bet = o.bet;
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
  const ribbonTxt = scene.add.text(0, py, o.ribbon, { fontFamily: FONT, fontSize: '18px', color: bet > 1 ? '#ffffff' : '#3a2200' }).setOrigin(0.5).setLetterSpacing(2);
  const IC = 13; // radio del icono (cabe en los 32 px de alto de la cinta)
  const GAP = 8; // aire entre el texto y el icono
  const PAD = 18; // aire a los lados de la cinta
  const rw = ribbonTxt.width + (o.info ? GAP + 2 * IC : 0) + 2 * PAD;
  const left = W / 2 - rw / 2;
  g.fillStyle(0x7a4a00, 1).fillRoundedRect(left, py - 18, rw, 36, 18);
  g.fillStyle(bet > 1 ? 0xff4f5e : 0xffc42e, 1).fillRoundedRect(left + 2, py - 16, rw - 4, 32, 16);
  g.fillStyle(0xffffff, 0.35).fillRoundedRect(left + 12, py - 13, rw - 24, 8, 4);
  objs.push(g);
  // (15-11-2026) icono a la IZQUIERDA y el texto a su derecha, los dos dentro de la cinta
  const iconX = left + PAD + IC;
  ribbonTxt.setX(o.info ? left + PAD + 2 * IC + GAP + ribbonTxt.width / 2 : W / 2);
  objs.push(ribbonTxt);
  if (o.info) objs.push(infoIcon(scene, iconX, py, IC, undefined, { onOpen: o.info.open, onClose: o.info.close }));  // casillas (más grandes y notorias; el PREMIO late para llamar la atención)
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
    const ic = o.icon(cx - tw / 2 + t.displayWidth + 10 + iconR, by + 16, iconR); // (17-11-2026) moneda: imagen moneda-1.webp
    objs.push(t, ic);
  };
  box(W / 2 - bw / 2 - 8, o.entryLabel ?? 'Invertido:', `−${fmtCoins(o.entry)}`, 0x5a1424, 0xff5a6a, '#ffb0b8', false);
  box(W / 2 + bw / 2 + 8, 'Premio:', `+${fmtCoins(o.prize)}`, 0x17803a, 0x7dff9a, '#ffffff', true);
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
  objs.push(infoIcon(scene, W / 2 - t.width / 2 - 24, py + 50, 14, undefined, { onOpen: onInfoOpen, onClose: onInfoClose, unranked: true })); // (15-11-2026) a la izquierda
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


/**
 * (20-11-2026, usuario) Búsqueda del 2V2 con la misma presentación que la del 1v1: arriba la moneda 2v2 y "LIGA 2V2"; abajo lo que arriesgas y lo
 * que ganas en MONEDAS 2V2 (x1 / x2). AMISTOSO (sin monedas para lo que arriesga el x1): no arriesgas nada y al ganar igual sumas.
 */
export function doublesSearchPanel(
  scene: Phaser.Scene,
  o: { bet: number; risk: number; prize: number; friendly: boolean; icon: (x: number, y: number, r: number) => Phaser.GameObjects.GameObject; rank?: RankId },
): Phaser.GameObjects.GameObject[] {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const objs: Phaser.GameObjects.GameObject[] = [];
  const topY = Math.max(110, H * 0.44 - 92 - 150);
  // (21-11-2026, usuario) arriba el EMBLEMA de tu liga 2v2 (p. ej. BRONCE), como el de la liga del 1v1, y debajo "LIGA 2V2 · BRONCE"; sin el emblema, la moneda 2v2 de antes
  if (o.rank) {
    objs.push(new RankBadge(scene, W / 2, topY - 30, { rank: o.rank, level: 99, size: 200, doubles: true })); // (21-11-2026, usuario) más grande
    const lt = scene.add.text(W / 2, topY + 102, `LIGA 2V2 · ${rankDef(o.rank).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '33px', color: LEAGUE_STYLE[o.rank].css, stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setLetterSpacing(2);
    objs.push(goldSideLines(scene, lt), lt);
  } else {
    objs.push(o.icon(W / 2, topY, 56));
    objs.push(scene.add.text(W / 2, topY + 78, 'LIGA 2V2', { fontFamily: FONT, fontSize: '26px', color: '#d6b8ff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  }
  const py = H * 0.44 + 290; // (21-11-2026) un poco más abajo: el título lleva ahora línea de luz debajo
  const ribbon = o.friendly ? 'AMISTOSO' : o.bet > 1 ? 'ESTAMOS APOSTANDO x2' : 'ESTAMOS APOSTANDO';
  return [...objs, ...betBoxes(scene, W, py, { bet: o.bet, entry: o.friendly ? 0 : o.risk, prize: o.prize, ribbon, icon: o.icon, entryLabel: o.friendly ? 'Arriesgas:' : 'Invertido:' })];
}

/**
 * (20-11-2026, usuario) 2V2: el título cuenta los jugadores de la partida, "BUSCANDO PARTIDA 1/4" (tú), y se va LLENANDO de bots durante la
 * búsqueda (los dos rivales a un 30 % y un 60 % del tiempo); `full()` la completa (4/4: llegó el compañero o se acabó el tiempo y entra un bot).
 */
export function doublesFill(scene: Phaser.Scene, title: Phaser.GameObjects.Text, totalMs: number) {
  let n = 1;
  const set = (k: number) => {
    if (k <= n || !title.active) return;
    n = k;
    title.setText(`BUSCANDO PARTIDA ${n}/4`);
    scene.tweens.add({ targets: title, scale: { from: 1.12, to: 1 }, duration: 220, ease: 'Back.easeOut' });
  };
  title.setText('BUSCANDO PARTIDA 1/4');
  const timers = [scene.time.delayedCall(totalMs * 0.3, () => set(2)), scene.time.delayedCall(totalMs * 0.6, () => set(3))];
  return {
    full: () => {
      timers.forEach((t) => t.remove());
      set(4);
    },
  };
}

/** (21-11-2026, mockup) líneas doradas que se desvanecen a ambos lados del nombre de la liga ("—— LIGA BRONCE ——"). */
function goldSideLines(scene: Phaser.Scene, t: Phaser.GameObjects.Text) {
  const g = scene.add.graphics();
  const half = t.displayWidth / 2;
  const len = 90;
  for (const dir of [-1, 1]) {
    const x0 = t.x + dir * (half + 14);
    for (let i = 0; i < 10; i++) {
      const a = 0.9 - i * 0.085;
      const xa = x0 + dir * (i * len) / 10;
      g.fillStyle(0xffc42e, a).fillRect(dir > 0 ? xa : xa - len / 10, t.y - 1.5, len / 10, 3);
    }
  }
  return g;
}