/**
 * Diálogo del 2v2 (al tocar el botón). (21-11-2026, usuario: "mejoremos el diálogo, los botones están bien") Rediseñado:
 *   - CABECERA morada con la moneda 2v2, "2V2" y la pareja contra 2 bots;
 *   - tarjeta de APUESTA: "TU APUESTA" y "TIENES <monedas 2v2>", el monto GRANDE con su moneda, un INTERRUPTOR x1 | x2 con las dos opciones a la vista (el x2
 *     se atenúa con candado si no hay monedas para cubrirlo) y dos recuadros: SI GANAS (verde) y SI PIERDES (rojo);
 *   - los dos botones (JUGAR 2V2 e INVITAR AMIGO), sin cambios.
 * `plain` (modo desarrollo apagado) = solo cabecera y botones. `onChange` avisa de un cambio de apuesta (el botón del menú repinta su píldora).
 */
export function openDoublesDialog(scene: Phaser.Scene, opts: { plain: boolean; onPlay: () => void; onInvite: () => void; onChange?: () => void }) {
  const { plain, onPlay, onInvite, onChange } = opts;
  const pw = Math.min(560, scene.scale.width - 48);
  const HEAD = 100;
  const CARD_Y = HEAD + 22;
  const CARD_H = 250;
  const ph = plain ? 360 : CARD_Y + CARD_H + 28 + 80 + 20 + 68 + 36;
  const top = -ph / 2;
  const { p, close } = modal(scene, pw, ph, PURPLE);
  // --- cabecera morada (esquinas de arriba redondeadas como el panel) con la moneda 2v2 y el título
  const hg = scene.add.graphics();
  hg.fillStyle(0x4a1fb8, 1).fillRoundedRect(-pw / 2 + 3, top + 3, pw - 6, HEAD, { tl: 21, tr: 21, bl: 0, br: 0 });
  hg.fillStyle(0x7a3dff, 1).fillRoundedRect(-pw / 2 + 3, top + 3, pw - 6, HEAD * 0.55, { tl: 21, tr: 21, bl: 0, br: 0 });
  hg.fillStyle(0xffffff, 0.12).fillRoundedRect(-pw / 2 + 12, top + 9, pw - 24, 16, 8);
  hg.fillStyle(0x1d0a52, 1).fillRect(-pw / 2 + 3, top + 3 + HEAD - 3, pw - 6, 3);
  p.add(hg);
  const title = scene.add.text(0, top + 40, '2V2', { fontFamily: FONT, fontSize: '48px', color: '#ffffff', stroke: '#1d0a52', strokeThickness: 8 }).setOrigin(0.5).setLetterSpacing(5);
  p.add(title);
  p.add(coin2v2Icon(scene, -title.width / 2 - 38, top + 40, 22));
  p.add(coin2v2Icon(scene, title.width / 2 + 38, top + 40, 22));
  p.add(scene.add.text(0, top + 80, 'TÚ Y TU COMPAÑERO CONTRA 2 BOTS', { fontFamily: FONT, fontSize: '15px', color: '#e6d2ff' }).setOrigin(0.5).setLetterSpacing(2));
  const bw = Math.min(400, pw - 80);
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
