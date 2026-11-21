const fs = require('fs');
const base = 'c:/Users/IAGUILERA/Documents/00 Trabajos/GameNxo/frontend/src/';
function edit(f, pairs) {
  let s = fs.readFileSync(base + f, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  s = s.replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (s.includes(b)) continue;
    if (s.split(a).length !== 2) throw new Error(f + ': ' + a.slice(0, 70) + ' x' + (s.split(a).length - 1));
    s = s.replace(a, () => b);
  }
  fs.writeFileSync(base + f, s.replace(/\n/g, nl));
}

edit('ui/PlayEntry2v2.ts', [["rank: rank2v2(coins).id }", "rank: league2v2Of(getPlayer()) }"]]);

edit('ui/LeagueRanking.ts', [
  ["import { coinIcon } from './wheelArt';", "import { coin2v2Image, coinIcon } from './wheelArt';"],
  ["import { leagueLeaders, rankedView } from '../logic/Ranked';", "import { leagueLeaders, rankedView } from '../logic/Ranked';\nimport { leagueView2v2 } from '../logic/League2v2';"],
  ["export function openLeagueRanking(scene: Phaser.Scene, opts: { onClose?: () => void; dim?: boolean } = {}) {", "export function openLeagueRanking(scene: Phaser.Scene, opts: { onClose?: () => void; dim?: boolean; mode?: '1v1' | '2v2' } = {}) {\n  const two = opts.mode === '2v2'; // LIGA 2v2: su tabla de neto semanal en MONEDAS 2v2 (sin los mejores de cada liga)"],
  ["  const v = rankedView();\n  const board = v.board;", "  const v = two ? leagueView2v2() : rankedView();\n  const board = v.board;"],
  [
    "`TOP ${RANKED.tableSize} · LIGA ${rankDef(v.league).name.toUpperCase()}`",
    "`TOP ${RANKED.tableSize} · LIGA${two ? ' 2V2' : ''} ${rankDef(v.league).name.toUpperCase()}`",
  ],
  [
    "`Neto de la semana · cierra en ${fmtLeft(v.msLeft)} · premios Top 1, 2-3, 4-10 y 11-50`",
    "two ? `Neto de la semana en monedas 2v2 · cierra en ${fmtLeft(v.msLeft)}` : `Neto de la semana · cierra en ${fmtLeft(v.msLeft)} · premios Top 1, 2-3, 4-10 y 11-50`",
  ],
  [
    "  const leaders = leagueLeaders();\n  const lw = (pw - 30) / leaders.length;",
    "  const leaders = two ? [] : leagueLeaders();\n  const lw = (pw - 30) / Math.max(1, leaders.length);",
  ],
  ["  p.add(scene.add.text(0, 162, 'MEJOR JUGADOR DE CADA LIGA',", "  if (!two) p.add(scene.add.text(0, 162, 'MEJOR JUGADOR DE CADA LIGA',"],
  ["  const listTop = 180;", "  const listTop = two ? 100 : 180;"],
  ["boardRow(scene, e, i * rowH + rowH / 2, pw - 24, rowH - 6)", "boardRow(scene, e, i * rowH + rowH / 2, pw - 24, rowH - 6, false, two)"],
  ["boardRow(scene, me, listBottom + 6 + rowH / 2, pw - 24, rowH - 4, true)", "boardRow(scene, me, listBottom + 6 + rowH / 2, pw - 24, rowH - 4, true, two)"],
  ["function boardRow(scene: Phaser.Scene, e: BoardEntry, y: number, w: number, h: number, pinned = false) {", "function boardRow(scene: Phaser.Scene, e: BoardEntry, y: number, w: number, h: number, pinned = false, two = false) {"],
]);
