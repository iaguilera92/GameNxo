import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';
import { drawStakePill, drawUnrankedChip, modal } from './PlayEntry';
import { fmtCoins } from './leagueStyle';
import { getPlayer } from '../domain/playerStore';
import { COINS_2V2, effectiveBet2v2, friendly2v2, stakes2v2 } from '../domain/coins2v2';
import { doublesSearchPanel } from './searchPanel';
import { league2v2Of } from '../domain/league2v2';
import { rankDef, type RankId } from '../domain/ranks';
import { fitText } from './fitText';

/**
 * (21-11-2026, usuario) Entrada del 2v2 en el menú: el botón GRANDE "2v2" con la apuesta en MONEDAS 2V2 (la píldora "🪙 15 x1", con posibilidad de x2, igual
 * que el 1v1) y el diálogo que sale al tocarlo con dos opciones: INVITAR AMIGO y JUGAR. La apuesta (x1 / x2) se guarda en este dispositivo y se aplica al
 * terminar el partido (domain/coins2v2.ts: lo que arriesgas y lo que ganas se multiplican; el x2 solo si tienes monedas 2v2 para cubrirlo).
 */
const NAVY = 0x0a1638;
const PURPLE = 0xb06bff;
const RED = 0xff4f5e;
const BET_KEY = 'gamenxo.menu.bet2v2';

/** Apuesta elegida del 2v2 (solo comodidad de este dispositivo; x1 si falla). */
export function loadBet2v2(): number {
  try {
    return localStorage.getItem(BET_KEY) === '2' ? 2 : 1;
  } catch {
    return 1;
  }
}
function saveBet2v2(b: number) {
  try {
    localStorage.setItem(BET_KEY, String(b));
  } catch {
    /* sin almacenamiento */
  }
}
/** La apuesta que vale ahora (la elegida, si se puede cubrir con tus monedas 2v2). */
export const currentBet2v2 = () => effectiveBet2v2(Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0)), loadBet2v2());

/** Moneda 2V2 (morada) centrada en (x, y) de radio `r`: su imagen (assets/moneda-2v2.webp) o, si falta, un disco morado. */
export function coin2v2Icon(scene: Phaser.Scene, x: number, y: number, r: number): Phaser.GameObjects.GameObject {
  if (scene.textures.exists('coin-2v2')) return scene.add.image(x, y, 'coin-2v2').setDisplaySize(2 * (r + 2.5), 2 * (r + 2.5));
  const g = scene.add.graphics({ x, y });
  g.fillStyle(0x1d0a3d, 1).fillCircle(0, 0, r + 2).fillStyle(0x6b2fe0, 1).fillCircle(0, 0, r).fillStyle(0xa77bff, 1).fillCircle(-r * 0.12, -r * 0.16, r * 0.62).fillStyle(0x6b2fe0, 1).fillCircle(0, 0, r * 0.5);
  return g;
}
const pillOpts = { icon: coin2v2Icon, accent: PURPLE };

/** (19-11-2026) sin monedas 2v2 para el x1: AMISTOSO (domain/coins2v2.friendly2v2) */
const isFriendly = () => friendly2v2(getPlayer().coins2v2 ?? 0);
const stakeOf = (bet: number) => stakes2v2(Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0))).find((s) => s.bet === bet) ?? stakes2v2(0)[0];

/**
 * Botón GRANDE "2v2": "2v2" a la izquierda y, a la derecha, la apuesta en monedas 2v2 (tocarla abre la elección x1 / x2) y la (i). Tocar el botón llama a
 * `onPress` (el menú abre el diálogo). `plain` (modo desarrollo apagado, sin apuestas): solo el botón. Devuelve el botón; `btn.getData('redraw')` repinta la
 * píldora (cuando la apuesta cambia desde el diálogo).
 */
export function doublesPlayButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, onPress: () => void, plain = false) {
  const btn = arcadeButton(scene, x, y, w, h, '2v2', onPress, { palette: 'purple' });
  if (plain) return btn;
  const label = btn.getData('label') as Phaser.GameObjects.Text;
  const infoR = h * 0.15;
  const infoX = x + w / 2 - 18 - infoR - h * 0.04;
  const pillH = h * 0.56;
  const pill = scene.add.container(0, y).setDepth(btn.depth + 1);
  const info = scene.add.container(infoX, y).setDepth(btn.depth + 1);
  const pillBody = scene.add.container(0, 0);
  const infoBody = scene.add.container(0, 0);
  pill.add(pillBody);
  info.add(infoBody);
  let pillBaseX = 0;
  const drawPill = () => {
    pillBody.removeAll(true);
    const bet = currentBet2v2();
    const fr = isFriendly(); // (19-11-2026, usuario) sin monedas para apostar: AMISTOSO, como el 1v1 (sin monto, sin x1 ni la (i))
    const pw = fr ? drawUnrankedChip(scene, pillBody, pillH) : drawStakePill(scene, pillBody, stakeOf(bet).risk, bet, pillH, pillOpts);
    info.setVisible(!fr);
    pill.setSize(pw, pillH + 16);
    pillBaseX = infoX - infoR - 6 - pw / 2;
    pill.setX(pillBaseX);
    // "2v2" centrado en el espacio que queda a la izquierda
    const leftEdge = x - w / 2 + h * 0.2;
    const freeW = pillBaseX - pw / 2 - 10 - leftEdge;
    label.setScale(Math.min(1, (freeW * 0.92) / Math.max(1, label.width)));
    label.setX(leftEdge + freeW / 2 - x);
  };
  drawPill();
  btn.setData('redraw', drawPill);
  pill.setInteractive({ useHandCursor: true });
  pill.on('pointerup', () => {
    scene.tweens.add({ targets: pillBody, scale: { from: 0.9, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    if (isFriendly()) return; // AMISTOSO: no hay apuesta que elegir
    openBetPicker2v2(scene, currentBet2v2(), drawPill);
  });
  // (i)
  const ig = scene.add.graphics();
  ig.fillStyle(0x000000, 0.25).fillCircle(1, 3, infoR);
  ig.fillStyle(NAVY, 0.92).fillCircle(0, 0, infoR);
  ig.lineStyle(2, 0xffffff, 0.95).strokeCircle(0, 0, infoR);
  infoBody.add([ig, scene.add.text(0, 1, 'i', { fontFamily: FONT, fontSize: `${Math.round(infoR * 1.35)}px`, color: '#ffffff' }).setOrigin(0.5)]);
  info.setSize(infoR * 2 + 22, infoR * 2 + 30).setInteractive({ useHandCursor: true });
  scene.tweens.add({ targets: infoBody, scale: 1.12, duration: 700, yoyo: true, repeat: -1, repeatDelay: 1600, ease: 'Sine.easeInOut' });
  info.on('pointerup', () => openDoublesInfo(scene, () => openBetPicker2v2(scene, currentBet2v2(), drawPill)));
  // al presionar el botón se aplasta: la píldora y la (i) lo acompañan
  const inner = btn.list[0] as Phaser.GameObjects.Container;
  const follow = () => {
    if (!btn.active || !pill.active) return;
    const k = inner.scaleX;
    pill.setScale(k).setPosition(x + (pillBaseX - x) * k, y + inner.y * k);
    info.setScale(k).setPosition(x + (infoX - x) * k, y + inner.y * k);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, follow);
  btn.once(Phaser.GameObjects.Events.DESTROY, () => scene.events.off(Phaser.Scenes.Events.UPDATE, follow)); // (19-11-2026) el menú rearma la fila al cambiar de liga
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, follow));
  document.fonts?.ready.then(() => pill.active && drawPill()).catch(() => undefined);
  return btn;
}

/**
 * Diálogo del 2v2 (al tocar el botón). (21-11-2026, usuario: "mejoremos el diálogo, los botones están bien") Rediseñado:
 *   - CABECERA morada con la moneda 2v2, "2V2" y la pareja contra 2 bots;
 *   - tarjeta de APUESTA: "TU APUESTA" y "TIENES <monedas 2v2>", el monto GRANDE con su moneda, un INTERRUPTOR x1 | x2 con las dos opciones a la vista (el x2
 *     se atenúa con candado si no hay monedas para cubrirlo) y dos recuadros: SI GANAS (verde) y SI PIERDES (rojo);
 *   - los dos botones (JUGAR 2V2 e INVITAR AMIGO), con el mismo ancho que la tarjeta (20-11-2026).
 * `plain` (modo desarrollo apagado) = solo cabecera y botones. `onChange` avisa de un cambio de apuesta (el botón del menú repinta su píldora).
 */
export function openDoublesDialog(scene: Phaser.Scene, opts: { plain: boolean; onPlay: () => void; onInvite: () => void; onChange?: () => void }) {
  const { plain, onPlay, onInvite, onChange } = opts;
  const pw = Math.min(560, scene.scale.width - 48);
  const HEAD = 100;
  const CARD_Y = HEAD + 22;
  const CARD_H = 272; // (20-11-2026, usuario) más aire abajo, bajo SI GANAS / SI PIERDES (antes 250)
  const ph = plain ? 360 : CARD_Y + CARD_H + 28 + 80 + 20 + 68 + 36;
  const top = -ph / 2;
  const { p, close } = modal(scene, pw, ph, PURPLE);
  // (20-11-2026, usuario) sin el subtítulo 'TÚ Y TU COMPAÑERO CONTRA 2 BOTS': el título va centrado en la cabecera
  // --- cabecera morada (esquinas de arriba redondeadas como el panel) con la moneda 2v2 y el título
  const hg = scene.add.graphics();
  hg.fillStyle(0x4a1fb8, 1).fillRoundedRect(-pw / 2 + 3, top + 3, pw - 6, HEAD, { tl: 21, tr: 21, bl: 0, br: 0 });
  hg.fillStyle(0x7a3dff, 1).fillRoundedRect(-pw / 2 + 3, top + 3, pw - 6, HEAD * 0.55, { tl: 21, tr: 21, bl: 0, br: 0 });
  hg.fillStyle(0xffffff, 0.12).fillRoundedRect(-pw / 2 + 12, top + 9, pw - 24, 16, 8);
  hg.fillStyle(0x1d0a52, 1).fillRect(-pw / 2 + 3, top + 3 + HEAD - 3, pw - 6, 3);
  p.add(hg);
  // (21-11-2026, usuario) el título dice en qué liga estás ("LIGA 2V2 - BRONCE") y ya no lleva las monedas 2v2 a los lados
  const league = rankDef(league2v2Of(getPlayer())).name.toUpperCase();
  const title = scene.add.text(0, top + 52, `LIGA 2V2 - ${league}`, { fontFamily: FONT, fontSize: '42px', color: '#ffffff', stroke: '#1d0a52', strokeThickness: 8 }).setOrigin(0.5).setLetterSpacing(3);
  fitText(title, pw - 110); // deja sitio a la X de cerrar
  p.add(title);

  // (20-11-2026, usuario) con la tarjeta de apuesta, los botones tienen su MISMO ancho
  const bw = plain ? Math.min(400, pw - 80) : pw - 56;
  if (!plain) {
    const card = scene.add.container(0, top + CARD_Y);
    p.add(card);
    const cw = pw - 56;
    const paint = () => {
      card.removeAll(true);
      const bet = currentBet2v2();
      const st = stakeOf(bet);
      const have = Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0));
      const x2 = bet > 1;
      const g = scene.add.graphics();
      g.fillStyle(0x0a1230, 1).fillRoundedRect(-cw / 2, 0, cw, CARD_H, 22);
      g.lineStyle(3, x2 ? RED : PURPLE, 1).strokeRoundedRect(-cw / 2, 0, cw, CARD_H, 22);
      card.add(g);
      // fila de arriba: "TU APUESTA" a la izquierda y lo que tienes a la derecha
      card.add(scene.add.text(-cw / 2 + 22, 26, 'TU APUESTA', { fontFamily: FONT, fontSize: '16px', color: '#9fb0d8' }).setOrigin(0, 0.5).setLetterSpacing(3));
      const haveT = scene.add.text(cw / 2 - 22, 26, fmtCoins(have), { fontFamily: FONT, fontSize: '19px', color: '#e6d2ff' }).setOrigin(1, 0.5);
      card.add(haveT);
      card.add(coin2v2Icon(scene, cw / 2 - 22 - haveT.width - 16, 26, 10));
      card.add(scene.add.text(cw / 2 - 22 - haveT.width - 34, 26, 'TIENES', { fontFamily: FONT, fontSize: '12px', color: '#7f93bf' }).setOrigin(1, 0.5).setLetterSpacing(2));
      // el monto GRANDE con su moneda
      const amount = scene.add.text(0, 0, fmtCoins(st.risk), { fontFamily: FONT, fontSize: '68px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 9 }).setOrigin(0, 0.5);
      const coinD = 58;
      const total = coinD + 14 + amount.width;
      const rowY = 84;
      card.add(coin2v2Icon(scene, -total / 2 + coinD / 2, rowY, coinD / 2 - 2));
      amount.setPosition(-total / 2 + coinD + 14, rowY + 2);
      card.add(amount);
      // INTERRUPTOR x1 | x2: las dos opciones a la vista; la elegida, rellena
      const sw = 230;
      const sh = 46;
      const sy = 142;
      const can2 = stakeOf(2).affordable;
      const sg = scene.add.graphics();
      sg.fillStyle(0x05091c, 1).fillRoundedRect(-sw / 2, sy - sh / 2, sw, sh, sh / 2);
      sg.lineStyle(2, 0x2c3d66, 1).strokeRoundedRect(-sw / 2, sy - sh / 2, sw, sh, sh / 2);
      const segW = sw / 2 - 5;
      const segX = x2 ? sw / 4 : -sw / 4;
      sg.fillStyle(x2 ? RED : 0x2f7bff, 1).fillRoundedRect(segX - segW / 2, sy - sh / 2 + 5, segW, sh - 10, (sh - 10) / 2);
      sg.fillStyle(0xffffff, 0.22).fillRoundedRect(segX - segW / 2 + 8, sy - sh / 2 + 8, segW - 16, 10, 5);
      card.add(sg);
      card.add(scene.add.text(-sw / 4, sy + 1, 'x1', { fontFamily: FONT, fontSize: '26px', color: x2 ? '#7f93bf' : '#ffffff' }).setOrigin(0.5));
      card.add(scene.add.text(sw / 4 + (can2 ? 0 : 10), sy + 1, 'x2', { fontFamily: FONT, fontSize: '26px', color: x2 ? '#ffffff' : can2 ? '#ff9aa3' : '#56688f' }).setOrigin(0.5));
      if (!can2) {
        // candado chico a la izquierda del x2 (no hay monedas 2v2 para cubrirlo)
        const lk = scene.add.graphics({ x: sw / 4 - 22, y: sy + 2 });
        lk.lineStyle(3, 0x56688f, 1).beginPath().arc(0, -3, 5, Math.PI, 0).strokePath();
        lk.fillStyle(0x56688f, 1).fillRoundedRect(-7, -3, 14, 11, 3);
        card.add(lk);
      }
      const warn = scene.add.text(0, sy + sh / 2 + 14, '', { fontFamily: FONT, fontSize: '13px', color: '#ff9aa3' }).setOrigin(0.5).setLetterSpacing(1);
      card.add(warn);
      const pick = (next: number) => {
        if (next === bet) return;
        if (!stakeOf(next).affordable) {
          scene.tweens.add({ targets: warn, alpha: { from: 0.2, to: 1 }, duration: 120, yoyo: true, repeat: 1 });
          warn.setText(`PARA APOSTAR x2 NECESITAS ${stakeOf(2).risk} MONEDAS 2V2`);
          return;
        }
        saveBet2v2(next);
        scene.time.delayedCall(0, () => {
          if (!card.active) return;
          paint();
          onChange?.();
        });
      };
      for (const [zx, val] of [[-sw / 4, 1], [sw / 4, 2]] as const) {
        const z = scene.add.zone(zx, sy, sw / 2 + 8, sh + 16).setInteractive({ useHandCursor: true });
        z.on('pointerup', () => pick(val));
        card.add(z);
      }
      // los dos resultados: SI GANAS (verde) y SI PIERDES (rojo), cada uno en su recuadro
      const tw = (cw - 56) / 2;
      const ty = 176;
      const th = 56;
      const tile = (cx: number, fill: number, line: number, label: string, labelCol: string, val: string, valCol: string) => {
        const tg = scene.add.graphics();
        tg.fillStyle(fill, 1).fillRoundedRect(cx - tw / 2, ty, tw, th, 14);
        tg.lineStyle(2, line, 1).strokeRoundedRect(cx - tw / 2, ty, tw, th, 14);
        card.add(tg);
        card.add(scene.add.text(cx - tw / 2 + 14, ty + 15, label, { fontFamily: FONT, fontSize: '13px', color: labelCol }).setOrigin(0, 0.5).setLetterSpacing(2));
        card.add(scene.add.text(cx - tw / 2 + 14, ty + 38, val, { fontFamily: FONT, fontSize: '28px', color: valCol, stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5));
        card.add(coin2v2Icon(scene, cx + tw / 2 - 28, ty + th / 2, 13));
      };
      tile(-tw / 2 - 8, 0x0e2e1d, 0x2fbf6a, 'SI GANAS', '#8fe8a8', `+${fmtCoins(st.prize)}`, '#5dff8a');
      tile(tw / 2 + 8, 0x34121a, RED, 'SI PIERDES', '#ffa3ad', `−${fmtCoins(st.risk)}`, '#ff6b78');
    };
    paint();
  }
  // JUGAR 2V2 arriba (el principal) e INVITAR AMIGO debajo, con aire entre los dos (los botones no cambian)
  const jy = plain ? top + HEAD + 70 : top + CARD_Y + CARD_H + 28 + 40;
  p.add(roundBtn(scene, 0, jy, bw, 80, 'JUGAR 2V2', 'yellow', () => { close(); onPlay(); }, 34));
  p.add(roundBtn(scene, 0, jy + 100, bw, 68, 'INVITAR AMIGO', 'blue', () => { close(); onInvite(); }, 26));
}

/** Botón simple de esquinas redondeadas (sin la forma inclinada de los botones arcade): amarillo, azul o fantasma (solo borde). */
function roundBtn(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, kind: 'yellow' | 'blue' | 'ghost', onClick: () => void, fontSize = 26) {
  const pal = {
    yellow: { top: 0xffe55a, bottom: 0xf29a0c, edge: 0x8a5200, text: '#1a1033', stroke: 0 },
    blue: { top: 0x5aa2ff, bottom: 0x1f58d6, edge: 0x0e2f7a, text: '#ffffff', stroke: 5 },
    ghost: { top: 0x1b1f45, bottom: 0x1b1f45, edge: PURPLE, text: '#e6d2ff', stroke: 0 },
  }[kind];
  const c = scene.add.container(x, y);
  const r = Math.min(20, h / 2);
  const g = scene.add.graphics();
  if (kind === 'ghost') {
    g.fillStyle(pal.bottom, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.lineStyle(2.5, pal.edge, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
  } else {
    g.fillStyle(pal.edge, 1).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, r); // base más oscura (relieve)
    g.fillStyle(pal.bottom, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r);
    g.fillStyle(pal.top, 1).fillRoundedRect(-w / 2 + 3, -h / 2 + 3, w - 6, h * 0.52, { tl: r - 3, tr: r - 3, bl: 8, br: 8 });
  }
  c.add(g);
  const t = scene.add.text(0, kind === 'ghost' ? 0 : 1, label, { fontFamily: FONT, fontSize: `${fontSize}px`, color: pal.text, stroke: '#0a1638', strokeThickness: pal.stroke }).setOrigin(0.5).setLetterSpacing(1);
  if (t.width > w - 24) t.setScale((w - 24) / t.width);
  c.add(t);
  c.setSize(w, h).setInteractive({ useHandCursor: true });
  c.on('pointerdown', () => scene.tweens.add({ targets: c, scale: 0.96, duration: 70 }));
  const up = () => scene.tweens.add({ targets: c, scale: 1, duration: 140, ease: 'Back.easeOut' });
  c.on('pointerup', () => {
    up();
    onClick();
  });
  c.on('pointerout', up);
  return c;
}

/** Elegir la apuesta del 2v2: NORMAL (x1) o x2, con lo que arriesgas y lo que ganas en monedas 2v2. */
function openBetPicker2v2(scene: Phaser.Scene, current: number, onPicked: () => void) {
  const coins = Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0));
  const pw = Math.min(620, scene.scale.width - 40);
  const ph = 440;
  const { p, close } = modal(scene, pw, ph, PURPLE);
  p.add(scene.add.text(0, -ph / 2 + 44, 'ELIGE TU APUESTA', { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  p.add(scene.add.text(0, -ph / 2 + 82, `LIGA 2V2 · tus monedas 2v2: ${fmtCoins(coins)}`, { fontFamily: FONT, fontSize: '18px', color: '#cdb6ff' }).setOrigin(0.5));
  const cw = (pw - 56) / 2;
  stakes2v2(coins).forEach((sk, i) => {
    const cx = (i === 0 ? -1 : 1) * (cw / 2 + 8);
    const cy = 30;
    const sel = sk.bet === current;
    const col = sk.bet > 1 ? RED : PURPLE;
    const g = scene.add.graphics();
    g.fillStyle(sel ? 0x1d2d5c : 0x111c3c, 1).fillRoundedRect(cx - cw / 2, cy - 100, cw, 214, 18);
    g.lineStyle(sel ? 4 : 2, sk.affordable ? col : 0x3a4a6a, 1).strokeRoundedRect(cx - cw / 2, cy - 100, cw, 214, 18);
    p.add(g);
    p.add(scene.add.text(cx, cy - 72, sk.bet > 1 ? 'APUESTA x2' : 'NORMAL', { fontFamily: FONT, fontSize: '24px', color: sk.bet > 1 ? '#ff9aa3' : '#d6c0ff' }).setOrigin(0.5));
    const row = (yy: number, lab: string, val: number, color: string) => {
      p.add(scene.add.text(cx - cw / 2 + 16, yy, lab, { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(0, 0.5));
      p.add(coin2v2Icon(scene, cx + cw / 2 - 22, yy, 11));
      p.add(scene.add.text(cx + cw / 2 - 40, yy, fmtCoins(val), { fontFamily: FONT, fontSize: '24px', color }).setOrigin(1, 0.5));
    };
    row(cy - 28, 'ARRIESGAS', sk.risk, '#ffffff');
    row(cy + 6, 'GANAS', sk.prize, '#9fe8a0');
    p.add(
      arcadeButton(scene, cx, cy + 62, cw - 64, 50, !sk.affordable ? 'SIN MONEDAS' : sel ? 'ELEGIDA' : 'ELEGIR', () => {
        if (!sk.affordable) return;
        saveBet2v2(sk.bet);
        onPicked();
        close();
      }, { palette: !sk.affordable ? 'grey' : sk.bet > 1 ? 'red' : 'yellow' }),
    );
  });
  p.add(scene.add.text(0, ph / 2 - 30, 'Si pierdes, restas lo que arriesgas. Tus monedas 2v2 nunca bajan de 0.', { fontFamily: FONT, fontSize: '15px', color: '#7f93bf', align: 'center', wordWrap: { width: pw - 40 } }).setOrigin(0.5));
}

/** (i) del 2v2: cuánto se arriesga y se gana, y que se puede apostar x2. */
function openDoublesInfo(scene: Phaser.Scene, openPicker: () => void) {
  const pw = Math.min(600, scene.scale.width - 40);
  const ph = 420;
  const { p, close } = modal(scene, pw, ph, PURPLE);
  p.add(scene.add.text(0, -ph / 2 + 44, 'PARTIDA 2V2', { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  const lines = [
    `En el 2v2 apuestas MONEDAS 2V2 (las del ranking 2v2). Si ganas, sumas ${COINS_2V2.win}; si pierdes, restas ${COINS_2V2.loss}; rendirte resta ${COINS_2V2.surrender}.`,
    `Con la apuesta x2 todo vale el doble: ganas ${COINS_2V2.win * 2} y arriesgas ${COINS_2V2.loss * 2}. Para apostar x2 necesitas al menos ${COINS_2V2.loss * 2} monedas 2v2.`,
    'Tus monedas 2v2 nunca bajan de 0.',
  ];
  p.add(scene.add.text(0, -10, lines.join('\n\n'), { fontFamily: FONT, fontSize: '19px', color: '#dbe5ff', align: 'center', wordWrap: { width: pw - 60 }, lineSpacing: 2 }).setOrigin(0.5));
  p.add(
    arcadeButton(scene, 0, ph / 2 - 56, 300, 70, 'APOSTAR x2', () => {
      close();
      openPicker();
    }, { palette: 'red' }),
  );
}

/** (20-11-2026, usuario) Panel de la búsqueda del 2v2 (liga 2v2 arriba; lo invertido y el premio en MONEDAS 2V2 abajo), con la apuesta de ahora. */
export function doublesSearchPanelNow(scene: Phaser.Scene): Phaser.GameObjects.GameObject[] {
  const coins = Math.max(0, Math.floor(getPlayer().coins2v2 ?? 0));
  const st = stakeOf(currentBet2v2());
  return doublesSearchPanel(scene, { bet: st.bet, risk: st.risk, prize: st.prize, friendly: friendly2v2(coins), icon: (x, y, r) => coin2v2Icon(scene, x, y, r), rank: league2v2Of(getPlayer()) });
}

/** (21-11-2026) liga 2v2 actual (por tus monedas 2v2): para precargar su emblema en la búsqueda */
export const league2v2Id = (): RankId => league2v2Of(getPlayer());
