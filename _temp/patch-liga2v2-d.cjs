const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
function edit(f, pairs) {
  let s = fs.readFileSync(base + f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (s.includes(b)) continue;
    if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 60) + ' x' + (s.split(a).length - 1));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(base + f, s.replace(/\n/g, nl));
}
edit('logic/Profile.ts', [
  ["import { type Result2v2, apply2v2Result } from '../domain/coins2v2';", "import { type Result2v2, apply2v2Result } from '../domain/coins2v2';\nimport { recordMatch2v2 } from '../domain/league2v2';\nimport { gameClock } from '../domain/timeSource';"],
  ["    return { ok: true as const, state: a.state };\n  });\n  return out;", "    // LIGA 2v2: el partido cuenta en el neto de la semana (domain/league2v2.ts)\n    return { ok: true as const, state: recordMatch2v2(a.state, gameClock.now(), r === 'win', a.delta) };\n  });\n  return out;"],
]);
edit('logic/Ranked.ts', [
  ["import type { RankedOutcome } from '../domain/rankedState';", "import type { RankedOutcome } from '../domain/rankedState';\nimport { syncLeague2v2 } from './League2v2';"],
  ["  const after = ranked.abandonPending(before as never, now());\n  if (after !== before) commit(() => ({ ok: true as const, state: after }));", "  const after = ranked.abandonPending(before as never, now());\n  if (after !== before) commit(() => ({ ok: true as const, state: after }));\n  syncLeague2v2(); // LIGA 2v2: cierra su semana igual"],
]);