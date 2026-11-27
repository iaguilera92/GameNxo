import Phaser from 'phaser';
import { FONT } from './theme';
import { fitText } from './fitText';
import { roundedPoly } from './shapes';
import { drawGiftIcon } from './wheelArt';
import { FRIEND_GIFT_EVENT, friendsRepository } from './FriendsDialog';
import { giftReveal } from './giftReveal';
import { applyFriendGift, type FriendGift } from '../domain/friends';
import { commit } from '../domain/playerStore';

/**
 * (27-11-2026, usuario) REGALO DE UN AMIGO en el menú principal: card verde (como el REGALO GRATIS de la tienda) con la caja que se mueve,
 * "¡ABRIR!" que late y "DE <NOMBRE>". Solo sale si te llegó alguno. Al tocarla: "<Nombre> te envió un regalo" con la presentación del premio
 * (ui/giftReveal.ts) y se suma al jugador; si quedan más, la card muestra el siguiente. `onGain` deja al menú animar las monedas.
 */
export function friendGiftButton(scene: Phaser.Scene, x: number, y: number, onGain: (g: FriendGift) => void, onToast: (m: string) => void, w = 102, h = 84) {
  let c: Phaser.GameObjects.Container | null = null;
  let busy = false;
  const build = () => {
    c?.destroy();
    c = null;
    const gift = friendsRepository().load().gifts[0];
    if (!gift) return;
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
    const from = scene.add.text(0, h / 2 - 13, `DE ${gift.fromName.toUpperCase()}`, { fontFamily: FONT, fontSize: '14px', color: '#ffffff', stroke: '#0a3a18', strokeThickness: 3 }).setOrigin(0.5);
    fitText(from, w - 22, 0.5);
    // "¡ABRIR!" arriba, latiendo (como "¡RECLAMAR!" de la tienda)
    const pill = scene.add.container(4, -h / 2);
    const pg = scene.add.graphics();
    pg.fillStyle(0x0a3a18, 1).fillRoundedRect(-44, -13, 88, 26, 13);
    pg.fillStyle(0x35c85a, 1).fillRoundedRect(-41, -11, 82, 22, 11);
    pill.add([pg, scene.add.text(0, 0, '¡ABRIR!', { fontFamily: FONT, fontSize: '15px', color: '#ffffff', stroke: '#0a3a18', strokeThickness: 4 }).setOrigin(0.5)]);
    scene.tweens.add({ targets: pill, scale: { from: 1, to: 1.08 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    box.add([g, ic, from, pill]);
    // más de un regalo: el número en un punto rojo
    const n = friendsRepository().load().gifts.length;
    if (n > 1) {
      const b = scene.add.graphics({ x: w / 2 - 8, y: -h / 2 + 4 });
      b.fillStyle(0xffffff, 1).fillCircle(0, 0, 13).fillStyle(0xff3b4f, 1).fillCircle(0, 0, 10);
      box.add([b, scene.add.text(w / 2 - 8, -h / 2 + 4, String(n), { fontFamily: FONT, fontSize: '14px', color: '#ffffff' }).setOrigin(0.5)]);
    }
    box.setSize(w, h).setInteractive({ useHandCursor: true });
    box.on('pointerup', () => {
      if (busy) return;
      busy = true;
      box.disableInteractive();
      // (27-11-2026) el servidor entrega el regalo una sola vez; sin conexión no se abre
      void friendsRepository().takeGift(gift.id).then((got) => {
        if (!scene.sys.isActive()) return;
        const res = got ? commit((s) => applyFriendGift(s, got)) : null;
        if (!got || !res?.ok) {
          busy = false;
          if (!got) onToast('Sin conexión: prueba otra vez');
          return build();
        }
        scene.tweens.add({ targets: box, scale: 0, duration: 180, ease: 'Back.easeIn' });
        giftReveal(scene, got.kind, got.amount, () => {
          busy = false;
          if (!scene.sys.isActive()) return;
          build();
          onGain(got);
        }, '¡REGALO!', `${got.fromName} te envió un regalo`);
      });
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
  });
  return { rebuild: build };
}
