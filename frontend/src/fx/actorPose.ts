import type Phaser from 'phaser';
import { VIEW, project } from '../view/projection';

/**
 * Cómo se COLOCA un personaje en pantalla a partir de su posición de cancha y de los movimientos de los DEFENSIVOS. Lo usan el partido
 * (`MatchScene.renderActors`) y la demostración del selector de PERSONALIZAR (`fx/powerDemo.ts`), para que se vea igual.
 *
 *   lift    altura extra del dibujo (SUPERSALTO, VOLTERETA, remate): sube el dibujo, la sombra y la profundidad siguen en el suelo
 *   spin    giro del dibujo en rad sobre el centro de su cuerpo (VOLTERETA, inclinación del PATINAJE)
 *   squat   agachado (+) / estirado (−) al despegar y al caer (0..1)
 *   warp    1 = normal, 0 = desaparecido (DASH de teletransporte, DESTELLO)
 */
export interface PoseActor {
  x: number;
  y: number;
  warp: number;
  lift?: number;
  spin?: number;
  spinWas?: boolean;
  squat?: number;
  /** la sombra del personaje está fuera de su sitio (salto / giro): se devuelve a los pies al aterrizar */
  shadowMoved?: boolean;
}

/** Medio alto del personaje (alto 150) sobre el que gira. */
const HALF_BODY = 72;

/**
 * Coloca `ch` según `a`: posición, escala (con `boost` extra), giro, agachado, transparencia y sombra. Devuelve la proyección del suelo
 * (la usa quien llama para el polvo de carrera y la profundidad).
 */
export function placeActor(ch: Phaser.GameObjects.Container & { shadow: Phaser.GameObjects.Ellipse }, a: PoseActor, boost = 1) {
  const p = project(a.x, a.y);
  const k = p.s * VIEW.CHAR_K * boost;
  // SUPERSALTO: el dibujo sube (lift en z) pero la profundidad sigue la del suelo
  const sy = a.lift ? project(a.x, a.y, a.lift).sy : p.sy;
  // VOLTERETA / PATINAJE: el dibujo gira sobre su centro (spin) y se agacha al caer (squat)
  let px = p.sx;
  let py = sy;
  if (a.spin) {
    const cH = HALF_BODY * k;
    px += -cH * Math.sin(a.spin);
    py += -cH + cH * Math.cos(a.spin);
  }
  const sq = a.squat ?? 0;
  ch.setPosition(px, py).setScale(k * a.warp * (1 + 0.08 * sq), k * (1 + (1 - a.warp) * 0.8) * (1 - 0.2 * sq)).setDepth(p.sy);
  if (a.spin || a.spinWas) ch.setAngle(((a.spin ?? 0) * 180) / Math.PI); // al terminar vuelve a 0
  a.spinWas = !!a.spin;
  ch.setAlpha(0.25 + 0.75 * a.warp);
  // SOMBRA: se queda en el SUELO mientras el dibujo salta o gira (antes subía pegada a los pies del personaje) y se achica y aclara con la
  // altura. Se coloca deshaciendo la posición, el giro y la escala del personaje.
  const airborne = (a.lift ?? 0) > 0 || !!a.spin;
  if (airborne) {
    const ang = ch.rotation;
    const cs = Math.cos(ang);
    const sn = Math.sin(ang);
    const dx = p.sx - px;
    const dy = p.sy - py;
    const hh = Math.min(1, (a.lift ?? 0) / 120);
    ch.shadow.setPosition((dx * cs + dy * sn) / ch.scaleX, (-dx * sn + dy * cs) / ch.scaleY).setRotation(-ang).setScale(1 - 0.4 * hh).setAlpha(1 - 0.55 * hh);
    a.shadowMoved = true;
  } else if (a.shadowMoved) {
    ch.shadow.setPosition(0, 0).setRotation(0).setScale(1).setAlpha(1);
    a.shadowMoved = false;
  }
  return p;
}
