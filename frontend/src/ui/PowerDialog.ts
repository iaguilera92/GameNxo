import Phaser from 'phaser';
import { FONT, textStyle } from './theme';
import { type ArcadePalette, arcadeButton } from './modeButtons';
import { sfx } from '../fx/sfx';

/** Cuántos huecos muestra el diálogo: 2 filas × 5. */
export const POWER_SLOTS = 10;
const COLS = 5;

/** Crea un dibujo centrado en (x, y) con `size` px de diámetro (lo pone la escena: imagen del botón, bola, aro animado…). */
export type IconFactory = (x: number, y: number, size: number) => Phaser.GameObjects.GameObject;

/** Un hueco con contenido real (los demás, hasta 10, salen bloqueados y vacíos). */
export interface PowerSlot {
  name: string;
  desc: string;
  /** lo tiene el jugador (si no, sale bloqueado y se compra en la Tienda) */
  owned: boolean;
  /** está en uso ahora */
  equipped: boolean;
  /** dibujo grande de la televisión */
  preview: IconFactory;
  /** dibujo pequeño del hueco; sin él se usa `preview` */
  thumb?: IconFactory;
  /** equipar este hueco (solo si lo tiene); el diálogo marca el cambio y llama a `onClose({ changed })` al cerrar */
  onEquip?: () => void;
}

export interface PowerDialogOpts {
  /** título, p. ej. "PODERES · SMASH" */
  title: string;
  /** color del borde y de los acentos */
  color: number;
  slots: PowerSlot[];
  /** "side" = dibujo a la izquierda y texto a la derecha (dibujos anchos, como los aros de carga) */
  layout?: 'center' | 'side';
  /** abre la Tienda (botón de los huecos bloqueados que sí existen) */
  onShop?: () => void;
  /** texto del botón y de la nota de los bloqueados (por defecto, la Tienda; p. ej. 'IR AL PASE' / 'Se gana en el PASE DE BATALLA.') */
  shopLabel?: string;
  lockedNote?: string;
  /** al cerrar: `changed` = se equipó algo distinto (la escena puede refrescarse) */
  onClose?: (r: { changed: boolean }) => void;
  /**
   * true = la televisión muestra SOLO el dibujo, grande y centrado, sin nombre ni descripción (p. ej. el color del
   * personaje: se ve cómo queda). `preview` recibe entonces como `size` el alto disponible en la pantalla.
   */
  previewOnly?: boolean;
  /**
   * Diseño especial (la ULTI): rayos de luz que giran detrás del dibujo en la pantalla y destellos que titilan en el
   * marco del diálogo, del color `color`.
   */
  special?: boolean;
}

const NAVY = 0x0b1733;

/** Candado dibujado (cuerpo + argolla) centrado en (0, 0) con `s` de alto aproximado. */
function drawLock(g: Phaser.GameObjects.Graphics, s: number, color: number) {
  const bw = s * 0.62;
  const bh = s * 0.46;
  g.lineStyle(Math.max(3, s * 0.1), color, 1).beginPath().arc(0, -s * 0.08, bw * 0.3, Math.PI, 0).strokePath();
  g.lineBetween(-bw * 0.3, -s * 0.08, -bw * 0.3, s * 0.02).lineBetween(bw * 0.3, -s * 0.08, bw * 0.3, s * 0.02);
  g.fillStyle(color, 1).fillRoundedRect(-bw / 2, s * 0.02, bw, bh, 6);
  g.fillStyle(NAVY, 1).fillCircle(0, s * 0.02 + bh * 0.4, s * 0.06).fillRect(-s * 0.025, s * 0.02 + bh * 0.4, s * 0.05, bh * 0.3);
}

/**
 * Diálogo de PODERES (SMASH, DASH) o de EFECTOS (cargando golpe): una televisión arriba que muestra el hueco seleccionado y
 * debajo 2 filas de 5. Los huecos con contenido se pueden ver y equipar si son tuyos; los que no, salen con candado y
 * estática (llevan a la Tienda); el resto, vacíos y bloqueados.
 * Tocar un hueco lo muestra en la televisión. Se cierra con la X, tocando fuera o al EQUIPAR (al instante: se equipa y se cierra).
 */
export function openPowerDialog(scene: Phaser.Scene, opts: PowerDialogOpts) {
  const { title: titleText, color, slots, layout = 'center', onShop, onClose, shopLabel = 'IR A LA TIENDA', lockedNote = 'Se compra en la TIENDA.', previewOnly = false, special = false } = opts;
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(8000);
  const timers: Phaser.Time.TimerEvent[] = [];
  let changed = false;
  let closed = false;

  // fondo oscuro que bloquea lo de detrás; tocar fuera del panel cierra
  const dim = scene.add.rectangle(W / 2, H / 2, W, H, 0x02060f, 0.82).setInteractive();
  root.add(dim);

  const pw = W - 60;
  const px = 30;
  const tvH = 330;
  const slot = Math.floor((pw - 40 - (COLS - 1) * 10) / COLS);
  const gridH = slot * 2 + 12;
  /** franja bajo la televisión para el botón de acción (EQUIPAR / EQUIPADO / IR A LA TIENDA) */
  const ACT_H = 124;
  const ph = 70 + tvH + ACT_H + gridH + 26;
  const py = Math.round((H - ph) / 2);

  const panel = scene.add.container(0, 0);
  root.add(panel);
  const block = scene.add.zone(px + pw / 2, py + ph / 2, pw, ph).setInteractive(); // el panel no cierra al tocarlo
  panel.add(block);
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.45).fillRoundedRect(px + 4, py + 8, pw, ph, 24);
  bg.fillStyle(0x0b1a3d, 1).fillRoundedRect(px, py, pw, ph, 24);
  bg.fillStyle(0xffffff, 0.06).fillRoundedRect(px + 3, py + 3, pw - 6, 50, { tl: 21, tr: 21, bl: 0, br: 0 });
  bg.lineStyle(3, color, 1).strokeRoundedRect(px, py, pw, ph, 24);
  panel.add(bg);

  // ---------------------------------------------------------------- cabecera
  const title = scene.add.text(px + pw / 2, py + 36, titleText, { fontFamily: FONT, fontSize: '30px', color: '#ffffff' }).setOrigin(0.5).setLetterSpacing(2);
  if (title.width > pw - 120) title.setScale((pw - 120) / title.width);
  panel.add(title);

  let pulse: Phaser.Tweens.Tween | null = null;
  /** rayos girando detrás del dibujo (diseño especial) y destellos del marco */
  let raysSpin: Phaser.Tweens.Tween | null = null;
  const sparkTweens: Phaser.Tweens.Tween[] = [];
  const close = () => {
    if (closed) return;
    closed = true;
    for (const t of timers) t.remove(false);
    pulse?.remove();
    pulse = null;
    raysSpin?.remove();
    raysSpin = null;
    for (const t of sparkTweens) t.remove();
    actionPulse?.remove();
    actionPulse = null;
    dim.disableInteractive();
    scene.tweens.add({ targets: root, alpha: 0, duration: 120, onComplete: () => root.destroy() });
    onClose?.({ changed });
  };
  dim.on('pointerup', close);
  const cx0 = px + pw - 38;
  const cy0 = py + 36;
  const xg = scene.add.graphics();
  xg.fillStyle(0x06112b, 1).fillCircle(cx0, cy0, 22).lineStyle(2, 0x3a7bff, 1).strokeCircle(cx0, cy0, 22);
  xg.lineStyle(4, 0xffffff, 1).lineBetween(cx0 - 8, cy0 - 8, cx0 + 8, cy0 + 8).lineBetween(cx0 + 8, cy0 - 8, cx0 - 8, cy0 + 8);
  const xHit = scene.add.zone(cx0, cy0, 56, 56).setInteractive({ useHandCursor: true });
  xHit.on('pointerup', close);
  panel.add([xg, xHit]);

  // ---------------------------------------------------------------- televisión
  const tvX = px + 20;
  const tvY = py + 70;
  const tvW = pw - 40;
  const tv = scene.add.graphics();
  // (sin antenas: bajo el título se leían como una flecha "v" cortada)
  // carcasa
  tv.fillStyle(0x1b2a52, 1).fillRoundedRect(tvX, tvY, tvW, tvH, 26);
  tv.lineStyle(3, 0x3a4f86, 1).strokeRoundedRect(tvX, tvY, tvW, tvH, 26);
  // pantalla
  const sx = tvX + 16;
  const sy = tvY + 16;
  const sw = tvW - 32;
  const sh = tvH - 56;
  tv.fillStyle(0x040a1a, 1).fillRoundedRect(sx, sy, sw, sh, 16);
  tv.lineStyle(3, 0x0a1230, 1).strokeRoundedRect(sx, sy, sw, sh, 16);
  // botoncitos y rejilla del frente
  tv.fillStyle(color, 1).fillCircle(tvX + 34, tvY + tvH - 20, 7);
  tv.fillStyle(0x5a6f9e, 1).fillCircle(tvX + 60, tvY + tvH - 20, 6);
  for (let i = 0; i < 5; i++) tv.fillStyle(0x0a1230, 1).fillRoundedRect(tvX + tvW - 120 + i * 18, tvY + tvH - 30, 8, 20, 3);
  panel.add(tv);

  // contenido de la pantalla (se rehace al elegir un hueco) y máscara para que nada se salga
  const screen = scene.add.container(0, 0);
  panel.add(screen);
  const maskG = scene.make.graphics({}, false);
  maskG.fillRoundedRect(sx, sy, sw, sh, 16);
  screen.setMask(maskG.createGeometryMask());
  root.once(Phaser.GameObjects.Events.DESTROY, () => maskG.destroy());
  // líneas de barrido sobre la pantalla (encima del contenido, sin máscara: caben dentro de la pantalla)
  const scan = scene.add.graphics();
  scan.fillStyle(0xffffff, 0.035);
  for (let y = sy + 2; y < sy + sh - 2; y += 4) scan.fillRect(sx + 4, y, sw - 8, 1.5);
  panel.add(scan);

  let noiseTimer: Phaser.Time.TimerEvent | null = null;
  const stopNoise = () => {
    noiseTimer?.remove(false);
    noiseTimer = null;
  };
  /** estática de televisión dentro de la pantalla */
  const noise = () => {
    const g = scene.add.graphics();
    screen.add(g);
    const draw = () => {
      g.clear();
      for (let n = 0; n < 150; n++) {
        g.fillStyle(0xffffff, Phaser.Math.FloatBetween(0.03, 0.22)).fillRect(sx + Math.random() * sw, sy + Math.random() * sh, Phaser.Math.Between(6, 26), Phaser.Math.Between(2, 4));
      }
    };
    draw();
    noiseTimer = scene.time.addEvent({ delay: 90, loop: true, callback: draw });
    timers.push(noiseTimer);
  };
  // botón de acción: GRANDE y centrado justo debajo de la televisión (antes, una etiqueta pequeña dentro de la pantalla)
  const action = scene.add.container(px + pw / 2, tvY + tvH + ACT_H / 2);
  panel.add(action);
  let actionPulse: Phaser.Tweens.Tween | null = null;
  /** con `onTap` es un botón (sin latido); sin él, un estado (EQUIPADO, BLOQUEADO) */
  /**
   * Botón de acción con el estilo arcade del juego (la forma inclinada de JUGAR, ui/modeButtons): EQUIPAR en amarillo con
   * chevron (quieto, sin latido); IR A LA TIENDA en azul; los estados (EQUIPADO en verde con ✓, BLOQUEADO en gris) sin interacción.
   */
  const tag = (label: string, palette: ArcadePalette, onTap?: () => void, check = false) => {
    actionPulse?.remove();
    actionPulse = null;
    for (const o of action.list) scene.tweens.killTweensOf(o); // el latido del botón anterior
    action.removeAll(true).setScale(1);
    const bw = Math.min(380, pw - 110);
    const bh = 80;
    const btn = arcadeButton(scene, 0, 0, bw, bh, label, () => onTap?.(), {
      palette,
      chevron: !!onTap && palette === 'yellow',
      pulse: false, // sin latido (EQUIPAR, IR A LA TIENDA): el botón queda quieto
      disabled: !onTap,
    });
    action.add(btn);
    if (check) {
      // ✓ delante del texto: el texto se corre a la derecha y el ✓ (26 px de ancho) va a su izquierda con 12 px de aire;
      // el conjunto ✓ + texto queda centrado en el botón
      const CK_W = 26;
      const GAP = 12;
      const lab = btn.getData('label') as Phaser.GameObjects.Text | undefined;
      let lx = -60;
      if (lab) {
        lab.x += (CK_W + GAP) / 2;
        lx = lab.x - lab.displayWidth * lab.originX - GAP - CK_W / 2;
      }
      const ck = scene.add.graphics({ x: lx, y: lab?.y ?? 0 });
      ck.lineStyle(9, 0x0a1638, 1).beginPath().moveTo(-12, 0).lineTo(-3, 9).lineTo(13, -10).strokePath();
      ck.lineStyle(5, 0xffffff, 1).beginPath().moveTo(-12, 0).lineTo(-3, 9).lineTo(13, -10).strokePath();
      action.add(ck);
    }
  };
  const clearAction = () => {
    actionPulse?.remove();
    actionPulse = null;
    for (const o of action.list) scene.tweens.killTweensOf(o);
    action.removeAll(true);
  };

  let selected = Math.max(0, slots.findIndex((s) => s.equipped));
  const rings: Phaser.GameObjects.Graphics[] = [];
  const cellX = (i: number) => px + 20 + (i % COLS) * (slot + 10) + slot / 2;
  const cellY = (i: number) => py + 70 + tvH + ACT_H + Math.floor(i / COLS) * (slot + 12) + slot / 2;
  const paint = () =>
    rings.forEach((g, i) => {
      const on = i === selected;
      const s = slots[i];
      const cx = cellX(i);
      const cy = cellY(i);
      g.clear();
      if (on) g.fillStyle(color, 0.18).fillRoundedRect(cx - slot / 2 - 4, cy - slot / 2 - 4, slot + 8, slot + 8, 20);
      g.fillStyle(s?.owned ? 0x10224d : 0x08122b, 1).fillRoundedRect(cx - slot / 2, cy - slot / 2, slot, slot, 16);
      g.lineStyle(on || s?.equipped ? 4 : 2, s?.equipped ? color : on ? 0x6f86bd : 0x24365f, 1).strokeRoundedRect(cx - slot / 2, cy - slot / 2, slot, slot, 16);
    });

  const show = (i: number) => {
    stopNoise();
    pulse?.remove(); // antes de destruir sus objetos
    pulse = null;
    raysSpin?.remove();
    raysSpin = null;
    screen.removeAll(true);
    clearAction();
    const s = slots[i];
    const side = layout === 'side';
    // dibujo: centrado arriba, o a la izquierda con el texto a la derecha
    const ix = side ? sx + sw * 0.27 : sx + sw / 2;
    // solo el dibujo: centrado en la pantalla y con casi todo su alto
    const iy = previewOnly ? sy + sh / 2 : side ? sy + sh * 0.72 : sy + 100;
    const big = previewOnly ? sh - 36 : side ? 176 : 120;
    const glowR = previewOnly ? sh * 0.46 : 120;
    const tx = side ? sx + sw * 0.54 : sx + sw / 2;
    const ty = side ? sy + sh * 0.3 : sy + 182;
    const tw = side ? sw * 0.42 : sw - 40;
    const origin = side ? 0 : 0.5;
    const align = side ? 'left' : 'center';
    if (s && s.owned) {
      if (special && !side) {
        // rayos de luz que giran despacio detrás del dibujo
        const rays = scene.add.graphics({ x: ix, y: iy });
        const n = 14;
        const R = Math.max(sw, sh);
        for (let k = 0; k < n; k++) {
          const a0 = (k / n) * Math.PI * 2;
          const a1 = a0 + (Math.PI / n) * 0.8;
          rays.fillStyle(color, 0.13).fillTriangle(0, 0, Math.cos(a0) * R, Math.sin(a0) * R, Math.cos(a1) * R, Math.sin(a1) * R);
        }
        screen.add(rays);
        raysSpin = scene.tweens.add({ targets: rays, angle: 360, duration: 14000, repeat: -1 });
      }
      const glow = scene.add.graphics({ x: ix, y: iy });
      if (!side) glow.fillStyle(color, 0.1).fillCircle(0, 0, glowR).fillStyle(color, 0.14).fillCircle(0, 0, glowR * 0.7);
      screen.add(glow);
      const ic = s.preview(ix, iy, big);
      screen.add(ic);
      // latido RELATIVO a la escala de cada objeto (un retrato ya viene reducido: con 0,94-1,04 absolutos se veía gigante)
      if (!side) {
        const base = (o: unknown) => (o as { scaleX?: number }).scaleX ?? 1;
        pulse = scene.tweens.add({
          targets: [ic, glow],
          scale: { getStart: (t: unknown) => base(t) * 0.94, getEnd: (t: unknown) => base(t) * 1.04 },
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
      if (!previewOnly) {
        const nm = scene.add.text(tx, ty, s.name.toUpperCase(), { ...textStyle(26), color: '#ffffff', align }).setOrigin(origin, 0.5);
        if (nm.width > tw) nm.setScale(tw / nm.width);
        screen.add(nm);
        screen.add(scene.add.text(tx, ty + (side ? 24 : 32), s.desc, { fontFamily: FONT, fontSize: '14px', color: '#b9d9f2', align, wordWrap: { width: tw } }).setOrigin(origin, 0));
      }
      if (s.equipped) tag('EQUIPADO', 'green', undefined, true);
      else if (s.onEquip) {
        tag('EQUIPAR', 'yellow', () => {
          // se equipa y el diálogo se cierra al instante: la escena (onClose con `changed`) ya muestra lo equipado
          s.onEquip?.();
          sfx(scene, 'equipar');
          changed = true;
          slots.forEach((q, k) => (q.equipped = k === i));
          close();
        });
      }
    } else if (s) {
      // existe pero no lo tiene: estática, el efecto atenuado, candado y aviso de la Tienda
      noise();
      const ic = s.preview(ix, iy, big);
      (ic as unknown as Phaser.GameObjects.Components.Alpha).setAlpha?.(0.28);
      screen.add(ic);
      const lk = scene.add.graphics({ x: ix, y: iy - (side ? 30 : 0) });
      drawLock(lk, side ? 70 : 90, 0xaebfe6);
      screen.add(lk);
      if (!previewOnly) {
        const nm = scene.add.text(tx, ty, s.name.toUpperCase(), { ...textStyle(26), color: '#aebfe6', align }).setOrigin(origin, 0.5);
        if (nm.width > tw) nm.setScale(tw / nm.width);
        screen.add(nm);
        screen.add(scene.add.text(tx, ty + (side ? 24 : 32), `${s.desc}\n${lockedNote}`, { fontFamily: FONT, fontSize: '14px', color: '#8ea3ce', align, wordWrap: { width: tw } }).setOrigin(origin, 0));
      }
      if (onShop) tag(shopLabel, 'blue', () => onShop());
      else tag('BLOQUEADO', 'grey');
    } else {
      // hueco vacío: estática con un candado
      noise();
      const lk = scene.add.graphics({ x: sx + sw / 2, y: sy + 100 });
      drawLock(lk, 96, 0xaebfe6);
      screen.add(lk);
      screen.add(scene.add.text(sx + sw / 2, sy + 182, 'BLOQUEADO', { ...textStyle(26), color: '#aebfe6' }).setOrigin(0.5));
      screen.add(scene.add.text(sx + sw / 2, sy + 214, `Hueco ${i + 1} de ${POWER_SLOTS}. Aún no disponible.`, { fontFamily: FONT, fontSize: '14px', color: '#7f93bf', align: 'center', wordWrap: { width: sw - 40 } }).setOrigin(0.5, 0));
    }
  };

  // ---------------------------------------------------------------- huecos (2 filas × 5)
  for (let i = 0; i < POWER_SLOTS; i++) {
    const cx = cellX(i);
    const cy = cellY(i);
    const s = slots[i];
    const ring = scene.add.graphics();
    rings.push(ring);
    panel.add(ring);
    if (s?.owned) panel.add((s.thumb ?? s.preview)(cx, cy - 6, slot * 0.66));
    else {
      const lk = scene.add.graphics({ x: cx, y: cy - (s ? 8 : 0) });
      drawLock(lk, slot * 0.46, 0x5d73a6);
      panel.add(lk);
    }
    if (s) {
      const lb = scene.add.text(cx, cy + slot / 2 - 12, s.name.toUpperCase(), { fontFamily: FONT, fontSize: '11px', color: s.owned ? '#dbe5ff' : '#6f84b3' }).setOrigin(0.5);
      if (lb.width > slot - 8) lb.setScale((slot - 8) / lb.width);
      panel.add(lb);
    }
    const hit = scene.add.zone(cx, cy, slot, slot).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      selected = i;
      paint();
      show(i);
    });
    panel.add(hit);
  }
  paint();
  show(selected);

  if (special) {
    // destellos que titilan en el marco del diálogo
    const spots: [number, number, number][] = [[0.04, 0.02, 11], [0.3, 0.0, 7], [0.96, 0.05, 10], [0.0, 0.42, 8], [1.0, 0.36, 9], [0.03, 0.97, 9], [0.62, 1.0, 7], [0.97, 0.94, 11]];
    spots.forEach(([fx, fy, r], k) => {
      const st = scene.add.star(px + pw * fx, py + ph * fy, 4, r * 0.35, r, 0xffffff).setBlendMode(Phaser.BlendModes.ADD);
      panel.add(st);
      sparkTweens.push(scene.tweens.add({ targets: st, alpha: { from: 0.1, to: 1 }, scale: { from: 0.5, to: 1.25 }, angle: 45, duration: 650 + k * 120, delay: k * 150, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
    });
    // halo del borde que late
    const halo = scene.add.graphics();
    halo.lineStyle(10, color, 0.35).strokeRoundedRect(px - 2, py - 2, pw + 4, ph + 4, 26);
    panel.addAt(halo, 1);
    sparkTweens.push(scene.tweens.add({ targets: halo, alpha: { from: 0.3, to: 1 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }));
  }

  // entrada suave
  panel.setAlpha(0).setScale(0.96);
  panel.setPosition((W * 0.04) / 2, (H * 0.04) / 2);
  scene.tweens.add({ targets: panel, alpha: 1, scale: 1, x: 0, y: 0, duration: 160, ease: 'Back.easeOut' });
  return close;
}
