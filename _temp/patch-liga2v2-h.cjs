const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
function edit(f, pairs) {
  let s = fs.readFileSync(base + f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (b && s.includes(b)) continue;
    if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 70) + ' x' + (s.split(a).length - 1));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(base + f, s.replace(/\n/g, nl));
}

edit('domain/profileFrames.ts', [
  ["import { LEAGUE_ORDER } from './rankedConfig';", "import { LEAGUE_ORDER } from './rankedConfig';\nimport { bestLeague2v2 } from './league2v2';"],
  [
    "/** Elige marco (null = sin marco). Error si está bloqueado. */\nexport function equipFrame(s: PlayerState, id: FrameId | null): { ok: true; state: PlayerState } | { ok: false; error: 'locked' } {\n  if (id && !frameUnlocked(s, id)) return { ok: false, error: 'locked' };\n  const n = clonePlayer(s);\n  if (id) n.equipped.frame = id;\n  else delete n.equipped.frame;\n  return { ok: true, state: n };\n}",
    "/** Elige marco (null = sin marco, ni de liga ni 2v2). Error si está bloqueado. Elegir uno de liga quita el marco 2v2 (solo se ve uno). */\nexport function equipFrame(s: PlayerState, id: FrameId | null): { ok: true; state: PlayerState } | { ok: false; error: 'locked' } {\n  if (id && !frameUnlocked(s, id)) return { ok: false, error: 'locked' };\n  const n = clonePlayer(s);\n  if (id) n.equipped.frame = id;\n  else delete n.equipped.frame;\n  delete n.equipped.frame2v2;\n  return { ok: true, state: n };\n}\n\n// ---------------------------------------------------------------- MARCOS 2V2 (21-11-2026, usuario)\n// Los de la LIGA 2v2: se ganan al SUBIR de liga 2v2 en la semanal (domain/league2v2.ts: `bestLeague`); mismas ids de liga que los de arriba.\n\n/** ¿Ya se alcanzó esa liga 2v2 (o una más alta)? */\nexport function frame2v2Unlocked(s: PlayerState, id: FrameId): boolean {\n  return LEAGUE_ORDER.indexOf(id) >= 0 && LEAGUE_ORDER.indexOf(id) <= LEAGUE_ORDER.indexOf(bestLeague2v2(s));\n}\n\n/** Marco 2v2 que se ve (el elegido si sigue desbloqueado; null = ninguno). */\nexport function equippedFrame2v2(s: PlayerState): FrameId | null {\n  const f = s.equipped.frame2v2;\n  return f && frame2v2Unlocked(s, f) ? f : null;\n}\n\n/** Elige un marco 2v2 (quita el de liga: solo se ve uno). Error si está bloqueado. */\nexport function equipFrame2v2(s: PlayerState, id: FrameId): { ok: true; state: PlayerState } | { ok: false; error: 'locked' } {\n  if (!frame2v2Unlocked(s, id)) return { ok: false, error: 'locked' };\n  const n = clonePlayer(s);\n  n.equipped.frame2v2 = id;\n  delete n.equipped.frame;\n  return { ok: true, state: n };\n}",
  ],
]);

fs.writeFileSync(
  base + 'ui/profileFrameArt.ts',
  `import Phaser from 'phaser';
import meta1v1 from './profile-frames.json';
import meta2v2 from './profile-frames-2v2.json';
import { FRAME_IDS, type FrameId } from '../domain/profileFrames';

/**
 * ARTE DE LOS MARCOS DEL PERFIL (21-11-2026, usuario): un WebP con transparencia por liga, en DOS juegos: los de la liga normal
 * (public/assets/marcos/<liga>.webp, de la hoja marcos-ranked.png) y los de la LIGA 2v2 (public/assets/marcos2v2/<liga>.webp, de
 * marcos-ranked-2v2.png). Salen de public/personajes/Marcos/ con \`node tools/build-profile-frames.mjs\` (y \`SET=2v2\` para los 2v2), que
 * también escribe los JSON con el tamaño de cada uno y su CUERPO: el rectángulo que coincide con la card; las alas y la corona
 * (Diamante, Challenger) sobresalen. Los ids son los de las ligas y no cambian (docs/BASE-DE-DATOS.md).
 */
export type FrameSet = '1v1' | '2v2';
type FrameMeta = { w: number; h: number; body: { x: number; y: number; w: number; h: number } };
const META: Record<FrameSet, Record<string, FrameMeta>> = { '1v1': meta1v1 as Record<string, FrameMeta>, '2v2': meta2v2 as Record<string, FrameMeta> };
const DIR: Record<FrameSet, string> = { '1v1': 'marcos', '2v2': 'marcos2v2' };

export const frameTexKey = (id: FrameId, set: FrameSet = '1v1') => (set === '2v2' ? \`marco2v2-\${id}\` : \`marco-\${id}\`);

/** Encola las imágenes de los marcos que falten (las 12: menú y diálogo del perfil). */
export function queueProfileFrameArt(load: Phaser.Loader.LoaderPlugin) {
  for (const set of ['1v1', '2v2'] as const) {
    for (const id of FRAME_IDS) if (!load.scene.textures.exists(frameTexKey(id, set))) load.image(frameTexKey(id, set), \`assets/\${DIR[set]}/\${id}.webp\`);
  }
}

/**
 * Imagen del marco para una card de w x h en (0,0): su cuerpo cubre exactamente la card. null si la imagen no cargó
 * (entonces se dibuja el marco de siempre, drawProfileFrame).
 */
export function addProfileFrameArt(scene: Phaser.Scene, w: number, h: number, id: FrameId, set: FrameSet = '1v1'): Phaser.GameObjects.Image | null {
  const m = META[set][id];
  if (!m || !scene.textures.exists(frameTexKey(id, set))) return null;
  const kx = w / m.body.w;
  const ky = h / m.body.h;
  return scene.add.image(-m.body.x * kx, -m.body.y * ky, frameTexKey(id, set)).setOrigin(0, 0).setDisplaySize(m.w * kx, m.h * ky);
}
`,
);

edit('scenes/MenuScene.ts', [
  ["import { equippedFrame } from '../domain/profileFrames';", "import { equippedFrame, equippedFrame2v2 } from '../domain/profileFrames';"],
  [
    "      const fid = equippedFrame(getPlayer() as PlayerState);\n      frameImg = fid ? addProfileFrameArt(this, cw, ch, fid) : null;",
    "      // el marco 2v2 (de la LIGA 2v2) manda sobre el de liga si es el elegido\n      const f2 = equippedFrame2v2(getPlayer() as PlayerState);\n      const fid = f2 ?? equippedFrame(getPlayer() as PlayerState);\n      frameImg = fid ? addProfileFrameArt(this, cw, ch, fid, f2 ? '2v2' : '1v1') : null;",
  ],
]);
