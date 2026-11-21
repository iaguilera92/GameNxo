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
edit('domain/rankedBots.ts', [
  [
    "/** Bots de una liga en un momento dado. `realPlayers` = jugadores reales que también están en la tabla. */\nexport function botsFor(id: RankId, clock: BotClock, realPlayers = 1): Omit<BoardEntry, 'position'>[] {\n  const count = Math.max(0, RANKED.tableSize - Math.max(0, realPlayers));\n  if (!count || !clock.week) return [];\n  const goal = botGoal(id);\n  const entry = league(id).entry;",
    "/**\n * Economía de la tabla cuando NO es la de la liga normal (LIGA 2v2, 21-11-2026): meta de ascenso, paso de un resultado neto (lo que se\n * gana en una victoria) y una etiqueta para que sus bots (nombres y resultados) sean otros.\n */\nexport interface BoardEcon {\n  goal: number;\n  entry: number;\n  target: number | null;\n  tag: string;\n}\n/** Bots de una liga en un momento dado. `realPlayers` = jugadores reales que también están en la tabla. `econ` = otra economía (2v2). */\nexport function botsFor(id: RankId, clock: BotClock, realPlayers = 1, econ?: BoardEcon): Omit<BoardEntry, 'position'>[] {\n  const count = Math.max(0, RANKED.tableSize - Math.max(0, realPlayers));\n  if (!count || !clock.week) return [];\n  const goal = econ ? econ.goal : botGoal(id);\n  const entry = econ ? econ.entry : league(id).entry;\n  const tag = econ ? `${econ.tag}:` : '';",
  ],
  ["const week = rng(hash(`cohort:${id}:${clock.week}`));", "const week = rng(hash(`cohort:${tag}${id}:${clock.week}`));"],
  ["const r = rng(hash(`bot:${id}:${clock.week}:${i}`));", "const r = rng(hash(`bot:${tag}${id}:${clock.week}:${i}`));"],
  ["      id: `bot:${id}:${clock.week}:${i}`,", "      id: `bot:${tag}${id}:${clock.week}:${i}`,"],
  [
    "export function buildBoard(id: RankId, clock: BotClock, real: Omit<BoardEntry, 'position'>[]): BoardEntry[] {\n  const target = league(id).target;\n  const entry = league(id).entry;",
    "export function buildBoard(id: RankId, clock: BotClock, real: Omit<BoardEntry, 'position'>[], econ?: BoardEcon): BoardEntry[] {\n  const target = econ ? econ.target : league(id).target;\n  const entry = econ ? econ.entry : league(id).entry;",
  ],
  ["const bots = botsFor(id, clock, real.length).map(", "const bots = botsFor(id, clock, real.length, econ).map("],
]);
