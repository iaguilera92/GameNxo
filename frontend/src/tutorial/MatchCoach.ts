import type Phaser from 'phaser';
import { COACH } from '../domain/tutorialMatch';
import { showCoachPause } from '../ui/CoachPause';

/** Lo que el entrenador necesita del partido (MatchScene). */
export interface CoachHost {
  scene: Phaser.Scene;
  /** detiene / reanuda el partido (física, IA, relojes y el joystick) */
  setPaused(on: boolean): void;
  /** el juego toma el control de tu personaje (AUTO) o te lo devuelve */
  setAuto(on: boolean): void;
}

/**
 * (24-11-2026, usuario) ENTRENADOR del partido del tutorial (solo contra el bot; docs/TUTORIAL-PLAN.md sección 2). Las piezas que usa cada
 * ejercicio:
 *   pause(text)        detiene el partido y explica lo que va a pasar; ENTENDIDO o sigue solo a los 6 s
 *   demo(on)           el juego mueve tu personaje para mostrar cómo se hace (y te lo devuelve)
 *   attempt(...)       tu turno: 10 s para hacerlo; si no, `auto` lo hace por ti
 * `tick(dtMs)` va en el update del partido (solo cuenta con el partido en marcha).
 */
export class MatchCoach {
  private closePause: (() => void) | null = null;
  private trying: { left: number; done: () => boolean; auto: () => void; ok?: () => void } | null = null;
  private demoOn = false;

  constructor(private readonly host: CoachHost) {}

  /** ¿Hay una pausa abierta? */
  get pausing() {
    return !!this.closePause;
  }

  /** ¿El juego está moviendo tu personaje? */
  get demoing() {
    return this.demoOn;
  }

  /** Detiene el partido con una explicación breve; `then` al seguir (ENTENDIDO o a los 6 s). */
  pause(text: string, then?: () => void) {
    this.closePause?.();
    this.host.setPaused(true);
    this.closePause = showCoachPause(this.host.scene, text, () => {
      this.closePause = null;
      this.host.setPaused(false);
      then?.();
    }, { autoMs: COACH.autoResumeMs });
  }

  /** El juego toma (on) o devuelve (off) el control de tu personaje. */
  demo(on: boolean) {
    if (this.demoOn === on) return;
    this.demoOn = on;
    this.host.setAuto(on);
  }

  /**
   * Tu turno: cada fotograma se mira `done()`; si se cumple, `ok()`. Si pasan `ms` (10 s) sin lograrlo, `auto()` lo hace por ti (por ejemplo,
   * llevar al personaje solo hasta el círculo y rematar).
   */
  attempt(done: () => boolean, auto: () => void, ok?: () => void, ms = COACH.tryMs) {
    this.trying = { left: ms, done, auto, ok };
  }

  /** Cancela el turno en curso (el punto terminó). */
  cancel() {
    this.trying = null;
  }

  /** En el update del partido (en marcha). */
  tick(dtMs: number) {
    const t = this.trying;
    if (!t) return;
    if (t.done()) {
      this.trying = null;
      t.ok?.();
      return;
    }
    t.left -= dtMs;
    if (t.left <= 0) {
      this.trying = null;
      t.auto();
    }
  }

  /** Al salir del partido. */
  destroy() {
    this.closePause?.();
    this.closePause = null;
    this.trying = null;
    if (this.demoOn) this.demo(false);
  }
}
