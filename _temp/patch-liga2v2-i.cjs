const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
let s = fs.readFileSync(base + 'ui/ProfileDialog.ts', 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
s = s.replace(/\r\n/g, '\n');
function rep(a, b) {
  if (s.split(a).length !== 2) throw new Error('x' + (s.split(a).length - 1) + ': ' + a.slice(0, 70));
  s = s.replace(a, () => b);
}
function cut(from, to, b) {
  const i = s.indexOf(from);
  const j = s.indexOf(to, i);
  if (i < 0 || j < 0) throw new Error('cut ' + from.slice(0, 40));
  s = s.slice(0, i) + b + s.slice(j);
}

rep("import { FRAME_IDS, type FrameId, bestLeague, equipFrame, equippedFrame, frameUnlocked } from '../domain/profileFrames';",
  "import { FRAME_IDS, type FrameId, bestLeague, equipFrame, equipFrame2v2, equippedFrame, equippedFrame2v2, frame2v2Unlocked, frameUnlocked } from '../domain/profileFrames';\nimport { type FrameSet, addProfileFrameArt } from './profileFrameArt';\nimport { bestLeague2v2 } from '../domain/league2v2';");
rep("    frame: equippedFrame(s),\n  };", "    frame: equippedFrame(s),\n    frame2v2: equippedFrame2v2(s),\n    best2v2: bestLeague2v2(s),\n  };");
rep("  const paint = () => {\n    body.removeAll(true);", "  // pestaña de los marcos: los de LIGA o los de LIGA 2V2 (abre en la del marco que se está usando)\n  let frameTab: FrameSet = getPlayer().equipped.frame2v2 ? '2v2' : '1v1';\n  const paint = () => {\n    body.removeAll(true);");
rep("drawProfileFrame(fg, pw, ph, 26, d.frame);", "drawProfileFrame(fg, pw, ph, 26, d.frame2v2 ?? d.frame);");
rep("    const rh = 74;", "    const rh = 64;");

cut(
  "    // MARCOS: uno por liga; los de ligas no alcanzadas, con candado",
  "    // COLECCIÓN (destacada, al final)",
  `    // MARCOS (21-11-2026, usuario): dos juegos, los de LIGA y los de LIGA 2V2 (se ganan al subir de liga en la semanal); una pestaña
    // para cada uno y una cuadrícula de 3 x 2 con la imagen de cada marco. Los de ligas no alcanzadas, con candado.
    const fy = gy0 + 3 * (rh + 10) + 6;
    body.add(scene.add.text(left + 28, fy, 'MARCO DEL PERFIL', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' }).setOrigin(0, 0.5).setLetterSpacing(1.5));
    const none = d.frame == null && d.frame2v2 == null;
    body.add(
      arcadeButton(scene, left + pw - 28 - 70, fy, 140, 34, 'SIN MARCO', () => {
        if (!none) commit((st) => equipFrame(st as never, null) as never);
      }, { palette: none ? 'yellow' : 'grey', noShadow: true }),
    );
    const tabY = fy + 38;
    const tabW = (pw - 48 - 12) / 2;
    (['1v1', '2v2'] as const).forEach((t, i) => {
      const on = frameTab === t;
      body.add(
        arcadeButton(scene, left + 24 + tabW / 2 + i * (tabW + 12), tabY, tabW, 36, t === '1v1' ? 'LIGA' : 'LIGA 2V2', () => {
          if (frameTab === t) return;
          frameTab = t;
          paint();
        }, { palette: on ? (t === '1v1' ? 'yellow' : 'purple') : 'grey', noShadow: !on }),
      );
    });
    body.add(
      scene.add.text(W / 2, tabY + 30, frameTab === '2v2' ? 'Sube de liga 2V2 en la semanal para ganar su marco' : 'Llega a una liga para ganar su marco', { fontFamily: FONT, fontSize: '13px', color: '#7f93bf' }).setOrigin(0.5),
    );
    const gap = 10;
    const cols = 3;
    const sw = (pw - 48 - gap * (cols - 1)) / cols;
    const sh = Math.min(56, sw / 3.3);
    const gridTop = tabY + 52;
    const rowPitch = sh + 26;
    FRAME_IDS.forEach((f, i) => {
      const x = left + 24 + (i % cols) * (sw + gap);
      const y = gridTop + Math.floor(i / cols) * rowPitch;
      const unlocked = frameTab === '2v2' ? frame2v2Unlocked(getPlayer(), f) : frameUnlocked(getPlayer(), f);
      const sel = frameTab === '2v2' ? d.frame2v2 === f : d.frame === f && !d.frame2v2;
      const sg = scene.add.graphics({ x, y });
      sg.fillStyle(0x0b1733, 1).fillRoundedRect(0, 0, sw, sh, 10);
      body.add(sg);
      const img = addProfileFrameArt(scene, sw, sh, f, frameTab);
      if (img) {
        const holder = scene.add.container(x, y, [img]);
        body.add(holder);
      } else drawProfileFrame(sg, sw, sh, 10, f);
      if (!unlocked) {
        const dim = scene.add.graphics({ x, y });
        dim.fillStyle(0x000000, 0.55).fillRoundedRect(0, 0, sw, sh, 10);
        body.add(dim);
      }
      if (sel) {
        const ring = scene.add.graphics({ x, y });
        ring.lineStyle(3, 0xffffff, 1).strokeRoundedRect(-5, -5, sw + 10, sh + 10, 14);
        body.add(ring);
      }
      const lbl = scene.add.text(x + sw / 2, y + sh + 13, rankDef(f).name.toUpperCase(), { fontFamily: FONT, fontSize: '12px', color: sel ? '#ffffff' : unlocked ? '#9fb4e0' : '#56607a' }).setOrigin(0.5);
      body.add(lbl);
      if (!unlocked) {
        const lk = scene.add.graphics({ x: x + sw / 2, y: y + sh / 2 });
        lk.lineStyle(3, 0xb7c2de).beginPath().arc(0, -3, 6, Math.PI, 0).strokePath();
        lk.fillStyle(0xb7c2de).fillRoundedRect(-8, -3, 16, 12, 2);
        body.add(lk);
      } else if (sel) {
        body.add(scene.add.text(x + sw / 2, y + sh / 2, '✓', { fontFamily: FONT, fontSize: '26px', color: '#ffffff', stroke: '#0a1638', strokeThickness: 5 }).setOrigin(0.5));
      }
      const hit = scene.add.zone(x + sw / 2, y + (sh + 22) / 2, sw + gap, sh + 22).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => {
        if (!unlocked) return onToast(frameTab === '2v2' ? \`Sube a \${rankDef(f).name.toUpperCase()} en la LIGA 2V2 para ganar este marco\` : \`Llega a \${rankDef(f).name.toUpperCase()} para ganar este marco\`);
        if (sel) return;
        commit((st) => (frameTab === '2v2' ? equipFrame2v2(st as never, f) : equipFrame(st as never, f)) as never);
      });
      body.add(hit);
    });
    const gridBottom = gridTop + 2 * rowPitch;

`,
);
rep("    const cy = fy + 24 + sh + 40; // al final, bajo los marcos (16-11-2026)", "    const cy = gridBottom + 6; // al final, bajo los marcos (16-11-2026)");
rep("    body.add(scene.add.text(W / 2, cy + 120, 'Estilos, poderes y efectos desbloqueados · consíguelos en la Tienda, el Pase y la Ruleta', { fontFamily: FONT, fontSize: '13px', color: '#9fb4e0', align: 'center', wordWrap: { width: pw - 60 } }).setOrigin(0.5, 0));\n", "");
fs.writeFileSync(base + 'ui/ProfileDialog.ts', s.replace(/\n/g, nl));
