import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';

/**
 * (27-11-2026, usuario) Pide una contraseña NUMÉRICA (hasta `max` dígitos, por defecto 6) en un panel sobre lo que haya. El campo es un
 * <input> de verdad (teclado numérico del teléfono) colocado encima del lienzo. `check` decide si vale: si sí, se cierra y llama a
 * `onOk`; si no, el panel tiembla y avisa. CANCELAR o tocar fuera cierra sin hacer nada (`onCancel`).
 */
export function askPassword(
  scene: Phaser.Scene,
  o: { title: string; check: (pin: string) => boolean; onOk: () => void; onCancel?: () => void; max?: number; depth?: number },
) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const depth = o.depth ?? 9600;
  const max = o.max ?? 6;
  const objs: Phaser.GameObjects.GameObject[] = [];
  let input: HTMLInputElement | null = null;
  let done = false;
  const close = (ok: boolean) => {
    if (done) return;
    done = true;
    input?.remove();
    input = null;
    window.removeEventListener('resize', place);
    objs.forEach((g) => g.destroy());
    if (ok) o.onOk();
    else o.onCancel?.();
  };

  const shade = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.8).setOrigin(0).setScrollFactor(0).setDepth(depth).setInteractive();
  shade.on('pointerup', () => close(false));
  objs.push(shade);

  const pw = Math.min(560, W - 60);
  const ph = 390;
  const panel = scene.add.container(W / 2, H * 0.4).setScrollFactor(0).setDepth(depth + 1);
  objs.push(panel);
  const g = scene.add.graphics();
  g.fillStyle(0x000000, 0.4).fillRoundedRect(-pw / 2 + 4, -ph / 2 + 8, pw, ph, 24);
  g.fillStyle(0x0b1733, 1).fillRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  g.lineStyle(4, 0x3a7bff, 1).strokeRoundedRect(-pw / 2, -ph / 2, pw, ph, 24);
  // caja del campo (el <input> va encima, transparente)
  const boxW = Math.min(300, pw - 120);
  const boxH = 70;
  const boxY = -14;
  g.fillStyle(0x050d24, 1).fillRoundedRect(-boxW / 2, boxY - boxH / 2, boxW, boxH, 16);
  g.lineStyle(3, 0xffd23f, 1).strokeRoundedRect(-boxW / 2, boxY - boxH / 2, boxW, boxH, 16);
  panel.add(g);
  // el panel no deja pasar el toque al fondo (que cerraría)
  panel.add(scene.add.zone(0, 0, pw, ph).setInteractive());
  panel.add(scene.add.text(0, -ph / 2 + 50, o.title, { fontFamily: FONT, fontSize: '32px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(1));
  panel.add(scene.add.text(0, -ph / 2 + 96, `Contraseña (hasta ${max} dígitos)`, { fontFamily: FONT, fontSize: '19px', color: '#9fb4e0' }).setOrigin(0.5));
  const err = scene.add.text(0, boxY + boxH / 2 + 26, '', { fontFamily: FONT, fontSize: '19px', color: '#ff7a85' }).setOrigin(0.5);
  panel.add(err);

  const submit = () => {
    const pin = input?.value ?? '';
    if (o.check(pin)) return close(true);
    err.setText(pin ? 'Contraseña incorrecta' : 'Escribe la contraseña');
    if (input) input.value = '';
    scene.tweens.add({ targets: panel, x: { from: W / 2 - 12, to: W / 2 }, duration: 260, ease: 'Elastic.easeOut' });
    input?.focus();
  };
  const bw = Math.min(200, (pw - 70) / 2);
  panel.add(arcadeButton(scene, -bw / 2 - 10, ph / 2 - 70, bw, 72, 'CANCELAR', () => close(false), { palette: 'blue', noShadow: true }));
  panel.add(arcadeButton(scene, bw / 2 + 10, ph / 2 - 70, bw, 72, 'ENTRAR', submit, { palette: 'yellow', noShadow: true }));

  // <input> numérico encima de la caja
  input = document.createElement('input');
  input.type = 'password';
  input.inputMode = 'numeric';
  input.pattern = '[0-9]*';
  input.maxLength = max;
  input.autocomplete = 'off';
  input.enterKeyHint = 'done';
  Object.assign(input.style, {
    position: 'fixed',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#ffffff',
    textAlign: 'center',
    fontFamily: FONT,
    letterSpacing: '0.4em',
    zIndex: '1000',
    padding: '0',
  } as Partial<CSSStyleDeclaration>);
  input.addEventListener('input', () => {
    if (!input) return;
    const clean = input.value.replace(/\D/g, '').slice(0, max);
    if (clean !== input.value) input.value = clean;
    err.setText('');
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
  function place() {
    if (!input) return;
    const r = scene.game.canvas.getBoundingClientRect();
    const k = r.width / W;
    const cx = r.left + (W / 2) * k;
    const cy = r.top + (H * 0.4 + boxY) * k;
    Object.assign(input.style, {
      left: `${cx - (boxW / 2 - 10) * k}px`,
      top: `${cy - (boxH / 2 - 6) * k}px`,
      width: `${(boxW - 20) * k}px`,
      height: `${(boxH - 12) * k}px`,
      fontSize: `${Math.round(34 * k)}px`,
    });
  }
  place();
  window.addEventListener('resize', place);
  document.body.appendChild(input);
  setTimeout(() => input?.focus(), 50);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => close(false));

  panel.setScale(0.85).setAlpha(0);
  scene.tweens.add({ targets: panel, scale: 1, alpha: 1, duration: 200, ease: 'Back.easeOut' });
  return () => close(false);
}
