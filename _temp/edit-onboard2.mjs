import { readFileSync, writeFileSync } from 'node:fs';
const S = 'C:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
const E = [
  ['scenes/BootScene.ts', `import { bootRanked, myLeague } from '../logic/Ranked';`, `import { bootRanked, myLeague } from '../logic/Ranked';
import { getPlayer } from '../domain/playerStore';
import { isDevMode } from '../domain/devMode';
import { needsOnboarding } from '../domain/operations';`],
  ['main.ts', `import { MenuScene } from './scenes/MenuScene';`, `import { MenuScene } from './scenes/MenuScene';
import { OnboardingScene } from './scenes/OnboardingScene';`],
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
