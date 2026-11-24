import { readFileSync } from 'node:fs';
const m = readFileSync('../frontend/src/scenes/MatchScene.ts', 'utf8');
for (const k of ['tDef', 'tSpecial', 'tChargedLob', 'tDive', 'tDuel', 'tSpinServe', 'tRacket', 'tTeamPoint', 'tDrop0', 'tStreak2']) console.log(k, m.split(`'${k}'`).length - 1);
console.log('req', readFileSync('../frontend/src/scenes/MatchEndScene.ts', 'utf8').split('missionsRequired').length - 1);
