import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { arcadeButton } from './modeButtons';
import { RARITY_LABEL, type ItemRarity, clpLabel } from '../domain/shopCatalog';
import { RARITY_STYLE } from './rarity';
import { drawCashIcon } from '../scenes/BattlePassScene';
import type { DemoRect, PowerDemo } from './PowerDialog';
import { bakeGraphics } from './bakeGraphics';

/**
 * VER EN ACCIÓN desde la TIENDA (16-11-2026, pedido del usuario): la misma pantalla "EN ACCIÓN" del selector de PERSONALIZAR (tu personaje contra la
 * máquina de pelotas, fx/powerDemo.ts), pero para un artículo que aún no tienes. Sin lista de otros poderes ni EQUIPAR: solo la demostración y los
 * botones de COMPRAR con dinero virtual y con dinero real (CLP). Lo LEGENDARIO no se muestra (la Tienda no pone el botón VER).
 */
export interface ShopPreviewOpts {
  /** "EFECTO DE PELOTA" / "DEFENSIVO"… */
  kindLabel: string;
  name: string;
  /** frase corta bajo el nombre (qué hace) */
  desc: string;
  color: number;
  rarity?: ItemRarity;
  /** crea la demostración en `parent` (pantalla completa `outer`, hueco entre las barras de cine `inner`) */
  demo: (parent: Phaser.GameObjects.Container, outer: DemoRect, inner: DemoRect) => PowerDemo;
  /** ya lo tienes: en vez de comprar sale el botón gris COMPRADO (la Tienda no equipa) */
  owned: boolean;
  /** MODO DESARROLLO: aunque ya sea tuyo, salen los precios (dinero virtual y CLP) en vez de COMPRADO */
  showPrices?: boolean;
  /** precio en dinero virtual; null = solo dinero real (épico) */
  price: number | null;
  /** el botón de dinero virtual sale apagado (nivel o saldo insuficiente) */
  priceDim: boolean;
  clp: number;
  onBuyCash: () => void;
  onBuyReal: () => void;
}

export function openShopPreview(scene: Phaser.Scene, o: ShopPreviewOpts) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(8500);
  let demo: PowerDemo | null = null;
  let prepare: Phaser.Time.TimerEvent | undefined;
  let closed = false;
  const stopDemo = () => {
    prepare?.remove();
    prepare = undefined;
    demo?.destroy();
    demo = null;
  };
  root.once(Phaser.GameObjects.Events.DESTROY, stopDemo);
  const dim = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.84).setOrigin(0).setInteractive();
  root.add(dim);

  const pw = W - 40;
  const px = 20;
  const tvH = Phaser.Math.Clamp(Math.round(H * 0.42), 360, 620);
  const ph = 84 + tvH + 112 + 150;
  const py = Math.round((H - ph) / 2);
  const panel = scene.add.container(0, 0);
  root.add(panel);
  panel.add(scene.add.zone(px + pw / 2, py + ph / 2, pw, ph).setInteractive()); // tocar el panel no cierra
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.45).fillRoundedRect(px + 4, py + 8, pw, ph, 24);
  bg.fillStyle(0x0b1a3d, 1).fillRoundedRect(px, py, pw, ph, 24);
  // (21-11-2026, usuario) el brillo de la cabecera llega hasta el cuadro EN ACCIÓN (antes terminaba a los 54 px y dejaba una franja más oscura entre el título y el cuadro)
  bg.fillStyle(0xffffff, 0.06).fillRoundedRect(px + 3, py + 3, pw - 6, 84 - 3, { tl: 21, tr: 21, bl: 0, br: 0 });
  bg.lineStyle(3, o.color, 1).strokeRoundedRect(px, py, pw, ph, 24);
  panel.add(bg);

  // cabecera: tipo de artículo y rareza
  const title = scene.add.text(px + pw / 2, py + 40, o.kindLabel, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
  fitText(title, pw - 140);
  panel.add(title);

  const close = () => {
    if (closed) return;
    closed = true;
    stopDemo();
    scene.tweens.add({ targets: root, alpha: 0, duration: 120, onComplete: () => root.destroy() });
  };
  dim.on('pointerup', close);
  const xg = scene.add.graphics({ x: px + pw - 38, y: py + 40 });
  xg.lineStyle(9, 0x06112b, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  xg.lineStyle(5, 0xffffff, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  const xHit = scene.add.zone(px + pw - 38, py + 40, 60, 60).setInteractive({ useHandCursor: true });
  xHit.on('pointerup', close);
  panel.add([xg, xHit]);

  // ---------------------------------------------------------------- pantalla EN ACCIÓN (de borde a borde)
  const sx = px;
  const sy = py + 84;
  const sw = pw;
  const sh = tvH;
  const tv = scene.add.graphics();
  tv.fillStyle(0x040a1a, 1).fillRect(sx, sy, sw, sh);
  panel.add(tv);
  const maskG = scene.make.graphics({}, false);
  maskG.fillRect(sx, sy, sw, sh);
  const mask = maskG.createGeometryMask();
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    mask.destroy();
    maskG.destroy();
  });
  const demoRoot = scene.add.container(0, 0);
  demoRoot.setMask(mask);
  panel.add(demoRoot);
  // (21-11-2026) la MISMA pantalla "En acción" de PERSONALIZAR (ui/PowerDialog.ts): sin barras de cine, la demostración ocupa toda la pantalla y solo
  // lleva el rótulo "● EN ACCIÓN · NOMBRE" arriba a la izquierda
  const dot = scene.add.circle(sx + 24, sy + 24, 5, 0xff4f5e, 1);
  const cap = scene.add.text(sx + 38, sy + 24, `EN ACCIÓN · ${o.name.toUpperCase()}`, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#061431', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(2);
  fitText(cap, sw - 60);
  const loading = scene.add.text(sx + sw / 2, sy + sh / 2, 'Preparando demostración…', { fontFamily: FONT, fontSize: '20px', color: '#b9cdee' }).setOrigin(0.5);
  panel.add([dot, cap, loading]);
  scene.tweens.add({ targets: dot, alpha: 0.25, duration: 520, yoyo: true, repeat: -1 });
  // líneas de la pantalla: ~120 rectángulos que un Graphics recorrería en cada fotograma; pintadas una vez en una textura
  const scan = bakeGraphics(scene, `shop-bake-scan-${sw}x${sh}`, { x0: 0, y0: 0, w: sw, h: sh }, 1, (g) => {
    g.fillStyle(0xffffff, 0.035);
    for (let y = 2; y < sh - 2; y += 4) g.fillRect(4, y, sw - 8, 1.5);
  });
  scan.setPosition(sx, sy);
  panel.add(scan);

  // ---------------------------------------------------------------- nombre, rareza y descripción
  const iy = sy + sh + 22;
  const nm = scene.add.text(px + 28, iy + 6, o.name.toUpperCase(), { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0, 0);
  fitText(nm, pw - 220);
  panel.add(nm);
  if (o.rarity) {
    const rs = RARITY_STYLE[o.rarity];
    const rt = scene.add.text(0, iy + 26, RARITY_LABEL[o.rarity], { fontFamily: FONT, fontSize: '15px', color: '#ffffff' }).setOrigin(1, 0.5).setLetterSpacing(1.5);
    const rw = rt.width + 26;
    const rg = scene.add.graphics();
    rg.fillStyle(rs.main, 1).fillRoundedRect(px + pw - 26 - rw, iy + 12, rw, 28, 14);
    rt.setX(px + pw - 26 - 13);
    panel.add([rg, rt]);
  }
  const ds = scene.add.text(px + 28, iy + 50, o.desc, { fontFamily: FONT, fontSize: '16px', color: '#9fb4e0', wordWrap: { width: pw - 56 } }).setOrigin(0, 0);
  panel.add(ds);

  // ---------------------------------------------------------------- comprar: dinero virtual y dinero real
  const by = py + ph - 74;
  if (o.owned && !o.showPrices) {
    // ya es tuyo: en la Tienda solo se compra y se ve; se equipa en PERSONALIZAR. Botón gris apagado "COMPRADO" (sin interacción)
    panel.add(arcadeButton(scene, px + pw / 2, by, Math.min(360, pw - 56), 64, 'COMPRADO', () => undefined, { palette: 'grey', disabled: true }));
  } else {
    const gap = 16;
    const two = o.price != null;
    const bw = two ? (pw - 56 - gap) / 2 : Math.min(360, pw - 56);
    const h = 68;
    const press = (c: Phaser.GameObjects.Container, fn: () => void) => {
      c.setSize(bw, h).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        if (closed) return;
        scene.tweens.add({ targets: c, scale: { from: 0.92, to: 1 }, duration: 200, ease: 'Back.easeOut' });
        fn();
      });
    };
    if (two) {
      // (21-11-2026, usuario) DINERO VIRTUAL: PÍLDORA redonda, amarilla, con la insignia circular del billete a la izquierda; "COMPRAR" chico y la cifra grande
      const c = scene.add.container(px + 28 + bw / 2, by);
      const g = scene.add.graphics();
      const dim = o.priceDim;
      g.fillStyle(0x0a1638, 1).fillRoundedRect(-bw / 2 - 3, -h / 2 - 3, bw + 6, h + 6, h / 2 + 3);
      g.fillStyle(dim ? 0x5a4a20 : 0xf29a0c, 1).fillRoundedRect(-bw / 2, -h / 2, bw, h, h / 2);
      g.fillStyle(dim ? 0x6e5c2a : 0xffcc1f, 1).fillRoundedRect(-bw / 2 + 4, -h / 2 + 3, bw - 8, h * 0.55, { tl: h / 2 - 3, tr: h / 2 - 3, bl: 12, br: 12 });
      g.fillStyle(0xffffff, dim ? 0.08 : 0.3).fillRoundedRect(-bw / 2 + 30, -h / 2 + 7, bw - 60, 8, 4);
      // insignia circular (azul oscuro) con el billete
      const bx = -bw / 2 + h / 2;
      g.fillStyle(0x0a1638, 1).fillCircle(bx, 0, h / 2 - 7);
      g.lineStyle(3, dim ? 0x8a7840 : 0xffe680, 1).strokeCircle(bx, 0, h / 2 - 7);
      let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
      const ck = o.price! > 1 && scene.textures.exists('cash-pack') ? 'cash-pack' : 'cash-1';
      if (scene.textures.exists(ck)) icon = scene.add.image(bx, 0, ck).setDisplaySize(36, 36);
      else drawCashIcon((icon = scene.add.graphics({ x: bx, y: 0 })), 0.85);
      const tx = bx + h / 2 - 2;
      const area = bw - (tx + bw / 2) - 16;
      const t1 = scene.add.text(tx + area / 2, -16, 'COMPRAR', { fontFamily: FONT, fontSize: '13px', color: dim ? '#c9b98a' : '#7a4a00' }).setOrigin(0.5).setLetterSpacing(2);
      const t2 = scene.add.text(tx + area / 2, 9, o.price!.toLocaleString('es-CL'), { fontFamily: FONT, fontSize: '30px', color: dim ? '#c9b98a' : '#0a1638' }).setOrigin(0.5);
      fitText(t2, area);
      c.add([g, icon, t1, t2]);
      press(c, () => {
        close();
        o.onBuyCash();
      });
      panel.add(c);
    }
    // (21-11-2026, usuario) DINERO REAL: boceto de TICKET verde de esquinas cortadas, con la talonera oscura del "$" a la izquierda (otra forma que la píldora)
    const rx = two ? px + 28 + bw + gap + bw / 2 : px + pw / 2;
    const rc = scene.add.container(rx, by);
    const rg = scene.add.graphics();
    const cut = 16;
    const hw = bw / 2;
    const hh = h / 2;
    const poly = (ox: number, k: number) => [
      { x: -hw - ox + cut, y: -hh - ox },
      { x: hw + ox - cut, y: -hh - ox },
      { x: hw + ox, y: -hh - ox + cut },
      { x: hw + ox, y: hh + ox - cut },
      { x: hw + ox - cut, y: hh + ox },
      { x: -hw - ox + cut, y: hh + ox },
      { x: -hw - ox, y: hh + ox - cut },
      { x: -hw - ox, y: -hh - ox + cut },
    ].map((p) => ({ x: p.x * k, y: p.y }));
    rg.fillStyle(0x0a1638, 1).fillPoints(poly(3, 1), true);
    rg.fillStyle(0x1f9a3c, 1).fillPoints(poly(0, 1), true);
    rg.fillStyle(0x4cd964, 1).fillPoints([{ x: -hw + cut, y: -hh }, { x: hw - cut, y: -hh }, { x: hw, y: -hh + cut }, { x: hw, y: 2 }, { x: -hw, y: 2 }, { x: -hw, y: -hh + cut }], true);
    rg.fillStyle(0xffffff, 0.28).fillRoundedRect(-hw + 90, -hh + 6, bw - 130, 8, 4);
    // talonera oscura con borde inclinado + línea punteada
    const sw = 64;
    rg.fillStyle(0x0f5a24, 1).fillPoints([{ x: -hw + cut, y: -hh }, { x: -hw + sw + 12, y: -hh }, { x: -hw + sw - 12, y: hh }, { x: -hw + cut, y: hh }, { x: -hw, y: hh - cut }, { x: -hw, y: -hh + cut }], true);
    for (let k = 0; k < 6; k++) rg.fillStyle(0xbff5c8, 0.9).fillRect(-hw + sw + 12 - (24 * (8 + k * 10)) / h - 5, -hh + 6 + k * 10, 3, 5);
    const dollar = scene.add.text(-hw + 30, 0, '$', { fontFamily: FONT, fontSize: '38px', color: '#d8ffe0', stroke: '#06381a', strokeThickness: 5 }).setOrigin(0.5);
    const rtx = -hw + sw + 12;
    const rarea = hw - rtx - 14;
    const r1 = scene.add.text(rtx + rarea / 2, -16, 'PRÓXIMAMENTE', { fontFamily: FONT, fontSize: '13px', color: '#0d4a1f' }).setOrigin(0.5).setLetterSpacing(1);
    fitText(r1, rarea);
    const r2 = scene.add.text(rtx + rarea / 2, 9, clpLabel(o.clp), { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a3a18', strokeThickness: 5 }).setOrigin(0.5);
    fitText(r2, rarea);
    rc.add([rg, dollar, r1, r2]);
    press(rc, () => o.onBuyReal());
    panel.add(rc);
  }
  // el borde del diálogo por encima de la pantalla (que va de borde a borde y lo tapaba por los lados)
  const frame = scene.add.graphics();
  frame.lineStyle(3, o.color, 1).strokeRoundedRect(px, py, pw, ph, 24);
  panel.add(frame);

  // Deja que aparezca el diálogo antes de construir la cancha y los efectos.
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  prepare = scene.time.delayedCall(80, () => {
    prepare = undefined;
    loading.setVisible(false);
    demo = o.demo(demoRoot, { x: sx, y: sy, w: sw, h: sh }, { x: sx, y: sy + 30, w: sw, h: sh - 30 - 40 });
    demo.setActive(true);
  });
  return root;
}
