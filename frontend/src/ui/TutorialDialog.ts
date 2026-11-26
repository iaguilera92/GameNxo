import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';
import { sfx } from '../fx/sfx';
import { commit, getPlayer } from '../domain/playerStore';
import { isDevMode } from '../domain/devMode';
import { markTutorialSeen } from '../domain/operations';
import { guidedStep, type TutorialStep, pendingTutorial } from '../domain/tutorial';

const NAVY = 0x0b1a3d;
const NEON = 0x3a7bff;
const GOLD = 0xffd23f;

/**
 * Aviso del TUTORIAL POR NIVEL (domain/tutorial.ts): panel centrado con el nivel, el título, una banda "NUEVO" si el nivel desbloquea algo
 * y 1-3 páginas de texto corto. Se cierra con ¡ENTENDIDO! (no al tocar fuera). Devuelve la función que lo cierra sin marcarlo.
 */
export function openTutorialDialog(scene: Phaser.Scene, step: TutorialStep, onDone: () => void, autoCloseMs?: number) {
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(9500);
  root.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x02060f, 0.84).setInteractive()); // bloquea lo de detrás

  const pw = W - 70;
  const ph = step.unlock ? 640 : 580;
  const px = (W - pw) / 2;
  const py = Math.round((H - ph) / 2);
  const panel = scene.add.container(0, 0);
  root.add(panel);

  const bg = scene.add.graphics();
  bg.fillStyle(0x000000, 0.45).fillRoundedRect(px + 4, py + 8, pw, ph, 26);
  bg.fillStyle(NAVY, 1).fillRoundedRect(px, py, pw, ph, 26);
  bg.fillStyle(0xffffff, 0.06).fillRoundedRect(px + 3, py + 3, pw - 6, 70, { tl: 23, tr: 23, bl: 0, br: 0 });
  bg.lineStyle(4, NEON, 1).strokeRoundedRect(px, py, pw, ph, 26);
  panel.add(bg);

  // nivel
  const lvlW = 150;
  const lvl = scene.add.graphics();
  lvl.fillStyle(0x06112b, 1).fillRoundedRect(W / 2 - lvlW / 2, py + 26, lvlW, 40, 20);
  lvl.lineStyle(3, GOLD, 1).strokeRoundedRect(W / 2 - lvlW / 2, py + 26, lvlW, 40, 20);
  panel.add(lvl);
  panel.add(scene.add.text(W / 2, py + 46, `NIVEL ${step.level}`, { fontFamily: FONT, fontSize: '24px', color: '#ffd23f' }).setOrigin(0.5).setLetterSpacing(2));

  // título
  const title = scene.add.text(W / 2, py + 112, step.title, { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 8, align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5);
  panel.add(title);

  // banda "NUEVO"
  let y = py + 112 + title.height / 2 + 26;
  if (step.unlock) {
    const t = scene.add.text(W / 2, y + 22, `¡NUEVO!  ${step.unlock}`, { fontFamily: FONT, fontSize: '24px', color: '#0a1638', align: 'center' }).setOrigin(0.5);
    const bw = Math.min(pw - 40, t.width + 50);
    if (t.width > pw - 90) t.setScale((pw - 90) / t.width);
    const band = scene.add.graphics();
    band.fillStyle(GOLD, 1).fillRoundedRect(W / 2 - bw / 2, y, bw, 44, 22);
    band.fillStyle(0xffffff, 0.35).fillRoundedRect(W / 2 - bw / 2 + 4, y + 3, bw - 8, 14, 7);
    panel.add(band);
    panel.add(t);
    y += 44 + 24;
  }

  // texto de la página
  const bodyTop = y;
  const body = scene.add.text(W / 2, bodyTop, '', { fontFamily: FONT, fontSize: '27px', color: '#dbe5ff', align: 'center', wordWrap: { width: pw - 80 }, lineSpacing: 8 }).setOrigin(0.5, 0);
  panel.add(body);

  // puntos de página + botón
  const dots = scene.add.graphics();
  panel.add(dots);
  const btnY = py + ph - 74;
  const action = scene.add.container(W / 2, btnY);
  panel.add(action);

  let page = 0;
  let closed = false;
  const finish = () => {
    if (closed) return;
    closed = true;
    sfx(scene, 'equipar');
    scene.tweens.add({ targets: root, alpha: 0, duration: 140, onComplete: () => root.destroy() });
    onDone();
  };
  const show = () => {
    body.setText(step.pages[page]);
    dots.clear();
    const n = step.pages.length;
    if (n > 1) {
      for (let i = 0; i < n; i++) dots.fillStyle(i === page ? GOLD : 0x3a4f86, 1).fillCircle(W / 2 + (i - (n - 1) / 2) * 26, btnY - 66, 7);
    }
    action.removeAll(true);
    const last = page >= n - 1;
    const bw = Math.min(380, pw - 90);
    action.add(
      arcadeButton(scene, 0, 0, bw, 76, last ? '¡ENTENDIDO!' : 'SIGUIENTE', () => {
        if (!last) {
          page++;
          scene.time.delayedCall(0, show); // el botón se rehace fuera de su propio clic
          return;
        }
        finish();
      }, { palette: last ? 'yellow' : 'blue', chevron: last, noShadow: !!autoCloseMs }),
    );
    if (autoCloseMs && last) action.add(clockTimer(scene, -bw / 2 + 44, 0, autoCloseMs));
  };
  show();
  if (autoCloseMs) scene.time.delayedCall(autoCloseMs, finish);

  root.setAlpha(0);
  panel.setScale(0.94);
  scene.tweens.add({ targets: root, alpha: 1, duration: 160 });
  scene.tweens.add({ targets: panel, scale: 1, duration: 200, ease: 'Back.easeOut' });
  // el panel se escala desde el centro de la pantalla
  panel.setPosition((W * 0.06) / 2, (H * 0.06) / 2);
  scene.tweens.add({ targets: panel, x: 0, y: 0, duration: 200, ease: 'Back.easeOut' });
}

/** (25-11-2026, usuario) reloj de la tienda (blanco y rojo) cuya parte roja se vacía en `ms`: el diálogo se cierra solo al terminar */
export function clockTimer(scene: Phaser.Scene, x: number, y: number, ms: number) {
  // (26-11-2026, usuario) el MISMO reloj del nivel 1 en todo el juego: disco oscuro, aro claro, arco amarillo que se llena y manecillas
  const c = scene.add.container(x, y);
  const g = scene.add.graphics();
  c.add(g);
  const r = 30;
  const st = { k: 0 };
  const draw = () => {
    g.clear();
    g.fillStyle(0x0a1638, 0.85).fillCircle(0, 0, r + 6);
    g.lineStyle(4, 0xffffff, 0.35).strokeCircle(0, 0, r);
    g.lineStyle(7, 0xffd23f, 1).beginPath().arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * st.k, false).strokePath();
    const a = -Math.PI / 2 + Math.PI * 2 * st.k;
    g.lineStyle(4, 0xffffff, 1).lineBetween(0, 0, Math.cos(a) * (r - 11), Math.sin(a) * (r - 11));
    g.lineStyle(4, 0xffffff, 1).lineBetween(0, 0, 0, -(r - 16));
    g.fillStyle(0xffffff, 1).fillCircle(0, 0, 4);
  };
  draw();
  scene.tweens.add({ targets: st, k: 1, duration: ms, onUpdate: draw });
  return c;
}

/**
 * Muestra el siguiente aviso pendiente del jugador (si lo hay) y, al aceptarlo, lo marca como visto y sigue con el que venga.
 * SOLO con el MODO DESARROLLO apagado (con él encendido el perfil es de pruebas, nivel máximo y sin tutorial).
 */
export function maybeShowTutorial(scene: Phaser.Scene) {
  if (isDevMode() || !scene.sys.isActive()) return;
  const p = getPlayer();
  if (guidedStep(p.level, p.tutorial)) return;
  const step = pendingTutorial(p.level, p.tutorial);
  // (25-11-2026, usuario) solo la bienvenida del nivel 1: los avisos de los demás niveles los reemplaza el tutorial guiado
  if (!step || step.level > 1) return;
  openTutorialDialog(scene, step, () => {
    commit((s) => markTutorialSeen(s, step.id));
    scene.time.delayedCall(350, () => maybeShowTutorial(scene));
  });
}
