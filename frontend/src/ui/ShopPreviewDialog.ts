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
  let closed = false;
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
  bg.fillStyle(0xffffff, 0.06).fillRoundedRect(px + 3, py + 3, pw - 6, 54, { tl: 21, tr: 21, bl: 0, br: 0 });
  bg.lineStyle(3, o.color, 1).strokeRoundedRect(px, py, pw, ph, 24);
  panel.add(bg);

  // cabecera: tipo de artículo y rareza
  const title = scene.add.text(px + pw / 2, py + 40, o.kindLabel, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
  fitText(title, pw - 140);
  panel.add(title);

  const close = () => {
    if (closed) return;
    closed = true;
    demo?.destroy();
    demo = null;
    dim.disableInteractive();
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
  root.once(Phaser.GameObjects.Events.DESTROY, () => maskG.destroy());
  const demoRoot = scene.add.container(0, 0);
  demoRoot.setMask(mask);
  panel.add(demoRoot);
  // (21-11-2026) la MISMA pantalla "En acción" de PERSONALIZAR (ui/PowerDialog.ts): sin barras de cine, la demostración ocupa toda la pantalla y solo
  // lleva el rótulo "● EN ACCIÓN · NOMBRE" arriba a la izquierda
  const dot = scene.add.circle(sx + 24, sy + 24, 5, 0xff4f5e, 1);
  const cap = scene.add.text(sx + 38, sy + 24, `EN ACCIÓN · ${o.name.toUpperCase()}`, { fontFamily: FONT, fontSize: '16px', color: '#ffffff', stroke: '#061431', strokeThickness: 4 }).setOrigin(0, 0.5).setLetterSpacing(2);
  fitText(cap, sw - 60);
  panel.add([dot, cap]);
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
  if (o.owned) {
    // ya es tuyo: en la Tienda solo se compra y se ve; se equipa en PERSONALIZAR. Botón gris apagado "COMPRADO" (sin interacción)
    panel.add(arcadeButton(scene, px + pw / 2, by, Math.min(360, pw - 56), 64, 'COMPRADO', () => undefined, { palette: 'grey', disabled: true }));
  } else {
    const gap = 16;
    const two = o.price != null;
    const bw = two ? (pw - 56 - gap) / 2 : Math.min(360, pw - 56);
    if (two) {
      // dinero virtual: botón amarillo con el billete y la cifra
      const cx = px + 28 + bw / 2;
      const c = scene.add.container(cx, by);
      const g = scene.add.graphics();
      const h = 64;
      g.fillStyle(0x0a1638, 1).fillRoundedRect(-bw / 2 - 3, -h / 2 - 3, bw + 6, h + 6, 18);
      g.fillStyle(o.priceDim ? 0x5a4a20 : 0xf29a0c, 1).fillRoundedRect(-bw / 2, -h / 2, bw, h, 16);
      g.fillStyle(o.priceDim ? 0x6e5c2a : 0xffcc1f, 1).fillRoundedRect(-bw / 2, -h / 2, bw, h * 0.62, { tl: 16, tr: 16, bl: 6, br: 6 });
      g.fillStyle(0xffffff, o.priceDim ? 0.08 : 0.3).fillRoundedRect(-bw / 2 + 8, -h / 2 + 5, bw - 16, 9, 4);
      // (16-11-2026) la imagen del billete (cash-1, la carga la Tienda); si no está, el dibujo de siempre
      let icon: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
      // precio de más de 1: el fardo chico (cash-pack); de 1, el billete
      const ck = o.price! > 1 && scene.textures.exists('cash-pack') ? 'cash-pack' : 'cash-1';
      if (scene.textures.exists(ck)) icon = scene.add.image(0, 0, ck).setDisplaySize(34, 34);
      else drawCashIcon((icon = scene.add.graphics()), 0.85);
      const t = scene.add.text(0, 0, `COMPRAR  ${o.price!.toLocaleString('es-CL')}`, { fontFamily: FONT, fontSize: '24px', color: o.priceDim ? '#c9b98a' : '#0a1638' }).setOrigin(0, 0.5);
      fitText(t, bw - 64);
      const tot = 34 + t.displayWidth;
      icon.setPosition(-tot / 2 + 14, 0);
      t.setX(-tot / 2 + 34);
      c.add([g, icon, t]);
      c.setSize(bw, h).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => {
        scene.tweens.add({ targets: c, scale: { from: 0.92, to: 1 }, duration: 200, ease: 'Back.easeOut' });
        close();
        o.onBuyCash();
      });
      panel.add(c);
    }
    const rx = two ? px + 28 + bw + gap + bw / 2 : px + pw / 2;
    panel.add(arcadeButton(scene, rx, by, bw, 64, clpLabel(o.clp), () => o.onBuyReal(), { palette: 'green' }));
    panel.add(scene.add.text(rx, by + 44, 'DINERO REAL', { fontFamily: FONT, fontSize: '12px', color: '#9fe8a0' }).setOrigin(0.5).setLetterSpacing(1.5));
    if (two) panel.add(scene.add.text(px + 28 + bw / 2, by + 44, 'DINERO VIRTUAL', { fontFamily: FONT, fontSize: '12px', color: '#ffe680' }).setOrigin(0.5).setLetterSpacing(1.5));
  }

  // el borde del diálogo por encima de la pantalla (que va de borde a borde y lo tapaba por los lados)
  const frame = scene.add.graphics();
  frame.lineStyle(3, o.color, 1).strokeRoundedRect(px, py, pw, ph, 24);
  panel.add(frame);

  // la demostración arranca al abrir (se ajusta al hueco de arriba/abajo)
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  // el mismo encuadre que en PERSONALIZAR (30 arriba para el rótulo, 40 abajo)
  demo = o.demo(demoRoot, { x: sx, y: sy, w: sw, h: sh }, { x: sx, y: sy + 30, w: sw, h: sh - 30 - 40 });
  demo.setActive(true);
  return root;
}
