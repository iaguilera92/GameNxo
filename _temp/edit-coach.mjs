// (24-11-2026) Motor del tutorial en el partido: entrenador, sin rendirse/AUTO, victoria asegurada hasta el 9, un partido = un nivel.
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  // ---------------- BotBrain: fallo forzado
  ['ai/BotBrain.ts', `    if (Math.random() < ai.outChance * STRAT.risk[intent] * (STRAT.outBase + STRAT.outBadContact * (1 - q))) {`,
    `    // (24-11-2026) \`forceOut\`: partido del tutorial que se gana siempre (domain/tutorialMatch.ts botForcedOutChance)
    if (Math.random() < this.forceOut || Math.random() < ai.outChance * STRAT.risk[intent] * (STRAT.outBase + STRAT.outBadContact * (1 - q))) {`],
  ['ai/BotBrain.ts', `  netPractice = false;`, `  netPractice = false;
  /** (24-11-2026) probabilidad 0..1 de tirar FUERA el próximo golpe (tutorial que se gana siempre; MatchScene.tutorialGuardPoint) */
  forceOut = 0;`],
  // ---------------- MatchScene
  ['scenes/MatchScene.ts', `import { isDevMode } from '../domain/devMode';`, `import { isDevMode } from '../domain/devMode';
import { botForcedOutChance, isTutorialMatch, tutorialWinGuard } from '../domain/tutorialMatch';
import { MatchCoach } from '../tutorial/MatchCoach';`],
  ['scenes/MatchScene.ts', `  private paused = false;
`, `  private paused = false;
  /** (24-11-2026, usuario) partido del TUTORIAL (contra el bot, modo desarrollo apagado, cuenta bajo el nivel 20): sin rendirse ni AUTO, un nivel por partido */
  private tutorial = false;
  /** (24-11-2026) entrenador del tutorial: pausas con explicación, demostraciones y el turno de 10 s (tutorial/MatchCoach.ts) */
  coach!: MatchCoach;
`],
  ['scenes/MatchScene.ts', `    this.guide = !isDevMode() && !data?.net && !data?.mode ? data?.guide : undefined;`, `    this.guide = !isDevMode() && !data?.net && !data?.mode ? data?.guide : undefined;
    this.tutorial = isTutorialMatch(getPlayer().level, isDevMode(), !!data?.net);`],
  ['scenes/MatchScene.ts', `    this.surrenderBtn = this.makeSurrenderIcon();
    this.autoPlay = false;
    this.autoBtn = this.makeAutoButton().setVisible(!this.guide);`, `    this.surrenderBtn = this.makeSurrenderIcon();
    this.autoPlay = false;
    this.autoBtn = this.makeAutoButton().setVisible(!this.guide && !this.tutorial);
    // (24-11-2026, usuario) en el tutorial no hay rendirse (ni AUTO): se juega hasta el final; si se cierra la app, se juega de nuevo
    if (this.tutorial) this.surrenderBtn.setVisible(false);
    this.coach?.destroy();
    this.coach = new MatchCoach({
      scene: this,
      setPaused: (on) => {
        this.paused = on;
        this.time.paused = on;
        this.joy.release();
        this.joy.enabled = !on;
      },
      setAuto: (on) => {
        this.autoPlay = on;
        if (!on) stopMotion(this.motion);
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.coach.destroy());`],
  ['scenes/MatchScene.ts', `  private openSurrender() {
    if (this.paused || this.phase === 'over' || this.cineLock) return;`, `  private openSurrender() {
    if (this.tutorial || this.paused || this.phase === 'over' || this.cineLock) return;`],
  ['scenes/MatchScene.ts', `    if (this.paused) return;
    this.tickRallyClock(deltaMs / 1000);`, `    if (this.paused) return;
    this.coach.tick(deltaMs); // (24-11-2026) turno del ejercicio del tutorial (10 s)
    this.tickRallyClock(deltaMs / 1000);`],
  ['scenes/MatchScene.ts', `    if (!secondServe) this.brain.onPointStart(this.score.points, this.score.games);`, `    if (!secondServe) this.brain.onPointStart(this.score.points, this.score.games);
    this.tutorialGuardPoint();`],
  ['scenes/MatchScene.ts', `    if (this.practicingReturns()) {
      this.feedPracticeReturn();
      return;
    }
    if (this.guide === 'first' && this.score.played === 2 && w === 'player') this.guideMission('guideDirectServe');`, `    if (this.practicingReturns()) {
      this.feedPracticeReturn();
      return;
    }
    if (w === 'bot' && this.tutorialReplayPoint()) return;
    this.coach.cancel(); // (24-11-2026) el punto terminó: el turno del ejercicio en curso se cancela
    if (this.guide === 'first' && this.score.played === 2 && w === 'player') this.guideMission('guideDirectServe');`],
  ['scenes/MatchScene.ts', `  /** (22-11-2026, usuario) los espectadores que aplauden (ambiente-2) lo hacen solo al ganarse un punto */`, `  /**
   * (24-11-2026, usuario) Tutorial que se gana siempre (hasta el nivel 9, domain/tutorialMatch.ts): en los puntos libres el bot tira fuera más
   * cuanto mejor va (empatados la mitad, ganando siempre). No toca los puntos guiados (el guion manda).
   */
  private tutorialGuardPoint() {
    const lv = getPlayer().level;
    const on = this.tutorial && !this.doingGuidePoint();
    const chance = on ? botForcedOutChance(lv, this.score.points[0], this.score.points[1]) : 0;
    for (const b of this.doubles ? this.rivalBrains : [this.brain]) b.forceOut = chance;
  }

  /**
   * (24-11-2026, usuario) Tutorial que se gana siempre: si el bot fuese a ganar el partido (partido corto, ya con 3 puntos), el punto SE REPITE
   * (sin cambiar el marcador). true = se repite (pointTo no sigue).
   */
  private tutorialReplayPoint(): boolean {
    if (!this.tutorial || !tutorialWinGuard(getPlayer().level) || !this.score.shortMatch || this.score.points[1] < 3) return false;
    this.duelAbort('point');
    this.phase = 'pointover';
    this.resetRallyClock();
    this.slowmoAbort();
    this.stopCharge();
    this.disarmUnusedSmash();
    this.coach.cancel();
    const h = this.headPos(this.player);
    this.popText(h.x, h.y - 10, 'SE REPITE EL PUNTO', '#ffd23f', 30);
    this.time.delayedCall(1200, () => this.startPoint());
    return true;
  }

  /** (22-11-2026, usuario) los espectadores que aplauden (ambiente-2) lo hacen solo al ganarse un punto */`],
  ['scenes/MatchScene.ts', `        guide: this.guide,
        botName: this.botName,`, `        guide: this.guide,
        ...(this.tutorial ? { tutorial: true } : {}), // (24-11-2026) un nivel por partido (MatchEndScene)
        botName: this.botName,`],
  // ---------------- MatchEndScene: un partido = un nivel
  ['scenes/MatchEndScene.ts', `  lan?: boolean;`, `  lan?: boolean;
  /** (24-11-2026, usuario) partido del TUTORIAL: gane o pierda, da justo la EXP del siguiente nivel (domain/tutorialMatch.ts) */
  tutorial?: boolean;`],
  ['scenes/MatchEndScene.ts', `    const gained = d.surrendered ? XP_SURRENDER : d.rivalLeft ? (d.playerGames >= 1 ? XP_LOSS : 0) : d.win ? XP_WIN : d.guide === 'first' ? 0 : XP_LOSS;`,
    `    const base = d.surrendered ? XP_SURRENDER : d.rivalLeft ? (d.playerGames >= 1 ? XP_LOSS : 0) : d.win ? XP_WIN : d.guide === 'first' ? 0 : XP_LOSS;
    // (24-11-2026, usuario) tutorial: un partido = un nivel, gane o pierda (el primer partido guiado se gana siempre)
    const gained = d.tutorial && !d.surrendered && !d.rivalLeft && !(d.guide === 'first' && !d.win) ? xpToLevelUp(getPlayer().level, getPlayer().xp) : base;`],
  ['scenes/MatchEndScene.ts', `import { ambienteEdges, footerDark } from '../view/CourtView';`, `import { ambienteEdges, footerDark } from '../view/CourtView';
import { xpToLevelUp } from '../domain/tutorialMatch';`],
];
const files = new Map();
for (let [f, a, b] of E) {
  const s = files.get(f) ?? readFileSync(S + f, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  a = a.replace(/\r?\n/g, eol);
  b = b.replace(/\r?\n/g, eol);
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${f}: ${n} veces: ${a.slice(0, 90)}`);
  files.set(f, s.replace(a, () => b));
}
for (const [f, s] of files) writeFileSync(S + f, s, 'utf8');
console.log('ok', files.size, 'archivos');
