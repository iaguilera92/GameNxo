// (24-11-2026) Misiones del tutorial de los niveles 5 a 15: dónde se cumple cada una.
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  ['scenes/MatchScene.ts', `      const withLesson = (lv === 1 && this.guide === 'first') || (lv === 2 && this.guide === 'spin') || !!this.lesson;
      this.tutMissions = this.tutorial && withLesson ? (tutorialMissionsFor(lv) as MissionId[] | null) : null;`, `      const withLesson = (lv === 1 && this.guide === 'first') || (lv === 2 && this.guide === 'spin') || !!this.lesson;
      const required = TUTORIAL_REQUIRED_LEVELS.has(lv);
      this.tutMissions = this.tutorial && (!required || withLesson) ? (tutorialMissionsFor(lv) as MissionId[] | null) : null;
      this.tutMissionsRequired = this.tutorial && required && withLesson;
      this.tutPointsWon = 0;`],
  ['scenes/MatchScene.ts', `  private tutMissions: MissionId[] | null = null;`, `  private tutMissions: MissionId[] | null = null;
  /** (24-11-2026) sin todas las misiones no se sube (niveles con ejercicio guiado, domain/tutorialMissions.ts) */
  private tutMissionsRequired = false;
  /** puntos ganados en el partido (misión "Gana 3 puntos") */
  private tutPointsWon = 0;`],
  ['scenes/MatchScene.ts', `import { tutorialMissionsFor } from '../domain/tutorialMissions';`, `import { TUTORIAL_REQUIRED_LEVELS, tutorialMissionsFor } from '../domain/tutorialMissions';`],
  ['scenes/MatchScene.ts', `        ...(this.tutMissions ? { missionList: [...this.tutMissions] } : {}), // (24-11-2026) misiones del tutorial de este nivel`, `        ...(this.tutMissions ? { missionList: [...this.tutMissions], ...(this.tutMissionsRequired ? { missionsRequired: true } : {}) } : {}), // (24-11-2026) misiones del tutorial de este nivel`],
  ['scenes/MatchEndScene.ts', `  missionList?: MissionId[];`, `  missionList?: MissionId[];
  /** (24-11-2026) en ese nivel las misiones son obligatorias para subir */
  missionsRequired?: boolean;`],
  ['scenes/MatchEndScene.ts', `    const allMissions = !d.missionList || d.missionList.every((id) => d.missions?.includes(id));`, `    const allMissions = !d.missionsRequired || !d.missionList || d.missionList.every((id) => d.missions?.includes(id));`],
  // ---------------- dónde se cumple cada una
  // DEFENSIVO
  ['scenes/MatchScene.ts', `  private recordHit(v: Who | null, defensive = false) {`, `  private recordHit(v: Who | null, defensive = false) {
    if (v === 'player' && defensive) this.tutMission('tDef'); // (24-11-2026) misión del tutorial`],
  // ESPECIAL, ULTI, REMATE, CARGADO, BIEN / PERFECTO / RACHA
  ['scenes/MatchScene.ts', `    if (power && !inferno) this.missionShot = 'special'; // MISIONES: tu ESPECIAL (la ULTI no cuenta); el GLOBO máximo se marca en su rama`, `    if (power && !inferno) this.missionShot = 'special'; // MISIONES: tu ESPECIAL (la ULTI no cuenta); el GLOBO máximo se marca en su rama
    // (24-11-2026) misiones del tutorial (domain/tutorialMissions.ts)
    if (power && !inferno) this.tutMission('tSpecial');
    if (inferno) this.tutMission('tUlti');
    if (remate) this.tutMission('tRemate');
    if (charged && !power && c >= 0.5) this.tutMission('tCharge');
    if (timed?.grade === 'good' || timed?.grade === 'perfect') this.tutMission('tGood');
    if (timed?.grade === 'perfect') this.tutMission('tPerfect');
    if (timed && this.perfectStreak >= 2) this.tutMission('tStreak2');`],
  // GLOBO DISPARADO
  ['scenes/MatchScene.ts', `      this.missionShot = 'maxLob'; // MISIONES: ESPECIAL + GLOBO MÁXIMO`, `      this.missionShot = 'maxLob'; // MISIONES: ESPECIAL + GLOBO MÁXIMO
      this.tutMission('tChargedLob'); // (24-11-2026) tutorial`],
  // ESTIRADA
  ['scenes/MatchScene.ts', `  private lungeShot() {
    this.lungeAt = 0;`, `  private lungeShot() {
    this.lungeAt = 0;
    this.tutMission('tDive'); // (24-11-2026) misión del tutorial: estirada`],
  // DUELO
  ['scenes/MatchScene.ts', `    d.winner = winner;
    if (this.net && d.judge) this.net.sendAction('duel-result', { w: winner === 'player' ? 1 : 0 });`, `    d.winner = winner;
    if (winner === 'player') this.tutMission('tDuel'); // (24-11-2026) misión del tutorial
    if (this.net && d.judge) this.net.sendAction('duel-result', { w: winner === 'player' ? 1 : 0 });`],
  // ZONA
  ['scenes/MatchScene.ts', `    if (side === 'player') navigator.vibrate?.(80);`, `    if (side === 'player') navigator.vibrate?.(80);
    if (side === 'player') this.tutMission('tZone'); // (24-11-2026) misión del tutorial`],
  // SAQUE CON EFECTO
  ['scenes/MatchScene.ts', `    if (this.net && who === 'player') this.netHit = { charged: false, overhead: false, volley: false, serveSpin: kind === 'spin' };`, `    if (this.net && who === 'player') this.netHit = { charged: false, overhead: false, volley: false, serveSpin: kind === 'spin' };
    if (who === 'player' && kind === 'spin') this.tutMission('tSpinServe'); // (24-11-2026) misión del tutorial`],
  // RIVAL SIN RAQUETA
  ['scenes/MatchScene.ts', `    const rec = { x: to.x, y: to.y, img, mark, shadow, landed: false };
    a.racket = rec;`, `    const rec = { x: to.x, y: to.y, img, mark, shadow, landed: false };
    a.racket = rec;
    if (a !== this.player && a !== this.ally) this.tutMission('tRacket'); // (24-11-2026) misión del tutorial`],
  // PUNTOS: compañero, 3 puntos, DROP SHOT 0
  ['scenes/MatchScene.ts', `      else if (who && who === this.ally) this.pointStats.ally++;`, `      else if (who && who === this.ally) {
        this.pointStats.ally++;
        if (w === 'player') this.tutMission('tTeamPoint'); // (24-11-2026) misión del tutorial
      }`],
  ['scenes/MatchScene.ts', `    this.duelAbort('point'); // punto decidido (también el que llega por red): el duelo en curso se cancela`, `    if (w === 'player' && ++this.tutPointsWon >= 3) this.tutMission('tPoints3'); // (24-11-2026) misiones del tutorial
    if (w === 'player' && reason === '¡DROP SHOT 0!') this.tutMission('tDrop0');
    this.duelAbort('point'); // punto decidido (también el que llega por red): el duelo en curso se cancela`],
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
