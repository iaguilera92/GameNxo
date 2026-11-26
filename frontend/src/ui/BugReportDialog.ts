/**
 * (26-11-2026, usuario) REPORTAR BUG (desde AJUSTES): "Ayúdanos a mejorar tu juego:" con un cuadro de texto de hasta 200 caracteres y ENVIAR.
 * Se manda al servidor (POST /api/bug-report). Sin conexión o si falla: queda guardado en el teléfono y se reintenta al abrir esta ventana
 * otra vez (cola en localStorage 'bug.queue').
 */
import Phaser from 'phaser';
import { FONT } from './theme';
import { arcadeButton } from './modeButtons';
import { serverUrl } from '../net/config';
import { getPlayer } from '../domain/playerStore';
const VERSION = '1.0.0';

export const BUG_MAX = 200;
const QUEUE_KEY = 'bug.queue';
type BugReport = { text: string; name: string; level: number; version: string; at: string; ua: string };

function readQueue(): BugReport[] {
  try {
    const v = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as BugReport[];
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
function writeQueue(q: BugReport[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-20)));
  } catch {
    /* sin almacenamiento */
  }
}

async function post(r: BugReport): Promise<boolean> {
  const base = serverUrl();
  if (!base) return false;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(`${base}/api/bug-report`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(r), signal: ctl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Reintenta los reportes guardados (los que se envían salen de la cola). */
export async function flushBugQueue() {
  const q = readQueue();
  if (!q.length) return;
  const left: BugReport[] = [];
  for (const r of q) if (!(await post(r))) left.push(r);
  writeQueue(left);
}

export function openBugReport(scene: Phaser.Scene, depth = 9800) {
  void flushBugQueue();
  const W = scene.scale.width;
  const H = scene.scale.height;
  const root = scene.add.container(0, 0).setDepth(depth).setScrollFactor(0);
  const dim = scene.add.rectangle(0, 0, W, H, 0x02060f, 0.8).setOrigin(0).setInteractive();
  root.add(dim);
  const pw = Math.min(600, W - 40);
  const ph = 520;
  const cy = Math.min(H * 0.36, H / 2 - 40); // arriba: el teclado del teléfono tapa la mitad de abajo
  const g = scene.add.graphics();
  g.fillStyle(0x0a1638, 1).fillRoundedRect(W / 2 - pw / 2 - 4, cy - ph / 2 - 4, pw + 8, ph + 8, 29);
  g.fillStyle(0x0b1a3d, 0.98).fillRoundedRect(W / 2 - pw / 2, cy - ph / 2, pw, ph, 26);
  g.lineStyle(3, 0x3a7bff, 1).strokeRoundedRect(W / 2 - pw / 2, cy - ph / 2, pw, ph, 26);
  root.add(g);
  root.add(scene.add.rectangle(W / 2, cy, pw, ph, 0x000000, 0.001).setInteractive()); // tocar dentro no cierra
  root.add(scene.add.text(W / 2, cy - ph / 2 + 50, 'REPORTAR BUG', { fontFamily: FONT, fontSize: '40px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 6 }).setOrigin(0.5).setLetterSpacing(2));
  root.add(scene.add.text(W / 2, cy - ph / 2 + 100, 'Ayúdanos a mejorar tu juego:', { fontFamily: FONT, fontSize: '22px', color: '#ffd23f' }).setOrigin(0.5));
  const counter = scene.add.text(W / 2 + pw / 2 - 40, cy + 90, `0 / ${BUG_MAX}`, { fontFamily: FONT, fontSize: '16px', color: '#7f93bf' }).setOrigin(1, 0.5);
  const status = scene.add.text(W / 2, cy + 122, '', { fontFamily: FONT, fontSize: '18px', color: '#8dffad', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5);
  root.add([counter, status]);

  // cuadro de texto: un <textarea> del navegador sobre el lienzo, en el mismo sitio (se recoloca con el tamaño del canvas)
  const ta = document.createElement('textarea');
  ta.maxLength = BUG_MAX;
  ta.placeholder = 'Cuéntanos qué pasó…';
  Object.assign(ta.style, {
    position: 'fixed', zIndex: '1000', resize: 'none', boxSizing: 'border-box', padding: '10px 12px', borderRadius: '14px',
    border: '2px solid #3a7bff', background: '#06112b', color: '#ffffff', font: '18px sans-serif', outline: 'none',
  } as Partial<CSSStyleDeclaration>);
  document.body.appendChild(ta);
  const place = () => {
    const r = scene.game.canvas.getBoundingClientRect();
    const k = r.width / W;
    const bx = W / 2 - pw / 2 + 30;
    const by = cy - ph / 2 + 130;
    Object.assign(ta.style, { left: `${r.left + bx * k}px`, top: `${r.top + by * k}px`, width: `${(pw - 60) * k}px`, height: `${130 * k}px`, fontSize: `${Math.max(14, 20 * k)}px` });
  };
  place();
  scene.scale.on('resize', place);
  ta.addEventListener('input', () => counter.setText(`${ta.value.length} / ${BUG_MAX}`));

  let busy = false;
  const close = () => {
    scene.scale.off('resize', place);
    ta.remove();
    root.destroy();
  };
  const send = arcadeButton(scene, W / 2 + 110, cy + ph / 2 - 70, 200, 72, 'ENVIAR', () => {
    const text = ta.value.trim().slice(0, BUG_MAX);
    if (busy) return;
    if (text.length < 3) return void status.setColor('#ffb3a8').setText('Escribe qué pasó');
    busy = true;
    const p = getPlayer();
    const r: BugReport = { text, name: p.name ?? '', level: p.level, version: VERSION, at: new Date().toISOString(), ua: navigator.userAgent.slice(0, 160) };
    status.setColor('#cfe0ff').setText('Enviando…');
    void post(r).then((ok) => {
      if (!root.active) return;
      busy = false;
      if (!ok) writeQueue([...readQueue(), r]);
      status.setColor('#8dffad').setText(ok ? '¡Gracias! Lo revisaremos' : 'Guardado: se enviará cuando haya conexión');
      ta.value = '';
      counter.setText(`0 / ${BUG_MAX}`);
      scene.time.delayedCall(1400, () => root.active && close());
    });
  }, { palette: 'yellow' });
  const cancel = arcadeButton(scene, W / 2 - 110, cy + ph / 2 - 70, 200, 72, 'CERRAR', close, { palette: 'blue' });
  root.add([cancel, send]);
  root.once(Phaser.GameObjects.Events.DESTROY, () => {
    scene.scale.off('resize', place);
    ta.remove();
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => root.active && close());
  setTimeout(() => ta.focus(), 50);
}
