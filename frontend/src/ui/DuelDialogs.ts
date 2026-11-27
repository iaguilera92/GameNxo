import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { arcadeButton } from './modeButtons';
import { sfx } from '../fx/sfx';
import { type DuelPoll, type FriendsRepository, friendsErrorText } from '../domain/friends';

/**
 * (27-11-2026, usuario) DUELO ENTRE AMIGOS.
 *  - DUELO (ventana AMIGOS) reta al amigo: se cierra AMIGOS y sale "ESPERANDO A <NOMBRE>…" con 30 s y CANCELAR.
 *  - Al retado le aparece en el MEDIO de la pantalla del menú "¡<NOMBRE> TE RETA A UN DUELO!" con ACEPTAR / RECHAZAR y la barra de 30 s.
 *  - ACEPTAR: los dos van a una sala PRIVADA del servidor (LanSearch con `duelKey`) y juegan 1 contra 1.
 *  - RECHAZAR: el que retó no puede volver a retarlo por 30 s; si lo vuelve a rechazar, 1 min, luego 2 min… (lo decide el servidor).
 * Un solo vigilante por menú (`duelWatch`) consulta al servidor cada 4 s (cada 2 s mientras esperas respuesta).
 */

interface Watch {
  scene: Phaser.Scene;
  repo: FriendsRepository;
  toast: (m: string) => void;
  /** reto enviado esperando respuesta */
  waiting: { id: string; name: string; ui: Phaser.GameObjects.Container; until: number } | null;
  /** reto recibido en pantalla */
  invite: { id: string; ui: Phaser.GameObjects.Container } | null;
  busy: boolean;
  /** retos ya mostrados (no se repiten) */
  seen: Set<string>;
}
let watch: Watch | null = null;
/** retos ya mostrados (aunque se vuelva a entrar al menú) */
const seenIds = new Set<string>();

/** Al aceptar: los dos van a la sala privada. */
function goDuel(scene: Phaser.Scene, key: string, name: string) {
  if (!scene.sys.isActive()) return;
  scene.cameras.main.fadeOut(200, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start('LanSearch', { duelKey: key, duelName: name, fallback: {} }));
}

/** Panel centrado (oscuro detrás, toques bloqueados). */
function panel(scene: Phaser.Scene, h: number) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(9500);
  const dim = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.75).setOrigin(0).setInteractive();
  const pw = Math.min(600, W - 40);
  const top = H / 2 - h / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(W / 2 - pw / 2 + 4, top + 8, pw, h, 26);
  g.fillStyle(0x1a0b2e, 1).fillRoundedRect(W / 2 - pw / 2, top, pw, h, 26);
  g.lineStyle(4, 0xff5a3c, 1).strokeRoundedRect(W / 2 - pw / 2, top, pw, h, 26);
  root.add([dim, g]);
  root.setAlpha(0).setScale(0.9);
  scene.tweens.add({ targets: root, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
  // escalar desde el centro de la pantalla
  root.setPosition(W / 2 * 0.1, H / 2 * 0.1);
  scene.tweens.add({ targets: root, x: 0, y: 0, duration: 220, ease: 'Back.easeOut' });
  return { root, W, H, pw, top };
}

/** barra de tiempo que se vacía en `ms` */
function timeBar(scene: Phaser.Scene, root: Phaser.GameObjects.Container, x: number, y: number, w: number, ms: number) {
  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.5).fillRoundedRect(x - w / 2, y - 7, w, 14, 7);
  const bar = scene.add.rectangle(x - w / 2, y, w, 10, 0xffd23f).setOrigin(0, 0.5);
  root.add([bg, bar]);
  scene.tweens.add({ targets: bar, scaleX: 0, duration: ms, ease: 'Linear' });
}

const closeUi = (ui: Phaser.GameObjects.Container | undefined) => {
  if (!ui?.active) return;
  ui.scene.tweens.add({ targets: ui, alpha: 0, duration: 160, onComplete: () => ui.destroy() });
};

/** DUELO desde la ventana AMIGOS. `closeFriends` cierra la ventana si el reto salió. */
export function challengeFriend(scene: Phaser.Scene, repo: FriendsRepository, friend: { id: string; name: string }, toast: (m: string) => void, closeFriends: () => void) {
  if (!repo.duel) return toast('El duelo necesita el modo en línea');
  if (watch?.waiting) return toast(`Ya estás esperando a ${watch.waiting.name}`);
  void repo.duel(friend.id).then((r) => {
    if (!scene.sys.isActive()) return;
    if (!r.ok) {
      if (r.error === 'duel_wait' && r.waitS) return toast(`Espera ${fmtWait(r.waitS)} para retar otra vez a ${friend.name}`);
      return toast(friendsErrorText(r.error));
    }
    closeFriends();
    showWaiting(scene, repo, r.duelId, friend.name, r.ttlMs, toast);
  });
}

const fmtWait = (s: number) => (s < 60 ? `${s} s` : `${Math.ceil(s / 60)} min`);

function showWaiting(scene: Phaser.Scene, repo: FriendsRepository, id: string, name: string, ttlMs: number, toast: (m: string) => void) {
  const { root, W, H, pw } = panel(scene, 340);
  const cy = H / 2;
  const t = scene.add.text(W / 2, cy - 110, '¡DUELO!', { fontFamily: FONT, fontSize: '44px', color: '#ffd23f', stroke: '#2a0a00', strokeThickness: 8 }).setOrigin(0.5);
  const sub = scene.add.text(W / 2, cy - 44, `Esperando a ${name}…`, { fontFamily: FONT, fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
  fitText(sub, pw - 60);
  root.add([t, sub]);
  scene.tweens.add({ targets: sub, alpha: { from: 1, to: 0.5 }, duration: 700, yoyo: true, repeat: -1 });
  timeBar(scene, root, W / 2, cy + 10, pw - 100, ttlMs);
  const w = ensureWatch(scene, repo, toast);
  root.add(arcadeButton(scene, W / 2, cy + 90, 260, 64, 'CANCELAR', () => {
    if (!w.waiting) return;
    w.waiting = null;
    closeUi(root);
    void repo.duelCancel?.();
  }, { palette: 'grey' }));
  w.waiting = { id, name, ui: root, until: Date.now() + ttlMs + 4000 };
  w.scene.time.delayedCall(300, () => poll(w));
}

/** Reto recibido: en el medio de la pantalla, ACEPTAR / RECHAZAR. */
function showInvite(w: Watch, inv: DuelPoll['incoming'][number]) {
  const { scene, repo, toast } = w;
  const { root, W, H, pw } = panel(scene, 380);
  const cy = H / 2;
  sfx(scene, 'equipar');
  const t = scene.add.text(W / 2, cy - 130, '¡DUELO!', { fontFamily: FONT, fontSize: '48px', color: '#ffd23f', stroke: '#2a0a00', strokeThickness: 8 }).setOrigin(0.5);
  scene.tweens.add({ targets: t, scale: { from: 1, to: 1.08 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  const sub = scene.add.text(W / 2, cy - 58, `${inv.fromName} te reta a un duelo`, { fontFamily: FONT, fontSize: '28px', color: '#ffffff' }).setOrigin(0.5);
  fitText(sub, pw - 50);
  root.add([t, sub]);
  timeBar(scene, root, W / 2, cy - 4, pw - 100, Math.max(500, inv.msLeft));
  let done = false;
  const answer = (accept: boolean) => {
    if (done) return;
    done = true;
    void repo.duelAnswer?.(inv.id, accept).then((r) => {
      if (w.invite?.id === inv.id) w.invite = null;
      closeUi(root);
      if (!r || !scene.sys.isActive()) return;
      if (!r.ok) return toast(friendsErrorText(r.error));
      if (accept && r.key) goDuel(scene, r.key, inv.fromName);
    });
  };
  root.add(arcadeButton(scene, W / 2 - 125, cy + 90, 220, 70, 'ACEPTAR', () => answer(true), { palette: 'green', pulse: true }));
  root.add(arcadeButton(scene, W / 2 + 125, cy + 90, 220, 70, 'RECHAZAR', () => answer(false), { palette: 'red' }));
  w.invite = { id: inv.id, ui: root };
  // vence: se cierra solo (sin castigo para nadie)
  scene.time.delayedCall(Math.max(500, inv.msLeft), () => {
    if (done) return;
    done = true;
    if (w.invite?.id === inv.id) w.invite = null;
    closeUi(root);
  });
}

async function poll(w: Watch) {
  if (w.busy || watch !== w || !w.scene.sys.isActive() || !w.repo.duelPoll) return;
  w.busy = true;
  const r = await w.repo.duelPoll();
  w.busy = false;
  if (watch !== w || !w.scene.sys.isActive() || !r) return;
  const wt = w.waiting;
  if (wt && r.out?.id === wt.id && r.out.state !== 'pending') {
    w.waiting = null;
    closeUi(wt.ui);
    if (r.out.state === 'accepted' && r.out.key) {
      w.toast(`¡${wt.name} aceptó el duelo!`);
      goDuel(w.scene, r.out.key, wt.name);
      return;
    }
    w.toast(r.out.state === 'rejected' ? `${wt.name} rechazó el duelo` : `${wt.name} no respondió`);
  } else if (wt && Date.now() > wt.until) {
    w.waiting = null;
    closeUi(wt.ui);
    w.toast(`${wt.name} no respondió`);
  }
  // un reto nuevo (si no estás esperando el tuyo ni viendo otro)
  if (!w.waiting && !w.invite) {
    const inv = r.incoming.find((x) => !w.seen.has(x.id) && x.msLeft > 1500);
    if (inv) {
      w.seen.add(inv.id);
      showInvite(w, inv);
    }
  }
}

function ensureWatch(scene: Phaser.Scene, repo: FriendsRepository, toast: (m: string) => void): Watch {
  if (watch && watch.scene === scene) return watch;
  return duelWatch(scene, repo, toast);
}

/** Vigilante del menú: consulta retos cada 4 s (2 s mientras esperas respuesta). Se apaga al salir de la escena. */
export function duelWatch(scene: Phaser.Scene, repo: FriendsRepository, toast: (m: string) => void): Watch {
  const w: Watch = { scene, repo, toast, waiting: null, invite: null, busy: false, seen: seenIds };
  watch = w;
  if (!repo.duelPoll) return w;
  let last = 0;
  const timer = scene.time.addEvent({
    delay: 500,
    loop: true,
    callback: () => {
      const now = Date.now();
      if (now - last < (w.waiting ? 2000 : 4000)) return;
      last = now;
      void poll(w);
    },
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    timer.remove(false);
    if (w.waiting) void repo.duelCancel?.(); // saliste del menú esperando: el reto se retira
    if (watch === w) watch = null;
  });
  return w;
}
