// (24-11-2026) Misiones del tutorial por nivel + ejercicios de los niveles 2, 3 y 4 con el entrenador.
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  // ---------------- matchMissions: ids del tutorial
  ['domain/matchMissions.ts', `export type MissionId = 'dropZero' | 'skyLaunch' | 'netDuel' | 'specialLob' | 'guideJoystick' | 'guideDirectServe';`, `import { TUTORIAL_MISSION_DEFS, type TutorialMissionId, isTutorialMissionId } from './tutorialMissions';
export type MissionId = 'dropZero' | 'skyLaunch' | 'netDuel' | 'specialLob' | 'guideJoystick' | 'guideDirectServe' | TutorialMissionId; // (24-11-2026) + las del tutorial (domain/tutorialMissions.ts)`],
  ['domain/matchMissions.ts', `  if (id === 'guideDirectServe') return { id, title: 'Saque directo', coins: 20 };`, `  if (id === 'guideDirectServe') return { id, title: 'Saque directo', coins: 20 };
  if (isTutorialMissionId(id)) return { id, ...TUTORIAL_MISSION_DEFS[id] };`],
  // ---------------- MatchEndScene: lista de misiones del nivel y "sin todas, no sube"
  ['scenes/MatchEndScene.ts', `  /** (24-11-2026, usuario) partido del TUTORIAL: gane o pierda, da justo la EXP del siguiente nivel (domain/tutorialMatch.ts) */
  tutorial?: boolean;`, `  /** (24-11-2026, usuario) partido del TUTORIAL: gane o pierda, da justo la EXP del siguiente nivel (domain/tutorialMatch.ts) */
  tutorial?: boolean;
  /** (24-11-2026) misiones del tutorial de ese nivel (domain/tutorialMissions.ts); sin ellas, las normales. Sin TODAS hechas no se sube */
  missionList?: MissionId[];`],
  ['scenes/MatchEndScene.ts', `    const gained = d.tutorial && !d.surrendered && !d.rivalLeft && !(d.guide === 'first' && !d.win) ? xpToLevelUp(getPlayer().level, getPlayer().xp) : base;`,
    `    const allMissions = !d.missionList || d.missionList.every((id) => d.missions?.includes(id));
    const gained = d.tutorial && !allMissions ? 0 : d.tutorial && !d.surrendered && !d.rivalLeft && !(d.guide === 'first' && !d.win) ? xpToLevelUp(getPlayer().level, getPlayer().xp) : base;`],
  ['scenes/MatchEndScene.ts', `    const missions = this.d.guide === 'first'
      ? [missionDef('guideJoystick'), missionDef('guideDirectServe')]
      : MISSIONS;`, `    const missions = this.d.missionList
      ? this.d.missionList.map((id) => missionDef(id))
      : this.d.guide === 'first'
        ? [missionDef('guideJoystick'), missionDef('guideDirectServe')]
        : MISSIONS;`],
  ['scenes/MatchEndScene.ts', `          acc += reward(MISSIONS[i]);`, `          acc += reward(missions[i]);`],
  ['scenes/MatchEndScene.ts', `            total.setText(\`+\${Math.round(from + (reward(MISSIONS[i]) * got) / N)}\`);`, `            total.setText(\`+\${Math.round(from + (reward(missions[i]) * got) / N)}\`);`],
  // ---------------- MatchScene: campos
  ['scenes/MatchScene.ts', `  /** (24-11-2026) entrenador del tutorial: pausas con explicación, demostraciones y el turno de 10 s (tutorial/MatchCoach.ts) */
  coach!: MatchCoach;
`, `  /** (24-11-2026) entrenador del tutorial: pausas con explicación, demostraciones y el turno de 10 s (tutorial/MatchCoach.ts) */
  coach!: MatchCoach;
  /** (24-11-2026) misiones del tutorial de este nivel (domain/tutorialMissions.ts); null = las normales */
  private tutMissions: MissionId[] | null = null;
  /** (24-11-2026) EJERCICIO del nivel 3 (direcciones) o 4 (ESPECIAL) en el primer punto; null = sin ejercicio */
  private lesson: 3 | 4 | null = null;
  private lessonStep = 0;
  /** paso del ejercicio cuya pausa ya salió (no se repite al volver a lanzar la pelota) */
  private lessonAsked = -1;
  /** dirección de golpe que usa el AUTO mientras el juego muestra el ejercicio (null = la suya) */
  private lessonAim: Phaser.Math.Vector2 | null = null;
`],
  ['scenes/MatchScene.ts', `    this.tutorial = isTutorialMatch(getPlayer().level, isDevMode(), !!data?.net);`, `    this.tutorial = isTutorialMatch(getPlayer().level, isDevMode(), !!data?.net);
    {
      const lv = getPlayer().level;
      this.tutMissions = this.tutorial ? (tutorialMissionsFor(lv) as MissionId[] | null) : null;
      this.lesson = this.tutorial && !data?.mode && !this.guide && (lv === 3 || lv === 4) ? lv : null;
      this.lessonStep = 0;
      this.lessonAsked = -1;
      this.lessonAim = null;
    }`],
  ['scenes/MatchScene.ts', `import { MatchCoach } from '../tutorial/MatchCoach';`, `import { MatchCoach } from '../tutorial/MatchCoach';
import { tutorialMissionsFor } from '../domain/tutorialMissions';`],
  // ---------------- misiones normales: no en el tutorial con misiones propias
  ['scenes/MatchScene.ts', `    if (this.guide !== 'first') {
      const rivalLaunched`, `    if (this.guide !== 'first' && !this.tutMissions) {
      const rivalLaunched`],
  // ---------------- ganar el partido
  ['scenes/MatchScene.ts', `    if (res.matchWinner !== null) {
      const win = res.matchWinner === 0;`, `    if (res.matchWinner !== null) {
      const win = res.matchWinner === 0;
      if (win) this.tutMission('tWin'); // (24-11-2026) misión del tutorial "Gana el partido"`],
  ['scenes/MatchScene.ts', `        ...(this.tutorial ? { tutorial: true } : {}), // (24-11-2026) un nivel por partido (MatchEndScene)`, `        ...(this.tutorial ? { tutorial: true } : {}), // (24-11-2026) un nivel por partido (MatchEndScene)
        ...(this.tutMissions ? { missionList: [...this.tutMissions] } : {}), // (24-11-2026) misiones del tutorial de este nivel`],
  // ---------------- guideMission: solo las del nivel (si hay lista)
  ['scenes/MatchScene.ts', `  private guideMission(id: MissionId) {
    if (this.missions.done.includes(id)) return;`, `  /** (24-11-2026) misión del tutorial: solo cuenta si es de las de este nivel (domain/tutorialMissions.ts) */
  private tutMission(id: MissionId) {
    if (this.tutMissions?.includes(id)) this.guideMission(id);
  }

  private guideMission(id: MissionId) {
    if (this.missions.done.includes(id)) return;
    if (this.tutMissions && !this.tutMissions.includes(id)) return;`],
  // ---------------- NIVEL 2: solo el DEFENSIVO (el saque con efecto pasa al 15 y la carga al 12)
  ['scenes/MatchScene.ts', `    if (v === 'player' && defensive && this.guide === 'spin' && this.score.played === 1 && this.guidePracticeStep === 0) {
      this.guidePracticeStep = 1;
    }`, `    // (24-11-2026, usuario) NIVEL 2: paso 0 = el juego te muestra el DEFENSIVO; paso 1 = lo usas tú (o, pasados 10 s, lo hace solo)
    if (v === 'player' && defensive && this.practicingReturns()) {
      this.guidePracticeStep++;
      if (this.guidePracticeStep >= 2) {
        this.tutMission('t02Def');
        this.tutMission('t02DefReturn');
      } else this.time.delayedCall(400, () => this.practicingReturns() && this.level2Coach()); // ahora tú
    }`],
  ['scenes/MatchScene.ts', `  private guideServeLesson(): 'tap' | 'direct' | 'spin' | undefined {
    if (this.guide === 'spin' && this.score.played === 0) return 'spin';`, `  private guideServeLesson(): 'tap' | 'direct' | 'spin' | undefined {
    // (24-11-2026, usuario) el saque con efecto ya no se enseña en el nivel 2 (pasa al 15)`],
  ['scenes/MatchScene.ts', `    return this.guide === 'first' ? this.score.played < 3 : this.guide === 'spin' && (this.score.played === 0 || this.practicingReturns());`, `    return this.guide === 'first' ? this.score.played < 3 : this.guide === 'spin' ? this.practicingReturns() : this.lessonPractice();`],
  ['scenes/MatchScene.ts', `    return this.guide === 'spin' && (this.score.played === 1 || this.score.played === 2) && this.guidePracticeStep < 2;`, `    // (24-11-2026, usuario) NIVEL 2: solo el DEFENSIVO, en el primer punto (antes saque con efecto y carga, que pasan al 15 y al 12)
    return this.guide === 'spin' && this.score.played === 0 && this.guidePracticeStep < 2;`],
  ['scenes/MatchScene.ts', `  private practiceChargeLimit() {
    if (!this.practicingReturns()) return 0;`, `  private practiceChargeLimit() {
    if (this.guide === 'spin') return 0; // (24-11-2026) nivel 2: solo DEFENSIVO
    if (!this.practicingReturns()) return 0;`],
  ['scenes/MatchScene.ts', `    } else if (this.practicingReturns() && this.phase === 'rally' && !this.serving) {
      if (this.score.played === 1) {`, `    } else if (this.guide === 'spin' && this.practicingReturns()) {
      text = ''; // (24-11-2026) nivel 2: lo explica la pausa del entrenador
    } else if (this.practicingReturns() && this.phase === 'rally' && !this.serving) {
      if (this.score.played === 1) {`],
  ['scenes/MatchScene.ts', `    this.dashBtn.setHint(this.practicingReturns() && this.score.played === 1 && this.guidePracticeStep === 0 && !this.serveLock && this.phase === 'rally');`, `    this.dashBtn.setHint(this.practicingReturns() && this.guidePracticeStep === 1 && !this.serveLock && this.phase === 'rally');`],
  // la pelota del ejercicio: pausa del entrenador (nivel 2) o del ejercicio del nivel 3 / 4
  ['scenes/MatchScene.ts', `        if (this.practicingReturns()) this.feedPracticeReturn();
        else if (this.serveLet) this.serveLetCall();`, `        if (this.practicingReturns()) this.feedPracticeReturn();
        else if (this.lessonPractice()) this.feedLessonBall();
        else if (this.serveLet) this.serveLetCall();`],
  ['scenes/MatchScene.ts', `    if (this.practicingReturns()) {
      this.feedPracticeReturn();
      return;
    }
    if (w === 'bot' && this.tutorialReplayPoint()) return;`, `    if (this.practicingReturns()) {
      this.feedPracticeReturn();
      return;
    }
    if (this.lessonPractice()) {
      this.feedLessonBall(); // (24-11-2026) ejercicio del nivel 3 / 4: la pelota vuelve hasta terminarlo
      return;
    }
    if (w === 'bot' && this.tutorialReplayPoint()) return;`],
  ['scenes/MatchScene.ts', `    this.lastHitter = 'bot';
    this.shotsThisPoint = Math.max(2, this.shotsThisPoint);
  }`, `    this.lastHitter = 'bot';
    this.shotsThisPoint = Math.max(2, this.shotsThisPoint);
    if (this.guide === 'spin') this.level2Coach();
  }

  /** (24-11-2026, usuario) NIVEL 2 (DEFENSIVO) con el entrenador: paso 0 te lo muestra el juego; paso 1 lo haces tú en 10 s (si no, solo). */
  private level2Coach() {
    const step = this.guidePracticeStep;
    if (this.lessonAsked === step) return;
    this.lessonAsked = step;
    if (step === 0) {
      const demo = () => {
        if (!this.activateDash()) this.coach.attempt(() => this.guidePracticeStep >= 1, demo, undefined, 300);
      };
      this.coach.pause('Cuando la pelota va lejos, pulsa DEFENSIVO: tu personaje corre hasta ella y la devuelve. Mira.', demo);
    } else if (step === 1) {
      const done = () => this.guidePracticeStep >= 2;
      // si en ese instante no se puede (la pelota aún no viene), lo vuelve a intentar enseguida
      const auto = () => {
        if (!this.activateDash()) this.coach.attempt(done, auto, undefined, 300);
      };
      this.coach.pause('Ahora tú: pulsa DEFENSIVO.', () => this.coach.attempt(done, auto));
    }
  }

  // ---------------------------------------------------------------- EJERCICIOS de los niveles 3 y 4 (24-11-2026, usuario)
  /** pasos del ejercicio: nivel 3 = izquierda, derecha, cortita; nivel 4 = te lo muestra el juego, lo haces tú */
  private lessonSteps() {
    return this.lesson === 3 ? 3 : this.lesson === 4 ? 2 : 0;
  }
  /** ¿Se está haciendo el ejercicio? (primer punto, hasta terminar sus pasos) */
  private lessonPractice() {
    return !!this.lesson && this.score.played === 0 && this.lessonStep < this.lessonSteps();
  }
  /** El bot lanza una pelota cómoda hacia ti y sale la explicación del paso (una vez por paso). */
  private feedLessonBall() {
    this.serving = false;
    this.serveCtl.startRally();
    this.bounces = 0;
    const p = this.player;
    const s = this.ball.s;
    s.x = Math.max(NET_X + 90, this.bot.x - 15);
    s.y = this.bot.y;
    s.z = 45;
    this.bot.ch.swing();
    aimShot(s, clamp(p.x + 55, COURT.left + 18, NET_X - 55), clamp(p.y, COURT.top + 40, COURT.bottom - 40), 360, 30);
    this.ball.setKind('normal');
    this.ball.setPower(false);
    this.ball.setMaxCharge(false);
    this.lastHitter = 'bot';
    this.shotsThisPoint = Math.max(2, this.shotsThisPoint);
    this.lessonOnFeed();
  }
  private lessonOnFeed() {
    const step = this.lessonStep;
    if (this.lessonAsked === step) return;
    this.lessonAsked = step;
    const texts = this.lesson === 3
      ? ['Al golpear, el joystick decide hacia dónde va. Mueve el joystick a la IZQUIERDA y golpea.', 'Ahora a la DERECHA.', 'Joystick ABAJO al golpear: una cortita junto a la red.']
      : ['Pulsa ESPECIAL para armar tu golpe: sale como una bola de poder y, si el rival la toca, queda aturdido. Mira.', 'Ahora tú: pulsa ESPECIAL y golpea.'];
    const begin = () => {
      if (this.lesson === 4 && step === 0) return this.lessonAuto(step); // la demostración
      this.coach.attempt(() => this.lessonStep > step, () => this.lessonAuto(step));
    };
    this.coach.pause(texts[step] ?? '', begin);
  }
  /** El juego hace el paso por ti: AUTO con la dirección del paso (nivel 3) o arma el ESPECIAL y golpea (nivel 4). */
  private lessonAuto(step: number) {
    if (this.lesson === 3) {
      this.lessonAim = [new Phaser.Math.Vector2(-1, 0), new Phaser.Math.Vector2(1, 0), new Phaser.Math.Vector2(0, 1)][step] ?? null;
    } else if (this.lesson === 4) {
      this.smashBtn.reduceCooldown(999);
      // si aún no se puede armar (saque, sin pelota), lo vuelve a intentar enseguida
      if (!this.smashArmed && !this.activateSmash()) {
        this.coach.attempt(() => this.lessonStep > step, () => this.lessonAuto(step), undefined, 300);
        return;
      }
    }
    this.coach.demo(true);
  }
  /** Cada golpe tuyo durante el ejercicio. */
  private lessonPlayerHit(power: boolean) {
    if (!this.lessonPractice()) return;
    const step = this.lessonStep;
    let ok = false;
    if (this.lesson === 3) {
      const want = (['left', 'right', 'drop'] as const)[step];
      ok = this.shotFromJoystick() === want;
      if (ok) this.tutMission((['t03Left', 't03Right', 't03Drop'] as const)[step]);
    } else if (this.lesson === 4) {
      ok = power;
      if (ok && step === 1) this.tutMission('t04Arm');
      if (ok) this.smashBtn.reduceCooldown(999); // listo para el paso siguiente
    }
    if (!ok) return;
    this.lessonStep++;
    this.lessonAim = null;
    this.coach.demo(false);
    if (this.lessonPractice()) this.lessonOnFeed(); // el siguiente paso, ya
  }`],
  // golpe del jugador
  ['scenes/MatchScene.ts', `    const practiceLimit = this.practiceChargeLimit();
    if (practiceLimit && charged && c >= practiceLimit) this.guidePracticeStep++;`, `    const practiceLimit = this.practiceChargeLimit();
    if (practiceLimit && charged && c >= practiceLimit) this.guidePracticeStep++;
    this.lessonPlayerHit(!!power && !inferno); // (24-11-2026) ejercicio de los niveles 3 y 4`],
  // AUTO con la dirección del ejercicio
  ['scenes/MatchScene.ts', `    if (now > this.autoAimAt) {
      const r = Math.random();`, `    if (this.lessonAim) this.autoAim.copy(this.lessonAim); // (24-11-2026) el ejercicio pide esa dirección
    else if (now > this.autoAimAt) {
      const r = Math.random();`],
  // aturdir al rival con tu ESPECIAL (nivel 4)
  ['scenes/MatchScene.ts', `    const stunMs = resist ? RESIST_STUN_MS : stunMsFor(kind); // SMASH 0,65 s · ULTI 1,5 s · resiste en ZONA 1 s
    b.stun = resist ? RESIST_STUN_MS / 1000 : stunSeconds(kind);`, `    const stunMs = resist ? RESIST_STUN_MS : stunMsFor(kind); // SMASH 0,65 s · ULTI 1,5 s · resiste en ZONA 1 s
    b.stun = resist ? RESIST_STUN_MS / 1000 : stunSeconds(kind);
    if (kind === 'smash' && !(this.lesson === 4 && this.lessonStep === 0)) this.tutMission('t04Stun'); // (24-11-2026) nivel 4 (la demostración no cuenta)`],
  // bot sin habilidades durante el ejercicio
  ['scenes/MatchScene.ts', `!this.botAbilityUnlocked('defensive') || this.practicingReturns(),`, `!this.botAbilityUnlocked('defensive') || this.practicingReturns() || this.lessonPractice(),`],
  // ---------------- MENÚ: el paso guiado del nivel 2 ya no es el saque con efecto
  ['scenes/MenuScene.ts', `spin: 'TOCA JUGAR PARA PRACTICAR EL SAQUE CON EFECTO' };`, `spin: 'TOCA JUGAR PARA PRACTICAR EL DEFENSIVO' }; // (24-11-2026) nivel 2: solo DEFENSIVO`],
];
const files = new Map();
for (let [f, a, b] of E) {
  const s = files.get(f) ?? readFileSync(S + f, 'utf8');
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  a = a.replace(/\r?\n/g, eol);
  b = b.replace(/\r?\n/g, eol);
  const n = s.split(a).length - 1;
  if (n !== 1) throw new Error(`${f}: ${n} veces: ${a.slice(0, 100)}`);
  files.set(f, s.replace(a, () => b));
}
for (const [f, s] of files) writeFileSync(S + f, s, 'utf8');
console.log('ok', files.size, 'archivos');
