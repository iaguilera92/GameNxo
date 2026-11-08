import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';
import { drawCoinIcon } from './wheelArt';
import { LEAGUE_STYLE, fmtCoins } from './leagueStyle';
import { rankDef } from '../domain/ranks';
import { rankedView, syncRanked } from '../logic/Ranked';

const NAVY = 0x0a1638;
const GOLD = 0xffc42e;
const RED = 0xff4f5e;
const BET_KEY = 'gamenxo.menu.bet';

/** Apuesta elegida en el menú (solo comodidad de este dispositivo; si falla el almacenamiento, x1). */
function loadBet(): number {
  try {
    return localStorage.getItem(BET_KEY) === '2' ? 2 : 1;
  } catch {
    return 1;
  }
}
function saveBet(b: number) {
  try {
    localStorage.setItem(BET_KEY, String(b));
  } catch {
    /* sin almacenamiento */
  }
}

/**
 * Botón JUGAR del menú con la entrada Ranked de tu liga:
 *   [ JUGAR   (🪙 500 x1) (i) ]
 * - Tocar el monto abre la elección de apuesta (normal / x2).
 * - Tocar (i) explica cuánto se cobra en la liga y que se puede apostar x2.
 * - Tocar JUGAR juega con la apuesta elegida.
 * - Sin monedas ni para x1: muestra "AMISTOSO" (sin monto ni info) y juega sin apostar (`onPlay(null)`):
 *   rival de Ranked igual, gana EXP y ruleta, pero no monedas de apuesta.
 */
export function rankedPlayButton(scene: Phaser.Scene, x: number, y: number, w: number, h: number, onPlay: (bet: number | null) => void) {
  syncRanked();
  let bet = loadBet();
  const stakeFor = (b: number) => rankedView().stakes.find((s) => s.bet === b) ?? rankedView().stakes[0];
  // si la apuesta guardada no alcanza, se vuelve a x1
  if (!stakeFor(bet).affordable) bet = 1;

  const btn = arcadeButton(scene, x, y, w, h, 'JUGAR', () => {
    const st = stakeFor(bet);
    if (st.affordable) onPlay(bet);
    else if (bet > 1 && stakeFor(1).affordable) onPlay(1);
    else onPlay(null);
  }, { palette: 'yellow' }); // sin latido ni flecha: el monto y la (i) van encima
  const label = btn.getData('label') as Phaser.GameObjects.Text;

  // zona derecha: monto (tocable) + información, por encima del botón (reciben el toque ellos)
  const infoR = h * 0.15; // (i) compacto
  const infoX = x + w / 2 - 18 - infoR - h * 0.04; // margen por la forma inclinada
  const pillH = h * 0.56;
  // contenedor exterior = sigue al botón (posición/escala al aplastarse); interior = animaciones propias
  const pill = scene.add.container(0, y).setDepth(btn.depth + 1);
  const info = scene.add.container(infoX, y).setDepth(btn.depth + 1);
  const pillBody = scene.add.container(0, 0);
  const infoBody = scene.add.container(0, 0);
  pill.add(pillBody);
  info.add(infoBody);
  let pillBaseX = 0;

  /** sin monedas ni para la entrada x1: juega igual, sin apostar (sin ranking) */
  const unranked = () => !stakeFor(1).affordable;
  const drawPill = () => {
    pillBody.removeAll(true);
    const st = stakeFor(bet);
    const ur = unranked();
    const pw = ur ? drawUnrankedChip(scene, pillBody, pillH) : drawStakePill(scene, pillBody, st.entry, bet, pillH);
    info.setVisible(!ur);
    pill.setSize(pw, pillH + 16);
    pillBaseX = ur ? x + w / 2 - 18 - h * 0.04 - pw / 2 : infoX - infoR - 6 - pw / 2;
    pill.setX(pillBaseX);
    const leftEdge = x - w / 2 + h * 0.2;
    if (ur) {
      // AMISTOSO: "JUGAR" + etiqueta juntos y centrados en el botón
      label.setScale(1);
      const gap = 16;
      const total = label.width + gap + pw;
      const start = x - total / 2;
      label.setX(start + label.width / 2 - x);
      pillBaseX = start + label.width + gap + pw / 2;
      pill.setX(pillBaseX);
      return;
    }
    // "JUGAR" centrado en el espacio que queda a la izquierda
    const freeW = pillBaseX - pw / 2 - 10 - leftEdge;
    label.setScale(Math.min(1, (freeW * 0.92) / Math.max(1, label.width)));
    label.setX(leftEdge + freeW / 2 - x);
  };
  drawPill();
  pill.setInteractive({ useHandCursor: true });
  pill.on('pointerup', () => {
    scene.tweens.add({ targets: pillBody, scale: { from: 0.9, to: 1 }, duration: 200, ease: 'Back.easeOut' });
    if (unranked()) return openUnrankedInfo(scene);
    openBetPicker(scene, bet, (b) => {
      bet = b;
      saveBet(b);
      drawPill();
    });
  });

  // icono informativo (i)
  const ig = scene.add.graphics();
  ig.fillStyle(0x000000, 0.25).fillCircle(1, 3, infoR);
  ig.fillStyle(NAVY, 0.92).fillCircle(0, 0, infoR);
  ig.lineStyle(2, 0xffffff, 0.95).strokeCircle(0, 0, infoR);
  const it = scene.add.text(0, 1, 'i', { fontFamily: FONT, fontSize: `${Math.round(infoR * 1.35)}px`, color: '#ffffff' }).setOrigin(0.5);
  infoBody.add([ig, it]);
  info.setSize(infoR * 2 + 22, infoR * 2 + 30).setInteractive({ useHandCursor: true });
  // latido suave para que se note
  scene.tweens.add({ targets: infoBody, scale: 1.12, duration: 700, yoyo: true, repeat: -1, repeatDelay: 1600, ease: 'Sine.easeInOut' });
  info.on('pointerup', () => openPlayInfo(scene, () => pill.emit('pointerup')));

  // al presionar JUGAR el botón se aplasta (su contenedor interior escala): monto e (i) lo acompañan
  const inner = btn.list[0] as Phaser.GameObjects.Container;
  const follow = () => {
    if (!btn.active || !pill.active) return;
    const k = inner.scaleX;
    pill.setScale(k).setPosition(x + (pillBaseX - x) * k, y + inner.y * k);
    info.setScale(k).setPosition(x + (infoX - x) * k, y + inner.y * k);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, follow);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, follow));

  // el botón reajusta su texto al cargar la fuente: se vuelve a colocar después
  document.fonts?.ready.then(() => pill.active && drawPill()).catch(() => undefined);
  return btn;
}

/** Píldora de apuesta "🪙 500 x1" (centrada en 0,0 del contenedor). Devuelve su ancho. */
export function drawStakePill(scene: Phaser.Scene, into: Phaser.GameObjects.Container, entry: number, bet: number, pillH: number) {
  const x2 = bet > 1;
  const amount = scene.add.text(0, 0, fmtCoins(entry), { fontFamily: FONT, fontSize: `${Math.round(pillH * 0.56)}px`, color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0, 0.5);
  const chip = scene.add.text(0, 0, x2 ? 'x2' : 'x1', { fontFamily: FONT, fontSize: `${Math.round(pillH * 0.36)}px`, color: '#ffffff' }).setOrigin(0.5);
  const coinR = pillH * 0.3;
  const chipW = chip.width + 16;
  const pw = 10 + coinR * 2 + 8 + amount.width + 10 + chipW + 8;
  const g = scene.add.graphics();
  // sombra, cuerpo navy y borde dorado (rojo con x2)
  g.fillStyle(0x000000, 0.25).fillRoundedRect(-pw / 2 + 2, -pillH / 2 + 4, pw, pillH, pillH / 2);
  g.fillStyle(NAVY, 0.92).fillRoundedRect(-pw / 2, -pillH / 2, pw, pillH, pillH / 2);
  g.lineStyle(3, x2 ? RED : GOLD, 1).strokeRoundedRect(-pw / 2, -pillH / 2, pw, pillH, pillH / 2);
  g.fillStyle(0xffffff, 0.12).fillRoundedRect(-pw / 2 + 6, -pillH / 2 + 4, pw - 12, pillH * 0.3, pillH * 0.15);
  const ic = scene.add.graphics({ x: -pw / 2 + 10 + coinR, y: 0 });
  drawCoinIcon(ic, coinR);
  amount.setX(-pw / 2 + 10 + coinR * 2 + 8);
  const chipX = pw / 2 - 8 - chipW / 2;
  const cg = scene.add.graphics();
  cg.fillStyle(x2 ? RED : 0x2f7bff, 1).fillRoundedRect(chipX - chipW / 2, -pillH * 0.3, chipW, pillH * 0.6, pillH * 0.3);
  chip.setX(chipX);
  into.add([g, ic, amount, cg, chip]);
  return pw;
}

/** Etiqueta "AMISTOSO" (sin monedas para la entrada). Devuelve su ancho. */
export function drawUnrankedChip(scene: Phaser.Scene, into: Phaser.GameObjects.Container, pillH: number) {
  const t = scene.add.text(0, 0, 'AMISTOSO', { fontFamily: FONT, fontSize: `${Math.round(pillH * 0.4)}px`, color: '#cfd8ee' }).setOrigin(0.5).setLetterSpacing(1);
  const pw = t.width + 30;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.22).fillRoundedRect(-pw / 2 + 2, -pillH / 2 + 4, pw, pillH, pillH / 2);
  g.fillStyle(0x2e374c, 0.95).fillRoundedRect(-pw / 2, -pillH / 2, pw, pillH, pillH / 2);
  g.lineStyle(2, 0x8d99b5, 1).strokeRoundedRect(-pw / 2, -pillH / 2, pw, pillH, pillH / 2);
  into.add([g, t]);
  return pw;
}

/** Qué significa jugar AMISTOSO. */
export function openUnrankedInfo(scene: Phaser.Scene, onClose?: () => void) {
  const v = rankedView();
  const n = v.stakes[0];
  const pw = Math.min(600, scene.scale.width - 40);
  const ph = 400;
  const { p, close } = modal(scene, pw, ph, 0x8d99b5, onClose);
  p.add(scene.add.text(0, -ph / 2 + 44, 'AMISTOSO', { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  const lines = [
    `No te alcanzan las monedas para la entrada (${fmtCoins(n.entry)}).`,
    'Igual juegas contra rivales de Ranked, pero sin apostar: no ganas monedas de apuesta.',
    'Sí ganas EXP y ruletas. Consigue monedas en ruletas, premio diario y pase para volver a Ranked.',
  ];
  p.add(scene.add.text(0, -6, lines.join('\n\n'), { fontFamily: FONT, fontSize: '19px', color: '#dbe5ff', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5));
  p.add(arcadeButton(scene, 0, ph / 2 - 56, 260, 70, 'ENTENDIDO', close, { palette: 'blue' }));
}

/** Icono informativo (i) que abre la explicación de la partida Ranked. */
export function infoIcon(scene: Phaser.Scene, x: number, y: number, r: number, onOpenPicker?: () => void, hooks?: { onOpen?: () => void; onClose?: () => void; unranked?: boolean }) {
  const c = scene.add.container(x, y);
  const body = scene.add.container(0, 0);
  const ig = scene.add.graphics();
  ig.fillStyle(0x000000, 0.25).fillCircle(1, 3, r);
  ig.fillStyle(NAVY, 0.92).fillCircle(0, 0, r);
  ig.lineStyle(2, 0xffffff, 0.95).strokeCircle(0, 0, r);
  body.add([ig, scene.add.text(0, 1, 'i', { fontFamily: FONT, fontSize: `${Math.round(r * 1.35)}px`, color: '#ffffff' }).setOrigin(0.5)]);
  c.add(body);
  c.setSize(r * 2 + 22, r * 2 + 30).setInteractive({ useHandCursor: true });
  scene.tweens.add({ targets: body, scale: 1.12, duration: 700, yoyo: true, repeat: -1, repeatDelay: 1600, ease: 'Sine.easeInOut' });
  c.on('pointerup', () => {
    hooks?.onOpen?.();
    if (hooks?.unranked) openUnrankedInfo(scene, hooks.onClose);
    else openPlayInfo(scene, onOpenPicker, hooks?.onClose);
  });
  return c;
}

/** Ventana pequeña común. Devuelve el contenedor del panel y la función para cerrar. */
function modal(scene: Phaser.Scene, pw: number, ph: number, line: number, onClose?: () => void) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.72).setOrigin(0).setDepth(8000).setInteractive();
  const p = scene.add.container(W / 2, H / 2).setDepth(8001);
  const close = () => {
    if (!p.active) return;
    shade.destroy();
    p.destroy();
    onClose?.();
  };
  shade.on('pointerup', close);
  p.add(scene.add.rectangle(0, 0, pw, ph, 0, 0.001).setInteractive());
  const g = scene.add.graphics();
  g.lineStyle(10, line, 0.25).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  g.fillStyle(0x0b1733, 0.98).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  g.lineStyle(3, line, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  p.add(g);
  const x = scene.add.text(pw / 2 - 30, -ph / 2 + 32, '✕', { fontFamily: FONT, fontSize: '28px', color: '#9fb4e0' }).setOrigin(0.5).setInteractive({ useHandCursor: true });
  x.on('pointerup', close);
  p.add(x);
  p.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: p, scale: 1, alpha: 1, duration: 240, ease: 'Back.easeOut' });
  return { p, close };
}

/** Elegir apuesta: NORMAL o x2 (entrada y premio de tu liga). */
function openBetPicker(scene: Phaser.Scene, current: number, onPick: (bet: number) => void) {
  const v = rankedView();
  const st = LEAGUE_STYLE[v.league];
  const pw = Math.min(620, scene.scale.width - 40);
  const ph = 440;
  const { p, close } = modal(scene, pw, ph, GOLD);
  p.add(scene.add.text(0, -ph / 2 + 44, 'ELIGE TU APUESTA', { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  p.add(scene.add.text(0, -ph / 2 + 82, `Liga ${rankDef(v.league).name} · tu saldo ${fmtCoins(v.coins)}`, { fontFamily: FONT, fontSize: '18px', color: st.css }).setOrigin(0.5));
  const cw = (pw - 56) / 2;
  v.stakes.forEach((sk, i) => {
    const cx = (i === 0 ? -1 : 1) * (cw / 2 + 8);
    const cy = 30;
    const sel = sk.bet === current;
    const col = sk.bet > 1 ? RED : GOLD;
    const g = scene.add.graphics();
    g.fillStyle(sel ? 0x1d2d5c : 0x111c3c, 1).fillRoundedRect(cx - cw / 2, cy - 100, cw, 214, 18);
    g.lineStyle(sel ? 4 : 2, sk.affordable ? col : 0x3a4a6a, 1).strokeRoundedRect(cx - cw / 2, cy - 100, cw, 214, 18);
    p.add(g);
    p.add(scene.add.text(cx, cy - 72, sk.bet > 1 ? 'APUESTA x2' : 'NORMAL', { fontFamily: FONT, fontSize: '24px', color: sk.bet > 1 ? '#ff9aa3' : '#ffd23f' }).setOrigin(0.5));
    const row = (yy: number, lab: string, val: number, color: string) => {
      p.add(scene.add.text(cx - cw / 2 + 16, yy, lab, { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(0, 0.5));
      const ic = scene.add.graphics({ x: cx + cw / 2 - 22, y: yy });
      drawCoinIcon(ic, 11);
      p.add(ic);
      p.add(scene.add.text(cx + cw / 2 - 40, yy, fmtCoins(val), { fontFamily: FONT, fontSize: '24px', color }).setOrigin(1, 0.5));
    };
    row(cy - 28, 'PAGAS', sk.entry, '#ffffff');
    row(cy + 6, 'GANAS', sk.prize, '#9fe8a0');
    p.add(
      arcadeButton(scene, cx, cy + 62, cw - 64, 50, !sk.affordable ? 'SIN MONEDAS' : sel ? 'ELEGIDA' : 'ELEGIR', () => {
        if (!sk.affordable) return;
        onPick(sk.bet);
        close();
      }, { palette: !sk.affordable ? 'grey' : sk.bet > 1 ? 'red' : 'yellow' }),
    );
  });
  p.add(scene.add.text(0, ph / 2 - 30, 'Si pierdes, pierdes lo que pagaste. El rival no apuesta.', { fontFamily: FONT, fontSize: '15px', color: '#7f93bf' }).setOrigin(0.5));
}

/** (i): cuánto se cobra en la liga y que se puede apostar x2. */
export function openPlayInfo(scene: Phaser.Scene, openPicker?: () => void, onClose?: () => void) {
  const v = rankedView();
  const st = LEAGUE_STYLE[v.league];
  const n = v.stakes[0];
  const x2 = v.stakes.find((s) => s.bet === 2);
  const pw = Math.min(600, scene.scale.width - 40);
  const ph = 400;
  const { p, close } = modal(scene, pw, ph, 0x3a7bff, onClose);
  p.add(scene.add.text(0, -ph / 2 + 44, 'PARTIDA RANKED', { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  p.add(scene.add.text(0, -ph / 2 + 84, `LIGA ${rankDef(v.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '22px', color: st.css }).setOrigin(0.5).setLetterSpacing(2));
  const lines = [
    `En esta liga cada partida cuesta ${fmtCoins(n.entry)} monedas. Si ganas, recibes ${fmtCoins(n.prize)}.`,
    x2 ? `¡Ahora puedes apostar x2! Pagas ${fmtCoins(x2.entry)} y, si ganas, recibes ${fmtCoins(x2.prize)}.` : '',
    openPicker ? 'Toca el monto del botón JUGAR para cambiar la apuesta.' : 'Si pierdes, pierdes lo que pagaste. Rendirse no cuenta para la semana.',
  ].filter(Boolean);
  p.add(scene.add.text(0, -10, lines.join('\n\n'), { fontFamily: FONT, fontSize: '19px', color: '#dbe5ff', align: 'center', wordWrap: { width: pw - 60 }, lineSpacing: 2 }).setOrigin(0.5));
  if (openPicker)
    p.add(
      arcadeButton(scene, 0, ph / 2 - 56, 300, 70, 'APOSTAR x2', () => {
        close();
        openPicker();
      }, { palette: 'red' }),
    );
  else p.add(arcadeButton(scene, 0, ph / 2 - 56, 260, 70, 'ENTENDIDO', close, { palette: 'blue' }));
}
