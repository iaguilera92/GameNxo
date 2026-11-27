import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { arcadeButton } from './modeButtons';
import { LEAGUE_STYLE } from './leagueStyle';
import { rankDef } from '../domain/ranks';
import { type FriendEntry, type FriendRequest, type FriendSuggestion, type FriendsReply, type FriendsRepository, type FriendsSnapshot, friendStatusText, friendsErrorText, giftSentToday, offlineFriends, sampleFriends, sortFriends } from '../domain/friends';
import { serverFriendsRepo } from '../net/friendsApi';
import { getPlayer } from '../domain/playerStore';
import { myLeague } from '../logic/Ranked';
import { openAddFriend } from './AddFriendDialog';
import { challengeFriend } from './DuelDialogs';
import { gameClock } from '../domain/timeSource';
import { isDevMode } from '../domain/devMode';

const NAVY = 0x0b1733;
const NEON = 0x3a7bff;
/** color del círculo de cada personaje (sin retrato pequeño para ahorrar memoria) */
const SKIN_COLOR: Record<string, number> = { nxo: 0xff4f5e, mai: 0xff8fc4 };
const STATUS_COLOR: Record<FriendEntry['status'], number> = { online: 0x62ef89, match: 0xffc42e, offline: 0x56607a };
const ROW_H = 84;

let devRepo: FriendsRepository | null = null;
/**
 * Repositorio en uso: (27-11-2026) con servidor, el de verdad (invitados con código NOMBRE#111, net/friendsApi.ts); sin servidor, en modo
 * desarrollo los amigos de ejemplo para ver el diseño; si no, vacío.
 */
export function friendsRepository(): FriendsRepository {
  const srv = serverFriendsRepo(() => {
    const p = getPlayer();
    return { name: p.name, level: p.level, league: myLeague(), skin: p.equipped.skin };
  });
  if (srv) return srv;
  if (!isDevMode()) return offlineFriends;
  return (devRepo ??= sampleFriends());
}

type Tab = 'friends' | 'requests' | 'suggest';
/** evento de la escena: llegó un regalo de un amigo (la card del menú se rehace) */
export const FRIEND_GIFT_EVENT = 'friend-gift';
/** evento de la escena: se cerró la ventana de amigos */
export const FRIENDS_CLOSED_EVENT = 'friends-closed';
let openCount = 0;
/** ¿está abierta la ventana de amigos? (la guía del nivel 5 espera a que se cierre) */
export function isFriendsDialogOpen() {
  return openCount > 0;
}

/**
 * VENTANA DE AMIGOS (21-11-2026), la que abre la card AMIGOS del menú. Dos pestañas: AMIGOS (en línea primero, estado, liga y nivel; INVITAR, DUELO y
 * REGALO (27-11-2026); quitar con doble toque) y SOLICITUDES (aceptar / rechazar). Abajo AÑADIR AMIGO y CERRAR.
 *
 * Todo sale de un `FriendsRepository` (domain/friends.ts). (27-11-2026) Con servidor: amigos reales entre invitados; abajo TU CÓDIGO (NOMBRE#111,
 * tocarlo lo copia) y AÑADIR AMIGO pide el código del otro. DUELO reta al amigo (ui/DuelDialogs.ts); INVITAR aún solo avisa.
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
  let loading = !snap.available;
  /** aplica la respuesta de una acción del servidor (avisa el error) */
  const apply = (r: FriendsReply, okMsg?: string) => {
    if (closed) return;
    snap = r.snap;
    if (!r.ok) onToast(friendsErrorText(r.error));
    else if (okMsg) onToast(okMsg);
    render();
  };
  const noServer = () => onToast(snap.offline ? 'Sin conexión con el servidor' : 'AMIGOS necesita el modo en línea');

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
  const listBottom = top + ph - 140; // (27-11-2026) pie: TU CÓDIGO y AÑADIR AMIGO (sin CERRAR: queda la X)
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
    // (27-11-2026, usuario) tres botones: INVITAR (a jugar juntos), DUELO (1 contra 1) y REGALO (uno por amigo y día)
    const BW = 92;
    const BG = 6;
    nameBlock(c, y, f, friendStatusText(f), f.status === 'offline' ? '#7f8aa6' : stColor, pw - 40 - 78 - (BW * 3 + BG * 2 + 64));
    const by = y + (ROW_H - 10) / 2;
    const b3 = left + pw - 20 - 12 - 52 - 8 - BW / 2; // REGALO (el más a la derecha, junto al ✕)
    const b2 = b3 - BW - BG;
    const b1 = b2 - BW - BG;
    const soon = (what: string) => () => onToast(`${what} llega pronto`);
    const online = f.status === 'online';
    // INVITAR: aún solo avisa
    c.add(arcadeButton(scene, b1, by, BW, 44, 'INVITAR', soon('Invitar'), { palette: online ? 'blue' : 'grey', disabled: f.status === 'offline' }));
    // (27-11-2026, usuario) DUELO: le llega el reto en el medio de la pantalla (ui/DuelDialogs.ts)
    c.add(arcadeButton(scene, b2, by, BW, 44, 'DUELO', () => {
      if (!snap.available) return noServer();
      challengeFriend(scene, repo, f, onToast, () => close());
    }, { palette: online ? 'yellow' : 'grey', disabled: f.status === 'offline' }));
    // REGALO: se puede enviar aunque esté desconectado (le llega al entrar)
    const sent = giftSentToday(snap, f.id, gameClock.now());
    c.add(arcadeButton(scene, b3, by, BW, 44, sent ? 'ENVIADO' : 'REGALO', () => {
      if (!snap.available) return noServer();
      if (giftSentToday(snap, f.id, gameClock.now())) return onToast(`Ya le enviaste un regalo hoy a ${f.name}`);
      void repo.sendGift(f.id, gameClock.now()).then((r) => apply(r, `¡Regalo enviado a ${f.name}!`));
    }, { palette: sent ? 'grey' : 'green' }));
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
      if (!snap.available) return noServer();
      if (armed === f.id) {
        armed = null;
        armTimer?.remove(false);
        void repo.remove(f.id).then((r) => apply(r));
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
      if (!snap.available) return noServer();
      void repo.answer(r.id, true).then((x) => apply(x, `${r.name} ya es tu amigo`));
    }, { palette: 'green' }));
    c.add(arcadeButton(scene, left + pw - 20 - 12 - 22, cy, 44, 44, '✕', () => {
      if (!snap.available) return noServer();
      void repo.answer(r.id, false).then((x) => apply(x));
    }, { palette: 'grey' }));
    return c;
  };

  // (27-11-2026, usuario) SUGERENCIAS: jugadores registrados (invitados) que aún no son tus amigos; se piden al abrir la pestaña
  let sugg: FriendSuggestion[] | null = null;
  let suggLoading = false;
  const loadSugg = () => {
    if (!repo.suggestions || suggLoading) return;
    suggLoading = true;
    void repo.suggestions().then((l) => {
      suggLoading = false;
      if (closed) return;
      sugg = l ?? [];
      if (tab === 'suggest') render();
    });
  };
  const suggestRow = (f: FriendSuggestion, i: number) => {
    const y = i * ROW_H;
    const c = scene.add.container(0, 0);
    c.add(rowBg(y, f.status !== 'offline'));
    c.add(avatar(left + 20 + 38, y + (ROW_H - 10) / 2, f.skin, 24));
    const dot = scene.add.graphics({ x: left + 20 + 56, y: y + (ROW_H - 10) / 2 + 17 });
    dot.fillStyle(0x0a1638, 1).fillCircle(0, 0, 9).fillStyle(STATUS_COLOR[f.status], 1).fillCircle(0, 0, 6);
    c.add(dot);
    // (27-11-2026, usuario) los que jugaron contigo van primero y lo dicen
    const sub = f.met === 'rival' ? `JUGARON EN CONTRA · ${friendStatusText(f)}` : f.met === 'mate' ? `FUERON COMPAÑEROS 2V2 · ${friendStatusText(f)}` : friendStatusText(f);
    nameBlock(c, y, { ...f, name: `${f.name} #${f.tag}` }, sub, f.met ? '#ffd23f' : f.status === 'offline' ? '#7f8aa6' : '#62ef89', pw - 40 - 78 - 170);
    c.add(arcadeButton(scene, left + pw - 20 - 12 - 70, y + (ROW_H - 10) / 2, 140, 44, 'AGREGAR', () => {
      if (!repo.addById) return;
      void repo.addById(f.id).then((r) => {
        if (r.ok) sugg = (sugg ?? []).filter((x) => x.id !== f.id);
        const now = r.ok && r.snap.friends.some((x) => x.id === f.id);
        apply(r, r.ok ? (now ? `${f.name} ya es tu amigo` : `Solicitud enviada a ${f.name}`) : undefined);
      });
    }, { palette: 'green' }));
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
      if (id === 'suggest') loadSugg(); // siempre al día al abrirla
      render();
    });
    dyn.add(hit);
  };

  /** (27-11-2026, usuario) botón RECTANGULAR amarillo con bordes poco redondeados (AÑADIR AMIGO) */
  const rectButton = (x: number, y: number, w: number, h: number, label: string, onClick: () => void) => {
    const c = scene.add.container(x, y);
    const g = scene.add.graphics();
    const r = 8;
    g.fillStyle(0x000000, 0.35).fillRoundedRect(-w / 2 + 2, -h / 2 + 6, w, h, r); // sombra
    g.fillStyle(0xb8860b, 1).fillRoundedRect(-w / 2, -h / 2, w, h, r); // borde de abajo (más oscuro)
    g.fillStyle(0xffc42e, 1).fillRoundedRect(-w / 2, -h / 2, w, h - 6, r);
    g.fillStyle(0xffffff, 0.25).fillRoundedRect(-w / 2 + 6, -h / 2 + 5, w - 12, h * 0.28, { tl: r - 2, tr: r - 2, bl: 3, br: 3 }); // brillo
    g.lineStyle(3, 0x0a1638, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, r);
    const t = scene.add.text(0, -3, label, { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2);
    fitText(t, w - 40);
    c.add([g, t]);
    c.setSize(w, h).setInteractive({ useHandCursor: true });
    c.on('pointerdown', () => c.setScale(0.97));
    c.on('pointerout', () => c.setScale(1));
    c.on('pointerup', () => {
      c.setScale(1);
      onClick();
    });
    return c;
  };

  const render = () => {
    if (closed) return;
    dyn.removeAll(true);
    list.removeAll(true);
    // (27-11-2026) tres pestañas: AMIGOS · SOLICITUDES · SUGERENCIAS
    const tw = (pw - 48 - 16) / 3;
    tabButton(left + 24, tw, 'friends', 'AMIGOS', snap.friends.length, false);
    tabButton(left + 24 + tw + 8, tw, 'requests', 'SOLICITUDES', snap.requests.length, snap.requests.length > 0);
    tabButton(left + 24 + (tw + 8) * 2, tw, 'suggest', 'SUGERENCIAS', 0, false);
    const rows = tab === 'friends' ? sortFriends(snap.friends).map(friendRow) : tab === 'requests' ? snap.requests.map(requestRow) : snap.available ? (sugg ?? []).map(suggestRow) : [];
    rows.forEach((r) => list.add(r));
    maxScroll = Math.max(0, rows.length * ROW_H - (listBottom - listTop) + 6);
    setScroll(scroll);
    // aviso: sin cuentas, o lista vacía
    const empty = rows.length === 0;
    const note = !snap.available
      ? loading
        ? 'Cargando…'
        : snap.offline
          ? 'Sin conexión con el servidor. Prueba más tarde.'
          : 'Para tener amigos activa el modo en línea.'
      : empty
        ? tab === 'friends'
          ? 'Todavía no tienes amigos. ¡Agrega a alguien con su código!'
          : tab === 'requests'
            ? 'No tienes solicitudes pendientes.'
            : sugg === null
              ? 'Cargando…'
              : 'Por ahora no hay jugadores para sugerirte.'
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
    // (27-11-2026, usuario) TU CÓDIGO (NOMBRE#111): tocarlo lo copia para pasárselo a un amigo
    if (snap.code) {
      const code = snap.code;
      const ct = scene.add.text(W / 2, top + ph - 110, `TU CÓDIGO: ${code}`, { fontFamily: FONT, fontSize: '22px', color: '#ffd23f', stroke: '#0a1638', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
      fitText(ct, pw - 60, 0.6);
      ct.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        void navigator.clipboard?.writeText(code).then(() => onToast('Código copiado'), () => onToast(`Tu código: ${code}`));
      });
      dyn.add(ct);
    }
    dyn.add(rectButton(W / 2, top + ph - 52, pw - 60, 76, 'AÑADIR AMIGO', () => { // (27-11-2026, usuario) ancho, rectangular y amarillo
      if (!snap.available) return noServer();
      openAddFriend(scene, repo, (r) => {
        if (r.ok) {
          // si el otro ya te había enviado solicitud, quedan amigos al instante
          const now = r.snap.friends.some((f) => f.name === r.name);
          tab = now ? 'friends' : tab;
        }
        apply(r, r.ok ? (r.snap.friends.some((f) => f.name === r.name) ? `${r.name} ya es tu amigo` : `Solicitud enviada a ${r.name ?? 'tu amigo'}`) : undefined);
      });
    }));
    // (27-11-2026, usuario) sin CERRAR: se cierra con la X de arriba (o tocando fuera)
    // (27-11-2026, usuario) SOLO MODO DESARROLLO: TEST = te llega un regalo de un amigo de prueba; se cierra la ventana y sale su card en el menú
    if (isDevMode() && repo.devReceiveGift) {
      dyn.add(arcadeButton(scene, left + 24 + 50, top + 40, 100, 48, 'TEST', () => { // arriba a la izquierda (la X va a la derecha)
        snap = repo.devReceiveGift?.() ?? snap;
        onToast('¡Te llegó un regalo de Amigo_Test!');
        scene.events.emit(FRIEND_GIFT_EVENT);
        close();
      }, { palette: 'purple' }));
    }
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
    openCount = Math.max(0, openCount - 1);
    armTimer?.remove(false);
    scene.input.off('pointermove', move);
    scene.input.off('pointerup', up);
    maskG.destroy();
    scene.tweens.killTweensOf(xg);
    scene.tweens.add({ targets: root, alpha: 0, duration: 120, onComplete: () => { root.destroy(); scene.events.emit(FRIENDS_CLOSED_EVENT); scene.events.emit(FRIEND_GIFT_EVENT); } });
  };
  xHit.on('pointerup', close);
  dim.once('pointerup', close);
  scene.tweens.add({ targets: xg, angle: 360, delay: 120, duration: 600, ease: 'Cubic.easeOut' });
  openCount++;
  // la escena se cierra con la ventana abierta: deja de contar
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (!closed) { closed = true; openCount = Math.max(0, openCount - 1); } });
  render();
  // (27-11-2026) lista al día desde el servidor
  void repo.refresh().then((s) => {
    loading = false;
    if (closed) return;
    snap = s;
    render();
  });
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 180 });
  return root;
}
