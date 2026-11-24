// (24-11-2026) Menú según el nivel: Amigos desde el 2, ligas desde el 20, partidos completos amistosos del 16 al 19, tutorial solo contra el bot.
import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  ['scenes/MenuScene.ts', `    if (isDevMode() || p.level >= 5) {
      friendsButton(`, `    // (24-11-2026, usuario) AMIGOS desde el nivel 2 (antes 5): para probar con amigos pronto (allí todo va en Default)
    if (isDevMode() || p.level >= 2) {
      friendsButton(`],
  ['scenes/MenuScene.ts', `      if (!isDevMode() && p.level <= 15) {
        const step = guidedStep(p.level, p.tutorial);
        this.scene.start('Matchmaking', { skipSearch: true, from: 'Menu', guide: step === 'play' ? 'first' : step === 'spin' ? 'spin' : undefined });
        return;
      }`, `      if (!isDevMode() && p.level <= 15) {
        const step = guidedStep(p.level, p.tutorial);
        this.scene.start('Matchmaking', { skipSearch: true, from: 'Menu', guide: step === 'play' ? 'first' : step === 'spin' ? 'spin' : undefined });
        return;
      }
      // (24-11-2026, usuario) niveles 16 a 19: partido COMPLETO amistoso contra el bot (sin apuesta: las ligas se abren en el nivel 20)
      if (!isDevMode() && p.level < MAX_LEVEL) {
        this.cameras.main.fadeOut(200, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Matchmaking', { unranked: true, from: 'Menu' }));
        return;
      }`],
  ['scenes/MenuScene.ts', `      const fb = { unranked: false, from: 'Menu', mode: '2v2' };
      this.cameras.main.once('camerafadeoutcomplete', () => (serverUrl() !== null ? this.scene.start('LanSearch', { mode: '2v2', fallback: fb }) : this.scene.start('Matchmaking', fb)));`, `      const fb = { unranked: false, from: 'Menu', mode: '2v2' };
      // (24-11-2026, usuario) en el tutorial (bajo el nivel 20) el 2v2 es contra bots: sin buscar compañero en línea
      const online = serverUrl() !== null && (isDevMode() || getPlayer().level >= MAX_LEVEL);
      this.cameras.main.once('camerafadeoutcomplete', () => (online ? this.scene.start('LanSearch', { mode: '2v2', fallback: fb }) : this.scene.start('Matchmaking', fb)));`],
  // ligas: desde el nivel 20
  ['domain/rankedConfig.ts', `  unlockLevel: 1,`, `  // (24-11-2026, usuario) las LIGAS se abren en el nivel 20 (al terminar el tutorial); antes 1. Se explican en el 17, sin premios
  unlockLevel: 20,`],
  // partidos con amigos (en red, bajo el nivel 20): todas las habilidades
  ['scenes/MatchScene.ts', `  private unlocked(key: UnlockKey) {
    return isUnlocked(key, getPlayer().level);`, `  private unlocked(key: UnlockKey) {
    // (24-11-2026, usuario) partido en red antes del nivel 20 = con AMIGOS (el JUGAR del tutorial es contra el bot): todas las habilidades
    if (this.net && !isDevMode() && getPlayer().level < MAX_LEVEL) return true;
    return isUnlocked(key, getPlayer().level);`],
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
