import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { roundedPoly } from './shapes';
import { coinIcon, drawGiftIcon, drawXpIcon } from './wheelArt';
import { coin2v2Icon } from './PlayEntry2v2';
import { drawCashIcon } from '../scenes/BattlePassScene';
import { FRIEND_GIFT_EVENT, friendsRepository } from './FriendsDialog';
import { applyFriendGift, type FriendGift, type FriendGiftKind } from '../domain/friends';
import { commit } from '../domain/playerStore';
import { sfx } from '../fx/sfx';

/** lo que dieron los regalos abiertos, por tipo (el menú lo hace llegar a sus cards) */
export interface GiftTotals {
  coins: number;
  coins2v2: number;
  xp: number;
  cash: number;
}

/**
 * (27-11-2026, usuario) REGALOS DE AMIGOS en el menú principal: card verde (como el REGALO GRATIS de la tienda) con la caja que se mueve y
 * "¡ABRIR!". Dice REGALO (uno) o REGALOS con un círculo rojo y el NÚMERO (varios); ya no dice de quién.
 * Al tocarla se abren TODOS: pantalla oscura con la LISTA de regalos (como el PREMIO DIARIO: cada uno su tarjeta con imagen, "+N", qué es y
 * el nombre del amigo si cabe) y, al continuar, cada premio vuela a su card del menú (`onGain`: monedas, monedas 2V2, EXP; el dinero sube su
 * contador). Mientras se ve la lista, los contadores del menú esperan (registry wheel.open, igual que con la ruleta).
 */
export function friendGiftButton(scene: Phaser.Scene, x: number, y: number, onGain: (t: GiftTotals) => void, onToast: (m: string) => void, w = 102, h = 84) {
  let c: Phaser.GameObjects.Container | null = null;
  let busy = false;
  const build = () => {
    c?.destroy();
    c = null;
    const gifts = friendsRepository().load().gifts;
    const n = gifts.length;
    if (!n) return;
    const box = scene.add.container(x, y).setDepth(50);
    c = box;
    const k = 14 * (h / 136) + 4;
    const shape = roundedPoly([[-w / 2 + k, -h / 2], [w / 2, -h / 2], [w / 2 - k, h / 2], [-w / 2, h / 2]], 14);
    const g = scene.add.graphics();
    g.fillStyle(0x000000, 0.35).fillPoints(shape.map((p) => ({ x: p.x + 4, y: p.y + 7 })), true);
    g.lineStyle(10, 0x6fe88a, 0.25).strokePoints(shape, true, true);
    g.fillStyle(0x1f8a3a, 1).fillPoints(shape, true);
    g.fillStyle(0x6fe88a, 0.45).fillPoints(shape.filter((p) => p.y < 0).map((p) => ({ x: p.x * 0.97, y: p.y * 0.96 })), true);
    g.lineStyle(3, 0xb6ffc6, 1).strokePoints(shape, true, true);
    const ic = scene.add.graphics({ y: -6 }).setScale(h / 150);
    drawGiftIcon(ic, 40);
    scene.tweens.add({ targets: ic, angle: { from: -7, to: 7 }, duration: 380, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const label = scene.add.text(0, h / 2 - 13, n > 1 ? 'REGALOS' : 'REGALO', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#0a3a18', strokeThickness: 3 }).setOrigin(0.5);
    fitText(label, w - 22, 0.5);
    // "¡ABRIR!" arriba, latiendo (como "¡RECLAMAR!" de la tienda)
    const pill = scene.add.container(4, -h / 2);
    const pg = scene.add.graphics();
    pg.fillStyle(0x0a3a18, 1).fillRoundedRect(-44, -13, 88, 26, 13);
    pg.fillStyle(0x35c85a, 1).fillRoundedRect(-41, -11, 82, 22, 11);
    pill.add([pg, scene.add.text(0, 0, '¡ABRIR!', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#0a3a18', strokeThickness: 4 }).setOrigin(0.5)]);
    scene.tweens.add({ targets: pill, scale: { from: 1, to: 1.08 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    box.add([g, ic, label, pill]);
    // varios: círculo rojo con el número, que late (como el del PASE)
    if (n > 1) {
      const b = scene.add.container(w / 2 - 6, -h / 2 + 4);
      const bg = scene.add.graphics();
      bg.fillStyle(0x0a1638, 1).fillCircle(0, 0, 15).fillStyle(0xff3b4f, 1).fillCircle(0, 0, 12);
      b.add([bg, scene.add.text(0, 0, String(Math.min(99, n)), { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)]);
      box.add(b);
      scene.tweens.add({ targets: b, scale: 1.2, duration: 380, yoyo: true, repeat: -1 });
    }
    box.setSize(w, h).setInteractive({ useHandCursor: true });
    box.on('pointerup', () => {
      if (busy) return;
      busy = true;
      box.disableInteractive();
      void openAll(gifts.map((x) => x.id));
    });
  };

  /** abre todos los regalos (el servidor entrega cada uno una vez), los suma y muestra la lista */
  const openAll = async (ids: string[]) => {
    const repo = friendsRepository();
    const got: FriendGift[] = [];
    for (const id of ids) {
      const gft = await repo.takeGift(id);
      if (gft) got.push(gft);
    }
    if (!scene.sys.isActive()) return;
    if (!got.length) {
      busy = false;
      onToast('Sin conexión: prueba otra vez');
      return build();
    }
    // los contadores del menú esperan a que se cierre la lista (como con la ruleta) y luego ven llegar cada premio
    scene.registry.set('wheel.open', true);
    const totals: GiftTotals = { coins: 0, coins2v2: 0, xp: 0, cash: 0 };
    const shown: FriendGift[] = [];
    for (const gft of got) {
      const res = commit((s) => applyFriendGift(s, gft));
      if (!res.ok) continue;
      totals[gft.kind] += gft.amount;
      shown.push(gft);
    }
    c?.destroy();
    c = null;
    giftListReveal(scene, shown, () => {
      scene.registry.set('wheel.open', false);
      busy = false;
      if (!scene.sys.isActive()) return;
      build();
      onGain(totals);
    });
  };

  build();
  // un regalo nuevo (botón TEST de AMIGOS en modo desarrollo, o la lista que llega del servidor): la card se rehace sin reiniciar el menú
  const onNew = () => !busy && build();
  scene.events.on(FRIEND_GIFT_EVENT, onNew);
  // (27-11-2026) con servidor: al entrar al menú y cada minuto se pide la lista (te marca EN LÍNEA y trae regalos y solicitudes nuevas)
  const poll = () => void friendsRepository().refresh().then(() => scene.sys.isActive() && scene.events.emit(FRIEND_GIFT_EVENT));
  poll();
  const timer = scene.time.addEvent({ delay: 60_000, loop: true, callback: poll });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(FRIEND_GIFT_EVENT, onNew);
    timer.remove(false);
    if (busy) scene.registry.set('wheel.open', false);
  });
  return { rebuild: build };
}

const KIND_NAME: Record<FriendGiftKind, string> = { coins: 'MONEDAS', coins2v2: 'MONEDAS 2V2', xp: 'EXP', cash: 'DINERO' };

/** imagen de cada premio, de radio ~r */
function giftArt(scene: Phaser.Scene, kind: FriendGiftKind, x: number, y: number, r: number): Phaser.GameObjects.GameObject {
  if (kind === 'coins') {
    if (scene.textures.exists('daily-coins-art')) {
      const im = scene.add.image(x, y, 'daily-coins-art');
      return im.setScale((r * 2.2) / Math.max(im.width, im.height));
    }
    return coinIcon(scene, x, y, r);
  }
  if (kind === 'coins2v2') return coin2v2Icon(scene, x, y, r);
  if (kind === 'cash' && scene.textures.exists('cash-pack')) {
    const im = scene.add.image(x, y, 'cash-pack');
    return im.setScale((r * 2.1) / Math.max(im.width, im.height));
  }
  const g = scene.add.graphics({ x, y });
  if (kind === 'xp') drawXpIcon(g, r);
  else drawCashIcon(g, r / 18);
  return g;
}

/**
 * Pantalla de los regalos abiertos: muy oscura, "¡REGALOS!" y una tarjeta por regalo (como el PREMIO DIARIO): imagen, placa dorada con "+N",
 * qué es y "DE <NOMBRE>" (sin el #número; si no cabe, se achica y si aún no cabe se corta con "…"). Hasta 12 a la vista; el resto, "Y N MÁS".
 */
function giftListReveal(scene: Phaser.Scene, gifts: FriendGift[], onDone: () => void) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(9400);
  const dark = scene.add.rectangle(0, 0, W, H, 0x01030a, 0.94).setOrigin(0).setInteractive(); // (27-11-2026, usuario) más oscuro
  root.add(dark);
  const rays = scene.add.graphics({ x: W / 2, y: H * 0.42 }).setAlpha(0);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    rays.fillStyle(i % 2 ? 0x3a7bff : 0x35c85a, 0.08).slice(0, 0, Math.max(W, H), a, a + Math.PI / 18, false).fillPath();
  }
  root.add(rays);
  scene.tweens.add({ targets: rays, alpha: 1, duration: 500 });
  scene.tweens.add({ targets: rays, angle: 360, duration: 40_000, repeat: -1 });
  const title = scene.add.text(W / 2, H * 0.16, gifts.length > 1 ? '¡REGALOS!' : '¡REGALO!', { fontFamily: FONT, fontSize: '52px', color: '#ffffff', stroke: '#061431', strokeThickness: 9 }).setOrigin(0.5).setLetterSpacing(2);
  const sub = scene.add.text(W / 2, H * 0.16 + 50, gifts.length > 1 ? 'TUS AMIGOS TE ENVIARON' : 'UN AMIGO TE ENVIÓ', { fontFamily: FONT, fontSize: '20px', color: '#8dffad', stroke: '#061431', strokeThickness: 5 }).setOrigin(0.5).setLetterSpacing(1);
  root.add([title, sub]);

  const MAX = 12;
  const list = gifts.slice(0, MAX);
  const cols = list.length <= 1 ? 1 : list.length <= 4 ? 2 : 3;
  const rows = Math.ceil(list.length / cols);
  const gap = 12;
  const cw = Math.min(cols === 1 ? 280 : 220, (W - 40 - gap * (cols - 1)) / cols);
  const areaTop = H * 0.16 + 90;
  const areaH = H * 0.86 - 60 - areaTop;
  const ch = Math.min(cols === 1 ? 320 : 230, (areaH - gap * (rows - 1)) / rows);
  const top0 = areaTop + (areaH - (rows * ch + (rows - 1) * gap)) / 2;
  const left0 = W / 2 - (cols * cw + (cols - 1) * gap) / 2;
  list.forEach((gft, i) => {
    const cx = left0 + (i % cols) * (cw + gap) + cw / 2;
    const ty = top0 + Math.floor(i / cols) * (ch + gap);
    const delay = 120 + i * 90;
    const card = scene.add.container(cx, ty + ch / 2).setAlpha(0).setScale(0.7);
    const g = scene.add.graphics();
    g.fillStyle(0x061b4c, 0.98).fillRoundedRect(-cw / 2, -ch / 2, cw, ch, 20);
    g.fillStyle(0x0b3b91, 0.55).fillRoundedRect(-cw / 2 + 5, -ch / 2 + 5, cw - 10, ch - 10, 16);
    g.lineStyle(4, 0x4ad9ff, 1).strokeRoundedRect(-cw / 2 + 2, -ch / 2 + 2, cw - 4, ch - 4, 18);
    g.lineStyle(2, 0xffdb55, 0.9).strokeRoundedRect(-cw / 2 + 8, -ch / 2 + 8, cw - 16, ch - 16, 14);
    card.add(g);
    const art = giftArt(scene, gft.kind, 0, -ch * 0.17, Math.min(cw, ch) * 0.2);
    card.add(art);
    const pw = cw * 0.84;
    const py = ch * 0.13;
    const plate = scene.add.graphics();
    plate.fillStyle(0x472600, 1).fillRoundedRect(-pw / 2, py - 18, pw, 40, 14);
    plate.fillStyle(0xffb900, 1).fillRoundedRect(-pw / 2 + 3, py - 20, pw - 6, 36, 12);
    card.add(plate);
    const amt = scene.add.text(0, py - 2, `+${gft.amount.toLocaleString('es-CL')}`, { fontFamily: FONT, fontSize: `${Math.round(Math.min(32, ch * 0.13))}px`, color: '#ffffff', stroke: '#09275b', strokeThickness: 6 }).setOrigin(0.5);
    fitText(amt, pw - 16);
    const what = scene.add.text(0, ch * 0.29, KIND_NAME[gft.kind], { fontFamily: FONT, fontSize: `${Math.round(Math.min(18, ch * 0.08))}px`, color: '#ffffff', stroke: '#061431', strokeThickness: 4 }).setOrigin(0.5).setLetterSpacing(1);
    fitText(what, cw - 20, 0.6);
    // el nombre del amigo (sin #número): se achica y, si aún no cabe, se corta
    const from = scene.add.text(0, ch * 0.4, `DE ${gft.fromName.toUpperCase()}`, { fontFamily: FONT, fontSize: `${Math.round(Math.min(15, ch * 0.065))}px`, color: '#8dffad' }).setOrigin(0.5);
    const maxW = cw - 20;
    if (from.width > maxW) {
      from.setScale(Math.max(0.75, maxW / from.width));
      let nm = gft.fromName.toUpperCase();
      while (from.displayWidth > maxW && nm.length > 2) {
        nm = nm.slice(0, -1);
        from.setText(`DE ${nm}…`);
      }
    }
    card.add([amt, what, from]);
    root.add(card);
    scene.tweens.add({ targets: card, alpha: 1, scale: 1, delay, duration: 380, ease: 'Back.easeOut' });
  });
  if (gifts.length > MAX) {
    root.add(scene.add.text(W / 2, H * 0.86 - 40, `Y ${gifts.length - MAX} MÁS`, { fontFamily: FONT, fontSize: '22px', color: '#ffd23f', stroke: '#061431', strokeThickness: 5 }).setOrigin(0.5));
  }
  scene.cameras.main.flash(200, 200, 255, 210);
  sfx(scene, 'equipar');
  const prompt = scene.add.text(W / 2, H * 0.9, 'TOCA PARA CONTINUAR', { fontFamily: FONT, fontSize: '28px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 7 }).setOrigin(0.5).setLetterSpacing(2).setAlpha(0);
  if (prompt.width > W - 40) prompt.setScale((W - 40) / prompt.width);
  root.add(prompt);
  root.setAlpha(0);
  scene.tweens.add({ targets: root, alpha: 1, duration: 220 });
  scene.time.delayedCall(700 + list.length * 90, () => {
    if (!root.active) return;
    scene.tweens.add({ targets: prompt, alpha: 1, duration: 280, onComplete: () => scene.tweens.add({ targets: prompt, alpha: 0.45, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' }) });
    dark.once('pointerup', () => {
      scene.tweens.add({ targets: root, alpha: 0, duration: 200, onComplete: () => { root.destroy(); onDone(); } });
    });
  });
}
