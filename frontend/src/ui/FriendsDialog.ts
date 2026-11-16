import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { arcadeButton } from './modeButtons';
import { LEAGUE_STYLE } from './leagueStyle';
import { rankDef } from '../domain/ranks';
import { type FriendEntry, type FriendRequest, type FriendsRepository, type FriendsSnapshot, friendStatusText, offlineFriends, sampleFriends, sortFriends } from '../domain/friends';
import { isDevMode } from '../domain/devMode';

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
/** color del círculo de cada personaje (sin retrato pequeño para ahorrar memoria) */
const SKIN_COLOR: Record<string, number> = { nxo: 0xff4f5e, mai: 0xff8fc4 };
const STATUS_COLOR: Record<FriendEntry['status'], number> = { online: 0x62ef89, match: 0xffc42e, offline: 0x56607a };
const ROW_H = 84;

let devRepo: FriendsRepository | null = null;
/** Repositorio en uso: sin cuentas, vacío; en modo desarrollo, con amigos de ejemplo para ver el diseño. */
export function friendsRepository(): FriendsRepository {
  if (!isDevMode()) return offlineFriends;
  return (devRepo ??= sampleFriends());
}

type Tab = 'friends' | 'requests';

/**
 * VENTANA DE AMIGOS (21-11-2026), la que abre la card AMIGOS del menú. Dos pestañas: AMIGOS (en línea primero, estado, liga y nivel; INVITAR a una
 * amistosa; quitar con doble toque) y SOLICITUDES (aceptar / rechazar). Abajo AÑADIR AMIGO y CERRAR.
 *
 * Todo sale de un `FriendsRepository` (domain/friends.ts): aún no hay cuentas ni servidor, así que sin modo desarrollo la lista sale vacía con un
 * aviso y las acciones solo avisan "llega con las cuentas". INVITAR y AÑADIR (por código) quedan por hacer cuando exista el servidor.
 */
export function openFriendsDialog(scene: Phaser.Scene, onToast: (m: string) => void, repo: FriendsRepository = friendsRepository()) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(9000);
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.75).setOrigin(0).setInteractive();
  root.add(dim);
  const pw = Math.min(660, W - 28);
  const ph = Math.min(1040, H - 60);
  const left = W / 2 - pw / 2;
  const top = (H - ph) / 2;
  let tab: Tab = 'friends';
  let snap: FriendsSnapshot = repo.load();
  let scroll = 0;
  let maxScroll = 0;
  let armed: string | null = null; // amigo con el ✕ "¿QUITAR?" encendido
  let armTimer: Phaser.Time.TimerEvent | null = null;
  let closed = false;

  // ---- marco fijo
  const panel = scene.add.graphics();
  panel.fillStyle(0x000000, 0.45).fillRoundedRect(left + 4, top + 8, pw, ph, 26);
  panel.fillStyle(NAVY, 0.98).fillRoundedRect(left, top, pw, ph, 26);
  panel.fillStyle(0x1b2d5c, 0.5).fillRoundedRect(left + 4, top + 4, pw - 8, 70, { tl: 22, tr: 22, bl: 0, br: 0 });
  panel.lineStyle(3, NEON, 1).strokeRoundedRect(left, top, pw, ph, 26);
  const block = scene.add.zone(W / 2, top + ph / 2, pw, ph).setInteractive(); // tocar el panel no cierra
  root.add([panel, block]);
  root.add(scene.add.text(W / 2, top + 40, 'AMIGOS', { fontFamily: FONT, fontSize: '34px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(3));
  const xg = scene.add.graphics({ x: left + pw - 40, y: top + 40 });
  xg.lineStyle(9, 0x06112b, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  xg.lineStyle(5, 0xffffff, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  const xHit = scene.add.zone(left + pw - 40, top + 40, 56, 56).setInteractive({ useHandCursor: true });
  root.add([xg, xHit]);

  // ---- zonas que se rehacen: pestañas, aviso y lista
  const dyn = scene.add.container(0, 0);
  root.add(dyn);
  const listTop = top + 168;
  const listBottom = top + ph - 150;
  const list = scene.add.container(0, listTop);
  const maskG = scene.make.graphics({}, false);
  maskG.fillRect(left + 8, listTop, pw - 16, listBottom - listTop);
  list.setMask(maskG.createGeometryMask());
  root.add(list);

  const setScroll = (v: number) => {
    scroll = Phaser.Math.Clamp(v, 0, maxScroll);
    list.y = listTop - scroll;
  };

  const avatar = (x: number, y: number, skin: string, r: number) => {
    const g = scene.add.graphics({ x, y });
    g.fillStyle(0x0a1638, 1).fillCircle(0, 0, r + 3);
    g.fillStyle(SKIN_COLOR[skin] ?? 0x3a7bff, 1).fillCircle(0, 0, r);
    g.fillStyle(0x0a1638, 0.85).fillCircle(0, -r * 0.22, r * 0.34).fillRoundedRect(-r * 0.5, r * 0.18, r, r * 0.46, { tl: r * 0.4, tr: r * 0.4, bl: 2, br: 2 });
    return g;
  };

  const rowBg = (y: number, hot: boolean) => {
    const g = scene.add.graphics();
    g.fillStyle(hot ? 0x14284f : 0x101c3e, 0.96).fillRoundedRect(left + 20, y, pw - 40, ROW_H - 10, 16);
    g.lineStyle(2, hot ? 0x3a5fa8 : 0x24386b, 1).strokeRoundedRect(left + 20, y, pw - 40, ROW_H - 10, 16);
    return g;
  };

  const nameBlock = (c: Phaser.GameObjects.Container, y: number, e: { name: string; level: number; league: FriendEntry['league'] }, sub: string, subColor: string, maxW: number) => {
    const nx = left + 20 + 78;
    const nm = scene.add.text(nx, y + 22, e.name, { fontFamily: FONT, fontSize: '22px', color: '#ffffff' }).setOrigin(0, 0.5);
    fitText(nm, maxW);
    const lg = scene.add.text(nx, y + 43, `NV ${e.level} · ${rankDef(e.league).name.toUpperCase()}`, { fontFamily: FONT, fontSize: '13px', color: LEAGUE_STYLE[e.league].css }).setOrigin(0, 0.5).setLetterSpacing(1);
    fitText(lg, maxW, 0.6);
    const st = scene.add.text(nx, y + 59, sub, { fontFamily: FONT, fontSize: '12px', color: subColor }).setOrigin(0, 0.5).setLetterSpacing(1);
    c.add([nm, lg, st]);
  };

  const friendRow = (f: FriendEntry, i: number) => {
    const y = i * ROW_H;
    const c = scene.add.container(0, 0);
    c.add(rowBg(y, f.status !== 'offline'));
    c.add(avatar(left + 20 + 38, y + (ROW_H - 10) / 2, f.skin, 24));
    // punto de estado sobre el avatar
    const dot = scene.add.graphics({ x: left + 20 + 56, y: y + (ROW_H - 10) / 2 + 17 });
    dot.fillStyle(0x0a1638, 1).fillCircle(0, 0, 9).fillStyle(STATUS_COLOR[f.status], 1).fillCircle(0, 0, 6);
    c.add(dot);
    const stColor = '#' + STATUS_COLOR[f.status].toString(16).padStart(6, '0');
    nameBlock(c, y, f, friendStatusText(f), f.status === 'offline' ? '#7f8aa6' : stColor, pw - 40 - 78 - 190);
    // INVITAR (a una amistosa): hasta que exista el servidor solo avisa
    const bx = left + pw - 20 - 12 - 52 - 104;
    c.add(arcadeButton(scene, bx, y + (ROW_H - 10) / 2, 110, 44, 'INVITAR', () => onToast(snap.available ? 'Invitar a una amistosa llega con el servidor' : 'AMIGOS llega con las cuentas'), { palette: f.status === 'online' ? 'blue' : 'grey', disabled: f.status === 'offline' }));
    // quitar: doble toque (el primero pone ¿QUITAR?)
    const qx = left + pw - 20 - 30;
    const isArmed = armed === f.id;
    const qg = scene.add.graphics();
    qg.fillStyle(isArmed ? 0xc43a3a : 0x1b2a52, 1).fillRoundedRect(qx - 22, y + (ROW_H - 10) / 2 - 22, 44, 44, 12);
    qg.lineStyle(2, isArmed ? 0xff8a8a : 0x2c3d66, 1).strokeRoundedRect(qx - 22, y + (ROW_H - 10) / 2 - 22, 44, 44, 12);
    c.add(qg);
    c.add(scene.add.text(qx, y + (ROW_H - 10) / 2, isArmed ? '¿?' : '✕', { fontFamily: FONT, fontSize: isArmed ? '20px' : '22px', color: isArmed ? '#ffffff' : '#9fb4e0' }).setOrigin(0.5));
    const qh = scene.add.zone(qx, y + (ROW_H - 10) / 2, 52, 52).setInteractive({ useHandCursor: true });
    qh.on('pointerup', () => {
      if (!snap.available) return onToast('AMIGOS llega con las cuentas');
      if (armed === f.id) {
        armed = null;
        armTimer?.remove(false);
        snap = repo.remove(f.id);
        render();
        return;
      }
      armed = f.id;
      armTimer?.remove(false);
      armTimer = scene.time.delayedCall(2500, () => {
        if (closed) return;
        armed = null;
        render();
      });
      onToast(`Toca otra vez para quitar a ${f.name}`);
      render();
    });
    c.add(qh);
    return c;
  };

  const requestRow = (r: FriendRequest, i: number) => {
    const y = i * ROW_H;
    const c = scene.add.container(0, 0);
    c.add(rowBg(y, true));
    c.add(avatar(left + 20 + 38, y + (ROW_H - 10) / 2, r.skin, 24));
    nameBlock(c, y, r, 'QUIERE SER TU AMIGO', '#ffd9a0', pw - 40 - 78 - 230);
    const cy = y + (ROW_H - 10) / 2;
    c.add(arcadeButton(scene, left + pw - 20 - 12 - 62 - 56, cy, 118, 44, 'ACEPTAR', () => {
      if (!snap.available) return onToast('AMIGOS llega con las cuentas');
      snap = repo.answer(r.id, true);
      onToast(`${r.name} ya es tu amigo`);
      render();
    }, { palette: 'green' }));
    c.add(arcadeButton(scene, left + pw - 20 - 12 - 22, cy, 44, 44, '✕', () => {
      if (!snap.available) return onToast('AMIGOS llega con las cuentas');
      snap = repo.answer(r.id, false);
      render();
    }, { palette: 'grey' }));
    return c;
  };

  const tabButton = (x: number, w: number, id: Tab, label: string, count: number, badge: boolean) => {
    const on = tab === id;
    const g = scene.add.graphics();
    g.fillStyle(on ? NEON : 0x14224a, 1).fillRoundedRect(x, top + 92, w, 52, 16);
    if (on) g.fillStyle(0xffffff, 0.16).fillRoundedRect(x + 4, top + 96, w - 8, 20, { tl: 12, tr: 12, bl: 4, br: 4 });
    g.lineStyle(2, on ? 0x9cc2ff : 0x2c3d66, 1).strokeRoundedRect(x, top + 92, w, 52, 16);
    dyn.add(g);
    const t = scene.add.text(x + w / 2, top + 118, count > 0 ? `${label}  ${count}` : label, { fontFamily: FONT, fontSize: '20px', color: on ? '#ffffff' : '#8fa4d4' }).setOrigin(0.5).setLetterSpacing(1.5);
    fitText(t, w - 20, 0.6);
    dyn.add(t);
    if (badge) {
      const b = scene.add.graphics({ x: x + w - 16, y: top + 98 });
      b.fillStyle(0x0a1638, 1).fillCircle(0, 0, 12).fillStyle(0xff3b4f, 1).fillCircle(0, 0, 9);
      dyn.add(b);
    }
    const hit = scene.add.zone(x + w / 2, top + 118, w, 52).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => {
      if (tab === id) return;
      tab = id;
      scroll = 0;
      render();
    });
    dyn.add(hit);
  };

  const render = () => {
    if (closed) return;
    dyn.removeAll(true);
    list.removeAll(true);
    const tw = (pw - 48 - 12) / 2;
    tabButton(left + 24, tw, 'friends', 'AMIGOS', snap.friends.length, false);
    tabButton(left + 24 + tw + 12, tw, 'requests', 'SOLICITUDES', snap.requests.length, snap.requests.length > 0);
    const rows = tab === 'friends' ? sortFriends(snap.friends).map(friendRow) : snap.requests.map(requestRow);
    rows.forEach((r) => list.add(r));
    maxScroll = Math.max(0, rows.length * ROW_H - (listBottom - listTop) + 6);
    setScroll(scroll);
    // aviso: sin cuentas, o lista vacía
    const empty = rows.length === 0;
    const note = !snap.available
      ? 'Las cuentas llegan pronto. Aquí verás a tus amigos, en qué liga están y si están en línea, y podrás invitarlos a una amistosa.'
      : empty
        ? tab === 'friends'
          ? 'Todavía no tienes amigos. ¡Añade a alguien con su código!'
          : 'No tienes solicitudes pendientes.'
        : '';
    if (note) {
      const cy = (listTop + listBottom) / 2;
      const ig = scene.add.graphics({ x: W / 2, y: cy - 70 });
      // dos siluetas
      ig.fillStyle(0x2c3d66, 1).fillCircle(14, -12, 14).fillRoundedRect(-2, 6, 32, 28, { tl: 16, tr: 16, bl: 5, br: 5 });
      ig.fillStyle(0x4a5d8c, 1).fillCircle(-12, -8, 17).fillRoundedRect(-34, 12, 38, 32, { tl: 19, tr: 19, bl: 5, br: 5 });
      dyn.add(ig);
      dyn.add(scene.add.text(W / 2, cy + 6, note, { fontFamily: FONT, fontSize: '17px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 90 }, lineSpacing: 4 }).setOrigin(0.5, 0));
    }
    // pie: separador, AÑADIR AMIGO y CERRAR
    const sep = scene.add.graphics();
    sep.fillStyle(NEON, 0.35).fillRect(left + 24, listBottom + 8, pw - 48, 2);
    dyn.add(sep);
    dyn.add(arcadeButton(scene, W / 2, top + ph - 108, Math.min(420, pw - 60), 56, 'AÑADIR AMIGO', () => onToast(snap.available ? 'Añadir por código llega con las cuentas' : 'Necesitas tu cuenta para añadir amigos (llega pronto)'), { palette: 'blue' }));
    dyn.add(arcadeButton(scene, W / 2, top + ph - 44, Math.min(300, pw - 60), 52, 'CERRAR', () => close(), { palette: 'yellow' }));
  };

  // arrastrar la lista (y rueda)
  const dragZone = scene.add.zone(W / 2, (listTop + listBottom) / 2, pw - 16, listBottom - listTop).setInteractive();
  // la zona de arrastre va DEBAJO de los botones de las filas: solo recibe lo que ellos no toman
  root.addAt(dragZone, root.getIndex(list));
  let dragY: number | null = null;
  let start = 0;
  dragZone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
    dragY = ptr.y;
    start = scroll;
  });
  const move = (ptr: Phaser.Input.Pointer) => {
    if (dragY != null && ptr.isDown && ptr.y >= listTop && ptr.y <= listBottom) setScroll(start - (ptr.y - dragY));
  };
  const up = () => (dragY = null);
  scene.input.on('pointermove', move);
  scene.input.on('pointerup', up);
  dragZone.on('wheel', (_p: unknown, _dx: number, dy: number) => setScroll(scroll + dy));

  const close = () => {
    if (closed) return;
    closed = true;
    armTimer?.remove(false);
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', up);
    maskG.destroy();
    scene.tweens.killTweensOf(xg);
    scene.tweens.add({ targets: root, alpha: 0, duration: 120, onComplete: () => root.destroy() });
  };
  xHit.on('pointerup', close);
  dim.once('pointerup', close);
  scene.tweens.add({ targets: xg, angle: 360, delay: 120, duration: 600, ease: 'Cubic.easeOut' });
  render();
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  return root;
}
