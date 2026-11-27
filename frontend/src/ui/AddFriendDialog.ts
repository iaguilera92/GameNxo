import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';
import { type FriendsReply, type FriendsRepository, friendsErrorText } from '../domain/friends';

/**
 * (27-11-2026, usuario) AÑADIR AMIGO: ventana chica sobre la de AMIGOS con una caja de texto (un <input> del teléfono sobre el lienzo, como en
 * "¿CÓMO TE LLAMAS?") para escribir el código del otro: NOMBRE#111. ENVIAR manda la solicitud; si falla, el error sale debajo y la ventana
 * sigue abierta. `onDone` recibe la respuesta buena.
 */
export function openAddFriend(scene: Phaser.Scene, repo: FriendsRepository, onDone: (r: FriendsReply) => void) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(9100);
  const dim = scene.add.rectangle(0, 0, W, H, 0x000000, 0.6).setOrigin(0).setInteractive();
  const pw = Math.min(600, W - 40);
  const ph = 400;
  const left = W / 2 - pw / 2;
  const top = H * 0.3 - ph / 2;
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.45).fillRoundedRect(left + 4, top + 8, pw, ph, 24);
  g.fillStyle(0x0b1733, 1).fillRoundedRect(left, top, pw, ph, 24);
  g.lineStyle(3, 0x3a7bff, 1).strokeRoundedRect(left, top, pw, ph, 24);
  // caja del texto
  const bx = left + 30;
  const bw = pw - 60;
  const by = top + 160;
  const bh = 72;
  g.fillStyle(0x060f2a, 1).fillRoundedRect(bx, by - bh / 2, bw, bh, 16);
  g.lineStyle(3, 0xffd23f, 1).strokeRoundedRect(bx, by - bh / 2, bw, bh, 16);
  const block = scene.add.zone(W / 2, top + ph / 2, pw, ph).setInteractive();
  const title = scene.add.text(W / 2, top + 46, 'AÑADIR AMIGO', { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5);
  const sub = scene.add.text(W / 2, top + 96, 'Escribe su código (ej: Nacho#123)', { fontFamily: FONT, fontSize: '20px', color: '#9fb4e0' }).setOrigin(0.5);
  const err = scene.add.text(W / 2, by + bh / 2 + 24, '', { fontFamily: FONT, fontSize: '18px', color: '#ff8a8a' }).setOrigin(0.5);
  root.add([dim, g, block, title, sub, err]);

  // <input> de HTML encima de la caja (en coordenadas del juego)
  const r = scene.game.canvas.getBoundingClientRect();
  const k = r.width / W;
  const el = document.createElement('input');
  el.type = 'text';
  el.maxLength = 20;
  el.placeholder = 'Nombre#123';
  el.autocomplete = 'off';
  el.enterKeyHint = 'send';
  el.setAttribute('autocapitalize', 'off');
  el.addEventListener('input', () => {
    const clean = el.value.replace(/[^A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñ _#-]/g, '');
    if (clean !== el.value) el.value = clean;
    err.setText('');
  });
  Object.assign(el.style, {
    position: 'fixed',
    left: `${r.left + (bx + 20) * k}px`,
    top: `${r.top + (by - bh / 2 + 8) * k}px`,
    width: `${(bw - 40) * k}px`,
    height: `${(bh - 16) * k}px`,
    fontSize: `${Math.round(30 * k)}px`,
    fontFamily: '"Lilita One", sans-serif',
    color: '#ffffff',
    caretColor: '#ffd23f',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    padding: '0',
    margin: '0',
    zIndex: '10',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(el);
  setTimeout(() => el.isConnected && el.focus(), 50);

  let busy = false;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    el.remove();
    root.destroy();
  };
  const send = () => {
    if (busy || closed) return;
    const code = el.value.trim();
    if (!/^.{3,12}#\d{3,9}$/.test(code.replace(/\s*#\s*/, '#'))) return void err.setText(friendsErrorText('invalid'));
    busy = true;
    err.setColor('#9fb4e0').setText('Enviando…');
    void repo.add(code).then((res) => {
      busy = false;
      if (closed) return;
      if (!res.ok) return void err.setColor('#ff8a8a').setText(friendsErrorText(res.error));
      close();
      onDone(res);
    });
  };
  el.addEventListener('keydown', (e) => e.key === 'Enter' && send());
  // (27-11-2026, usuario) ENVIAR ancho y sin CANCELAR: se cierra con la X (o tocando fuera)
  root.add(arcadeButton(scene, W / 2, top + ph - 60, pw - 60, 64, 'ENVIAR', send, { palette: 'green' }));
  const xg = scene.add.graphics({ x: left + pw - 40, y: top + 40 });
  xg.lineStyle(9, 0x06112b, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  xg.lineStyle(5, 0xffffff, 1).lineBetween(-11, -11, 11, 11).lineBetween(11, -11, -11, 11);
  const xHit = scene.add.zone(left + pw - 40, top + 40, 56, 56).setInteractive({ useHandCursor: true });
  xHit.on('pointerup', close);
  root.add([xg, xHit]);
  dim.on('pointerup', close);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, close);
  return root;
}
