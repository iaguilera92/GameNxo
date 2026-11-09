import Phaser from 'phaser';
import type { Character } from '../objects/Character';
import { MatchEndScene, type MatchEndData } from '../scenes/MatchEndScene';

/**
 * Final cinematográfico del partido, SOBRE el mismo mapa (sin cambiar de escena):
 *  1. desactiva los toques del partido y desvanece HUD/controles (todo lo que va fijo en pantalla)
 *  2. aleja la cámara suavemente (zoom out moderado)
 *  3. ganador celebra (animación `victory` existente); perdedor se encorva y baja la raqueta
 *  4. lanza el overlay de resultados (escena MatchEnd encima de la del partido)
 *
 * Solo visual: no toca puntuación, físicas, IA ni reglas. Los datos llegan ya calculados.
 */
export interface MatchEndOpts {
  winner: Character;
  loser: Character;
  data: MatchEndData;
}

const ZOOM = 0.9;
const DURATION = 1100;

export function playMatchEnd(scene: Phaser.Scene, o: MatchEndOpts) {  // 1) sin controles; fuera HUD y botones (objetos con scrollFactor 0 = fijos en pantalla)
  scene.input.enabled = false;
  for (const obj of scene.children.list) {
    const sf = (obj as unknown as { scrollFactorX?: number }).scrollFactorX;
    if (sf === 0) scene.tweens.add({ targets: obj, alpha: 0, duration: 350 });
  }

  // 2) cámara: zoom out suave (el mapa y los personajes siguen visibles)
  scene.cameras.main.zoomTo(ZOOM, DURATION, 'Sine.easeInOut');

  // 3) poses
  // con hoja de sprites ya están en su pose final desde el último punto (no se reinician ni se encorvan)
  if (!o.winner.hasSheet) o.winner.victory();
  if (!o.loser.hasSheet) slump(scene, o.loser);

  // 4) overlay de resultados encima del partido
  const key = MatchEndScene.KEY;
  const wp = o.winner.endPoses()?.victory;
  const lp = o.loser.endPoses()?.defeat;
  const data: MatchEndData = { ...o.data, matchKey: scene.scene.key, poses: { me: o.data.win ? wp : lp, rival: o.data.win ? lp : wp } };
  scene.time.delayedCall(450, () => {
    if (scene.scene.get(key)) scene.scene.launch(key, data);
    else scene.scene.add(key, MatchEndScene, true, data);
    scene.scene.bringToTop(key);
  });
}

/** Postura de derrota: cuerpo inclinado hacia delante, un poco hundido y raqueta caída. */
function slump(scene: Phaser.Scene, ch: Character) {
  scene.tweens.killTweensOf(ch.rig);
  const dir = ch.facing || 1;
  scene.tweens.add({ targets: ch.rig, angle: 7 * dir, y: 5, duration: 600, ease: 'Sine.easeOut' });
  // brazo vectorial/imagen (con sprites el contenedor está vacío y no afecta)
  scene.tweens.add({ targets: ch.racketArm, angle: ch.restAngle + 70, duration: 600, ease: 'Sine.easeOut' });
  // respiración pesada
  scene.tweens.add({ targets: ch.rig, scaleY: 0.97, duration: 900, delay: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
}

/** Deshace el final (antes de revancha o salida): cámara y toques como estaban. */
export function resetMatchEnd(scene: Phaser.Scene) {
  scene.cameras.main.setZoom(1);
  scene.input.enabled = true;
}
